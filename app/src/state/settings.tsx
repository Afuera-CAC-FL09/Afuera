import type { ActivityId, ActivityProfile, Role } from "@afuera/engine";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import i18n, { deviceLanguage, type Language } from "@/i18n";

export interface Place {
  name: string;
  lat: number;
  lon: number;
}

export interface Settings {
  language: Language;
  activity: ActivityId;
  durationMinutes: number;
  place: Place | null;
  demo: boolean;
  /** When demo mode was turned on; the demo clock counts from here. */
  demoStartedAt: number;
  /** The lower-risk window last sent to the group from the share card (ISO times), for the session summary. */
  movedTo: { start: string; end: string } | null;
  /** Who's using the app; changes what Today shows. */
  role: Role;
  /** From "What are you running?". null means a preset (activity alone). Stays on the phone. */
  profile: ActivityProfile | null;
  /** May what the user types go to the AI (Ask, "What are you running?")? null means not asked yet; until it's true, both work on the phone only. */
  aiConsent: boolean | null;
}

const KEY = "afuera.settings.v1";

const DEFAULTS: Settings = {
  language: deviceLanguage(),
  activity: "team",
  durationMinutes: 120,
  place: null,
  demo: false,
  demoStartedAt: 0,
  movedTo: null,
  role: "organizer",
  profile: null,
  aiConsent: null,
};

interface SettingsContext {
  settings: Settings;
  /** False until saved settings have been read from storage. */
  loaded: boolean;
  update: (changes: Partial<Settings>) => void;
}

const Context = createContext<SettingsContext | null>(null);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState(DEFAULTS);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(KEY)
      .then((raw) => {
        if (!raw) return;
        const saved = { ...DEFAULTS, ...(JSON.parse(raw) as Partial<Settings>) };
        setSettings(saved);
        i18n.changeLanguage(saved.language);
      })
      .catch((err) => console.warn("couldn't read settings", err))
      .finally(() => setLoaded(true));
  }, []);

  const update = (changes: Partial<Settings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...changes };
      if (changes.language) i18n.changeLanguage(changes.language);
      AsyncStorage.setItem(KEY, JSON.stringify(next)).catch((err) => console.warn("couldn't save settings", err));
      return next;
    });
  };

  return <Context.Provider value={{ settings, loaded, update }}>{children}</Context.Provider>;
}

export function useSettings(): SettingsContext {
  const ctx = useContext(Context);
  if (!ctx) throw new Error("useSettings must be inside SettingsProvider");
  return ctx;
}
