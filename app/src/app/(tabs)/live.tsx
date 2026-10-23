import { activityTemplate, cToF, currentHourIndex, lightningWait, type ScheduledCheckin } from "@afuera/engine";
import * as Clipboard from "expo-clipboard";
import * as Haptics from "expo-haptics";
import { useIsFocused } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Share as NativeShare, Platform, Pressable, View } from "react-native";
import { BoltIcon, DropIcon, PlayIcon, ShadeIcon, ShareIcon, StopIcon, SunIcon } from "@/components/icons";
import { pressFeedback, Screen, T } from "@/components/ui";
import { useLevelName, useTimeFormat } from "@/lib/heat";
import type { SessionSummary } from "@/lib/summary";
import { waterEvery } from "@/lib/plan";
import { activityName } from "@/lib/profile";
import { useLive } from "@/state/live";
import { useSettings } from "@/state/settings";
import { useWeather } from "@/state/weather";
import { color, dark, font, radius, risk, space } from "@/theme";

export default function Live() {
  const { t } = useTranslation();
  const { settings } = useSettings();
  const { session, summary, start, end, dismissSummary, logWaterBreak, heardThunder, clearThunder } = useLive();
  const { forecast, risks, alerts, now } = useWeather();
  const levelName = useLevelName();
  const fmt = useTimeFormat();
  const focused = useIsFocused();
  const lang = settings.language;
  const activity = activityName(settings, lang);

  const [clock, setClock] = useState(() => Date.now());
  const buzzed = useRef(new Set<number>());
  useEffect(() => {
    if (!session) return;
    const timer = setInterval(() => setClock(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [session]);

  // Buzz when a check-in comes due while the app is open.
  const elapsed = session ? clock - session.startedAtMs : 0;
  const offsetMs = (item: ScheduledCheckin) => (session ? item.at.getTime() - session.forecastStart.getTime() : 0);
  useEffect(() => {
    if (!session) return;
    session.plan.schedule.forEach((item, i) => {
      const at = offsetMs(item);
      if (at > 0 && elapsed >= at && !buzzed.current.has(i) && !session.done.includes(i)) {
        buzzed.current.add(i);
        if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      }
    });
  });

  const bar = <StatusBar style={focused ? "light" : "dark"} />;

  if (!session) {
    return (
      <Screen background={dark.bg} contentStyle={{ paddingTop: space.xxxl }}>
        {bar}
        {summary ? (
          <SummaryView summary={summary} onDone={dismissSummary} />
        ) : (
          <>
            <T variant="title" style={{ color: dark.text }}>
              {t("live.idleTitle")}
            </T>
            <T style={{ color: dark.soft }}>{t("live.idleBody")}</T>
            <AmberButton icon={<PlayIcon color={color.ink} />} label={t("live.start", { activity: activity.toLowerCase() })} onPress={start} />
          </>
        )}
      </Screen>
    );
  }

  const { plan, hour: startHour } = session;
  const level = startHour.level!;
  const totalMs = plan.minutes * 60_000;
  const finished = elapsed >= totalMs;
  const every = waterEvery(settings, level);
  const pending = plan.schedule.map((item, i) => ({ item, i })).filter(({ i }) => !session.done.includes(i));
  const dueWater = pending.find(({ item }) => item.checkin.id === "water-break" && offsetMs(item) <= elapsed);
  const next = pending.find(({ item }) => offsetMs(item) > elapsed);
  const sinceBreak = Math.max(0, clock - session.lastBreakMs);
  const countdown = next ? offsetMs(next.item) - elapsed : 0;

  const endTime = new Date(session.forecastStart.getTime() + totalMs);
  const storm = risks.find((h) => h.time >= now && h.time < endTime && (h.thunder || h.precipChance >= 20));
  const stormAlerts = alerts.filter((a) => a.kind === "storm");
  const weather = forecast ? forecast.hours[currentHourIndex(forecast.hours, now)] : null;
  const current = risks[currentHourIndex(risks, now)] ?? startHour;
  const wait = session.thunderAtMs != null ? lightningWait(session.thunderAtMs, clock) : null;

  return (
    <Screen
      background={dark.bg}
      header={
        <View style={{ paddingHorizontal: space.xl, paddingTop: space.lg, paddingBottom: 10, flexDirection: "row", justifyContent: "space-between", alignItems: "center", borderBottomWidth: 1, borderBottomColor: dark.divider }}>
          {bar}
          <View style={{ flexDirection: "row", alignItems: "center", gap: space.sm, flexShrink: 1 }}>
            <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: level === "extreme" ? "#FFFFFF" : risk[level].fill }} />
            <View style={{ flexShrink: 1 }}>
              <T style={{ fontFamily: font.displaySemi, fontSize: 20, lineHeight: 23, color: dark.text }} numberOfLines={1}>
                {activity}
              </T>
              <T variant="small" style={{ color: dark.muted }} numberOfLines={1}>
                {t("live.since", { place: settings.place?.name, time: fmt.time(session.forecastStart) })}
              </T>
            </View>
          </View>
          <Pressable
            accessibilityRole="button"
            onPress={end}
            style={(s) => [{ height: 44, paddingHorizontal: space.lg, borderRadius: radius.pill, borderWidth: 1, borderColor: dark.outline, flexDirection: "row", alignItems: "center", gap: 6 }, pressFeedback(s)]}
          >
            <StopIcon />
            <T variant="bodyBold" style={{ fontSize: 14, color: dark.text }}>
              {t("live.end")}
            </T>
          </Pressable>
        </View>
      }
      contentStyle={{ paddingTop: 14, gap: 14 }}
    >
      {plan.cancelled ? (
        <DarkCard>
          <T variant="heading" style={{ color: dark.text }}>
            {t("live.cancelled")}
          </T>
        </DarkCard>
      ) : (
        <>
          {wait && (
            <DarkCard style={{ borderWidth: 2, borderColor: color.amber, alignItems: "center", gap: 10 }}>
              <View accessibilityRole="alert" style={{ flexDirection: "row", alignItems: "center", gap: space.sm }}>
                <BoltIcon size={20} color={color.amber} width={2.2} />
                <T style={{ fontFamily: font.displayMedium, fontSize: 22, lineHeight: 26, color: dark.text }}>{wait.done ? t("lightning.doneTitle") : t("lightning.waitTitle")}</T>
              </View>
              {!wait.done && (
                <T style={{ fontFamily: font.displayLight, fontSize: 64, lineHeight: 68, letterSpacing: -2, color: dark.text, fontVariant: ["tabular-nums"] }}>{mmss(wait.remainingMs)}</T>
              )}
              <T variant="small" style={{ fontSize: 14, lineHeight: 20, color: dark.soft, textAlign: "center" }}>
                {wait.done ? t("lightning.doneBody") : t("lightning.waitBody")}
              </T>
              {wait.done ? (
                <OutlineDarkButton label={t("lightning.back")} onPress={clearThunder} />
              ) : (
                <AmberButton icon={<BoltIcon color={color.ink} width={2.2} />} label={t("lightning.again")} onPress={heardThunder} />
              )}
            </DarkCard>
          )}

          {!wait && (storm || stormAlerts.length > 0) && (
            <DarkCard style={{ flexDirection: "row", gap: space.md }}>
              <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: color.amber, alignItems: "center", justifyContent: "center" }}>
                <BoltIcon size={20} color={color.ink} width={2.2} />
              </View>
              <View style={{ flex: 1, gap: 4 }}>
                {storm && (
                  <T variant="smallBold" style={{ color: color.amber }}>
                    {t("live.stormsAfter", { time: fmt.hour(storm.time), pct: storm.precipChance })}
                  </T>
                )}
                <T style={{ fontFamily: font.displayMedium, fontSize: 20, lineHeight: 24, color: dark.text }}>{t("live.thunderTitle")}</T>
                <T variant="small" style={{ fontSize: 14, lineHeight: 20, color: dark.soft }}>
                  {t("live.thunderBody")}
                </T>
                <T variant="caption" style={{ color: dark.muted }}>
                  {stormAlerts.length > 0 ? stormAlerts.map((a) => t("live.alert", { event: a.event })).join(" · ") : t("live.noAlerts", { time: fmt.time(now) })}
                </T>
              </View>
            </DarkCard>
          )}

          <DarkCard style={{ borderRadius: radius.sheet, paddingVertical: space.xl, paddingHorizontal: 18, alignItems: "center", gap: 10 }}>
            <T variant="small" style={{ fontSize: 14, fontFamily: font.bodyBold, color: dark.soft, textAlign: "center" }}>
              {finished ? t("live.ended") : dueWater ? t("live.breakNow") : next ? t("live.next", { title: next.item.checkin.title[lang] }) : t("live.left", { time: mmss(totalMs - elapsed) })}
            </T>
            <T style={{ fontFamily: font.displayLight, fontSize: 76, lineHeight: 80, letterSpacing: -2, color: dark.text, fontVariant: ["tabular-nums"] }}>
              {finished || dueWater ? "00:00" : mmss(next ? countdown : totalMs - elapsed)}
            </T>
            <View style={{ width: "100%", height: 8, borderRadius: 4, backgroundColor: dark.raised, overflow: "hidden" }}>
              <View style={{ height: 8, borderRadius: 4, backgroundColor: color.amber, width: `${Math.min(100, (sinceBreak / (every * 60_000)) * 100)}%` }} />
            </View>
            <View style={{ width: "100%", flexDirection: "row", justifyContent: "space-between", gap: space.sm }}>
              <T variant="caption" style={{ color: dark.muted }}>
                {t("live.sinceBreak", { min: Math.floor(sinceBreak / 60_000), sec: String(Math.floor((sinceBreak % 60_000) / 1000)).padStart(2, "0") })}
              </T>
              <T variant="caption" style={{ color: dark.muted }}>
                {t("live.every", { count: every, level: levelName(level).toLowerCase() })}
              </T>
            </View>
            <AmberButton icon={<DropIcon color={color.ink} width={2.2} />} label={t("live.logBreak")} onPress={logWaterBreak} />
          </DarkCard>

          {!wait && <OutlineDarkButton icon={<BoltIcon color={dark.text} width={2.2} />} label={t("lightning.heard")} onPress={heardThunder} />}

          <View style={{ flexDirection: "row", gap: space.sm }}>
            <DarkStat value={current.wbgtF != null ? `${Math.round(current.wbgtF)}°` : "—"} label={t("live.heatStress", { level: levelName(current.level) })} />
            <DarkStat value={weather ? `${Math.round(cToF(weather.tempC))}°` : "—"} label={t("today.stat.air")} />
            <DarkStat value={weather ? `${Math.round(weather.rh)}%` : "—"} label={t("today.stat.humidity")} />
          </View>

          {plan.capped && <DarkNote text={t("live.capped", { minutes: plan.minutes })} />}
          {session.rises.map((r) => (
            <DarkNote key={r.time.getTime()} text={t("live.levelUp", { level: levelName(r.level), time: fmt.time(r.time) })} />
          ))}
          {!session.notificationsOn && <DarkNote text={t("live.notifsOff")} />}

          <View style={{ gap: space.sm }}>
            <T variant="bodyBold" style={{ fontSize: 14, color: dark.text }}>
              {t("live.comingUp")}
            </T>
            {pending
              .filter(({ item }) => offsetMs(item) > elapsed)
              .slice(0, 4)
              .map(({ item, i }) => (
                <View key={i} style={{ backgroundColor: dark.card, borderRadius: radius.cta, paddingVertical: space.md, paddingHorizontal: 14, flexDirection: "row", alignItems: "center", gap: space.md }}>
                  <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: dark.raised, alignItems: "center", justifyContent: "center" }}>
                    {checkinIcon(item.checkin.id)}
                  </View>
                  <View style={{ flex: 1 }}>
                    <T variant="bodyBold" style={{ color: dark.text }}>
                      {item.checkin.title[lang]}
                    </T>
                    <T variant="caption" style={{ color: item.checkin.source === "ai" ? color.amber : dark.muted }}>
                      {item.checkin.source === "ai" ? t("live.addedByAi") : item.checkin.required ? t("live.required") : t("live.optional")}
                    </T>
                  </View>
                  <T style={{ fontFamily: font.display, fontSize: 18, color: dark.text }}>{`${Math.ceil((offsetMs(item) - elapsed) / 60_000)}m`}</T>
                </View>
              ))}
            <T variant="caption" style={{ color: dark.muted, marginTop: 2 }}>
              {t("live.footnote", { activity })}
            </T>
          </View>
        </>
      )}
    </Screen>
  );
}

/** After End: what happened, as plain text the coach can send to the team. Never leaves the phone otherwise. */
function SummaryView({ summary: s, onDone }: { summary: SessionSummary; onDone: () => void }) {
  const { t } = useTranslation();
  const { settings } = useSettings();
  const levelName = useLevelName();
  const fmt = useTimeFormat();
  const [status, setStatus] = useState<string | null>(null);
  const activity = activityTemplate(s.activity).name[settings.language];
  const when = `${fmt.day(s.start)} · ${s.minutes > 0 ? fmt.range(s.start, s.end) : fmt.time(s.start)} (${t("summary.length", { minutes: s.minutes })})`;
  const highest = `${levelName(s.highest.level)}${s.highest.wbgtF != null ? ` (${Math.round(s.highest.wbgtF)}°F WBGT)` : ""}`;
  const rows: [string, string][] = s.cancelled
    ? []
    : [
        [t("summary.highest"), highest],
        [t("summary.breaks"), t("summary.breaksValue", { logged: s.breaksLogged, due: s.breaksDue })],
        [t("summary.moved"), s.moved ? t("summary.movedYes") : t("summary.movedNo")],
      ];

  const text = [
    t("summary.textTitle"),
    when,
    `${activity} · ${s.place}`,
    ...(s.cancelled ? [t("summary.cancelled")] : rows.map(([k, v]) => `${k}: ${v}`)),
    t("summary.footer"),
  ].join("\n");

  const share = async () => {
    setStatus(null);
    try {
      if (Platform.OS === "web") throw new Error("no share sheet");
      await NativeShare.share({ message: text });
    } catch {
      await Clipboard.setStringAsync(text);
      setStatus(t("share.copied"));
    }
  };

  return (
    <>
      <T variant="title" style={{ color: dark.text }} accessibilityRole="header">
        {t("summary.title")}
      </T>
      <DarkCard style={{ gap: space.md }}>
        <View style={{ gap: 2 }}>
          <T variant="bodyBold" style={{ color: dark.text }}>{`${activity} · ${s.place}`}</T>
          <T variant="small" style={{ color: dark.muted }}>
            {when}
          </T>
        </View>
        {s.cancelled && <T style={{ color: dark.text }}>{t("summary.cancelled")}</T>}
        {rows.map(([label, value]) => (
          <View key={label} style={{ flexDirection: "row", justifyContent: "space-between", gap: space.md, paddingTop: space.md, borderTopWidth: 1, borderTopColor: dark.raised }}>
            <T variant="small" style={{ color: dark.soft, flexShrink: 1 }}>
              {label}
            </T>
            <T variant="bodyBold" style={{ color: dark.text, flexShrink: 1, textAlign: "right" }}>
              {value}
            </T>
          </View>
        ))}
      </DarkCard>
      <T variant="caption" style={{ color: dark.muted }}>
        {t("summary.privacy")}
      </T>
      {status && <DarkNote text={status} />}
      <AmberButton icon={<ShareIcon color={color.ink} />} label={t("summary.share")} onPress={share} />
      <Pressable
        accessibilityRole="button"
        onPress={onDone}
        style={(p) => [{ height: 52, borderRadius: radius.cta, borderWidth: 1, borderColor: dark.outline, alignItems: "center", justifyContent: "center" }, pressFeedback(p)]}
      >
        <T variant="bodyBold" style={{ color: dark.text }}>
          {t("summary.done")}
        </T>
      </Pressable>
    </>
  );
}

function mmss(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = String(s % 60).padStart(2, "0");
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${sec}` : `${String(m).padStart(2, "0")}:${sec}`;
}

function checkinIcon(id: string) {
  const c = dark.text;
  if (id === "water-break") return <DropIcon color={c} />;
  if (id === "heat-reading" || id === "sunscreen") return <SunIcon size={18} color={c} />;
  return <ShadeIcon color={c} />;
}

function DarkCard({ children, style }: { children: ReactNode; style?: object }) {
  return <View style={[{ backgroundColor: dark.card, borderRadius: radius.section, padding: space.lg }, style]}>{children}</View>;
}

function DarkStat({ value, label }: { value: string; label: string }) {
  return (
    <View style={{ flex: 1, borderWidth: 1, borderColor: dark.raised, borderRadius: space.lg, paddingVertical: 10, paddingHorizontal: space.md, gap: 2 }}>
      <T style={{ fontFamily: font.display, fontSize: 24, lineHeight: 28, color: dark.text }}>{value}</T>
      <T variant="caption" style={{ color: dark.muted }}>
        {label}
      </T>
    </View>
  );
}

function DarkNote({ text }: { text: string }) {
  return (
    <View accessibilityRole="alert" style={{ borderRadius: space.lg, borderWidth: 1, borderColor: color.amber, padding: space.md }}>
      <T variant="small" style={{ color: dark.text }}>
        {text}
      </T>
    </View>
  );
}

function OutlineDarkButton({ label, onPress, icon }: { label: string; onPress: () => void; icon?: ReactNode }) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={(s) => [{ alignSelf: "stretch", height: 52, borderRadius: radius.cta, borderWidth: 1, borderColor: dark.outline, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: space.sm }, pressFeedback(s)]}
    >
      {icon}
      <T variant="bodyBold" style={{ color: dark.text }}>
        {label}
      </T>
    </Pressable>
  );
}

function AmberButton({ label, onPress, icon }: { label: string; onPress: () => void; icon: ReactNode }) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={(s) => [{ alignSelf: "stretch", height: 56, marginTop: 4, borderRadius: radius.cta, backgroundColor: color.amber, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: space.sm }, pressFeedback(s)]}
    >
      {icon}
      <T variant="button">{label}</T>
    </Pressable>
  );
}
