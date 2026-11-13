import React from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { ArrowRight, ArrowUp, EyeOff, Zap } from 'lucide-react-native';
import { COLORS, RADIUS, SPACING } from '@/constants/theme';
import { GameType } from '@/types';

export default function GamesScreen() {
  const router = useRouter();

  const handleSelectGame = (gameType: GameType) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push(`/setup/game?id=${gameType}`);
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Text style={styles.overline}>ТРИ ІГРОВІ СВІТИ</Text>
          <Text style={styles.headline}>Ігри</Text>
        </View>

        <View style={styles.list}>
          {/* 01 / ALIAS — BLUE / SPEED */}
          <TouchableOpacity
            activeOpacity={0.88}
            onPress={() => handleSelectGame('alias')}
            style={[styles.gameWorldCard, styles.aliasWorld]}
          >
            {/* Visual Graphic: Flying Card Stack & Speed Arrows */}
            <View pointerEvents="none" style={styles.aliasGraphicStage}>
              <View style={styles.aliasGhostCardBack} />
              <View style={styles.aliasGhostCardFront}>
                <ArrowUp size={16} color={COLORS.alias} strokeWidth={3} />
                <Text style={styles.aliasGhostWord}>СЛОВО</Text>
                <Text style={styles.aliasGhostPlus}>+1</Text>
              </View>
            </View>

            <View style={styles.worldTopRow}>
              <Text style={[styles.worldCode, { color: COLORS.alias }]}>
                BLUE / SPEED
              </Text>
              <Text style={styles.worldNumber}>01</Text>
            </View>

            <View style={styles.worldBody}>
              <Text style={styles.worldTitle}>ЕЛІАС</Text>
              <Text style={styles.worldTagline}>
                Пояснюй слова на шаленій швидкості, поки тікає таймер.
              </Text>
            </View>

            <View style={styles.worldFooter}>
              <Text style={styles.worldMeta}>4–16 гравців · 30–90 сек</Text>
              <View style={[styles.playPill, { backgroundColor: COLORS.alias }]}>
                <Text style={styles.playPillText}>ГРАТИ</Text>
                <ArrowRight size={14} color={COLORS.textPrimary} strokeWidth={2.6} />
              </View>
            </View>
          </TouchableOpacity>

          {/* 02 / CROCODILE — GREEN / ACTION */}
          <TouchableOpacity
            activeOpacity={0.88}
            onPress={() => handleSelectGame('crocodile')}
            style={[styles.gameWorldCard, styles.crocodileWorld]}
          >
            {/* Visual Graphic: Kinetic Action Frames */}
            <View pointerEvents="none" style={styles.crocGraphicStage}>
              <View style={[styles.crocFrame, styles.crocFrame1]} />
              <View style={[styles.crocFrame, styles.crocFrame2]} />
              <View style={[styles.crocFrame, styles.crocFrame3]}>
                <Zap size={18} color={COLORS.background} fill={COLORS.background} />
              </View>
            </View>

            <View style={styles.worldTopRow}>
              <Text style={[styles.worldCode, { color: COLORS.crocodile }]}>
                GREEN / ACTION
              </Text>
              <Text style={styles.worldNumber}>02</Text>
            </View>

            <View style={styles.worldBody}>
              <Text style={styles.worldTitle}>КРОКОДИЛ</Text>
              <Text style={styles.worldTagline}>
                Жодних слів. Тільки тіло, жести, міміка та сміх на всю кімнату.
              </Text>
            </View>

            <View style={styles.worldFooter}>
              <Text style={styles.worldMeta}>3–16 гравців · 60–120 сек</Text>
              <View
                style={[styles.playPill, { backgroundColor: COLORS.crocodile }]}
              >
                <Text style={[styles.playPillText, { color: COLORS.background }]}>
                  ГРАТИ
                </Text>
                <ArrowRight size={14} color={COLORS.background} strokeWidth={2.6} />
              </View>
            </View>
          </TouchableOpacity>

          {/* 03 / SPY — RED / SECRET */}
          <TouchableOpacity
            activeOpacity={0.88}
            onPress={() => handleSelectGame('spy')}
            style={[styles.gameWorldCard, styles.spyWorld]}
          >
            {/* Visual Graphic: Secret Target Radar & Classified Stamp */}
            <View pointerEvents="none" style={styles.spyGraphicStage}>
              <View style={styles.spyRadarOuter}>
                <View style={styles.spyRadarInner}>
                  <EyeOff size={16} color={COLORS.spy} />
                </View>
              </View>
            </View>

            <View style={styles.worldTopRow}>
              <Text style={[styles.worldCode, { color: COLORS.spy }]}>
                RED / SECRET
              </Text>
              <Text style={styles.worldNumber}>03</Text>
            </View>

            <View style={styles.worldBody}>
              <Text style={styles.worldTitle}>ШПИГУН</Text>
              <Text style={styles.worldTagline}>
                Приховані ролі, підозри та блеф. Один за столом не знає, де ви.
              </Text>
            </View>

            <View style={styles.worldFooter}>
              <Text style={styles.worldMeta}>3–12 гравців · 3–7 хв</Text>
              <View style={[styles.playPill, { backgroundColor: COLORS.spy }]}>
                <Text style={styles.playPillText}>ГРАТИ</Text>
                <ArrowRight size={14} color={COLORS.textPrimary} strokeWidth={2.6} />
              </View>
            </View>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  container: {
    flex: 1,
  },
  content: {
    paddingHorizontal: SPACING.xl,
    paddingTop: SPACING.md,
    paddingBottom: SPACING.xxxl,
  },
  header: {
    marginBottom: SPACING.lg,
    gap: 2,
  },
  overline: {
    color: COLORS.textMuted,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.8,
  },
  headline: {
    color: COLORS.textPrimary,
    fontSize: 32,
    fontWeight: '800',
    letterSpacing: -1,
  },
  list: {
    gap: 14,
  },
  gameWorldCard: {
    borderRadius: RADIUS.xl,
    padding: SPACING.xl,
    minHeight: 205,
    justifyContent: 'space-between',
    overflow: 'hidden',
    position: 'relative',
  },
  aliasWorld: {
    backgroundColor: '#131B2E',
  },
  crocodileWorld: {
    backgroundColor: '#11221C',
  },
  spyWorld: {
    backgroundColor: '#211117',
  },

  worldTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  worldCode: {
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1.6,
  },
  worldNumber: {
    color: 'rgba(245, 245, 247, 0.25)',
    fontSize: 16,
    fontWeight: '900',
    fontVariant: ['tabular-nums'],
  },
  worldBody: {
    marginVertical: SPACING.md,
    maxWidth: '72%',
    gap: 6,
  },
  worldTitle: {
    color: COLORS.textPrimary,
    fontSize: 32,
    fontWeight: '900',
    letterSpacing: -1,
  },
  worldTagline: {
    color: COLORS.textSecondary,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '500',
  },
  worldFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  worldMeta: {
    color: COLORS.textSecondary,
    fontSize: 12,
    fontWeight: '600',
  },
  playPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: RADIUS.full,
  },
  playPillText: {
    color: COLORS.textPrimary,
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0.8,
  },

  // 01 Alias Graphic Stage
  aliasGraphicStage: {
    position: 'absolute',
    right: 16,
    top: 38,
    width: 86,
    height: 100,
    alignItems: 'center',
    justifyContent: 'center',
  },
  aliasGhostCardBack: {
    position: 'absolute',
    width: 72,
    height: 88,
    borderRadius: RADIUS.md,
    backgroundColor: 'rgba(59, 130, 246, 0.16)',
    transform: [{ rotate: '10deg' }, { translateX: 8 }],
  },
  aliasGhostCardFront: {
    width: 74,
    height: 90,
    borderRadius: RADIUS.md,
    backgroundColor: 'rgba(59, 130, 246, 0.26)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    transform: [{ rotate: '-6deg' }],
  },
  aliasGhostWord: {
    color: COLORS.textPrimary,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1,
  },
  aliasGhostPlus: {
    color: COLORS.crocodile,
    fontSize: 12,
    fontWeight: '900',
  },

  // 02 Crocodile Graphic Stage
  crocGraphicStage: {
    position: 'absolute',
    right: 18,
    top: 42,
    width: 86,
    height: 90,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'flex-end',
    gap: 6,
  },
  crocFrame: {
    borderRadius: RADIUS.sm,
  },
  crocFrame1: {
    width: 18,
    height: 42,
    backgroundColor: 'rgba(16, 185, 129, 0.18)',
  },
  crocFrame2: {
    width: 22,
    height: 62,
    backgroundColor: 'rgba(16, 185, 129, 0.34)',
  },
  crocFrame3: {
    width: 30,
    height: 82,
    backgroundColor: COLORS.crocodile,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // 03 Spy Graphic Stage
  spyGraphicStage: {
    position: 'absolute',
    right: 16,
    top: 38,
    width: 92,
    height: 92,
    alignItems: 'center',
    justifyContent: 'center',
  },
  spyRadarOuter: {
    width: 86,
    height: 86,
    borderRadius: 43,
    backgroundColor: 'rgba(244, 63, 94, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  spyRadarInner: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: 'rgba(244, 63, 94, 0.24)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
