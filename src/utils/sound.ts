import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';

interface SoundState {
  isSoundEnabled: boolean;
  isHapticsEnabled: boolean;
  toggleSound: () => void;
  toggleHaptics: () => void;
}

export const useSoundStore = create<SoundState>()(
  persist(
    (set) => ({
      isSoundEnabled: true,
      isHapticsEnabled: true,
      toggleSound: () =>
        set((state) => ({ isSoundEnabled: !state.isSoundEnabled })),
      toggleHaptics: () =>
        set((state) => ({ isHapticsEnabled: !state.isHapticsEnabled })),
    }),
    {
      name: 'kolo-sound-settings-v1',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);

export type HapticKind =
  | 'light'
  | 'medium'
  | 'heavy'
  | 'selection'
  | 'success'
  | 'warning'
  | 'error';

export function triggerHaptic(kind: HapticKind) {
  if (!useSoundStore.getState().isHapticsEnabled) return;
  try {
    switch (kind) {
      case 'light':
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        break;
      case 'medium':
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        break;
      case 'heavy':
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
        break;
      case 'selection':
        Haptics.selectionAsync();
        break;
      case 'success':
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        break;
      case 'warning':
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        break;
      case 'error':
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        break;
    }
  } catch {
    // Ignore on platforms without haptics support
  }
}

type NoteSpec = {
  freq: number;
  durationMs: number;
  delayMs?: number;
  type?: 'sine' | 'triangle' | 'square' | 'sawtooth';
  gain?: number;
  endFreq?: number;
};

let sharedAudioCtx: any = null;

function getAudioContext(): any | null {
  try {
    const g = globalThis as any;
    const AudioCtx = g.AudioContext || g.webkitAudioContext;
    if (!AudioCtx) return null;
    if (!sharedAudioCtx) {
      sharedAudioCtx = new AudioCtx();
    }
    if (sharedAudioCtx.state === 'suspended') {
      sharedAudioCtx.resume?.();
    }
    return sharedAudioCtx;
  } catch {
    return null;
  }
}

function playSynthSequence(notes: NoteSpec[]) {
  if (!useSoundStore.getState().isSoundEnabled) return;

  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    const now = ctx.currentTime;
    notes.forEach((n) => {
      const osc = ctx.createOscillator();
      const gainNode = ctx.createGain();

      osc.type = n.type ?? 'triangle';
      const startTime = now + (n.delayMs ?? 0) / 1000;
      const durationSec = Math.max(0.02, n.durationMs / 1000);
      const peakGain = n.gain ?? 0.16;

      osc.frequency.setValueAtTime(n.freq, startTime);
      if (n.endFreq) {
        osc.frequency.exponentialRampToValueAtTime(
          Math.max(40, n.endFreq),
          startTime + durationSec
        );
      }

      gainNode.gain.setValueAtTime(0.0001, startTime);
      gainNode.gain.linearRampToValueAtTime(peakGain, startTime + 0.012);
      gainNode.gain.exponentialRampToValueAtTime(
        0.0001,
        startTime + durationSec
      );

      osc.connect(gainNode);
      gainNode.connect(ctx.destination);

      osc.start(startTime);
      osc.stop(startTime + durationSec + 0.015);
    });
  } catch {
    // Ignore audio context errors if browser autoplay policy blocks before gesture
  }
}

/**
 * 1. Короткий пружний сигнал відліку 3 — 2 — 1
 */
export function playCountdownBeep() {
  triggerHaptic('heavy');
  playSynthSequence([
    { freq: 587.33, durationMs: 110, type: 'triangle', gain: 0.18 },
    { freq: 1174.66, durationMs: 85, type: 'sine', gain: 0.08 },
  ]);
}

/**
 * 2. Старт раунду «ПОГНАЛИ!» / «МОТОР!» (мажорний акорд-гонг)
 */
export function playCountdownGo() {
  triggerHaptic('success');
  playSynthSequence([
    { freq: 587.33, durationMs: 220, delayMs: 0, type: 'triangle', gain: 0.18 },
    { freq: 739.99, durationMs: 220, delayMs: 45, type: 'triangle', gain: 0.16 },
    { freq: 880.0, durationMs: 260, delayMs: 90, type: 'triangle', gain: 0.18 },
    { freq: 1174.66, durationMs: 360, delayMs: 130, type: 'sine', gain: 0.22 },
  ]);
}

/**
 * 3. Вгадане слово (+1 або +2) з підвищенням тону при серії (streak)
 */
export function playWordGuessed(streak = 1) {
  triggerHaptic('success');
  const clampedStreak = Math.min(8, Math.max(1, streak));
  const pitchMultiplier = Math.pow(1.059463, clampedStreak - 1); // +1 півтон за кожне слово в серії

  playSynthSequence([
    {
      freq: 659.25 * pitchMultiplier,
      durationMs: 95,
      delayMs: 0,
      type: 'triangle',
      gain: 0.18,
    },
    {
      freq: 830.61 * pitchMultiplier,
      durationMs: 110,
      delayMs: 55,
      type: 'triangle',
      gain: 0.18,
    },
    {
      freq: 1318.51 * pitchMultiplier,
      durationMs: 210,
      delayMs: 110,
      type: 'sine',
      gain: 0.22,
    },
  ]);
}

/**
 * 4. Пропуск слова (глухий низький спуск)
 */
export function playWordSkipped() {
  triggerHaptic('medium');
  playSynthSequence([
    {
      freq: 260,
      endFreq: 135,
      durationMs: 150,
      type: 'triangle',
      gain: 0.16,
    },
  ]);
}

/**
 * 5. Цокання таймера (попередження 20..11 сек та фінальні 10..1 сек)
 */
export function playTimerTick(urgency: 'warning' | 'critical') {
  if (urgency === 'warning') {
    playSynthSequence([
      { freq: 760, durationMs: 40, type: 'sine', gain: 0.08 },
    ]);
  } else {
    playSynthSequence([
      { freq: 980, durationMs: 55, delayMs: 0, type: 'triangle', gain: 0.15 },
      { freq: 660, durationMs: 65, delayMs: 85, type: 'sine', gain: 0.1 },
    ]);
  }
}

/**
 * 6. Сирена / Гонг завершення часу раунду (00:00)
 */
export function playRoundEndBuzzer() {
  triggerHaptic('warning');
  playSynthSequence([
    {
      freq: 440,
      endFreq: 220,
      durationMs: 360,
      delayMs: 0,
      type: 'sawtooth',
      gain: 0.14,
    },
    {
      freq: 330,
      endFreq: 165,
      durationMs: 420,
      delayMs: 90,
      type: 'triangle',
      gain: 0.16,
    },
  ]);
}

/**
 * 7. Фіксація перегляду секретної ролі у Шпигуні (600 мс)
 */
export function playRoleRevealLock(isSpy: boolean) {
  triggerHaptic('success');
  if (isSpy) {
    // Таємничий низький трилер-імпульс для Шпигуна
    playSynthSequence([
      { freq: 220, durationMs: 160, delayMs: 0, type: 'sawtooth', gain: 0.12 },
      { freq: 233.08, durationMs: 260, delayMs: 110, type: 'triangle', gain: 0.16 },
    ]);
  } else {
    // Чистий сигнал доступу до секретної локації
    playSynthSequence([
      { freq: 523.25, durationMs: 90, delayMs: 0, type: 'sine', gain: 0.14 },
      { freq: 783.99, durationMs: 170, delayMs: 70, type: 'triangle', gain: 0.16 },
    ]);
  }
}

/**
 * 8. Барабанний дріб під час утримання кнопки «Розсекретити Шпигуна»
 */
export function playSpyDrumrollTick(progress: number) {
  triggerHaptic(progress > 0.65 ? 'heavy' : 'medium');
  const risingFreq = 190 + Math.round(progress * 480);
  playSynthSequence([
    {
      freq: risingFreq,
      endFreq: risingFreq * 1.12,
      durationMs: 75,
      type: 'triangle',
      gain: 0.12 + progress * 0.1,
    },
  ]);
}

/**
 * 9. Кульмінаційний акорд розкриття Шпигуна
 */
export function playSpyUnmaskedSting() {
  triggerHaptic('success');
  playSynthSequence([
    { freq: 293.66, durationMs: 350, delayMs: 0, type: 'sawtooth', gain: 0.15 },
    { freq: 349.23, durationMs: 350, delayMs: 40, type: 'triangle', gain: 0.15 },
    { freq: 440.0, durationMs: 420, delayMs: 80, type: 'triangle', gain: 0.16 },
    { freq: 587.33, durationMs: 520, delayMs: 130, type: 'sine', gain: 0.2 },
  ]);
}

/**
 * 10. Фанфари перемоги у фіналі
 */
export function playVictoryFanfare() {
  triggerHaptic('success');
  playSynthSequence([
    { freq: 523.25, durationMs: 120, delayMs: 0, type: 'triangle', gain: 0.16 },
    { freq: 659.25, durationMs: 120, delayMs: 110, type: 'triangle', gain: 0.16 },
    { freq: 783.99, durationMs: 140, delayMs: 220, type: 'triangle', gain: 0.18 },
    { freq: 1046.5, durationMs: 420, delayMs: 340, type: 'sine', gain: 0.22 },
  ]);
}
