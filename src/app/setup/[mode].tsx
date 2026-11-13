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
  Check,
  Dices,
  Minus,
  Plus,
  Trash2,
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
  { title: string; accentColor: string; subtitle: string }
> = {
  alias: {
    title: 'Еліас',
    accentColor: COLORS.alias,
    subtitle: 'Пояснюй слова іншими словами, поки йде таймер.',
  },
  crocodile: {
    title: 'Крокодил',
    accentColor: COLORS.crocodile,
    subtitle: 'Покажи фразу жестами та мімікою без жодного звуку.',
  },
  spy: {
    title: 'Шпигун',
    accentColor: COLORS.spy,
    subtitle: 'Усі знають локацію, крім одного. Знайдіть шпигуна за столом.',
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
            : 'Локації з Бази'
        );
      }

      return {
        isSupported: true,
        label: parts.join(' · '),
      };
    }

    const count = getDeckCountForGame(deck, selectedGameType);
    if (count > 0) {
      return {
        isSupported: true,
        label: `${count} карток для цього режиму`,
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
          activeOpacity={0.75}
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <ArrowLeft size={20} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.topBarOverline}>ПІДГОТОВКА ГРИ</Text>
        <View style={styles.topBarSpacer} />
      </View>

      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Editorial Hero Summary */}
        <View style={styles.summaryBlock}>
          <View style={[styles.summaryAccentBar, { backgroundColor: accentColor }]} />
          <View style={styles.summaryInner}>
            <Text style={[styles.modeTag, { color: accentColor }]}>
              {isPresetMode ? 'ВАЙБ-ПРЕСЕТ' : 'ОКРЕМА ГРА'}
            </Text>
            <Text style={styles.summaryTitle}>{headerTitle}</Text>
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
                      <Text
                        style={[
                          styles.presetStepIndexText,
                          { color: GAME_META[step.gameType].accentColor },
                        ]}
                      >
                        0{idx + 1}
                      </Text>
                      <View style={styles.presetStepInfo}>
                        <Text style={styles.presetStepTitle}>
                          {GAME_META[step.gameType].title}
                        </Text>
                        <Text style={styles.presetStepMeta}>
                          {displayDeck.title} ·{' '}
                          {step.gameType === 'spy'
                            ? `${step.discussionTimeSec / 60} хв обговорення`
                            : `${step.roundTimeSec} сек · ${step.roundsPerTeam} кола`}
                        </Text>
                      </View>
                    </View>
                  );
                })}
              </View>
            ) : null}
          </View>
        </View>

        {/* Single Game Settings: Round Parameters */}
        {!isPresetMode ? (
          <View style={styles.section}>
            <Text style={styles.sectionOverline}>ПАРАМЕТРИ РАУНДУ</Text>

            {selectedGameType === 'alias' ? (
              <View style={styles.configBlock}>
                <Text style={styles.configLabel}>Час одного ходу</Text>
                <View style={styles.chipsRow}>
                  {([30, 60, 90] as const).map((sec) => {
                    const active = aliasTimeSec === sec;
                    return (
                      <TouchableOpacity
                        key={sec}
                        activeOpacity={0.8}
                        style={[
                          styles.optionChip,
                          active && { backgroundColor: COLORS.alias },
                        ]}
                        onPress={() => {
                          Haptics.selectionAsync();
                          setAliasTimeSec(sec);
                        }}
                      >
                        <Text
                          style={[
                            styles.optionChipText,
                            active && styles.optionChipTextActive,
                          ]}
                        >
                          {sec} сек
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                <Text style={[styles.configLabel, { marginTop: SPACING.lg }]}>
                  Кількість раундів на команду
                </Text>
                <View style={styles.chipsRow}>
                  {[1, 2, 3, 4].map((r) => {
                    const active = roundsPerTeam === r;
                    return (
                      <TouchableOpacity
                        key={r}
                        activeOpacity={0.8}
                        style={[
                          styles.optionChip,
                          active && { backgroundColor: COLORS.alias },
                        ]}
                        onPress={() => {
                          Haptics.selectionAsync();
                          setRoundsPerTeam(r);
                        }}
                      >
                        <Text
                          style={[
                            styles.optionChipText,
                            active && styles.optionChipTextActive,
                          ]}
                        >
                          {r} {r === 1 ? 'коло' : 'кола'}
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
                    <Text style={styles.penaltyTitle}>
                      Штраф за пропуск (−1 бал)
                    </Text>
                    <Text style={styles.penaltySub}>
                      Кожне пропущене слово віднімає 1 бал
                    </Text>
                  </View>
                  <View
                    style={[
                      styles.togglePill,
                      aliasPenalty && styles.togglePillActive,
                    ]}
                  >
                    <Text
                      style={[
                        styles.togglePillText,
                        aliasPenalty && { color: COLORS.textPrimary },
                      ]}
                    >
                      {aliasPenalty ? 'УВІМК' : 'ВИМК'}
                    </Text>
                  </View>
                </TouchableOpacity>
              </View>
            ) : null}

            {selectedGameType === 'crocodile' ? (
              <View style={styles.configBlock}>
                <Text style={styles.configLabel}>Час на показ фрази</Text>
                <View style={styles.chipsRow}>
                  {([60, 90, 120] as const).map((sec) => {
                    const active = crocodileTimeSec === sec;
                    return (
                      <TouchableOpacity
                        key={sec}
                        activeOpacity={0.8}
                        style={[
                          styles.optionChip,
                          active && { backgroundColor: COLORS.crocodile },
                        ]}
                        onPress={() => {
                          Haptics.selectionAsync();
                          setCrocodileTimeSec(sec);
                        }}
                      >
                        <Text
                          style={[
                            styles.optionChipText,
                            active && styles.optionChipTextActive,
                          ]}
                        >
                          {sec} сек
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                <Text style={[styles.configLabel, { marginTop: SPACING.lg }]}>
                  Кількість раундів на команду
                </Text>
                <View style={styles.chipsRow}>
                  {[1, 2, 3, 4].map((r) => {
                    const active = roundsPerTeam === r;
                    return (
                      <TouchableOpacity
                        key={r}
                        activeOpacity={0.8}
                        style={[
                          styles.optionChip,
                          active && { backgroundColor: COLORS.crocodile },
                        ]}
                        onPress={() => {
                          Haptics.selectionAsync();
                          setRoundsPerTeam(r);
                        }}
                      >
                        <Text
                          style={[
                            styles.optionChipText,
                            active && styles.optionChipTextActive,
                          ]}
                        >
                          {r} {r === 1 ? 'коло' : 'кола'}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            ) : null}

            {selectedGameType === 'spy' ? (
              <View style={styles.configBlock}>
                <Text style={styles.configLabel}>Час на обговорення</Text>
                <View style={styles.chipsRow}>
                  {([180, 300, 420] as const).map((sec) => {
                    const active = spyTimeSec === sec;
                    return (
                      <TouchableOpacity
                        key={sec}
                        activeOpacity={0.8}
                        style={[
                          styles.optionChip,
                          active && { backgroundColor: COLORS.spy },
                        ]}
                        onPress={() => {
                          Haptics.selectionAsync();
                          setSpyTimeSec(sec);
                        }}
                      >
                        <Text
                          style={[
                            styles.optionChipText,
                            active && styles.optionChipTextActive,
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

        {/* Deck Selection */}
        <View style={styles.section}>
          <Text style={styles.sectionOverline}>ОБЕРІТЬ КОЛОДУ</Text>

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
                    isSelected && styles.deckSelectCardSelected,
                    isDisabled && styles.deckSelectCardDisabled,
                  ]}
                >
                  {isSelected ? (
                    <View
                      style={[
                        styles.deckSelectedAccent,
                        { backgroundColor: accentColor },
                      ]}
                    />
                  ) : null}
                  <Text style={styles.deckSelectEmoji}>{deck.emoji}</Text>
                  <View style={styles.deckSelectInfo}>
                    <View style={styles.deckSelectTitleRow}>
                      <Text style={styles.deckSelectTitle} numberOfLines={1}>
                        {deck.title}
                      </Text>
                      {deck.isPremium ? (
                        <Text style={styles.miniProLabel}>PRO · БЕТА</Text>
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
                    <View
                      style={[
                        styles.deckCheckCircle,
                        { backgroundColor: accentColor },
                      ]}
                    >
                      <Check size={14} color={COLORS.textPrimary} strokeWidth={3} />
                    </View>
                  ) : null}
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Team Editor */}
        {hasTeamScoring ? (
          <View style={styles.section}>
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionOverline}>
                КОМАНДИ ({teams.length} / 6)
              </Text>

              <View style={styles.teamActionsGroup}>
                <TouchableOpacity
                  activeOpacity={0.8}
                  style={styles.subtleActionPill}
                  onPress={handleRandomizeTeamNames}
                >
                  <Dices size={13} color={COLORS.textPrimary} />
                  <Text style={styles.subtleActionText}>Випадкові назви</Text>
                </TouchableOpacity>

                {teams.length < 6 ? (
                  <TouchableOpacity
                    activeOpacity={0.8}
                    style={styles.subtleActionPill}
                    onPress={handleAddTeam}
                  >
                    <Plus size={13} color={COLORS.textPrimary} />
                    <Text style={styles.subtleActionText}>Додати</Text>
                  </TouchableOpacity>
                ) : null}
              </View>
            </View>

            <View style={styles.teamsList}>
              {teams.map((team, idx) => (
                <View key={team.id} style={styles.teamRow}>
                  <Text style={styles.teamIndexText}>0{idx + 1}</Text>
                  <TextInput
                    style={styles.teamInput}
                    value={team.name}
                    onChangeText={(val) => handleRenameTeam(team.id, val)}
                    placeholder={`Команда ${idx + 1}`}
                    placeholderTextColor={COLORS.textMuted}
                    maxLength={28}
                  />
                  {teams.length > 2 ? (
                    <TouchableOpacity
                      style={styles.removeTeamBtn}
                      onPress={() => handleRemoveTeam(team.id)}
                    >
                      <Trash2 size={15} color={COLORS.textMuted} />
                    </TouchableOpacity>
                  ) : null}
                </View>
              ))}
            </View>
          </View>
        ) : null}

        {/* Spy Settings */}
        {hasSpyMode ? (
          <View style={styles.section}>
            <Text style={styles.sectionOverline}>НАЛАШТУВАННЯ ШПИГУНА</Text>

            <View style={styles.spyConfigStack}>
              <View style={styles.stepperCard}>
                <View style={styles.stepperInfo}>
                  <Text style={styles.stepperTitle}>Гравців за столом</Text>
                  <Text style={styles.stepperSubtitle}>
                    Від 3 до 12 учасників по колу
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
                      : 'Скільки гравців не знатимуть локацію'}
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
                          disabled && { opacity: 0.3 },
                        ]}
                      >
                        <Text
                          style={[
                            styles.spyCountPillText,
                            active && { color: COLORS.textPrimary },
                          ]}
                        >
                          {cnt}
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
          <Text style={styles.startButtonText}>Почати гру</Text>
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
    paddingVertical: SPACING.sm,
  },
  backButton: {
    width: 38,
    height: 38,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  topBarOverline: {
    color: COLORS.textMuted,
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 1.4,
  },
  topBarSpacer: {
    width: 38,
  },
  container: {
    flex: 1,
  },
  content: {
    paddingHorizontal: SPACING.xl,
    paddingTop: SPACING.md,
    paddingBottom: SPACING.xxxl,
    gap: SPACING.xxl,
  },
  summaryBlock: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    overflow: 'hidden',
    position: 'relative',
  },
  summaryAccentBar: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 4,
  },
  summaryInner: {
    padding: SPACING.xl,
    paddingLeft: SPACING.xl + 4,
  },
  modeTag: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 1.4,
    marginBottom: 6,
  },
  summaryTitle: {
    color: COLORS.textPrimary,
    fontSize: 28,
    fontWeight: '700',
    letterSpacing: -0.7,
    marginBottom: 6,
  },
  summarySubtitle: {
    color: COLORS.textSecondary,
    fontSize: 14,
    lineHeight: 20,
  },
  presetStepsWrap: {
    marginTop: SPACING.lg,
    paddingTop: SPACING.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: COLORS.border,
    gap: 10,
  },
  presetStepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    backgroundColor: COLORS.surfaceElevated,
    paddingVertical: 10,
    paddingHorizontal: SPACING.md,
    borderRadius: RADIUS.sm,
  },
  presetStepIndexText: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.6,
    fontVariant: ['tabular-nums'],
  },
  presetStepInfo: {
    flex: 1,
  },
  presetStepTitle: {
    color: COLORS.textPrimary,
    fontSize: 14,
    fontWeight: '600',
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
  sectionOverline: {
    color: COLORS.textMuted,
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 1.4,
  },
  configBlock: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
  },
  configLabel: {
    color: COLORS.textSecondary,
    fontSize: 13,
    fontWeight: '500',
    marginBottom: SPACING.sm,
  },
  chipsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  optionChip: {
    flex: 1,
    paddingVertical: 11,
    borderRadius: RADIUS.sm,
    backgroundColor: COLORS.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionChipText: {
    color: COLORS.textSecondary,
    fontSize: 13,
    fontWeight: '600',
  },
  optionChipTextActive: {
    color: COLORS.textPrimary,
  },
  penaltyToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: SPACING.lg,
    paddingTop: SPACING.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: COLORS.border,
    gap: SPACING.md,
  },
  penaltyTextWrap: {
    flex: 1,
  },
  penaltyTitle: {
    color: COLORS.textPrimary,
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 2,
  },
  penaltySub: {
    color: COLORS.textSecondary,
    fontSize: 12,
  },
  togglePill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: RADIUS.sm,
    backgroundColor: COLORS.surfaceElevated,
  },
  togglePillActive: {
    backgroundColor: COLORS.hot,
  },
  togglePillText: {
    color: COLORS.textSecondary,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.6,
  },
  decksSelectList: {
    gap: 8,
  },
  deckSelectCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    overflow: 'hidden',
    position: 'relative',
  },
  deckSelectCardSelected: {
    backgroundColor: COLORS.surfaceElevated,
  },
  deckSelectedAccent: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 4,
  },
  deckSelectCardDisabled: {
    opacity: 0.4,
  },
  deckSelectEmoji: {
    fontSize: 24,
    marginLeft: 2,
  },
  deckSelectInfo: {
    flex: 1,
    gap: 2,
  },
  deckSelectTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  deckSelectTitle: {
    color: COLORS.textPrimary,
    fontSize: 15,
    fontWeight: '600',
  },
  miniProLabel: {
    color: COLORS.hot,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.8,
  },
  deckSelectMeta: {
    color: COLORS.textSecondary,
    fontSize: 12,
  },
  deckCheckCircle: {
    width: 24,
    height: 24,
    borderRadius: RADIUS.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  teamActionsGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  subtleActionPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: COLORS.surface,
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: RADIUS.full,
  },
  subtleActionText: {
    color: COLORS.textPrimary,
    fontSize: 12,
    fontWeight: '500',
  },
  teamsList: {
    gap: 8,
  },
  teamRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: 10,
  },
  teamIndexText: {
    color: COLORS.textMuted,
    fontSize: 12,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  teamInput: {
    flex: 1,
    color: COLORS.textPrimary,
    fontSize: 15,
    fontWeight: '500',
    paddingVertical: 4,
  },
  removeTeamBtn: {
    padding: 6,
  },
  spyConfigStack: {
    gap: 8,
  },
  stepperCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md,
    padding: SPACING.lg,
    gap: SPACING.md,
  },
  stepperInfo: {
    flex: 1,
  },
  stepperTitle: {
    color: COLORS.textPrimary,
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 2,
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
    borderRadius: RADIUS.sm,
    padding: 4,
  },
  stepperBtn: {
    width: 32,
    height: 32,
    borderRadius: RADIUS.sm,
    backgroundColor: COLORS.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperValue: {
    color: COLORS.textPrimary,
    fontSize: 16,
    fontWeight: '700',
    minWidth: 22,
    textAlign: 'center',
    fontVariant: ['tabular-nums'],
  },
  spyCountPills: {
    flexDirection: 'row',
    gap: 8,
  },
  spyCountPill: {
    minWidth: 44,
    paddingVertical: 10,
    borderRadius: RADIUS.sm,
    backgroundColor: COLORS.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  spyCountPillActive: {
    backgroundColor: COLORS.spy,
  },
  spyCountPillText: {
    color: COLORS.textSecondary,
    fontSize: 15,
    fontWeight: '700',
  },
  footer: {
    paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.md,
    backgroundColor: COLORS.background,
  },
  startButton: {
    height: 56,
    borderRadius: RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  startButtonText: {
    color: COLORS.textPrimary,
    fontSize: 16,
    fontWeight: '600',
  },
});
