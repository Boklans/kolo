import React, { useMemo, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import {
  ClipboardPaste,
  Download,
  Eye,
  Pencil,
  Plus,
  RotateCcw,
  Share2,
  Trash2,
  X,
} from 'lucide-react-native';
import { COLORS, RADIUS, SPACING } from '@/constants/theme';
import {
  CustomDeckTargetMode,
  OFFICIAL_DECKS,
  parseRawDeckText,
  useDeckStore,
} from '@/stores/useDeckStore';
import { useUsedContentStore } from '@/stores/useUsedContentStore';
import { Deck } from '@/types';

const EMOJI_OPTIONS = ['🃏', '🍻', '🔥', '🌶️', '🐸', '💻', '🍕', '🎬', '🎸', '🚀', '🦄', '💣'];

const TARGET_MODES: { id: CustomDeckTargetMode; label: string }[] = [
  { id: 'both', label: 'Обидва режими' },
  { id: 'alias', label: 'Тільки Еліас' },
  { id: 'crocodile', label: 'Тільки Крокодил' },
];

export default function DecksScreen() {
  const customDecks = useDeckStore((s) => s.customDecks);
  const createCustomDeck = useDeckStore((s) => s.createCustomDeck);
  const updateCustomDeck = useDeckStore((s) => s.updateCustomDeck);
  const deleteCustomDeck = useDeckStore((s) => s.deleteCustomDeck);

  const usedMap = useUsedContentStore((s) => s.used);
  const resetDeckHistory = useUsedContentStore((s) => s.resetDeckHistory);

  const [isModalVisible, setModalVisible] = useState(false);
  const [editingDeckId, setEditingDeckId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [selectedEmoji, setSelectedEmoji] = useState('🃏');
  const [targetMode, setTargetMode] = useState<CustomDeckTargetMode>('both');
  const [rawText, setRawText] = useState('');

  const [previewDeck, setPreviewDeck] = useState<Deck | null>(null);
  const [previewTab, setPreviewTab] = useState<'alias' | 'crocodile' | 'spy'>('alias');

  const parsedPreviewItems = useMemo(() => parseRawDeckText(rawText), [rawText]);

  const openModal = (prefillSample = false) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setEditingDeckId(null);
    setTitle('');
    setSelectedEmoji('🃏');
    setTargetMode('both');
    if (prefillSample) {
      setRawText('');
    }
    setModalVisible(true);
  };

  const handleEditCustomDeck = (deck: Deck) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const hasAlias = deck.items.alias.length > 0;
    const hasCroc = deck.items.crocodile.length > 0;
    const mode: CustomDeckTargetMode =
      hasAlias && hasCroc ? 'both' : hasAlias ? 'alias' : 'crocodile';

    const words = hasAlias
      ? deck.items.alias.map((item) => item.word)
      : deck.items.crocodile.map((item) => item.phrase);

    setEditingDeckId(deck.id);
    setTitle(deck.title);
    setSelectedEmoji(deck.emoji);
    setTargetMode(mode);
    setRawText(words.join('\n'));
    setPreviewDeck(null);
    setModalVisible(true);
  };

  const handleOpenPreview = (deck: Deck) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (deck.items.alias.length > 0) {
      setPreviewTab('alias');
    } else if (deck.items.crocodile.length > 0) {
      setPreviewTab('crocodile');
    } else {
      setPreviewTab('spy');
    }
    setPreviewDeck(deck);
  };

  const handleShareOrCopyDeck = async (deck: Deck) => {
    const words =
      deck.items.alias.length > 0
        ? deck.items.alias.map((i) => i.word)
        : deck.items.crocodile.map((i) => i.phrase);

    if (words.length === 0) return;

    const listText = words.join('\n');
    await Clipboard.setStringAsync(listText);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    try {
      await Share.share({
        message: `${deck.emoji} Колода KOLO «${deck.title}» (${words.length} карток)\n\nСкопіюй список нижче та встав у «Колоди → Швидкий імпорт»:\n\n${listText}`,
      });
    } catch {
      Alert.alert(
        'Скопійовано в буфер обміну',
        `Список із ${words.length} карток колоди «${deck.title}» скопійовано! Можете надіслати його друзям.`
      );
    }
  };

  const handlePasteFromClipboard = async () => {
    try {
      const text = await Clipboard.getStringAsync();
      if (!text || !text.trim()) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        Alert.alert('Буфер порожній', 'Скопіюйте список слів (кожне з нового рядка) та спробуйте ще раз.');
        return;
      }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setRawText((prev) => (prev.trim() ? `${prev.trim()}\n${text.trim()}` : text.trim()));
    } catch {
      Alert.alert('Помилка', 'Не вдалося прочитати буфер обміну.');
    }
  };

  const handleRemovePreviewChip = (wordToRemove: string) => {
    Haptics.selectionAsync();
    const remaining = parsedPreviewItems.filter(
      (item) => item.toLowerCase() !== wordToRemove.toLowerCase()
    );
    setRawText(remaining.join('\n'));
  };

  const handleSaveCustomDeck = () => {
    if (parsedPreviewItems.length === 0) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Немає карток', 'Додайте хоча б одне слово або фразу довжиною від 2 символів.');
      return;
    }

    const deckTitle = title.trim() || `Кастомна колода #${customDecks.length + 1}`;
    const payload = {
      title: deckTitle,
      emoji: selectedEmoji,
      rawText: parsedPreviewItems.join('\n'),
      targetMode,
    };

    const saved = editingDeckId
      ? updateCustomDeck(editingDeckId, payload)
      : createCustomDeck(payload);

    if (saved) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setModalVisible(false);
      setEditingDeckId(null);
      setRawText('');
      setTitle('');
    }
  };

  const handleDeleteCustomDeck = (deck: Deck) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Alert.alert(
      'Видалити колоду?',
      `Ви впевнені, що хочете видалити колоду «${deck.title}»?`,
      [
        { text: 'Скасувати', style: 'cancel' },
        {
          text: 'Видалити',
          style: 'destructive',
          onPress: () => {
            deleteCustomDeck(deck.id);
            resetDeckHistory(deck.id);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          },
        },
      ]
    );
  };

  const handleResetDeckUsed = (deck: Deck) => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    resetDeckHistory(deck.id);
  };

  const renderDeckCard = (deck: Deck) => {
    const deckUsed = usedMap[deck.id];
    const usedCount =
      (deckUsed?.alias?.length ?? 0) +
      (deckUsed?.crocodile?.length ?? 0) +
      (deckUsed?.spyLocations?.length ?? 0);

    const accentStripColor = deck.isCustom
      ? COLORS.hot
      : deck.isPremium
        ? COLORS.primary
        : COLORS.alias;

    return (
      <TouchableOpacity
        key={deck.id}
        activeOpacity={0.88}
        onPress={() => handleOpenPreview(deck)}
        style={styles.deckCard}
      >
        <View
          style={[
            styles.deckAccentStrip,
            { backgroundColor: accentStripColor },
          ]}
        />

        <View style={styles.deckInner}>
          <View style={styles.deckTopRow}>
            <Text style={styles.emoji}>{deck.emoji}</Text>

            <View style={styles.deckTitleWrap}>
              <View style={styles.deckOverlineRow}>
                <Text
                  style={[
                    styles.deckTypeTag,
                    { color: deck.isCustom || deck.isPremium ? COLORS.hot : COLORS.textMuted },
                  ]}
                >
                  {deck.isCustom
                    ? 'ВЛАСНА КОЛОДА'
                    : deck.isPremium
                      ? 'PRO · БЕЗКОШТОВНО В БЕТА'
                      : 'ОФІЦІЙНА КОЛОДА'}
                </Text>

                {usedCount > 0 ? (
                  <TouchableOpacity
                    style={styles.resetHistoryChip}
                    onPress={() => handleResetDeckUsed(deck)}
                  >
                    <RotateCcw size={11} color={COLORS.textSecondary} />
                    <Text style={styles.resetHistoryText}>
                      Зіграно {usedCount} · скинути
                    </Text>
                  </TouchableOpacity>
                ) : null}
              </View>

              <Text style={styles.deckTitle} numberOfLines={1}>
                {deck.title}
              </Text>
            </View>

            <View style={styles.deckIconActions}>
              <TouchableOpacity
                style={styles.iconActionBtn}
                onPress={() => handleOpenPreview(deck)}
                hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}
              >
                <Eye size={16} color={COLORS.textSecondary} />
              </TouchableOpacity>

              {deck.isCustom ? (
                <>
                  <TouchableOpacity
                    style={styles.iconActionBtn}
                    onPress={() => handleEditCustomDeck(deck)}
                    hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}
                  >
                    <Pencil size={15} color={COLORS.textPrimary} />
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.iconActionBtn}
                    onPress={() => handleShareOrCopyDeck(deck)}
                    hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}
                  >
                    <Share2 size={15} color={COLORS.crocodile} />
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.iconActionBtn}
                    onPress={() => handleDeleteCustomDeck(deck)}
                    hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}
                  >
                    <Trash2 size={15} color={COLORS.spy} />
                  </TouchableOpacity>
                </>
              ) : null}
            </View>
          </View>

          {deck.description ? (
            <Text style={styles.deckDescription}>{deck.description}</Text>
          ) : null}

          <View style={styles.inlineStatsRow}>
            <Text style={styles.inlineStatItem}>
              <Text style={styles.inlineStatNumber}>{deck.items.alias.length}</Text>{' '}
              Еліас
            </Text>
            <Text style={styles.inlineStatDot}>·</Text>
            <Text style={styles.inlineStatItem}>
              <Text style={styles.inlineStatNumber}>{deck.items.crocodile.length}</Text>{' '}
              Крокодил
            </Text>
            <Text style={styles.inlineStatDot}>·</Text>
            <Text style={styles.inlineStatItem}>
              <Text style={styles.inlineStatNumber}>
                {deck.items.spyLocations.length}
              </Text>{' '}
              Шпигун
            </Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Editorial Header */}
        <View style={styles.header}>
          <Text style={styles.overline}>КОЛЕКЦІЯ СЛІВ</Text>
          <Text style={styles.title}>Колоди</Text>
        </View>

        {/* Action Buttons */}
        <View style={styles.actionsRow}>
          <TouchableOpacity
            activeOpacity={0.85}
            style={[styles.actionButton, styles.primaryActionButton]}
            onPress={() => openModal(false)}
          >
            <Plus size={17} color={COLORS.textPrimary} />
            <Text style={styles.primaryActionText}>Нова колода</Text>
          </TouchableOpacity>

          <TouchableOpacity
            activeOpacity={0.85}
            style={[styles.actionButton, styles.secondaryActionButton]}
            onPress={() => openModal(true)}
          >
            <Download size={17} color={COLORS.textPrimary} />
            <Text style={styles.secondaryActionText}>Швидкий імпорт</Text>
          </TouchableOpacity>
        </View>

        {/* Custom Decks Section */}
        {customDecks.length > 0 ? (
          <View style={styles.sectionBlock}>
            <Text style={styles.sectionOverline}>
              ВЛАСНІ КОЛОДИ · {customDecks.length}
            </Text>
            <View style={styles.decksList}>{customDecks.map(renderDeckCard)}</View>
          </View>
        ) : null}

        {/* Official Decks Section */}
        <View style={styles.sectionBlock}>
          <Text style={styles.sectionOverline}>
            ОФІЦІЙНІ КОЛОДИ KOLO · {OFFICIAL_DECKS.length}
          </Text>
          <View style={styles.decksList}>{OFFICIAL_DECKS.map(renderDeckCard)}</View>
        </View>
      </ScrollView>

      {/* Modal: Quick Import / Create Custom Deck */}
      <Modal
        visible={isModalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setModalVisible(false)}
      >
        <SafeAreaView style={styles.modalSafeArea} edges={['top', 'bottom']}>
          <KeyboardAvoidingView
            style={styles.modalFlex}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          >
            {/* Modal Header */}
            <View style={styles.modalHeader}>
              <Text style={styles.modalHeaderTitle}>
                {editingDeckId ? 'Редагувати колоду' : 'Нова колода'}
              </Text>
              <TouchableOpacity
                style={styles.closeBtn}
                onPress={() => {
                  setModalVisible(false);
                  setEditingDeckId(null);
                }}
              >
                <X size={18} color={COLORS.textSecondary} />
              </TouchableOpacity>
            </View>

            <ScrollView
              style={styles.modalFlex}
              contentContainerStyle={styles.modalContent}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              <Text style={styles.fieldLabel}>НАЗВА КОЛОДИ</Text>
              <TextInput
                style={styles.textInput}
                placeholder="Наприклад: Меми нашої компанії"
                placeholderTextColor={COLORS.textMuted}
                value={title}
                onChangeText={setTitle}
                maxLength={40}
              />

              <Text style={styles.fieldLabel}>ЕМОДЗІ</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.emojiPickerRow}
              >
                {EMOJI_OPTIONS.map((emoji) => {
                  const isSelected = emoji === selectedEmoji;
                  return (
                    <TouchableOpacity
                      key={emoji}
                      activeOpacity={0.8}
                      onPress={() => {
                        Haptics.selectionAsync();
                        setSelectedEmoji(emoji);
                      }}
                      style={[
                        styles.emojiOption,
                        isSelected && styles.emojiOptionSelected,
                      ]}
                    >
                      <Text style={styles.emojiOptionText}>{emoji}</Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>

              <Text style={styles.fieldLabel}>ПРИЗНАЧЕННЯ КАРТОК</Text>
              <View style={styles.modeSelectorRow}>
                {TARGET_MODES.map((m) => {
                  const active = targetMode === m.id;
                  return (
                    <TouchableOpacity
                      key={m.id}
                      activeOpacity={0.85}
                      onPress={() => {
                        Haptics.selectionAsync();
                        setTargetMode(m.id);
                      }}
                      style={[
                        styles.modeChip,
                        active && styles.modeChipActive,
                      ]}
                    >
                      <Text
                        style={[
                          styles.modeChipText,
                          active && styles.modeChipTextActive,
                        ]}
                      >
                        {m.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <View style={styles.rawHeaderRow}>
                <Text style={styles.fieldLabel}>СПИСОК СЛІВ (ПО 1 В РЯДОК)</Text>
                <TouchableOpacity
                  activeOpacity={0.8}
                  style={styles.pasteButton}
                  onPress={handlePasteFromClipboard}
                >
                  <ClipboardPaste size={13} color={COLORS.textPrimary} />
                  <Text style={styles.pasteButtonText}>Вставити з буфера</Text>
                </TouchableOpacity>
              </View>

              <TextInput
                style={styles.multilineInput}
                multiline
                placeholder={
                  'Вставте список слів або напишіть вручну:\nШаурма\nПавербанк\nКіт у чоботях\nСусід з перфоратором'
                }
                placeholderTextColor={COLORS.textMuted}
                value={rawText}
                onChangeText={setRawText}
                textAlignVertical="top"
              />

              {/* Live Preview Chips */}
              <View style={styles.previewSection}>
                <View style={styles.previewHeaderRow}>
                  <Text style={styles.previewTitle}>
                    Унікальних карток:{' '}
                    <Text style={{ color: COLORS.textPrimary }}>
                      {parsedPreviewItems.length}
                    </Text>
                  </Text>
                  {parsedPreviewItems.length > 0 ? (
                    <TouchableOpacity onPress={() => setRawText('')}>
                      <Text style={styles.clearAllText}>Очистити все</Text>
                    </TouchableOpacity>
                  ) : null}
                </View>

                {parsedPreviewItems.length === 0 ? (
                  <Text style={styles.previewEmptyText}>
                    Почніть вводити слова або натисніть «Вставити з буфера». Дублікати фільтруються автоматично.
                  </Text>
                ) : (
                  <View style={styles.chipsWrap}>
                    {parsedPreviewItems.map((word) => (
                      <View key={word} style={styles.wordChip}>
                        <Text style={styles.wordChipText} numberOfLines={1}>
                          {word}
                        </Text>
                        <TouchableOpacity
                          onPress={() => handleRemovePreviewChip(word)}
                          hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                        >
                          <X size={13} color={COLORS.textMuted} />
                        </TouchableOpacity>
                      </View>
                    ))}
                  </View>
                )}
              </View>
            </ScrollView>

            {/* Modal Footer */}
            <View style={styles.modalFooter}>
              <TouchableOpacity
                activeOpacity={0.85}
                style={[
                  styles.saveButton,
                  parsedPreviewItems.length === 0 && styles.saveButtonDisabled,
                ]}
                onPress={handleSaveCustomDeck}
              >
                <Text style={styles.saveButtonText}>
                  {editingDeckId
                    ? `Оновити колоду (${parsedPreviewItems.length})`
                    : `Зберегти колоду (${parsedPreviewItems.length})`}
                </Text>
              </TouchableOpacity>
            </View>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>

      {/* Modal: Preview Deck Cards */}
      <Modal
        visible={previewDeck !== null}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setPreviewDeck(null)}
      >
        <SafeAreaView style={styles.modalSafeArea} edges={['top', 'bottom']}>
          <View style={styles.modalHeader}>
            <View style={styles.modalHeaderTitleRow}>
              <Text style={styles.previewDeckEmoji}>{previewDeck?.emoji}</Text>
              <Text style={styles.modalHeaderTitle} numberOfLines={1}>
                {previewDeck?.title}
              </Text>
            </View>
            <TouchableOpacity
              style={styles.closeBtn}
              onPress={() => setPreviewDeck(null)}
            >
              <X size={18} color={COLORS.textSecondary} />
            </TouchableOpacity>
          </View>

          {previewDeck ? (
            <View style={styles.modalFlex}>
              <View style={styles.previewTabsRow}>
                {(
                  [
                    {
                      id: 'alias' as const,
                      label: `Еліас (${previewDeck.items.alias.length})`,
                      color: COLORS.alias,
                    },
                    {
                      id: 'crocodile' as const,
                      label: `Крокодил (${previewDeck.items.crocodile.length})`,
                      color: COLORS.crocodile,
                    },
                    {
                      id: 'spy' as const,
                      label: `Шпигун (${previewDeck.items.spyLocations.length})`,
                      color: COLORS.spy,
                    },
                  ]
                ).map((tab) => {
                  const active = previewTab === tab.id;
                  return (
                    <TouchableOpacity
                      key={tab.id}
                      style={[
                        styles.previewTabBtn,
                        active && { backgroundColor: tab.color },
                      ]}
                      onPress={() => {
                        Haptics.selectionAsync();
                        setPreviewTab(tab.id);
                      }}
                    >
                      <Text
                        style={[
                          styles.previewTabText,
                          active && { color: COLORS.textPrimary },
                        ]}
                      >
                        {tab.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <ScrollView
                style={styles.modalFlex}
                contentContainerStyle={styles.previewCardsScroll}
                showsVerticalScrollIndicator={false}
              >
                {previewTab === 'alias' ? (
                  previewDeck.items.alias.length === 0 ? (
                    <Text style={styles.previewEmptyText}>
                      У цій колоді немає слів для Еліасу.
                    </Text>
                  ) : (
                    <View style={styles.previewChipsGrid}>
                      {previewDeck.items.alias.map((item) => (
                        <View key={item.id} style={styles.previewCardPill}>
                          <Text style={styles.previewCardPillText}>
                            {item.word}
                          </Text>
                        </View>
                      ))}
                    </View>
                  )
                ) : null}

                {previewTab === 'crocodile' ? (
                  previewDeck.items.crocodile.length === 0 ? (
                    <Text style={styles.previewEmptyText}>
                      У цій колоді немає фраз для Крокодила.
                    </Text>
                  ) : (
                    <View style={styles.previewLinesList}>
                      {previewDeck.items.crocodile.map((item, idx) => (
                        <View key={item.id} style={styles.previewLineCard}>
                          <Text style={styles.previewLineIndex}>
                            {String(idx + 1).padStart(2, '0')}
                          </Text>
                          <Text style={styles.previewLineText}>
                            {item.phrase}
                          </Text>
                        </View>
                      ))}
                    </View>
                  )
                ) : null}

                {previewTab === 'spy' ? (
                  previewDeck.items.spyLocations.length === 0 ? (
                    <Text style={styles.previewEmptyText}>
                      У кастомній колоді немає власних локацій Шпигуна (під час гри автоматично використовуються локації з базової колоди).
                    </Text>
                  ) : (
                    <View style={styles.previewLinesList}>
                      {previewDeck.items.spyLocations.map((loc, idx) => (
                        <View key={loc.id} style={styles.previewLineCard}>
                          <Text style={[styles.previewLineIndex, { color: COLORS.spy }]}>
                            {String(idx + 1).padStart(2, '0')}
                          </Text>
                          <View style={{ flex: 1 }}>
                            <Text style={styles.previewLineText}>{loc.name}</Text>
                            {loc.roles?.length ? (
                              <Text style={styles.previewRolesSub}>
                                {loc.roles.join(' · ')}
                              </Text>
                            ) : null}
                          </View>
                        </View>
                      ))}
                    </View>
                  )
                ) : null}
              </ScrollView>

              {previewDeck.isCustom ? (
                <View style={styles.previewFooterRow}>
                  <TouchableOpacity
                    activeOpacity={0.85}
                    style={styles.previewEditBtn}
                    onPress={() => handleEditCustomDeck(previewDeck)}
                  >
                    <Pencil size={16} color={COLORS.textPrimary} />
                    <Text style={styles.previewFooterBtnText}>Редагувати</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    activeOpacity={0.85}
                    style={styles.previewShareBtn}
                    onPress={() => handleShareOrCopyDeck(previewDeck)}
                  >
                    <Share2 size={16} color={COLORS.textPrimary} />
                    <Text style={styles.previewFooterBtnText}>Поділитися</Text>
                  </TouchableOpacity>
                </View>
              ) : null}
            </View>
          ) : null}
        </SafeAreaView>
      </Modal>
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
  },
  overline: {
    color: COLORS.textMuted,
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 1.6,
    marginBottom: 6,
  },
  title: {
    color: COLORS.textPrimary,
    fontSize: 32,
    fontWeight: '700',
    letterSpacing: -0.9,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: SPACING.xl,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 48,
    borderRadius: RADIUS.md,
  },
  primaryActionButton: {
    backgroundColor: COLORS.primary,
  },
  primaryActionText: {
    color: COLORS.textPrimary,
    fontSize: 14,
    fontWeight: '600',
  },
  secondaryActionButton: {
    backgroundColor: COLORS.surface,
  },
  secondaryActionText: {
    color: COLORS.textPrimary,
    fontSize: 14,
    fontWeight: '600',
  },
  sectionBlock: {
    marginBottom: SPACING.xl,
  },
  sectionOverline: {
    color: COLORS.textMuted,
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 1.4,
    marginBottom: SPACING.md,
  },
  decksList: {
    gap: 12,
  },
  deckCard: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    overflow: 'hidden',
    position: 'relative',
  },
  deckAccentStrip: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 4,
  },
  deckInner: {
    padding: SPACING.lg,
    paddingLeft: SPACING.lg + 4,
  },
  deckTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: SPACING.md,
  },
  emoji: {
    fontSize: 28,
    marginTop: 2,
  },
  deckTitleWrap: {
    flex: 1,
  },
  deckOverlineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 4,
  },
  deckTypeTag: {
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 1.1,
  },
  deckTitle: {
    color: COLORS.textPrimary,
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: -0.4,
  },
  deckIconActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  iconActionBtn: {
    width: 32,
    height: 32,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  resetHistoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  resetHistoryText: {
    color: COLORS.textSecondary,
    fontSize: 11,
    fontWeight: '500',
  },
  deckDescription: {
    color: COLORS.textSecondary,
    fontSize: 13,
    lineHeight: 19,
    marginTop: 10,
  },
  inlineStatsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: COLORS.border,
  },
  inlineStatItem: {
    color: COLORS.textSecondary,
    fontSize: 12,
    fontWeight: '500',
  },
  inlineStatNumber: {
    color: COLORS.textPrimary,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  inlineStatDot: {
    color: COLORS.textMuted,
    fontSize: 12,
  },

  // Modal styles
  modalSafeArea: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  modalFlex: {
    flex: 1,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.md,
  },
  modalHeaderTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
    paddingRight: SPACING.sm,
  },
  modalHeaderTitle: {
    color: COLORS.textPrimary,
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: -0.4,
    flexShrink: 1,
  },
  closeBtn: {
    width: 34,
    height: 34,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalContent: {
    paddingHorizontal: SPACING.xl,
    paddingTop: SPACING.sm,
    paddingBottom: SPACING.xxxl,
  },
  fieldLabel: {
    color: COLORS.textMuted,
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 1.2,
    marginBottom: SPACING.sm,
    marginTop: SPACING.md,
  },
  textInput: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: 14,
    color: COLORS.textPrimary,
    fontSize: 15,
    fontWeight: '500',
  },
  emojiPickerRow: {
    gap: 8,
    paddingVertical: 2,
  },
  emojiOption: {
    width: 44,
    height: 44,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emojiOptionSelected: {
    backgroundColor: COLORS.surfaceElevated,
    borderWidth: 1.5,
    borderColor: COLORS.primary,
  },
  emojiOptionText: {
    fontSize: 22,
  },
  modeSelectorRow: {
    flexDirection: 'row',
    gap: 8,
  },
  modeChip: {
    flex: 1,
    paddingVertical: 11,
    paddingHorizontal: SPACING.sm,
    borderRadius: RADIUS.sm,
    backgroundColor: COLORS.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modeChipActive: {
    backgroundColor: COLORS.primary,
  },
  modeChipText: {
    color: COLORS.textSecondary,
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
  },
  modeChipTextActive: {
    color: COLORS.textPrimary,
  },
  rawHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: SPACING.lg,
    marginBottom: SPACING.sm,
  },
  pasteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: COLORS.surface,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: RADIUS.full,
  },
  pasteButtonText: {
    color: COLORS.textPrimary,
    fontSize: 12,
    fontWeight: '500',
  },
  multilineInput: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    color: COLORS.textPrimary,
    fontSize: 15,
    lineHeight: 22,
    minHeight: 150,
  },
  previewSection: {
    marginTop: SPACING.lg,
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
  },
  previewHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: SPACING.sm,
  },
  previewTitle: {
    color: COLORS.textSecondary,
    fontSize: 13,
    fontWeight: '600',
  },
  clearAllText: {
    color: COLORS.spy,
    fontSize: 12,
    fontWeight: '600',
  },
  previewEmptyText: {
    color: COLORS.textMuted,
    fontSize: 13,
    lineHeight: 19,
  },
  chipsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  wordChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: COLORS.surfaceElevated,
    borderRadius: RADIUS.sm,
    paddingHorizontal: 10,
    paddingVertical: 6,
    maxWidth: '100%',
  },
  wordChipText: {
    color: COLORS.textPrimary,
    fontSize: 13,
    fontWeight: '500',
    flexShrink: 1,
  },
  modalFooter: {
    paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.md,
    backgroundColor: COLORS.background,
  },
  saveButton: {
    backgroundColor: COLORS.primary,
    height: 54,
    borderRadius: RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveButtonDisabled: {
    opacity: 0.4,
  },
  saveButtonText: {
    color: COLORS.textPrimary,
    fontSize: 16,
    fontWeight: '600',
  },

  // Preview Deck Modal styles
  previewDeckEmoji: {
    fontSize: 22,
  },
  previewTabsRow: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: SPACING.xl,
    paddingBottom: SPACING.md,
  },
  previewTabBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: RADIUS.sm,
    backgroundColor: COLORS.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewTabText: {
    color: COLORS.textSecondary,
    fontSize: 12,
    fontWeight: '600',
  },
  previewCardsScroll: {
    paddingHorizontal: SPACING.xl,
    paddingTop: SPACING.sm,
    paddingBottom: SPACING.xxxl,
  },
  previewChipsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  previewCardPill: {
    backgroundColor: COLORS.surface,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: RADIUS.sm,
  },
  previewCardPillText: {
    color: COLORS.textPrimary,
    fontSize: 14,
    fontWeight: '500',
  },
  previewLinesList: {
    gap: 8,
  },
  previewLineCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    backgroundColor: COLORS.surface,
    padding: SPACING.md,
    borderRadius: RADIUS.md,
  },
  previewLineIndex: {
    color: COLORS.textMuted,
    fontSize: 12,
    fontWeight: '600',
    minWidth: 22,
    marginTop: 2,
    fontVariant: ['tabular-nums'],
  },
  previewLineText: {
    color: COLORS.textPrimary,
    fontSize: 15,
    fontWeight: '500',
    flex: 1,
    lineHeight: 21,
  },
  previewRolesSub: {
    color: COLORS.textSecondary,
    fontSize: 12,
    marginTop: 4,
    lineHeight: 17,
  },
  previewFooterRow: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.md,
    backgroundColor: COLORS.background,
  },
  previewEditBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: COLORS.surface,
    height: 50,
    borderRadius: RADIUS.md,
  },
  previewShareBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: COLORS.crocodile,
    height: 50,
    borderRadius: RADIUS.md,
  },
  previewFooterBtnText: {
    color: COLORS.textPrimary,
    fontSize: 15,
    fontWeight: '600',
  },
});
