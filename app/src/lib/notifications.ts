import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

export const CHANNEL = "checkins";

// Show check-ins even while the app is open (the Live screen also vibrates).
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

/** Sets up the lock-screen channel and asks for permission. Returns whether we may notify. */
export async function prepareNotifications(channelName: string): Promise<boolean> {
  if (Platform.OS === "web") return false;
  if (Platform.OS === "android") {
    // Android 13+ only shows the permission prompt after a channel exists.
    await Notifications.setNotificationChannelAsync(CHANNEL, {
      name: channelName,
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 400, 200, 400],
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
    });
  }
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  const asked = await Notifications.requestPermissionsAsync();
  return asked.granted;
}

/** Schedules one alert `secondsFromNow` seconds out, shown on the lock screen. */
export function scheduleAlert(title: string, body: string, secondsFromNow: number) {
  return Notifications.scheduleNotificationAsync({
    content: { title, body, sound: true, interruptionLevel: "timeSensitive" },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
      seconds: Math.max(1, Math.round(secondsFromNow)),
      channelId: CHANNEL,
    },
  });
}

/** Cancels one alert by the id scheduleAlert returned. */
export function cancelAlert(id: string) {
  return Platform.OS === "web" ? Promise.resolve() : Notifications.cancelScheduledNotificationAsync(id);
}

export function cancelAlerts() {
  return Platform.OS === "web" ? Promise.resolve() : Notifications.cancelAllScheduledNotificationsAsync();
}
