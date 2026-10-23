# Submission text (draft)

For Non-tech A, due Oct 23. Check each field's word limit on the CAC submission form and cut to fit. Anything in [brackets] needs a real answer from the team.

## One-sentence purpose

Afuera helps coaches, band directors and camp leaders in Central Florida keep kids safer in the heat by turning the weather forecast into the WBGT heat level Florida schools use, telling them what the FHSAA heat policy requires, and finding a lower-risk time to practice, in English and Spanish.

## Audience

Adults who run kids' outdoor activities in Florida's 9th District (Osceola and parts of Orange and Polk counties): high school band directors and coaches, youth league coaches, summer camp staff and event organizers. Many are Spanish-speaking and plan from their phones, and most don't have a WBGT meter at every practice.

## Tools and languages

- TypeScript throughout
- React Native with Expo (iPhone and Android), Expo Router, i18next for English/Spanish
- Cloudflare Workers for the AI proxy (keeps the API key off the phone)
- Claude (Anthropic) for the Ask feature
- Data: Open-Meteo forecast and geocoding, National Weather Service alerts API
- Science: Liljegren et al. (2008) WBGT model, ported from Argonne National Laboratory's C code; FHSAA Policy 41.8.3 heat levels
- Testing: Vitest (77 automated tests), original C code compiled as a reference, a real WBGT meter test

## How it works

1. **Forecast to WBGT.** The app downloads the hourly forecast (temperature, humidity, wind, sunlight, pressure) and runs the Liljegren model, the standard way to estimate WBGT from weather data. We ported it from the original C code and checked our version against that code on 418 cases; the biggest difference was 0.02 °C. [Add the meter test result from Oct 17–18.]
2. **WBGT to action.** It sorts the WBGT into four levels using the FHSAA table and shows what the policy requires: rest breaks per hour, time limits, gear limits, or no outdoor activity. It rounds up toward caution and never calls any level "safe". If the data is more than 2 hours old, it warns you.
3. **Better time.** It searches the next 5 days for the lowest-risk window of your activity's length, skipping hours with thunderstorms or a high chance of rain.
4. **Live mode.** During practice it runs a timer and schedules the required water breaks and heat re-checks as lock-screen notifications that vibrate the phone.
5. **Ask.** Coaches can ask questions in their own words. The AI can only use our tools to look up the forecast and the rules, and our server enforces one rule: the level shown is the higher of the physics model and the AI. If the AI ever says a lower level than the physics, its answer is thrown away. The AI can add check-ins or make them more frequent but can never remove or space out a required one. If the AI is down, the app answers from the physics model alone.
6. **Share and Big event mode.** A shareable heat-check image for parents' WhatsApp groups, and a full-screen bilingual display with a water-break countdown for crowds.

## Guided questions

[Copy the official CAC guided questions here and answer each. Starting points:]

- **What inspired you?** [Personal story: a hot practice, a teammate who got sick, a parent who only speaks Spanish. Use a real one.] Plus the Osceola stat: [exact wording and source, confirmed by Non-tech A; the 44 calls cover all ages, so don't describe them as kids only].
- **What was the hardest part?** Porting a 1990s C program and proving our version gives the same answers; we compiled the original and generated hundreds of test cases from it. Also making sure an AI can't talk a coach into a riskier plan.
- **What would you add next?** [e.g. reading from a school's own WBGT meter over Bluetooth; alerts for parents; more counties' heat policies.]
- **How did you test it?** 77 automated tests, the original C code as a reference, a real WBGT meter side by side, [number] AI test scenarios reviewed by [pediatrician/teacher] with [result]% passing, and testing on [3] real phones with [coach name/program].

## AI disclosure

Build this from `AI_USE.md` once every row has been checked. Suggested shape:

> We used Claude Code (Anthropic's Claude Opus 5.5) as a coding assistant. It helped write [list, from AI_USE.md]. Every team member reviewed, tested and can explain the code in their area. The app's Ask feature uses Claude at runtime; the heat level always comes from our physics model, and our server rejects any AI answer that is less cautious than the model.

Be specific and honest; judges can ask any team member about any file.
