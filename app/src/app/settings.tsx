import { activityTemplate, ACTIVITIES, HEAT_BANDS, ROLES } from "@afuera/engine";
import { router } from "expo-router";
import { useTranslation } from "react-i18next";
import { Linking, Switch, View } from "react-native";
import { ActivityDescribe } from "@/components/ActivityDescribe";
import { BackHeader, Chip, LanguageToggle, LinkText, OutlineCard, RiskPill, Screen, Section, SoftButton, T } from "@/components/ui";
import { guidanceText, useLevelName } from "@/lib/heat";
import { useSettings } from "@/state/settings";
import { color, space } from "@/theme";

const HANDBOOK = "https://s3.amazonaws.com/fhsaa.org/documents/2026/4/27/2526_handbook_42426.pdf";
const DURATIONS = [60, 90, 120, 180, 240];

export default function SettingsScreen() {
  const { t } = useTranslation();
  const { settings, update } = useSettings();
  const levelName = useLevelName();
  const lang = settings.language;

  const label = (text: string) => (
    <T variant="smallBold" style={{ color: color.muted, marginTop: space.sm }}>
      {text}
    </T>
  );

  return (
    <Screen header={<BackHeader title={t("settings.title")} right={<View style={{ marginRight: space.sm }}><LanguageToggle /></View>} />}>
      {label(t("settings.place"))}
      <OutlineCard style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <T variant="bodyBold" style={{ flexShrink: 1 }}>
          {settings.place?.name}
        </T>
        <LinkText label={t("settings.change")} onPress={() => router.push("/setup")} />
      </OutlineCard>

      {label(t("setup.roleTitle"))}
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
        {ROLES.map((r) => (
          <Chip key={r} label={t(`setup.roles.${r}`)} selected={settings.role === r} onPress={() => update({ role: r, profile: settings.profile && { ...settings.profile, role: r } })} />
        ))}
      </View>

      {label(t("setup.activityTitle"))}
      <ActivityDescribe />
      <T variant="small" style={{ color: color.muted }}>
        {t("setup.orPick")}
      </T>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
        {ACTIVITIES.map((a) => (
          <Chip key={a} label={activityTemplate(a).name[lang]} selected={!settings.profile && settings.activity === a} onPress={() => update({ activity: a, profile: null })} />
        ))}
      </View>

      {label(t("settings.duration"))}
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
        {DURATIONS.map((m) => (
          <Chip key={m} label={t("common.minutes", { count: m })} selected={settings.durationMinutes === m} onPress={() => update({ durationMinutes: m })} />
        ))}
      </View>

      {label(t("event.open"))}
      <Section style={{ gap: space.md }}>
        <T variant="small">{t("event.help")}</T>
        <SoftButton label={t("event.open")} onPress={() => router.push("/event")} surface={color.bg} />
      </Section>

      {label(t("settings.demo"))}
      <Section style={{ flexDirection: "row", alignItems: "center", gap: space.md }}>
        <T variant="small" style={{ flex: 1 }}>
          {t("settings.demoHelp")}
        </T>
        <Switch
          value={settings.demo}
          onValueChange={(demo) => update({ demo, demoStartedAt: Date.now() })}
          trackColor={{ true: color.amber, false: color.line }}
          thumbColor="#FFFFFF"
          accessibilityLabel={t("settings.demo")}
        />
      </Section>

      {label(t("settings.ai"))}
      <Section style={{ flexDirection: "row", alignItems: "center", gap: space.md }}>
        <T variant="small" style={{ flex: 1 }}>
          {t("settings.aiHelp")}
        </T>
        <Switch
          value={settings.aiConsent === true}
          onValueChange={(aiConsent) => update({ aiConsent })}
          trackColor={{ true: color.amber, false: color.line }}
          thumbColor="#FFFFFF"
          accessibilityLabel={t("settings.ai")}
        />
      </Section>

      {label(t("settings.policy"))}
      <OutlineCard>
        <T variant="small">{t("settings.policyBody")}</T>
        {HEAT_BANDS.map((b, i) => {
          const from = i === 0 ? null : HEAT_BANDS[i - 1].maxF;
          const range = from === null ? "< 82.0°F" : b.maxF === Infinity ? `≥ ${(from + 0.1).toFixed(1)}°F` : `${(from + 0.1).toFixed(1)}–${b.maxF.toFixed(1)}°F`;
          const guidance = b.stopOutdoor ? "extremeStop" : b.level === "extreme" ? "extremeLimited" : b.level;
          return (
            <View key={i} style={{ gap: 4, paddingTop: space.md, borderTopWidth: 1, borderTopColor: color.sky }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: space.sm }}>
                <RiskPill level={b.level} label={levelName(b.level)} size="sm" />
                <T variant="bodyBold">{range}</T>
              </View>
              <T variant="small" style={{ color: color.muted }}>
                {guidanceText(t, guidance, settings.activity)}
              </T>
            </View>
          );
        })}
        <LinkText label={t("settings.policyLink")} onPress={() => Linking.openURL(HANDBOOK)} />
      </OutlineCard>

      {label(t("settings.credits"))}
      <T variant="caption" style={{ color: color.muted }}>
        {t("settings.creditsBody")}
      </T>
    </Screen>
  );
}
