import React, { useMemo } from 'react';
import {
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Award, Calendar, Flame, Trash2, Trophy, X } from 'lucide-react-native';
import { COLORS, RADIUS, SPACING } from '@/constants/theme';
import { getTeamMascot } from '@/constants/mascots';
import { useHistoryStore } from '@/stores/useHistoryStore';
import { triggerHaptic } from '@/utils/sound';

interface HallOfFameModalProps {
  visible: boolean;
  onClose: () => void;
}

function formatDateUk(timestamp: number): string {
  try {
    return new Intl.DateTimeFormat('uk-UA', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(timestamp));
  } catch {
    return '';
  }
}

export function HallOfFameModal({ visible, onClose }: HallOfFameModalProps) {
  const records = useHistoryStore((s) => s.records);
  const removeRecord = useHistoryStore((s) => s.removeRecord);

  const summary = useMemo(() => {
    const totalParties = records.length;
    const totalWords = records.reduce((acc, r) => acc + r.totalGuessedWords, 0);
    const bestStreak = records.reduce(
      (max, r) => Math.max(max, r.bestStreakCount),
      0
    );
    return { totalParties, totalWords, bestStreak };
  }, [records]);

  const handleClose = () => {
    triggerHaptic('light');
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={handleClose}
    >
      <View style={styles.backdrop}>
        <View style={styles.card}>
          {/* Header */}
          <View style={styles.headerRow}>
            <View style={styles.headerLeft}>
              <View style={styles.trophyBadge}>
                <Trophy size={18} color="#FDBA74" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.overline}>ЗАЛ СЛАВИ КОМПАНІЇ</Text>
                <Text style={styles.title}>Літопис вечірок</Text>
              </View>
            </View>

            <TouchableOpacity
              activeOpacity={0.75}
              onPress={handleClose}
              style={styles.closeBtn}
              accessibilityRole="button"
              accessibilityLabel="Закрити літопис"
            >
              <X size={18} color={COLORS.textPrimary} />
            </TouchableOpacity>
          </View>

          {/* All-time summary metrics */}
          {records.length > 0 ? (
            <View style={styles.summaryRow}>
              <View style={styles.metricCard}>
                <Text style={styles.metricValue}>{summary.totalParties}</Text>
                <Text style={styles.metricLabel}>Вечірок</Text>
              </View>
              <View style={styles.metricCard}>
                <Text style={[styles.metricValue, { color: '#6EE7B7' }]}>
                  {summary.totalWords}
                </Text>
                <Text style={styles.metricLabel}>Слів усього</Text>
              </View>
              <View style={styles.metricCard}>
                <Text style={[styles.metricValue, { color: '#FDBA74' }]}>
                  {summary.bestStreak}
                </Text>
                <Text style={styles.metricLabel}>Топ-серія</Text>
              </View>
            </View>
          ) : null}

          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.listContent}
          >
            {records.length === 0 ? (
              <View style={styles.emptyBox}>
                <Award size={36} color={COLORS.textMuted} />
                <Text style={styles.emptyTitle}>Історія ще порожня</Text>
                <Text style={styles.emptySub}>
                  Зіграйте першу вечірку до фіналу — чемпіони, рекорди та
                  найскладніші слова збережуться тут автоматично.
                </Text>
              </View>
            ) : (
              records.map((rec) => {
                const isSpyOnly =
                  rec.teams.length === 0 &&
                  rec.spyRoundsPlayed > 0 &&
                  rec.totalGuessedWords === 0;
                const mascot = getTeamMascot(
                  rec.winnerMascotId,
                  rec.winnerName,
                  0
                );

                return (
                  <View key={rec.id} style={styles.recordCard}>
                    <View style={styles.recordTop}>
                      <View style={styles.recordLeft}>
                        <View
                          style={[
                            styles.recordMascot,
                            {
                              backgroundColor: isSpyOnly
                                ? 'rgba(244, 63, 94, 0.16)'
                                : mascot.bgTint,
                            },
                          ]}
                        >
                          <Text style={styles.recordMascotEmoji}>
                            {isSpyOnly ? '🕵️' : mascot.emoji}
                          </Text>
                        </View>
                        <View style={{ flex: 1 }}>
                          <View style={styles.recordMetaRow}>
                            <Text style={styles.recordPreset} numberOfLines={1}>
                              {rec.presetTitle}
                            </Text>
                            <Calendar size={10} color={COLORS.textMuted} />
                            <Text style={styles.recordDate}>
                              {formatDateUk(rec.playedAt)}
                            </Text>
                          </View>
                          <Text style={styles.recordWinner} numberOfLines={1}>
                            {rec.isTie
                              ? `Нічия: ${rec.winnerName}`
                              : rec.winnerName}
                          </Text>
                        </View>
                      </View>

                      <View style={styles.recordRight}>
                        {isSpyOnly ? (
                          <Text style={[styles.recordScore, { color: '#FDA4AF' }]}>
                            {rec.spyCitizensWins}/{rec.spyRoundsPlayed}
                          </Text>
                        ) : rec.winnerScore > 0 ? (
                          <Text style={[styles.recordScore, { color: '#FDBA74' }]}>
                            {rec.winnerScore}
                          </Text>
                        ) : null}

                        <TouchableOpacity
                          activeOpacity={0.7}
                          onPress={() => {
                            triggerHaptic('light');
                            removeRecord(rec.id);
                          }}
                          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                          accessibilityRole="button"
                          accessibilityLabel="Видалити запис"
                        >
                          <Trash2 size={14} color={COLORS.textMuted} />
                        </TouchableOpacity>
                      </View>
                    </View>

                    {/* Secondary stats line */}
                    <View style={styles.recordStatsRow}>
                      {isSpyOnly ? (
                        <Text style={styles.recordStatText}>
                          Шпигун: мирні викрили {rec.spyCitizensWins} з{' '}
                          {rec.spyRoundsPlayed}
                        </Text>
                      ) : (
                        <Text style={styles.recordStatText}>
                          Відгадано: {rec.totalGuessedWords}
                        </Text>
                      )}
                      {rec.bestStreakCount >= 2 ? (
                        <View style={styles.streakInline}>
                          <Flame size={11} color="#FDBA74" />
                          <Text style={[styles.recordStatText, { color: '#FDBA74' }]}>
                            Серія {rec.bestStreakCount}
                          </Text>
                        </View>
                      ) : null}
                      {!isSpyOnly && rec.hardestUnansweredWord ? (
                        <Text style={styles.recordStatText} numberOfLines={1}>
                          Зламало: «{rec.hardestUnansweredWord}»
                        </Text>
                      ) : null}
                    </View>

                    {rec.achievements.length > 0 ? (
                      <View style={styles.achievementsRow}>
                        <Text style={styles.achievementsText}>
                          {rec.achievements.join(' · ')}
                        </Text>
                      </View>
                    ) : null}
                  </View>
                );
              })
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(5, 5, 10, 0.88)',
    justifyContent: 'center',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.xxl,
  },
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.xl + 4,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    maxHeight: '88%',
    overflow: 'hidden',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.lg,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  trophyBadge: {
    width: 40,
    height: 40,
    borderRadius: 13,
    backgroundColor: 'rgba(249, 115, 22, 0.16)',
    borderWidth: 1,
    borderColor: 'rgba(249, 115, 22, 0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  overline: {
    color: '#FDBA74',
    fontSize: 10.5,
    fontWeight: '800',
    letterSpacing: 1.4,
  },
  title: {
    color: COLORS.textPrimary,
    fontSize: 19,
    fontWeight: '900',
    letterSpacing: -0.4,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: RADIUS.md,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  summaryRow: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: SPACING.xl,
    paddingTop: SPACING.md,
  },
  metricCard: {
    flex: 1,
    backgroundColor: COLORS.surfaceSubtle,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    paddingVertical: 10,
    paddingHorizontal: 8,
    alignItems: 'center',
  },
  metricValue: {
    color: COLORS.textPrimary,
    fontSize: 20,
    fontWeight: '900',
    fontVariant: ['tabular-nums'],
  },
  metricLabel: {
    color: COLORS.textSecondary,
    fontSize: 11,
    fontWeight: '600',
    marginTop: 2,
  },
  listContent: {
    padding: SPACING.xl,
    gap: 10,
  },
  emptyBox: {
    alignItems: 'center',
    paddingVertical: 32,
    gap: 10,
  },
  emptyTitle: {
    color: COLORS.textPrimary,
    fontSize: 17,
    fontWeight: '800',
  },
  emptySub: {
    color: COLORS.textSecondary,
    fontSize: 13.5,
    textAlign: 'center',
    lineHeight: 20,
    maxWidth: 290,
  },
  recordCard: {
    backgroundColor: COLORS.surfaceSubtle,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.lg + 2,
    padding: SPACING.md,
    gap: 8,
  },
  recordTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 8,
  },
  recordLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  recordMascot: {
    width: 38,
    height: 38,
    borderRadius: 11,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  recordMascotEmoji: {
    fontSize: 18,
  },
  recordMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  recordPreset: {
    color: COLORS.textSecondary,
    fontSize: 11,
    fontWeight: '600',
    maxWidth: 115,
  },
  recordDate: {
    color: COLORS.textMuted,
    fontSize: 11,
    fontWeight: '600',
  },
  recordWinner: {
    color: COLORS.textPrimary,
    fontSize: 15.5,
    fontWeight: '800',
    marginTop: 2,
  },
  recordRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  recordScore: {
    fontSize: 17,
    fontWeight: '900',
    fontVariant: ['tabular-nums'],
  },
  recordStatsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 10,
  },
  recordStatText: {
    color: COLORS.textSecondary,
    fontSize: 12,
    fontWeight: '600',
  },
  streakInline: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  achievementsRow: {
    paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255, 255, 255, 0.08)',
  },
  achievementsText: {
    color: '#C4B5FD',
    fontSize: 11.5,
    fontWeight: '700',
  },
});
