import type { HourRisk } from "@afuera/engine";
import { router } from "expo-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ScrollView, View } from "react-native";
import { ClockDial } from "@/components/ClockDial";
import { Chip, Cta, PlaceHeader, RiskPill, Screen, T } from "@/components/ui";
import { splitTime, useLevelName, useTimeFormat } from "@/lib/heat";
import { usePlan, waterEvery, windowParams } from "@/lib/plan";
import { activityName } from "@/lib/profile";
import { useSettings } from "@/state/settings";
import { useWeather } from "@/state/weather";
import { color, font, radius, risk, space } from "@/theme";

export default function BetterTime() {
  const { t } = useTranslation();
  const { settings } = useSettings();
  const { risks, now } = useWeather();
  const { hour, search, reason, localDate, localHour, today } = usePlan();
  const levelName = useLevelName();
  const fmt = useTimeFormat();
  const activity = activityName(settings, settings.language);

  const days: string[] = [];
  for (const h of risks) {
    const d = localDate(h.time);
    if (d >= today && !days.includes(d) && days.length < 5) days.push(d);
  }
  const [picked, setPicked] = useState<string | null>(null);
  const day = picked ?? days[0];
  const best = search.byDay.find((w) => w.localDate === day) ?? null;

  // A 12-hour face: mornings show 6 AM–6 PM, otherwise 9 AM–9 PM.
  const firstHour = best && localHour(best.start) < 9 ? 6 : 9;
  const dayHours = risks.filter((h) => localDate(h.time) === day);
  const slots: (HourRisk | null)[] = Array(12).fill(null);
  for (const h of dayHours) {
    const lh = localHour(h.time);
    if (lh >= firstHour && lh < firstHour + 12) slots[lh % 12] = h;
  }
  // Clock position; Florida's UTC offset is whole hours, so minutes carry over.
  const frac = (d: Date) => (localHour(d) % 12) + d.getUTCMinutes() / 60;
  const bestArc = best ? { from: frac(best.start), to: frac(best.start) + (best.end.getTime() - best.start.getTime()) / 3_600_000 } : null;
  const nowOnFace = day === today && localHour(now) >= firstHour && localHour(now) < firstHour + 12 ? frac(now) : null;

  const start = best ? splitTime(fmt.time(best.start)) : null;
  const end = best ? splitTime(fmt.time(best.end)) : null;
  const dayName = (d: string, i: number) => (i === 0 ? t("better.today") : fmt.weekday(new Date(`${d}T16:00:00Z`)));

  const card = (title: string, h: HourRisk | null, time: string, highlight: boolean) => (
    <View
      style={[
        { flex: 1, borderRadius: radius.card, padding: 14, gap: 6 },
        highlight ? { backgroundColor: color.bg, borderWidth: 2, borderColor: color.amber, padding: 13 } : { backgroundColor: color.sky },
      ]}
    >
      <T variant="small" style={{ color: color.muted }}>
        {title}
      </T>
      <T style={{ fontFamily: font.displayMedium, fontSize: 24, lineHeight: 28 }}>{time}</T>
      <RiskPill level={h?.level ?? null} size="xs" />
      {h?.level && h.wbgtF != null && (
        <T variant="small" style={{ lineHeight: 18 }}>
          {h.level === "lower"
            ? t("better.regular", { wbgt: Math.round(h.wbgtF) })
            : t("better.waterEvery", { wbgt: Math.round(h.wbgtF), count: waterEvery(settings, h.level) })}
        </T>
      )}
    </View>
  );

  const bestHour = best ? risks.find((h) => h.time.getTime() === best.start.getTime()) ?? null : null;
  const showCompare = best && hour?.level && day >= today && best.start.getTime() !== Math.floor(now.getTime() / 3_600_000) * 3_600_000;

  return (
    <Screen
      header={<PlaceHeader subtitle={t("better.subtitle", { activity, minutes: settings.durationMinutes })} />}
      contentStyle={{ gap: 14 }}
      footer={
        best && hour?.level && best.level !== hour.level ? (
          <Cta label={t("today.move", { activity: activity.toLowerCase(), time: fmt.time(best.start) })} onPress={() => router.push({ pathname: "/share", params: windowParams(best) })} />
        ) : undefined
      }
    >
      <T variant="title" accessibilityRole="header">
        {t("better.title")}
      </T>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
        {days.map((d, i) => (
          <Chip key={d} label={dayName(d, i)} selected={d === day} onPress={() => setPicked(d)} />
        ))}
      </ScrollView>

      <ClockDial
        slots={slots}
        best={bestArc}
        now={nowOnFace}
        label={`${t("better.dialLabel", { day: dayName(day, days.indexOf(day)) })}${best ? ` ${fmt.window(best)}, ${levelName(best.level)}.` : ""}`}
      >
        {best && start && end ? (
          <>
            <View style={{ backgroundColor: color.amberTint, borderRadius: radius.pill, paddingVertical: 4, paddingHorizontal: 12 }}>
              <T variant="smallBold" style={{ color: color.amberInk }}>
                {t("better.recommended")}
              </T>
            </View>
            <T style={{ fontFamily: font.displayLight, fontSize: 46, lineHeight: 50, letterSpacing: -1.5 }} adjustsFontSizeToFit numberOfLines={1}>
              {`${start.clock}–${end.clock}`}
            </T>
            <T variant="small" style={{ fontSize: 14, color: color.muted, textAlign: "center" }}>
              {`${end.suffix} · ${reason(best).replace(/\.$/, "")}`}
            </T>
            <RiskPill level={best.level} label={t(`common.levelRisk.${best.level}`)} size="sm" />
          </>
        ) : (
          <T style={{ textAlign: "center", color: color.muted, marginTop: space.xxxl }}>{t("better.none")}</T>
        )}
      </ClockDial>

      <View style={{ flexDirection: "row", justifyContent: "center", flexWrap: "wrap", gap: space.md }}>
        {(["lower", "elevated", "high", "extreme"] as const).map((l) => (
          <View key={l} style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
            <View
              style={[
                { width: 10, height: 10, backgroundColor: risk[l].fill },
                l === "lower" && { borderRadius: 5 },
                l === "high" && { width: 9, height: 9, transform: [{ rotate: "45deg" }] },
                risk[l].legendBorder ? { borderWidth: 1, borderColor: risk[l].legendBorder } : null,
              ]}
            />
            <T variant="caption" style={{ color: color.muted }}>
              {levelName(l)}
            </T>
          </View>
        ))}
        <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
          <View style={{ width: 14, height: 4, borderRadius: 2, backgroundColor: color.ink }} />
          <T variant="caption" style={{ color: color.muted }}>
            {t("better.legendBest")}
          </T>
        </View>
      </View>

      {showCompare && (
        <View style={{ flexDirection: "row", gap: 10 }}>
          {card(t("better.now"), hour, fmt.time(now), false)}
          {card(t("better.better"), bestHour, fmt.time(best.start), true)}
        </View>
      )}

      <T variant="caption" style={{ color: color.muted }}>
        {t("better.note")}
      </T>
    </Screen>
  );
}
