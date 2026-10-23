import { waterEveryFor } from "@/lib/profile";
import { router } from "expo-router";
import { useKeepAwake } from "expo-keep-awake";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { SoftButton, T } from "@/components/ui";
import { DropIcon } from "@/components/icons";
import { guidanceKey, guidanceText, useCurrentRisk } from "@/lib/heat";
import i18n from "@/i18n";
import { useSettings } from "@/state/settings";
import { risk, space, unknownRisk } from "@/theme";

// Full-screen bilingual sign for a crowd. Keeps the screen on.
export default function BigEvent() {
  useKeepAwake();
  const { t } = useTranslation();
  const { settings } = useSettings();
  const { hour } = useCurrentRisk();
  const [openedAt] = useState(() => Date.now());
  const [clock, setClock] = useState(() => Date.now());

  useEffect(() => {
    const timer = setInterval(() => setClock(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const look = hour?.level ? risk[hour.level] : unknownRisk;
  const both = (key: string, opts?: object) => ({ en: i18n.t(key, { lng: "en", ...opts }), es: i18n.t(key, { lng: "es", ...opts }) });
  const level = hour?.level ? both(`common.levels.${hour.level}`) : both("common.unknown");
  const g = hour ? guidanceKey(hour) : null;

  const every = hour?.level ? waterEveryFor(settings, hour.level) : undefined;
  const periodMs = (every ?? 30) * 60_000;
  const elapsed = clock - openedAt;
  const phase = elapsed % periodMs;
  const breakNow = elapsed >= periodMs && phase < 4 * 60_000; // the 4-minute break itself
  const untilBreak = periodMs - phase;
  const mm = Math.floor(untilBreak / 60_000);
  const ss = Math.floor((untilBreak % 60_000) / 1000);

  // Spanish first: most of the crowd in FL-09 reads it first.
  const lines = (pair: { en: string; es: string }, variant: "hero" | "title" | "body", tone = look.ink) => (
    <View style={{ alignItems: "center" }}>
      <T variant={variant} style={{ color: tone, textAlign: "center" }}>
        {pair.es}
      </T>
      <T variant={variant === "hero" ? "title" : "body"} style={{ color: tone, opacity: 0.8, textAlign: "center" }}>
        {pair.en}
      </T>
    </View>
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: look.fill }}>
      <View style={{ flex: 1, padding: space.xl, justifyContent: "space-between", alignItems: "center" }}>
        {lines(both("common.heatRisk"), "body")}
        <View style={{ alignItems: "center", gap: space.md }}>
          <T variant="hero" style={{ color: look.ink, fontSize: 96, lineHeight: 100, letterSpacing: -3, textAlign: "center", fontFamily: "SpaceGrotesk_500Medium" }}>
            {level.es}
          </T>
          <T variant="title" style={{ color: look.ink, opacity: 0.8 }}>
            {level.en}
          </T>
          {hour?.wbgtF != null && (
            <T variant="bodyBold" style={{ color: look.ink }}>
              {t("common.wbgtF", { value: hour.wbgtF.toFixed(1) })}
            </T>
          )}
        </View>

        <View style={{ alignItems: "center", gap: space.sm, backgroundColor: "rgba(255,255,255,0.18)", borderRadius: 24, padding: space.xl, alignSelf: "stretch" }}>
          <DropIcon size={36} color={look.ink} />
          {breakNow ? (
            lines(both("event.breakNow"), "title")
          ) : (
            <>
              {lines(both("event.nextBreak"), "body")}
              <T variant="hero" style={{ color: look.ink, fontVariant: ["tabular-nums"], fontSize: 72, lineHeight: 76, fontFamily: "SpaceGrotesk_300Light" }}>
                {mm}:{String(ss).padStart(2, "0")}
              </T>
            </>
          )}
          {lines(both(breakNow ? "event.drink" : "event.shade"), "body")}
        </View>

        {g && lines({ en: guidanceText(i18n.getFixedT("en"), g, settings.activity), es: guidanceText(i18n.getFixedT("es"), g, settings.activity) }, "body")}
        <SoftButton label={t("event.exit")} onPress={() => router.back()} surface="#FFFFFF" style={{ alignSelf: "stretch" }} />
      </View>
    </SafeAreaView>
  );
}
