export type GameType = 'alias' | 'crocodile' | 'spy' | 'taboo';

export type AliasItem = { id: string; word: string; difficulty: 1 | 2 | 3 };
export type CrocodileItem = { id: string; phrase: string; difficulty: 1 | 2 | 3 };
export type TabooItem = { id: string; word: string; forbiddenWords: string[]; difficulty?: 1 | 2 | 3 };
export type SpyLocation = { id: string; name: string; roles?: string[] };

export type Deck = {
  id: string;
  title: string;
  description?: string;
  emoji: string;
  isCustom: boolean;
  isPremium: boolean;
  items: {
    alias: AliasItem[];
    crocodile: CrocodileItem[];
    taboo: TabooItem[];
    spyLocations: SpyLocation[];
  };
};

export type UsedContentMap = {
  [deckId: string]: {
    alias: string[];
    crocodile: string[];
    taboo: string[];
    spyLocations: string[];
  };
};

export type TeamScoringPolicy = { type: 'team'; groupId: string };
export type NoScoringPolicy = { type: 'none' };
export type ScoringPolicy = TeamScoringPolicy | NoScoringPolicy;

export type BaseStep = {
  id: string;
  deckId: string;
  deckIds?: string[];
  minDifficulty?: 1 | 2;
};

export type AliasStep = BaseStep & {
  gameType: 'alias';
  roundTimeSec: 30 | 60 | 90;
  penaltyForSkip: boolean;
  roundsPerTeam: number;
  scoring: TeamScoringPolicy | NoScoringPolicy;
};

export type CrocodileStep = BaseStep & {
  gameType: 'crocodile';
  roundTimeSec: 60 | 90 | 120;
  roundsPerTeam: number;
  scoring: TeamScoringPolicy | NoScoringPolicy;
};

export type SpyStep = BaseStep & {
  gameType: 'spy';
  spyCount: 1 | 2;
  discussionTimeSec: 180 | 300 | 420;
  missionsEnabled?: boolean;
  scoring: NoScoringPolicy;
};

export type TabooStep = BaseStep & {
  gameType: 'taboo';
  roundTimeSec: 30 | 60 | 90;
  penaltyForTaboo: boolean;
  roundsPerTeam: number;
  scoring: TeamScoringPolicy | NoScoringPolicy;
};

export type PresetStep = AliasStep | CrocodileStep | SpyStep | TabooStep;

export type PartyPreset = {
  id: string;
  title: string;
  subtitle: string;
  durationLabel: string;
  emoji: string;
  accentColor: string;
  steps: PresetStep[];
};

export type SessionSetupConfig = {
  mode: 'preset' | 'single_game';
  targetId: string;
  deckId: string;
  teams: { id: string; name: string; score: number }[];
  playerCount: number;
};
