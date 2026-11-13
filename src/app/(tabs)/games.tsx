import React from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { ArrowRight } from 'lucide-react-native';
import { COLORS, RADIUS, SPACING } from '@/constants/theme';
import { GameType } from '@/types';

type GameEntry = {
  id: GameType;
  number: string;
  label: string;
  title: string;
  explanation: string;
  players: string;
  duration: string;
  accentColor: string;
};

const GAMES: GameEntry[] = [
  {
    id: 'alias',
    number: '01',
    label: 'ШВИДКІСТЬ ТА СЛОВА',
    title: 'Еліас',
    explanation: 'Поясни команді якомога більше слів за раунд без однокореневих підказок.',
    players: '4–16 гравців',
    duration: '30–90 сек',
    accentColor: COLORS.alias,
  },
  {
    id: 'crocodile',
    number: '02',
    label: 'РУХ ТА МІМІКА',
    title: 'Крокодил',
    explanation: 'Покажи дію чи кумедну сцену тілом без жодного слова або звуку.',
    players: '3–16 гравців',
    duration: '60–120 сек',
    accentColor: COLORS.crocodile,
  },
  {
    id: 'spy',
    number: '03',
    label: 'БЛЕФ ТА ДЕДУКЦІЯ',
    title: 'Шпигун',
    explanation: 'Усі знають секретну локацію, крім шпигуна. Викрийте самозванця за питаннями.',
    players: '3–12 гравців',
    duration: '3–7 хв',
    accentColor: COLORS.spy,
  },
];

function GeometricMotif({ gameId, color }: { gameId: GameType; color: string }) {
  if (gameId === 'alias') {
    // Кінетичні смуги швидкості
    return (
      <View style={styles.motifBox}>
        <View style={[styles.speedBar, { width: 44, backgroundColor: color }]} />
        <View style={[styles.speedBar, { width: 28, backgroundColor: color, opacity: 0.55 }]} />
        <View style={[styles.speedBar, { width: 16, backgroundColor: color, opacity: 0.25 }]} />
      </View>
    );
  }

  if (gameId === 'crocodile') {
    // Ступінчасті блоки руху / сцени
    return (
      <View style={styles.motifStepsRow}>
        <View style={[styles.stepBlock, { height: 14, backgroundColor: color, opacity: 0.3 }]} />
        <View style={[styles.stepBlock, { height: 24, backgroundColor: color, opacity: 0.6 }]} />
        <View style={[styles.stepBlock, { height: 34, backgroundColor: color }]} />
      </View>
    );
  }

  // Шпигун: приціл / радар секретності
  return (
    <View style={[styles.radarOuter, { borderColor: `${color}55` }]}>
      <View style={[styles.radarInner, { borderColor: color }]}>
        <View style={[styles.radarCore, { backgroundColor: color }]} />
      </View>
    </View>
  );
}

export default function GamesScreen() {
  const router = useRouter();

  const handleSelectGame = (gameType: GameType) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push(`/setup/game?id=${gameType}`);
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Text style={styles.overline}>ОКРЕМІ РЕЖИМИ</Text>
          <Text style={styles.headline}>Ігри</Text>
        </View>

        <View style={styles.list}>
          {GAMES.map((game) => (
            <TouchableOpacity
              key={game.id}
              activeOpacity={0.88}
              onPress={() => handleSelectGame(game.id)}
              style={styles.gameBlock}
            >
              {/* Top Row: Large Editorial Number + Geometric Identity Motif */}
              <View style={styles.topRow}>
                <View style={styles.numberGroup}>
                  <Text style={[styles.indexNumber, { color: game.accentColor }]}>
                    {game.number}
                  </Text>
                  <Text style={styles.categoryLabel}>{game.label}</Text>
                </View>

                <GeometricMotif gameId={game.id} color={game.accentColor} />
              </View>

              {/* Title & Explanation */}
              <Text style={styles.gameTitle}>{game.title}</Text>
              <Text style={styles.gameExplanation}>{game.explanation}</Text>

              {/* Bottom Row: Players · Duration + Start Action */}
              <View style={styles.bottomRow}>
                <Text style={styles.metaText}>
                  {game.players}  ·  {game.duration}
                </Text>

                <View style={styles.startAction}>
                  <Text style={[styles.startActionText, { color: game.accentColor }]}>
                    Грати
                  </Text>
                  <ArrowRight size={16} color={game.accentColor} />
                </View>
              </View>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  container: {
    flex: 1,
  },
  content: {
    paddingHorizontal: SPACING.xl,
    paddingTop: SPACING.md,
    paddingBottom: SPACING.xxxl,
  },
  header: {
    marginBottom: SPACING.lg,
    gap: 2,
  },
  overline: {
    color: COLORS.textMuted,
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 1.8,
  },
  headline: {
    color: COLORS.textPrimary,
    fontSize: 28,
    fontWeight: '700',
    letterSpacing: -0.7,
  },
  list: {
    gap: SPACING.md,
  },
  gameBlock: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.xl,
    padding: SPACING.xl,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: SPACING.sm,
  },
  numberGroup: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 10,
  },
  indexNumber: {
    fontSize: 22,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
    letterSpacing: -0.5,
  },
  categoryLabel: {
    color: COLORS.textMuted,
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 1.2,
  },
  gameTitle: {
    color: COLORS.textPrimary,
    fontSize: 26,
    fontWeight: '700',
    letterSpacing: -0.6,
    marginBottom: 6,
  },
  gameExplanation: {
    color: COLORS.textSecondary,
    fontSize: 15,
    fontWeight: '400',
    lineHeight: 21,
    marginBottom: SPACING.lg,
  },
  bottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: SPACING.md,
    borderTopWidth: 1,
    borderTopColor: '#23222E',
  },
  metaText: {
    color: COLORS.textMuted,
    fontSize: 13,
    fontWeight: '500',
  },
  startAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  startActionText: {
    fontSize: 14,
    fontWeight: '700',
  },

  // Geometric Motifs
  motifBox: {
    alignItems: 'flex-end',
    gap: 4,
  },
  speedBar: {
    height: 4,
    borderRadius: 2,
  },
  motifStepsRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 4,
  },
  stepBlock: {
    width: 7,
    borderRadius: 2,
  },
  radarOuter: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radarInner: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radarCore: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
});
