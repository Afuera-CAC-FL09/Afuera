import type { HourRisk } from "@afuera/engine";
import type { ReactNode } from "react";
import { View } from "react-native";
import Svg, { Path, Polygon, Text as SvgText } from "react-native-svg";
import { color, font, risk, unknownRisk } from "@/theme";

interface Props {
  /** The 12 hours on the face, by clock position (0 = 12 o'clock, 1 = 1 o'clock, …). */
  slots: (HourRisk | null)[];
  /** Best window as clock positions (fractional hours), drawn as an outer line. */
  best: { from: number; to: number } | null;
  /** "Now" as a clock position, drawn as a pointer; null if it isn't on this face. */
  now: number | null;
  label: string;
  children?: ReactNode;
  size?: number;
}

const deg = (pos: number) => (pos / 12) * 360 - 90;
const point = (c: number, r: number, angle: number) => {
  const a = (angle * Math.PI) / 180;
  return { x: c + r * Math.cos(a), y: c + r * Math.sin(a) };
};

function arc(c: number, r: number, from: number, to: number) {
  const a = point(c, r, from);
  const b = point(c, r, to);
  const large = to - from > 180 ? 1 : 0;
  return `M ${a.x} ${a.y} A ${r} ${r} 0 ${large} 1 ${b.x} ${b.y}`;
}

/** A clock face: each slice is one hour colored by heat level (design S2). */
export function ClockDial({ slots, best, now, label, children, size = 350 }: Props) {
  const c = size / 2;
  const ring = c - 25; // 150 at 350
  const thick = size * 0.097; // 34 at 350
  const outer = c - 3; // 172 at 350
  const tip = c - ring - thick / 2 - 2;

  return (
    <View style={{ width: size, height: size, alignSelf: "center" }} accessible accessibilityRole="image" accessibilityLabel={label}>
      <Svg width={size} height={size}>
        {slots.map((h, pos) => (
          <Path
            key={pos}
            d={arc(c, ring, deg(pos) + 1, deg(pos + 1) - 1)}
            stroke={h?.level ? risk[h.level].fill : h ? unknownRisk.fill : color.sky}
            strokeWidth={thick}
            fill="none"
          />
        ))}
        {best && <Path d={arc(c, outer, deg(best.from), deg(best.to))} stroke={color.ink} strokeWidth={5} strokeLinecap="round" fill="none" />}
        {now !== null && (
          <Polygon points={`${c},${tip} ${c - 9},${tip + 18} ${c + 9},${tip + 18}`} fill={color.ink} transform={`rotate(${(now / 12) * 360} ${c} ${c})`} />
        )}
        {[0, 3, 6, 9].map((pos) => {
          const p = point(c, ring, deg(pos));
          return (
            <SvgText key={pos} x={p.x} y={p.y + 5} textAnchor="middle" fontFamily={font.displaySemi} fontSize={13} fill={slots[pos]?.level === "extreme" ? "#FFFFFF" : color.ink}>
              {pos === 0 ? "12" : String(pos)}
            </SvgText>
          );
        })}
      </Svg>
      <View style={{ position: "absolute", left: size * 0.186, top: size * 0.25, width: size * 0.63, alignItems: "center", gap: 6 }}>{children}</View>
    </View>
  );
}
