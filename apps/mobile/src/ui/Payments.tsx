import { PLATFORM_SPECS, type PayPlatform } from "@bunktab/core";
import { color, radius, space } from "@bunktab/theme";
import { StyleSheet, View } from "react-native";
import Svg, { Circle, G, Path, Rect } from "react-native-svg";
import { Press } from "./Press";
import { ZText } from "./Text";

/**
 * The platform mark beside a payment, and the chip for changing it.
 *
 * These are the vendors' own marks, supplied by the owner, all three as vector
 * paths. Each is purely decorative — the surrounding control carries the
 * accessible name — so none of them is exposed to VoiceOver.
 *
 * Nothing here animates, so the static `transform` on the Venmo group is safe:
 * the rule against transform strings applies to Reanimated animated props.
 */

function VenmoMark({ size }: { size: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 64 64">
      <G transform="matrix(.124031 0 0 .124031 0 56.062016)">
        <Rect y={-452} rx={61} height={516} width={516} fill="#3396cd" />
        <Path
          d="M385.16-347c11.1 18.3 16.08 37.17 16.08 61 0 76-64.87 174.7-117.52 244H163.5l-48.2-288.35 105.3-10 25.6 205.17C270-174 299.43-235 299.43-276.56c0-22.77-3.9-38.25-10-51z"
          fill="#fff"
        />
      </G>
    </Svg>
  );
}

function PayPalMark({ size }: { size: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 48 48">
      <Circle cx={24} cy={24} r={20} fill="#0070BA" />
      <Path
        d="M32.3305 18.0977C32.3082 18.24 32.2828 18.3856 32.2542 18.5351C31.2704 23.5861 27.9046 25.331 23.606 25.331H21.4173C20.8916 25.331 20.4486 25.7127 20.3667 26.2313L19.2461 33.3381L18.9288 35.3527C18.8755 35.693 19.1379 36 19.4815 36H23.3634C23.8231 36 24.2136 35.666 24.286 35.2127L24.3241 35.0154L25.055 30.3772L25.1019 30.1227C25.1735 29.6678 25.5648 29.3338 26.0245 29.3338H26.6051C30.3661 29.3338 33.3103 27.8068 34.1708 23.388C34.5303 21.5421 34.3442 20.0008 33.393 18.9168C33.1051 18.59 32.748 18.3188 32.3305 18.0977Z"
        fill="#fff"
        fillOpacity={0.6}
      />
      <Path
        d="M31.3009 17.6871C31.1506 17.6434 30.9955 17.6036 30.8364 17.5678C30.6766 17.5328 30.5127 17.5018 30.3441 17.4748C29.754 17.3793 29.1074 17.334 28.4147 17.334H22.5676C22.4237 17.334 22.2869 17.3666 22.1644 17.4254C21.8948 17.5551 21.6944 17.8104 21.6459 18.1229L20.402 26.0013L20.3662 26.2311C20.4481 25.7126 20.8911 25.3308 21.4168 25.3308H23.6055C27.9041 25.3308 31.2699 23.5851 32.2537 18.5349C32.2831 18.3854 32.3078 18.2398 32.33 18.0975C32.0811 17.9655 31.8115 17.8525 31.5212 17.7563C31.4496 17.7324 31.3757 17.7094 31.3009 17.6871Z"
        fill="#fff"
        fillOpacity={0.8}
      />
      <Path
        d="M21.6461 18.1231C21.6946 17.8105 21.895 17.5552 22.1646 17.4264C22.2879 17.3675 22.4239 17.3349 22.5678 17.3349H28.4149C29.1077 17.3349 29.7542 17.3803 30.3444 17.4757C30.513 17.5027 30.6768 17.5338 30.8367 17.5687C30.9957 17.6045 31.1508 17.6443 31.3011 17.688C31.3759 17.7103 31.4498 17.7334 31.5222 17.7564C31.8125 17.8527 32.0821 17.9664 32.331 18.0976C32.6237 16.231 32.3287 14.9601 31.3194 13.8093C30.2068 12.5424 28.1986 12 25.629 12H18.169C17.6441 12 17.1963 12.3817 17.1152 12.9011L14.0079 32.5969C13.9467 32.9866 14.2473 33.3381 14.6402 33.3381H19.2458L20.4022 26.0014L21.6461 18.1231Z"
        fill="#fff"
      />
    </Svg>
  );
}

function CashAppMark({ size }: { size: number }) {
  // One path: the squircle with the $ cut out of it, so the fill colour is the badge.
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        fill="#00D632"
        d="M23.59 3.475a5.1 5.1 0 00-3.05-3.05c-1.31-.42-2.5-.42-4.92-.42H8.36c-2.4 0-3.61 0-4.9.4a5.1 5.1 0 00-3.05 3.06C0 4.765 0 5.965 0 8.365v7.27c0 2.41 0 3.6.4 4.9a5.1 5.1 0 003.05 3.05c1.3.41 2.5.41 4.9.41h7.28c2.41 0 3.61 0 4.9-.4a5.1 5.1 0 003.06-3.06c.41-1.3.41-2.5.41-4.9v-7.25c0-2.41 0-3.61-.41-4.91zm-6.17 4.63l-.93.93a.5.5 0 01-.67.01 5 5 0 00-3.22-1.18c-.97 0-1.94.32-1.94 1.21 0 .9 1.04 1.2 2.24 1.65 2.1.7 3.84 1.58 3.84 3.64 0 2.24-1.74 3.78-4.58 3.95l-.26 1.2a.49.49 0 01-.48.39H9.63l-.09-.01a.5.5 0 01-.38-.59l.28-1.27a6.54 6.54 0 01-2.88-1.57v-.01a.48.48 0 010-.68l1-.97a.49.49 0 01.67 0c.91.86 2.13 1.34 3.39 1.32 1.3 0 2.17-.55 2.17-1.42 0-.87-.88-1.1-2.54-1.72-1.76-.63-3.43-1.52-3.43-3.6 0-2.42 2.01-3.6 4.39-3.71l.25-1.23a.48.48 0 01.48-.38h1.78l.1.01c.26.06.43.31.37.57l-.27 1.37c.9.3 1.75.77 2.48 1.39l.02.02c.19.2.19.5 0 .68z"
      />
    </Svg>
  );
}

export function PlatformMark({ platform, size: s = 22 }: { platform: PayPlatform; size?: number }) {
  return (
    <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{ width: s, height: s }}>
      {platform === "venmo" ? <VenmoMark size={s} />
        : platform === "paypal" ? <PayPalMark size={s} />
          : <CashAppMark size={s} />}
    </View>
  );
}

/** Tappable "paying with Venmo" chip; the whole chip is one control. */
export function PlatformChip({ platform, onPress, disabled }: { platform: PayPlatform; onPress?: () => void; disabled?: boolean }) {
  const label = PLATFORM_SPECS[platform].label;
  const body = (
    <View style={styles.chip}>
      <PlatformMark platform={platform} size={18} />
      <ZText variant="captionStrong">{label}</ZText>
      {onPress && !disabled ? <ZText variant="caption" color={color.textMuted}>Change</ZText> : null}
    </View>
  );
  if (!onPress || disabled) return body;
  return (
    <Press onPress={onPress} scaleTo={0.97} accessibilityRole="button" accessibilityLabel={`Paying with ${label}. Change payment method`}>
      {body}
    </Press>
  );
}

const styles = StyleSheet.create({
  chip: { flexDirection: "row", alignItems: "center", gap: space[6], paddingVertical: space[4], paddingHorizontal: space[8], borderRadius: radius.pill, backgroundColor: color.surfaceInset },
});
