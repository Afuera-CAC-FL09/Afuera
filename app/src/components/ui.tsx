import type { RiskLevel } from "@afuera/engine";
import { router } from "expo-router";
import type { ReactNode } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type PressableStateCallbackType,
  type StyleProp,
  type TextProps,
  type TextStyle,
  type ViewStyle,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLevelName } from "@/lib/heat";
import { useSettings } from "@/state/settings";
import { color, font, radius, risk, space, type, unknownRisk } from "@/theme";
import { BackIcon, GearIcon, PinIcon, ShapeIcon } from "./icons";

type Variant = keyof typeof type;

export function T({ variant = "body", style, ...props }: TextProps & { variant?: Variant; style?: StyleProp<TextStyle> }) {
  return <Text {...props} style={[{ color: color.ink }, type[variant], style]} />;
}

// Web-only states come through Pressable's callback on react-native-web.
type PressState = PressableStateCallbackType & { hovered?: boolean; focused?: boolean };

/** Press feedback: only transform and opacity change, so it stays smooth. */
export function pressFeedback({ pressed, hovered, focused }: PressState): ViewStyle {
  return {
    opacity: pressed ? 0.85 : hovered ? 0.93 : 1,
    transform: [{ scale: pressed ? 0.98 : 1 }],
    ...(focused ? { outlineColor: color.ink, outlineWidth: 2, outlineStyle: "solid", outlineOffset: 2 } : null),
  } as ViewStyle;
}

export function Screen({
  header,
  footer,
  children,
  background = color.bg,
  contentStyle,
}: {
  header?: ReactNode;
  footer?: ReactNode;
  children: ReactNode;
  background?: string;
  contentStyle?: StyleProp<ViewStyle>;
}) {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: background }} edges={["top", "left", "right"]}>
      <View style={styles.column}>
        {header}
        <ScrollView style={{ flex: 1 }} contentContainerStyle={[styles.main, contentStyle]} keyboardShouldPersistTaps="handled">
          {children}
        </ScrollView>
        {footer && <View style={[styles.footer, { backgroundColor: background }]}>{footer}</View>}
      </View>
    </SafeAreaView>
  );
}

/** Place on the left (tap for settings), EN/ES on the right. */
export function PlaceHeader({ subtitle }: { subtitle: string }) {
  const { settings } = useSettings();
  return (
    <View style={styles.header}>
      <Pressable
        accessibilityRole="button"
        accessibilityHint="Settings"
        onPress={() => router.push("/settings")}
        style={(s) => [{ flexDirection: "row", alignItems: "center", gap: space.sm, flexShrink: 1 }, pressFeedback(s)]}
      >
        <PinIcon />
        <View style={{ flexShrink: 1 }}>
          <T variant="place" numberOfLines={1}>
            {settings.place?.name}
          </T>
          <T variant="small" style={{ color: color.muted }} numberOfLines={1}>
            {subtitle}
          </T>
        </View>
      </Pressable>
      <View style={{ flexDirection: "row", alignItems: "center", gap: space.sm }}>
        <LanguageToggle />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Settings"
          onPress={() => router.push("/settings")}
          style={(s) => [{ width: 46, height: 46, borderRadius: 23, backgroundColor: color.sky, alignItems: "center", justifyContent: "center" }, pressFeedback(s)]}
        >
          <GearIcon />
        </Pressable>
      </View>
    </View>
  );
}

/** Back arrow and a title, for screens opened from a tab. */
export function BackHeader({ title, right }: { title: string; right?: ReactNode }) {
  return (
    <View style={[styles.header, { paddingHorizontal: space.md, paddingTop: space.md }]}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: space.xs }}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back"
          onPress={() => (router.canGoBack() ? router.back() : router.replace("/"))}
          style={(s) => [{ width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" }, pressFeedback(s)]}
        >
          <BackIcon />
        </Pressable>
        <T variant="heading">{title}</T>
      </View>
      {right}
    </View>
  );
}

export function LanguageToggle({ value, onChange, surface = color.sky }: { value?: "en" | "es"; onChange?: (l: "en" | "es") => void; surface?: string }) {
  const { settings, update } = useSettings();
  const current = value ?? settings.language;
  const set = onChange ?? ((language: "en" | "es") => update({ language }));
  return (
    <View style={{ flexDirection: "row", backgroundColor: surface, borderRadius: radius.pill, padding: 3 }} accessibilityRole="radiogroup">
      {(["en", "es"] as const).map((l) => (
        <Pressable
          key={l}
          accessibilityRole="radio"
          accessibilityState={{ selected: current === l }}
          accessibilityLabel={l === "en" ? "English" : "Español"}
          onPress={() => set(l)}
          style={(s) => [
            { height: 40, minWidth: 44, paddingHorizontal: space.md, borderRadius: radius.pill, alignItems: "center", justifyContent: "center", backgroundColor: current === l ? color.ink : "transparent" },
            pressFeedback(s),
          ]}
        >
          <T style={{ fontFamily: font.bodyBold, fontSize: 14, color: current === l ? "#FFFFFF" : color.ink }}>{l.toUpperCase()}</T>
        </Pressable>
      ))}
    </View>
  );
}

/** Level badge: color + shape + word. */
export function RiskPill({ level, label, size = "md" }: { level: RiskLevel | null; label?: string; size?: "md" | "sm" | "xs" }) {
  const levelName = useLevelName();
  const look = level ? risk[level] : unknownRisk;
  const dims = {
    md: { pad: { paddingVertical: 6, paddingLeft: 10, paddingRight: 14 }, font: 14, icon: 16 },
    sm: { pad: { paddingVertical: 4, paddingHorizontal: 10 }, font: 13, icon: 12 },
    xs: { pad: { paddingVertical: 3, paddingHorizontal: 9 }, font: 12, icon: 0 },
  }[size];
  return (
    <View style={[{ alignSelf: "flex-start", flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: look.fill, borderRadius: radius.pill }, dims.pad]}>
      {dims.icon > 0 && <ShapeIcon shape={look.shape} size={dims.icon} color={look.ink} />}
      <T style={{ fontFamily: font.bodyBold, fontSize: dims.font, lineHeight: dims.font + 4, color: look.ink }}>{label ?? levelName(level)}</T>
    </View>
  );
}

/** The one big amber action at the bottom of a screen. */
export function Cta({ label, onPress, icon, disabled }: { label: string; onPress: () => void; icon?: ReactNode; disabled?: boolean }) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={(s) => [styles.cta, pressFeedback(s), disabled && { opacity: 0.45 }]}
    >
      {icon}
      <T variant="button" style={{ textAlign: "center", flexShrink: 1 }} numberOfLines={1} adjustsFontSizeToFit>
        {label}
      </T>
    </Pressable>
  );
}

/** Secondary action: sky blue, 48 tall. */
export function SoftButton({ label, onPress, icon, style, surface = color.sky, textColor = color.ink }: { label: string; onPress: () => void; icon?: ReactNode; style?: StyleProp<ViewStyle>; surface?: string; textColor?: string }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={(s) => [styles.soft, { backgroundColor: surface }, pressFeedback(s), style]}>
      {icon}
      <T style={{ fontFamily: font.bodyBold, fontSize: 15, color: textColor }}>{label}</T>
    </Pressable>
  );
}

export function LinkText({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="link" onPress={onPress} style={(s) => [{ alignSelf: "flex-start" }, pressFeedback(s)]}>
      {({ pressed }) => (
        <T variant="bodyBold" style={{ color: pressed ? color.linkPressed : color.link, textDecorationLine: "underline" }}>
          {label}
        </T>
      )}
    </Pressable>
  );
}

/** Sky-blue block. */
export function Section({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.section, style]}>{children}</View>;
}

/** White block with a thin blue border. */
export function OutlineCard({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.outline, style]}>{children}</View>;
}

export function Chip({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={(s) => [{ height: 44, paddingHorizontal: space.lg, borderRadius: radius.pill, justifyContent: "center", backgroundColor: selected ? color.ink : color.sky }, pressFeedback(s)]}
    >
      <T style={{ fontFamily: selected ? font.bodyBold : font.bodySemi, fontSize: 14, color: selected ? "#FFFFFF" : color.ink }}>{label}</T>
    </Pressable>
  );
}

export function Stat({ value, label, size = 32 }: { value: string; label: string; size?: number }) {
  return (
    <View style={{ flex: 1, gap: 2, minWidth: 0 }}>
      <T style={{ fontFamily: font.display, fontSize: size, lineHeight: size + 2 }} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </T>
      <T variant="caption" style={{ color: color.muted }}>
        {label}
      </T>
    </View>
  );
}

/** Info strip for warnings (old data, NWS alerts). */
export function Notice({ tone, title, body }: { tone: "warn" | "storm"; title: string; body?: string }) {
  const look = tone === "warn" ? { bg: color.amberTint, ink: color.amberInk } : { bg: color.sky, ink: color.ink };
  return (
    <View accessibilityRole="alert" style={{ backgroundColor: look.bg, borderRadius: radius.card, padding: space.md, gap: 2 }}>
      <T variant="smallBold" style={{ color: look.ink }}>
        {title}
      </T>
      {body ? (
        <T variant="small" style={{ color: look.ink }}>
          {body}
        </T>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  column: { flex: 1, width: "100%", maxWidth: 520, alignSelf: "center" },
  header: { paddingHorizontal: space.xl, paddingTop: space.lg, paddingBottom: space.sm, flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: space.md },
  main: { paddingHorizontal: space.xl, paddingTop: space.sm, paddingBottom: space.lg, gap: space.lg },
  footer: { paddingHorizontal: space.xl, paddingTop: 10, paddingBottom: space.sm, borderTopWidth: 1, borderTopColor: color.sky, gap: space.sm },
  cta: { height: 56, borderRadius: radius.cta, backgroundColor: color.amber, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: space.sm, paddingHorizontal: space.lg },
  soft: { height: 48, borderRadius: radius.button, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: space.sm, paddingHorizontal: space.md },
  section: { backgroundColor: color.sky, borderRadius: radius.section, paddingVertical: 18, paddingHorizontal: space.lg, gap: space.lg },
  outline: { borderWidth: 1, borderColor: color.line, borderRadius: radius.section, padding: 18, gap: space.sm },
});
