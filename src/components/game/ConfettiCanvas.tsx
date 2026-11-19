import React, { useEffect } from 'react';
import { Dimensions, StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

const CONFETTI_COLORS = [
  '#F97316',
  '#10B981',
  '#3B82F6',
  '#A855F7',
  '#F43F5E',
  '#FACC15',
  '#FDBA74',
];

const PIECE_SPECS = Array.from({ length: 24 }, (_, idx) => ({
  id: idx,
  leftPct: (4 + ((idx * 17) % 92)),
  color: CONFETTI_COLORS[idx % CONFETTI_COLORS.length],
  delay: (idx % 6) * 90,
  width: 7 + (idx % 4),
  height: 11 + (idx % 5) * 2,
  driftX: ((idx % 2 === 0 ? 1 : -1) * (18 + (idx % 5) * 9)),
  spinDeg: (idx % 2 === 0 ? 1 : -1) * (240 + (idx % 3) * 120),
}));

function ConfettiParticle({
  leftPct,
  color,
  delay,
  width,
  height,
  driftX,
  spinDeg,
  travelY,
}: (typeof PIECE_SPECS)[number] & { travelY: number }) {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withDelay(
      delay,
      withTiming(1, {
        duration: 2400,
        easing: Easing.out(Easing.quad),
      })
    );
  }, [delay, progress]);

  const animStyle = useAnimatedStyle(() => {
    const p = progress.value;
    const opacity = p < 0.12 ? p / 0.12 : Math.max(0, 1 - (p - 0.55) / 0.45);
    return {
      opacity,
      transform: [
        { translateX: driftX * Math.sin(p * Math.PI * 1.5) },
        { translateY: p * travelY },
        { rotateZ: `${Math.round(p * spinDeg)}deg` },
      ],
    };
  });

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        {
          position: 'absolute',
          top: -16,
          left: `${leftPct}%` as any,
          width,
          height,
          borderRadius: 3,
          backgroundColor: color,
        },
        animStyle,
      ]}
    />
  );
}

/**
 * Lightweight Reanimated celebratory confetti burst rendered safely above final scoreboard.
 */
export function ConfettiCanvas() {
  const reducedMotion = useReducedMotion();
  const { height: screenH } = Dimensions.get('window');

  if (reducedMotion) return null;

  return (
    <View pointerEvents="none" style={styles.container}>
      {PIECE_SPECS.map((spec) => (
        <ConfettiParticle
          key={spec.id}
          {...spec}
          travelY={Math.min(460, Math.round(screenH * 0.52))}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFill,
    overflow: 'hidden',
    zIndex: 20,
  },
});
