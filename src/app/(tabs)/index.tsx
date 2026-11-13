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
import { PARTY_PRESETS } from '@/data/presets';
import { usePartyStore } from '@/stores/usePartyStore';
import { GameType, PartyPreset } from '@/types';

const GAME_NAMES: Record<GameType, string> = {
  alias: 'Еліас',
  crocodile: 'Крокодил',
  spy: 'Шпигун',
};

function formatPresetFlow(preset: PartyPreset): string {
  return preset.steps
    .map((step) => {
      if (step.gameType === 'alias' && step.roundTimeSec === 30) {
        return 'Бліц';
      }
      return GAME_NAMES[step.gameType];
    })
    .join('  →  ');
}

function formatScoringMeta(preset: PartyPreset): string {
  const hasTeam = preset.steps.some((s) => s.scoring.type === 'team');
  const count = preset.steps.length;
  const gamesWord = count === 1 ? 'гра' : count < 5 ? 'гри' : 'ігор';
  return `${count} ${gamesWord}  ·  ${hasTeam ? 'Командний залік' : 'Вільний режим'}`;
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
  const heroPreset = PARTY_PRESETS[0];
  const pairPresets = PARTY_PRESETS.slice(1, 3);
  const finalePreset = PARTY_PRESETS[3];

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Compact Editorial Header */}
        <View style={styles.header}>
          <Text style={styles.overline}>KOLO</Text>
          <Text style={styles.headline}>Що граємо сьогодні?</Text>
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
                  ПРОДОВЖИТИ  ·  {isCompleted ? 'ФІНАЛ' : `КРОК ${Math.min(currentStepIndex + 1, steps.length)}/${steps.length}`}
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

        {/* 01 / Hero Editorial Poster */}
        {heroPreset ? (
          <TouchableOpacity
            activeOpacity={0.88}
            style={styles.heroPoster}
            onPress={() => handleSelectPreset(heroPreset)}
          >
            <View
              style={[
                styles.heroAccentStrip,
                { backgroundColor: heroPreset.accentColor },
              ]}
            />

            <View style={styles.heroBody}>
              <View style={styles.posterTopRow}>
                <Text style={styles.posterIndex}>01 / PARTY MODE</Text>
                <Text
                  style={[
                    styles.posterDuration,
                    { color: heroPreset.accentColor },
                  ]}
                >
                  {heroPreset.durationLabel.toUpperCase()}
                </Text>
              </View>

              <View style={styles.heroTitleRow}>
                <Text style={styles.heroTitle}>
                  {heroPreset.title.toUpperCase()}
                </Text>
                <Text style={styles.heroEmoji}>{heroPreset.emoji}</Text>
              </View>

              <Text style={styles.heroFlow}>{formatPresetFlow(heroPreset)}</Text>

              <View style={styles.posterBottomRow}>
                <Text style={styles.posterMeta}>
                  {formatScoringMeta(heroPreset)}
                </Text>
                <View
                  style={[
                    styles.heroActionCircle,
                    { backgroundColor: heroPreset.accentColor },
                  ]}
                >
                  <ArrowUpRight size={18} color={COLORS.background} />
                </View>
              </View>
            </View>
          </TouchableOpacity>
        ) : null}

        {/* 02 & 03 / Asymmetric Split Poster Grid */}
        <View style={styles.splitRow}>
          {pairPresets.map((preset, idx) => {
            const numberStr = `0${idx + 2}`;
            return (
              <TouchableOpacity
                key={preset.id}
                activeOpacity={0.88}
                style={styles.splitPoster}
                onPress={() => handleSelectPreset(preset)}
              >
                <View style={styles.splitTopRow}>
                  <Text
                    style={[
                      styles.splitIndex,
                      { color: preset.accentColor },
                    ]}
                  >
                    {numberStr}
                  </Text>
                  <Text style={styles.splitDuration}>
                    {preset.durationLabel.toUpperCase()}
                  </Text>
                </View>

                <View style={styles.splitMiddle}>
                  <Text style={styles.splitEmoji}>{preset.emoji}</Text>
                  <Text style={styles.splitTitle}>
                    {preset.title}
                  </Text>
                </View>

                <View style={styles.splitFooter}>
                  <Text style={styles.splitFlow} numberOfLines={1}>
                    {formatPresetFlow(preset)}
                  </Text>
                  <Text style={styles.splitSubMeta}>
                    {preset.steps.some((s) => s.scoring.type === 'team')
                      ? 'Командний'
                      : 'Айсбрейкер'}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* 04 / Tournament Finale Poster */}
        {finalePreset ? (
          <TouchableOpacity
            activeOpacity={0.88}
            style={styles.finalePoster}
            onPress={() => handleSelectPreset(finalePreset)}
          >
            <View style={styles.posterTopRow}>
              <Text style={styles.posterIndex}>04 / TOURNAMENT</Text>
              <Text
                style={[
                  styles.posterDuration,
                  { color: finalePreset.accentColor },
                ]}
              >
                {finalePreset.durationLabel.toUpperCase()}
              </Text>
            </View>

            <View style={styles.finaleMainRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.finaleTitle}>
                  {finalePreset.title.toUpperCase()}
                </Text>
                <Text style={styles.heroFlow}>
                  {formatPresetFlow(finalePreset)}
                </Text>
              </View>

              <View
                style={[
                  styles.finaleActionBox,
                  { backgroundColor: finalePreset.accentColor },
                ]}
              >
                <ArrowUpRight size={20} color={COLORS.textPrimary} />
              </View>
            </View>

            <View style={styles.finaleStagesRow}>
              <Text style={styles.posterMeta}>
                {formatScoringMeta(finalePreset)}
              </Text>
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
    gap: SPACING.md,
  },
  header: {
    marginBottom: SPACING.sm,
    gap: 2,
  },
  overline: {
    color: COLORS.textMuted,
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 1.8,
  },
  headline: {
    color: COLORS.textPrimary,
    fontSize: 28,
    fontWeight: '700',
    letterSpacing: -0.7,
  },

  // Unfinished Session Bar
  resumeBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surfaceElevated,
    borderRadius: RADIUS.lg,
    paddingVertical: 12,
    paddingHorizontal: SPACING.md,
    marginBottom: SPACING.xs,
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
    color: COLORS.primary,
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 1,
  },
  resumeTitle: {
    color: COLORS.textPrimary,
    fontSize: 15,
    fontWeight: '600',
  },
  resumeCloseBtn: {
    padding: 6,
  },

  // 01 / Hero Poster
  heroPoster: {
    flexDirection: 'row',
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.xl,
    overflow: 'hidden',
  },
  heroAccentStrip: {
    width: 5,
  },
  heroBody: {
    flex: 1,
    padding: SPACING.xl,
    gap: SPACING.sm,
  },
  posterTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  posterIndex: {
    color: COLORS.textMuted,
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 1.2,
  },
  posterDuration: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
  },
  heroTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 2,
  },
  heroTitle: {
    color: COLORS.textPrimary,
    fontSize: 30,
    fontWeight: '700',
    letterSpacing: -0.8,
  },
  heroEmoji: {
    fontSize: 24,
  },
  heroFlow: {
    color: COLORS.textPrimary,
    fontSize: 15,
    fontWeight: '500',
    marginTop: 2,
  },
  posterBottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: SPACING.sm,
  },
  posterMeta: {
    color: COLORS.textSecondary,
    fontSize: 13,
    fontWeight: '400',
  },
  heroActionCircle: {
    width: 34,
    height: 34,
    borderRadius: RADIUS.full,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // 02 & 03 / Split Grid
  splitRow: {
    flexDirection: 'row',
    gap: SPACING.md,
  },
  splitPoster: {
    flex: 1,
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.xl,
    padding: SPACING.lg,
    justifyContent: 'space-between',
    minHeight: 196,
  },
  splitTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  splitIndex: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.6,
  },
  splitDuration: {
    color: COLORS.textMuted,
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.8,
  },
  splitMiddle: {
    marginVertical: SPACING.md,
    gap: 6,
  },
  splitEmoji: {
    fontSize: 22,
  },
  splitTitle: {
    color: COLORS.textPrimary,
    fontSize: 21,
    fontWeight: '700',
    letterSpacing: -0.5,
    lineHeight: 25,
  },
  splitFooter: {
    gap: 3,
  },
  splitFlow: {
    color: COLORS.textPrimary,
    fontSize: 13,
    fontWeight: '500',
  },
  splitSubMeta: {
    color: COLORS.textSecondary,
    fontSize: 12,
    fontWeight: '400',
  },

  // 04 / Finale Poster
  finalePoster: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.xl,
    padding: SPACING.xl,
    gap: SPACING.sm,
  },
  finaleMainRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: SPACING.md,
    marginTop: 2,
  },
  finaleTitle: {
    color: COLORS.textPrimary,
    fontSize: 26,
    fontWeight: '700',
    letterSpacing: -0.7,
    marginBottom: 4,
  },
  finaleActionBox: {
    width: 42,
    height: 42,
    borderRadius: RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  finaleStagesRow: {
    marginTop: 4,
  },
});
