import * as Location from "expo-location";
import type { Place } from "@/state/settings";

interface GeocodeResult {
  name: string;
  latitude: number;
  longitude: number;
  admin1?: string;
  country_code?: string;
}

/** City or ZIP search, US only (Open-Meteo geocoding). */
export async function searchPlaces(query: string, language: "en" | "es"): Promise<Place[]> {
  const q = encodeURIComponent(query.trim());
  const res = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${q}&count=6&language=${language}&countryCode=US&format=json`);
  if (!res.ok) throw new Error(`geocoding ${res.status}`);
  const json = (await res.json()) as { results?: GeocodeResult[] };
  return (json.results ?? []).map((r) => ({
    name: r.admin1 ? `${r.name}, ${stateAbbrev(r.admin1)}` : r.name,
    lat: r.latitude,
    lon: r.longitude,
  }));
}

/** The phone's location, or null if the user said no. */
export async function currentPlace(fallbackName: string): Promise<Place | null> {
  const { status } = await Location.requestForegroundPermissionsAsync();
  if (status !== "granted") return null;
  const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
  const { latitude: lat, longitude: lon } = pos.coords;
  const [address] = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lon }).catch(() => []);
  const name = address?.city ? `${address.city}${address.region ? `, ${stateAbbrev(address.region)}` : ""}` : fallbackName;
  return { name, lat, lon };
}

function stateAbbrev(state: string): string {
  return state === "Florida" ? "FL" : state;
}
