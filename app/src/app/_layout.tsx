import "@/i18n";
import {
  PlusJakartaSans_400Regular,
  PlusJakartaSans_500Medium,
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
} from "@expo-google-fonts/plus-jakarta-sans";
import {
  SpaceGrotesk_300Light,
  SpaceGrotesk_400Regular,
  SpaceGrotesk_500Medium,
  SpaceGrotesk_600SemiBold,
  useFonts,
} from "@expo-google-fonts/space-grotesk";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { LiveProvider } from "@/state/live";
import { SettingsProvider, useSettings } from "@/state/settings";
import { WeatherProvider } from "@/state/weather";
import { color } from "@/theme";

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    SpaceGrotesk_300Light,
    SpaceGrotesk_400Regular,
    SpaceGrotesk_500Medium,
    SpaceGrotesk_600SemiBold,
    PlusJakartaSans_400Regular,
    PlusJakartaSans_500Medium,
    PlusJakartaSans_600SemiBold,
    PlusJakartaSans_700Bold,
  });

  return (
    <SettingsProvider>
      <WeatherProvider>
        <LiveProvider>
          <StatusBar style="dark" />
          {fontsLoaded && <Screens />}
        </LiveProvider>
      </WeatherProvider>
    </SettingsProvider>
  );
}

function Screens() {
  const { loaded } = useSettings();

  useEffect(() => {
    if (loaded) SplashScreen.hideAsync();
  }, [loaded]);
  if (!loaded) return null;

  // Every screen draws its own header, as in the design.
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: color.bg } }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="setup" />
      <Stack.Screen name="why" />
      <Stack.Screen name="share" options={{ presentation: "modal" }} />
      <Stack.Screen name="settings" />
      <Stack.Screen name="event" options={{ presentation: "fullScreenModal" }} />
    </Stack>
  );
}
