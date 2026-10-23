import { activityTemplate, ACTIVITIES, ROLES } from "@afuera/engine";
import { router } from "expo-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ActivityIndicator, Pressable, TextInput, View } from "react-native";
import { ActivityDescribe } from "@/components/ActivityDescribe";
import { PinIcon } from "@/components/icons";
import { BackHeader, Chip, Cta, LanguageToggle, Notice, pressFeedback, Screen, SoftButton, T } from "@/components/ui";
import { currentPlace, searchPlaces } from "@/lib/places";
import { useSettings, type Place } from "@/state/settings";
import { color, font, radius, space, type } from "@/theme";

const DURATIONS = [60, 90, 120, 180, 240];

/** First run: language, activity, place. Also opened from Settings to change the place. */
export default function Setup() {
  const { t } = useTranslation();
  const { settings, update } = useSettings();
  const changing = !!settings.place;
  const [step, setStep] = useState<"start" | "place">(changing ? "place" : "start");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Place[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const lang = settings.language;
  const profile = settings.profile;

  const choose = (place: Place) => {
    update({ place, demo: false });
    router.replace("/");
  };

  // The saved demo day is in Kissimmee, so the demo uses that place.
  const tryDemo = () => {
    update({ place: { name: "Kissimmee, FL", lat: 28.2919, lon: -81.4076 }, demo: true, demoStartedAt: Date.now() });
    router.replace("/");
  };

  const search = async () => {
    if (query.trim().length < 2) return;
    setBusy(true);
    setProblem(null);
    try {
      const found = await searchPlaces(query, lang);
      setResults(found);
      if (found.length === 0) setProblem(t("setup.noResults"));
    } catch {
      setProblem(t("ask.error"));
    } finally {
      setBusy(false);
    }
  };

  const useGps = async () => {
    setBusy(true);
    setProblem(null);
    try {
      const place = await currentPlace(t("setup.myLocation"));
      if (place) choose(place);
      else setProblem(t("setup.locationDenied"));
    } catch {
      setProblem(t("setup.locationDenied"));
    } finally {
      setBusy(false);
    }
  };

  const label = (text: string) => (
    <T variant="bodyBold" style={{ marginTop: space.sm }}>
      {text}
    </T>
  );

  return (
    <Screen
      header={
        changing ? (
          <BackHeader title={t("setup.placeTitle")} />
        ) : (
          <View style={{ paddingHorizontal: space.xl, paddingTop: space.lg, flexDirection: "row", justifyContent: "flex-end" }}>
            <LanguageToggle />
          </View>
        )
      }
      footer={
        step === "start" ? (
          <>
            <Cta label={t("common.continue")} onPress={() => setStep("place")} />
            <SoftButton label={t("setup.tryDemo")} onPress={tryDemo} />
          </>
        ) : undefined
      }
    >
      {!changing && (
        <View style={{ gap: space.sm, marginTop: space.lg }}>
          <T style={{ fontFamily: font.displayMedium, fontSize: 52, lineHeight: 54, letterSpacing: -1.5 }}>{t("setup.welcome")}</T>
          <T style={{ color: color.muted, fontSize: 17, lineHeight: 24 }}>{t("setup.tagline")}</T>
        </View>
      )}

      {step === "start" && (
        <>
          {label(t("setup.roleTitle"))}
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
            {ROLES.map((r) => (
              <Chip key={r} label={t(`setup.roles.${r}`)} selected={settings.role === r} onPress={() => update({ role: r, profile: profile && { ...profile, role: r } })} />
            ))}
          </View>

          {label(t("setup.activityTitle"))}
          <ActivityDescribe />

          {label(t("setup.orPick"))}
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
            {ACTIVITIES.map((a) => (
              <Chip
                key={a}
                label={activityTemplate(a).name[lang]}
                selected={!profile && settings.activity === a}
                onPress={() => update({ activity: a, profile: null, durationMinutes: activityTemplate(a).defaultMinutes })}
              />
            ))}
          </View>
          {label(t("setup.durationTitle"))}
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
            {DURATIONS.map((m) => (
              <Chip key={m} label={t("common.minutes", { count: m })} selected={settings.durationMinutes === m} onPress={() => update({ durationMinutes: m })} />
            ))}
          </View>
        </>
      )}

      {step === "place" && (
        <>
          {!changing && label(t("setup.placeTitle"))}
          <SoftButton icon={<PinIcon size={18} />} label={t("setup.useLocation")} onPress={useGps} />
          <View style={{ flexDirection: "row", gap: space.sm }}>
            <TextInput
              value={query}
              onChangeText={setQuery}
              onSubmitEditing={search}
              placeholder={t("setup.searchPlaceholder")}
              placeholderTextColor={color.muted}
              returnKeyType="search"
              accessibilityLabel={t("setup.searchPlaceholder")}
              style={[type.body, { flex: 1, height: 48, borderWidth: 1, borderColor: color.line, borderRadius: radius.button, paddingHorizontal: space.md, color: color.ink }]}
            />
            <Pressable
              accessibilityRole="button"
              disabled={busy || query.trim().length < 2}
              onPress={search}
              style={(s) => [{ height: 48, paddingHorizontal: space.lg, borderRadius: radius.button, backgroundColor: color.amber, justifyContent: "center", opacity: busy || query.trim().length < 2 ? 0.45 : 1 }, pressFeedback(s)]}
            >
              <T style={{ fontFamily: font.bodyBold }}>{t("setup.search")}</T>
            </Pressable>
          </View>
          {busy && <ActivityIndicator color={color.ink} />}
          {problem && <Notice tone="warn" title={problem} />}
          {results?.map((p) => (
            <Pressable
              key={`${p.lat},${p.lon}`}
              accessibilityRole="button"
              onPress={() => choose(p)}
              style={(s) => [{ flexDirection: "row", alignItems: "center", gap: space.sm, borderWidth: 1, borderColor: color.line, borderRadius: radius.card, padding: space.lg }, pressFeedback(s)]}
            >
              <PinIcon size={18} />
              <T variant="bodyBold">{p.name}</T>
            </Pressable>
          ))}
        </>
      )}
    </Screen>
  );
}
