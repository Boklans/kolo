import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import baseUaDeckJson from '@/data/decks/base_ua.json';
import warmupUaDeckJson from '@/data/decks/warmup_ua.json';
import memesUaDeckJson from '@/data/decks/memes_ua.json';
import itOfficeUaDeckJson from '@/data/decks/it_office_ua.json';
import adult18UaDeckJson from '@/data/decks/adult_18_ua.json';
import { Deck, SpyLocation, TabooItem } from '@/types';

export type CustomDeckTargetMode =
  | 'alias'
  | 'crocodile'
  | 'both'
  | 'taboo'
  | 'spy';

export const baseUaDeck = baseUaDeckJson as Deck;
export const warmupUaDeck = warmupUaDeckJson as Deck;
export const memesUaDeck = memesUaDeckJson as Deck;
export const itOfficeUaDeck = itOfficeUaDeckJson as Deck;
export const adult18UaDeck = adult18UaDeckJson as Deck;

export const OFFICIAL_DECKS: Deck[] = [
  baseUaDeck,
  warmupUaDeck,
  memesUaDeck,
  itOfficeUaDeck,
  adult18UaDeck,
];

export function parseRawDeckText(rawText: string): string[] {
  const lines = rawText.split(/\r?\n/);
  const seenLower = new Set<string>();
  const uniqueItems: string[] = [];

  for (const rawLine of lines) {
    const cleaned = rawLine.replace(/^(\d+[\.\)]\s*|[-•*]\s*)/, '').trim();
    if (cleaned.length < 2) continue;

    const lower = cleaned.toLowerCase();
    if (!seenLower.has(lower)) {
      seenLower.add(lower);
      uniqueItems.push(cleaned);
    }
  }

  return uniqueItems;
}

export interface ParsedTabooEntry {
  word: string;
  forbiddenWords: string[];
}

export function parseRawTabooText(rawText: string): ParsedTabooEntry[] {
  const lines = rawText.split(/\r?\n/);
  const seenLower = new Set<string>();
  const result: ParsedTabooEntry[] = [];

  for (const rawLine of lines) {
    const cleaned = rawLine.replace(/^(\d+[\.\)]\s*|[-•*]\s*)/, '').trim();
    if (cleaned.length < 2) continue;

    const sepIdx = cleaned.indexOf(':');
    const wordPart = (sepIdx >= 0 ? cleaned.slice(0, sepIdx) : cleaned).trim();
    if (wordPart.length < 2) continue;

    const lower = wordPart.toLowerCase();
    if (seenLower.has(lower)) continue;
    seenLower.add(lower);

    const rawForbidden =
      sepIdx >= 0
        ? cleaned
            .slice(sepIdx + 1)
            .split(/[,;·|]/)
            .map((w) => w.trim())
            .filter((w) => w.length >= 2)
            .slice(0, 4)
        : [];

    result.push({
      word: wordPart,
      forbiddenWords:
        rawForbidden.length > 0 ? rawForbidden : ['Без підказок'],
    });
  }

  return result;
}

export interface ParsedSpyEntry {
  name: string;
  roles: string[];
}

export function parseRawSpyText(rawText: string): ParsedSpyEntry[] {
  const lines = rawText.split(/\r?\n/);
  const seenLower = new Set<string>();
  const result: ParsedSpyEntry[] = [];

  for (const rawLine of lines) {
    const cleaned = rawLine.replace(/^(\d+[\.\)]\s*|[-•*]\s*)/, '').trim();
    if (cleaned.length < 2) continue;

    const sepIdx = cleaned.indexOf(':');
    const namePart = (sepIdx >= 0 ? cleaned.slice(0, sepIdx) : cleaned).trim();
    if (namePart.length < 2) continue;

    const lower = namePart.toLowerCase();
    if (seenLower.has(lower)) continue;
    seenLower.add(lower);

    const roles =
      sepIdx >= 0
        ? cleaned
            .slice(sepIdx + 1)
            .split(/[,;·|]/)
            .map((r) => r.trim())
            .filter((r) => r.length >= 2)
            .slice(0, 8)
        : ['Учасник', 'Гість', 'Очевидець', 'Експерт'];

    result.push({
      name: namePart,
      roles: roles.length > 0 ? roles : ['Учасник', 'Гість'],
    });
  }

  return result;
}

interface CreateCustomDeckParams {
  title: string;
  emoji: string;
  rawText: string;
  targetMode: CustomDeckTargetMode;
}

function buildCustomDeckPayload(
  deckId: string,
  { title, emoji, rawText, targetMode }: CreateCustomDeckParams
): Deck | null {
  const cleanTitle = title.trim() || 'Моя колода';
  const cleanEmoji = emoji.trim() || '🃏';

  if (targetMode === 'taboo') {
    const parsedTaboo = parseRawTabooText(rawText);
    if (parsedTaboo.length === 0) return null;

    const tabooItems: TabooItem[] = parsedTaboo.map((entry, index) => ({
      id: `${deckId}_tb_${index + 1}`,
      word: entry.word,
      forbiddenWords: entry.forbiddenWords,
      difficulty: 2 as const,
    }));

    return {
      id: deckId,
      title: cleanTitle,
      description: `Кастомна колода користувача (Табу • ${tabooItems.length} карток).`,
      emoji: cleanEmoji,
      isCustom: true,
      isPremium: false,
      items: {
        alias: [],
        crocodile: [],
        taboo: tabooItems,
        spyLocations: [],
      },
    };
  }

  if (targetMode === 'spy') {
    const parsedSpy = parseRawSpyText(rawText);
    if (parsedSpy.length === 0) return null;

    const spyLocations: SpyLocation[] = parsedSpy.map((entry, index) => ({
      id: `${deckId}_spy_${index + 1}`,
      name: entry.name,
      roles: entry.roles,
    }));

    return {
      id: deckId,
      title: cleanTitle,
      description: `Кастомна колода користувача (Локації Шпигуна • ${spyLocations.length} локацій).`,
      emoji: cleanEmoji,
      isCustom: true,
      isPremium: false,
      items: {
        alias: [],
        crocodile: [],
        taboo: [],
        spyLocations,
      },
    };
  }

  const parsedWords = parseRawDeckText(rawText);
  if (parsedWords.length === 0) {
    return null;
  }

  const aliasItems =
    targetMode === 'alias' || targetMode === 'both'
      ? parsedWords.map((word, index) => ({
          id: `${deckId}_al_${index + 1}`,
          word,
          difficulty: 2 as const,
        }))
      : [];

  const crocodileItems =
    targetMode === 'crocodile' || targetMode === 'both'
      ? parsedWords.map((phrase, index) => ({
          id: `${deckId}_cr_${index + 1}`,
          phrase,
          difficulty: 2 as const,
        }))
      : [];

  const modeDesc =
    targetMode === 'both'
      ? 'Еліас та Крокодил'
      : targetMode === 'alias'
        ? 'Тільки Еліас'
        : 'Тільки Крокодил';

  return {
    id: deckId,
    title: cleanTitle,
    description: `Кастомна колода користувача (${modeDesc} • ${parsedWords.length} карток).`,
    emoji: cleanEmoji,
    isCustom: true,
    isPremium: false,
    items: {
      alias: aliasItems,
      crocodile: crocodileItems,
      taboo: [],
      spyLocations: [],
    },
  };
}

interface DeckStoreState {
  customDecks: Deck[];
  getAllDecks: () => Deck[];
  getDeckById: (deckId: string) => Deck;
  resolveStepDeck: (
    deckId: string,
    deckIds?: string[],
    minDifficulty?: 1 | 2
  ) => Deck;
  createCustomDeck: (params: CreateCustomDeckParams) => Deck | null;
  updateCustomDeck: (deckId: string, params: CreateCustomDeckParams) => Deck | null;
  deleteCustomDeck: (deckId: string) => void;
}

export const useDeckStore = create<DeckStoreState>()(
  persist(
    (set, get) => ({
      customDecks: [],

      getAllDecks: () => {
        return [...OFFICIAL_DECKS, ...get().customDecks];
      },

      getDeckById: (deckId: string) => {
        const allDecks = get().getAllDecks();
        return allDecks.find((d) => d.id === deckId) ?? baseUaDeck;
      },

      resolveStepDeck: (deckId, deckIds, minDifficulty = 1) => {
        const allDecks = get().getAllDecks();
        const targetIds =
          deckIds && deckIds.length > 0
            ? deckIds
            : deckId.includes('+')
              ? deckId.split('+').filter(Boolean)
              : [deckId];
        const matched = targetIds
          .map((id) => allDecks.find((d) => d.id === id))
          .filter((d): d is Deck => Boolean(d));

        const sourceDecks = matched.length > 0 ? matched : [baseUaDeck];

        const rawAlias = sourceDecks.flatMap((d) => d.items.alias);
        const rawCroc = sourceDecks.flatMap((d) => d.items.crocodile);
        const rawTaboo = sourceDecks.flatMap((d) => d.items.taboo ?? []);
        const rawSpy = sourceDecks.flatMap((d) => d.items.spyLocations);

        const filteredAlias =
          minDifficulty > 1
            ? rawAlias.filter((item) => item.difficulty >= minDifficulty)
            : rawAlias;
        const filteredCroc =
          minDifficulty > 1
            ? rawCroc.filter((item) => item.difficulty >= minDifficulty)
            : rawCroc;
        const filteredTaboo =
          minDifficulty > 1
            ? rawTaboo.filter((item) => (item.difficulty ?? 2) >= minDifficulty)
            : rawTaboo;

        if (sourceDecks.length === 1 && minDifficulty === 1) {
          return sourceDecks[0];
        }

        const combinedTitle =
          sourceDecks.length === 1
            ? sourceDecks[0].title
            : `Мікс (${sourceDecks.length}: ${sourceDecks
                .map((d) => d.emoji)
                .join(' ')})`;

        return {
          id: sourceDecks.map((d) => d.id).join('+'),
          title: combinedTitle,
          description: 'Об’єднана колода для вечірки',
          emoji: sourceDecks[0].emoji,
          isCustom: false,
          isPremium: false,
          items: {
            alias: filteredAlias.length > 0 ? filteredAlias : rawAlias,
            crocodile: filteredCroc.length > 0 ? filteredCroc : rawCroc,
            taboo:
              filteredTaboo.length > 0
                ? filteredTaboo
                : rawTaboo.length > 0
                  ? rawTaboo
                  : baseUaDeck.items.taboo,
            spyLocations:
              rawSpy.length > 0 ? rawSpy : baseUaDeck.items.spyLocations,
          },
        };
      },

      createCustomDeck: (params) => {
        const timestamp = Date.now();
        const deckId = `custom_${timestamp}_${Math.random().toString(36).slice(2, 7)}`;
        const newDeck = buildCustomDeckPayload(deckId, params);
        if (!newDeck) {
          return null;
        }

        set((state) => ({
          customDecks: [newDeck, ...state.customDecks],
        }));

        return newDeck;
      },

      updateCustomDeck: (deckId, params) => {
        const existing = get().customDecks.find((d) => d.id === deckId);
        if (!existing) {
          return null;
        }

        const updatedDeck = buildCustomDeckPayload(deckId, params);
        if (!updatedDeck) {
          return null;
        }

        set((state) => ({
          customDecks: state.customDecks.map((d) =>
            d.id === deckId ? updatedDeck : d
          ),
        }));

        return updatedDeck;
      },

      deleteCustomDeck: (deckId: string) => {
        set((state) => ({
          customDecks: state.customDecks.filter((d) => d.id !== deckId),
        }));
      },
    }),
    {
      name: 'kolo-custom-decks',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({ customDecks: state.customDecks }),
    }
  )
);
