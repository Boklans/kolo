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
  Plus,
  Shuffle,
  SlidersHorizontal,
  Trash2,
  User,
  X,
} from 'lucide-react-native';
import { QuickRulesModal } from '@/components/game/QuickRulesModal';
import { COLORS, RADIUS, SPACING } from '@/constants/theme';
import { OFFICIAL_DECKS, useDeckStore } from '@/stores/useDeckStore';
import { usePartyStore } from '@/stores/usePartyStore';
import { Deck, SpyStep } from '@/types';
import { triggerHaptic } from '@/utils/sound';

const DECK_ART_MAP: Record<string, any> = {
  base_ua: require('../../../assets/images/cards/deck_base.webp'),
  warmup_ua: require('../../../assets/images/cards/deck_warmup.webp'),
  memes_ua: require('../../../assets/images/cards/deck_memes.webp'),
  it_office_ua: require('../../../assets/images/cards/deck_it.webp'),
  adult_18_ua: require('../../../assets/images/cards/deck_adult.webp'),
};

const DEFAULT_PLAYERS = ['Ігор', 'Аня', 'Макс', 'Оля', 'Діма'];

interface SpyLobbyScreenProps {
  onBack: () => void;
  onStartSession: () => void;
}

export function SpyLobbyScreen({
  onBack,
  onStartSession,
}: SpyLobbyScreenProps) {
  const customDecks = useDeckStore((s) => s.customDecks);
  const savedTeamNames = usePartyStore((s) => s.savedTeamNames);
  const savedTeamMascots = usePartyStore((s) => s.savedTeamMascots);
  const savedPlayerNames = usePartyStore((s) => s.savedPlayerNames);
  const startSession = usePartyStore((s) => s.startSession);

  const compatibleDecks = useMemo<Deck[]>(
    () =>
      [...OFFICIAL_DECKS, ...customDecks].filter(
        (d) => (d.items.spyLocations?.length ?? 0) > 0
      ),
    [customDecks]
  );

  const [players, setPlayers] = useState<{ id: string; name: string }[]>(() => {
    const initial =
      savedPlayerNames && savedPlayerNames.length >= 3
        ? savedPlayerNames.slice(0, 12)
        : DEFAULT_PLAYERS;
    return initial.map((name, idx) => ({
      id: `player_${idx + 1}`,
      name,
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

  const [discussionTimeSec, setDiscussionTimeSec] = useState<180 | 300 | 420>(
    300
  );
  const [spyCount, setSpyCount] = useState<1 | 2>(1);
  const [missionsEnabled, setMissionsEnabled] = useState<boolean>(false);

  const [isRulesSheetOpen, setIsRulesSheetOpen] = useState(false);
  const [isQuickRulesOpen, setIsQuickRulesOpen] = useState(false);

  const canUseTwoSpies = players.length >= 6;
  const effectiveSpyCount: 1 | 2 = canUseTwoSpies ? spyCount : 1;

  const totalSelectedLocations = useMemo(() => {
    return compatibleDecks
      .filter((d) => selectedDeckIds.includes(d.id))
      .reduce((acc, deck) => acc + (deck.items.spyLocations?.length ?? 0), 0);
  }, [compatibleDecks, selectedDeckIds]);

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

  const handleRenamePlayer = (playerId: string, nextName: string) => {
    setPlayers((prev) =>
      prev.map((p) => (p.id === playerId ? { ...p, name: nextName } : p))
    );
  };

  const handleAddPlayer = () => {
    if (players.length >= 12) return;
    triggerHaptic('light');
    setPlayers((prev) => [
      ...prev,
      {
        id: `player_${Date.now()}`,
        name: `Гравець ${prev.length + 1}`,
      },
    ]);
  };

  const handleRemovePlayer = (playerId: string) => {
    if (players.length <= 3) return;
    triggerHaptic('light');
    setPlayers((prev) => {
      const next = prev.filter((p) => p.id !== playerId);
      if (next.length < 6) {
        setSpyCount(1);
      }
      return next;
    });
  };

  const handleShuffleOrder = () => {
    triggerHaptic('medium');
    setPlayers((prev) => [...prev].sort(() => Math.random() - 0.5));
  };

  const handleStartGame = () => {
    triggerHaptic('success');
    const cleanNames = players.map(
      (p, idx) => p.name.trim() || `Гравець ${idx + 1}`
    );
    const primaryDeckId = selectedDeckIds[0] ?? 'base_ua';

    const step: SpyStep = {
      id: `lobby_spy_${Date.now()}`,
      gameType: 'spy',
      deckId: primaryDeckId,
      deckIds: selectedDeckIds,
      spyCount: effectiveSpyCount,
      discussionTimeSec,
      missionsEnabled,
      scoring: { type: 'none' },
    };

    startSession({
      title: 'ШПИГУН',
      steps: [step],
      teamNames: savedTeamNames?.length >= 2 ? savedTeamNames : ['Мирні', 'Шпигун'],
      teamMascots: savedTeamMascots,
      playerCount: cleanNames.length,
      playerNames: cleanNames,
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
          <Text style={[styles.headerTitle, { color: COLORS.spy }]}>ШПИГУН</Text>
          <Text style={styles.headerSubtitle}>
            Знайди того, хто не знає локацію
          </Text>
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
        {/* Summary Pill */}
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={() => {
            triggerHaptic('selection');
            setIsRulesSheetOpen(true);
          }}
          style={styles.settingsSummaryCard}
        >
          <View style={styles.settingsSummaryLeft}>
            <SlidersHorizontal size={16} color={COLORS.spy} />
            <Text style={styles.settingsSummaryText}>
              {Math.round(discussionTimeSec / 60)} хв ·{' '}
              {effectiveSpyCount === 1 ? '1 шпигун' : '2 шпигуни'}
              {missionsEnabled ? ' · Місії' : ''}
            </Text>
          </View>
          <Text style={[styles.settingsEditLabel, { color: COLORS.spy }]}>
            Змінити
          </Text>
        </TouchableOpacity>

        {/* Players Section */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>ГРАВЦІ ({players.length}/12)</Text>
          <TouchableOpacity onPress={handleShuffleOrder} style={styles.shuffleBtn}>
            <Shuffle size={14} color={COLORS.spy} />
            <Text style={[styles.shuffleBtnText, { color: COLORS.spy }]}>
              Перемішати
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.playersList}>
          {players.map((player, idx) => (
            <View key={player.id} style={styles.playerRow}>
              <View style={styles.playerAvatar}>
                <User size={16} color={COLORS.spy} />
              </View>
              <TextInput
                value={player.name}
                onChangeText={(txt) => handleRenamePlayer(player.id, txt)}
                placeholder={`Гравець ${idx + 1}`}
                placeholderTextColor={COLORS.textMuted}
                style={styles.playerInput}
                maxLength={22}
              />
              {players.length > 3 && (
                <TouchableOpacity
                  onPress={() => handleRemovePlayer(player.id)}
                  style={styles.removePlayerBtn}
                >
                  <Trash2 size={16} color={COLORS.textMuted} />
                </TouchableOpacity>
              )}
            </View>
          ))}

          {players.length < 12 && (
            <TouchableOpacity
              onPress={handleAddPlayer}
              style={styles.addPlayerBtn}
            >
              <Plus size={16} color={COLORS.textSecondary} />
              <Text style={styles.addPlayerText}>Додати гравця</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Decks Section */}
        <View style={[styles.sectionHeader, { marginTop: SPACING.xl }]}>
          <Text style={styles.sectionTitle}>
            ЛОКАЦІЇ ({selectedDeckIds.length})
          </Text>
          <Text style={styles.sectionMeta}>
            {totalSelectedLocations} локацій
          </Text>
        </View>

        <View style={styles.decksGrid}>
          {compatibleDecks.map((deck) => {
            const isSelected = selectedDeckIds.includes(deck.id);
            const artSource = DECK_ART_MAP[deck.id];
            const itemCount = deck.items.spyLocations?.length ?? 0;

            return (
              <TouchableOpacity
                key={deck.id}
                activeOpacity={0.85}
                onPress={() => handleToggleDeck(deck.id)}
                style={[
                  styles.deckCard,
                  isSelected && {
                    borderColor: COLORS.spy,
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
                          backgroundColor: COLORS.spy,
                          borderColor: COLORS.spy,
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
                  <Text style={styles.deckCount}>{itemCount} локацій</Text>
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
            { backgroundColor: COLORS.spy, borderBottomColor: COLORS.lipSpy },
          ]}
        >
          <Text style={styles.startBtnText}>РОЗДАТИ РОЛІ</Text>
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
              <Text style={styles.modalTitle}>Налаштування Шпигуна</Text>
              <TouchableOpacity
                onPress={() => setIsRulesSheetOpen(false)}
                style={styles.iconBtn}
              >
                <X size={18} color={COLORS.textPrimary} />
              </TouchableOpacity>
            </View>

            <View style={styles.settingBlock}>
              <Text style={styles.settingLabel}>Час обговорення</Text>
              <View style={styles.pillRow}>
                {([180, 300, 420] as const).map((sec) => {
                  const active = discussionTimeSec === sec;
                  return (
                    <TouchableOpacity
                      key={sec}
                      onPress={() => {
                        triggerHaptic('selection');
                        setDiscussionTimeSec(sec);
                      }}
                      style={[
                        styles.optionPill,
                        active && {
                          backgroundColor: COLORS.spy,
                          borderColor: COLORS.spy,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.optionPillText,
                          active && styles.optionPillTextActive,
                        ]}
                      >
                        {Math.round(sec / 60)} хв
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            <View style={styles.settingBlock}>
              <Text style={styles.settingLabel}>
                Кількість шпигунів {!canUseTwoSpies ? '(від 6 гравців)' : ''}
              </Text>
              <View style={styles.pillRow}>
                {([1, 2] as const).map((count) => {
                  const disabled = count === 2 && !canUseTwoSpies;
                  const active = effectiveSpyCount === count;
                  return (
                    <TouchableOpacity
                      key={count}
                      disabled={disabled}
                      onPress={() => {
                        triggerHaptic('selection');
                        setSpyCount(count);
                      }}
                      style={[
                        styles.optionPill,
                        active && {
                          backgroundColor: COLORS.spy,
                          borderColor: COLORS.spy,
                        },
                        disabled && { opacity: 0.4 },
                      ]}
                    >
                      <Text
                        style={[
                          styles.optionPillText,
                          active && styles.optionPillTextActive,
                        ]}
                      >
                        {count === 1 ? '1 шпигун' : '2 шпигуни'}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            <View style={styles.switchRow}>
              <View style={styles.switchTextWrap}>
                <Text style={styles.switchTitle}>Таємні місії</Text>
                <Text style={styles.switchSub}>
                  Кожен гравець отримує додаткове секретне завдання
                </Text>
              </View>
              <Switch
                value={missionsEnabled}
                onValueChange={(v) => {
                  triggerHaptic('selection');
                  setMissionsEnabled(v);
                }}
                trackColor={{ false: COLORS.border, true: COLORS.spy }}
              />
            </View>

            <TouchableOpacity
              onPress={() => setIsRulesSheetOpen(false)}
              style={[styles.modalDoneBtn, { backgroundColor: COLORS.spy }]}
            >
              <Text style={styles.modalDoneText}>Готово</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <QuickRulesModal
        visible={isQuickRulesOpen}
        gameType="spy"
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
  playersList: {
    gap: SPACING.sm,
  },
  playerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    padding: SPACING.sm,
    gap: SPACING.sm,
  },
  playerAvatar: {
    width: 36,
    height: 36,
    borderRadius: RADIUS.sm,
    backgroundColor: COLORS.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playerInput: {
    flex: 1,
    color: COLORS.textPrimary,
    fontSize: 15,
    fontWeight: '700',
    paddingVertical: 4,
  },
  removePlayerBtn: {
    padding: SPACING.sm,
  },
  addPlayerBtn: {
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
  addPlayerText: {
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
});
