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
import { ArrowRight } from 'lucide-react-native';
import { COLORS, RADIUS, SPACING } from '@/constants/theme';
import { GameWorldArtwork } from '@/components/graphics/KoloArtwork';
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
            <View pointerEvents="none" style={styles.svgArtworkPos}>
              <GameWorldArtwork gameId="alias" size={114} />
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
                <ArrowRight
                  size={14}
                  color={COLORS.textPrimary}
                  strokeWidth={2.6}
                />
              </View>
            </View>
          </TouchableOpacity>

          {/* 02 / CROCODILE — GREEN / ACTION */}
          <TouchableOpacity
            activeOpacity={0.88}
            onPress={() => handleSelectGame('crocodile')}
            style={[styles.gameWorldCard, styles.crocodileWorld]}
          >
            <View pointerEvents="none" style={styles.svgArtworkPos}>
              <GameWorldArtwork gameId="crocodile" size={114} />
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
                <ArrowRight
                  size={14}
                  color={COLORS.background}
                  strokeWidth={2.6}
                />
              </View>
            </View>
          </TouchableOpacity>

          {/* 03 / SPY — RED / SECRET */}
          <TouchableOpacity
            activeOpacity={0.88}
            onPress={() => handleSelectGame('spy')}
            style={[styles.gameWorldCard, styles.spyWorld]}
          >
            <View pointerEvents="none" style={styles.svgArtworkPos}>
              <GameWorldArtwork gameId="spy" size={114} />
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
                <ArrowRight
                  size={14}
                  color={COLORS.textPrimary}
                  strokeWidth={2.6}
                />
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
  svgArtworkPos: {
    position: 'absolute',
    right: 10,
    top: 28,
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
    maxWidth: '70%',
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
});
