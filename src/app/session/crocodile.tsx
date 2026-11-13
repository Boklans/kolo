import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import {
  AlertCircle,
  Drama,
  Eye,
  EyeOff,
  Flag,
  PartyPopper,
  Play,
  RefreshCw,
  Sparkles,
} from 'lucide-react-native';
import { COLORS, RADIUS, SPACING } from '@/constants/theme';
import { AbsoluteTimer } from '@/components/game/AbsoluteTimer';
import { SessionTopBar } from '@/components/game/SessionTopBar';
import { baseUaDeck, useDeckStore } from '@/stores/useDeckStore';
import { usePartyStore } from '@/stores/usePartyStore';
import { useUsedContentStore } from '@/stores/useUsedContentStore';
import { CrocodileItem, CrocodileStep } from '@/types';

type CrocodilePhase = 'READY' | 'PREPARATION' | 'ACTING';

export default function CrocodileGameScreen() {
  const router = useRouter();

  const steps = usePartyStore((s) => s.steps);
  const currentStepIndex = usePartyStore((s) => s.currentStepIndex);
  const teams = usePartyStore((s) => s.teams);
  const currentTeamIndex = usePartyStore((s) => s.currentTeamIndex);
  const currentRoundInStep = usePartyStore((s) => s.currentRoundInStep);
  const submitTeamTurnResult = usePartyStore((s) => s.submitTeamTurnResult);

  const getDeckById = useDeckStore((s) => s.getDeckById);
  const drawNextItem = useUsedContentStore((s) => s.drawNextItem);

  const currentStep = useMemo(() => {
    const raw = steps[currentStepIndex];
    if (raw && raw.gameType === 'crocodile') {
      return raw as CrocodileStep;
    }
    return {
      id: 'fallback_crocodile',
      deckId: 'base_ua',
      gameType: 'crocodile',
      roundTimeSec: 60,
      roundsPerTeam: 1,
      scoring: { type: 'team', groupId: 'main' },
    } as CrocodileStep;
  }, [steps, currentStepIndex]);

  const deck = useMemo(() => {
    const found = getDeckById(currentStep.deckId);
    if (found && found.items.crocodile.length > 0) {
      return found;
    }
    return baseUaDeck;
  }, [getDeckById, currentStep.deckId]);

  const currentTeam = teams[currentTeamIndex] ?? {
    id: 'team_1',
    name: 'Команда 1',
    scoresByGroup: { main: 0 },
  };

  const [phase, setPhase] = useState<CrocodilePhase>('READY');
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const [currentPhrase, setCurrentPhrase] = useState<CrocodileItem | null>(null);
  const [swapsRemaining, setSwapsRemaining] = useState<number>(1);
  const [isPeekingSpoiler, setIsPeekingSpoiler] = useState<boolean>(false);
  const [isTimeExpired, setIsTimeExpired] = useState<boolean>(false);

  const turnExcludeIdsRef = useRef<string[]>([]);

  const pullNextPhrase = useCallback(() => {
    const item = drawNextItem(
      deck.id,
      'crocodile',
      deck.items.crocodile,
      turnExcludeIdsRef.current
    );
    if (item) {
      turnExcludeIdsRef.current = [...turnExcludeIdsRef.current, item.id];
      setCurrentPhrase(item);
    }
  }, [deck, drawNextItem]);

  const handleShowPhraseToActor = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    turnExcludeIdsRef.current = [];
    setSwapsRemaining(1);
    setIsTimeExpired(false);
    pullNextPhrase();
    setPhase('PREPARATION');
  };

  const handleSwapPhrase = () => {
    if (swapsRemaining <= 0) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSwapsRemaining(0);
    pullNextPhrase();
  };

  const handleStartActingTimer = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setIsPeekingSpoiler(false);
    setIsTimeExpired(false);
    setPhase('ACTING');
  };

  const handleFinishTurn = (guessed: boolean) => {
    if (guessed) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } else {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }

    const points = guessed ? 2 : 0;
    const phraseText = currentPhrase?.phrase;

    submitTeamTurnResult(points, {
      guessedCount: guessed ? 1 : 0,
      skippedWords: !guessed && phraseText ? [phraseText] : [],
    });

    router.replace('/session/scoreboard');
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <SessionTopBar
        stepBadgeText={`КРОКОДИЛ • КРОК ${currentStepIndex + 1}/${Math.max(1, steps.length)}`}
        accentColor={COLORS.crocodile}
        onPauseChange={setIsPaused}
      />

      {/* PHASE 1: READY */}
      {phase === 'READY' ? (
        <View style={styles.centerContainer}>
          <View style={styles.modeBadge}>
            <Drama size={20} color={COLORS.crocodile} />
            <Text style={styles.modeBadgeText}>ПАНТОМІМА ТА ЖЕСТИ</Text>
          </View>

          <Text style={styles.teamNameHero}>{currentTeam.name}</Text>
          <Text style={styles.subtitleText}>
            Раунд {currentRoundInStep} з {currentStep.roundsPerTeam} • Оберіть одного ведучого, який буде показувати!
          </Text>

          <View style={styles.rulesCard}>
            <View style={styles.ruleItem}>
              <Sparkles size={18} color={COLORS.crocodile} />
              <Text style={styles.ruleText}>
                Жодних слів, звуків чи артикуляції губами — тільки міміка, жести та рухи тілом.
              </Text>
            </View>
            <View style={styles.ruleItem}>
              <RefreshCw size={18} color={COLORS.hot} />
              <Text style={styles.ruleText}>
                Ведучий матиме{' '}
                <Text style={{ color: COLORS.hot, fontWeight: '800' }}>
                  1 безкоштовну спробу
                </Text>{' '}
                замінити фразу перед стартом таймера.
              </Text>
            </View>
          </View>

          <TouchableOpacity
            activeOpacity={0.85}
            style={styles.primaryBtn}
            onPress={handleShowPhraseToActor}
          >
            <Eye size={20} color={COLORS.textPrimary} />
            <Text style={styles.primaryBtnText}>Показати фразу ведучому</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {/* PHASE 2: PREPARATION */}
      {phase === 'PREPARATION' ? (
        <View style={styles.centerContainer}>
          <View style={styles.prepWarningPill}>
            <EyeOff size={15} color={COLORS.hot} />
            <Text style={styles.prepWarningText}>
              ТІЛЬКИ ДЛЯ ОЧЕЙ ВЕДУЧОГО • ТАЙМЕР ЩЕ НЕ ЙДЕ
            </Text>
          </View>

          <View style={styles.phraseCard}>
            <Text style={styles.phraseLabel}>ТВОЄ ЗАВДАННЯ ДЛЯ ПОКАЗУ:</Text>
            <Text style={styles.phraseText}>
              {currentPhrase?.phrase ?? 'Завантаження...'}
            </Text>
            <Text style={styles.deckTag}>
              {deck.emoji} {deck.title}
            </Text>
          </View>

          <View style={styles.prepActionsStack}>
            <TouchableOpacity
              activeOpacity={0.85}
              disabled={swapsRemaining <= 0}
              style={[
                styles.swapPhraseBtn,
                swapsRemaining <= 0 && styles.swapPhraseBtnDisabled,
              ]}
              onPress={handleSwapPhrase}
            >
              <RefreshCw
                size={18}
                color={swapsRemaining > 0 ? COLORS.hot : COLORS.textSecondary}
              />
              <Text
                style={[
                  styles.swapPhraseBtnText,
                  swapsRemaining <= 0 && { color: COLORS.textSecondary },
                ]}
              >
                {swapsRemaining > 0
                  ? '🔄 Замінити складну фразу (залишилась 1 спроба)'
                  : 'Спробу заміни вже використано'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              activeOpacity={0.85}
              style={styles.primaryBtn}
              onPress={handleStartActingTimer}
            >
              <Play
                size={20}
                color={COLORS.textPrimary}
                fill={COLORS.textPrimary}
              />
              <Text style={styles.primaryBtnText}>
                Я готовий — запустити таймер ({currentStep.roundTimeSec} сек)!
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : null}

      {/* PHASE 3: ACTING */}
      {phase === 'ACTING' ? (
        <View style={styles.actingContainer}>
          <View style={styles.actingTopSection}>
            <Text style={styles.actingTeamTitle}>
              Показує: {currentTeam.name}
            </Text>

            <AbsoluteTimer
              durationSec={currentStep.roundTimeSec}
              isRunning={!isPaused && !isTimeExpired}
              onExpire={() => setIsTimeExpired(true)}
              accentColor={COLORS.crocodile}
            />

            {isTimeExpired ? (
              <View style={styles.expiredBanner}>
                <AlertCircle size={18} color={COLORS.spy} />
                <Text style={styles.expiredBannerText}>
                  Час вийшов! Зафіксуйте результат раунду:
                </Text>
              </View>
            ) : null}
          </View>

          {/* Spoiler Box */}
          <Pressable
            onPressIn={() => {
              Haptics.selectionAsync();
              setIsPeekingSpoiler(true);
            }}
            onPressOut={() => setIsPeekingSpoiler(false)}
            style={[
              styles.spoilerCard,
              isPeekingSpoiler && {
                borderColor: COLORS.crocodile,
                backgroundColor: `${COLORS.crocodile}15`,
              },
            ]}
          >
            {isPeekingSpoiler ? (
              <>
                <Text style={styles.spoilerPeekLabel}>СЕКРЕТНА ФРАЗА:</Text>
                <Text style={styles.spoilerPhraseText}>
                  {currentPhrase?.phrase}
                </Text>
              </>
            ) : (
              <>
                <EyeOff size={28} color={COLORS.textSecondary} />
                <Text style={styles.spoilerCoverTitle}>
                  Фразу приховано під спойлером
                </Text>
                <Text style={styles.spoilerCoverSub}>
                  Затисни палець тут, якщо ведучий забув фразу (телефон можна класти на стіл)
                </Text>
              </>
            )}
          </Pressable>

          {/* Outcome Buttons */}
          <View style={styles.actingFooter}>
            <TouchableOpacity
              activeOpacity={0.85}
              style={styles.guessedBtn}
              onPress={() => handleFinishTurn(true)}
            >
              <PartyPopper size={22} color={COLORS.textPrimary} />
              <Text style={styles.guessedBtnText}>🎉 Вгадали! (+2 бали)</Text>
            </TouchableOpacity>

            <TouchableOpacity
              activeOpacity={0.85}
              style={styles.giveUpBtn}
              onPress={() => handleFinishTurn(false)}
            >
              <Flag size={18} color={COLORS.spy} />
              <Text style={styles.giveUpBtnText}>
                🏳️ Здаємося / Час вийшов (0 балів)
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  centerContainer: {
    flex: 1,
    paddingHorizontal: SPACING.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: `${COLORS.crocodile}20`,
    borderWidth: 1,
    borderColor: `${COLORS.crocodile}66`,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: RADIUS.full,
    marginBottom: SPACING.md,
  },
  modeBadgeText: {
    color: COLORS.crocodile,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1,
  },
  teamNameHero: {
    color: COLORS.textPrimary,
    fontSize: 34,
    fontWeight: '900',
    textAlign: 'center',
    marginBottom: SPACING.xs,
  },
  subtitleText: {
    color: COLORS.textSecondary,
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
    marginBottom: SPACING.xxl,
  },
  rulesCard: {
    width: '100%',
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.xl,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: SPACING.xl,
    gap: SPACING.md,
    marginBottom: SPACING.xxxl,
  },
  ruleItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
  },
  ruleText: {
    flex: 1,
    color: COLORS.textSecondary,
    fontSize: 14,
    lineHeight: 20,
  },
  primaryBtn: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: COLORS.crocodile,
    paddingVertical: 18,
    borderRadius: RADIUS.lg,
  },
  primaryBtnText: {
    color: COLORS.textPrimary,
    fontSize: 17,
    fontWeight: '900',
  },

  // Preparation
  prepWarningPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: `${COLORS.hot}20`,
    borderWidth: 1,
    borderColor: `${COLORS.hot}66`,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: RADIUS.full,
    marginBottom: SPACING.xl,
  },
  prepWarningText: {
    color: COLORS.hot,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  phraseCard: {
    width: '100%',
    minHeight: 230,
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.xl,
    borderWidth: 2,
    borderColor: `${COLORS.crocodile}88`,
    padding: SPACING.xxl,
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: SPACING.xxl,
  },
  phraseLabel: {
    color: COLORS.crocodile,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1,
  },
  phraseText: {
    color: COLORS.textPrimary,
    fontSize: 26,
    fontWeight: '900',
    textAlign: 'center',
    lineHeight: 34,
  },
  deckTag: {
    color: COLORS.textSecondary,
    fontSize: 13,
    fontWeight: '600',
  },
  prepActionsStack: {
    width: '100%',
    gap: SPACING.md,
  },
  swapPhraseBtn: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: `${COLORS.hot}1A`,
    borderWidth: 1.5,
    borderColor: `${COLORS.hot}66`,
    paddingVertical: 15,
    paddingHorizontal: SPACING.md,
    borderRadius: RADIUS.lg,
  },
  swapPhraseBtnDisabled: {
    backgroundColor: COLORS.surfaceElevated,
    borderColor: COLORS.border,
    opacity: 0.6,
  },
  swapPhraseBtnText: {
    color: COLORS.hot,
    fontSize: 14,
    fontWeight: '800',
    textAlign: 'center',
  },

  // Acting
  actingContainer: {
    flex: 1,
    paddingHorizontal: SPACING.xl,
    paddingBottom: SPACING.lg,
    justifyContent: 'space-between',
  },
  actingTopSection: {
    alignItems: 'center',
    gap: SPACING.md,
  },
  actingTeamTitle: {
    color: COLORS.textPrimary,
    fontSize: 18,
    fontWeight: '800',
  },
  expiredBanner: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: `${COLORS.spy}25`,
    borderWidth: 1,
    borderColor: COLORS.spy,
    paddingVertical: 10,
    paddingHorizontal: SPACING.md,
    borderRadius: RADIUS.lg,
  },
  expiredBannerText: {
    color: COLORS.spy,
    fontSize: 13,
    fontWeight: '800',
  },
  spoilerCard: {
    width: '100%',
    minHeight: 190,
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.xl,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    borderStyle: 'dashed',
    padding: SPACING.xl,
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
  },
  spoilerPeekLabel: {
    color: COLORS.crocodile,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
  },
  spoilerPhraseText: {
    color: COLORS.textPrimary,
    fontSize: 22,
    fontWeight: '900',
    textAlign: 'center',
    lineHeight: 30,
  },
  spoilerCoverTitle: {
    color: COLORS.textPrimary,
    fontSize: 16,
    fontWeight: '800',
    textAlign: 'center',
  },
  spoilerCoverSub: {
    color: COLORS.textSecondary,
    fontSize: 13,
    lineHeight: 18,
    textAlign: 'center',
  },
  actingFooter: {
    gap: SPACING.md,
  },
  guessedBtn: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: COLORS.crocodile,
    paddingVertical: 18,
    borderRadius: RADIUS.lg,
  },
  guessedBtnText: {
    color: COLORS.textPrimary,
    fontSize: 18,
    fontWeight: '900',
  },
  giveUpBtn: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: COLORS.surfaceElevated,
    borderWidth: 1.5,
    borderColor: `${COLORS.spy}66`,
    paddingVertical: 16,
    borderRadius: RADIUS.lg,
  },
  giveUpBtnText: {
    color: COLORS.spy,
    fontSize: 15,
    fontWeight: '800',
  },
});
