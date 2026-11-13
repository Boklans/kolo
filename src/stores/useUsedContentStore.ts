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
        const deckUsed = state.used[deckId] ?? createEmptyDeckEntry();
        const usedIdsForPool = deckUsed[poolKey] ?? [];
        const excludeSet = new Set(currentRoundExcludeIds);
        const usedSet = new Set(usedIdsForPool);

        // 1. Відфільтровуємо fullPool: залишаємо елементи, яких немає ні в used, ні в currentRoundExcludeIds
        let available = fullPool.filter(
          (item) => !usedSet.has(item.id) && !excludeSet.has(item.id)
        );

        let nextUsedForPool = [...usedIdsForPool];

        // 2. Захист від порожнього пулу посеред раунду
        if (available.length === 0) {
          nextUsedForPool = [];
          available = fullPool.filter((item) => !excludeSet.has(item.id));

          // Якщо і після цього пусто — беремо весь fullPool
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

        if (!nextUsedForPool.includes(chosenItem.id)) {
          nextUsedForPool.push(chosenItem.id);
        }

        set((prev) => {
          const prevDeckUsed = prev.used[deckId] ?? createEmptyDeckEntry();
          return {
            used: {
              ...prev.used,
              [deckId]: {
                ...prevDeckUsed,
                [poolKey]: nextUsedForPool,
              },
            },
          };
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
