import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { guessMascotIdFromName } from '@/constants/mascots';
import { GameType, PresetStep, SpyLocation } from '@/types';

export interface PartyTeam {
  id: string;
  name: string;
  mascotId?: string;
  scoresByGroup: Record<string, number>;
}

export interface TurnStatsPayload {
  guessedCount?: number;
  skippedWords?: string[];
  bestStreak?: number;
  bonusGuessedCount?: number;
  stolenByTeamId?: string;
  stolenPoints?: number;
}

export interface LastTurnInfo {
  teamName: string;
  pointsDelta: number;
  gameType: GameType;
  stepTitle?: string;
}

export interface SpyTurnDraft {
  stepId: string;
  secretLocation: SpyLocation;
  spyIndices: number[];
  currentPlayerIndex: number;
  phase: 'ROLE_DISTRIBUTION' | 'DISCUSSION' | 'RESOLUTION';
  crossedLocationIds: string[];
  firstAskerIndex?: number;
  firstTargetIndex?: number;
  playerMissions?: Record<number, string>;
}

export interface SpyPartyStats {
  roundsPlayed: number;
  citizensWins: number;
  spyWins: number;
}

export interface StartSessionConfig {
  title: string;
  steps: PresetStep[];
  teamNames: string[];
  teamMascots?: string[];
  playerCount: number;
  playerNames?: string[];
}

interface PartyStoreState {
  sessionId: string;
  isActive: boolean;
  isCompleted: boolean;
  presetTitle: string;
  steps: PresetStep[];
  currentStepIndex: number;
  teams: PartyTeam[];
  savedTeamNames: string[];
  savedTeamMascots: string[];
  currentTeamIndex: number;
  currentRoundInStep: number;
  playerCount: number;
  playerNames: string[];
  savedPlayerNames: string[];

  totalGuessedWords: number;
  hardestUnansweredWord: string | null;
  bestStreakCount: number;
  bestStreakTeamName: string | null;
  bestTurnPoints: number;
  bestTurnTeamName: string | null;
  bonusWordsGuessed: number;
  lastTurnInfo: LastTurnInfo | null;
  spyDraft: SpyTurnDraft | null;
  spyStats: SpyPartyStats;

  startSession: (config: StartSessionConfig) => void;
  restartRematch: () => void;
  submitTeamTurnResult: (pointsDelta: number, stats?: TurnStatsPayload) => void;
  recordPartyStats: (stats: TurnStatsPayload, teamName?: string, turnPoints?: number) => void;
  setSpyDraft: (draft: SpyTurnDraft | null) => void;
  recordSpyOutcome: (winnerSide: 'citizens' | 'spy' | null) => void;
  advanceToNextStep: () => void;
  endSession: () => void;
}

const DEFAULT_TEAMS: PartyTeam[] = [
  { id: 'team_1', name: 'Бойові Гуси', mascotId: 'goose', scoresByGroup: { main: 0 } },
  { id: 'team_2', name: 'Хмільні Сови', mascotId: 'owl', scoresByGroup: { main: 0 } },
];

const DEFAULT_PLAYER_NAMES = ['Ігор', 'Аня', 'Макс', 'Оля', 'Діма'];

export const usePartyStore = create<PartyStoreState>()(
  persist(
    (set, get) => ({
      sessionId: '',
      isActive: false,
      isCompleted: false,
      presetTitle: '',
      steps: [],
      currentStepIndex: 0,
      teams: DEFAULT_TEAMS,
      savedTeamNames: ['Бойові Гуси', 'Хмільні Сови'],
      savedTeamMascots: ['goose', 'owl'],
      currentTeamIndex: 0,
      currentRoundInStep: 1,
      playerCount: 5,
      playerNames: DEFAULT_PLAYER_NAMES,
      savedPlayerNames: DEFAULT_PLAYER_NAMES,
      totalGuessedWords: 0,
      hardestUnansweredWord: null,
      bestStreakCount: 0,
      bestStreakTeamName: null,
      bestTurnPoints: 0,
      bestTurnTeamName: null,
      bonusWordsGuessed: 0,
      lastTurnInfo: null,
      spyDraft: null,
      spyStats: { roundsPlayed: 0, citizensWins: 0, spyWins: 0 },

      startSession: ({ title, steps, teamNames, teamMascots, playerCount, playerNames }) => {
        const cleanTeamNames =
          teamNames.length >= 2
            ? teamNames.map((n, i) => n.trim() || `Команда ${i + 1}`)
            : ['Команда 1', 'Команда 2'];

        const cleanTeamMascots = cleanTeamNames.map(
          (name, idx) => teamMascots?.[idx] || guessMascotIdFromName(name, idx)
        );

        const safeCount = Math.max(3, Math.min(16, playerCount));
        const cleanPlayerNames = Array.from({ length: safeCount }, (_, idx) => {
          const raw = playerNames?.[idx]?.trim();
          return raw || `Гравець ${idx + 1}`;
        });

        const now = Date.now();
        const initialTeams: PartyTeam[] = cleanTeamNames.map((name, idx) => ({
          id: `team_${idx + 1}_${now}`,
          name,
          mascotId: cleanTeamMascots[idx],
          scoresByGroup: { main: 0 },
        }));

        set({
          sessionId: `sess_${now}_${Math.random().toString(36).slice(2, 6)}`,
          isActive: true,
          isCompleted: false,
          presetTitle: title,
          steps,
          currentStepIndex: 0,
          teams: initialTeams,
          savedTeamNames: cleanTeamNames,
          savedTeamMascots: cleanTeamMascots,
          currentTeamIndex: 0,
          currentRoundInStep: 1,
          playerCount: safeCount,
          playerNames: cleanPlayerNames,
          savedPlayerNames: cleanPlayerNames,
          totalGuessedWords: 0,
          hardestUnansweredWord: null,
          bestStreakCount: 0,
          bestStreakTeamName: null,
          bestTurnPoints: 0,
          bestTurnTeamName: null,
          bonusWordsGuessed: 0,
          lastTurnInfo: null,
          spyDraft: null,
          spyStats: { roundsPlayed: 0, citizensWins: 0, spyWins: 0 },
        });
      },

      restartRematch: () => {
        const state = get();
        const now = Date.now();
        const resetTeams: PartyTeam[] = state.teams.map((t, idx) => ({
          id: `team_${idx + 1}_${now}`,
          name: t.name,
          mascotId: t.mascotId ?? guessMascotIdFromName(t.name, idx),
          scoresByGroup: { main: 0 },
        }));

        set({
          sessionId: `sess_${now}_${Math.random().toString(36).slice(2, 6)}`,
          isActive: true,
          isCompleted: false,
          currentStepIndex: 0,
          teams: resetTeams,
          currentTeamIndex: 0,
          currentRoundInStep: 1,
          totalGuessedWords: 0,
          hardestUnansweredWord: null,
          bestStreakCount: 0,
          bestStreakTeamName: null,
          bestTurnPoints: 0,
          bestTurnTeamName: null,
          bonusWordsGuessed: 0,
          lastTurnInfo: null,
          spyDraft: null,
          spyStats: { roundsPlayed: 0, citizensWins: 0, spyWins: 0 },
        });
      },

      setSpyDraft: (draft) => {
        set({ spyDraft: draft });
      },

      recordSpyOutcome: (winnerSide) => {
        set((state) => ({
          spyDraft: null,
          spyStats: {
            roundsPlayed: state.spyStats.roundsPlayed + 1,
            citizensWins:
              state.spyStats.citizensWins + (winnerSide === 'citizens' ? 1 : 0),
            spyWins: state.spyStats.spyWins + (winnerSide === 'spy' ? 1 : 0),
          },
        }));
      },

      recordPartyStats: (stats, teamName, turnPoints) => {
        if (!stats) return;
        set((state) => {
          const addedGuessed = stats.guessedCount ?? 0;
          const addedBonus = stats.bonusGuessedCount ?? 0;
          const skipped = stats.skippedWords ?? [];
          let nextHardest = state.hardestUnansweredWord;

          if (skipped.length > 0) {
            const candidate = [...skipped].sort((a, b) => b.length - a.length)[0];
            if (
              candidate &&
              (!nextHardest || candidate.length >= nextHardest.length || Math.random() > 0.4)
            ) {
              nextHardest = candidate;
            }
          }

          let nextBestStreakCount = state.bestStreakCount;
          let nextBestStreakTeam = state.bestStreakTeamName;
          if ((stats.bestStreak ?? 0) > nextBestStreakCount && teamName) {
            nextBestStreakCount = stats.bestStreak!;
            nextBestStreakTeam = teamName;
          }

          let nextBestTurnPoints = state.bestTurnPoints;
          let nextBestTurnTeam = state.bestTurnTeamName;
          if ((turnPoints ?? 0) > nextBestTurnPoints && teamName) {
            nextBestTurnPoints = turnPoints!;
            nextBestTurnTeam = teamName;
          }

          return {
            totalGuessedWords: state.totalGuessedWords + addedGuessed,
            bonusWordsGuessed: state.bonusWordsGuessed + addedBonus,
            hardestUnansweredWord: nextHardest,
            bestStreakCount: nextBestStreakCount,
            bestStreakTeamName: nextBestStreakTeam,
            bestTurnPoints: nextBestTurnPoints,
            bestTurnTeamName: nextBestTurnTeam,
          };
        });
      },

      submitTeamTurnResult: (pointsDelta, stats) => {
        const state = get();
        const currentStep = state.steps[state.currentStepIndex];
        if (!currentStep) {
          get().advanceToNextStep();
          return;
        }

        const currentTeam = state.teams[state.currentTeamIndex];
        if (stats) {
          get().recordPartyStats(stats, currentTeam?.name, pointsDelta);
        }

        const updatedTeams = state.teams.map((team, idx) => {
          if (currentStep.scoring.type !== 'team') return team;
          const groupId = currentStep.scoring.groupId || 'main';
          const prevScore = team.scoresByGroup[groupId] ?? 0;

          let deltaForTeam = 0;
          if (idx === state.currentTeamIndex) {
            deltaForTeam += pointsDelta;
          }
          if (stats?.stolenByTeamId && team.id === stats.stolenByTeamId) {
            deltaForTeam += stats.stolenPoints ?? 1;
          }
          if (deltaForTeam === 0) return team;

          return {
            ...team,
            scoresByGroup: {
              ...team.scoresByGroup,
              [groupId]: prevScore + deltaForTeam,
            },
          };
        });

        const turnInfo: LastTurnInfo | null = currentTeam
          ? {
              teamName: currentTeam.name,
              pointsDelta,
              gameType: currentStep.gameType,
            }
          : null;

        const roundsPerTeam =
          currentStep.gameType === 'alias' ||
          currentStep.gameType === 'crocodile' ||
          currentStep.gameType === 'taboo'
            ? currentStep.roundsPerTeam
            : 1;

        const nextTeamIndex = state.currentTeamIndex + 1;

        if (nextTeamIndex < state.teams.length) {
          set({
            teams: updatedTeams,
            currentTeamIndex: nextTeamIndex,
            lastTurnInfo: turnInfo,
          });
          return;
        }

        if (state.currentRoundInStep < roundsPerTeam) {
          set({
            teams: updatedTeams,
            currentTeamIndex: 0,
            currentRoundInStep: state.currentRoundInStep + 1,
            lastTurnInfo: turnInfo,
          });
          return;
        }

        set({
          teams: updatedTeams,
          lastTurnInfo: turnInfo,
        });
        get().advanceToNextStep();
      },

      advanceToNextStep: () => {
        const state = get();
        const nextIndex = state.currentStepIndex + 1;

        if (nextIndex >= state.steps.length) {
          set({
            isCompleted: true,
            currentTeamIndex: 0,
            currentRoundInStep: 1,
            spyDraft: null,
          });
        } else {
          set({
            currentStepIndex: nextIndex,
            currentTeamIndex: 0,
            currentRoundInStep: 1,
            isCompleted: false,
            spyDraft: null,
          });
        }
      },

      endSession: () => {
        set({
          isActive: false,
          isCompleted: false,
          presetTitle: '',
          steps: [],
          currentStepIndex: 0,
          currentTeamIndex: 0,
          currentRoundInStep: 1,
          lastTurnInfo: null,
          spyDraft: null,
          spyStats: { roundsPlayed: 0, citizensWins: 0, spyWins: 0 },
        });
      },
    }),
    {
      name: 'kolo-active-party',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
