# Afuera app

The Expo (React Native) app. See the [main README](../README.md) for how to install, run and build it.

## App art

The icon, splash and favicon in `assets/images/` are plain placeholders (a sun on Afuera teal). Replace each file with the real art at the same name and size, and `app.json` picks it up:

| File | Size | Used for |
|---|---|---|
| `icon.png` | 1024×1024, no transparency | App icon (iPhone and Android) |
| `android-icon-foreground.png` | 512×512, transparent, art inside the middle 66% | Android adaptive icon, front layer |
| `android-icon-background.png` | 512×512 | Android adaptive icon, back layer |
| `android-icon-monochrome.png` | 432×432, white on transparent | Android themed icon |
| `splash-icon.png` | 200×200, transparent | Splash screen (shown on `#FBF6EE`) |
| `favicon.png` | 48×48 | Web build |
