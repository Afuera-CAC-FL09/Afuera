import type { ActivityWindow, HourRisk } from "@afuera/engine";
import { useTranslation } from "react-i18next";
import { Linking, Pressable, View } from "react-native";
import { CheckIcon } from "@/components/icons";
import { OutlineCard, pressFeedback, RiskPill, Section, T } from "@/components/ui";
import { useLevelName, useTimeFormat } from "@/lib/heat";
import { waterEvery } from "@/lib/plan";
import { useSettings } from "@/state/settings";
import { color, font, radius, space } from "@/theme";

function Checklist({ items }: { items: string[] }) {
  return (
    <View style={{ gap: space.sm }}>
      {items.map((item) => (
        <View key={item} style={{ flexDirection: "row", gap: 10 }}>
          <View style={{ marginTop: 2 }}>
            <CheckIcon />
          </View>
          <T style={{ flex: 1 }}>{item}</T>
        </View>
      ))}
    </View>
  );
}

/** Today for a parent: will it move, and what to pack. */
export function ParentToday({ better }: { better: ActivityWindow | null }) {
  const { t } = useTranslation();
  const { settings } = useSettings();
  const levelName = useLevelName();
  const fmt = useTimeFormat();
  const pack = [...(t("share.items", { returnObjects: true }) as string[])];
  if (settings.profile?.gear === "heavy") pack.push(t("participant.clothes"));
  for (const extra of settings.profile?.extraCheckins ?? []) pack.push(extra.label[settings.language]);

  return (
    <>
      <OutlineCard>
        <T variant="smallBold" style={{ color: color.link }}>
          {t("parent.moveTitle")}
        </T>
        {better ? (
          <>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              <T style={{ fontFamily: font.displayMedium, fontSize: 24, lineHeight: 28 }}>{fmt.window(better)}</T>
              <RiskPill level={better.level} label={t(`common.levelRisk.${better.level}`)} size="sm" />
            </View>
            <T>{t("parent.moveYes", { time: fmt.window(better), level: levelName(better.level).toLowerCase() })}</T>
          </>
        ) : (
          <T>{t("parent.moveNo")}</T>
        )}
      </OutlineCard>
      <Section>
        <T variant="bodyBold">{t("parent.packTitle")}</T>
        <Checklist items={pack} />
      </Section>
    </>
  );
}

/** Today for a kid or teen taking part: their own checklist, warning signs, and who to tell. */
export function ParticipantToday({ hour }: { hour: HourRisk | null }) {
  const { t } = useTranslation();
  const { settings } = useSettings();
  const every = hour?.level ? waterEvery(settings, hour.level) : 30;
  const signs = t("participant.signs", { returnObjects: true }) as string[];

  return (
    <>
      <Section>
        <T variant="bodyBold">{t("participant.checklistTitle")}</T>
        <Checklist items={[t("participant.bottle"), t("participant.drink", { count: every }), t("participant.shade"), t("participant.clothes")]} />
      </Section>
      <OutlineCard>
        <T variant="bodyBold">{t("participant.signsTitle")}</T>
        {signs.map((s) => (
          <T key={s}>{`• ${s}`}</T>
        ))}
        <T variant="bodyBold" style={{ marginTop: space.xs }}>
          {t("participant.tellAdult")}
        </T>
      </OutlineCard>
      <View style={{ backgroundColor: color.amberTint, borderRadius: radius.card, padding: space.lg, gap: space.md }}>
        <T variant="bodyBold" style={{ color: color.amberInk }}>
          {t("participant.call911")}
        </T>
        <Pressable
          accessibilityRole="button"
          onPress={() => Linking.openURL("tel:911")}
          style={(s) => [{ height: 48, borderRadius: radius.button, backgroundColor: color.ink, alignItems: "center", justifyContent: "center" }, pressFeedback(s)]}
        >
          <T variant="button" style={{ color: "#FFFFFF" }}>
            {t("participant.callButton")}
          </T>
        </Pressable>
      </View>
    </>
  );
}
