import React, { useState } from 'react';
import { Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Pause, Smartphone, Volume2, VolumeX } from 'lucide-react-native';
import { COLORS, RADIUS, SPACING } from '@/constants/theme';
import { usePartyStore } from '@/stores/usePartyStore';
import { triggerHaptic, useSoundStore } from '@/utils/sound';

interface SessionTopBarProps {
  stepBadgeText: string;
  rightMetaText?: string;
  accentColor?: string;
  onPauseChange?: (isPaused: boolean) => void;
}

export function SessionTopBar({
  stepBadgeText,
  rightMetaText,
  accentColor = COLORS.primary,
  onPauseChange,
}: SessionTopBarProps) {
  const router = useRouter();
  const endSession = usePartyStore((s) => s.endSession);
  const advanceToNextStep = usePartyStore((s) => s.advanceToNextStep);
  const steps = usePartyStore((s) => s.steps);
  const isSoundEnabled = useSoundStore((s) => s.isSoundEnabled);
  const isHapticsEnabled = useSoundStore((s) => s.isHapticsEnabled);
  const toggleSound = useSoundStore((s) => s.toggleSound);
  const toggleHaptics = useSoundStore((s) => s.toggleHaptics);

  const [modalVisible, setModalVisible] = useState(false);

  const handleToggleSound = () => {
    triggerHaptic('selection');
    toggleSound();
  };

  const handleToggleHaptics = () => {
    toggleHaptics();
    // Give feedback when turning haptics ON
    if (!isHapticsEnabled) {
      triggerHaptic('selection');
    }
  };

  const handleOpenPauseModal = () => {
    triggerHaptic('light');
    setModalVisible(true);
    onPauseChange?.(true);
  };

  const handleResume = () => {
    triggerHaptic('light');
    setModalVisible(false);
    onPauseChange?.(false);
  };

  const handleSkipStepToScoreboard = () => {
    triggerHaptic('medium');
    setModalVisible(false);
    onPauseChange?.(false);
    advanceToNextStep();
    router.replace('/session/scoreboard');
  };

  const handleConfirmExit = () => {
    triggerHaptic('warning');
    setModalVisible(false);
    onPauseChange?.(false);
    endSession();
    router.replace('/');
  };

  return (
    <>
      <View style={styles.topBar}>
        <View style={styles.leftGroup}>
          <View style={[styles.accentDot, { backgroundColor: accentColor }]} />
          <Text style={styles.stepLabel} numberOfLines={1}>
            {stepBadgeText}
          </Text>
        </View>

        <View style={styles.rightGroup}>
          {rightMetaText ? (
            <Text style={styles.rightMeta}>{rightMetaText}</Text>
          ) : null}

          <TouchableOpacity
            activeOpacity={0.7}
            style={styles.iconBtn}
            onPress={handleToggleSound}
            hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}
            accessibilityRole="button"
            accessibilityLabel={isSoundEnabled ? 'Вимкнути звук' : 'Увімкнути звук'}
          >
            {isSoundEnabled ? (
              <Volume2 size={16} color={COLORS.textSecondary} />
            ) : (
              <VolumeX size={16} color={COLORS.textMuted} />
            )}
          </TouchableOpacity>

          <TouchableOpacity
            activeOpacity={0.7}
            style={styles.iconBtn}
            onPress={handleOpenPauseModal}
            hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}
            accessibilityRole="button"
            accessibilityLabel="Пауза"
          >
            <Pause size={15} color={COLORS.textSecondary} />
          </TouchableOpacity>
        </View>
      </View>

      <Modal
        visible={modalVisible}
        transparent
        animationType="fade"
        onRequestClose={handleResume}
      >
        <View style={styles.backdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalOverline}>ПАУЗА</Text>
            <Text style={styles.modalTitle}>Перервати вечірку?</Text>
            <Text style={styles.modalSubtitle}>
              Таймер зупинено. Можете змінити налаштування або вийти на головну.
            </Text>

            <View style={styles.togglesRow}>
              <TouchableOpacity
                activeOpacity={0.8}
                style={[styles.togglePill, isSoundEnabled && styles.togglePillActive]}
                onPress={handleToggleSound}
                accessibilityRole="switch"
                accessibilityState={{ checked: isSoundEnabled }}
                accessibilityLabel="Звук"
              >
                {isSoundEnabled ? (
                  <Volume2 size={15} color={COLORS.textPrimary} />
                ) : (
                  <VolumeX size={15} color={COLORS.textMuted} />
                )}
                <Text
                  style={[
                    styles.togglePillText,
                    isSoundEnabled && styles.togglePillTextActive,
                  ]}
                >
                  Звук: {isSoundEnabled ? 'УВІМК' : 'ВИМК'}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                activeOpacity={0.8}
                style={[styles.togglePill, isHapticsEnabled && styles.togglePillActive]}
                onPress={handleToggleHaptics}
                accessibilityRole="switch"
                accessibilityState={{ checked: isHapticsEnabled }}
                accessibilityLabel="Вібрація"
              >
                <Smartphone
                  size={15}
                  color={isHapticsEnabled ? COLORS.textPrimary : COLORS.textMuted}
                />
                <Text
                  style={[
                    styles.togglePillText,
                    isHapticsEnabled && styles.togglePillTextActive,
                  ]}
                >
                  Вібро: {isHapticsEnabled ? 'УВІМК' : 'ВИМК'}
                </Text>
              </TouchableOpacity>
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity
                activeOpacity={0.85}
                style={styles.resumeButton}
                onPress={handleResume}
              >
                <Text style={styles.resumeButtonText}>Продовжити гру</Text>
              </TouchableOpacity>

              {steps.length > 0 ? (
                <TouchableOpacity
                  activeOpacity={0.85}
                  style={[
                    styles.confirmExitButton,
                    { backgroundColor: COLORS.surfaceElevated },
                  ]}
                  onPress={handleSkipStepToScoreboard}
                >
                  <Text
                    style={[
                      styles.confirmExitText,
                      { color: COLORS.textPrimary },
                    ]}
                  >
                    До таблиці рахунку / Наступний етап →
                  </Text>
                </TouchableOpacity>
              ) : null}

              <TouchableOpacity
                activeOpacity={0.8}
                style={styles.confirmExitButton}
                onPress={handleConfirmExit}
              >
                <Text style={styles.confirmExitText}>Завершити вечірку</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.md,
  },
  leftGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  accentDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  stepLabel: {
    color: COLORS.textSecondary,
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  rightGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  rightMeta: {
    color: COLORS.textMuted,
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.6,
    marginRight: 4,
  },
  iconBtn: {
    width: 32,
    height: 32,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(16, 16, 20, 0.97)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: SPACING.xl,
  },
  modalCard: {
    width: '100%',
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.xl,
    padding: SPACING.xxl,
  },
  modalOverline: {
    color: COLORS.textMuted,
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 1.4,
    marginBottom: 6,
  },
  modalTitle: {
    color: COLORS.textPrimary,
    fontSize: 24,
    fontWeight: '700',
    letterSpacing: -0.5,
    marginBottom: SPACING.xs,
  },
  modalSubtitle: {
    color: COLORS.textSecondary,
    fontSize: 15,
    lineHeight: 22,
    marginBottom: SPACING.lg,
  },
  togglesRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginBottom: SPACING.lg,
  },
  togglePill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: COLORS.surfaceSubtle,
    paddingVertical: 11,
    paddingHorizontal: 10,
    borderRadius: RADIUS.md,
  },
  togglePillActive: {
    backgroundColor: COLORS.surfaceElevated,
  },
  togglePillText: {
    color: COLORS.textMuted,
    fontSize: 12,
    fontWeight: '700',
  },
  togglePillTextActive: {
    color: COLORS.textPrimary,
  },
  modalActions: {
    gap: SPACING.sm,
  },
  resumeButton: {
    backgroundColor: COLORS.textPrimary,
    paddingVertical: 16,
    borderRadius: RADIUS.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  resumeButtonText: {
    color: COLORS.background,
    fontSize: 16,
    fontWeight: '700',
  },
  confirmExitButton: {
    backgroundColor: COLORS.surfaceElevated,
    paddingVertical: 15,
    borderRadius: RADIUS.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmExitText: {
    color: COLORS.spy,
    fontSize: 15,
    fontWeight: '600',
  },
});
