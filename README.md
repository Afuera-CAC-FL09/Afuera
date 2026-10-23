# Afuera

Afuera ("outside" in Spanish) tells the adults who run kids' outdoor activities in Central Florida how dangerous the heat is right now, when a lower-risk time is coming, and when to stop for water and shade, in English or Spanish, helping outdoor event managers or participants schedule around heat or storm. It turns the weather forecast into the same heat levels Florida high schools must follow, and keeps a coach on schedule with lock-screen check-ins during practice.

## Install it

* **Android:** download the APK from the [latest release](https://github.com/Afuera-CAC-FL09/Afuera/releases/latest). Open it on the phone and allow "install from this source" if asked.
* **iPhone or Android, no install:** install **Expo Go** from the App Store or Google Play, then scan this QR code: *\[QR / `exp://` link goes here]*.
* **\[ADVAITH TO EVB: UPDATE THIS WHEN ON APP STORE!]**

## See it in action

Florida in October is mild, so the live forecast may show the lowest level. To see a dangerous day:

**Settings → Demo mode, or by clicking the box in "today"/"hoy".** The app replays a saved forecast for **Kissimmee, July 15, 2026**, starting at 1 PM. It works with no internet. In the first hours you'll see High, then Extreme, and Better time finds a lower-risk evening and next-morning window.

Things to try in demo mode:

1. **Today:** the heat level, what to do about it, and a lower-risk time.
2. **Better time:** a clock dial colored hour by hour; pick other days.
3. **Move … to 7:00 PM → Share:** the message for the parents' group chat, in English or Spanish.
4. **Live:** start the activity. Water breaks and heat checks count down, and arrive on the lock screen. Hear thunder? Tap it to start the 30-minute lightning wait, which restarts with every rumble and alerts you when it's over. End it to get a session summary to text the team.
5. **Why this level?:** sliders show how humidity and sun change the heat stress at the same air temperature.
6. **Ask:** questions in your own words, answered by Claude with Afuera's numbers.
7. **Setup → "What are you running?":** type something like *ensayo de banda con uniformes en el estacionamiento*. Heavy uniforms on asphalt mean more frequent breaks.

## How the heat level is calculated

1. **Weather:** hourly temperature, humidity, wind, air pressure and sunlight from [Open-Meteo](https://open-meteo.com), plus storm chance and [National Weather Service](https://www.weather.gov/documentation/services-web-api) alerts.
2. **Heat stress (WBGT):** the wet bulb globe temperature, which counts humidity, sun and wind as well as air temperature. We use the Liljegren model ([Liljegren et al., 2008](https://doi.org/10.1080/15459620802310770)), ported from Argonne National Laboratory's C code to TypeScript (`engine/src/wbgt.ts`). Our port matches the original within 0.02 °C on 418 test cases (`tools/wbgt-oracle/`).
3. **Level:** the WBGT goes through the FHSAA table ([2025-26 FHSAA Handbook, Policy 41.8.3](https://s3.amazonaws.com/fhsaa.org/documents/2026/4/27/2526_handbook_42426.pdf)). Readings are rounded *up*, toward caution:

|Level|WBGT (°F)|What FHSAA requires|
|-|-|-|
|Lower|below 82.0|Normal activity|
|Elevated|82.0–87.0|Three 4-minute rest breaks every hour|
|High|87.1–90.0|2 hours max, four rest breaks every hour|
|Extreme|90.1–92.0|1 hour max, five rest breaks, no pads, no conditioning|
|Extreme|92.1 and up|No outdoor activity|

Afuera never calls any level "safe". The lowest level is "lower risk". Every screen says the level is an estimate from forecast data, not a reading taken on the field. Ngl, we were going to use words like "safe" or smth but we were told from several sources not to use absolute wording

## How the AI is limited

The AI (Claude, by Anthropic) only explains and plans. It never decides the heat level.

* **`final = max(physics, ai)`.** The level shown is the higher of the physics model's level and the AI's. If the AI's answer is based on a *lower* level than the model, the server throws the AI text away and shows the model's numbers instead (`proxy/src/ask.ts`, `applySafetyRule`).
* **Check-ins only get stricter.** The AI, and the "What are you running?" profile, can add check-ins or make them more frequent. They can never remove a required one or space one out (`engine/src/checkins.ts`, `engine/src/profile.ts`). Tests try every combination (`engine/test/profile.test.ts`).
* **The key stays off the phone.** The app talks to a small server (`proxy/`) that holds the API key, limits how often each phone can ask, and stops at a daily dollar cap. If the AI is down or over budget, the app still answers from the physics model.
* **Privacy.** The setup box tells people not to type names or health details, and the server strips any that get through. Session summaries stay on the phone unless the coach shares them.
* **Tested.** `ai/evals/scenarios.yaml` has 60 test scenarios (heat questions, medical questions, storms, Spanish, prompt-injection attempts, kids' names, small talk) that run against the real model. A pediatrician reviews the answers.

## Run the tests

Needs Node 20 or newer.

```sh
npm install
npm test                     # engine + proxy tests
cd engine \\\&\\\& npx tsc --noEmit
cd ../proxy \\\&\\\& npx tsc --noEmit
cd ../app \\\&\\\& npx tsc --noEmit
```

## Credits and AI use

Outside code, data and libraries are listed in [`CREDITS.md`](CREDITS.md). How we used AI to build Afuera, and who reviewed each part, is in [`AI\\\_USE.md`](AI_USE.md).

\---

## For the team

### Folders

|Folder|What goes here|
|-|-|
|`app/`|The Expo (React Native) app|
|`engine/src/`|WBGT model, risk levels, best-time finder, check-ins, profiles|
|`engine/test/`|Engine and tool tests|
|`proxy/src/`|AI proxy (keeps the API key off the phone)|
|`ai/prompts/`|System prompts (`system.md` for Ask, `profile.md` for setup)|
|`ai/evals/`|Test scenarios for the AI, and the review sheets|
|`ai/templates/`|Check-in templates per activity (band, team, camp, event)|
|`data/demo/`|Saved July day for demo mode|
|`data/what-if/`, `data/meter/`|Input CSVs for the evidence tools (the samples are made up)|
|`docs/`|Video script, consent forms, submission notes, evidence reports|
|`tools/`|Scripts and test helpers|



### Run the app

`cd app \\\&\\\& npx expo start`. Press `w` for the browser, or scan the QR code with Expo Go. Before building, set `proxyUrl` and `nwsContact` in `app/app.json` → `expo.extra`.

**Phone builds:** `cd app \\\&\\\& npx eas-cli@latest build --profile preview --platform android` makes an APK (needs a free Expo account). iPhone needs an Apple developer account \[**ADVAITH TO EVB: GETTING THIS NOW I WILL SEE IF APPLE ACCEPTS US IN TIME!!]**

**Web build (optional, for judges):** `cd app \\\&\\\& npx expo export --platform web`, then `npx wrangler pages deploy dist --project-name afuera` (Cloudflare account; the first run creates the project and prints the link).

**App art:** the icon and splash are placeholders; see `app/README.md` for the file names and sizes.

### AI proxy, local

Copy `proxy/.dev.vars.example` to `proxy/.dev.vars`, put the Anthropic API key and the team contact in it, then `cd proxy \\\&\\\& npx wrangler dev`.

### Deploy the AI proxy

The proxy is a Cloudflare Worker. It keeps the Anthropic API key off the phones. You need a free Cloudflare account, the team's Anthropic API key, and the team email (the National Weather Service asks every app for a contact).

```sh
cd proxy
npx wrangler login                            # opens the browser; log in to Cloudflare
npx wrangler secret put ANTHROPIC\\\_API\\\_KEY     # paste the key when asked
npx wrangler secret put NWS\\\_CONTACT           # type the team email or GitHub URL
npx wrangler deploy --dry-run                 # optional: checks the build without uploading
npx wrangler deploy
```

`deploy` prints the Worker's URL, like `https://afuera-proxy.<your-subdomain>.workers.dev`. Then:

1. Open `<that URL>/health` in a browser. It should say `{"ok":true}`.
2. Put the URL (no slash at the end) in `app/app.json` → `expo.extra.proxyUrl`, and the same team email in `expo.extra.nwsContact`.
3. Rebuild the app (or restart `npx expo start`) so it picks up the new URL.

Secrets stay on Cloudflare across deploys, so later deploys are just `npx wrangler deploy`. Limits (requests per phone per minute and per day, and the daily dollar cap) are in `proxy/wrangler.toml`. Also set a monthly spend limit in the Anthropic Console (Settings → Limits). If the key is missing, the budget runs out or Claude is down, the proxy still answers in basic mode with the physics-model numbers.

### AI tests

With the proxy running locally: `node tools/run-evals.mjs http://localhost:8787` (about $1–3 for a full run; add a scenario id to run just one). It writes `ai/evals/results-<date>.md`, the review sheet for the pediatrician or teacher.

### Evidence tools

Both need internet (Open-Meteo) and write a Markdown report, a CSV and a chart to `docs/evidence/`.

* **What if they had used Afuera?** `npm run what-if -- path/to/schedule.csv`. Columns: `date,start,durationMin,place,lat,lon,activity` (local clock times). Reports practices that reached High or Extreme, time spent in High/Extreme heat, and how much of it moving to Better time's pick that day would have avoided.
* **Meter accuracy:** `npm run meter-compare -- path/to/readings.csv`. Columns: `time,wbgtF,lat,lon,notes` (time like `2026-10-17 15:20`). Reports average gap, largest gap, bias, how often the level matched, and the sample size.

The sample CSVs in `data/` are made up; reports from them carry a "Sample input" banner.

### Templates

After editing `ai/templates/\\\*.yaml`, run `npm run templates`.

