/**
 * Buying outfits.
 *
 * The app never grants anything. It asks the store to sell a product; the store tells
 * RevenueCat; RevenueCat verifies the receipt and posts to the revenuecat-webhook Edge
 * Function, which calls grant_purchase() as the service role. Only then does the item
 * exist in user_cosmetics, which is the only table the zebra reads. So a tampered client
 * can call everything in this file and still own nothing.
 *
 * That means a successful purchase here is not the end of the story: the webhook lands a
 * moment later, so the caller reloads the wardrobe rather than assuming. `waitForGrant`
 * is that wait, and it gives up quietly — the item still arrives, just not while you are
 * looking at the button.
 *
 * Keys are publishable (EXPO_PUBLIC_REVENUECAT_*). They identify the app to RevenueCat
 * and cannot grant anything; the secret that can is the webhook's, and it lives in
 * Supabase. With no key configured every call here is a no-op that reports "not open",
 * which is what a build without purchases should do.
 */
import { Platform } from "react-native";
import Purchases, { LOG_LEVEL, PURCHASES_ERROR_CODE, type PurchasesStoreProduct } from "react-native-purchases";
import { supabase } from "./supabase";

const apiKey = Platform.select({
  ios: process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY,
  android: process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY,
});

export const purchasesEnabled = !!apiKey;

let configured = false;

/**
 * Called once the user is known. RevenueCat's app_user_id is the Supabase user id, which
 * is what lets the webhook say who bought the thing; without it a purchase arrives
 * anonymous and cannot be granted to anybody.
 */
export async function configurePurchases(userId: string): Promise<void> {
  if (!apiKey || configured) return;
  if (__DEV__) Purchases.setLogLevel(LOG_LEVEL.WARN);
  Purchases.configure({ apiKey, appUserID: userId });
  configured = true;
}

/** Prices to show, keyed by product id. Empty when purchases are not configured. */
export async function storePrices(productIds: string[]): Promise<Record<string, string>> {
  if (!apiKey || productIds.length === 0) return {};
  try {
    const products: PurchasesStoreProduct[] = await Purchases.getProducts(productIds);
    return Object.fromEntries(products.map((p) => [p.identifier, p.priceString]));
  } catch {
    return {};
  }
}

export type BuyResult =
  | { ok: true }
  | { ok: false; cancelled: true }
  | { ok: false; cancelled: false; message: string };

/**
 * Buy one product. Cancelling is not an error — it is the most common outcome of a
 * purchase sheet and must never show a failure message.
 */
export async function buyProduct(productId: string): Promise<BuyResult> {
  if (!apiKey) return { ok: false, cancelled: false, message: "Buying isn't open in this build yet." };
  try {
    const [product] = await Purchases.getProducts([productId]);
    if (!product) return { ok: false, cancelled: false, message: "That item isn't in the store yet." };
    await Purchases.purchaseStoreProduct(product);
    return { ok: true };
  } catch (e) {
    const err = e as { userCancelled?: boolean; code?: string; message?: string };
    if (err.userCancelled) return { ok: false, cancelled: true };
    if (err.code === PURCHASES_ERROR_CODE.PAYMENT_PENDING_ERROR) {
      return { ok: false, cancelled: false, message: "Waiting on approval for that payment. It'll arrive when it clears." };
    }
    return { ok: false, cancelled: false, message: err.message ?? "That didn't go through. Nothing was charged." };
  }
}

/**
 * Restore Purchases. Apple requires a way back to what you already paid for — a new
 * phone, a reinstall, a second device — and rejects non-consumables without it.
 * RevenueCat replays the receipts, which replays the webhooks, which re-grants.
 */
export async function restorePurchases(): Promise<BuyResult> {
  if (!apiKey) return { ok: false, cancelled: false, message: "Buying isn't open in this build yet." };
  try {
    await Purchases.restorePurchases();
    return { ok: true };
  } catch (e) {
    return { ok: false, cancelled: false, message: (e as { message?: string }).message ?? "Couldn't reach the store." };
  }
}

/**
 * Wait for the webhook to land, up to about six seconds. Stores and webhooks are not
 * instant and the Shop should not claim an item before the database agrees it is yours.
 * Returns true if it arrived; false means "not yet", never "it failed".
 */
export async function waitForGrant(cosmeticIds: string[], tries = 6): Promise<boolean> {
  const { data: session } = await supabase.auth.getSession();
  const uid = session.session?.user.id;
  if (!uid || cosmeticIds.length === 0) return false;
  for (let i = 0; i < tries; i++) {
    await new Promise((r) => setTimeout(r, 400 + i * 300));
    const { data } = await supabase
      .from("user_cosmetics")
      .select("cosmetic_id")
      .eq("user_id", uid)
      .in("cosmetic_id", cosmeticIds);
    if ((data?.length ?? 0) >= cosmeticIds.length) return true;
  }
  return false;
}
