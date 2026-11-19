export interface TeamMascot {
  id: string;
  emoji: string;
  label: string;
  accentHex: string;
  bgTint: string;
}

export const TEAM_MASCOTS: TeamMascot[] = [
  {
    id: 'goose',
    emoji: '🪿',
    label: 'Гусак',
    accentHex: '#F97316',
    bgTint: 'rgba(249, 115, 22, 0.18)',
  },
  {
    id: 'owl',
    emoji: '🦉',
    label: 'Сова',
    accentHex: '#8B5CF6',
    bgTint: 'rgba(139, 92, 246, 0.18)',
  },
  {
    id: 'capybara',
    emoji: '🦫',
    label: 'Капібара',
    accentHex: '#10B981',
    bgTint: 'rgba(16, 185, 129, 0.18)',
  },
  {
    id: 'dragon',
    emoji: '🐉',
    label: 'Дракон',
    accentHex: '#3B82F6',
    bgTint: 'rgba(59, 130, 246, 0.18)',
  },
  {
    id: 'fox',
    emoji: '🦊',
    label: 'Лис',
    accentHex: '#FB923C',
    bgTint: 'rgba(251, 146, 60, 0.18)',
  },
  {
    id: 'cat',
    emoji: '😼',
    label: 'Кіт',
    accentHex: '#F43F5E',
    bgTint: 'rgba(244, 63, 94, 0.18)',
  },
  {
    id: 'dumpling',
    emoji: '🥟',
    label: 'Вареник',
    accentHex: '#FACC15',
    bgTint: 'rgba(250, 204, 21, 0.18)',
  },
  {
    id: 'bolt',
    emoji: '⚡',
    label: 'Іскра',
    accentHex: '#38BDF8',
    bgTint: 'rgba(56, 189, 248, 0.18)',
  },
];

export function guessMascotIdFromName(name: string, fallbackIndex = 0): string {
  const lower = name.toLowerCase();
  if (lower.includes('гус')) return 'goose';
  if (lower.includes('сов')) return 'owl';
  if (lower.includes('капібар') || lower.includes('бобр')) return 'capybara';
  if (lower.includes('дракон')) return 'dragon';
  if (lower.includes('лис')) return 'fox';
  if (lower.includes('кіт') || lower.includes('кот')) return 'cat';
  if (lower.includes('вареник') || lower.includes('сир')) return 'dumpling';
  if (lower.includes('кібер') || lower.includes('павер') || lower.includes('нео')) {
    return 'bolt';
  }
  return TEAM_MASCOTS[fallbackIndex % TEAM_MASCOTS.length].id;
}

export function getTeamMascot(
  mascotId?: string,
  teamName = '',
  fallbackIndex = 0
): TeamMascot {
  if (mascotId) {
    const exact = TEAM_MASCOTS.find((m) => m.id === mascotId);
    if (exact) return exact;
  }
  const guessed = guessMascotIdFromName(teamName, fallbackIndex);
  return (
    TEAM_MASCOTS.find((m) => m.id === guessed) ??
    TEAM_MASCOTS[fallbackIndex % TEAM_MASCOTS.length]
  );
}

export type ForfeitIntensity = 'light' | 'chaos' | 'hot18';

export const PARTY_FORFEITS: Record<ForfeitIntensity, string[]> = {
  light: [
    'Проголосіть урочистий тост за команду переможців так, ніби вручаєте їм «Оскар».',
    'Уся команда, що програла, має 15 секунд зображати одну спільну скульптуру на вибір переможців.',
    'Заспівайте хором приспів будь-якого українського хіта, але замість слів використовуйте тільки «мяу».',
    'Кожен учасник команди називає по одному чесному компліменту кожному з переможців.',
    'Зробіть командне фото у найдраматичнішій позі «ми ще повернемось» і скиньте в спільний чат.',
    'Наступні 5 хвилин команда звертається до переможців виключно на «Ви» і «Ваша величносте».',
    'Один представник команди має без сміху розповісти найсухіший анекдот, поки інші намагаються розсмішити.',
    'Розлийте або принесіть напої всім переможцям з обслуговуванням рівня 5-зіркового ресторану.',
  ],
  chaos: [
    'Запишіть 10-секундне голосове в спільний чат із драматичним вибаченням за свою поразку.',
    'Кожен учасник команди на 1 хвилину міняється одним елементом одягу або аксесуаром із сусідом.',
    'Станцюйте 20-секундний синхронний TikTok-танець під ритм, який вистукують переможці по столу.',
    'Озвучте в реальному часі «рекламу» звичайного предмета зі столу так, щоб усі захотіли його купити.',
    'Капітан команди має 30 секунд говорити лише голосом диктора новин про «трагедію цього вечора».',
    'Зіграйте міні-сценку «Як ми програли у фіналі» у режимі сповільненої зйомки (Slow-Mo).',
    'Переможці придумують команді нову смішну назву — саме під нею ви граєте наступний реванш!',
    'Кожен із команди показує свою найкращу пародію на будь-якого іншого гравця за столом.',
  ],
  hot18: [
    'Кожен учасник команди розповідає свою найнезручнішу історію з побачення або вечірки (до 30 сек).',
    'Відкрийте останнє фото в галереї (або 5-те з кінця) і придумайте йому максимально пафосну історію.',
    'Покажіть 3 останні емодзі в клавіатурі й чесно поясніть, за яких обставин їх надсилали.',
    'Команда відповідає «Правда» на одне гостре, але адекватне питання від переможців.',
    'Прочитайте останнє надіслане повідомлення в месенджері голосом спокусника з кіно 90-х.',
    'Назвіть «червоний прапорець», який ви колись ігнорували, хоча всі друзі попереджали.',
    'Зробіть найпалкіший комплімент людині навпроти, не відводячи погляду 10 секунд.',
    'Кожен гравець команди зізнається у своєму найбільшому «guilty pleasure» (фільм, трек або звичка).',
  ],
};

export const SPY_SECRET_MISSIONS: string[] = [
  'Непомітно згадай у своїй відповіді будь-яку їжу або напій.',
  'Обов’язково перепитай перше запитання до себе («Секунду, ти маєш на увазі...»).',
  'Відповідай із максимально серйозним обличчям, наче ти на допиті у спецслужб.',
  'У своїй відповіді використай точну цифру або число (наприклад, «три», «п’ятдесят»).',
  'Похвали запитання того, хто тебе питає, перш ніж відповісти.',
  'Відповідай максимально коротко — не більше 5 слів за один раз.',
  'Згадай у будь-якій відповіді погоду, температуру або пору року.',
  'Подивись підозріло на гравця ліворуч одразу після своєї відповіді.',
  'У своїй відповіді порівняй це місце з дитинством або школою.',
  'Обов’язково згадай якусь тварину або звук.',
  'Відповідаючи, жестикулюй руками так, ніби ти екскурсовод.',
  'Додай у свою відповідь фразу «якщо чесно» або «між нами».',
];

export interface ShowCommentatorInput {
  rankedTeams: { id: string; name: string; totalScore: number }[];
  nextTeamName?: string;
  lastTurnTeamName?: string;
  lastTurnDelta?: number;
  currentRoundInStep: number;
}

export function buildShowCommentatorLine({
  rankedTeams,
  nextTeamName,
  lastTurnTeamName,
  lastTurnDelta,
  currentRoundInStep,
}: ShowCommentatorInput): string {
  if (rankedTeams.length < 2) {
    return 'Усі мікрофони ввімкнено — шоу триває!';
  }

  const leader = rankedTeams[0];
  const runnerUp = rankedTeams[1];
  const gap = leader.totalScore - runnerUp.totalScore;

  if (lastTurnDelta !== undefined && lastTurnDelta >= 9 && lastTurnTeamName) {
    return `🔥 ${lastTurnTeamName} щойно видали +${lastTurnDelta} за один хід! Зал вибухає!`;
  }

  if (lastTurnDelta !== undefined && lastTurnDelta <= 0 && lastTurnTeamName) {
    return `😬 ${lastTurnTeamName} спіткнулися на цьому ході — для суперників це золотий шанс!`;
  }

  if (leader.totalScore > 0 && gap === 0) {
    return `⚡ Ідеальна нічия (${leader.totalScore}:${runnerUp.totalScore})! Кожне наступне слово вирішує все.`;
  }

  if (leader.totalScore > 0 && gap <= 2) {
    return `🎯 Розрив усього ${gap} ${gap === 1 ? 'бал' : 'бали'}! ${
      nextTeamName ? `${nextTeamName} можуть перевернути таблицю прямо зараз.` : 'Інтрига на максимумі!'
    }`;
  }

  if (gap >= 8 && nextTeamName && nextTeamName !== leader.name) {
    return `🚀 ${leader.name} вирвались на +${gap} — час для легендарного камбеку від ${nextTeamName}!`;
  }

  if (currentRoundInStep >= 2) {
    return `🎬 Коло ${currentRoundInStep}: команди розігрілись, темп зростає!`;
  }

  return `🎙️ ${leader.name} задають темп, але головна битва ще попереду.`;
}

export interface PartyAchievement {
  id: string;
  emoji: string;
  title: string;
  detail: string;
}

export function computePartyAchievements(params: {
  totalGuessedWords: number;
  bestStreakCount: number;
  bestStreakTeamName: string | null;
  bestTurnPoints: number;
  bestTurnTeamName: string | null;
  bonusWordsGuessed: number;
  hardestUnansweredWord: string | null;
  spyRounds: number;
  spyCitizensWins: number;
  spyWins: number;
  isTie: boolean;
  leaderGap: number;
}): PartyAchievement[] {
  const badges: PartyAchievement[] = [];

  if (params.bestTurnPoints >= 8 && params.bestTurnTeamName) {
    badges.push({
      id: 'machine_gun',
      emoji: '⚡',
      title: 'Кулемет вечора',
      detail: `${params.bestTurnTeamName} (+${params.bestTurnPoints} за один хід)`,
    });
  }

  if (params.bestStreakCount >= 5 && params.bestStreakTeamName) {
    badges.push({
      id: 'on_fire',
      emoji: '🔥',
      title: 'Нестримна серія',
      detail: `${params.bestStreakTeamName} (${params.bestStreakCount} слів підряд)`,
    });
  }

  if (params.totalGuessedWords >= 6 && !params.hardestUnansweredWord) {
    badges.push({
      id: 'sniper',
      emoji: '🎯',
      title: 'Снайпери без промахів',
      detail: 'Жодного пропущеного слова за вечір',
    });
  }

  if (params.bonusWordsGuessed >= 3) {
    badges.push({
      id: 'hardcore',
      emoji: '💎',
      title: 'Мисливці за хардкором',
      detail: `${params.bonusWordsGuessed} слів рівня 3★`,
    });
  }

  if (params.spyRounds > 0 && params.spyWins > params.spyCitizensWins) {
    badges.push({
      id: 'bluff_king',
      emoji: '🕵️',
      title: 'Король блефу',
      detail: `Шпигуни переграли стіл (${params.spyWins}:${params.spyCitizensWins})`,
    });
  } else if (params.spyRounds > 0 && params.spyCitizensWins >= params.spyRounds) {
    badges.push({
      id: 'detectives',
      emoji: '🛡️',
      title: 'Ідеальні детективи',
      detail: `Викрито 100% шпигунів (${params.spyCitizensWins}/${params.spyRounds})`,
    });
  }

  if (!params.isTie && params.leaderGap === 1) {
    badges.push({
      id: 'photo_finish',
      emoji: '🏁',
      title: 'Фотофініш',
      detail: 'Перемога з перевагою всього в 1 бал!',
    });
  }

  return badges.slice(0, 4);
}
