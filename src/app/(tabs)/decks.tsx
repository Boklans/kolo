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
  CheckCircle2,
  ClipboardPaste,
  Crown,
  Download,
  Eye,
  Pencil,
  Plus,
  RotateCcw,
  Share2,
  Sparkles,
  Trash2,
  UserCheck,
  X,
  Zap,
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

    return (
      <View
        key={deck.id}
        style={[
          styles.deckCard,
          deck.isCustom
            ? { borderColor: `${COLORS.hot}66` }
            : deck.isPremium
              ? { borderColor: `${COLORS.primary}77` }
              : { borderColor: `${COLORS.primary}44` },
        ]}
      >
        <View style={styles.deckTopRow}>
          <View style={styles.emojiBox}>
            <Text style={styles.emoji}>{deck.emoji}</Text>
          </View>

          <View style={styles.deckTitleWrap}>
            <View style={styles.deckTitleRow}>
              <Text style={styles.deckTitle} numberOfLines={1}>
                {deck.title}
              </Text>

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
                      <Pencil size={15} color={COLORS.primary} />
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.iconActionBtn}
                      onPress={() => handleShareOrCopyDeck(deck)}
                      hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}
                    >
                      <Share2 size={15} color={COLORS.crocodile} />
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.deleteBtn}
                      onPress={() => handleDeleteCustomDeck(deck)}
                      hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}
                    >
                      <Trash2 size={15} color={COLORS.spy} />
                    </TouchableOpacity>
                  </>
                ) : null}
              </View>
            </View>

            <View style={styles.badgesWrap}>
              {deck.isCustom ? (
                <View style={styles.customBadge}>
                  <UserCheck size={11} color={COLORS.hot} />
                  <Text style={styles.customBadgeText}>Власна колода</Text>
                </View>
              ) : deck.isPremium ? (
                <View style={styles.proBadge}>
                  <Crown size={11} color={COLORS.hot} />
                  <Text style={styles.proBadgeText}>PRO (Безкоштовно в бета-версії)</Text>
                </View>
              ) : (
                <View style={styles.activeBadge}>
                  <CheckCircle2 size={11} color={COLORS.crocodile} />
                  <Text style={styles.activeBadgeText}>Офіційна</Text>
                </View>
              )}

              {usedCount > 0 ? (
                <TouchableOpacity
                  style={styles.resetHistoryChip}
                  onPress={() => handleResetDeckUsed(deck)}
                >
                  <RotateCcw size={11} color={COLORS.textSecondary} />
                  <Text style={styles.resetHistoryText}>Зіграно: {usedCount} (скинути)</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          </View>
        </View>

        {deck.description ? (
          <Text style={styles.deckDescription}>{deck.description}</Text>
        ) : null}

        <View style={styles.statsGrid}>
          <View
            style={[
              styles.statItem,
              { borderColor: `${COLORS.alias}44`, backgroundColor: `${COLORS.alias}12` },
            ]}
          >
            <Text style={[styles.statValue, { color: COLORS.alias }]}>
              {deck.items.alias.length}
            </Text>
            <Text style={styles.statLabel}>Еліас слів</Text>
          </View>

          <View
            style={[
              styles.statItem,
              {
                borderColor: `${COLORS.crocodile}44`,
                backgroundColor: `${COLORS.crocodile}12`,
              },
            ]}
          >
            <Text style={[styles.statValue, { color: COLORS.crocodile }]}>
              {deck.items.crocodile.length}
            </Text>
            <Text style={styles.statLabel}>Крокодил фраз</Text>
          </View>

          <View
            style={[
              styles.statItem,
              { borderColor: `${COLORS.spy}44`, backgroundColor: `${COLORS.spy}12` },
            ]}
          >
            <Text style={[styles.statValue, { color: COLORS.spy }]}>
              {deck.items.spyLocations.length}
            </Text>
            <Text style={styles.statLabel}>Шпигун локацій</Text>
          </View>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Text style={styles.title}>Колоди</Text>
          <Text style={styles.subtitle}>
            Офіційні набори слів та власні колоди через швидкий імпорт зі списку.
          </Text>
        </View>

        {/* Action Buttons */}
        <View style={styles.actionsRow}>
          <TouchableOpacity
            activeOpacity={0.85}
            style={[styles.actionButton, styles.primaryActionButton]}
            onPress={() => openModal(false)}
          >
            <Plus size={18} color={COLORS.textPrimary} />
            <Text style={styles.primaryActionText}>Створити колоду</Text>
          </TouchableOpacity>

          <TouchableOpacity
            activeOpacity={0.85}
            style={[styles.actionButton, styles.secondaryActionButton]}
            onPress={() => openModal(true)}
          >
            <Download size={18} color={COLORS.primary} />
            <Text style={styles.secondaryActionText}>Швидкий імпорт</Text>
          </TouchableOpacity>
        </View>

        {/* Custom Decks Section */}
        {customDecks.length > 0 ? (
          <View style={styles.sectionBlock}>
            <View style={styles.sectionHeader}>
              <Zap size={15} color={COLORS.hot} />
              <Text style={styles.sectionTitle}>Мої кастомні колоди ({customDecks.length})</Text>
            </View>
            <View style={styles.decksList}>{customDecks.map(renderDeckCard)}</View>
          </View>
        ) : null}

        {/* Official Decks Section */}
        <View style={styles.sectionBlock}>
          <View style={styles.sectionHeader}>
            <Sparkles size={15} color={COLORS.primary} />
            <Text style={styles.sectionTitle}>Офіційні колоди KOLO ({OFFICIAL_DECKS.length})</Text>
          </View>
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
              <View style={styles.modalHeaderTitleRow}>
                <Zap size={18} color={COLORS.hot} />
                <Text style={styles.modalHeaderTitle}>
                  {editingDeckId
                    ? 'Редагувати колоду'
                    : 'Швидкий імпорт / Створити колоду'}
                </Text>
              </View>
              <TouchableOpacity
                style={styles.closeBtn}
                onPress={() => {
                  setModalVisible(false);
                  setEditingDeckId(null);
                }}
              >
                <X size={20} color={COLORS.textSecondary} />
              </TouchableOpacity>
            </View>

            <ScrollView
              style={styles.modalFlex}
              contentContainerStyle={styles.modalContent}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              {/* Name Input */}
              <Text style={styles.fieldLabel}>Назва колоди</Text>
              <TextInput
                style={styles.textInput}
                placeholder="Наприклад: Меми нашої компанії"
                placeholderTextColor={COLORS.textSecondary}
                value={title}
                onChangeText={setTitle}
                maxLength={40}
              />

              {/* Emoji Picker */}
              <Text style={styles.fieldLabel}>Емодзі колоди</Text>
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

              {/* Target Mode Selector */}
              <Text style={styles.fieldLabel}>Призначення карток</Text>
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

              {/* Raw Text Input + Paste from Clipboard */}
              <View style={styles.rawHeaderRow}>
                <Text style={styles.fieldLabel}>Список слів або фраз (по 1 в рядок)</Text>
                <TouchableOpacity
                  activeOpacity={0.8}
                  style={styles.pasteButton}
                  onPress={handlePasteFromClipboard}
                >
                  <ClipboardPaste size={14} color={COLORS.primary} />
                  <Text style={styles.pasteButtonText}>Вставити з буфера</Text>
                </TouchableOpacity>
              </View>

              <TextInput
                style={styles.multilineInput}
                multiline
                placeholder={
                  'Вставте список слів або напишіть вручну:\nШаурма\nПавербанк\nКіт у чоботях\nСусід з перфоратором'
                }
                placeholderTextColor={COLORS.textSecondary}
                value={rawText}
                onChangeText={setRawText}
                textAlignVertical="top"
              />

              {/* Live Preview Chips */}
              <View style={styles.previewSection}>
                <View style={styles.previewHeaderRow}>
                  <Text style={styles.previewTitle}>
                    Розпізнано унікальних карток:{' '}
                    <Text style={{ color: COLORS.crocodile }}>
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
                    Почніть вводити слова або натисніть «Вставити з буфера». Дублікати та порожні рядки фільтруються автоматично.
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
                          <X size={13} color={COLORS.textSecondary} />
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
                <CheckCircle2 size={18} color={COLORS.textPrimary} />
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
              <X size={20} color={COLORS.textSecondary} />
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
                        active && {
                          borderColor: tab.color,
                          backgroundColor: `${tab.color}22`,
                        },
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
                          <Text style={styles.previewLineIndex}>{idx + 1}.</Text>
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
                            {idx + 1}.
                          </Text>
                          <View style={{ flex: 1 }}>
                            <Text style={styles.previewLineText}>{loc.name}</Text>
                            {loc.roles?.length ? (
                              <Text style={styles.previewRolesSub}>
                                Ролі: {loc.roles.join(' • ')}
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
    paddingTop: SPACING.lg,
    paddingBottom: SPACING.xxxl,
  },
  header: {
    marginBottom: SPACING.xl,
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
  actionsRow: {
    flexDirection: 'row',
    gap: SPACING.md,
    marginBottom: SPACING.xxl,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
  },
  primaryActionButton: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  primaryActionText: {
    color: COLORS.textPrimary,
    fontSize: 14,
    fontWeight: '700',
  },
  secondaryActionButton: {
    backgroundColor: COLORS.surfaceElevated,
    borderColor: COLORS.border,
  },
  secondaryActionText: {
    color: COLORS.textPrimary,
    fontSize: 14,
    fontWeight: '700',
  },
  sectionBlock: {
    marginBottom: SPACING.xxl,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: SPACING.md,
  },
  sectionTitle: {
    color: COLORS.textPrimary,
    fontSize: 16,
    fontWeight: '700',
  },
  decksList: {
    gap: SPACING.lg,
  },
  deckCard: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.xl,
    borderWidth: 1.5,
    padding: SPACING.xl,
  },
  deckTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    marginBottom: SPACING.md,
  },
  emojiBox: {
    width: 54,
    height: 54,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.surfaceElevated,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emoji: {
    fontSize: 28,
  },
  deckTitleWrap: {
    flex: 1,
    gap: 6,
  },
  deckTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: SPACING.sm,
  },
  deckTitle: {
    color: COLORS.textPrimary,
    fontSize: 19,
    fontWeight: '800',
    flex: 1,
  },
  deleteBtn: {
    padding: 6,
    borderRadius: RADIUS.sm,
    backgroundColor: `${COLORS.spy}1A`,
  },
  badgesWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 6,
  },
  activeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: `${COLORS.crocodile}1F`,
    borderColor: `${COLORS.crocodile}55`,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: RADIUS.full,
  },
  activeBadgeText: {
    color: COLORS.crocodile,
    fontSize: 11,
    fontWeight: '700',
  },
  customBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: `${COLORS.hot}1F`,
    borderColor: `${COLORS.hot}55`,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: RADIUS.full,
  },
  customBadgeText: {
    color: COLORS.hot,
    fontSize: 11,
    fontWeight: '700',
  },
  proBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: `${COLORS.hot}1F`,
    borderColor: `${COLORS.hot}66`,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: RADIUS.full,
  },
  proBadgeText: {
    color: COLORS.hot,
    fontSize: 10,
    fontWeight: '800',
  },
  resetHistoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: COLORS.surfaceElevated,
    borderColor: COLORS.border,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: RADIUS.full,
  },
  resetHistoryText: {
    color: COLORS.textSecondary,
    fontSize: 10,
    fontWeight: '600',
  },
  deckDescription: {
    color: COLORS.textSecondary,
    fontSize: 14,
    lineHeight: 20,
    marginBottom: SPACING.lg,
  },
  statsGrid: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  statItem: {
    flex: 1,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.sm,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 20,
    fontWeight: '800',
    marginBottom: 2,
  },
  statLabel: {
    color: COLORS.textSecondary,
    fontSize: 11,
    fontWeight: '600',
    textAlign: 'center',
  },

  // Modal Styles
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
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  modalHeaderTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  modalHeaderTitle: {
    color: COLORS.textPrimary,
    fontSize: 17,
    fontWeight: '800',
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalContent: {
    paddingHorizontal: SPACING.xl,
    paddingTop: SPACING.lg,
    paddingBottom: SPACING.xxxl,
  },
  fieldLabel: {
    color: COLORS.textPrimary,
    fontSize: 14,
    fontWeight: '700',
    marginBottom: SPACING.sm,
  },
  textInput: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.lg,
    paddingHorizontal: SPACING.md,
    paddingVertical: 12,
    color: COLORS.textPrimary,
    fontSize: 15,
    fontWeight: '600',
    marginBottom: SPACING.lg,
  },
  emojiPickerRow: {
    gap: SPACING.sm,
    paddingBottom: SPACING.lg,
  },
  emojiOption: {
    width: 46,
    height: 46,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emojiOptionSelected: {
    borderColor: COLORS.primary,
    backgroundColor: `${COLORS.primary}25`,
  },
  emojiOptionText: {
    fontSize: 22,
  },
  modeSelectorRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginBottom: SPACING.lg,
  },
  modeChip: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modeChipActive: {
    borderColor: COLORS.primary,
    backgroundColor: `${COLORS.primary}22`,
  },
  modeChipText: {
    color: COLORS.textSecondary,
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
  },
  modeChipTextActive: {
    color: COLORS.textPrimary,
  },
  rawHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: SPACING.sm,
  },
  pasteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: `${COLORS.primary}20`,
    borderWidth: 1,
    borderColor: `${COLORS.primary}55`,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: RADIUS.full,
  },
  pasteButtonText: {
    color: COLORS.primary,
    fontSize: 12,
    fontWeight: '700',
  },
  multilineInput: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.lg,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
    color: COLORS.textPrimary,
    fontSize: 14,
    lineHeight: 20,
    minHeight: 130,
    marginBottom: SPACING.lg,
  },
  previewSection: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
  },
  previewHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: SPACING.sm,
  },
  previewTitle: {
    color: COLORS.textPrimary,
    fontSize: 13,
    fontWeight: '700',
  },
  clearAllText: {
    color: COLORS.spy,
    fontSize: 12,
    fontWeight: '700',
  },
  previewEmptyText: {
    color: COLORS.textSecondary,
    fontSize: 13,
    lineHeight: 18,
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
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: RADIUS.full,
    maxWidth: '100%',
  },
  wordChipText: {
    color: COLORS.textPrimary,
    fontSize: 13,
    fontWeight: '600',
    flexShrink: 1,
  },
  modalFooter: {
    paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.md,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    backgroundColor: COLORS.background,
  },
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: COLORS.primary,
    paddingVertical: 15,
    borderRadius: RADIUS.lg,
  },
  saveButtonDisabled: {
    opacity: 0.45,
  },
  saveButtonText: {
    color: COLORS.textPrimary,
    fontSize: 16,
    fontWeight: '800',
  },
  deckIconActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  iconActionBtn: {
    padding: 6,
    borderRadius: RADIUS.sm,
    backgroundColor: COLORS.surfaceElevated,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  previewDeckEmoji: {
    fontSize: 22,
  },
  previewTabsRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
    paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  previewTabBtn: {
    flex: 1,
    paddingVertical: 9,
    paddingHorizontal: 6,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
  },
  previewTabText: {
    color: COLORS.textSecondary,
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
  },
  previewCardsScroll: {
    paddingHorizontal: SPACING.xl,
    paddingTop: SPACING.lg,
    paddingBottom: SPACING.xxxl,
  },
  previewChipsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  previewCardPill: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: RADIUS.full,
  },
  previewCardPillText: {
    color: COLORS.textPrimary,
    fontSize: 14,
    fontWeight: '600',
  },
  previewLinesList: {
    gap: SPACING.sm,
  },
  previewLineCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: SPACING.sm,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
  },
  previewLineIndex: {
    color: COLORS.crocodile,
    fontSize: 13,
    fontWeight: '800',
    minWidth: 22,
  },
  previewLineText: {
    flex: 1,
    color: COLORS.textPrimary,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '600',
  },
  previewRolesSub: {
    color: COLORS.textSecondary,
    fontSize: 12,
    marginTop: 4,
  },
  previewFooterRow: {
    flexDirection: 'row',
    gap: SPACING.md,
    paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.md,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    backgroundColor: COLORS.background,
  },
  previewEditBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: COLORS.primary,
    paddingVertical: 14,
    borderRadius: RADIUS.lg,
  },
  previewShareBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: COLORS.crocodile,
    paddingVertical: 14,
    borderRadius: RADIUS.lg,
  },
  previewFooterBtnText: {
    color: COLORS.textPrimary,
    fontSize: 15,
    fontWeight: '800',
  },
});
