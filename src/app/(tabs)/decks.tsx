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
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import {
  ClipboardPaste,
  Download,
  Pencil,
  Plus,
  RotateCcw,
  Share2,
  Trash2,
  X,
} from 'lucide-react-native';
import { COLORS, RADIUS, SPACING } from '@/constants/theme';
import { DeckCoverArtwork } from '@/components/graphics/KoloArtwork';
import {
  CustomDeckTargetMode,
  OFFICIAL_DECKS,
  parseRawDeckText,
  parseRawSpyText,
  parseRawTabooText,
  useDeckStore,
} from '@/stores/useDeckStore';
import { useUsedContentStore } from '@/stores/useUsedContentStore';
import { Deck } from '@/types';
import {
  detectDeckTargetMode,
  encodeDeckToShareUrl,
  extractDeckRawLines,
} from '@/utils/deckShare';

const OFFICIAL_DECK_ART: Record<string, any> = {
  base_ua: require('../../../assets/images/cards/deck_base.webp'),
  warmup_ua: require('../../../assets/images/cards/deck_warmup.webp'),
  memes_ua: require('../../../assets/images/cards/deck_memes.webp'),
  it_office_ua: require('../../../assets/images/cards/deck_it.webp'),
  adult_18_ua: require('../../../assets/images/cards/deck_adult.webp'),
};

const EMOJI_OPTIONS = ['🃏', '🍻', '🔥', '🌶️', '🐸', '💻', '🍕', '🎬', '🎸', '🚀', '🦄', '💣'];

const TARGET_MODES: { id: CustomDeckTargetMode; label: string }[] = [
  { id: 'both', label: 'Еліас + Крокодил' },
  { id: 'alias', label: 'Еліас' },
  { id: 'crocodile', label: 'Крокодил' },
  { id: 'taboo', label: 'Табу' },
  { id: 'spy', label: 'Шпигун' },
];

type CoverTheme = {
  gradient: [string, string, string];
  borderColor: string;
  accent: string;
  tag: string;
};

function getDeckCoverTheme(deck: Deck): CoverTheme {
  if (deck.isCustom) {
    return {
      gradient: ['#231834', '#161124', '#0F0C18'],
      borderColor: 'rgba(139, 92, 246, 0.35)',
      accent: COLORS.primary,
      tag: 'CUSTOM PACK',
    };
  }
  switch (deck.id) {
    case 'warmup_ua':
      return {
        gradient: ['#2A1912', '#1A110E', '#110C0B'],
        borderColor: 'rgba(249, 115, 22, 0.35)',
        accent: COLORS.hot,
        tag: 'PARTY START',
      };
    case 'memes_ua':
      return {
        gradient: ['#10261E', '#0B1B16', '#08120F'],
        borderColor: 'rgba(16, 185, 129, 0.35)',
        accent: COLORS.crocodile,
        tag: 'POP & MEMES',
      };
    case 'it_office_ua':
      return {
        gradient: ['#121F36', '#0E1626', '#0A0F1A'],
        borderColor: 'rgba(59, 130, 246, 0.35)',
        accent: COLORS.alias,
        tag: 'TECH & WORK',
      };
    case 'adult_18_ua':
      return {
        gradient: ['#2A111A', '#1B0D13', '#12090D'],
        borderColor: 'rgba(244, 63, 94, 0.35)',
        accent: COLORS.spy,
        tag: 'NSFW · 18+',
      };
    default:
      return {
        gradient: ['#1D1831', '#141122', '#0D0B17'],
        borderColor: 'rgba(139, 92, 246, 0.35)',
        accent: COLORS.primary,
        tag: 'CLASSIC EDITION',
      };
  }
}

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
  const [previewTab, setPreviewTab] = useState<'alias' | 'crocodile' | 'taboo' | 'spy'>('alias');

  const parsedPreviewItems = useMemo(() => {
    if (targetMode === 'taboo') {
      return parseRawTabooText(rawText).map((i) => i.word);
    }
    if (targetMode === 'spy') {
      return parseRawSpyText(rawText).map((i) => i.name);
    }
    return parseRawDeckText(rawText);
  }, [rawText, targetMode]);

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
    const mode = detectDeckTargetMode(deck);
    const lines = extractDeckRawLines(deck);

    setEditingDeckId(deck.id);
    setTitle(deck.title);
    setSelectedEmoji(deck.emoji);
    setTargetMode(mode);
    setRawText(lines.join('\n'));
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
    const words = extractDeckRawLines(deck);
    if (words.length === 0) return;

    const shareUrl = encodeDeckToShareUrl(deck);
    const listText = words.join('\n');
    await Clipboard.setStringAsync(shareUrl ?? listText);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    try {
      await Share.share({
        message: shareUrl
          ? `Забирай мою колоду Balaka «${deck.title}» (${words.length} карток) в 1 клік:\n${shareUrl}`
          : `Колода Balaka «${deck.title}» (${words.length} карток)\n\nСкопіюй список нижче та встав у «Колоди → Імпорт»:\n\n${listText}`,
      });
    } catch {
      Alert.alert(
        'Скопійовано в буфер обміну',
        shareUrl
          ? `Посилання на колоду «${deck.title}» скопійовано! Друг забере пак в 1 клік.`
          : `Список із ${words.length} карток колоди «${deck.title}» скопійовано!`
      );
    }
  };

  const handlePasteFromClipboard = async () => {
    try {
      const text = await Clipboard.getStringAsync();
      if (!text || !text.trim()) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        Alert.alert(
          'Буфер порожній',
          'Скопіюйте список слів (кожне з нового рядка) та спробуйте ще раз.'
        );
        return;
      }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setRawText((prev) =>
        prev.trim() ? `${prev.trim()}\n${text.trim()}` : text.trim()
      );
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
      Alert.alert(
        'Немає карток',
        'Додайте хоча б одне слово або фразу довжиною від 2 символів.'
      );
      return;
    }

    const deckTitle =
      title.trim() || `Власна колода #${customDecks.length + 1}`;
    const payload = {
      title: deckTitle,
      emoji: selectedEmoji,
      rawText:
        targetMode === 'taboo' || targetMode === 'spy'
          ? rawText.trim()
          : parsedPreviewItems.join('\n'),
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
            setPreviewDeck(null);
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

  const renderDeckCover = (deck: Deck) => {
    const theme = getDeckCoverTheme(deck);
    const totalCards =
      deck.items.alias.length +
      deck.items.crocodile.length +
      (deck.items.taboo?.length ?? 0) +
      deck.items.spyLocations.length;

    const sampleWord =
      deck.items.alias[0]?.word ??
      deck.items.crocodile[0]?.phrase ??
      deck.items.spyLocations[0]?.name ??
      'BALAKA';

    const artSrc = !deck.isCustom ? OFFICIAL_DECK_ART[deck.id] : undefined;

    return (
      <TouchableOpacity
        key={deck.id}
        activeOpacity={0.88}
        onPress={() => handleOpenPreview(deck)}
        style={[styles.coverCard, { borderColor: theme.borderColor }]}
      >
        <LinearGradient
          colors={theme.gradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.coverGradientInner}
        >
          {artSrc ? (
            <>
              <Image
                source={artSrc}
                style={StyleSheet.absoluteFill}
                contentFit="cover"
                contentPosition="right center"
                transition={180}
              />
              <LinearGradient
                colors={[
                  `${theme.gradient[1]}EE`,
                  `${theme.gradient[1]}99`,
                  'rgba(10, 10, 16, 0.25)',
                ]}
                locations={[0, 0.54, 1]}
                start={{ x: 0, y: 0.5 }}
                end={{ x: 1, y: 0.5 }}
                style={StyleSheet.absoluteFill}
              />
            </>
          ) : deck.isCustom ? (
            <View pointerEvents="none" style={styles.customEmojiBackdrop}>
              <Text style={styles.customEmojiBackdropText}>
                {deck.emoji || '🃏'}
              </Text>
            </View>
          ) : (
            <View pointerEvents="none" style={styles.coverSvgArtworkPos}>
              <DeckCoverArtwork
                deckId={deck.id}
                accentColor={theme.accent}
                size={92}
              />
            </View>
          )}

          {/* Top Row: Category Tag + PRO Badge */}
          <View style={styles.coverTopRow}>
            <Text style={[styles.coverSeriesTag, { color: theme.accent }]}>
              {theme.tag}
            </Text>
            {deck.isPremium ? (
              <View style={styles.proMiniPill}>
                <Text style={styles.proMiniPillText}>PRO</Text>
              </View>
            ) : null}
          </View>

          {/* Center Box Title & Sample Card Preview */}
          <View style={styles.coverTitleBlock}>
            <Text style={styles.coverTitle} numberOfLines={2}>
              {deck.title}
            </Text>
            <Text style={styles.coverSamplePreview} numberOfLines={1}>
              «{sampleWord}»
            </Text>
          </View>

          {/* Bottom Compact Card Count */}
          <View style={styles.coverBottomRow}>
            <Text style={styles.coverCountText}>{totalCards} карток</Text>
            <Text style={[styles.coverOpenHint, { color: theme.accent }]}>
              Відкрити →
            </Text>
          </View>
        </LinearGradient>
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
        {/* Header with Compact Non-Competing Actions */}
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.overline}>КОЛЕКЦІЯ ПАКІВ</Text>
            <Text style={styles.title}>Колоди</Text>
          </View>

          <View style={styles.headerCompactActions}>
            <TouchableOpacity
              activeOpacity={0.8}
              style={styles.compactImportBtn}
              onPress={() => openModal(true)}
            >
              <Download size={14} color={COLORS.textSecondary} />
              <Text style={styles.compactImportText}>Імпорт</Text>
            </TouchableOpacity>

            <TouchableOpacity
              activeOpacity={0.85}
              style={styles.compactCreateBtn}
              onPress={() => openModal(false)}
            >
              <Plus size={15} color={COLORS.textPrimary} />
              <Text style={styles.compactCreateText}>Створити</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Official Party Packs Grid (2-Column Box Covers) */}
        <View style={styles.sectionBlock}>
          <Text style={styles.sectionOverline}>
            ОФІЦІЙНІ ВИДАННЯ BALAKA · {OFFICIAL_DECKS.length}
          </Text>
          <View style={styles.coversGrid}>
            {OFFICIAL_DECKS.map(renderDeckCover)}
          </View>
        </View>

        {/* Custom Decks Section */}
        {customDecks.length > 0 ? (
          <View style={styles.sectionBlock}>
            <Text style={styles.sectionOverline}>
              ВЛАСНІ ПАКИ · {customDecks.length}
            </Text>
            <View style={styles.coversGrid}>
              {customDecks.map(renderDeckCover)}
            </View>
          </View>
        ) : null}
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
            <View style={styles.modalHeader}>
              <Text style={styles.modalHeaderTitle}>
                {editingDeckId ? 'Редагувати колоду' : 'Новий пак карток'}
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

              <Text style={styles.fieldLabel}>СИМВОЛ ПАКУ</Text>
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

              <Text style={styles.fieldLabel}>ДЛЯ ЯКИХ ІГОР</Text>
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
                    ? `Оновити пак (${parsedPreviewItems.length})`
                    : `Зберегти пак (${parsedPreviewItems.length})`}
                </Text>
              </TouchableOpacity>
            </View>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>

      {/* Modal: Deck Box Showcase & Sample Cards */}
      <Modal
        visible={previewDeck !== null}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setPreviewDeck(null)}
      >
        <SafeAreaView style={styles.modalSafeArea} edges={['top', 'bottom']}>
          {previewDeck ? (
            <View style={styles.modalFlex}>
              {/* Rich Deck Showcase Header */}
              <LinearGradient
                colors={getDeckCoverTheme(previewDeck).gradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.showcaseBanner}
              >
                <View style={styles.showcaseTopRow}>
                  <Text
                    style={[
                      styles.showcaseSeriesTag,
                      { color: getDeckCoverTheme(previewDeck).accent },
                    ]}
                  >
                    {getDeckCoverTheme(previewDeck).tag}
                  </Text>

                  <TouchableOpacity
                    style={styles.closeBtn}
                    onPress={() => setPreviewDeck(null)}
                  >
                    <X size={18} color={COLORS.textPrimary} />
                  </TouchableOpacity>
                </View>

                <Text style={styles.showcaseTitle}>{previewDeck.title}</Text>
                {previewDeck.description ? (
                  <Text style={styles.showcaseDescription}>
                    {previewDeck.description}
                  </Text>
                ) : null}

                {/* Played count reset option if any cards played */}
                {((usedMap[previewDeck.id]?.alias?.length ?? 0) +
                  (usedMap[previewDeck.id]?.crocodile?.length ?? 0) +
                  (usedMap[previewDeck.id]?.spyLocations?.length ?? 0)) >
                0 ? (
                  <TouchableOpacity
                    style={styles.resetHistoryPill}
                    onPress={() => handleResetDeckUsed(previewDeck)}
                  >
                    <RotateCcw size={12} color={COLORS.textPrimary} />
                    <Text style={styles.resetHistoryText}>
                      Скинути історію зіграних карток
                    </Text>
                  </TouchableOpacity>
                ) : null}
              </LinearGradient>

              {/* Mode Tabs */}
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
                      label: `Кроко (${previewDeck.items.crocodile.length})`,
                      color: COLORS.crocodile,
                    },
                    {
                      id: 'taboo' as const,
                      label: `Табу (${previewDeck.items.taboo?.length ?? 0})`,
                      color: COLORS.taboo,
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
                      У цьому паку немає слів для Еліасу.
                    </Text>
                  ) : (
                    <View style={styles.sampleCardsGrid}>
                      {previewDeck.items.alias.map((item, idx) => (
                        <View key={item.id} style={styles.sampleAliasCard}>
                          <Text style={styles.sampleCardNumber}>
                            #{String(idx + 1).padStart(2, '0')}
                          </Text>
                          <Text style={styles.sampleCardWord}>{item.word}</Text>
                        </View>
                      ))}
                    </View>
                  )
                ) : null}

                {previewTab === 'taboo' ? (
                  (previewDeck.items.taboo?.length ?? 0) === 0 ? (
                    <Text style={styles.previewEmptyText}>
                      У цьому паку немає карток для Табу.
                    </Text>
                  ) : (
                    <View style={styles.previewLinesList}>
                      {(previewDeck.items.taboo ?? []).map((item, idx) => (
                        <View
                          key={item.id}
                          style={[
                            styles.previewLineCard,
                            { flexDirection: 'column', alignItems: 'flex-start', gap: 6 },
                          ]}
                        >
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                            <Text
                              style={[
                                styles.previewLineIndex,
                                { color: COLORS.taboo },
                              ]}
                            >
                              {String(idx + 1).padStart(2, '0')}
                            </Text>
                            <Text style={styles.previewLineText}>
                              {item.word}
                            </Text>
                          </View>
                          <Text style={{ color: COLORS.textMuted, fontSize: 12, fontWeight: '600' }}>
                            🚫 {item.forbiddenWords.join(' · ')}
                          </Text>
                        </View>
                      ))}
                    </View>
                  )
                ) : null}

                {previewTab === 'crocodile' ? (
                  previewDeck.items.crocodile.length === 0 ? (
                    <Text style={styles.previewEmptyText}>
                      У цьому паку немає фраз для Крокодила.
                    </Text>
                  ) : (
                    <View style={styles.previewLinesList}>
                      {previewDeck.items.crocodile.map((item, idx) => (
                        <View key={item.id} style={styles.previewLineCard}>
                          <Text
                            style={[
                              styles.previewLineIndex,
                              { color: COLORS.crocodile },
                            ]}
                          >
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
                      У власному паку немає локацій Шпигуна (під час гри використовуються локації з класичної колоди).
                    </Text>
                  ) : (
                    <View style={styles.previewLinesList}>
                      {previewDeck.items.spyLocations.map((loc, idx) => (
                        <View key={loc.id} style={styles.previewLineCard}>
                          <Text
                            style={[
                              styles.previewLineIndex,
                              { color: COLORS.spy },
                            ]}
                          >
                            {String(idx + 1).padStart(2, '0')}
                          </Text>
                          <View style={{ flex: 1 }}>
                            <Text style={styles.previewLineText}>
                              {loc.name}
                            </Text>
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
                    <Pencil size={15} color={COLORS.textPrimary} />
                    <Text style={styles.previewFooterBtnText}>Редагувати</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    activeOpacity={0.85}
                    style={styles.previewShareBtn}
                    onPress={() => handleShareOrCopyDeck(previewDeck)}
                  >
                    <Share2 size={15} color={COLORS.background} />
                    <Text
                      style={[
                        styles.previewFooterBtnText,
                        { color: COLORS.background },
                      ]}
                    >
                      Поділитися
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    activeOpacity={0.85}
                    style={styles.previewDeleteBtn}
                    onPress={() => handleDeleteCustomDeck(previewDeck)}
                  >
                    <Trash2 size={16} color={COLORS.spy} />
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
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    marginBottom: SPACING.xl,
    gap: SPACING.md,
  },
  overline: {
    color: COLORS.textMuted,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.8,
    marginBottom: 2,
  },
  title: {
    color: COLORS.textPrimary,
    fontSize: 32,
    fontWeight: '800',
    letterSpacing: -1,
  },
  headerCompactActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  compactImportBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderBottomWidth: 3,
    borderBottomColor: COLORS.lipNeutral,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: RADIUS.full,
  },
  compactImportText: {
    color: COLORS.textSecondary,
    fontSize: 12,
    fontWeight: '700',
  },
  compactCreateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: COLORS.primary,
    borderBottomWidth: 3,
    borderBottomColor: '#6D28D9',
    paddingHorizontal: 13,
    paddingVertical: 9,
    borderRadius: RADIUS.full,
  },
  compactCreateText: {
    color: COLORS.textPrimary,
    fontSize: 12,
    fontWeight: '800',
  },

  sectionBlock: {
    marginBottom: SPACING.xl,
  },
  sectionOverline: {
    color: COLORS.textMuted,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.4,
    marginBottom: SPACING.md,
  },

  // 2-Column Box-Art Covers Grid
  coversGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  coverCard: {
    width: '48%',
    flexGrow: 1,
    minHeight: 206,
    borderRadius: RADIUS.xl + 2,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    borderBottomWidth: 5,
    borderBottomColor: 'rgba(0, 0, 0, 0.5)',
    overflow: 'hidden',
    position: 'relative',
  },
  coverGradientInner: {
    flex: 1,
    minHeight: 201,
    padding: SPACING.lg,
    justifyContent: 'space-between',
    position: 'relative',
  },
  customEmojiBackdrop: {
    position: 'absolute',
    right: 12,
    bottom: 42,
    width: 68,
    height: 68,
    borderRadius: 20,
    backgroundColor: 'rgba(139, 92, 246, 0.22)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.14)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  customEmojiBackdropText: {
    fontSize: 34,
  },
  coverSvgArtworkPos: {
    position: 'absolute',
    right: -12,
    bottom: 22,
    opacity: 0.9,
  },
  coverTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 6,
  },
  coverSeriesTag: {
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1.2,
  },
  proMiniPill: {
    backgroundColor: 'rgba(249, 115, 22, 0.24)',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: RADIUS.full,
  },
  proMiniPillText: {
    color: COLORS.hot,
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  coverTitleBlock: {
    marginVertical: SPACING.md,
    gap: 6,
  },
  coverTitle: {
    color: COLORS.textPrimary,
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: -0.7,
    lineHeight: 26,
  },
  coverSamplePreview: {
    color: 'rgba(245, 245, 247, 0.58)',
    fontSize: 12,
    fontWeight: '600',
  },
  coverBottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  coverCountText: {
    color: COLORS.textSecondary,
    fontSize: 11,
    fontWeight: '700',
  },
  coverOpenHint: {
    fontSize: 11,
    fontWeight: '800',
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
  modalHeaderTitle: {
    color: COLORS.textPrimary,
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: -0.4,
  },
  closeBtn: {
    width: 34,
    height: 34,
    borderRadius: RADIUS.full,
    backgroundColor: 'rgba(255,255,255,0.1)',
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
    fontWeight: '700',
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
    fontWeight: '600',
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
    backgroundColor: COLORS.primary,
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
    fontWeight: '600',
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
    fontWeight: '700',
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
    fontWeight: '600',
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
    fontWeight: '800',
  },

  // Showcase Modal
  showcaseBanner: {
    paddingHorizontal: SPACING.xl,
    paddingTop: SPACING.lg,
    paddingBottom: SPACING.lg,
    gap: 6,
  },
  showcaseTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  showcaseSeriesTag: {
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1.5,
  },
  showcaseTitle: {
    color: COLORS.textPrimary,
    fontSize: 28,
    fontWeight: '900',
    letterSpacing: -0.8,
  },
  showcaseDescription: {
    color: COLORS.textSecondary,
    fontSize: 14,
    lineHeight: 20,
  },
  resetHistoryPill: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255,255,255,0.1)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: RADIUS.full,
    marginTop: 6,
  },
  resetHistoryText: {
    color: COLORS.textPrimary,
    fontSize: 12,
    fontWeight: '600',
  },
  previewTabsRow: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.md,
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
    fontWeight: '700',
  },
  previewCardsScroll: {
    paddingHorizontal: SPACING.xl,
    paddingTop: SPACING.xs,
    paddingBottom: SPACING.xxxl,
  },
  sampleCardsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  sampleAliasCard: {
    width: '48%',
    flexGrow: 1,
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    minHeight: 84,
    justifyContent: 'space-between',
  },
  sampleCardNumber: {
    color: COLORS.alias,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1,
  },
  sampleCardWord: {
    color: COLORS.textPrimary,
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: -0.3,
    marginTop: 6,
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
    fontWeight: '800',
    minWidth: 22,
    marginTop: 2,
    fontVariant: ['tabular-nums'],
  },
  previewLineText: {
    color: COLORS.textPrimary,
    fontSize: 15,
    fontWeight: '600',
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
  previewDeleteBtn: {
    width: 50,
    height: 50,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewFooterBtnText: {
    color: COLORS.textPrimary,
    fontSize: 14,
    fontWeight: '800',
  },
});
