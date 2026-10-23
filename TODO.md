# Afuera to-do

**Deadline: Mon Oct 26, 12:00 PM ET. We submit Sun Oct 25. Code freeze Thu Oct 22.**

Put a name next to each role. Commit from your own GitHub account, and add a line to `AI_USE.md` the same day AI helps.

| Role | Name |
|---|---|
| Tech A: engine + AI | |
| Tech B: app | |
| Non-tech A: proof + people | |
| Non-tech B: design, Spanish, video | |

---

## Tech A: engine + AI

- [ ] **Oct 14–15 · WBGT model** (`engine/src/wbgt.ts`): port Liljegren (solar position, globe temp, natural wet bulb, combine). Write tests against the original C code, accurate within 0.5°C (about 1°F).
- [ ] **Oct 15 · Risk levels** (`engine/src/risk.ts`): WBGT → Lower / Elevated / High / Extreme, using the thresholds Non-tech A sends. Round toward caution. Never say "safe." Data older than 2 hours shows a warning.
- [ ] **Oct 16 · Best time** (`engine/src/window.ts`): find the lowest-risk window of the activity's length in the next 5 days, skipping high storm chances.
- [ ] **Oct 16 · Check-ins** (`engine/src/checkins.ts` and `ai/templates/*.yaml`): required and optional check-ins for band, team, camp and event. The AI can add check-ins or make them more often. It can never remove required ones or space them out.
- [ ] **Oct 17 · AI proxy** (`proxy/src/`): an `/ask` endpoint with 4 tools: `get_risk`, `find_best_window`, `get_checkins`, `get_alerts`.
  - [ ] Safety rule on the server: `final = max(physics, ai)`
  - [ ] API key stored as a secret
  - [ ] Rate limit and spending cap
  - [ ] Basic mode if the AI is down
- [ ] **Oct 18 · System prompt** (`ai/prompts/`): replies in the user's language. A medical question gets the activity plan plus "check with their doctor."
- [ ] **Oct 19–20 · AI tests** (`ai/evals/`): 30–50 scenarios reviewed by the pediatrician or teacher. Target: 95% or better pass.
- [ ] **Oct 20 · Demo data** (`data/demo/`): save a real July 2026 day from the Open-Meteo archive.

## Tech B: app

- [ ] **Oct 14 · Setup:** create the Expo app in `app/` (TypeScript, Expo Router). Add English/Spanish with i18next and expo-localization.
- [ ] **Oct 15 · Data:**
  - [ ] Open-Meteo client: temperature, humidity, wind, solar radiation (shortwave, direct, diffuse), cloud cover, storm chance
  - [ ] NWS alerts client (needs a User-Agent header)
  - [ ] Offline cache with timestamps
- [ ] **Oct 15–16 · First-run setup:** language, activity, place (search or GPS).
- [ ] **Oct 16 · Today:** all 4 risk levels, old-data banner, storm alert.
- [ ] **Oct 17 · Better time:** clock dial and day chips.
- [ ] **Oct 17–18 · Live:**
  - [ ] Timer and check-in list
  - [ ] Notifications and vibration (expo-notifications, expo-haptics)
  - [ ] Lock-screen alert
- [ ] **Oct 18 · Why:** sliders running the real engine.
- [ ] **Oct 19 · Share card:** react-native-view-shot and expo-sharing. Test it in WhatsApp.
- [ ] **Oct 19 · Ask:** chat screen connected to the proxy.
- [ ] **Oct 20 · More screens:** Big event mode, demo-mode toggle, settings (language, heat policy, credits).
- [ ] **Oct 21 · Builds and testing:**
  - [ ] Android APK and iPhone build
  - [ ] Test on 3 real phones
  - [ ] Today loads in under 1 second

## Non-tech A: proof + people

- [ ] **Today · Registration:** register the team on the CAC site. Confirm at least half the team is in FL-09.
- [ ] **Today · The hero:** lock in the program (a band director or coach, Spanish-speaking if possible) and get a yes for filming.
- [ ] **Today · Consent:** send parent consent forms for filming minors. Due back by Oct 17.
- [ ] **Oct 15 · Thresholds:** find the heat policy WBGT ranges (FHSAA or school district), save the source link, and send both to Tech A.
- [ ] **Oct 15 · Meter:** book a WBGT meter (ask the school's athletic trainer) for a side-by-side test on Oct 17 or 18.
- [ ] **Oct 16 · Pediatrician:** contact Wexford Pediatrics to review the risk wording and the AI test scenarios by Oct 20, and ask for one line on camera.
- [ ] **Oct 16 · The stat:** double-check the Osceola stat wording. The 44 calls cover all ages.
- [ ] **Oct 23 · Submission text:**
  - [ ] One-sentence purpose
  - [ ] Audience
  - [ ] Tools and languages
  - [ ] How it works
  - [ ] Guided questions
  - [ ] AI disclosure (from `AI_USE.md`)

## Non-tech B: design, Spanish, video

- [ ] **Oct 14–15 · Missing mockups:** first-run setup, Ask chat, Big event in the new style, demo-mode toggle.
- [ ] **Oct 15–19 · Spanish:** a native speaker checks every line of Spanish in the app.
- [ ] **Oct 16 · Script:** video script and shot list (3 min max, aim for about 2:00).
- [ ] **Oct 17–18 · Filming:**
  - [ ] Real practice
  - [ ] Coach using the app in Spanish
  - [ ] Meter vs. phone
  - [ ] Kids drinking water (only kids with consent forms)
- [ ] **Oct 22–24 · Edit:** burn in English subtitles and record the voiceover.
- [ ] **Oct 24 · Visuals:** app icon and 4 store-style screenshots.

## Everyone

- [ ] **Oct 22 · Code freeze:** bug fixes only after this.
- [ ] **Oct 23 · Mock Q&A:** each person explains every file they wrote, as if a judge asked.
- [ ] **Oct 25 · Submit.**

---

## Status, Oct 14 (AI-assisted; see `AI_USE.md`)

Code written and passing tests (77). **Owners: review, run and be able to explain each piece before ticking it above.**

**Tech A**
- WBGT, risk, best time, check-ins: done. Port matches Argonne's C within 0.02 °C on 418 cases (`tools/wbgt-oracle/README.md`). Thresholds are FHSAA Policy 41.8.3 from the 2025-26 Handbook; Non-tech A should confirm that's the policy we want.
- AI proxy: done (`/ask`, 4 tools + `final_answer`, `final = max(physics, ai)`, key as a secret, per-phone rate limit, daily $ cap, basic mode). Not yet run against the real API: needs a key in `proxy/.dev.vars`.
- System prompt: done. 40 AI test scenarios + runner: done; **not run yet, and not reviewed by the pediatrician/teacher**.
- Demo data: done (Kissimmee, July 15 2026, which hits all four levels).
- Watch at the meter test: when forecast wind is near calm, the model can read very high (seen in July reanalysis data). Note still-air readings on Oct 17–18.

**Tech B**
- App built: setup, Today (4 levels, old-data banner, storm/NWS alerts), Better time (clock dial, day chips), Live (timer, check-ins, notifications, vibration, lock-screen), Why (sliders on the real engine), Share card, Ask, Big event, demo toggle, settings (language, heat policy, credits). Checked in the browser in both languages.
- Not done: test on real phones, WhatsApp share test, APK/iPhone builds (`app/eas.json` is ready), timing "Today in under 1 second" on a phone. Fill `proxyUrl` and `nwsContact` in `app/app.json`.
- Open-Meteo direct/diffuse radiation isn't fetched: the Liljegren model only uses total sunlight.

**Non-tech A**: drafts in `docs/outreach.md` (hero, trainer/meter, pediatrician), `docs/consent-form.md` (EN/ES), `docs/submission.md`. Registration, sending, the Osceola stat source: still to do.

**Non-tech B**: script and shot list in `docs/video-script.md`. Spanish in `app/src/i18n/es.ts` and `ai/templates/*.yaml` is a first draft and needs a native speaker. Mockups, filming, edit, icon, screenshots: still to do (`app/assets` still has the Expo placeholder icon).
