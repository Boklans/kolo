import React, { useState } from 'react';
import { Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { AlertTriangle, LogOut, Pause, Play } from 'lucide-react-native';
import { COLORS, RADIUS, SPACING } from '@/constants/theme';
import { usePartyStore } from '@/stores/usePartyStore';

interface SessionTopBarProps {
  stepBadgeText: string;
  accentColor?: string;
  onPauseChange?: (isPaused: boolean) => void;
}

export function SessionTopBar({
  stepBadgeText,
  accentColor = COLORS.primary,
  onPauseChange,
}: SessionTopBarProps) {
  const router = useRouter();
  const presetTitle = usePartyStore((s) => s.presetTitle);
  const endSession = usePartyStore((s) => s.endSession);

  const [modalVisible, setModalVisible] = useState(false);

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
          <View
            style={[
              styles.stepBadge,
              {
                borderColor: `${accentColor}66`,
                backgroundColor: `${accentColor}1A`,
              },
            ]}
          >
            <Text style={[styles.stepBadgeText, { color: accentColor }]}>
              {stepBadgeText}
            </Text>
          </View>
          {presetTitle ? (
            <Text style={styles.presetTitleText} numberOfLines={1}>
              {presetTitle}
            </Text>
          ) : null}
        </View>

        <TouchableOpacity
          activeOpacity={0.8}
          style={styles.exitBtn}
          onPress={handleOpenPauseModal}
        >
          <Pause size={16} color={COLORS.textSecondary} />
          <Text style={styles.exitBtnText}>Пауза / Вихід</Text>
        </TouchableOpacity>
      </View>

      <Modal
        visible={modalVisible}
        transparent
        animationType="fade"
        onRequestClose={handleResume}
      >
        <View style={styles.backdrop}>
          <View style={styles.modalCard}>
            <View style={styles.iconCircle}>
              <AlertTriangle size={28} color={COLORS.hot} />
            </View>

            <Text style={styles.modalTitle}>Точно перервати вечірку?</Text>
            <Text style={styles.modalSubtitle}>
              Таймер поставлено на паузу. Якщо ви вийдете зараз, поточний прогрес раунду та бали команд буде скинуто.
            </Text>

            <View style={styles.modalActions}>
              <TouchableOpacity
                activeOpacity={0.85}
                style={styles.resumeButton}
                onPress={handleResume}
              >
                <Play size={18} color={COLORS.textPrimary} fill={COLORS.textPrimary} />
                <Text style={styles.resumeButtonText}>Продовжити гру</Text>
              </TouchableOpacity>

              <TouchableOpacity
                activeOpacity={0.85}
                style={styles.confirmExitButton}
                onPress={handleConfirmExit}
              >
                <LogOut size={17} color={COLORS.spy} />
                <Text style={styles.confirmExitText}>Завершити та вийти</Text>
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
    gap: SPACING.sm,
  },
  leftGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    flex: 1,
  },
  stepBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: RADIUS.full,
    borderWidth: 1,
  },
  stepBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  presetTitleText: {
    color: COLORS.textSecondary,
    fontSize: 13,
    fontWeight: '600',
    flexShrink: 1,
  },
  exitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.surfaceElevated,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  exitBtnText: {
    color: COLORS.textSecondary,
    fontSize: 12,
    fontWeight: '700',
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(11, 10, 16, 0.84)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: SPACING.xl,
  },
  modalCard: {
    width: '100%',
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.xl,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    padding: SPACING.xxl,
    alignItems: 'center',
  },
  iconCircle: {
    width: 56,
    height: 56,
    borderRadius: RADIUS.full,
    backgroundColor: `${COLORS.hot}20`,
    borderWidth: 1,
    borderColor: `${COLORS.hot}55`,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.md,
  },
  modalTitle: {
    color: COLORS.textPrimary,
    fontSize: 21,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: SPACING.xs,
  },
  modalSubtitle: {
    color: COLORS.textSecondary,
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    marginBottom: SPACING.xl,
  },
  modalActions: {
    width: '100%',
    gap: SPACING.sm,
  },
  resumeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: COLORS.primary,
    paddingVertical: 15,
    borderRadius: RADIUS.lg,
  },
  resumeButtonText: {
    color: COLORS.textPrimary,
    fontSize: 16,
    fontWeight: '800',
  },
  confirmExitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: `${COLORS.spy}1A`,
    borderWidth: 1,
    borderColor: `${COLORS.spy}55`,
    paddingVertical: 14,
    borderRadius: RADIUS.lg,
  },
  confirmExitText: {
    color: COLORS.spy,
    fontSize: 15,
    fontWeight: '700',
  },
});
