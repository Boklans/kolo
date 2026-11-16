import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { UsedContentMap } from '@/types';

type PoolKey = 'alias' | 'crocodile' | 'taboo' | 'spyLocations';

interface UsedContentState {
  used: UsedContentMap;
  drawNextItem: <T extends { id: string }>(
    deckId: string,
    poolKey: PoolKey,
    fullPool: T[],
    currentRoundExcludeIds?: string[]
  ) => T | null;
  resetDeckHistory: (deckId?: string) => void;
}

const createEmptyDeckEntry = () => ({
  alias: [],
  crocodile: [],
  taboo: [],
  spyLocations: [],
});

const PREFIX_TO_DECK_ID: Record<string, string> = {
  base: 'base_ua',
  warmup: 'warmup_ua',
  memes: 'memes_ua',
  it: 'it_office_ua',
  adult: 'adult_18_ua',
};

function resolveItemOwnerDeckId(itemId: string, fallbackDeckId: string): string {
  const parts = fallbackDeckId.split('+');
  if (parts.length <= 1) return fallbackDeckId;

  const prefix = itemId.split('_')[0];
  if (prefix && PREFIX_TO_DECK_ID[prefix]) {
    return PREFIX_TO_DECK_ID[prefix];
  }
  for (const part of parts) {
    if (itemId.startsWith(part)) return part;
  }
  return parts[0];
}

export const useUsedContentStore = create<UsedContentState>()(
  persist(
    (set, get) => ({
      used: {},

      drawNextItem: <T extends { id: string }>(
        deckId: string,
        poolKey: PoolKey,
        fullPool: T[],
        currentRoundExcludeIds: string[] = []
      ): T | null => {
        if (!fullPool || fullPool.length === 0) {
          return null;
        }

        const state = get();
        const sourceDeckIds = deckId.split('+').filter(Boolean);
        const excludeSet = new Set(currentRoundExcludeIds);

        // Gather all used IDs across all constituent decks in the mix
        const usedSet = new Set<string>();
        for (const srcId of sourceDeckIds) {
          const entry = state.used[srcId];
          if (entry && entry[poolKey]) {
            for (const id of entry[poolKey]) {
              usedSet.add(id);
            }
          }
        }

        // 1. Відфільтровуємо fullPool: залишаємо елементи, яких немає ні в used, ні в currentRoundExcludeIds
        let available = fullPool.filter(
          (item) => !usedSet.has(item.id) && !excludeSet.has(item.id)
        );

        let didResetPool = false;

        // 2. Захист від порожнього пулу посеред раунду
        if (available.length === 0) {
          didResetPool = true;
          available = fullPool.filter((item) => !excludeSet.has(item.id));

          if (available.length === 0) {
            available = [...fullPool];
          }
        }

        // 3. Обираємо випадковий елемент рівномірно
        const randomIndex = Math.floor(Math.random() * available.length);
        const chosenItem = available[randomIndex];

        if (!chosenItem) {
          return null;
        }

        const ownerDeckId = resolveItemOwnerDeckId(chosenItem.id, deckId);

        set((prev) => {
          const nextUsedMap: UsedContentMap = { ...prev.used };

          if (didResetPool) {
            for (const srcId of sourceDeckIds) {
              const existingEntry = nextUsedMap[srcId] ?? createEmptyDeckEntry();
              nextUsedMap[srcId] = {
                ...existingEntry,
                [poolKey]: [],
              };
            }
          }

          const targetEntry = nextUsedMap[ownerDeckId] ?? createEmptyDeckEntry();
          const currentList = targetEntry[poolKey] ?? [];
          const updatedList = currentList.includes(chosenItem.id)
            ? currentList
            : [...currentList, chosenItem.id];

          nextUsedMap[ownerDeckId] = {
            ...targetEntry,
            [poolKey]: updatedList,
          };

          return { used: nextUsedMap };
        });

        return chosenItem;
      },

      resetDeckHistory: (deckId?: string) => {
        if (deckId) {
          set((prev) => ({
            used: {
              ...prev.used,
              [deckId]: createEmptyDeckEntry(),
            },
          }));
        } else {
          set({ used: {} });
        }
      },
    }),
    {
      name: 'kolo-used-content',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
