import type { RiskLevel } from "@afuera/engine";

// Live mode is dark so it reads outside at dusk.

export const color = {
  bg: "#FFFFFF",
  ink: "#2B2F36",
  muted: "#555D68",
  link: "#8A5A00", // icons and links; hover/pressed #6B4500
  linkPressed: "#6B4500",
  amber: "#F5A623", // the main action
  amberTint: "#FDEBC8",
  amberInk: "#6B4500",
  sky: "#E6F1FA",
  skyDeep: "#CFE3F3",
  line: "#C9DDEE",
} as const;

/** Live mode. */
export const dark = {
  bg: "#1E2228",
  card: "#2B2F36",
  raised: "#3A4049",
  divider: "#2E343C",
  outline: "#4A515B",
  text: "#F3F6F9",
  soft: "#D3D9E0",
  muted: "#AEB7C2",
} as const;

export type Shape = "circle" | "square" | "diamond" | "octagon";

/** Every level is a color, a shape and a word, so it never depends on color alone. */
export const risk: Record<RiskLevel, { fill: string; ink: string; shape: Shape; legendBorder?: string }> = {
  lower: { fill: "#CFE3F3", ink: "#2B2F36", shape: "circle", legendBorder: "#9DBFDC" },
  elevated: { fill: "#FDEBC8", ink: "#2B2F36", shape: "square", legendBorder: "#E8C88A" },
  high: { fill: "#F5A623", ink: "#2B2F36", shape: "diamond" },
  extreme: { fill: "#2B2F36", ink: "#FFFFFF", shape: "octagon" },
};

export const unknownRisk = { fill: "#E6F1FA", ink: "#555D68", shape: "circle" as Shape };

export const font = {
  displayLight: "SpaceGrotesk_300Light",
  display: "SpaceGrotesk_400Regular",
  displayMedium: "SpaceGrotesk_500Medium",
  displaySemi: "SpaceGrotesk_600SemiBold",
  body: "PlusJakartaSans_400Regular",
  bodyMedium: "PlusJakartaSans_500Medium",
  bodySemi: "PlusJakartaSans_600SemiBold",
  bodyBold: "PlusJakartaSans_700Bold",
} as const;

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24, xxxl: 32 } as const;

export const radius = { chip: 8, button: 14, card: 20, section: 24, sheet: 28, cta: 18, pill: 999 } as const;

export const type = {
  hero: { fontFamily: font.displayMedium, fontSize: 42, lineHeight: 44, letterSpacing: -1 },
  title: { fontFamily: font.displayMedium, fontSize: 32, lineHeight: 35, letterSpacing: -0.5 },
  heading: { fontFamily: font.displaySemi, fontSize: 18, lineHeight: 23 },
  place: { fontFamily: font.displaySemi, fontSize: 22, lineHeight: 24 },
  stat: { fontFamily: font.display, fontSize: 32, lineHeight: 34 },
  body: { fontFamily: font.body, fontSize: 15, lineHeight: 22 },
  bodyBold: { fontFamily: font.bodyBold, fontSize: 15, lineHeight: 22 },
  small: { fontFamily: font.body, fontSize: 13, lineHeight: 18 },
  smallBold: { fontFamily: font.bodyBold, fontSize: 13, lineHeight: 18 },
  caption: { fontFamily: font.body, fontSize: 12, lineHeight: 18 },
  button: { fontFamily: font.bodyBold, fontSize: 17, lineHeight: 22 },
};
