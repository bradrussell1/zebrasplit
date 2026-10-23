# RevenueCat

The store sells, RevenueCat verifies, the server grants. Nothing in the app can give
itself an outfit, so everything below is about making those three parties agree.

Project: `aa02039d` ("Zebrasplit"), dashboard
<https://app.revenuecat.com/projects/aa02039d>.

## What is set up

| Thing | State |
| --- | --- |
| App Store app | `Zebrasplit (App Store)`, id `app29c62e9ed9`, bundle `com.bunktab.app` |
| In-app purchase key (.p8) | uploaded, "Valid credentials" — key `FVCLV9C6X9` |
| Webhook | `Zebrasplit Supabase` → the Edge Function, all apps, all events, production **and** sandbox |
| Webhook auth | shared secret in the `Authorization` header, matching `REVENUECAT_WEBHOOK_SECRET` in Supabase |
| SDK key (iOS) | `EXPO_PUBLIC_REVENUECAT_IOS_KEY` in EAS production, preview and development, and in `apps/mobile/.env` |

The webhook was proved end to end with RevenueCat's own test event: **200**, logged and
ignored, because `TEST` is not an event we act on. A wrong or missing secret gets 401.

## What is not

- **App Store Connect API key.** Separate from the in-app purchase key above, and not
  uploaded. Without it the **Import** button on Product catalog → Products is greyed
  out, so the 27 products are not in RevenueCat's catalog. Purchases still work —
  `getProducts()` asks StoreKit directly and the receipt is what RevenueCat verifies —
  so this buys analytics, price sync and a catalogue that matches the store, not the
  ability to sell. Generate it in App Store Connect → Users and Access → Integrations →
  App Store Connect API, download the `.p8`, upload it on the app's RevenueCat page,
  then click Import.
- **Play Store app.** Nothing yet. It needs a Google Play service account JSON, and
  Play needs the products to exist, which needs the closed test. `EXPO_PUBLIC_REVENUECAT_ANDROID_KEY`
  stays empty until then; with no key the app reports that buying isn't open rather
  than failing.
- **Offerings, entitlements and paywalls.** Deliberately unused. An entitlement answers
  "may this user do X"; our question is "does this user own this outfit", and
  `user_cosmetics` answers it. The Shop is our own screen, not a RevenueCat paywall.

## The secret

Generated locally, written straight into Supabase function secrets through the
Management API and pasted into RevenueCat from the clipboard — it has never been in a
file in this repo, a command line, or a chat transcript. To roll it: generate a new
one, set `REVENUECAT_WEBHOOK_SECRET` in Supabase, then paste the same value into the
webhook's Authorization header field. Deliveries fail with 401 between those two steps;
RevenueCat retries for 72 hours, so a few minutes of mismatch loses nothing.

## Refunds

There are none. See `supabase/functions/README.md` — a refunded outfit stays on the
zebra, and the webhook answers 200 without acting.
