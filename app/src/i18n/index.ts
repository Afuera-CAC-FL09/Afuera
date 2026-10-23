import { getLocales } from "expo-localization";
import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import { en } from "./en";
import { es } from "./es";

export type Language = "en" | "es";

/** Spanish if the phone is set to Spanish, otherwise English. The user can change it in setup. */
export function deviceLanguage(): Language {
  return getLocales()[0]?.languageCode === "es" ? "es" : "en";
}

i18n.use(initReactI18next).init({
  resources: { en: { translation: en }, es: { translation: es } },
  lng: deviceLanguage(),
  fallbackLng: "en",
  interpolation: { escapeValue: false },
  returnObjects: true,
});

export default i18n;
