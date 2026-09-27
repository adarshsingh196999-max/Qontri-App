import React from "react";
import Svg, {
  Rect,
  Path,
  Circle,
  Line,
  G,
  Defs,
  ClipPath,
} from "react-native-svg";

type Props = {
  width?: number;
  height?: number;
};

/**
 * Flat illustration for the Business tab empty state.
 * Briefcase + boarding pass + receipt, in Qontri brand colors.
 */
export default function BusinessEmptyIllustration({
  width = 200,
  height = 200,
}: Props) {
  const NAVY = "#1E3A5F";
  const BLUE = "#4A90D9";
  const LIGHT_BLUE = "#A7C7E7";
  const OFF_WHITE = "#F4F6F9";
  const SLATE = "#64748B";

  return (
    <Svg width={width} height={height} viewBox="0 0 400 400" fill="none">
      {/* Airplane icon (top-right) */}
      <G transform="translate(300, 60) rotate(20)">
        <Path
          d="M0 0 L22 8 L14 16 L4 14 L-2 20 L-4 12 L-10 8 L-2 4 Z"
          fill={BLUE}
        />
      </G>

      {/* Boarding pass (top-left, rotated) */}
      <G transform="translate(60, 100) rotate(-15)">
        <Rect
          x="0"
          y="0"
          width="160"
          height="70"
          rx="10"
          fill={OFF_WHITE}
          stroke={BLUE}
          strokeWidth="2"
        />
        {/* Left tab */}
        <Rect x="0" y="0" width="18" height="70" rx="10" fill={BLUE} />
        <Rect x="12" y="0" width="8" height="70" fill={OFF_WHITE} />
        {/* Detail lines */}
        <Line x1="40" y1="24" x2="130" y2="24" stroke={NAVY} strokeWidth="3" strokeLinecap="round" />
        <Line x1="40" y1="42" x2="100" y2="42" stroke={SLATE} strokeWidth="2" strokeLinecap="round" />
        <Circle cx="140" cy="55" r="5" fill="none" stroke={SLATE} strokeWidth="1.5" />
      </G>

      {/* Receipt (bottom-right, partially behind briefcase) */}
      <G transform="translate(240, 180) rotate(8)">
        <Path
          d="M0 0 L90 0 L90 130 L80 120 L70 130 L60 120 L50 130 L40 120 L30 130 L20 120 L10 130 L0 120 Z"
          fill={OFF_WHITE}
          stroke={BLUE}
          strokeWidth="2"
        />
        {/* Detail lines */}
        <Line x1="16" y1="40" x2="74" y2="40" stroke={NAVY} strokeWidth="3" strokeLinecap="round" />
        <Line x1="16" y1="60" x2="60" y2="60" stroke={SLATE} strokeWidth="2" strokeLinecap="round" />
        <Line x1="16" y1="76" x2="70" y2="76" stroke={SLATE} strokeWidth="2" strokeLinecap="round" />
      </G>

      {/* Briefcase (center, front) */}
      <G transform="translate(100, 130)">
        {/* Handle */}
        <Path
          d="M55 0 L55 -10 C55 -22 65 -30 75 -30 L85 -30 C95 -30 105 -22 105 -10 L105 0"
          fill="none"
          stroke={NAVY}
          strokeWidth="8"
          strokeLinecap="round"
        />
        {/* Main body */}
        <Rect
          x="0"
          y="0"
          width="160"
          height="140"
          rx="16"
          fill={NAVY}
        />
        {/* Blue stripe */}
        <Rect x="0" y="55" width="160" height="24" fill={BLUE} />
        {/* Latches (white circles on the stripe) */}
        <Circle cx="40" cy="67" r="5" fill={OFF_WHITE} />
        <Circle cx="120" cy="67" r="5" fill={OFF_WHITE} />
        {/* Front pocket outline */}
        <Rect
          x="34"
          y="96"
          width="92"
          height="32"
          rx="6"
          fill="none"
          stroke={LIGHT_BLUE}
          strokeWidth="2"
        />
        {/* Pocket detail lines */}
        <Line x1="48" y1="110" x2="94" y2="110" stroke={LIGHT_BLUE} strokeWidth="2" strokeLinecap="round" />
        <Line x1="48" y1="118" x2="80" y2="118" stroke={LIGHT_BLUE} strokeWidth="2" strokeLinecap="round" />
      </G>
    </Svg>
  );
}