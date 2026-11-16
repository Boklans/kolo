import React from 'react';
import Svg, {
  Circle,
  G,
  Line,
  Path,
  Polygon,
  Rect,
} from 'react-native-svg';
import { COLORS } from '@/constants/theme';
import { GameType } from '@/types';

/**
 * 1. Авторські векторні ілюстрації для 4 Афіш Вайбів (Vibes Screen)
 */
export function VibePosterArtwork({
  presetId,
  size = 136,
}: {
  presetId: string;
  size?: number;
}) {
  if (presetId === 'warmup') {
    // Вінілова платівка вечірки + звукові хвилі та блискавка
    return (
      <Svg width={size} height={size} viewBox="0 0 140 140" fill="none">
        <Circle
          cx="82"
          cy="68"
          r="52"
          fill="rgba(249, 115, 22, 0.12)"
          stroke="rgba(249, 115, 22, 0.35)"
          strokeWidth="2"
        />
        <Circle
          cx="82"
          cy="68"
          r="36"
          stroke="rgba(249, 115, 22, 0.5)"
          strokeWidth="2"
          strokeDasharray="6 6"
        />
        <Circle cx="82" cy="68" r="18" fill={COLORS.hot} />
        <Circle cx="82" cy="68" r="6" fill="#221713" />
        {/* Блискавка драйву */}
        <Polygon
          points="36,24 18,62 34,62 24,98 56,52 38,52"
          fill="#FDBA74"
        />
      </Svg>
    );
  }

  if (presetId === 'uncensored_18' || presetId === 'uncensored') {
    // Неонове полум'я + ріжки 18+ та діагональна стрічка
    return (
      <Svg width={size} height={size} viewBox="0 0 120 120" fill="none">
        <Circle cx="76" cy="72" r="38" fill="rgba(244, 63, 94, 0.14)" />
        {/* Лівий та правий ріжки */}
        <Path
          d="M46 58 C38 38, 44 22, 60 30 C52 40, 54 50, 58 58 Z"
          fill={COLORS.spy}
        />
        <Path
          d="M98 58 C106 38, 100 22, 84 30 C92 40, 90 50, 86 58 Z"
          fill={COLORS.spy}
        />
        {/* Язик полум'я в центрі */}
        <Path
          d="M72 28 C88 48, 96 66, 84 86 C76 98, 60 96, 56 82 C52 68, 64 58, 64 46 C64 46, 54 60, 58 74 C46 62, 54 40, 72 28 Z"
          fill="#FB7185"
        />
      </Svg>
    );
  }

  if (presetId === 'strangers') {
    // Два келихи / діалогові бульбашки та іскра знайомства
    return (
      <Svg width={size} height={size} viewBox="0 0 120 120" fill="none">
        <Rect
          x="26"
          y="36"
          width="46"
          height="34"
          rx="12"
          fill="rgba(16, 185, 129, 0.22)"
          stroke={COLORS.crocodile}
          strokeWidth="2"
        />
        <Rect
          x="52"
          y="54"
          width="46"
          height="34"
          rx="12"
          fill="rgba(16, 185, 129, 0.35)"
          stroke="#6EE7B7"
          strokeWidth="2"
        />
        {/* Іскра зверху */}
        <Path
          d="M84 18 L87 27 L96 30 L87 33 L84 42 L81 33 L72 30 L81 27 Z"
          fill="#6EE7B7"
        />
      </Svg>
    );
  }

  // team_battle: Турнірний кубок + схрещені блискавки
  return (
    <Svg width={size} height={size} viewBox="0 0 140 140" fill="none">
      <Circle cx="82" cy="70" r="46" fill="rgba(59, 130, 246, 0.14)" />
      {/* Чаша кубка */}
      <Path
        d="M56 38 H108 V62 C108 78, 96 90, 82 90 C68 90, 56 78, 56 62 Z"
        fill="rgba(59, 130, 246, 0.32)"
        stroke={COLORS.alias}
        strokeWidth="2.5"
      />
      {/* Ручки кубка */}
      <Path
        d="M56 44 H46 C42 44, 40 50, 44 58 C47 64, 52 66, 56 66"
        stroke={COLORS.alias}
        strokeWidth="2.5"
        strokeLinecap="round"
      />
      <Path
        d="M108 44 H118 C122 44, 124 50, 120 58 C117 64, 112 66, 108 66"
        stroke={COLORS.alias}
        strokeWidth="2.5"
        strokeLinecap="round"
      />
      {/* Ніжка та база кубка */}
      <Line
        x1="82"
        y1="90"
        x2="82"
        y2="108"
        stroke={COLORS.alias}
        strokeWidth="3"
      />
      <Rect x="64" y="108" width="36" height="8" rx="4" fill={COLORS.alias} />
      {/* Зірка переможця */}
      <Polygon
        points="82,48 86,57 96,58 88,64 90,74 82,69 74,74 76,64 68,58 78,57"
        fill="#93C5FD"
      />
    </Svg>
  );
}

/**
 * 2. Авторські векторні ілюстрації для 3 Ігрових Світів (Games Screen)
 */
export function GameWorldArtwork({
  gameId,
  size = 108,
}: {
  gameId: GameType;
  size?: number;
}) {
  if (gameId === 'alias') {
    // Еліас: Картки в польоті + стрілки швидкості
    return (
      <Svg width={size} height={size} viewBox="0 0 110 110" fill="none">
        <G transform="rotate(10 62 56)">
          <Rect
            x="34"
            y="22"
            width="54"
            height="68"
            rx="10"
            fill="rgba(59, 130, 246, 0.18)"
            stroke="rgba(59, 130, 246, 0.45)"
            strokeWidth="1.5"
          />
        </G>
        <G transform="rotate(-7 52 54)">
          <Rect
            x="22"
            y="18"
            width="56"
            height="70"
            rx="10"
            fill="#1D2B48"
            stroke={COLORS.alias}
            strokeWidth="2.2"
          />
          {/* Стрілка свайпу вгору */}
          <Path
            d="M50 34 L50 62 M40 44 L50 34 L60 44"
            stroke="#60A5FA"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <Line
            x1="34"
            y1="72"
            x2="66"
            y2="72"
            stroke={COLORS.alias}
            strokeWidth="3"
            strokeLinecap="round"
          />
        </G>
      </Svg>
    );
  }

  if (gameId === 'crocodile') {
    // Крокодил: Театральна сцена руху, прожектор та динамічні хвилі жестів
    return (
      <Svg width={size} height={size} viewBox="0 0 110 110" fill="none">
        {/* Промінь сценічного прожектора */}
        <Polygon
          points="56,12 16,96 96,96"
          fill="rgba(16, 185, 129, 0.15)"
        />
        {/* Силует фігури в русі */}
        <Circle cx="56" cy="36" r="10" fill={COLORS.crocodile} />
        <Path
          d="M32 54 C44 46, 68 46, 82 38"
          stroke="#6EE7B7"
          strokeWidth="4"
          strokeLinecap="round"
        />
        <Path
          d="M56 46 L52 72 L38 92 M52 72 L70 90"
          stroke={COLORS.crocodile}
          strokeWidth="4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </Svg>
    );
  }

  // Шпигун: Радар секретності, приціл та силует інкогніто
  return (
    <Svg width={size} height={size} viewBox="0 0 110 110" fill="none">
      <Circle
        cx="56"
        cy="56"
        r="40"
        fill="rgba(244, 63, 94, 0.10)"
        stroke="rgba(244, 63, 94, 0.35)"
        strokeWidth="1.5"
        strokeDasharray="5 5"
      />
      <Circle
        cx="56"
        cy="56"
        r="26"
        fill="rgba(244, 63, 94, 0.18)"
        stroke={COLORS.spy}
        strokeWidth="2"
      />
      {/* Перехрестя прицілу */}
      <Line x1="56" y1="8" x2="56" y2="24" stroke={COLORS.spy} strokeWidth="2" />
      <Line x1="56" y1="88" x2="56" y2="104" stroke={COLORS.spy} strokeWidth="2" />
      <Line x1="8" y1="56" x2="24" y2="56" stroke={COLORS.spy} strokeWidth="2" />
      <Line x1="88" y1="56" x2="104" y2="56" stroke={COLORS.spy} strokeWidth="2" />
      {/* Окуляри таємного агента в центрі */}
      <Rect x="40" y="50" width="13" height="10" rx="3" fill="#FDA4AF" />
      <Rect x="59" y="50" width="13" height="10" rx="3" fill="#FDA4AF" />
      <Line x1="53" y1="54" x2="59" y2="54" stroke="#FDA4AF" strokeWidth="2.5" />
    </Svg>
  );
}

/**
 * 3. Авторська векторна графіка для обкладинок Колод (Decks Box-Art Covers)
 */
export function DeckCoverArtwork({
  deckId,
  accentColor,
  size = 92,
}: {
  deckId: string;
  accentColor: string;
  size?: number;
}) {
  if (deckId === 'warmup_ua') {
    // Келих вечірки + іскри
    return (
      <Svg width={size} height={size} viewBox="0 0 100 100" fill="none">
        <Circle cx="56" cy="54" r="36" fill={`${accentColor}1F`} />
        <Polygon
          points="32,30 80,30 56,58"
          fill={`${accentColor}44`}
          stroke={accentColor}
          strokeWidth="2.2"
        />
        <Line x1="56" y1="58" x2="56" y2="82" stroke={accentColor} strokeWidth="2.5" />
        <Line x1="42" y1="82" x2="70" y2="82" stroke={accentColor} strokeWidth="2.5" strokeLinecap="round" />
        <Circle cx="62" cy="24" r="4" fill="#FDBA74" />
      </Svg>
    );
  }

  if (deckId === 'memes_ua') {
    // Піксельні окуляри "Deal With It" + блискавка
    return (
      <Svg width={size} height={size} viewBox="0 0 100 100" fill="none">
        <Circle cx="54" cy="54" r="36" fill={`${accentColor}1F`} />
        <Rect x="20" y="42" width="28" height="16" rx="2" fill={accentColor} />
        <Rect x="54" y="42" width="28" height="16" rx="2" fill={accentColor} />
        <Rect x="14" y="42" width="74" height="5" fill="#A7F3D0" />
        <Rect x="26" y="47" width="6" height="6" fill="#FFFFFF" />
        <Rect x="60" y="47" width="6" height="6" fill="#FFFFFF" />
      </Svg>
    );
  }

  if (deckId === 'it_office_ua') {
    // Ноутбук з тегом <CODE/>
    return (
      <Svg width={size} height={size} viewBox="0 0 100 100" fill="none">
        <Circle cx="54" cy="54" r="36" fill={`${accentColor}1F`} />
        <Rect
          x="26"
          y="30"
          width="52"
          height="36"
          rx="5"
          fill="#152238"
          stroke={accentColor}
          strokeWidth="2.2"
        />
        <Path
          d="M18 68 H86 L80 74 H24 Z"
          fill={accentColor}
        />
        {/* Символ < / > */}
        <Path
          d="M42 43 L35 48 L42 53 M62 43 L69 48 L62 53 M55 41 L49 55"
          stroke="#93C5FD"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </Svg>
    );
  }

  if (deckId === 'adult_18_ua') {
    // Неонове серце / замкова щілина 18+
    return (
      <Svg width={size} height={size} viewBox="0 0 100 100" fill="none">
        <Circle cx="54" cy="54" r="36" fill={`${accentColor}22`} />
        <Path
          d="M52 76 C52 76, 26 58, 26 40 C26 30, 34 24, 42 24 C47 24, 52 28, 52 33 C52 28, 57 24, 62 24 C70 24, 78 30, 78 40 C78 58, 52 76, 52 76 Z"
          fill={`${accentColor}44`}
          stroke={accentColor}
          strokeWidth="2.2"
        />
        <Circle cx="52" cy="45" r="5" fill="#FFE4E6" />
        <Polygon points="52,48 47,60 57,60" fill="#FFE4E6" />
      </Svg>
    );
  }

  // Класична колода або Кастомна колода: геометрія KOLO (три перехрещені картки + зірка)
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100" fill="none">
      <Circle cx="54" cy="54" r="36" fill={`${accentColor}1F`} />
      <G transform="rotate(-12 46 52)">
        <Rect
          x="28"
          y="26"
          width="36"
          height="48"
          rx="6"
          fill={`${accentColor}33`}
          stroke={accentColor}
          strokeWidth="1.8"
        />
      </G>
      <G transform="rotate(8 58 52)">
        <Rect
          x="38"
          y="26"
          width="36"
          height="48"
          rx="6"
          fill="#221F30"
          stroke={accentColor}
          strokeWidth="2.2"
        />
        <Path
          d="M56 38 L59 46 L67 49 L59 52 L56 60 L53 52 L45 49 L53 46 Z"
          fill={accentColor}
        />
      </G>
    </Svg>
  );
}
