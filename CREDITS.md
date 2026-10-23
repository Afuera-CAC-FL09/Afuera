# Credits.

## Data
- Open-Meteo (forecast and historical weather): https://open-meteo.com
- National Weather Service alerts API: https://api.weather.gov

## Science
- Liljegren et al. (2008), "Modeling the Wet Bulb Globe Temperature Using Standard Meteorological Measurements," Journal of Occupational and Environmental Hygiene 5(10).
- If you port or compare against Argonne's WBGT code, its license requires this line: "This product includes software produced by UChicago Argonne, LLC under Contract No. DE-AC02-06CH11357 with the Department of Energy."

## Heat policy
- Florida High School Athletic Association, 2025-26 FHSAA Handbook, Policy 41 (Exertional Heat Illness), WBGT Index for Practices 41.8.3: https://s3.amazonaws.com/fhsaa.org/documents/2026/4/27/2526_handbook_42426.pdf

## Code we adapted
- Liljegren WBGT v1.1 C code, © 2008 UChicago Argonne, LLC (open source license in `tools/wbgt-oracle/wbgt.c`), including Nels Larson's solar position routine (PNNL). Ported to TypeScript in `engine/src/wbgt.ts`.
- Copy of the original C file obtained from the zyf0717/lwbgt repository (`upstream/wbgt.c.original`, originally from mdljts/wbgt). Used only for testing.

## Libraries
- App: Expo and Expo modules (expo-router, expo-localization, expo-location, expo-notifications, expo-haptics, expo-sharing, expo-clipboard, expo-keep-awake, expo-font and others), React Native, React, react-native-web, react-native-svg, react-native-view-shot, @react-native-community/slider, @react-native-async-storage/async-storage, react-native-reanimated, react-native-gesture-handler, react-native-safe-area-context, react-native-screens, i18next, react-i18next. All MIT licensed.
- Fonts: Space Grotesk and Plus Jakarta Sans (SIL Open Font License), via @expo-google-fonts.
- Proxy: @anthropic-ai/sdk (MIT), Cloudflare Workers and Wrangler.
- Tests and tools: Vitest, TypeScript, yaml, esbuild (MIT). Evidence tools use the Open-Meteo Historical Forecast API (CC BY 4.0).

## AI
- Claude (Anthropic) answers questions on the Ask screen. Claude Code was used to write some code; see `AI_USE.md`.

## Geocoding
- Open-Meteo Geocoding API (city/ZIP search): https://open-meteo.com/en/docs/geocoding-api
