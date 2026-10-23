import { Redirect, Tabs } from "expo-router";
import type { ComponentProps } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ChatIcon, ClockIcon, PulseIcon, SunIcon } from "@/components/icons";
import { pressFeedback, T } from "@/components/ui";
import { useSettings } from "@/state/settings";
import { color, dark, font, radius } from "@/theme";

type TabBarProps = Parameters<NonNullable<ComponentProps<typeof Tabs>["tabBar"]>>[0];

const ICONS = { index: SunIcon, better: ClockIcon, ask: ChatIcon, live: PulseIcon } as const;

export default function TabsLayout() {
  const { settings } = useSettings();
  const { t } = useTranslation();
  if (!settings.place) return <Redirect href="/setup" />;

  return (
    <Tabs screenOptions={{ headerShown: false }} tabBar={(props) => <TabBar {...props} />}>
      <Tabs.Screen name="index" options={{ title: t("today.tab") }} />
      <Tabs.Screen name="better" options={{ title: t("better.tab") }} />
      <Tabs.Screen name="ask" options={{ title: t("ask.tab") }} />
      <Tabs.Screen name="live" options={{ title: t("live.tab") }} />
    </Tabs>
  );
}

/** Four tabs; the active one gets an amber pill behind its icon. Dark on the Live tab. */
function TabBar({ state, descriptors, navigation }: TabBarProps) {
  const insets = useSafeAreaInsets();
  const onLive = state.routes[state.index].name === "live";
  const bg = onLive ? dark.bg : color.bg;

  return (
    <View style={{ backgroundColor: bg, borderTopWidth: onLive ? 1 : 0, borderTopColor: dark.divider }}>
      <View style={{ flexDirection: "row", paddingHorizontal: 8, paddingTop: 4, paddingBottom: Math.max(14, insets.bottom), width: "100%", maxWidth: 520, alignSelf: "center" }}>
        {state.routes.map((route, i) => {
          const focused = state.index === i;
          const Icon = ICONS[route.name as keyof typeof ICONS];
          const tint = onLive ? (focused ? dark.text : dark.muted) : focused ? color.ink : color.muted;
          const pill = focused ? (onLive ? "rgba(245,166,35,0.32)" : color.amberTint) : "transparent";
          return (
            <Pressable
              key={route.key}
              accessibilityRole="tab"
              accessibilityState={{ selected: focused }}
              onPress={() => {
                const event = navigation.emit({ type: "tabPress", target: route.key, canPreventDefault: true });
                if (!focused && !event.defaultPrevented) navigation.navigate(route.name);
              }}
              style={(s) => [{ flex: 1, minHeight: 52, alignItems: "center", justifyContent: "center", gap: 2 }, pressFeedback(s)]}
            >
              <View style={{ width: 56, height: 30, borderRadius: radius.pill, backgroundColor: pill, alignItems: "center", justifyContent: "center" }}>
                {Icon && <Icon color={onLive && focused ? color.amber : tint} />}
              </View>
              <T style={{ fontSize: 12, lineHeight: 16, color: tint, fontFamily: focused ? font.bodyBold : font.body }}>{descriptors[route.key].options.title}</T>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
