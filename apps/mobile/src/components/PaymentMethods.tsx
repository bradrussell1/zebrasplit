import { availablePlatforms, isValidHandle, normalizeHandle, PAY_PLATFORMS, PLATFORM_SPECS, type Handles, type PayPlatform } from "@bunktab/core";
import { color, layout, space } from "@bunktab/theme";
import { useMemo, useState } from "react";
import { StyleSheet, View } from "react-native";
import { Input, PlatformMark, Press, SegmentedControl, ZText } from "@/ui";
import { removeHandle, saveHandle, setDefaultPlatform } from "@/lib/payments";

/**
 * "How you get paid": one field per platform, plus which one people should
 * reach for first. At least one is required — a Dazzle can't settle to someone
 * nobody can pay.
 *
 * These handles are public to the people you share a Dazzle with, which is the
 * whole point: they are the address your friends send money to. Nothing here is
 * a credential, and Zebrasplit never sees the payment itself.
 */
const HINTS: Record<PayPlatform, string> = {
  venmo: "5–30 letters, numbers, hyphens or underscores",
  cashapp: "Starts with a letter, up to 20 letters and numbers",
  paypal: "The name in your paypal.me link",
};

export type PaymentMethodsValue = { handles: Handles; defaultPlatform: PayPlatform | null };

export function PaymentMethodsEditor({
  value,
  onChange,
  error,
}: {
  value: PaymentMethodsValue;
  onChange: (next: PaymentMethodsValue) => void;
  error?: string | null;
}) {
  const [touched, setTouched] = useState<Partial<Record<PayPlatform, boolean>>>({});
  const filled = useMemo(() => availablePlatforms(value.handles), [value.handles]);

  const setHandle = (p: PayPlatform, raw: string) => {
    const handles = { ...value.handles };
    if (raw.trim()) handles[p] = raw; else delete handles[p];
    // the default must always point at something that is actually filled in
    const stillValid = value.defaultPlatform && handles[value.defaultPlatform];
    const nextDefault = stillValid ? value.defaultPlatform : (availablePlatforms(handles)[0] ?? null);
    onChange({ handles, defaultPlatform: nextDefault });
  };

  return (
    <View style={styles.wrap}>
      <View style={styles.head}>
        <ZText variant="headline">How you get paid</ZText>
        <ZText variant="caption" color={color.textSecondary}>
          Add at least one. People in your Dazzle see these so they can pay you — Zebrasplit never touches the money.
        </ZText>
      </View>

      {PAY_PLATFORMS.map((p) => {
        const spec = PLATFORM_SPECS[p];
        const raw = value.handles[p] ?? "";
        const bad = !!raw.trim() && touched[p] && !isValidHandle(p, raw);
        return (
          <View key={p} style={styles.row}>
            <View style={styles.rowHead}>
              <PlatformMark platform={p} size={20} />
              <ZText variant="bodyStrong">{spec.label}</ZText>
            </View>
            <Input
              label={spec.handleLabel}
              placeholder={p === "paypal" ? "yourname" : `${spec.prefix}yourname`}
              value={raw}
              onChangeText={(t: string) => setHandle(p, t)}
              onBlur={() => setTouched((s) => ({ ...s, [p]: true }))}
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="done"
              helper={bad ? undefined : HINTS[p]}
              error={bad ? `That doesn't look like a ${spec.label} ${spec.handleLabel}. ${HINTS[p]}.` : undefined}
            />
          </View>
        );
      })}

      {filled.length > 1 ? (
        <View style={styles.row}>
          <ZText variant="bodyStrong">Which should people use first?</ZText>
          <SegmentedControl
            options={filled.map((p) => ({ key: p, label: PLATFORM_SPECS[p].label }))}
            value={value.defaultPlatform ?? filled[0]!}
            onChange={(k: string) => onChange({ ...value, defaultPlatform: k as PayPlatform })}
          />
          <ZText variant="caption" color={color.textSecondary}>
            Whoever owes you can still switch to another one you&apos;ve added.
          </ZText>
        </View>
      ) : null}

      {error ? <ZText variant="caption" color={color.youOweText}>{error}</ZText> : null}
    </View>
  );
}

/**
 * Write the edited set: every valid handle upserted, anything cleared removed,
 * and the default recorded. Returns an error message, or null when it saved.
 */
export async function savePaymentMethods(userId: string, value: PaymentMethodsValue, previous: Handles): Promise<string | null> {
  const filled = availablePlatforms(value.handles);
  if (filled.length === 0) return "Add at least one way to get paid.";
  for (const p of filled) {
    if (!isValidHandle(p, value.handles[p]!)) return `Check your ${PLATFORM_SPECS[p].label} ${PLATFORM_SPECS[p].handleLabel}.`;
  }
  for (const p of PAY_PLATFORMS) {
    const now = value.handles[p];
    const was = previous[p];
    if (now && normalizeHandle(p, now) !== (was ? normalizeHandle(p, was) : "")) {
      const e = await saveHandle(userId, p, now);
      if (e) return e;
    } else if (!now && was) {
      const e = await removeHandle(userId, p);
      if (e) return e;
    }
  }
  const def = value.defaultPlatform ?? filled[0]!;
  return setDefaultPlatform(userId, def);
}

/** The "pick a tappable default" row used on the onboarding step. */
export function PlatformPills({ value, onChange, options }: { value: PayPlatform | null; onChange: (p: PayPlatform) => void; options: PayPlatform[] }) {
  return (
    <View style={styles.pills}>
      {options.map((p) => (
        <Press
          key={p}
          onPress={() => onChange(p)}
          scaleTo={0.97}
          accessibilityRole="button"
          accessibilityState={{ selected: value === p }}
          accessibilityLabel={PLATFORM_SPECS[p].label}
          style={[styles.pill, value === p ? styles.pillOn : null]}
        >
          <PlatformMark platform={p} size={18} />
          <ZText variant="captionStrong">{PLATFORM_SPECS[p].label}</ZText>
        </Press>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space[16] },
  head: { gap: space[4] },
  row: { gap: space[8] },
  rowHead: { flexDirection: "row", alignItems: "center", gap: space[8] },
  pills: { flexDirection: "row", flexWrap: "wrap", gap: space[8] },
  pill: { flexDirection: "row", alignItems: "center", gap: space[6], paddingVertical: space[8], paddingHorizontal: space[12], borderRadius: layout.minTapTarget, backgroundColor: color.surfaceInset },
  pillOn: { backgroundColor: color.owedToYou },
});
