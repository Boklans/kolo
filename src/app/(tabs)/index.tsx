import React from 'react';
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { ArrowUpRight, Play, X } from 'lucide-react-native';
import { COLORS, RADIUS, SPACING } from '@/constants/theme';
import { VibePosterArtwork } from '@/components/graphics/KoloArtwork';
import { PARTY_PRESETS } from '@/data/presets';
import { usePartyStore } from '@/stores/usePartyStore';
import { GameType, PartyPreset } from '@/types';

const GAME_NAMES: Record<GameType, string> = {
  alias: 'Еліас',
  crocodile: 'Крокодил',
  spy: 'Шпигун',
  taboo: 'Табу',
};

function formatPresetFlow(preset: PartyPreset): string {
  return preset.steps
    .map((step) => {
      if (step.gameType === 'alias' && step.roundTimeSec === 30) {
        return 'Бліц';
      }
      return GAME_NAMES[step.gameType];
    })
    .join(' → ');
}

export default function VibesScreen() {
  const router = useRouter();

  const isActive = usePartyStore((s) => s.isActive);
  const isCompleted = usePartyStore((s) => s.isCompleted);
  const presetTitle = usePartyStore((s) => s.presetTitle);
  const steps = usePartyStore((s) => s.steps);
  const currentStepIndex = usePartyStore((s) => s.currentStepIndex);
  const teams = usePartyStore((s) => s.teams);
  const currentTeamIndex = usePartyStore((s) => s.currentTeamIndex);
  const endSession = usePartyStore((s) => s.endSession);

  const handleSelectPreset = (preset: PartyPreset) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push(`/setup/preset?id=${preset.id}`);
  };

  const handleResumeParty = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.push('/session/orchestrator');
  };

  const handleResetParty = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Alert.alert(
      'Скинути поточну гру?',
      'Прогрес та бали поточної вечірки буде очищено.',
      [
        { text: 'Скасувати', style: 'cancel' },
        {
          text: 'Скинути',
          style: 'destructive',
          onPress: () => {
            endSession();
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          },
        },
      ]
    );
  };

  const activeTeamName = teams[currentTeamIndex]?.name;
  const warmupPreset =
    PARTY_PRESETS.find((p) => p.id === 'warmup') ?? PARTY_PRESETS[0];
  const uncensoredPreset =
    PARTY_PRESETS.find((p) => p.id === 'uncensored' || p.id === 'uncensored_18') ?? PARTY_PRESETS[2];
  const strangersPreset =
    PARTY_PRESETS.find((p) => p.id === 'strangers') ?? PARTY_PRESETS[1];
  const battlePreset =
    PARTY_PRESETS.find((p) => p.id === 'battle' || p.id === 'team_battle') ?? PARTY_PRESETS[3];

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Editorial Party Header */}
        <View style={styles.header}>
          <Text style={styles.overline}>KOLO · PARTY GAME SHOW</Text>
          <Text style={styles.headline}>Афіша вечора</Text>
        </View>

        {/* Unfinished Session Bar */}
        {isActive && steps.length > 0 ? (
          <View style={styles.resumeBar}>
            <TouchableOpacity
              activeOpacity={0.85}
              style={styles.resumeMainTouch}
              onPress={handleResumeParty}
            >
              <View style={styles.resumePlayCircle}>
                <Play
                  size={14}
                  color={COLORS.background}
                  fill={COLORS.background}
                />
              </View>
              <View style={styles.resumeTextCol}>
                <Text style={styles.resumeLabel}>
                  В ЕФІРІ ·{' '}
                  {isCompleted
                    ? 'ФІНАЛ'
                    : `КРОК ${Math.min(currentStepIndex + 1, steps.length)}/${steps.length}`}
                </Text>
                <Text style={styles.resumeTitle} numberOfLines={1}>
                  {presetTitle || 'Вечірка'}
                  {!isCompleted && activeTeamName ? ` — ${activeTeamName}` : ''}
                </Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              activeOpacity={0.7}
              style={styles.resumeCloseBtn}
              onPress={handleResetParty}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <X size={18} color={COLORS.textSecondary} />
            </TouchableOpacity>
          </View>
        ) : null}

        {/* 01 / РОЗІГРІВ — Big Orange Hero Poster with Custom SVG Artwork */}
        {warmupPreset ? (
          <TouchableOpacity
            activeOpacity={0.88}
            style={styles.warmupPoster}
            onPress={() => handleSelectPreset(warmupPreset)}
          >
            <View pointerEvents="none" style={styles.warmupSvgArtPos}>
              <VibePosterArtwork presetId="warmup" size={148} />
            </View>

            <View style={styles.posterTopRow}>
              <Text style={styles.warmupOverline}>01 · СТАРТ ВЕЧОРА</Text>
              <Text style={styles.warmupTimeTag}>
                {warmupPreset.durationLabel.toUpperCase()}
              </Text>
            </View>

            <View style={styles.warmupCenter}>
              <Text style={styles.warmupHeroTitle}>РОЗІГРІВ</Text>
              <Text style={styles.warmupTagline}>
                Почніть спокійно. Закінчите не скоро.
              </Text>
            </View>

            <View style={styles.warmupFooter}>
              <View style={styles.routeFlowBlock}>
                <Text style={styles.routeFlowLabel}>МАРШРУТ</Text>
                <Text style={styles.routeFlowValue}>
                  {formatPresetFlow(warmupPreset)}
                </Text>
              </View>

              <View style={styles.warmupLaunchCircle}>
                <ArrowUpRight
                  size={20}
                  color={COLORS.background}
                  strokeWidth={2.6}
                />
              </View>
            </View>
          </TouchableOpacity>
        ) : null}

        {/* 02 & 03 / Asymmetric Contrast Posters: БЕЗ ЦЕНЗУРИ 18+ & НЕЗНАЙОМЦІ */}
        <View style={styles.asymmetricRow}>
          {uncensoredPreset ? (
            <TouchableOpacity
              activeOpacity={0.88}
              style={styles.uncensoredPoster}
              onPress={() => handleSelectPreset(uncensoredPreset)}
            >
              <View pointerEvents="none" style={styles.splitSvgArtPos}>
                <VibePosterArtwork presetId="uncensored_18" size={108} />
              </View>

              <View style={styles.splitHeaderRow}>
                <Text style={styles.uncensoredBadge}>18+ · БЕЗ ФІЛЬТРІВ</Text>
                <Text style={styles.splitDurationText}>
                  {uncensoredPreset.durationLabel}
                </Text>
              </View>

              <View style={styles.splitCenterBlock}>
                <Text style={styles.uncensoredTitle}>БЕЗ ЦЕНЗУРИ</Text>
                <Text style={styles.uncensoredQuote}>
                  Тут краще не грати з батьками.
                </Text>
              </View>

              <Text style={styles.uncensoredRoute}>
                {formatPresetFlow(uncensoredPreset)}
              </Text>
            </TouchableOpacity>
          ) : null}

          {strangersPreset ? (
            <TouchableOpacity
              activeOpacity={0.88}
              style={styles.strangersPoster}
              onPress={() => handleSelectPreset(strangersPreset)}
            >
              <View pointerEvents="none" style={styles.splitSvgArtPos}>
                <VibePosterArtwork presetId="strangers" size={108} />
              </View>

              <View style={styles.splitHeaderRow}>
                <Text style={styles.strangersBadge}>ICEBREAKER</Text>
                <Text style={styles.splitDurationText}>
                  {strangersPreset.durationLabel}
                </Text>
              </View>

              <View style={styles.splitCenterBlock}>
                <Text style={styles.strangersTitle}>НЕЗНАЙОМЦІ</Text>
                <Text style={styles.strangersQuote}>
                  За 10 хвилин усі стануть своїми.
                </Text>
              </View>

              <Text style={styles.strangersRoute}>
                {formatPresetFlow(strangersPreset)}
              </Text>
            </TouchableOpacity>
          ) : null}
        </View>

        {/* 04 / БИТВА КОМАНД — Blue Tournament Show Poster with Custom Trophy SVG */}
        {battlePreset ? (
          <TouchableOpacity
            activeOpacity={0.88}
            style={styles.battlePoster}
            onPress={() => handleSelectPreset(battlePreset)}
          >
            <View pointerEvents="none" style={styles.battleSvgArtPos}>
              <VibePosterArtwork presetId="team_battle" size={140} />
            </View>

            <View style={styles.posterTopRow}>
              <Text style={styles.battleOverline}>04 · ГОЛОВНИЙ ТУРНІР</Text>
              <Text style={styles.battleDurationTag}>
                {battlePreset.durationLabel.toUpperCase()}
              </Text>
            </View>

            <View style={styles.battleMainBlock}>
              <Text style={styles.battleTitle}>БИТВА КОМАНД</Text>
              <Text style={styles.battleTagline}>
                Хто сьогодні найрозумніший?
              </Text>
            </View>

            <View style={styles.battleFooter}>
              <View style={{ flex: 1 }}>
                <Text style={styles.routeFlowLabel}>3 ЕТАПИ ТУРНІРУ</Text>
                <Text style={styles.battleRouteText}>
                  {formatPresetFlow(battlePreset)}
                </Text>
              </View>

              <View style={styles.battleActionBox}>
                <ArrowUpRight
                  size={20}
                  color={COLORS.textPrimary}
                  strokeWidth={2.5}
                />
              </View>
            </View>
          </TouchableOpacity>
        ) : null}
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
    gap: 14,
  },
  header: {
    marginBottom: 4,
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

  // Unfinished Session Bar
  resumeBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surfaceElevated,
    borderRadius: RADIUS.lg,
    paddingVertical: 12,
    paddingHorizontal: SPACING.md,
    gap: SPACING.sm,
  },
  resumeMainTouch: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
  },
  resumePlayCircle: {
    width: 34,
    height: 34,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.textPrimary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  resumeTextCol: {
    flex: 1,
    gap: 1,
  },
  resumeLabel: {
    color: COLORS.hot,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.2,
  },
  resumeTitle: {
    color: COLORS.textPrimary,
    fontSize: 15,
    fontWeight: '700',
  },
  resumeCloseBtn: {
    padding: 6,
  },

  posterTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  // 01 / РОЗІГРІВ Poster
  warmupPoster: {
    backgroundColor: '#221713',
    borderRadius: RADIUS.xl,
    padding: SPACING.xl,
    minHeight: 224,
    justifyContent: 'space-between',
    overflow: 'hidden',
    position: 'relative',
  },
  warmupSvgArtPos: {
    position: 'absolute',
    right: -12,
    top: 22,
    opacity: 0.92,
  },
  warmupOverline: {
    color: COLORS.hot,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.5,
  },
  warmupTimeTag: {
    color: COLORS.textPrimary,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
  },
  warmupCenter: {
    marginVertical: SPACING.md,
    gap: 6,
    maxWidth: '72%',
  },
  warmupHeroTitle: {
    color: COLORS.textPrimary,
    fontSize: 38,
    fontWeight: '900',
    letterSpacing: -1.3,
    lineHeight: 42,
  },
  warmupTagline: {
    color: '#E5CFC5',
    fontSize: 15,
    fontWeight: '500',
    lineHeight: 21,
  },
  warmupFooter: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    marginTop: SPACING.xs,
  },
  routeFlowBlock: {
    gap: 2,
  },
  routeFlowLabel: {
    color: COLORS.textMuted,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.3,
  },
  routeFlowValue: {
    color: COLORS.textPrimary,
    fontSize: 15,
    fontWeight: '700',
  },
  warmupLaunchCircle: {
    width: 42,
    height: 42,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.hot,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // 02 & 03 / Asymmetric Row
  asymmetricRow: {
    flexDirection: 'row',
    gap: 12,
  },
  splitHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  splitDurationText: {
    color: COLORS.textMuted,
    fontSize: 11,
    fontWeight: '700',
  },
  splitCenterBlock: {
    marginVertical: SPACING.md,
    gap: 6,
  },
  splitSvgArtPos: {
    position: 'absolute',
    right: -14,
    bottom: -10,
    opacity: 0.45,
  },

  // БЕЗ ЦЕНЗУРИ Poster
  uncensoredPoster: {
    flex: 1.08,
    backgroundColor: '#231218',
    borderRadius: RADIUS.xl,
    padding: SPACING.lg,
    minHeight: 216,
    justifyContent: 'space-between',
    overflow: 'hidden',
    position: 'relative',
  },
  uncensoredBadge: {
    color: COLORS.spy,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.1,
  },
  uncensoredTitle: {
    color: COLORS.textPrimary,
    fontSize: 23,
    fontWeight: '900',
    letterSpacing: -0.7,
    lineHeight: 26,
  },
  uncensoredQuote: {
    color: '#E2BEC6',
    fontSize: 13,
    fontWeight: '500',
    lineHeight: 18,
  },
  uncensoredRoute: {
    color: COLORS.spy,
    fontSize: 12,
    fontWeight: '700',
  },

  // НЕЗНАЙОМЦІ Poster
  strangersPoster: {
    flex: 0.96,
    backgroundColor: '#13201C',
    borderRadius: RADIUS.xl,
    padding: SPACING.lg,
    minHeight: 216,
    justifyContent: 'space-between',
    overflow: 'hidden',
    position: 'relative',
  },
  strangersBadge: {
    color: COLORS.crocodile,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.1,
  },
  strangersTitle: {
    color: COLORS.textPrimary,
    fontSize: 21,
    fontWeight: '900',
    letterSpacing: -0.6,
    lineHeight: 25,
  },
  strangersQuote: {
    color: '#BBDAD0',
    fontSize: 13,
    fontWeight: '500',
    lineHeight: 18,
  },
  strangersRoute: {
    color: COLORS.crocodile,
    fontSize: 12,
    fontWeight: '700',
  },

  // 04 / БИТВА КОМАНД Poster
  battlePoster: {
    backgroundColor: '#131A29',
    borderRadius: RADIUS.xl,
    padding: SPACING.xl,
    minHeight: 208,
    justifyContent: 'space-between',
    overflow: 'hidden',
    position: 'relative',
  },
  battleSvgArtPos: {
    position: 'absolute',
    right: -6,
    top: 18,
    opacity: 0.85,
  },
  battleOverline: {
    color: COLORS.alias,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.5,
  },
  battleDurationTag: {
    color: COLORS.textPrimary,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
  },
  battleMainBlock: {
    marginVertical: SPACING.md,
    gap: 6,
    maxWidth: '70%',
  },
  battleTitle: {
    color: COLORS.textPrimary,
    fontSize: 32,
    fontWeight: '900',
    letterSpacing: -1,
  },
  battleTagline: {
    color: '#BFD2F2',
    fontSize: 16,
    fontWeight: '500',
  },
  battleFooter: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: SPACING.md,
  },
  battleRouteText: {
    color: COLORS.textPrimary,
    fontSize: 14,
    fontWeight: '700',
    marginTop: 2,
  },
  battleActionBox: {
    width: 42,
    height: 42,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.alias,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
