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
import {
  MessageSquareMore,
  Drama,
  EyeOff,
  ChevronRight,
  Users,
  Timer,
} from 'lucide-react-native';
import { COLORS, RADIUS, SPACING } from '@/constants/theme';
import { GameType } from '@/types';

type GameCardInfo = {
  id: GameType;
  title: string;
  tagline: string;
  description: string;
  playersLabel: string;
  durationLabel: string;
  accentColor: string;
  emoji: string;
  Icon: React.ComponentType<{ size?: number; color?: string }>;
};

const GAMES: GameCardInfo[] = [
  {
    id: 'alias',
    title: 'Еліас',
    tagline: 'Пояснюй слова на швидкість',
    description:
      'Поясни команді якомога більше слів за раунд без однокореневих підказок. Свайпай вгору або вниз!',
    playersLabel: '4–16 гравців (команди)',
    durationLabel: '30–90 сек / раунд',
    accentColor: COLORS.alias,
    emoji: '⚡',
    Icon: MessageSquareMore,
  },
  {
    id: 'crocodile',
    title: 'Крокодил',
    tagline: 'Тільки жести та міміка',
    description:
      'Покажи кумедну дію чи фразу без жодного слова чи звуку. Перемагає найартистичніша команда!',
    playersLabel: '3–16 гравців',
    durationLabel: '60–120 сек / хід',
    accentColor: COLORS.crocodile,
    emoji: '🐊',
    Icon: Drama,
  },
  {
    id: 'spy',
    title: 'Шпигун',
    tagline: 'Блеф, інтуїція та підозри',
    description:
      'Усі знають секретну локацію, крім шпигуна. Ставте хитрі запитання та викрийте самозванця до кінця таймера!',
    playersLabel: '3–12 гравців',
    durationLabel: '3–7 хв / партія',
    accentColor: COLORS.spy,
    emoji: '🕵️',
    Icon: EyeOff,
  },
];

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
          <Text style={styles.title}>Усі ігри</Text>
          <Text style={styles.subtitle}>
            Запусти окремий режим зі власними правилами, часом раунду та обраною колодою.
          </Text>
        </View>

        <View style={styles.list}>
          {GAMES.map((game) => {
            const IconComponent = game.Icon;
            return (
              <TouchableOpacity
                key={game.id}
                activeOpacity={0.85}
                onPress={() => handleSelectGame(game.id)}
                style={[
                  styles.card,
                  { borderColor: `${game.accentColor}44` },
                ]}
              >
                <View style={styles.cardHeader}>
                  <View
                    style={[
                      styles.iconBox,
                      {
                        backgroundColor: `${game.accentColor}20`,
                        borderColor: `${game.accentColor}55`,
                      },
                    ]}
                  >
                    <IconComponent size={24} color={game.accentColor} />
                  </View>

                  <View style={styles.titleBlock}>
                    <View style={styles.titleRow}>
                      <Text style={styles.cardTitle}>{game.title}</Text>
                      <Text style={styles.cardEmoji}>{game.emoji}</Text>
                    </View>
                    <Text style={[styles.tagline, { color: game.accentColor }]}>
                      {game.tagline}
                    </Text>
                  </View>

                  <View
                    style={[
                      styles.actionCircle,
                      { backgroundColor: game.accentColor },
                    ]}
                  >
                    <ChevronRight size={18} color={COLORS.textPrimary} />
                  </View>
                </View>

                <Text style={styles.description}>{game.description}</Text>

                <View style={styles.metaRow}>
                  <View style={styles.metaBadge}>
                    <Users size={13} color={COLORS.textSecondary} />
                    <Text style={styles.metaText}>{game.playersLabel}</Text>
                  </View>
                  <View style={styles.metaBadge}>
                    <Timer size={13} color={COLORS.textSecondary} />
                    <Text style={styles.metaText}>{game.durationLabel}</Text>
                  </View>
                </View>
              </TouchableOpacity>
            );
          })}
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
    paddingTop: SPACING.lg,
    paddingBottom: SPACING.xxxl,
  },
  header: {
    marginBottom: SPACING.xxl,
  },
  title: {
    color: COLORS.textPrimary,
    fontSize: 30,
    fontWeight: '800',
    letterSpacing: -0.5,
    marginBottom: SPACING.xs,
  },
  subtitle: {
    color: COLORS.textSecondary,
    fontSize: 15,
    lineHeight: 22,
  },
  list: {
    gap: SPACING.lg,
  },
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.xl,
    borderWidth: 1.5,
    padding: SPACING.xl,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.md,
    gap: SPACING.md,
  },
  iconBox: {
    width: 50,
    height: 50,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleBlock: {
    flex: 1,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  cardTitle: {
    color: COLORS.textPrimary,
    fontSize: 22,
    fontWeight: '800',
  },
  cardEmoji: {
    fontSize: 18,
  },
  tagline: {
    fontSize: 13,
    fontWeight: '600',
    marginTop: 2,
  },
  actionCircle: {
    width: 36,
    height: 36,
    borderRadius: RADIUS.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  description: {
    color: COLORS.textSecondary,
    fontSize: 14,
    lineHeight: 20,
    marginBottom: SPACING.lg,
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
  },
  metaBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: COLORS.surfaceElevated,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: RADIUS.full,
  },
  metaText: {
    color: COLORS.textSecondary,
    fontSize: 12,
    fontWeight: '600',
  },
});
