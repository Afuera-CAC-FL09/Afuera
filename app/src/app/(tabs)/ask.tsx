import { findBestWindows, type RiskLevel } from "@afuera/engine";
import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { AiConsent } from "@/components/AiConsent";
import { SparkleIcon } from "@/components/icons";
import { Chip, pressFeedback, RiskPill, T } from "@/components/ui";
import { askProxy, type ChatTurn } from "@/lib/ask";
import { guidanceKey, guidanceText, useCurrentRisk, useLevelName, useTimeFormat } from "@/lib/heat";
import { useSettings } from "@/state/settings";
import { useWeather } from "@/state/weather";
import { color, font, radius, space, type } from "@/theme";

interface Message extends ChatTurn {
  level?: RiskLevel | null;
}

export default function Ask() {
  const { t } = useTranslation();
  const { settings } = useSettings();
  const { risks, forecast, now } = useWeather();
  const { hour } = useCurrentRisk();
  const levelName = useLevelName();
  const fmt = useTimeFormat();
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const scroll = useRef<ScrollView>(null);

  /** Basic mode: what the heat model says without AI, in the user's language. */
  const basicAnswer = () => {
    const lines = [t(settings.aiConsent === true ? "ask.basicNote" : "ask.basicOff")];
    if (hour?.level && hour.wbgtF != null) lines.push(t("ask.basicNow", { level: levelName(hour.level), wbgt: hour.wbgtF.toFixed(1) }));
    const guidance = hour && guidanceKey(hour);
    if (guidance) lines.push(guidanceText(t, guidance, settings.activity));
    const { best } = findBestWindows(risks, { durationMinutes: settings.durationMinutes, from: now, utcOffsetSeconds: forecast?.utcOffsetSeconds ?? 0 });
    if (best) lines.push(t("ask.basicBetter", { when: fmt.window(best), level: levelName(best.level) }));
    return lines.join("\n\n");
  };

  const send = async (text: string) => {
    const question = text.trim();
    if (!question || busy) return;
    const history = messages.map(({ role, text }) => ({ role, text }));
    setMessages((m) => [...m, { role: "user", text: question }]);
    setDraft("");
    setBusy(true);
    let reply: Message;
    try {
      if (settings.aiConsent !== true) throw new Error("AI not allowed");
      const res = await askProxy(question, settings, history);
      reply = res.mode === "ai" && res.answer ? { role: "assistant", text: res.answer, level: res.level } : { role: "assistant", text: basicAnswer(), level: hour?.level ?? null };
    } catch {
      reply = { role: "assistant", text: basicAnswer(), level: hour?.level ?? null };
    }
    setMessages((m) => [...m, reply]);
    setBusy(false);
    setTimeout(() => scroll.current?.scrollToEnd({ animated: true }), 50);
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: color.bg }} edges={["top", "left", "right"]}>
      <KeyboardAvoidingView style={{ flex: 1, width: "100%", maxWidth: 520, alignSelf: "center" }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <T variant="heading" accessibilityRole="header" style={{ paddingHorizontal: space.xl, paddingTop: space.lg, paddingBottom: space.md }}>
          {t("ask.title")}
        </T>
        <ScrollView ref={scroll} contentContainerStyle={{ paddingHorizontal: space.xl, paddingBottom: space.lg, gap: space.md }}>
          <AiConsent />
          {messages.length === 0 && (
            <View style={{ gap: space.sm, alignItems: "flex-start" }}>
              {(t("ask.examples", { returnObjects: true }) as string[]).map((ex) => (
                <Chip key={ex} label={ex} selected={false} onPress={() => send(ex)} />
              ))}
            </View>
          )}
          {messages.map((m, i) =>
            m.role === "user" ? (
              <View key={i} style={{ alignSelf: "flex-end", maxWidth: "86%", backgroundColor: color.ink, borderRadius: radius.card, borderBottomRightRadius: 6, padding: space.md }}>
                <T style={{ color: "#FFFFFF" }}>{m.text}</T>
              </View>
            ) : (
              <View key={i} style={{ alignSelf: "flex-start", maxWidth: "92%", backgroundColor: color.sky, borderRadius: radius.card, borderBottomLeftRadius: 6, padding: space.md, gap: space.sm }}>
                {m.level && <RiskPill level={m.level} label={t(`common.levelRisk.${m.level}`)} size="sm" />}
                <T>{m.text}</T>
              </View>
            ),
          )}
          {busy && (
            <View style={{ flexDirection: "row", gap: space.sm, alignItems: "center" }}>
              <ActivityIndicator color={color.ink} />
              <T variant="small" style={{ color: color.muted }}>
                {t("ask.thinking")}
              </T>
            </View>
          )}
          <View style={{ flexDirection: "row", gap: space.sm }}>
            <SparkleIcon size={16} />
            <T variant="caption" style={{ flex: 1, color: color.muted }}>
              {t("ask.disclaimer")}
            </T>
          </View>
        </ScrollView>
        <View style={{ flexDirection: "row", gap: space.sm, paddingHorizontal: space.xl, paddingVertical: 10, borderTopWidth: 1, borderTopColor: color.sky }}>
          <TextInput
            value={draft}
            onChangeText={setDraft}
            onSubmitEditing={() => send(draft)}
            placeholder={t("ask.placeholder")}
            placeholderTextColor={color.muted}
            accessibilityLabel={t("ask.placeholder")}
            maxLength={1000}
            style={[type.body, { flex: 1, height: 48, paddingHorizontal: space.lg, borderRadius: radius.button, borderWidth: 1, borderColor: color.line, color: color.ink }]}
          />
          <Pressable
            accessibilityRole="button"
            disabled={busy || !draft.trim()}
            onPress={() => send(draft)}
            style={(s) => [{ height: 48, paddingHorizontal: space.lg, borderRadius: radius.button, backgroundColor: color.amber, justifyContent: "center", opacity: busy || !draft.trim() ? 0.45 : 1 }, pressFeedback(s)]}
          >
            <T style={{ fontFamily: font.bodyBold }}>{t("ask.send")}</T>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
