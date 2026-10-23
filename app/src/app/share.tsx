import { currentHourIndex } from "@afuera/engine";
import * as Clipboard from "expo-clipboard";
import { useLocalSearchParams } from "expo-router";
import * as Sharing from "expo-sharing";
import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Share as NativeShare, TextInput, View } from "react-native";
import { captureRef } from "react-native-view-shot";
import { CheckIcon, CopyIcon, PinIcon, ShareIcon } from "@/components/icons";
import { BackHeader, Cta, LanguageToggle, Notice, RiskPill, Screen, SoftButton, T } from "@/components/ui";
import i18n from "@/i18n";
import { compactRange, guidanceKey, guidanceText } from "@/lib/heat";
import { parseWindowParams, usePlan, type WindowParams } from "@/lib/plan";
import { activityName } from "@/lib/profile";
import { useLive } from "@/state/live";
import { useSettings } from "@/state/settings";
import { useWeather } from "@/state/weather";
import { color, font, radius, space, type } from "@/theme";

/** The message for the parents' group chat (design S5). Its language is chosen separately from the app's. */
export default function Share() {
  const { t } = useTranslation();
  const { settings, update } = useSettings();
  const { risks, forecast, now } = useWeather();
  const { reason, localDate, today, bestToday, search } = usePlan();
  const { session } = useLive();
  const params = useLocalSearchParams<Partial<WindowParams>>();
  const [lang, setLang] = useState(settings.language);
  const [note, setNote] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const card = useRef<View>(null);

  const ct = i18n.getFixedT(lang);
  const locale = lang === "es" ? "es-US" : "en-US";
  const timeZone = forecast?.timezone;
  const time = (d: Date) => d.toLocaleTimeString(locale, { timeZone, hour: "numeric", minute: "2-digit" });
  const hourOnly = (d: Date) => d.toLocaleTimeString(locale, { timeZone, hour: "numeric" });
  const weekday = (d: Date) => d.toLocaleDateString(locale, { timeZone, weekday: "long" });

  // From "Move … to 7:00 PM": the window that was picked. Opened directly: the activity that's
  // running, or else the time Afuera plans for it today (never a start in the past).
  const movedTo = parseWindowParams(params, localDate);
  const moved = !!movedTo;
  const planned = bestToday ?? search.best;
  const start = movedTo?.start ?? session?.forecastStart ?? (planned && planned.start > now ? planned.start : now);
  const end = movedTo?.end ?? (session ? new Date(session.forecastStart.getTime() + session.plan.minutes * 60_000) : new Date(start.getTime() + settings.durationMinutes * 60_000));
  const startHour = risks[currentHourIndex(risks, start)] ?? null;
  // The level is the worst hour of the window, so the card never shows less than the plan does.
  const at = movedTo
    ? { level: movedTo.level, wbgtF: movedTo.peakWbgtF, precipChance: movedTo.maxPrecipChance, stopOutdoor: false }
    : startHour;
  const activity = activityName(settings, lang);
  const isToday = localDate(start) === today;
  const day = isToday ? ct("share.today").toLowerCase() : weekday(start);

  const headline = ct(moved ? "share.headlineMove" : "share.headlineSame", { activity, day, time: compactRange(time(start), time(end)) });
  const gKey = at ? guidanceKey(at) : null;
  const guidance = gKey ? guidanceText(ct, gKey, settings.activity) : "";
  const body = movedTo ? ct("share.movedBecause", { reason: reason(movedTo, ct, hourOnly) }) : guidance;
  const items = ct("share.items", { returnObjects: true }) as string[];

  const asText = () =>
    [
      `${settings.place?.name} · ${isToday ? ct("share.today") : weekday(start)}`,
      at?.level ? ct(`common.levelRisk.${at.level}`) : "",
      headline,
      body,
      at?.wbgtF != null ? `${Math.round(at.wbgtF)}° ${ct("share.wbgt")}` : "",
      at ? `${at.precipChance}% ${ct("share.stormsAt", { time: hourOnly(start) })}` : "",
      `${ct("share.bring")}: ${items.join(", ")}`,
      note.trim(),
      ct("share.footer"),
    ]
      .filter(Boolean)
      .join("\n");

  // Sending the new time is what counts as moving it (for the Live session summary).
  const rememberMove = () => movedTo && update({ movedTo: { start: movedTo.start.toISOString(), end: movedTo.end.toISOString() } });

  const share = async () => {
    setStatus(null);
    rememberMove();
    try {
      if (await Sharing.isAvailableAsync()) {
        const uri = await captureRef(card, { format: "png", quality: 1, result: "tmpfile" });
        await Sharing.shareAsync(uri, { mimeType: "image/png", dialogTitle: ct("share.dialog"), UTI: "public.png" });
      } else {
        await NativeShare.share({ message: asText() });
      }
    } catch (err) {
      console.warn("share failed", err);
      setStatus(ct("share.unavailable"));
    }
  };

  const copy = async () => {
    rememberMove();
    await Clipboard.setStringAsync(asText());
    setStatus(ct("share.copied"));
  };

  return (
    <Screen
      background={color.sky}
      header={<BackHeader title={t("share.title")} right={<View style={{ marginRight: space.sm }}><LanguageToggle value={lang} onChange={setLang} surface={color.bg} /></View>} />}
      contentStyle={{ gap: space.md, paddingTop: 6 }}
      footer={
        <>
          <Cta icon={<ShareIcon />} label={ct("share.button")} onPress={share} />
          <SoftButton icon={<CopyIcon />} label={ct("share.copy")} onPress={copy} surface={color.bg} style={{ borderRadius: space.lg }} />
        </>
      }
    >
      {status && <Notice tone="storm" title={status} />}
      {/* collapsable={false} keeps Android from flattening the view before capture. */}
      <View ref={card} collapsable={false} style={{ backgroundColor: color.bg, borderRadius: radius.sheet, padding: space.xl, gap: 14 }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            <PinIcon size={18} />
            <T variant="bodyBold">{settings.place?.name}</T>
          </View>
          <T variant="small" style={{ color: color.muted }}>
            {isToday ? ct("share.today") : weekday(start)}
          </T>
        </View>
        {at?.level && <RiskPill level={at.level} label={ct(`common.levelRisk.${at.level}`)} size="sm" />}
        <T style={{ fontFamily: font.displayMedium, fontSize: 30, lineHeight: 33, letterSpacing: -0.5 }}>{headline}</T>
        {body ? <T style={{ lineHeight: 22 }}>{body}</T> : null}
        <View style={{ flexDirection: "row", gap: space.sm }}>
          <View style={{ flex: 1, backgroundColor: color.sky, borderRadius: space.lg, paddingVertical: 10, paddingHorizontal: space.md }}>
            <T style={{ fontFamily: font.display, fontSize: 24, lineHeight: 28 }}>{at?.wbgtF != null ? `${Math.round(at.wbgtF)}°` : "—"}</T>
            <T variant="caption" style={{ color: color.muted }}>
              {ct("share.wbgt")}
            </T>
          </View>
          <View style={{ flex: 1, backgroundColor: color.sky, borderRadius: space.lg, paddingVertical: 10, paddingHorizontal: space.md }}>
            <T style={{ fontFamily: font.display, fontSize: 24, lineHeight: 28 }}>{at ? `${at.precipChance}%` : "—"}</T>
            <T variant="caption" style={{ color: color.muted }}>
              {ct("share.stormsAt", { time: hourOnly(start) })}
            </T>
          </View>
        </View>
        <View style={{ gap: space.sm }}>
          <T variant="bodyBold" style={{ fontSize: 14 }}>
            {ct("share.bring")}
          </T>
          {items.map((item) => (
            <View key={item} style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
              <CheckIcon />
              <T>{item}</T>
            </View>
          ))}
        </View>
        <View style={{ gap: 6 }}>
          <T variant="smallBold">{ct("share.noteLabel")}</T>
          <TextInput
            value={note}
            onChangeText={setNote}
            placeholder={ct("share.notePlaceholder")}
            placeholderTextColor={color.muted}
            accessibilityLabel={ct("share.noteLabel")}
            style={[type.body, { height: 48, borderWidth: 1, borderColor: color.line, borderRadius: radius.button, paddingHorizontal: space.md, color: color.ink, backgroundColor: color.bg }]}
          />
        </View>
        <T variant="caption" style={{ color: color.muted }}>
          {ct("share.footer")}
        </T>
      </View>
    </Screen>
  );
}
