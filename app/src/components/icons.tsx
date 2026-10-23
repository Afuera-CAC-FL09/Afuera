import type { ColorValue } from "react-native";
import Svg, { Circle, Path, Rect } from "react-native-svg";
import { color as palette, type Shape } from "@/theme";

interface IconProps {
  size?: number;
  color?: ColorValue;
}

const line = (c: ColorValue, width = 2) => ({ stroke: c, strokeWidth: width, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, fill: "none" });

export function PinIcon({ size = 22, color = palette.link }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21z" {...line(color)} />
      <Circle cx={12} cy={9.5} r={2.5} {...line(color)} />
    </Svg>
  );
}

export function BackIcon({ size = 22, color = palette.ink }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="M15 5l-7 7 7 7" {...line(color)} />
    </Svg>
  );
}

export function SunIcon({ size = 20, color = palette.ink }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Circle cx={12} cy={12} r={4} {...line(color)} />
      <Path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" {...line(color)} />
    </Svg>
  );
}

export function ClockIcon({ size = 20, color = palette.ink }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Circle cx={12} cy={12} r={9} {...line(color)} />
      <Path d="M12 7v5l3 2" {...line(color)} />
    </Svg>
  );
}

export function PulseIcon({ size = 20, color = palette.ink }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="M3 12h4l3-7 4 14 3-7h4" {...line(color)} />
    </Svg>
  );
}

export function SparkleIcon({ size = 18, color = palette.link }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5L18 18M6 18l2.5-2.5M15.5 8.5L18 6" {...line(color)} />
    </Svg>
  );
}

export function PlayIcon({ size = 18, color = palette.ink }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="M7 5l12 7-12 7z" {...line(color)} />
    </Svg>
  );
}

export function ShareIcon({ size = 18, color = palette.ink }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Circle cx={18} cy={5} r={2.5} {...line(color)} />
      <Circle cx={6} cy={12} r={2.5} {...line(color)} />
      <Circle cx={18} cy={19} r={2.5} {...line(color)} />
      <Path d="M8.2 10.9l7.6-4.6M8.2 13.1l7.6 4.6" {...line(color)} />
    </Svg>
  );
}

export function BoltIcon({ size = 16, color = palette.ink, width = 2 }: IconProps & { width?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="M13 3L6 13h5l-1 8 7-10h-5z" {...line(color, width)} />
    </Svg>
  );
}

export function DropIcon({ size = 18, color = palette.ink, width = 2 }: IconProps & { width?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11z" {...line(color, width)} />
    </Svg>
  );
}

export function ShadeIcon({ size = 18, color = palette.ink }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="M3 11l9-6 9 6" {...line(color)} />
      <Path d="M6 10v9M18 10v9" {...line(color)} />
    </Svg>
  );
}

export function CheckIcon({ size = 18, color = palette.ink }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="M5 12l5 5 9-10" {...line(color, 2.2)} />
    </Svg>
  );
}

export function CopyIcon({ size = 18, color = palette.ink }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Rect x={8} y={8} width={12} height={12} rx={2} {...line(color)} />
      <Path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3" {...line(color)} />
    </Svg>
  );
}

export function StopIcon({ size = 14, color = "#F3F6F9" }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Rect x={5} y={5} width={14} height={14} rx={2} fill={color} />
    </Svg>
  );
}

export function ChatIcon({ size = 20, color = palette.ink }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="M4 5.5A2.5 2.5 0 0 1 6.5 3h11A2.5 2.5 0 0 1 20 5.5v8a2.5 2.5 0 0 1-2.5 2.5H10l-4.5 4v-4H6.5A2.5 2.5 0 0 1 4 13.5z" {...line(color)} />
    </Svg>
  );
}

/** The shape that goes with each heat level. */
export function ShapeIcon({ shape, size = 16, color = palette.ink }: IconProps & { shape: Shape }) {
  const stroke = { stroke: color, strokeWidth: 4, strokeLinejoin: "round" as const, fill: "none" };
  return (
    <Svg width={size} height={size} viewBox="0 0 34 34">
      {shape === "circle" && <Circle cx={17} cy={17} r={13} {...stroke} strokeWidth={5} />}
      {shape === "square" && <Rect x={5} y={5} width={24} height={24} rx={2} {...stroke} />}
      {shape === "diamond" && <Path d="M17 3 L31 17 L17 31 L3 17 Z" {...stroke} />}
      {shape === "octagon" && <Path d="M11 3 H23 L31 11 V23 L23 31 H11 L3 23 V11 Z" {...stroke} />}
    </Svg>
  );
}

export function GearIcon({ size = 20, color = palette.ink }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="M4 6h9M17 6h3M4 12h3M11 12h9M4 18h11M19 18h1" {...line(color)} />
      <Circle cx={15} cy={6} r={2} {...line(color)} />
      <Circle cx={9} cy={12} r={2} {...line(color)} />
      <Circle cx={17} cy={18} r={2} {...line(color)} />
    </Svg>
  );
}

export function MegaphoneIcon({ size = 20, color = palette.ink }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="M3 10v4a1 1 0 0 0 1 1h3l6 4V5L7 9H4a1 1 0 0 0-1 1z" {...line(color)} />
      <Path d="M17 9a4 4 0 0 1 0 6M7 15l1 5" {...line(color)} />
    </Svg>
  );
}

export function InfoIcon({ size = 20, color = palette.ink }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Circle cx={12} cy={12} r={9} {...line(color)} />
      <Path d="M12 11v5M12 8h.01" {...line(color)} />
    </Svg>
  );
}
