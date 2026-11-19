import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

export interface PartyHistoryTeamEntry {
  name: string;
  mascotId?: string;
  score: number;
}

export interface PartyHistoryRecord {
  id: string;
  sessionId: string;
  playedAt: number;
  presetTitle: string;
  winnerName: string;
  winnerMascotId?: string;
  winnerScore: number;
  isTie: boolean;
  teams: PartyHistoryTeamEntry[];
  totalGuessedWords: number;
  bestStreakCount: number;
  bestStreakTeamName: string | null;
  bestTurnPoints: number;
  hardestUnansweredWord: string | null;
  achievements: string[];
  spyRoundsPlayed: number;
  spyCitizensWins: number;
}

interface HistoryStoreState {
  records: PartyHistoryRecord[];
  addRecord: (record: Omit<PartyHistoryRecord, 'id' | 'playedAt'>) => void;
  removeRecord: (id: string) => void;
  clearHistory: () => void;
}

export const useHistoryStore = create<HistoryStoreState>()(
  persist(
    (set, get) => ({
      records: [],

      addRecord: (incoming) => {
        const existing = get().records;
        if (existing.some((r) => r.sessionId === incoming.sessionId)) {
          return;
        }
        const nextRecord: PartyHistoryRecord = {
          ...incoming,
          id: `hist_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          playedAt: Date.now(),
        };
        set({
          records: [nextRecord, ...existing].slice(0, 30),
        });
      },

      removeRecord: (id) => {
        set((state) => ({
          records: state.records.filter((r) => r.id !== id),
        }));
      },

      clearHistory: () => {
        set({ records: [] });
      },
    }),
    {
      name: 'balaka-party-history',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
