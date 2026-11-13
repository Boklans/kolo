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
import {
  Clock,
  ChevronRight,
  Play,
  RotateCcw,
  Sparkles,
} from 'lucide-react-native';
import { COLORS, RADIUS, SPACING } from '@/constants/theme';
import { PARTY_PRESETS } from '@/data/presets';
import { usePartyStore } from '@/stores/usePartyStore';
import { GameType, PartyPreset } from '@/types';

const GAME_LABELS: Record<GameType, { label: string; color: string }> = {
  alias: { label: 'Еліас', color: COLORS.alias },
  crocodile: { label: 'Крокодил', color: COLORS.crocodile },
  spy: { label: 'Шпигун', color: COLORS.spy },
};

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
      'Скинути активну вечірку?',
      'Поточний прогрес та бали команд буде видалено.',
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

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.brandBadge}>
            <Sparkles size={14} color={COLORS.primary} />
            <Text style={styles.brandBadgeText}>KOLO • PARTY HUB</Text>
          </View>
          <Text style={styles.title}>Який сьогодні вайб?</Text>
          <Text style={styles.subtitle}>
            Обери готовий сценарій вечірки — ми самі перемикатимемо раунди та рахуватимемо бали.
          </Text>
        </View>

        {/* Resume Active Party Banner */}
        {isActive && steps.length > 0 ? (
          <View style={styles.resumeBanner}>
            <View style={styles.resumeTopRow}>
              <View style={styles.resumeBadge}>
                <View style={styles.resumeDot} />
                <Text style={styles.resumeBadgeText}>НЕЗАВЕРШЕНА ВЕЧІРКА</Text>
              </View>
              <Text style={styles.resumeProgressText}>
                {isCompleted
                  ? 'Фінал'
                  : `Крок ${Math.min(currentStepIndex + 1, steps.length)}/${steps.length}`}
              </Text>
            </View>

            <Text style={styles.resumeTitle} numberOfLines={1}>
              {presetTitle || 'Активна сесія'}
            </Text>
            <Text style={styles.resumeSubtitle} numberOfLines={1}>
              {isCompleted
                ? 'Усі раунди зіграно — перегляньте постер переможців!'
                : activeTeamName
                  ? `Наступний хід: ${activeTeamName}`
                  : 'Сесію збережено в пам’яті'}
            </Text>

            <View style={styles.resumeActionsRow}>
              <TouchableOpacity
                activeOpacity={0.85}
                style={styles.resumePrimaryBtn}
                onPress={handleResumeParty}
              >
                <Play
                  size={16}
                  color={COLORS.textPrimary}
                  fill={COLORS.textPrimary}
                />
                <Text style={styles.resumePrimaryBtnText}>Продовжити гру</Text>
              </TouchableOpacity>

              <TouchableOpacity
                activeOpacity={0.85}
                style={styles.resumeResetBtn}
                onPress={handleResetParty}
              >
                <RotateCcw size={16} color={COLORS.spy} />
                <Text style={styles.resumeResetBtnText}>Скинути</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : null}

        {/* Presets List */}
        <View style={styles.cardsList}>
          {PARTY_PRESETS.map((preset) => (
            <TouchableOpacity
              key={preset.id}
              activeOpacity={0.85}
              onPress={() => handleSelectPreset(preset)}
              style={[
                styles.card,
                { borderColor: `${preset.accentColor}44` },
              ]}
            >
              <View
                style={[
                  styles.accentGlow,
                  { backgroundColor: `${preset.accentColor}18` },
                ]}
              />

              <View style={styles.cardTopRow}>
                <View
                  style={[
                    styles.emojiContainer,
                    {
                      backgroundColor: `${preset.accentColor}22`,
                      borderColor: `${preset.accentColor}55`,
                    },
                  ]}
                >
                  <Text style={styles.emoji}>{preset.emoji}</Text>
                </View>

                <View style={styles.durationBadge}>
                  <Clock size={13} color={COLORS.textSecondary} />
                  <Text style={styles.durationText}>{preset.durationLabel}</Text>
                </View>
              </View>

              <Text style={styles.cardTitle}>{preset.title}</Text>
              <Text style={styles.cardSubtitle}>{preset.subtitle}</Text>

              <View style={styles.cardFooter}>
                <View style={styles.stepsPills}>
                  {preset.steps.map((step, index) => {
                    const meta = GAME_LABELS[step.gameType];
                    const isBlitz =
                      step.gameType === 'alias' && step.roundTimeSec === 30;
                    return (
                      <View
                        key={step.id}
                        style={[
                          styles.stepPill,
                          {
                            backgroundColor: `${meta.color}1F`,
                            borderColor: `${meta.color}55`,
                          },
                        ]}
                      >
                        <Text style={[styles.stepPillText, { color: meta.color }]}>
                          {index + 1}. {isBlitz ? 'Бліц-Еліас' : meta.label}
                        </Text>
                      </View>
                    );
                  })}
                </View>

                <View
                  style={[
                    styles.arrowButton,
                    { backgroundColor: preset.accentColor },
                  ]}
                >
                  <ChevronRight size={18} color={COLORS.textPrimary} />
                </View>
              </View>
            </TouchableOpacity>
          ))}
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
    paddingTop: SPACING.lg,
    paddingBottom: SPACING.xxxl,
  },
  header: {
    marginBottom: SPACING.xxl,
  },
  brandBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    backgroundColor: COLORS.surfaceElevated,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: SPACING.md,
    paddingVertical: 6,
    borderRadius: RADIUS.full,
    marginBottom: SPACING.md,
  },
  brandBadgeText: {
    color: COLORS.primary,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.1,
  },
  title: {
    color: COLORS.textPrimary,
    fontSize: 30,
    fontWeight: '800',
    letterSpacing: -0.5,
    marginBottom: SPACING.xs,
  },
  subtitle: {
    color: COLORS.textSecondary,
    fontSize: 15,
    lineHeight: 22,
  },
  cardsList: {
    gap: SPACING.lg,
  },
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.xl,
    borderWidth: 1.5,
    padding: SPACING.xl,
    overflow: 'hidden',
    position: 'relative',
  },
  accentGlow: {
    position: 'absolute',
    top: -40,
    right: -40,
    width: 140,
    height: 140,
    borderRadius: 70,
  },
  cardTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  emojiContainer: {
    width: 48,
    height: 48,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emoji: {
    fontSize: 24,
  },
  durationBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: COLORS.surfaceElevated,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: RADIUS.full,
  },
  durationText: {
    color: COLORS.textSecondary,
    fontSize: 12,
    fontWeight: '600',
  },
  cardTitle: {
    color: COLORS.textPrimary,
    fontSize: 22,
    fontWeight: '800',
    marginBottom: 6,
  },
  cardSubtitle: {
    color: COLORS.textSecondary,
    fontSize: 14,
    lineHeight: 20,
    marginBottom: SPACING.lg,
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: SPACING.sm,
  },
  stepsPills: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    flex: 1,
  },
  stepPill: {
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: RADIUS.full,
  },
  stepPillText: {
    fontSize: 12,
    fontWeight: '700',
  },
  arrowButton: {
    width: 36,
    height: 36,
    borderRadius: RADIUS.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  resumeBanner: {
    backgroundColor: `${COLORS.primary}18`,
    borderWidth: 1.5,
    borderColor: COLORS.primary,
    borderRadius: RADIUS.xl,
    padding: SPACING.xl,
    marginBottom: SPACING.xxl,
    gap: SPACING.xs,
  },
  resumeTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  resumeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: `${COLORS.crocodile}20`,
    borderWidth: 1,
    borderColor: `${COLORS.crocodile}66`,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: RADIUS.full,
  },
  resumeDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: COLORS.crocodile,
  },
  resumeBadgeText: {
    color: COLORS.crocodile,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  resumeProgressText: {
    color: COLORS.primary,
    fontSize: 12,
    fontWeight: '800',
  },
  resumeTitle: {
    color: COLORS.textPrimary,
    fontSize: 20,
    fontWeight: '800',
  },
  resumeSubtitle: {
    color: COLORS.textSecondary,
    fontSize: 13,
    marginBottom: SPACING.sm,
  },
  resumeActionsRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  resumePrimaryBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: COLORS.primary,
    paddingVertical: 13,
    borderRadius: RADIUS.lg,
  },
  resumePrimaryBtnText: {
    color: COLORS.textPrimary,
    fontSize: 14,
    fontWeight: '800',
  },
  resumeResetBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: `${COLORS.spy}1A`,
    borderWidth: 1,
    borderColor: `${COLORS.spy}55`,
    paddingHorizontal: SPACING.md,
    paddingVertical: 13,
    borderRadius: RADIUS.lg,
  },
  resumeResetBtnText: {
    color: COLORS.spy,
    fontSize: 13,
    fontWeight: '700',
  },
});
