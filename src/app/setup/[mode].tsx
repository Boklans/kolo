import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import {
  ArrowLeft,
  CheckCircle2,
  Crown,
  Dices,
  EyeOff,
  Layers,
  Minus,
  Play,
  Plus,
  ShieldAlert,
  Timer,
  Trash2,
  Users,
} from 'lucide-react-native';
import { COLORS, RADIUS, SPACING } from '@/constants/theme';
import { PARTY_PRESETS } from '@/data/presets';
import { OFFICIAL_DECKS, useDeckStore } from '@/stores/useDeckStore';
import { usePartyStore } from '@/stores/usePartyStore';
import {
  AliasStep,
  CrocodileStep,
  Deck,
  GameType,
  PresetStep,
  SpyStep,
} from '@/types';

const FUNNY_TEAM_NAMES = [
  'Бойові Гуси',
  'Сирні Кульки',
  'Хмільні Сови',
  'Нічні Жреці',
  'Космічні Вареники',
  'Шалені Бобри',
  'Кібер-Козаки',
  'Святий Павербанк',
  'Пекельні Сирники',
  'Дикі Капібари',
  'Таємні Грибники',
  'Неонові Дракони',
];

const GAME_META: Record<
  GameType,
  { title: string; emoji: string; accentColor: string; subtitle: string }
> = {
  alias: {
    title: 'Еліас',
    emoji: '⚡',
    accentColor: COLORS.alias,
    subtitle: 'Командне пояснення слів на швидкість',
  },
  crocodile: {
    title: 'Крокодил',
    emoji: '🐊',
    accentColor: COLORS.crocodile,
    subtitle: 'Покажи фразу жестами та мімікою без слів',
  },
  spy: {
    title: 'Шпигун',
    emoji: '🕵️',
    accentColor: COLORS.spy,
    subtitle: 'Знайдіть шпигуна серед гравців за столом',
  },
};

export default function SetupScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ mode?: string; id?: string }>();

  const customDecks = useDeckStore((s) => s.customDecks);
  const allDecks = useMemo(
    () => [...OFFICIAL_DECKS, ...customDecks],
    [customDecks]
  );

  const isPresetMode = params.mode === 'preset';
  const targetId = params.id ?? (isPresetMode ? 'warmup' : 'alias');

  const selectedPreset = useMemo(
    () =>
      isPresetMode
        ? PARTY_PRESETS.find((p) => p.id === targetId) ?? PARTY_PRESETS[0]
        : null,
    [isPresetMode, targetId]
  );

  const selectedGameType: GameType = useMemo(() => {
    if (targetId === 'alias' || targetId === 'crocodile' || targetId === 'spy') {
      return targetId;
    }
    return 'alias';
  }, [targetId]);

  const defaultPresetDeckId =
    isPresetMode && selectedPreset
      ? selectedPreset.steps[0]?.deckId ?? 'base_ua'
      : 'base_ua';

  // Налаштування колоди та одиночної гри
  const [selectedDeckId, setSelectedDeckId] = useState<string>(defaultPresetDeckId);

  useEffect(() => {
    setSelectedDeckId(defaultPresetDeckId);
  }, [defaultPresetDeckId]);
  const [aliasTimeSec, setAliasTimeSec] = useState<30 | 60 | 90>(60);
  const [aliasPenalty, setAliasPenalty] = useState<boolean>(false);
  const [crocodileTimeSec, setCrocodileTimeSec] = useState<60 | 90 | 120>(60);
  const [roundsPerTeam, setRoundsPerTeam] = useState<number>(2);
  const [spyTimeSec, setSpyTimeSec] = useState<180 | 300 | 420>(300);
  const [spyCount, setSpyCount] = useState<1 | 2>(1);

  // Команди та гравці
  const [teams, setTeams] = useState([
    { id: 'team_1', name: 'Команда 1' },
    { id: 'team_2', name: 'Команда 2' },
  ]);
  const [playerCount, setPlayerCount] = useState<number>(5);

  const hasSpyMode = useMemo(() => {
    if (isPresetMode && selectedPreset) {
      return selectedPreset.steps.some((s) => s.gameType === 'spy');
    }
    return selectedGameType === 'spy';
  }, [isPresetMode, selectedPreset, selectedGameType]);

  const hasTeamScoring = useMemo(() => {
    if (isPresetMode && selectedPreset) {
      return selectedPreset.steps.some((s) => s.scoring.type === 'team');
    }
    return selectedGameType === 'alias' || selectedGameType === 'crocodile';
  }, [isPresetMode, selectedPreset, selectedGameType]);

  const accentColor =
    isPresetMode && selectedPreset
      ? selectedPreset.accentColor
      : GAME_META[selectedGameType].accentColor;

  const headerTitle =
    isPresetMode && selectedPreset
      ? selectedPreset.title
      : GAME_META[selectedGameType].title;

  const headerEmoji =
    isPresetMode && selectedPreset
      ? selectedPreset.emoji
      : GAME_META[selectedGameType].emoji;

  const headerSubtitle =
    isPresetMode && selectedPreset
      ? selectedPreset.subtitle
      : GAME_META[selectedGameType].subtitle;

  const getDeckCountForGame = (deck: Deck, gameType: GameType): number => {
    if (gameType === 'alias') return deck.items.alias.length;
    if (gameType === 'crocodile') return deck.items.crocodile.length;
    return deck.items.spyLocations.length;
  };

  const getDeckSuitability = (
    deck: Deck
  ): { isSupported: boolean; label: string } => {
    if (isPresetMode && selectedPreset) {
      const needsAlias = selectedPreset.steps.some((s) => s.gameType === 'alias');
      const needsCroc = selectedPreset.steps.some(
        (s) => s.gameType === 'crocodile'
      );
      const hasSpy = selectedPreset.steps.some((s) => s.gameType === 'spy');

      const missingAlias = needsAlias && deck.items.alias.length === 0;
      const missingCroc = needsCroc && deck.items.crocodile.length === 0;

      if (missingAlias || missingCroc) {
        const missingParts: string[] = [];
        if (missingAlias) missingParts.push('Еліас');
        if (missingCroc) missingParts.push('Крокодил');
        return {
          isSupported: false,
          label: `Немає карток для: ${missingParts.join(', ')}`,
        };
      }

      const parts: string[] = [];
      if (needsAlias) parts.push(`${deck.items.alias.length} Еліас`);
      if (needsCroc) parts.push(`${deck.items.crocodile.length} Крокодил`);
      if (hasSpy) {
        parts.push(
          deck.items.spyLocations.length > 0
            ? `${deck.items.spyLocations.length} локацій`
            : 'Локації Шпигуна з Бази'
        );
      }

      return {
        isSupported: true,
        label: parts.join(' • '),
      };
    }

    const count = getDeckCountForGame(deck, selectedGameType);
    if (count > 0) {
      return {
        isSupported: true,
        label: `Доступно: ${count} карток для цього режиму`,
      };
    }
    return {
      isSupported: false,
      label: 'Немає карток для цього режиму',
    };
  };

  const handleAddTeam = () => {
    if (teams.length >= 6) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const nextIndex = teams.length + 1;
    setTeams((prev) => [
      ...prev,
      { id: `team_${Date.now()}`, name: `Команда ${nextIndex}` },
    ]);
  };

  const handleRemoveTeam = (id: string) => {
    if (teams.length <= 2) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setTeams((prev) => prev.filter((t) => t.id !== id));
  };

  const handleRenameTeam = (id: string, name: string) => {
    setTeams((prev) => prev.map((t) => (t.id === id ? { ...t, name } : t)));
  };

  const handleRandomizeTeamNames = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    const shuffled = [...FUNNY_TEAM_NAMES].sort(() => Math.random() - 0.5);
    setTeams((prev) =>
      prev.map((team, idx) => ({
        ...team,
        name: shuffled[idx % shuffled.length] ?? `Команда ${idx + 1}`,
      }))
    );
  };

  const handleAdjustPlayers = (delta: number) => {
    Haptics.selectionAsync();
    setPlayerCount((prev) => {
      const next = Math.max(3, Math.min(12, prev + delta));
      if (next < 5 && spyCount === 2) {
        setSpyCount(1);
      }
      return next;
    });
  };

  const handleSelectDeck = (deck: Deck) => {
    const suitability = getDeckSuitability(deck);
    if (!suitability.isSupported) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      Alert.alert(
        'Колода не підходить для цього сценарію',
        `У колоді «${deck.title}» ${suitability.label.toLowerCase()}. Оберіть іншу колоду.`
      );
      return;
    }
    Haptics.selectionAsync();
    setSelectedDeckId(deck.id);
  };

  const handleStartParty = () => {
    let stepsToRun: PresetStep[] = [];

    const chosenDeck =
      allDecks.find((d) => d.id === selectedDeckId) ?? OFFICIAL_DECKS[0];

    if (isPresetMode && selectedPreset) {
      stepsToRun = selectedPreset.steps.map((step) => {
        const hasOwnCards = getDeckCountForGame(chosenDeck, step.gameType) > 0;
        const resolvedDeckId = hasOwnCards
          ? chosenDeck.id
          : step.gameType === 'spy'
            ? 'base_ua'
            : step.deckId;

        if (step.gameType === 'spy') {
          return {
            ...step,
            deckId: resolvedDeckId,
            spyCount: playerCount >= 5 ? spyCount : 1,
          };
        }
        return {
          ...step,
          deckId: resolvedDeckId,
        };
      });
    } else {
      // Перевіряємо обрану колоду
      const availableCards = getDeckCountForGame(chosenDeck, selectedGameType);

      if (availableCards === 0) {
        Alert.alert(
          'Оберіть іншу колоду',
          'У вибраній колоді немає карток для цього ігрового режиму.'
        );
        return;
      }

      if (selectedGameType === 'alias') {
        const aliasStep: AliasStep = {
          id: `single_alias_${Date.now()}`,
          deckId: chosenDeck.id,
          gameType: 'alias',
          roundTimeSec: aliasTimeSec,
          penaltyForSkip: aliasPenalty,
          roundsPerTeam,
          scoring: { type: 'team', groupId: 'main' },
        };
        stepsToRun = [aliasStep];
      } else if (selectedGameType === 'crocodile') {
        const crocStep: CrocodileStep = {
          id: `single_crocodile_${Date.now()}`,
          deckId: chosenDeck.id,
          gameType: 'crocodile',
          roundTimeSec: crocodileTimeSec,
          roundsPerTeam,
          scoring: { type: 'team', groupId: 'main' },
        };
        stepsToRun = [crocStep];
      } else {
        const spyStep: SpyStep = {
          id: `single_spy_${Date.now()}`,
          deckId: chosenDeck.id,
          gameType: 'spy',
          spyCount: playerCount >= 5 ? spyCount : 1,
          discussionTimeSec: spyTimeSec,
          scoring: { type: 'none' },
        };
        stepsToRun = [spyStep];
      }
    }

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    usePartyStore.getState().startSession({
      title: headerTitle,
      steps: stepsToRun,
      teamNames: teams.map((t, idx) => t.name.trim() || `Команда ${idx + 1}`),
      playerCount,
    });

    router.replace('/session/orchestrator');
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      {/* Top Bar */}
      <View style={styles.topBar}>
        <TouchableOpacity
          activeOpacity={0.8}
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <ArrowLeft size={20} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.topBarTitle}>Налаштування вечірки</Text>
        <View style={styles.topBarSpacer} />
      </View>

      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Summary Card */}
        <View style={[styles.summaryCard, { borderColor: `${accentColor}55` }]}>
          <View style={styles.summaryHeader}>
            <View
              style={[
                styles.emojiBadge,
                {
                  backgroundColor: `${accentColor}22`,
                  borderColor: `${accentColor}55`,
                },
              ]}
            >
              <Text style={styles.emojiText}>{headerEmoji}</Text>
            </View>
            <View style={styles.summaryTitleBlock}>
              <Text style={[styles.modeTag, { color: accentColor }]}>
                {isPresetMode ? 'ГОТОВИЙ ВАЙБ-ПРЕСЕТ' : 'ОКРЕМА ГРА'}
              </Text>
              <Text style={styles.summaryTitle}>{headerTitle}</Text>
            </View>
          </View>
          <Text style={styles.summarySubtitle}>{headerSubtitle}</Text>

          {isPresetMode && selectedPreset ? (
            <View style={styles.presetStepsWrap}>
              {selectedPreset.steps.map((step, idx) => {
                const chosenDeck =
                  allDecks.find((d) => d.id === selectedDeckId) ?? OFFICIAL_DECKS[0];
                const hasOwnCards = getDeckCountForGame(chosenDeck, step.gameType) > 0;
                const displayDeck = hasOwnCards ? chosenDeck : OFFICIAL_DECKS[0];
                return (
                  <View key={step.id} style={styles.presetStepRow}>
                    <View
                      style={[
                        styles.presetStepIndex,
                        { backgroundColor: `${ GAME_META[step.gameType].accentColor }25` },
                      ]}
                    >
                      <Text
                        style={[
                          styles.presetStepIndexText,
                          { color: GAME_META[step.gameType].accentColor },
                        ]}
                      >
                        {idx + 1}
                      </Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.presetStepTitle}>
                        {GAME_META[step.gameType].emoji}{' '}
                        {GAME_META[step.gameType].title}
                      </Text>
                      <Text style={styles.presetStepMeta}>
                        Колода: {displayDeck.title} •{' '}
                        {step.gameType === 'spy'
                          ? `${step.discussionTimeSec / 60} хв обговорення`
                          : `${step.roundTimeSec} сек / хід • ${step.roundsPerTeam} кола`}
                      </Text>
                    </View>
                  </View>
                );
              })}
            </View>
          ) : null}
        </View>

        {/* Single Game Settings: Round Time */}
        {!isPresetMode ? (
          <View style={styles.section}>
              <View style={styles.sectionHeaderRow}>
                <View style={styles.sectionTitleGroup}>
                  <Timer size={18} color={accentColor} />
                  <Text style={styles.sectionTitle}>Параметри раунду</Text>
                </View>
              </View>

              {selectedGameType === 'alias' ? (
                <View style={styles.configCard}>
                  <Text style={styles.configLabel}>Час одного ходу (сек)</Text>
                  <View style={styles.chipsRow}>
                    {([30, 60, 90] as const).map((sec) => {
                      const active = aliasTimeSec === sec;
                      return (
                        <TouchableOpacity
                          key={sec}
                          style={[
                            styles.optionChip,
                            active && {
                              borderColor: COLORS.alias,
                              backgroundColor: `${COLORS.alias}25`,
                            },
                          ]}
                          onPress={() => {
                            Haptics.selectionAsync();
                            setAliasTimeSec(sec);
                          }}
                        >
                          <Text
                            style={[
                              styles.optionChipText,
                              active && { color: COLORS.textPrimary },
                            ]}
                          >
                            {sec} сек
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>

                  <Text style={[styles.configLabel, { marginTop: SPACING.md }]}>
                    Кількість раундів на кожну команду
                  </Text>
                  <View style={styles.chipsRow}>
                    {[1, 2, 3, 4].map((r) => {
                      const active = roundsPerTeam === r;
                      return (
                        <TouchableOpacity
                          key={r}
                          style={[
                            styles.optionChip,
                            active && {
                              borderColor: COLORS.alias,
                              backgroundColor: `${COLORS.alias}25`,
                            },
                          ]}
                          onPress={() => {
                            Haptics.selectionAsync();
                            setRoundsPerTeam(r);
                          }}
                        >
                          <Text
                            style={[
                              styles.optionChipText,
                              active && { color: COLORS.textPrimary },
                            ]}
                          >
                            {r} {r === 1 ? 'раунд' : 'раунди'}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>

                  <TouchableOpacity
                    activeOpacity={0.85}
                    style={styles.penaltyToggleRow}
                    onPress={() => {
                      Haptics.selectionAsync();
                      setAliasPenalty((p) => !p);
                    }}
                  >
                    <View style={styles.penaltyTextWrap}>
                      <View style={styles.penaltyTitleRow}>
                        <ShieldAlert size={15} color={COLORS.hot} />
                        <Text style={styles.penaltyTitle}>
                          Штраф за пропуск (-1 бал)
                        </Text>
                      </View>
                      <Text style={styles.penaltySub}>
                        Кожне пропущене слово віднімає 1 бал у команди
                      </Text>
                    </View>
                    <View
                      style={[
                        styles.togglePill,
                        aliasPenalty && styles.togglePillActive,
                      ]}
                    >
                      <Text style={styles.togglePillText}>
                        {aliasPenalty ? 'УВІМК' : 'ВИМК'}
                      </Text>
                    </View>
                  </TouchableOpacity>
                </View>
              ) : null}

              {selectedGameType === 'crocodile' ? (
                <View style={styles.configCard}>
                  <Text style={styles.configLabel}>Час на показ фрази</Text>
                  <View style={styles.chipsRow}>
                    {([60, 90, 120] as const).map((sec) => {
                      const active = crocodileTimeSec === sec;
                      return (
                        <TouchableOpacity
                          key={sec}
                          style={[
                            styles.optionChip,
                            active && {
                              borderColor: COLORS.crocodile,
                              backgroundColor: `${COLORS.crocodile}25`,
                            },
                          ]}
                          onPress={() => {
                            Haptics.selectionAsync();
                            setCrocodileTimeSec(sec);
                          }}
                        >
                          <Text
                            style={[
                              styles.optionChipText,
                              active && { color: COLORS.textPrimary },
                            ]}
                          >
                            {sec} сек
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>

                  <Text style={[styles.configLabel, { marginTop: SPACING.md }]}>
                    Кількість раундів на кожну команду
                  </Text>
                  <View style={styles.chipsRow}>
                    {[1, 2, 3, 4].map((r) => {
                      const active = roundsPerTeam === r;
                      return (
                        <TouchableOpacity
                          key={r}
                          style={[
                            styles.optionChip,
                            active && {
                              borderColor: COLORS.crocodile,
                              backgroundColor: `${COLORS.crocodile}25`,
                            },
                          ]}
                          onPress={() => {
                            Haptics.selectionAsync();
                            setRoundsPerTeam(r);
                          }}
                        >
                          <Text
                            style={[
                              styles.optionChipText,
                              active && { color: COLORS.textPrimary },
                            ]}
                          >
                            {r} {r === 1 ? 'раунд' : 'раунди'}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>
              ) : null}

              {selectedGameType === 'spy' ? (
                <View style={styles.configCard}>
                  <Text style={styles.configLabel}>Час на обговорення</Text>
                  <View style={styles.chipsRow}>
                    {([180, 300, 420] as const).map((sec) => {
                      const active = spyTimeSec === sec;
                      return (
                        <TouchableOpacity
                          key={sec}
                          style={[
                            styles.optionChip,
                            active && {
                              borderColor: COLORS.spy,
                              backgroundColor: `${COLORS.spy}25`,
                            },
                          ]}
                          onPress={() => {
                            Haptics.selectionAsync();
                            setSpyTimeSec(sec);
                          }}
                        >
                          <Text
                            style={[
                              styles.optionChipText,
                              active && { color: COLORS.textPrimary },
                            ]}
                          >
                            {sec / 60} хв
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>
              ) : null}
            </View>
        ) : null}

        {/* Deck Selection (for both Presets & Single Games) */}
        <View style={styles.section}>
          <View style={styles.sectionHeaderRow}>
            <View style={styles.sectionTitleGroup}>
              <Layers size={18} color={COLORS.primary} />
              <Text style={styles.sectionTitle}>Оберіть колоду</Text>
            </View>
          </View>

          <View style={styles.decksSelectList}>
            {allDecks.map((deck) => {
              const suitability = getDeckSuitability(deck);
              const isSelected = deck.id === selectedDeckId;
              const isDisabled = !suitability.isSupported;

              return (
                <TouchableOpacity
                  key={deck.id}
                  activeOpacity={0.85}
                  onPress={() => handleSelectDeck(deck)}
                  style={[
                    styles.deckSelectCard,
                    isSelected && {
                      borderColor: accentColor,
                      backgroundColor: `${accentColor}15`,
                    },
                    isDisabled && styles.deckSelectCardDisabled,
                  ]}
                >
                  <Text style={styles.deckSelectEmoji}>{deck.emoji}</Text>
                  <View style={styles.deckSelectInfo}>
                    <View style={styles.deckSelectTitleRow}>
                      <Text style={styles.deckSelectTitle} numberOfLines={1}>
                        {deck.title}
                      </Text>
                      {deck.isPremium ? (
                        <View style={styles.miniProBadge}>
                          <Crown size={10} color={COLORS.hot} />
                          <Text style={styles.miniProBadgeText}>
                            PRO (Безкоштовно в бета-версії)
                          </Text>
                        </View>
                      ) : null}
                    </View>
                    <Text
                      style={[
                        styles.deckSelectMeta,
                        isDisabled && { color: COLORS.spy },
                      ]}
                    >
                      {suitability.label}
                    </Text>
                  </View>
                  {isSelected ? (
                    <CheckCircle2 size={20} color={accentColor} />
                  ) : null}
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Team Editor (if Alias or Crocodile with team scoring) */}
        {hasTeamScoring ? (
          <View style={styles.section}>
            <View style={styles.sectionHeaderRow}>
              <View style={styles.sectionTitleGroup}>
                <Users size={18} color={COLORS.alias} />
                <Text style={styles.sectionTitle}>
                  Команди ({teams.length}/6)
                </Text>
              </View>

              <View style={styles.teamActionsGroup}>
                <TouchableOpacity
                  activeOpacity={0.8}
                  style={styles.randomNamesButton}
                  onPress={handleRandomizeTeamNames}
                >
                  <Dices size={14} color={COLORS.hot} />
                  <Text style={styles.randomNamesText}>Кумедні назви</Text>
                </TouchableOpacity>

                {teams.length < 6 ? (
                  <TouchableOpacity
                    activeOpacity={0.8}
                    style={styles.addTeamButton}
                    onPress={handleAddTeam}
                  >
                    <Plus size={14} color={COLORS.primary} />
                    <Text style={styles.addTeamText}>Додати</Text>
                  </TouchableOpacity>
                ) : null}
              </View>
            </View>

            <View style={styles.teamsList}>
              {teams.map((team, idx) => (
                <View key={team.id} style={styles.teamRow}>
                  <View style={styles.teamIndexBadge}>
                    <Text style={styles.teamIndexText}>{idx + 1}</Text>
                  </View>
                  <TextInput
                    style={styles.teamInput}
                    value={team.name}
                    onChangeText={(val) => handleRenameTeam(team.id, val)}
                    placeholder={`Команда ${idx + 1}`}
                    placeholderTextColor={COLORS.textSecondary}
                    maxLength={28}
                  />
                  {teams.length > 2 ? (
                    <TouchableOpacity
                      style={styles.removeTeamBtn}
                      onPress={() => handleRemoveTeam(team.id)}
                    >
                      <Trash2 size={16} color={COLORS.spy} />
                    </TouchableOpacity>
                  ) : null}
                </View>
              ))}
            </View>
          </View>
        ) : null}

        {/* Spy Settings (if Spy mode is present) */}
        {hasSpyMode ? (
          <View style={styles.section}>
            <View style={styles.sectionHeaderRow}>
              <View style={styles.sectionTitleGroup}>
                <EyeOff size={18} color={COLORS.spy} />
                <Text style={styles.sectionTitle}>Налаштування Шпигуна</Text>
              </View>
            </View>

            <View style={styles.spyConfigStack}>
              <View style={styles.stepperCard}>
                <View style={styles.stepperInfo}>
                  <Text style={styles.stepperTitle}>Гравців за столом</Text>
                  <Text style={styles.stepperSubtitle}>
                    Передаватимуть телефон по колу (від 3 до 12)
                  </Text>
                </View>

                <View style={styles.stepperControls}>
                  <TouchableOpacity
                    style={styles.stepperBtn}
                    onPress={() => handleAdjustPlayers(-1)}
                  >
                    <Minus size={16} color={COLORS.textPrimary} />
                  </TouchableOpacity>
                  <Text style={styles.stepperValue}>{playerCount}</Text>
                  <TouchableOpacity
                    style={styles.stepperBtn}
                    onPress={() => handleAdjustPlayers(1)}
                  >
                    <Plus size={16} color={COLORS.textPrimary} />
                  </TouchableOpacity>
                </View>
              </View>

              <View style={styles.stepperCard}>
                <View style={styles.stepperInfo}>
                  <Text style={styles.stepperTitle}>Кількість шпигунів</Text>
                  <Text style={styles.stepperSubtitle}>
                    {playerCount < 5
                      ? '2 шпигуни доступні від 5 гравців'
                      : 'Скільки самозванців не знатимуть локацію'}
                  </Text>
                </View>

                <View style={styles.spyCountPills}>
                  {([1, 2] as const).map((cnt) => {
                    const disabled = cnt === 2 && playerCount < 5;
                    const active = spyCount === cnt;
                    return (
                      <TouchableOpacity
                        key={cnt}
                        disabled={disabled}
                        onPress={() => {
                          Haptics.selectionAsync();
                          setSpyCount(cnt);
                        }}
                        style={[
                          styles.spyCountPill,
                          active && styles.spyCountPillActive,
                          disabled && { opacity: 0.35 },
                        ]}
                      >
                        <Text
                          style={[
                            styles.spyCountPillText,
                            active && { color: COLORS.textPrimary },
                          ]}
                        >
                          {cnt} 🕵️
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            </View>
          </View>
        ) : null}
      </ScrollView>

      {/* Footer CTA */}
      <View style={styles.footer}>
        <TouchableOpacity
          activeOpacity={0.85}
          style={[styles.startButton, { backgroundColor: accentColor }]}
          onPress={handleStartParty}
        >
          <Play
            size={20}
            color={COLORS.textPrimary}
            fill={COLORS.textPrimary}
          />
          <Text style={styles.startButtonText}>Почати вечірку</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  topBarTitle: {
    color: COLORS.textPrimary,
    fontSize: 17,
    fontWeight: '700',
  },
  topBarSpacer: {
    width: 40,
  },
  container: {
    flex: 1,
  },
  content: {
    paddingHorizontal: SPACING.xl,
    paddingTop: SPACING.xl,
    paddingBottom: SPACING.xxxl,
    gap: SPACING.xxl,
  },
  summaryCard: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.xl,
    borderWidth: 1.5,
    padding: SPACING.xl,
  },
  summaryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    marginBottom: SPACING.md,
  },
  emojiBadge: {
    width: 56,
    height: 56,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emojiText: {
    fontSize: 28,
  },
  summaryTitleBlock: {
    flex: 1,
  },
  modeTag: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
    marginBottom: 4,
  },
  summaryTitle: {
    color: COLORS.textPrimary,
    fontSize: 24,
    fontWeight: '800',
  },
  summarySubtitle: {
    color: COLORS.textSecondary,
    fontSize: 14,
    lineHeight: 20,
  },
  presetStepsWrap: {
    marginTop: SPACING.lg,
    paddingTop: SPACING.md,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    gap: SPACING.sm,
  },
  presetStepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    backgroundColor: COLORS.surfaceElevated,
    padding: SPACING.sm,
    borderRadius: RADIUS.md,
  },
  presetStepIndex: {
    width: 28,
    height: 28,
    borderRadius: RADIUS.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  presetStepIndexText: {
    fontSize: 13,
    fontWeight: '800',
  },
  presetStepTitle: {
    color: COLORS.textPrimary,
    fontSize: 14,
    fontWeight: '700',
  },
  presetStepMeta: {
    color: COLORS.textSecondary,
    fontSize: 12,
    marginTop: 1,
  },
  section: {
    gap: SPACING.md,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: SPACING.sm,
  },
  sectionTitleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sectionTitle: {
    color: COLORS.textPrimary,
    fontSize: 17,
    fontWeight: '700',
  },
  configCard: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: SPACING.lg,
  },
  configLabel: {
    color: COLORS.textSecondary,
    fontSize: 13,
    fontWeight: '600',
    marginBottom: SPACING.sm,
  },
  chipsRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  optionChip: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.surfaceElevated,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionChipText: {
    color: COLORS.textSecondary,
    fontSize: 13,
    fontWeight: '700',
  },
  penaltyToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: SPACING.lg,
    paddingTop: SPACING.md,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    gap: SPACING.md,
  },
  penaltyTextWrap: {
    flex: 1,
  },
  penaltyTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 2,
  },
  penaltyTitle: {
    color: COLORS.textPrimary,
    fontSize: 14,
    fontWeight: '700',
  },
  penaltySub: {
    color: COLORS.textSecondary,
    fontSize: 12,
  },
  togglePill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.surfaceElevated,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  togglePillActive: {
    backgroundColor: `${COLORS.hot}25`,
    borderColor: COLORS.hot,
  },
  togglePillText: {
    color: COLORS.textPrimary,
    fontSize: 11,
    fontWeight: '800',
  },
  decksSelectList: {
    gap: SPACING.sm,
  },
  deckSelectCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    padding: SPACING.md,
  },
  deckSelectCardDisabled: {
    opacity: 0.45,
  },
  deckSelectEmoji: {
    fontSize: 26,
  },
  deckSelectInfo: {
    flex: 1,
    gap: 2,
  },
  deckSelectTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  deckSelectTitle: {
    color: COLORS.textPrimary,
    fontSize: 15,
    fontWeight: '700',
  },
  miniProBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: `${COLORS.hot}22`,
    borderColor: `${COLORS.hot}66`,
    borderWidth: 1,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: RADIUS.full,
  },
  miniProBadgeText: {
    color: COLORS.hot,
    fontSize: 9,
    fontWeight: '800',
  },
  deckSelectMeta: {
    color: COLORS.textSecondary,
    fontSize: 12,
  },
  teamActionsGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  randomNamesButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: `${COLORS.hot}1A`,
    borderWidth: 1,
    borderColor: `${COLORS.hot}55`,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: RADIUS.full,
  },
  randomNamesText: {
    color: COLORS.hot,
    fontSize: 12,
    fontWeight: '700',
  },
  addTeamButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: COLORS.surfaceElevated,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: RADIUS.full,
  },
  addTeamText: {
    color: COLORS.primary,
    fontSize: 12,
    fontWeight: '700',
  },
  teamsList: {
    gap: SPACING.sm,
  },
  teamRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: SPACING.md,
    paddingVertical: 10,
  },
  teamIndexBadge: {
    width: 28,
    height: 28,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  teamIndexText: {
    color: COLORS.primary,
    fontSize: 13,
    fontWeight: '800',
  },
  teamInput: {
    flex: 1,
    color: COLORS.textPrimary,
    fontSize: 15,
    fontWeight: '600',
    paddingVertical: 4,
  },
  removeTeamBtn: {
    padding: 6,
  },
  spyConfigStack: {
    gap: SPACING.sm,
  },
  stepperCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: SPACING.lg,
    gap: SPACING.md,
  },
  stepperInfo: {
    flex: 1,
  },
  stepperTitle: {
    color: COLORS.textPrimary,
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 4,
  },
  stepperSubtitle: {
    color: COLORS.textSecondary,
    fontSize: 12,
    lineHeight: 17,
  },
  stepperControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    backgroundColor: COLORS.surfaceElevated,
    borderRadius: RADIUS.md,
    padding: 6,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  stepperBtn: {
    width: 34,
    height: 34,
    borderRadius: RADIUS.sm,
    backgroundColor: COLORS.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperValue: {
    color: COLORS.textPrimary,
    fontSize: 18,
    fontWeight: '800',
    minWidth: 24,
    textAlign: 'center',
  },
  spyCountPills: {
    flexDirection: 'row',
    gap: 8,
  },
  spyCountPill: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.surfaceElevated,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  spyCountPillActive: {
    borderColor: COLORS.spy,
    backgroundColor: `${COLORS.spy}28`,
  },
  spyCountPillText: {
    color: COLORS.textSecondary,
    fontSize: 14,
    fontWeight: '800',
  },
  footer: {
    paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.md,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    backgroundColor: COLORS.background,
  },
  startButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 16,
    borderRadius: RADIUS.lg,
  },
  startButtonText: {
    color: COLORS.textPrimary,
    fontSize: 17,
    fontWeight: '800',
  },
});
