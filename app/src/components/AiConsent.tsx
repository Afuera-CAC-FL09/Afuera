import { useTranslation } from "react-i18next";
import { View } from "react-native";
import { SparkleIcon } from "@/components/icons";
import { OutlineCard, SoftButton, T } from "@/components/ui";
import { useSettings } from "@/state/settings";
import { color, space } from "@/theme";

// Ask before sending anything typed to the AI (App Store rule 5.1.2(i)).
export function AiConsent() {
  const { t } = useTranslation();
  const { settings, update } = useSettings();
  if (settings.aiConsent !== null) return null;
  return (
    <OutlineCard style={{ gap: space.md }}>
      <View style={{ flexDirection: "row", gap: space.sm, alignItems: "center" }}>
        <SparkleIcon size={16} />
        <T variant="smallBold">{t("aiConsent.title")}</T>
      </View>
      <T variant="small">{t("aiConsent.body")}</T>
      <SoftButton label={t("aiConsent.allow")} onPress={() => update({ aiConsent: true })} surface={color.amber} />
      <SoftButton label={t("aiConsent.decline")} onPress={() => update({ aiConsent: false })} />
    </OutlineCard>
  );
}
