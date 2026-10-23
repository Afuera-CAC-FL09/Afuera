import { activityTemplate, ACTIVITIES, EFFORTS, GEARS, PROFILE_TEXT_MAX, SHADES, SURFACES, type ActivityProfile } from "@afuera/engine";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { TextInput, View } from "react-native";
import { AiConsent } from "@/components/AiConsent";
import { Chip, SoftButton, T } from "@/components/ui";
import { requestProfile } from "@/lib/profile";
import { useSettings } from "@/state/settings";
import { color, font, radius, space, type } from "@/theme";

/** The value after `current` in `list`, wrapping around: tapping a chip steps through its options. */
function next<T>(list: readonly T[], current: T): T {
  return list[(list.indexOf(current) + 1) % list.length];
}

// "What are you running?" box, used in setup and Settings.
export function ActivityDescribe() {
  const { t } = useTranslation();
  const { settings, update } = useSettings();
  const [text, setText] = useState("");
  const [describing, setDescribing] = useState(false);
  const [aiUsed, setAiUsed] = useState(true);
  const lang = settings.language;
  const profile = settings.profile;

  const describe = async () => {
    if (!text.trim() || describing) return;
    setDescribing(true);
    try {
      const result = await requestProfile(text, settings.role, lang, settings.aiConsent === true);
      setAiUsed(result.ai);
      update({ profile: result.profile, activity: result.profile.baseTemplate });
    } finally {
      setDescribing(false);
    }
  };
  const edit = (changes: Partial<ActivityProfile>) => {
    if (!profile) return;
    const updated = { ...profile, ...changes };
    update({ profile: updated, activity: updated.baseTemplate });
  };
  const profileLine = (p: ActivityProfile) =>
    [
      p.displayName,
      p.gear !== "none" ? t(`profile.gear.${p.gear}`) : null,
      p.surface !== "unknown" ? t(`profile.surface.${p.surface}`) : null,
      p.shade !== "unknown" ? t(`profile.shade.${p.shade}`) : null,
      p.groupSize ? t("profile.people", { count: p.groupSize }) : null,
      p.ages ? t("profile.ages", { ages: p.ages }) : null,
    ]
      .filter(Boolean)
      .join(" · ");

  return (
    <>
      <TextInput
        value={text}
        onChangeText={setText}
        maxLength={PROFILE_TEXT_MAX}
        multiline
        placeholder={t("setup.describePlaceholder")}
        placeholderTextColor={color.muted}
        accessibilityLabel={t("setup.activityTitle")}
        style={[type.body, { minHeight: 76, borderWidth: 1, borderColor: color.line, borderRadius: radius.button, padding: space.md, color: color.ink, textAlignVertical: "top" }]}
      />
      <T variant="caption" style={{ color: color.muted }}>
        {t("setup.privacyNote")}
      </T>
      <AiConsent />
      <SoftButton label={describing ? t("setup.working") : t("setup.describeButton")} onPress={describe} />

      {profile && (
        <View style={{ gap: space.sm, borderWidth: 1, borderColor: color.line, borderRadius: radius.card, padding: space.lg }}>
          <T variant="smallBold">{t("setup.resultTitle")}</T>
          <T style={{ fontFamily: font.displayMedium, fontSize: 20, lineHeight: 24 }}>{profileLine(profile)}</T>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
            <Chip label={activityTemplate(profile.baseTemplate).name[lang]} selected onPress={() => edit({ baseTemplate: next(ACTIVITIES, profile.baseTemplate), displayName: activityTemplate(next(ACTIVITIES, profile.baseTemplate)).name[profile.language] })} />
            <Chip label={t(`profile.gear.${profile.gear}`)} selected onPress={() => edit({ gear: next(GEARS, profile.gear) })} />
            <Chip label={t(`profile.surface.${profile.surface}`)} selected onPress={() => edit({ surface: next(SURFACES, profile.surface) })} />
            <Chip label={t(`profile.shade.${profile.shade}`)} selected onPress={() => edit({ shade: next(SHADES, profile.shade) })} />
            <Chip label={t(`profile.effort.${profile.effort}`)} selected onPress={() => edit({ effort: next(EFFORTS, profile.effort) })} />
            {profile.groupSize ? <Chip label={t("profile.people", { count: profile.groupSize })} selected onPress={() => edit({ groupSize: null })} /> : null}
          </View>
          <T variant="caption" style={{ color: color.muted }}>
            {aiUsed ? t("setup.chipHint") : `${t("setup.basicNote")} ${t("setup.chipHint")}`}
          </T>
        </View>
      )}
    </>
  );
}
