import React, { useId } from 'react';
import Svg, { Defs, LinearGradient, Path, Stop } from 'react-native-svg';

interface BalakaLogoProps {
  size?: number;
}

/**
 * Vector SVG reproduction of the official Balaka two-tone speech-bubble "B" monogram.
 * Upper blue lobe represents quick speech & Alias; lower warm orange bubble represents party vibe.
 */
export function BalakaLogo({ size = 32 }: BalakaLogoProps) {
  const rawId = useId();
  const uid = rawId.replace(/[^a-zA-Z0-9_-]/g, '');
  const upperGradId = `balakaUpperBlue_${uid}`;
  const lowerGradId = `balakaLowerOrange_${uid}`;
  const overlapGradId = `balakaOverlapRed_${uid}`;

  return (
    <Svg width={size} height={size} viewBox="0 0 100 100" fill="none">
      <Defs>
        <LinearGradient id={upperGradId} x1="14" y1="8" x2="72" y2="52" gradientUnits="userSpaceOnUse">
          <Stop offset="0%" stopColor="#3B9BFF" />
          <Stop offset="100%" stopColor="#1D6FF2" />
        </LinearGradient>
        <LinearGradient id={lowerGradId} x1="18" y1="42" x2="88" y2="88" gradientUnits="userSpaceOnUse">
          <Stop offset="0%" stopColor="#FF7530" />
          <Stop offset="100%" stopColor="#EA580C" />
        </LinearGradient>
        <LinearGradient id={overlapGradId} x1="20" y1="44" x2="74" y2="56" gradientUnits="userSpaceOnUse">
          <Stop offset="0%" stopColor="#D93B14" />
          <Stop offset="100%" stopColor="#EB4D18" />
        </LinearGradient>
      </Defs>

      {/* Upper Blue Lobe + Top Vertical Spine */}
      <Path
        d="M 18 50 L 18 22 C 18 14 23 10 31 10 L 53 10 C 70 10 80 18.5 80 30.5 C 80 41.5 70 50 53 50 Z"
        fill={`url(#${upperGradId})`}
      />

      {/* Lower Orange Lobe + Speech Bubble Tail */}
      <Path
        d="M 18 42 L 56 42 C 74 42 86 51.5 86 64.5 C 86 78 73.5 87 54.5 87 L 34 87 L 19 96 C 17 97.2 15.5 95.8 16.2 93.4 L 20.5 79.5 C 18.5 76.5 18 72.8 18 68 Z"
        fill={`url(#${lowerGradId})`}
      />

      {/* Dynamic Crimson Overlap Ribbon */}
      <Path
        d="M 18 42 L 56 42 C 66.5 42 74.5 45.2 79 50 L 18 50 Z"
        fill={`url(#${overlapGradId})`}
      />

      {/* Upper "B" Counter */}
      <Path
        d="M 35 23 L 49 23 C 56 23 60.5 26 60.5 30.5 C 60.5 35 56 38 49 38 L 35 38 Z"
        fill="#07070C"
      />

      {/* Lower "B" Counter */}
      <Path
        d="M 35 56 L 51.5 56 C 59 56 64 59.5 64 64.5 C 64 69.5 59 73 51.5 73 L 35 73 Z"
        fill="#07070C"
      />
    </Svg>
  );
}
