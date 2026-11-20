import React, { useMemo, useState } from 'react';
import {
  Modal,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Check,
  Dices,
  Minus,
  Plus,
  Shuffle,
  SlidersHorizontal,
  Trash2,
  X,
} from 'lucide-react-native';
import { QuickRulesModal } from '@/components/game/QuickRulesModal';
import {
  TEAM_MASCOTS,
  getTeamMascot,
  guessMascotIdFromName,
} from '@/constants/mascots';
import { COLORS, RADIUS, SPACING } from '@/constants/theme';
import { OFFICIAL_DECKS, useDeckStore } from '@/stores/useDeckStore';
import { usePartyStore } from '@/stores/usePartyStore';
import {
  AliasStep,
  CrocodileStep,
  Deck,
  PresetStep,
  RoundTimeSec,
  TabooStep,
} from '@/types';
import {
  MAX_ROUNDS_PER_TEAM,
  MIN_ROUNDS_PER_TEAM,
  ROUND_TIME_OPTIONS,
  formatLaps,
} from '@/utils/formatters';
import { triggerHaptic } from '@/utils/sound';

type TeamGameMode = 'alias' | 'taboo' | 'crocodile';

const DECK_ART_MAP: Record<string, any> = {
  base_ua: require('../../../assets/images/cards/deck_base.webp'),
  warmup_ua: require('../../../assets/images/cards/deck_warmup.webp'),
  memes_ua: require('../../../assets/images/cards/deck_memes.webp'),
  it_office_ua: require('../../../assets/images/cards/deck_it.webp'),
  adult_18_ua: require('../../../assets/images/cards/deck_adult.webp'),
};

const FUNNY_TEAM_NAMES = [
  'Бойові Гуси',
  'Хмільні Сови',
  'Дикі Капібари',
  'Неонові Дракони',
  'Шалені Бобри',
  'Космічні Вареники',
  'Кібер-Козаки',
  'Пекельні Сирники',
  'Таємні Грибники',
  'Нічні Лиси',
];

const GAME_META: Record<
  TeamGameMode,
  {
    title: string;
    subtitle: string;
    accent: string;
    lip: string;
    itemLabel: string;
    defaultTime: RoundTimeSec;
  }
> = {
  alias: {
    title: 'ЕЛІАС',
    subtitle: 'Пояснюй слова команді на швидкість',
    accent: COLORS.alias,
    lip: COLORS.lipAlias,
    itemLabel: 'слів',
    defaultTime: 60,
  },
  taboo: {
    title: 'ТАБУ',
    subtitle: 'Поясни слово, оминаючи заборонені',
    accent: COLORS.taboo,
    lip: COLORS.lipTaboo,
    itemLabel: 'карток',
    defaultTime: 60,
  },
  crocodile: {
    title: 'КРОКОДИЛ',
    subtitle: 'Показуй фрази жестами без жодного слова',
    accent: COLORS.crocodile,
    lip: COLORS.lipCrocodile,
    itemLabel: 'фраз',
    defaultTime: 60,
  },
};

interface TeamGameLobbyProps {
  gameType: TeamGameMode;
  onBack: () => void;
  onStartSession: () => void;
}

export function TeamGameLobby({
  gameType,
  onBack,
  onStartSession,
}: TeamGameLobbyProps) {
  const meta = GAME_META[gameType];
  const customDecks = useDeckStore((s) => s.customDecks);
  const savedTeamNames = usePartyStore((s) => s.savedTeamNames);
  const savedTeamMascots = usePartyStore((s) => s.savedTeamMascots);
  const savedPlayerNames = usePartyStore((s) => s.savedPlayerNames);
  const startSession = usePartyStore((s) => s.startSession);

  const compatibleDecks = useMemo<Deck[]>(
    () =>
      [...OFFICIAL_DECKS, ...customDecks].filter(
        (d) => (d.items[gameType]?.length ?? 0) > 0
      ),
    [customDecks, gameType]
  );

  const [teams, setTeams] = useState(() => {
    const baseNames =
      savedTeamNames && savedTeamNames.length >= 2
        ? savedTeamNames.slice(0, 4)
        : ['Бойові Гуси', 'Хмільні Сови'];
    return baseNames.map((name, idx) => ({
      id: `team_${idx + 1}`,
      name,
      mascotId: savedTeamMascots?.[idx] ?? guessMascotIdFromName(name, idx),
    }));
  });

  const [selectedDeckIds, setSelectedDeckIds] = useState<string[]>(() => {
    const hasBase = compatibleDecks.some((d) => d.id === 'base_ua');
    return hasBase
      ? ['base_ua']
      : compatibleDecks[0]
        ? [compatibleDecks[0].id]
        : ['base_ua'];
  });

  const [roundTimeSec, setRoundTimeSec] = useState<RoundTimeSec>(
    meta.defaultTime
  );
  const [roundsPerTeam, setRoundsPerTeam] = useState<number>(2);
  const [minDifficulty, setMinDifficulty] = useState<1 | 2>(1);

  // Game-specific options
  const [penaltyForSkip, setPenaltyForSkip] = useState<boolean>(false);
  const [lastWordForAll, setLastWordForAll] = useState<boolean>(false);
  const [penaltyForTaboo, setPenaltyForTaboo] = useState<boolean>(true);
  const [crocodileMode, setCrocodileMode] = useState<'timed' | 'single'>(
    'timed'
  );

  const [isRulesSheetOpen, setIsRulesSheetOpen] = useState(false);
  const [isQuickRulesOpen, setIsQuickRulesOpen] = useState(false);
  const [isShufflerOpen, setIsShufflerOpen] = useState(false);
  const [guestPoolText, setGuestPoolText] = useState(() =>
    savedPlayerNames && savedPlayerNames.length >= 2
      ? savedPlayerNames.join(', ')
      : ''
  );
  const [assignedMembers, setAssignedMembers] = useState<
    Record<string, string[]>
  >({});

  const totalSelectedItems = useMemo(() => {
    return compatibleDecks
      .filter((d) => selectedDeckIds.includes(d.id))
      .reduce((acc, deck) => {
        const items = deck.items[gameType] ?? [];
        if (minDifficulty > 1) {
          const filtered = items.filter(
            (item: any) => (item.difficulty ?? 1) >= minDifficulty
          );
          return acc + (filtered.length > 0 ? filtered.length : items.length);
        }
        return acc + items.length;
      }, 0);
  }, [compatibleDecks, selectedDeckIds, gameType, minDifficulty]);

  const handleToggleDeck = (deckId: string) => {
    triggerHaptic('selection');
    setSelectedDeckIds((prev) => {
      if (prev.includes(deckId)) {
        if (prev.length === 1) return prev;
        return prev.filter((id) => id !== deckId);
      }
      return [...prev, deckId];
    });
  };

  const handleCycleMascot = (teamId: string) => {
    triggerHaptic('selection');
    setTeams((prev) =>
      prev.map((team, idx) => {
        if (team.id !== teamId) return team;
        const currentMascot = getTeamMascot(team.mascotId, team.name, idx);
        const curIdx = TEAM_MASCOTS.findIndex((m) => m.id === currentMascot.id);
        const nextMascot = TEAM_MASCOTS[(curIdx + 1) % TEAM_MASCOTS.length];
        return { ...team, mascotId: nextMascot.id };
      })
    );
  };

  const handleRenameTeam = (teamId: string, nextName: string) => {
    setTeams((prev) =>
      prev.map((t) => (t.id === teamId ? { ...t, name: nextName } : t))
    );
  };

  const handleAddTeam = () => {
    if (teams.length >= 4) return;
    triggerHaptic('light');
    const usedNames = new Set(teams.map((t) => t.name.toLowerCase()));
    const available = FUNNY_TEAM_NAMES.filter(
      (n) => !usedNames.has(n.toLowerCase())
    );
    const nextName = available[0] ?? `Команда ${teams.length + 1}`;
    setTeams((prev) => [
      ...prev,
      {
        id: `team_${Date.now()}`,
        name: nextName,
        mascotId: guessMascotIdFromName(nextName, prev.length),
      },
    ]);
  };

  const handleRemoveTeam = (teamId: string) => {
    if (teams.length <= 2) return;
    triggerHaptic('light');
    setTeams((prev) => prev.filter((t) => t.id !== teamId));
  };

  const handleShuffleGuests = () => {
    const names = guestPoolText
      .split(/[,;\n]+/)
      .map((s) => s.trim())
      .filter(Boolean);
    if (names.length < 2) return;
    triggerHaptic('success');
    const shuffled = [...names].sort(() => Math.random() - 0.5);
    const nextMap: Record<string, string[]> = {};
    teams.forEach((t) => {
      nextMap[t.id] = [];
    });
    shuffled.forEach((name, idx) => {
      const targetTeam = teams[idx % teams.length];
      if (targetTeam) {
        nextMap[targetTeam.id].push(name);
      }
    });
    setAssignedMembers(nextMap);
    setIsShufflerOpen(false);
  };

  const handleStartGame = () => {
    triggerHaptic('success');
    const cleanTeamNames = teams.map(
      (t, idx) => t.name.trim() || `Команда ${idx + 1}`
    );
    const teamMascots = teams.map((t) => t.mascotId);
    const primaryDeckId = selectedDeckIds[0] ?? 'base_ua';

    let step: PresetStep;
    if (gameType === 'alias') {
      const aliasStep: AliasStep = {
        id: `lobby_alias_${Date.now()}`,
        gameType: 'alias',
        deckId: primaryDeckId,
        deckIds: selectedDeckIds,
        minDifficulty,
        roundTimeSec,
        penaltyForSkip,
        lastWordForAll,
        roundsPerTeam,
        scoring: { type: 'team', groupId: 'main' },
      };
      step = aliasStep;
    } else if (gameType === 'taboo') {
      const tabooStep: TabooStep = {
        id: `lobby_taboo_${Date.now()}`,
        gameType: 'taboo',
        deckId: primaryDeckId,
        deckIds: selectedDeckIds,
        minDifficulty,
        roundTimeSec,
        penaltyForTaboo,
        roundsPerTeam,
        scoring: { type: 'team', groupId: 'main' },
      };
      step = tabooStep;
    } else {
      const crocStep: CrocodileStep = {
        id: `lobby_crocodile_${Date.now()}`,
        gameType: 'crocodile',
        deckId: primaryDeckId,
        deckIds: selectedDeckIds,
        minDifficulty,
        roundTimeSec,
        roundsPerTeam,
        mode: crocodileMode,
        penaltyForSkip,
        scoring: { type: 'team', groupId: 'main' },
      };
      step = crocStep;
    }

    const guestNames = guestPoolText
      .split(/[,;\n]+/)
      .map((s) => s.trim())
      .filter(Boolean);

    startSession({
      title: meta.title,
      steps: [step],
      teamNames: cleanTeamNames,
      teamMascots,
      playerCount: Math.max(4, guestNames.length || cleanTeamNames.length * 2),
      playerNames: guestNames.length >= 3 ? guestNames : undefined,
    });
    onStartSession();
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      {/* Top Bar */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => {
            triggerHaptic('selection');
            onBack();
          }}
          style={styles.iconBtn}
          accessibilityLabel="Назад"
        >
          <ArrowLeft size={20} color={COLORS.textPrimary} />
        </TouchableOpacity>

        <View style={styles.headerCenter}>
          <Text style={[styles.headerTitle, { color: meta.accent }]}>
            {meta.title}
          </Text>
          <Text style={styles.headerSubtitle}>{meta.subtitle}</Text>
        </View>

        <View style={styles.headerActions}>
          <TouchableOpacity
            onPress={() => {
              triggerHaptic('selection');
              setIsQuickRulesOpen(true);
            }}
            style={styles.iconBtn}
            accessibilityLabel="Правила"
          >
            <BookOpen size={18} color={COLORS.textPrimary} />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => {
              triggerHaptic('selection');
              setIsRulesSheetOpen(true);
            }}
            style={styles.iconBtn}
            accessibilityLabel="Налаштування"
          >
            <SlidersHorizontal size={18} color={COLORS.textPrimary} />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Quick Rules / Settings Summary Pill */}
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={() => {
            triggerHaptic('selection');
            setIsRulesSheetOpen(true);
          }}
          style={styles.settingsSummaryCard}
        >
          <View style={styles.settingsSummaryLeft}>
            <SlidersHorizontal size={16} color={meta.accent} />
            <Text style={styles.settingsSummaryText}>
              {gameType === 'crocodile' && crocodileMode === 'single'
                ? '1 фраза на хід'
                : `${roundTimeSec} сек`}
              {' · '}
              {formatLaps(roundsPerTeam)}
              {minDifficulty > 1 ? ' · Складніше' : ''}
            </Text>
          </View>
          <Text style={[styles.settingsEditLabel, { color: meta.accent }]}>
            Змінити
          </Text>
        </TouchableOpacity>

        {/* Teams Section */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>КОМАНДИ ({teams.length}/4)</Text>
          <TouchableOpacity
            onPress={() => {
              triggerHaptic('selection');
              setIsShufflerOpen(true);
            }}
            style={styles.shuffleBtn}
          >
            <Dices size={14} color={meta.accent} />
            <Text style={[styles.shuffleBtnText, { color: meta.accent }]}>
              Розбити гостей
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.teamsList}>
          {teams.map((team, idx) => {
            const mascot = getTeamMascot(team.mascotId, team.name, idx);
            const members = assignedMembers[team.id] ?? [];
            return (
              <View key={team.id} style={styles.teamRow}>
                <TouchableOpacity
                  onPress={() => handleCycleMascot(team.id)}
                  style={[
                    styles.mascotBtn,
                    { borderColor: `${meta.accent}55` },
                  ]}
                  accessibilityLabel="Змінити маскот"
                >
                  <Text style={styles.mascotEmoji}>{mascot.emoji}</Text>
                </TouchableOpacity>

                <View style={styles.teamInputWrap}>
                  <TextInput
                    value={team.name}
                    onChangeText={(txt) => handleRenameTeam(team.id, txt)}
                    placeholder={`Команда ${idx + 1}`}
                    placeholderTextColor={COLORS.textMuted}
                    style={styles.teamInput}
                    maxLength={24}
                  />
                  {members.length > 0 && (
                    <Text style={styles.membersText} numberOfLines={1}>
                      {members.join(', ')}
                    </Text>
                  )}
                </View>

                {teams.length > 2 && (
                  <TouchableOpacity
                    onPress={() => handleRemoveTeam(team.id)}
                    style={styles.removeTeamBtn}
                    accessibilityLabel="Видалити команду"
                  >
                    <Trash2 size={16} color={COLORS.textMuted} />
                  </TouchableOpacity>
                )}
              </View>
            );
          })}

          {teams.length < 4 && (
            <TouchableOpacity
              onPress={handleAddTeam}
              style={styles.addTeamBtn}
            >
              <Plus size={16} color={COLORS.textSecondary} />
              <Text style={styles.addTeamText}>Додати команду</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Decks Section */}
        <View style={[styles.sectionHeader, { marginTop: SPACING.xl }]}>
          <Text style={styles.sectionTitle}>
            КОЛОДИ ({selectedDeckIds.length})
          </Text>
          <Text style={styles.sectionMeta}>
            {totalSelectedItems} {meta.itemLabel}
          </Text>
        </View>

        <View style={styles.decksGrid}>
          {compatibleDecks.map((deck) => {
            const isSelected = selectedDeckIds.includes(deck.id);
            const artSource = DECK_ART_MAP[deck.id];
            const itemCount = deck.items[gameType]?.length ?? 0;

            return (
              <TouchableOpacity
                key={deck.id}
                activeOpacity={0.85}
                onPress={() => handleToggleDeck(deck.id)}
                style={[
                  styles.deckCard,
                  isSelected && {
                    borderColor: meta.accent,
                    backgroundColor: COLORS.surfaceElevated,
                  },
                ]}
              >
                {artSource && (
                  <Image
                    source={artSource}
                    style={StyleSheet.absoluteFill}
                    contentFit="cover"
                  />
                )}
                <LinearGradient
                  colors={[
                    'rgba(10, 10, 18, 0.78)',
                    'rgba(10, 10, 18, 0.92)',
                  ]}
                  style={StyleSheet.absoluteFill}
                />
                <View style={styles.deckCardContent}>
                  <View style={styles.deckTopRow}>
                    <Text style={styles.deckEmoji}>{deck.emoji}</Text>
                    <View
                      style={[
                        styles.deckCheck,
                        isSelected && {
                          backgroundColor: meta.accent,
                          borderColor: meta.accent,
                        },
                      ]}
                    >
                      {isSelected && (
                        <Check size={12} color="#FFF" strokeWidth={3} />
                      )}
                    </View>
                  </View>
                  <Text style={styles.deckTitle} numberOfLines={1}>
                    {deck.title}
                  </Text>
                  <Text style={styles.deckCount}>
                    {itemCount} {meta.itemLabel}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      </ScrollView>

      {/* Bottom Start CTA */}
      <View style={styles.footer}>
        <TouchableOpacity
          activeOpacity={0.9}
          onPress={handleStartGame}
          style={[
            styles.startBtn,
            { backgroundColor: meta.accent, borderBottomColor: meta.lip },
          ]}
        >
          <Text style={styles.startBtnText}>ПОЧАТИ ГРУ</Text>
          <ArrowRight size={20} color="#FFF" strokeWidth={2.6} />
        </TouchableOpacity>
      </View>

      {/* Settings Sheet Modal */}
      <Modal
        visible={isRulesSheetOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setIsRulesSheetOpen(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Налаштування раунду</Text>
              <TouchableOpacity
                onPress={() => setIsRulesSheetOpen(false)}
                style={styles.iconBtn}
              >
                <X size={18} color={COLORS.textPrimary} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              {gameType === 'crocodile' && (
                <View style={styles.settingBlock}>
                  <Text style={styles.settingLabel}>Формат гри</Text>
                  <View style={styles.pillRow}>
                    {(
                      [
                        { id: 'timed', label: 'На час (бліц)' },
                        { id: 'single', label: '1 фраза на хід' },
                      ] as const
                    ).map((opt) => {
                      const active = crocodileMode === opt.id;
                      return (
                        <TouchableOpacity
                          key={opt.id}
                          onPress={() => {
                            triggerHaptic('selection');
                            setCrocodileMode(opt.id);
                          }}
                          style={[
                            styles.optionPill,
                            active && {
                              backgroundColor: meta.accent,
                              borderColor: meta.accent,
                            },
                          ]}
                        >
                          <Text
                            style={[
                              styles.optionPillText,
                              active && styles.optionPillTextActive,
                            ]}
                          >
                            {opt.label}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>
              )}

              {!(gameType === 'crocodile' && crocodileMode === 'single') && (
                <View style={styles.settingBlock}>
                  <Text style={styles.settingLabel}>Час раунду (сек)</Text>
                  <View style={styles.pillRow}>
                    {ROUND_TIME_OPTIONS.map((sec) => {
                      const active = roundTimeSec === sec;
                      return (
                        <TouchableOpacity
                          key={sec}
                          onPress={() => {
                            triggerHaptic('selection');
                            setRoundTimeSec(sec);
                          }}
                          style={[
                            styles.optionPill,
                            active && {
                              backgroundColor: meta.accent,
                              borderColor: meta.accent,
                            },
                          ]}
                        >
                          <Text
                            style={[
                              styles.optionPillText,
                              active && styles.optionPillTextActive,
                            ]}
                          >
                            {sec}с
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>
              )}

              <View style={styles.settingBlock}>
                <Text style={styles.settingLabel}>Кількість кіл</Text>
                <View style={styles.stepperRow}>
                  <TouchableOpacity
                    onPress={() => {
                      if (roundsPerTeam <= MIN_ROUNDS_PER_TEAM) return;
                      triggerHaptic('selection');
                      setRoundsPerTeam((r) => r - 1);
                    }}
                    style={styles.stepperBtn}
                  >
                    <Minus size={18} color={COLORS.textPrimary} />
                  </TouchableOpacity>
                  <Text style={styles.stepperValue}>
                    {formatLaps(roundsPerTeam)}
                  </Text>
                  <TouchableOpacity
                    onPress={() => {
                      if (roundsPerTeam >= MAX_ROUNDS_PER_TEAM) return;
                      triggerHaptic('selection');
                      setRoundsPerTeam((r) => r + 1);
                    }}
                    style={styles.stepperBtn}
                  >
                    <Plus size={18} color={COLORS.textPrimary} />
                  </TouchableOpacity>
                </View>
              </View>

              <View style={styles.settingBlock}>
                <Text style={styles.settingLabel}>Складність слів</Text>
                <View style={styles.pillRow}>
                  {(
                    [
                      { id: 1, label: 'Усі слова' },
                      { id: 2, label: 'Складніше (2★+)' },
                    ] as const
                  ).map((opt) => {
                    const active = minDifficulty === opt.id;
                    return (
                      <TouchableOpacity
                        key={opt.id}
                        onPress={() => {
                          triggerHaptic('selection');
                          setMinDifficulty(opt.id);
                        }}
                        style={[
                          styles.optionPill,
                          active && {
                            backgroundColor: meta.accent,
                            borderColor: meta.accent,
                          },
                        ]}
                      >
                        <Text
                          style={[
                            styles.optionPillText,
                            active && styles.optionPillTextActive,
                          ]}
                        >
                          {opt.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              {gameType === 'alias' && (
                <>
                  <View style={styles.switchRow}>
                    <View style={styles.switchTextWrap}>
                      <Text style={styles.switchTitle}>Штраф за пас (−1)</Text>
                      <Text style={styles.switchSub}>
                        Пропуск слова віднімає 1 бал
                      </Text>
                    </View>
                    <Switch
                      value={penaltyForSkip}
                      onValueChange={(v) => {
                        triggerHaptic('selection');
                        setPenaltyForSkip(v);
                      }}
                      trackColor={{ false: COLORS.border, true: meta.accent }}
                    />
                  </View>

                  <View style={styles.switchRow}>
                    <View style={styles.switchTextWrap}>
                      <Text style={styles.switchTitle}>
                        Останнє слово для всіх
                      </Text>
                      <Text style={styles.switchSub}>
                        Після 0:00 суперники можуть перехопити бал
                      </Text>
                    </View>
                    <Switch
                      value={lastWordForAll}
                      onValueChange={(v) => {
                        triggerHaptic('selection');
                        setLastWordForAll(v);
                      }}
                      trackColor={{ false: COLORS.border, true: meta.accent }}
                    />
                  </View>
                </>
              )}

              {gameType === 'taboo' && (
                <View style={styles.switchRow}>
                  <View style={styles.switchTextWrap}>
                    <Text style={styles.switchTitle}>Штраф за табу (−1)</Text>
                    <Text style={styles.switchSub}>
                      Сказане заборонене слово забирає 1 бал
                    </Text>
                  </View>
                  <Switch
                    value={penaltyForTaboo}
                    onValueChange={(v) => {
                      triggerHaptic('selection');
                      setPenaltyForTaboo(v);
                    }}
                    trackColor={{ false: COLORS.border, true: meta.accent }}
                  />
                </View>
              )}

              {gameType === 'crocodile' && crocodileMode === 'timed' && (
                <View style={styles.switchRow}>
                  <View style={styles.switchTextWrap}>
                    <Text style={styles.switchTitle}>Штраф за пас (−1)</Text>
                    <Text style={styles.switchSub}>
                      Пропуск фрази віднімає 1 бал
                    </Text>
                  </View>
                  <Switch
                    value={penaltyForSkip}
                    onValueChange={(v) => {
                      triggerHaptic('selection');
                      setPenaltyForSkip(v);
                    }}
                    trackColor={{ false: COLORS.border, true: meta.accent }}
                  />
                </View>
              )}
            </ScrollView>

            <TouchableOpacity
              onPress={() => setIsRulesSheetOpen(false)}
              style={[styles.modalDoneBtn, { backgroundColor: meta.accent }]}
            >
              <Text style={styles.modalDoneText}>Готово</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Guest Shuffler Modal */}
      <Modal
        visible={isShufflerOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setIsShufflerOpen(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Розбити гостей по командах</Text>
              <TouchableOpacity
                onPress={() => setIsShufflerOpen(false)}
                style={styles.iconBtn}
              >
                <X size={18} color={COLORS.textPrimary} />
              </TouchableOpacity>
            </View>
            <Text style={styles.shufflerHint}>
              Впиши імена через кому — ми випадково розподілимо їх між
              командами.
            </Text>
            <TextInput
              value={guestPoolText}
              onChangeText={setGuestPoolText}
              placeholder="Ігор, Аня, Макс, Оля, Діма..."
              placeholderTextColor={COLORS.textMuted}
              multiline
              style={styles.shufflerInput}
            />
            <TouchableOpacity
              onPress={handleShuffleGuests}
              style={[styles.modalDoneBtn, { backgroundColor: meta.accent }]}
            >
              <Shuffle size={16} color="#FFF" />
              <Text style={styles.modalDoneText}>Перемішати</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <QuickRulesModal
        visible={isQuickRulesOpen}
        gameType={gameType}
        onClose={() => setIsQuickRulesOpen(false)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: SPACING.sm,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: 1.2,
  },
  headerSubtitle: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  headerActions: {
    flexDirection: 'row',
    gap: SPACING.xs,
  },
  iconBtn: {
    width: 38,
    height: 38,
    borderRadius: RADIUS.sm,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: SPACING.lg,
    paddingBottom: 110,
  },
  settingsSummaryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
    marginBottom: SPACING.xl,
  },
  settingsSummaryLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  settingsSummaryText: {
    color: COLORS.textPrimary,
    fontSize: 14,
    fontWeight: '600',
  },
  settingsEditLabel: {
    fontSize: 13,
    fontWeight: '700',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: SPACING.md,
  },
  sectionTitle: {
    color: COLORS.textMuted,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1.1,
  },
  sectionMeta: {
    color: COLORS.textSecondary,
    fontSize: 12,
    fontWeight: '600',
  },
  shuffleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
  },
  shuffleBtnText: {
    fontSize: 12,
    fontWeight: '700',
  },
  teamsList: {
    gap: SPACING.sm,
  },
  teamRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    padding: SPACING.sm,
    gap: SPACING.sm,
  },
  mascotBtn: {
    width: 44,
    height: 44,
    borderRadius: RADIUS.sm,
    backgroundColor: COLORS.surfaceElevated,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mascotEmoji: {
    fontSize: 22,
  },
  teamInputWrap: {
    flex: 1,
  },
  teamInput: {
    color: COLORS.textPrimary,
    fontSize: 15,
    fontWeight: '700',
    paddingVertical: 4,
  },
  membersText: {
    color: COLORS.textMuted,
    fontSize: 12,
    marginTop: 2,
  },
  removeTeamBtn: {
    padding: SPACING.sm,
  },
  addTeamBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.xs,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    paddingVertical: SPACING.md,
    marginTop: 2,
  },
  addTeamText: {
    color: COLORS.textSecondary,
    fontSize: 14,
    fontWeight: '600',
  },
  decksGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
  },
  deckCard: {
    width: '48.5%',
    minHeight: 108,
    borderRadius: RADIUS.md,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    overflow: 'hidden',
    backgroundColor: COLORS.surface,
  },
  deckCardContent: {
    flex: 1,
    padding: SPACING.md,
    justifyContent: 'space-between',
  },
  deckTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  deckEmoji: {
    fontSize: 22,
  },
  deckCheck: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  deckTitle: {
    color: COLORS.textPrimary,
    fontSize: 14,
    fontWeight: '800',
    marginTop: SPACING.sm,
  },
  deckCount: {
    color: COLORS.textSecondary,
    fontSize: 12,
    marginTop: 2,
  },
  footer: {
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    backgroundColor: COLORS.background,
  },
  startBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    paddingVertical: 16,
    borderRadius: RADIUS.lg,
    borderBottomWidth: 4,
  },
  startBtnText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: 1,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.72)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: RADIUS.xl,
    borderTopRightRadius: RADIUS.xl,
    padding: SPACING.lg,
    maxHeight: '85%',
    borderTopWidth: 1,
    borderColor: COLORS.border,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: SPACING.lg,
  },
  modalTitle: {
    color: COLORS.textPrimary,
    fontSize: 18,
    fontWeight: '800',
  },
  settingBlock: {
    marginBottom: SPACING.lg,
  },
  settingLabel: {
    color: COLORS.textSecondary,
    fontSize: 13,
    fontWeight: '700',
    marginBottom: SPACING.sm,
  },
  pillRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.xs,
  },
  optionPill: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.sm,
    backgroundColor: COLORS.surfaceElevated,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  optionPillText: {
    color: COLORS.textSecondary,
    fontSize: 13,
    fontWeight: '700',
  },
  optionPillTextActive: {
    color: '#FFF',
  },
  stepperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
  },
  stepperBtn: {
    width: 42,
    height: 42,
    borderRadius: RADIUS.sm,
    backgroundColor: COLORS.surfaceElevated,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperValue: {
    color: COLORS.textPrimary,
    fontSize: 16,
    fontWeight: '800',
    minWidth: 72,
    textAlign: 'center',
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: SPACING.md,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  switchTextWrap: {
    flex: 1,
    paddingRight: SPACING.md,
  },
  switchTitle: {
    color: COLORS.textPrimary,
    fontSize: 15,
    fontWeight: '700',
  },
  switchSub: {
    color: COLORS.textMuted,
    fontSize: 12,
    marginTop: 2,
  },
  modalDoneBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.xs,
    paddingVertical: 14,
    borderRadius: RADIUS.md,
    marginTop: SPACING.md,
  },
  modalDoneText: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '800',
  },
  shufflerHint: {
    color: COLORS.textSecondary,
    fontSize: 13,
    marginBottom: SPACING.md,
  },
  shufflerInput: {
    backgroundColor: COLORS.surfaceSubtle,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    color: COLORS.textPrimary,
    padding: SPACING.md,
    minHeight: 90,
    textAlignVertical: 'top',
    fontSize: 14,
  },
});
