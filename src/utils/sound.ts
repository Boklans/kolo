import { Platform } from 'react-native';
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

export function triggerHaptic(
  kindOrPattern: HapticKind | number | number[] = 'light'
) {
  if (!useSoundStore.getState().isHapticsEnabled) return;
  try {
    if (Platform.OS === 'web') {
      if (
        typeof navigator !== 'undefined' &&
        typeof navigator.vibrate === 'function'
      ) {
        if (
          typeof kindOrPattern === 'number' ||
          Array.isArray(kindOrPattern)
        ) {
          navigator.vibrate(kindOrPattern);
          return;
        }
        switch (kindOrPattern) {
          case 'selection':
            navigator.vibrate(8);
            break;
          case 'light':
            navigator.vibrate(12);
            break;
          case 'medium':
            navigator.vibrate(20);
            break;
          case 'heavy':
            navigator.vibrate(30);
            break;
          case 'success':
            navigator.vibrate([16, 28, 24]);
            break;
          case 'warning':
            navigator.vibrate([30, 35, 42]);
            break;
          case 'error':
            navigator.vibrate([38, 30, 50]);
            break;
        }
      }
      return;
    }

    if (typeof kindOrPattern === 'number' || Array.isArray(kindOrPattern)) {
      const duration = Array.isArray(kindOrPattern)
        ? kindOrPattern[0] ?? 15
        : kindOrPattern;
      if (duration <= 10) {
        Haptics.selectionAsync();
      } else if (duration <= 18) {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      } else if (duration <= 28) {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      } else {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
      }
      return;
    }

    switch (kindOrPattern) {
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

type WarmNoteSpec = {
  freq: number;
  durationMs: number;
  delayMs?: number;
  type?: 'sine' | 'triangle';
  gain?: number;
  endFreq?: number;
  cutoffHz?: number;
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

export function unlockAudioContext() {
  const ctx = getAudioContext();
  if (ctx && ctx.state === 'suspended') {
    ctx.resume().catch(() => {});
  }
}

/**
 * Warm acoustic-style synthesizer routed through a gentle low-pass filter
 * so there are never harsh 8-bit buzzes or piercing high frequencies.
 */
function playWarmSequence(notes: WarmNoteSpec[]) {
  if (!useSoundStore.getState().isSoundEnabled) return;

  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    const now = ctx.currentTime;
    notes.forEach((n) => {
      const osc = ctx.createOscillator();
      const filter = ctx.createBiquadFilter();
      const gainNode = ctx.createGain();

      osc.type = n.type ?? 'sine';
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(n.cutoffHz ?? 1400, now);
      filter.Q.setValueAtTime(0.7, now);

      const startTime = now + (n.delayMs ?? 0) / 1000;
      const durationSec = Math.max(0.025, n.durationMs / 1000);
      const peakGain = n.gain ?? 0.08;

      osc.frequency.setValueAtTime(n.freq, startTime);
      if (n.endFreq) {
        osc.frequency.exponentialRampToValueAtTime(
          Math.max(45, n.endFreq),
          startTime + durationSec
        );
      }

      const attackSec = Math.min(0.012, durationSec * 0.25);
      gainNode.gain.setValueAtTime(0.0001, startTime);
      gainNode.gain.linearRampToValueAtTime(peakGain, startTime + attackSec);
      gainNode.gain.exponentialRampToValueAtTime(
        0.0001,
        startTime + durationSec
      );

      osc.connect(filter);
      filter.connect(gainNode);
      gainNode.connect(ctx.destination);

      osc.start(startTime);
      osc.stop(startTime + durationSec + 0.02);
    });
  } catch {
    // Ignore audio context errors if browser autoplay policy blocks before gesture
  }
}

const STREAK_NOTES_HZ = [392.0, 440.0, 493.88, 523.25, 587.33, 659.25];

/**
 * 1. М’який дерев’яний клік відліку 3 — 2 — 1 (як марімба)
 */
export function playCountdownBeep() {
  triggerHaptic('medium');
  playWarmSequence([
    {
      freq: 392.0,
      endFreq: 382.0,
      durationMs: 95,
      type: 'sine',
      gain: 0.09,
      cutoffHz: 1100,
    },
    {
      freq: 784.0,
      durationMs: 42,
      type: 'sine',
      gain: 0.022,
      cutoffHz: 1200,
    },
  ]);
}

/**
 * 2. Старт раунду (теплий м’який мажорний перебір)
 */
export function playCountdownGo() {
  triggerHaptic('success');
  playWarmSequence([
    {
      freq: 329.63,
      durationMs: 140,
      delayMs: 0,
      type: 'sine',
      gain: 0.08,
      cutoffHz: 1400,
    },
    {
      freq: 392.0,
      durationMs: 160,
      delayMs: 55,
      type: 'sine',
      gain: 0.085,
      cutoffHz: 1500,
    },
    {
      freq: 523.25,
      durationMs: 260,
      delayMs: 110,
      type: 'triangle',
      gain: 0.09,
      cutoffHz: 1400,
    },
  ]);
}

/**
 * 3. Вгадане слово (приємний теплий клік-калімба з делікатним підйомом на серії)
 */
export function playWordGuessed(streak = 1) {
  triggerHaptic('light');
  const idx = Math.min(STREAK_NOTES_HZ.length - 1, Math.max(0, streak - 1));
  const baseFreq = STREAK_NOTES_HZ[idx];

  playWarmSequence([
    {
      freq: baseFreq,
      durationMs: 75,
      delayMs: 0,
      type: 'sine',
      gain: 0.075,
      cutoffHz: 1300,
    },
    {
      freq: baseFreq * 1.25,
      durationMs: 135,
      delayMs: 42,
      type: 'sine',
      gain: 0.085,
      cutoffHz: 1450,
    },
  ]);
}

/**
 * 4. Пропуск слова / пас (тихий м’який «тук» картки)
 */
export function playWordSkipped() {
  triggerHaptic('selection');
  playWarmSequence([
    {
      freq: 220,
      endFreq: 145,
      durationMs: 85,
      type: 'sine',
      gain: 0.07,
      cutoffHz: 700,
    },
  ]);
}

/**
 * 4b. Порушення Табу (низький глухий подвійний стукіт без різкого писку)
 */
export function playTabooBuzz() {
  triggerHaptic('error');
  playWarmSequence([
    {
      freq: 196.0,
      endFreq: 165.0,
      durationMs: 95,
      delayMs: 0,
      type: 'triangle',
      gain: 0.095,
      cutoffHz: 520,
    },
    {
      freq: 155.56,
      endFreq: 130.81,
      durationMs: 130,
      delayMs: 75,
      type: 'triangle',
      gain: 0.095,
      cutoffHz: 480,
    },
  ]);
}

/**
 * 5. Цокання таймера (делікатний дерев’яний тік, не ріже вухо)
 */
export function playTimerTick(urgency: 'warning' | 'critical') {
  if (urgency === 'warning') {
    playWarmSequence([
      {
        freq: 460,
        endFreq: 420,
        durationMs: 28,
        type: 'sine',
        gain: 0.04,
        cutoffHz: 950,
      },
    ]);
  } else {
    playWarmSequence([
      {
        freq: 520,
        endFreq: 480,
        durationMs: 36,
        delayMs: 0,
        type: 'sine',
        gain: 0.065,
        cutoffHz: 1050,
      },
      {
        freq: 392,
        endFreq: 370,
        durationMs: 42,
        delayMs: 75,
        type: 'sine',
        gain: 0.045,
        cutoffHz: 900,
      },
    ]);
  }
}

/**
 * 6. Завершення часу раунду (глибокий теплий студійний гонг замість сирени)
 */
export function playRoundEndBuzzer() {
  triggerHaptic('warning');
  playWarmSequence([
    {
      freq: 329.63,
      durationMs: 220,
      delayMs: 0,
      type: 'triangle',
      gain: 0.085,
      cutoffHz: 900,
    },
    {
      freq: 246.94,
      durationMs: 360,
      delayMs: 110,
      type: 'sine',
      gain: 0.1,
      cutoffHz: 800,
    },
    {
      freq: 123.47,
      durationMs: 400,
      delayMs: 110,
      type: 'sine',
      gain: 0.08,
      cutoffHz: 420,
    },
  ]);
}

/**
 * 7. Фіксація перегляду секретної ролі у Шпигуні (тихий нейтральний клік, 100% однаковий для всіх)
 */
export function playRoleRevealLock(_isSpy?: boolean) {
  triggerHaptic('light');
  playWarmSequence([
    {
      freq: 440.0,
      durationMs: 60,
      delayMs: 0,
      type: 'sine',
      gain: 0.055,
      cutoffHz: 1100,
    },
    {
      freq: 554.37,
      durationMs: 90,
      delayMs: 45,
      type: 'sine',
      gain: 0.055,
      cutoffHz: 1100,
    },
  ]);
}

/**
 * 8. Глухий пульс-серцебиття під час утримання «Розсекретити Шпигуна»
 */
export function playSpyDrumrollTick(progress: number) {
  triggerHaptic(progress > 0.65 ? 'medium' : 'light');
  const freq = 92 + Math.round(progress * 68);
  playWarmSequence([
    {
      freq,
      endFreq: freq * 0.72,
      durationMs: 65,
      type: 'sine',
      gain: 0.08 + progress * 0.04,
      cutoffHz: 360,
    },
  ]);
}

/**
 * 9. Нуарний акорд розкриття Шпигуна (м’яке низьке фортепіано, без різкості)
 */
export function playSpyUnmaskedSting() {
  triggerHaptic('success');
  playWarmSequence([
    {
      freq: 146.83,
      durationMs: 460,
      delayMs: 0,
      type: 'sine',
      gain: 0.09,
      cutoffHz: 750,
    },
    {
      freq: 220.0,
      durationMs: 440,
      delayMs: 45,
      type: 'triangle',
      gain: 0.075,
      cutoffHz: 850,
    },
    {
      freq: 261.63,
      durationMs: 460,
      delayMs: 90,
      type: 'sine',
      gain: 0.08,
      cutoffHz: 950,
    },
    {
      freq: 349.23,
      durationMs: 520,
      delayMs: 135,
      type: 'sine',
      gain: 0.075,
      cutoffHz: 1050,
    },
  ]);
}

/**
 * 10. Теплі камерні фанфари перемоги (м’який акорд-марімба)
 */
export function playVictoryFanfare() {
  triggerHaptic('success');
  playWarmSequence([
    {
      freq: 261.63,
      durationMs: 160,
      delayMs: 0,
      type: 'sine',
      gain: 0.08,
      cutoffHz: 1400,
    },
    {
      freq: 329.63,
      durationMs: 170,
      delayMs: 90,
      type: 'sine',
      gain: 0.085,
      cutoffHz: 1400,
    },
    {
      freq: 392.0,
      durationMs: 200,
      delayMs: 180,
      type: 'triangle',
      gain: 0.085,
      cutoffHz: 1500,
    },
    {
      freq: 523.25,
      durationMs: 380,
      delayMs: 270,
      type: 'sine',
      gain: 0.095,
      cutoffHz: 1500,
    },
  ]);
}
