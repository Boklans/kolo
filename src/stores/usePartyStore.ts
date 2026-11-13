import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { GameType, PresetStep } from '@/types';

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
  currentTeamIndex: number;
  currentRoundInStep: number;
  playerCount: number;

  // Статистика вечірки для фінального постера (Ітерація 4)
  totalGuessedWords: number;
  hardestUnansweredWord: string | null;
  lastTurnInfo: LastTurnInfo | null;

  startSession: (config: StartSessionConfig) => void;
  submitTeamTurnResult: (pointsDelta: number, stats?: TurnStatsPayload) => void;
  recordPartyStats: (stats: TurnStatsPayload) => void;
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
      currentTeamIndex: 0,
      currentRoundInStep: 1,
      playerCount: 5,
      totalGuessedWords: 0,
      hardestUnansweredWord: null,
      lastTurnInfo: null,

      startSession: ({ title, steps, teamNames, playerCount }) => {
        const cleanTeamNames =
          teamNames.length >= 2
            ? teamNames
            : ['Команда 1', 'Команда 2'];

        const initialTeams: PartyTeam[] = cleanTeamNames.map((name, idx) => ({
          id: `team_${idx + 1}_${Date.now()}`,
          name: name.trim() || `Команда ${idx + 1}`,
          scoresByGroup: { main: 0 },
        }));

        set({
          isActive: true,
          isCompleted: false,
          presetTitle: title,
          steps,
          currentStepIndex: 0,
          teams: initialTeams,
          currentTeamIndex: 0,
          currentRoundInStep: 1,
          playerCount: Math.max(3, Math.min(16, playerCount)),
          totalGuessedWords: 0,
          hardestUnansweredWord: null,
          lastTurnInfo: null,
        });
      },

      recordPartyStats: (stats) => {
        if (!stats) return;
        set((state) => {
          const addedGuessed = stats.guessedCount ?? 0;
          const skipped = stats.skippedWords ?? [];
          let nextHardest = state.hardestUnansweredWord;

          if (skipped.length > 0) {
            // Обираємо найдовше або випадкове пропущене слово з раунду як кандидата
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

        // Усі команди відіграли поточне коло
        if (state.currentRoundInStep < roundsPerTeam) {
          set({
            teams: updatedTeams,
            currentTeamIndex: 0,
            currentRoundInStep: state.currentRoundInStep + 1,
            lastTurnInfo: turnInfo,
          });
          return;
        }

        // Усі команди відіграли всі раунди поточного кроку -> переходимо до наступного кроку
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
          });
        } else {
          set({
            currentStepIndex: nextIndex,
            currentTeamIndex: 0,
            currentRoundInStep: 1,
            isCompleted: false,
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
        });
      },
    }),
    {
      name: 'kolo-active-party',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
