import { COLORS } from '@/constants/theme';
import { PartyPreset } from '@/types';

export const PARTY_PRESETS: PartyPreset[] = [
  {
    id: 'warmup',
    title: 'Розігрів',
    subtitle: 'Швидкий старт вечора: пояснюємо слова та показуємо жестами в одному командному заліку.',
    durationLabel: '15 хв',
    emoji: '🔥',
    accentColor: COLORS.hot,
    steps: [
      {
        id: 'warmup_alias',
        deckId: 'warmup_ua',
        gameType: 'alias',
        roundTimeSec: 60,
        penaltyForSkip: false,
        roundsPerTeam: 1,
        scoring: { type: 'team', groupId: 'main' },
      },
      {
        id: 'warmup_crocodile',
        deckId: 'warmup_ua',
        gameType: 'crocodile',
        roundTimeSec: 60,
        roundsPerTeam: 1,
        scoring: { type: 'team', groupId: 'main' },
      },
    ],
  },
  {
    id: 'strangers',
    title: 'Незнайомці',
    subtitle: 'Ідеальний айсбрейкер для нової компанії: спочатку сміємося в Крокодилі, потім шукаємо Шпигуна.',
    durationLabel: '25 хв',
    emoji: '🎭',
    accentColor: COLORS.primary,
    steps: [
      {
        id: 'strangers_crocodile',
        deckId: 'base_ua',
        gameType: 'crocodile',
        roundTimeSec: 90,
        roundsPerTeam: 1,
        scoring: { type: 'none' },
      },
      {
        id: 'strangers_spy',
        deckId: 'base_ua',
        gameType: 'spy',
        spyCount: 1,
        discussionTimeSec: 300,
        scoring: { type: 'none' },
      },
    ],
  },
  {
    id: 'uncensored',
    title: 'Без цензури 18+',
    subtitle: 'Гарячий мікс без гальм для близьких друзів: відвертий Еліас і шалений Крокодил.',
    durationLabel: '20 хв',
    emoji: '🌶️',
    accentColor: COLORS.spy,
    steps: [
      {
        id: 'uncensored_alias',
        deckId: 'adult_18_ua',
        gameType: 'alias',
        roundTimeSec: 60,
        penaltyForSkip: true,
        roundsPerTeam: 1,
        scoring: { type: 'team', groupId: 'main' },
      },
      {
        id: 'uncensored_crocodile',
        deckId: 'adult_18_ua',
        gameType: 'crocodile',
        roundTimeSec: 90,
        roundsPerTeam: 1,
        scoring: { type: 'team', groupId: 'main' },
      },
    ],
  },
  {
    id: 'battle',
    title: 'Битва команд',
    subtitle: 'Повноцінний турнір на три раунди: класичний Еліас, пантоміма та фінальний Бліц-Еліас на 30 секунд.',
    durationLabel: '30 хв',
    emoji: '🏆',
    accentColor: COLORS.alias,
    steps: [
      {
        id: 'battle_alias_1',
        deckId: 'base_ua',
        gameType: 'alias',
        roundTimeSec: 60,
        penaltyForSkip: true,
        roundsPerTeam: 1,
        scoring: { type: 'team', groupId: 'main' },
      },
      {
        id: 'battle_crocodile',
        deckId: 'base_ua',
        gameType: 'crocodile',
        roundTimeSec: 60,
        roundsPerTeam: 1,
        scoring: { type: 'team', groupId: 'main' },
      },
      {
        id: 'battle_alias_blitz',
        deckId: 'base_ua',
        gameType: 'alias',
        roundTimeSec: 30,
        penaltyForSkip: true,
        roundsPerTeam: 1,
        scoring: { type: 'team', groupId: 'main' },
      },
    ],
  },
];

export default PARTY_PRESETS;
