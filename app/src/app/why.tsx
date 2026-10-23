import { assessRisk, calcWbgt, cToF, currentHourIndex, type RiskLevel } from "@afuera/engine";
import Slider from "@react-native-community/slider";
import { router } from "expo-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { View } from "react-native";
import { DropIcon, SunIcon } from "@/components/icons";
import { BackHeader, Cta, Notice, OutlineCard, RiskPill, Screen, Section, T } from "@/components/ui";
import { guidanceKey, guidanceText, useLevelName } from "@/lib/heat";
import { useSettings } from "@/state/settings";
import { useWeather } from "@/state/weather";
import { color, font, radius, risk, space, unknownRisk } from "@/theme";

// Sun slider steps. Full sun is more than the sky can give; the model trims it
// to what's possible at this hour's sun angle.
const SUN_LEVELS = [0, 450, 1100];

export default function Why() {
  const { t } = useTranslation();
  const levelName = useLevelName();
  const { settings } = useSettings();
  const { forecast, now } = useWeather();
  const index = forecast ? currentHourIndex(forecast.hours, now) : -1;
  const base = index >= 0 ? forecast!.hours[index] : null;

  const [rh, setRh] = useState<number | null>(null);
  const [sun, setSun] = useState<number | null>(null);

  if (!forecast || !base) {
    return (
      <Screen header={<BackHeader title={t("why.title")} />}>
        <Notice tone="warn" title={t("today.cantCompute")} />
      </Screen>
    );
  }

  /** WBGT for this hour with humidity and sunlight swapped in. */
  const run = (humidity: number, solar: number) => {
    const result = calcWbgt({
      time: base.time,
      avgMinutes: 60,
      lat: forecast.lat,
      lon: forecast.lon,
      solar,
      pressure: base.pressure,
      tempC: base.tempC,
      rh: humidity,
      windSpeed: base.windSpeed,
      windHeight: 10,
    });
    return result ? { ...result, risk: assessRisk(result.wbgt, base.time, base.time) } : null;
  };

  const sunUp = (run(base.rh, 0)?.cza ?? 0) > 0.00873;
  const humidity = rh ?? base.rh;
  const solar = sun === null || !sunUp ? base.solar : SUN_LEVELS[sun];
  const result = run(humidity, solar);
  const level: RiskLevel | null = result?.risk.level ?? null;
  const look = level ? risk[level] : unknownRisk;
  const g = result ? guidanceKey({ level, stopOutdoor: result.risk.band.stopOutdoor }) : null;
  const airF = Math.round(cToF(base.tempC));
  const nearestSun = base.solar < 150 ? 0 : base.solar < 650 ? 1 : 2;
  const sunLevels = t("why.sunLevels", { returnObjects: true }) as string[];

  const dry = run(35, 0);
  const humid = sunUp ? run(80, SUN_LEVELS[2]) : run(80, 0);

  return (
    <Screen header={<BackHeader title={t("why.title")} />} footer={<Cta label={t("why.back")} onPress={() => (router.canGoBack() ? router.back() : router.replace("/"))} />}>
      <View style={{ alignSelf: "flex-start", backgroundColor: color.sky, borderRadius: radius.pill, paddingVertical: 4, paddingHorizontal: space.md }}>
        <T variant="caption" style={{ fontFamily: font.bodyBold }}>
          {settings.demo ? t("why.demoChip") : t("why.nowChip")}
        </T>
      </View>
      <T style={{ fontFamily: font.displayMedium, fontSize: 38, lineHeight: 40, letterSpacing: -1 }} accessibilityRole="header">
        {t("why.headline", { temp: airF })}
      </T>
      <T>{t("why.intro")}</T>

      <Section style={{ gap: 6, padding: space.lg }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
          <T variant="bodyBold">{t("why.humidity")}</T>
          <T style={{ fontFamily: font.displayMedium }}>{`${Math.round(humidity)}%`}</T>
        </View>
        <Slider
          accessibilityLabel={t("why.humidity")}
          minimumValue={20}
          maximumValue={95}
          step={1}
          value={humidity}
          onValueChange={setRh}
          minimumTrackTintColor={color.amber}
          maximumTrackTintColor={color.ink}
          thumbTintColor={color.amber}
        />
        <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 4 }}>
          <T variant="bodyBold">{t("why.sun")}</T>
          <T variant="bodyBold">{sunUp ? sunLevels[sun ?? nearestSun] : "—"}</T>
        </View>
        <Slider
          accessibilityLabel={t("why.sun")}
          disabled={!sunUp}
          minimumValue={0}
          maximumValue={2}
          step={1}
          value={sun ?? nearestSun}
          onValueChange={(v) => setSun(Math.round(v))}
          minimumTrackTintColor={color.amber}
          maximumTrackTintColor={color.ink}
          thumbTintColor={color.amber}
        />
        {!sunUp && (
          <T variant="small" style={{ color: color.muted }}>
            {t("why.night")}
          </T>
        )}

        <View style={{ marginTop: space.sm, backgroundColor: look.fill, borderRadius: radius.card, padding: space.lg, gap: 6 }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
            <T variant="smallBold" style={{ color: look.ink }}>
              {t("why.wbgt")}
            </T>
            <T variant="smallBold" style={{ color: look.ink }}>
              {t("why.air", { temp: airF })}
            </T>
          </View>
          <View style={{ flexDirection: "row", alignItems: "baseline", gap: space.md }}>
            <T style={{ fontFamily: font.displayLight, fontSize: 60, lineHeight: 64, letterSpacing: -2, color: look.ink }}>
              {result ? `${Math.round(result.risk.wbgtF)}°` : "—"}
            </T>
            <T style={{ fontFamily: font.displaySemi, fontSize: 24, color: look.ink }}>{levelName(level)}</T>
          </View>
          {g && (
            <T variant="small" style={{ fontSize: 14, lineHeight: 20, color: look.ink }}>
              {guidanceText(t, g, settings.activity)}
            </T>
          )}
        </View>
      </Section>

      <View style={{ flexDirection: "row", gap: 10 }}>
        {[
          { title: t("why.dry"), pct: 35, r: dry },
          { title: t("why.humid"), pct: 80, r: humid },
        ].map(({ title, pct, r }) => (
          <OutlineCard key={title} style={{ flex: 1, padding: 14, borderRadius: radius.card, gap: 6 }}>
            <T variant="small" style={{ color: color.muted }}>
              {title}
            </T>
            <T style={{ fontFamily: font.display, fontSize: 20 }}>{t("why.airTemp", { temp: airF })}</T>
            <T variant="small">{t("why.humidityPct", { pct })}</T>
            {r && <RiskPill level={r.risk.level} label={`${Math.round(r.risk.wbgtF)}° · ${levelName(r.risk.level)}`} size="xs" />}
          </OutlineCard>
        ))}
      </View>

      {[
        { icon: <DropIcon />, title: t("why.humidAirTitle"), body: t("why.humidAirBody") },
        { icon: <SunIcon size={18} />, title: t("why.sunTitle"), body: t("why.sunBody") },
      ].map((row) => (
        <View key={row.title} style={{ flexDirection: "row", gap: space.md }}>
          <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: color.sky, alignItems: "center", justifyContent: "center" }}>{row.icon}</View>
          <View style={{ flex: 1, gap: 2 }}>
            <T variant="bodyBold">{row.title}</T>
            <T variant="small" style={{ fontSize: 14, lineHeight: 20, color: color.muted }}>
              {row.body}
            </T>
          </View>
        </View>
      ))}

      <T variant="caption" style={{ color: color.muted }}>
        {t("why.footnote")}
      </T>
    </Screen>
  );
}
