import React, { useState } from 'react';
import { Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { Pause, Volume2, VolumeX } from 'lucide-react-native';
import { COLORS, RADIUS, SPACING } from '@/constants/theme';
import { usePartyStore } from '@/stores/usePartyStore';
import { useSoundStore } from '@/utils/sound';

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
  const toggleSound = useSoundStore((s) => s.toggleSound);

  const [modalVisible, setModalVisible] = useState(false);

  const handleToggleSound = () => {
    Haptics.selectionAsync();
    toggleSound();
  };

  const handleOpenPauseModal = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setModalVisible(true);
    onPauseChange?.(true);
  };

  const handleResume = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setModalVisible(false);
    onPauseChange?.(false);
  };

  const handleSkipStepToScoreboard = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setModalVisible(false);
    onPauseChange?.(false);
    advanceToNextStep();
    router.replace('/session/scoreboard');
  };

  const handleConfirmExit = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
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
              Таймер зупинено. Ви можете продовжити поточний раунд або вийти на головний екран.
            </Text>

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
    marginBottom: SPACING.xxl,
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
