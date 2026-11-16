import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { GameType, PresetStep, SpyLocation } from '@/types';

export interface PartyTeam {
  id: string;
  name: string;
  scoresByGroup: Record<string, number>;
}

export interface TurnStatsPayload {
  guessedCount?: number;
  skippedWords?: string[];
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
  playerCount: number;
}

interface PartyStoreState {
  isActive: boolean;
  isCompleted: boolean;
  presetTitle: string;
  steps: PresetStep[];
  currentStepIndex: number;
  teams: PartyTeam[];
  savedTeamNames: string[];
  currentTeamIndex: number;
  currentRoundInStep: number;
  playerCount: number;

  totalGuessedWords: number;
  hardestUnansweredWord: string | null;
  lastTurnInfo: LastTurnInfo | null;
  spyDraft: SpyTurnDraft | null;
  spyStats: SpyPartyStats;

  startSession: (config: StartSessionConfig) => void;
  restartRematch: () => void;
  submitTeamTurnResult: (pointsDelta: number, stats?: TurnStatsPayload) => void;
  recordPartyStats: (stats: TurnStatsPayload) => void;
  setSpyDraft: (draft: SpyTurnDraft | null) => void;
  recordSpyOutcome: (winnerSide: 'citizens' | 'spy' | null) => void;
  advanceToNextStep: () => void;
  endSession: () => void;
}

const DEFAULT_TEAMS: PartyTeam[] = [
  { id: 'team_1', name: 'Бойові Гуси', scoresByGroup: { main: 0 } },
  { id: 'team_2', name: 'Хмільні Сови', scoresByGroup: { main: 0 } },
];

export const usePartyStore = create<PartyStoreState>()(
  persist(
    (set, get) => ({
      isActive: false,
      isCompleted: false,
      presetTitle: '',
      steps: [],
      currentStepIndex: 0,
      teams: DEFAULT_TEAMS,
      savedTeamNames: ['Бойові Гуси', 'Хмільні Сови'],
      currentTeamIndex: 0,
      currentRoundInStep: 1,
      playerCount: 5,
      totalGuessedWords: 0,
      hardestUnansweredWord: null,
      lastTurnInfo: null,
      spyDraft: null,
      spyStats: { roundsPlayed: 0, citizensWins: 0, spyWins: 0 },

      startSession: ({ title, steps, teamNames, playerCount }) => {
        const cleanTeamNames =
          teamNames.length >= 2
            ? teamNames.map((n, i) => n.trim() || `Команда ${i + 1}`)
            : ['Команда 1', 'Команда 2'];

        const initialTeams: PartyTeam[] = cleanTeamNames.map((name, idx) => ({
          id: `team_${idx + 1}_${Date.now()}`,
          name,
          scoresByGroup: { main: 0 },
        }));

        set({
          isActive: true,
          isCompleted: false,
          presetTitle: title,
          steps,
          currentStepIndex: 0,
          teams: initialTeams,
          savedTeamNames: cleanTeamNames,
          currentTeamIndex: 0,
          currentRoundInStep: 1,
          playerCount: Math.max(3, Math.min(16, playerCount)),
          totalGuessedWords: 0,
          hardestUnansweredWord: null,
          lastTurnInfo: null,
          spyDraft: null,
          spyStats: { roundsPlayed: 0, citizensWins: 0, spyWins: 0 },
        });
      },

      restartRematch: () => {
        const state = get();
        const resetTeams: PartyTeam[] = state.teams.map((t, idx) => ({
          id: `team_${idx + 1}_${Date.now()}`,
          name: t.name,
          scoresByGroup: { main: 0 },
        }));

        set({
          isActive: true,
          isCompleted: false,
          currentStepIndex: 0,
          teams: resetTeams,
          currentTeamIndex: 0,
          currentRoundInStep: 1,
          totalGuessedWords: 0,
          hardestUnansweredWord: null,
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

      recordPartyStats: (stats) => {
        if (!stats) return;
        set((state) => {
          const addedGuessed = stats.guessedCount ?? 0;
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

          return {
            totalGuessedWords: state.totalGuessedWords + addedGuessed,
            hardestUnansweredWord: nextHardest,
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

        if (stats) {
          get().recordPartyStats(stats);
        }

        const currentTeam = state.teams[state.currentTeamIndex];
        const updatedTeams = state.teams.map((team, idx) => {
          if (idx !== state.currentTeamIndex) return team;
          if (currentStep.scoring.type !== 'team') return team;

          const groupId = currentStep.scoring.groupId || 'main';
          const prevScore = team.scoresByGroup[groupId] ?? 0;
          return {
            ...team,
            scoresByGroup: {
              ...team.scoresByGroup,
              [groupId]: prevScore + pointsDelta,
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
          currentStep.gameType === 'alias' || currentStep.gameType === 'crocodile'
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
