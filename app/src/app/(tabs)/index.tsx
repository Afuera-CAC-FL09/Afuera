import { cToF, currentHourIndex } from "@afuera/engine";
import { router } from "expo-router";
import { useTranslation } from "react-i18next";
import { ActivityIndicator, Pressable, View } from "react-native";
import type { ReactNode } from "react";
import { BoltIcon, MegaphoneIcon } from "@/components/icons";
import { Cta, LinkText, Notice, OutlineCard, PlaceHeader, pressFeedback, RiskPill, Screen, Section, SoftButton, Stat, T } from "@/components/ui";
import { useCurrentRisk, useLevelName, useTimeFormat } from "@/lib/heat";
import { useHeadline, usePlan, windowParams } from "@/lib/plan";
import { activityName } from "@/lib/profile";
import { ParentToday, ParticipantToday } from "@/components/RoleToday";
import { useLive } from "@/state/live";
import { useSettings } from "@/state/settings";
import { useWeather } from "@/state/weather";
import { color, font, radius, risk, space, unknownRisk } from "@/theme";

export default function Today() {
  const { t } = useTranslation();
  const { settings, update } = useSettings();
  const { forecast, alerts, status, offline, refresh, now } = useWeather();
  const { stale, ageHours } = useCurrentRisk();
  const { hour, better, stormHour, upcoming, reason, dayLabel, today } = usePlan();
  const headline = useHeadline();
  const levelName = useLevelName();
  const fmt = useTimeFormat();
  const live = useLive();
  const activity = activityName(settings, settings.language);
  const header = <PlaceHeader subtitle={settings.demo ? t("common.demoBadge") : t("today.subtitle", { time: fmt.time(now) })} />;

  if (!forecast) {
    return (
      <Screen header={header}>
        {status === "error" ? (
          <>
            <Notice tone="warn" title={t("today.errorTitle")} body={t("ask.error")} />
            <SoftButton label={t("common.retry")} onPress={refresh} />
          </>
        ) : (
          <View style={{ paddingTop: space.xxxl, alignItems: "center", gap: space.md }}>
            <ActivityIndicator color={color.ink} />
            <T>{t("common.loading")}</T>
          </View>
        )}
      </Screen>
    );
  }

  const weather = forecast.hours[currentHourIndex(forecast.hours, now)] ?? null;
  const stormAlerts = alerts.filter((a) => a.kind !== "other");

  const startLive = async () => {
    if (!live.session) await live.start();
    router.navigate("/live");
  };

  // Organizers plan and run it; parents see what to pack and whether it moves; participants get their own checklist.
  const role = settings.role;

  return (
    <Screen
      header={header}
      footer={
        role === "participant" ? undefined : role === "parent" ? (
          <Cta label={t("parent.share")} onPress={() => router.push(better ? { pathname: "/share", params: windowParams(better) } : "/share")} />
        ) : better ? (
          <Cta
            label={t("today.move", { activity: activity.toLowerCase(), time: fmt.time(better.start) })}
            onPress={() => router.push({ pathname: "/share", params: windowParams(better) })}
          />
        ) : (
          <Cta label={t("today.startNow", { activity: activity.toLowerCase() })} onPress={startLive} disabled={!hour?.level || hour.stopOutdoor} />
        )
      }
    >
      {stale && <Notice tone="warn" title={t("today.staleTitle")} body={t("today.stale", { hours: ageHours })} />}
      {offline && !stale && <Notice tone="warn" title={t("today.offline", { time: fmt.time(forecast.fetchedAt) })} />}
      {stormAlerts.map((a) => (
        <Notice key={a.id} tone="storm" title={t("today.nwsTitle", { event: a.event })} body={a.ends ? t("today.until", { time: fmt.time(a.ends) }) : a.headline} />
      ))}

      <RiskPill level={hour?.level ?? null} label={`${hour?.level ? t(`common.levelRisk.${hour.level}`) : t("common.unknown")} · ${activity}`} />

      <T variant="hero" accessibilityRole="header">
        {headline(hour)}
      </T>

      <LinkText label={t("today.tool.why")} onPress={() => router.push("/why")} />

      <Section>
        <View style={{ flexDirection: "row", gap: 6 }}>
          <Stat value={hour?.wbgtF != null ? `${Math.round(hour.wbgtF)}°` : "—"} label={t("today.stat.wbgt")} />
          <Stat value={weather ? `${Math.round(cToF(weather.tempC))}°` : "—"} label={t("today.stat.air")} />
          <Stat value={weather ? `${Math.round(weather.rh)}%` : "—"} label={t("today.stat.humidity")} />
          <Stat
            value={stormHour ? `${stormHour.precipChance}%` : "—"}
            label={stormHour && stormHour.precipChance >= 10 ? t("today.stat.stormsAt", { time: fmt.hour(stormHour.time) }) : t("today.stat.storms")}
          />
        </View>
        <View style={{ gap: space.sm }}>
          <T variant="small" style={{ fontFamily: font.bodySemi }}>
            {t("today.nextHours")}
          </T>
          <View style={{ flexDirection: "row", gap: 6 }}>
            {upcoming.slice(0, 5).map((h, i) => {
              const look = h.level ? risk[h.level] : unknownRisk;
              const stormy = h.thunder || h.precipChance >= 40;
              return (
                <View
                  key={h.time.getTime()}
                  style={{ flex: 1, alignItems: "center", gap: 4 }}
                  accessible
                  accessibilityLabel={`${fmt.hour(h.time)}: ${levelName(h.level)}${stormy ? ", ⚡" : ""}`}
                >
                  <View
                    style={[
                      { width: "100%", height: 30, borderRadius: radius.chip, backgroundColor: look.fill, alignItems: "center", justifyContent: "center" },
                      i === 0 && { outlineColor: color.ink, outlineWidth: 2, outlineStyle: "solid", outlineOffset: 2 },
                    ]}
                  >
                    {stormy && <BoltIcon color={look.ink} />}
                  </View>
                  <T variant="caption" style={i === 0 ? { fontFamily: font.bodyBold } : undefined}>
                    {fmt.hour(h.time)}
                  </T>
                </View>
              );
            })}
          </View>
        </View>
      </Section>

      {role === "parent" && <ParentToday better={better} />}
      {role === "participant" && <ParticipantToday hour={hour} />}

      {role === "organizer" && (
        <>
          <OutlineCard>
            <T variant="smallBold" style={{ color: color.link }}>
              {better && better.localDate !== today ? t("today.betterOn", { day: dayLabel(better) }) : t("today.betterTodayTitle")}
            </T>
            {better ? (
              <>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                  <T style={{ fontFamily: font.displayMedium, fontSize: 28, lineHeight: 32 }}>{fmt.range(better.start, better.end)}</T>
                  <RiskPill level={better.level} label={t(`common.levelRisk.${better.level}`)} size="sm" />
                </View>
                <T>{reason(better)}</T>
              </>
            ) : (
              <T>{t("today.noBetter")}</T>
            )}
            <View style={{ flexDirection: "row", gap: space.lg, flexWrap: "wrap" }}>
              <LinkText label={t("today.seeEveryHour")} onPress={() => router.navigate("/better")} />
              <LinkText label={t("today.tool.share")} onPress={() => router.push(better ? { pathname: "/share", params: windowParams(better) } : "/share")} />
            </View>
          </OutlineCard>
        </>
      )}

      <T variant="smallBold" style={{ color: color.muted, marginTop: space.sm }}>
        {t("today.tools")}
      </T>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.sm }}>
        {role === "organizer" && <Tool icon={<MegaphoneIcon />} title={t("today.tool.event")} body={t("today.tool.eventBody")} onPress={() => router.push("/event")} />}
        <Tool
          icon={<BoltIcon />}
          title={settings.demo ? t("today.demoOnTitle") : t("today.tool.demo")}
          body={settings.demo ? t("today.demoOff") : t("today.demoBody")}
          onPress={() => update(settings.demo ? { demo: false } : { demo: true, demoStartedAt: Date.now() })}
        />
      </View>

      <T variant="caption" style={{ color: color.muted }}>
        {t("today.footnote")}
      </T>
    </Screen>
  );
}

function Tool({ icon, title, body, onPress }: { icon: ReactNode; title: string; body: string; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={(s) => [{ flexGrow: 1, flexBasis: "45%", backgroundColor: color.sky, borderRadius: radius.card, padding: 14, gap: 6 }, pressFeedback(s)]}
    >
      <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: color.bg, alignItems: "center", justifyContent: "center" }}>{icon}</View>
      <T variant="bodyBold">{title}</T>
      <T variant="caption" style={{ color: color.muted }}>
        {body}
      </T>
    </Pressable>
  );
}
