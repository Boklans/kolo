import { RoundTimeSec } from '@/types';

export const ROUND_TIME_OPTIONS: readonly RoundTimeSec[] = [
  15, 30, 45, 60, 90, 120,
] as const;

export const MIN_ROUNDS_PER_TEAM = 1;
export const MAX_ROUNDS_PER_TEAM = 10;

export function formatLaps(count: number): string {
  const abs = Math.abs(Math.floor(count));
  const mod100 = abs % 100;
  const mod10 = abs % 10;
  if (mod100 >= 11 && mod100 <= 14) {
    return `${abs} кіл`;
  }
  if (mod10 === 1) {
    return `${abs} коло`;
  }
  if (mod10 >= 2 && mod10 <= 4) {
    return `${abs} кола`;
  }
  return `${abs} кіл`;
}

/**
 * Proportional timer urgency thresholds so 15s and 30s blitz rounds
 * don't flash critical red immediately upon starting.
 */
export function getTimerThresholds(roundTimeSec: number): {
  warningSec: number;
  criticalSec: number;
  pulseSec: number;
  milestoneTicks: number[];
} {
  if (roundTimeSec <= 15) {
    return {
      warningSec: 8,
      criticalSec: 5,
      pulseSec: 5,
      milestoneTicks: [],
    };
  }
  if (roundTimeSec <= 30) {
    return {
      warningSec: 10,
      criticalSec: 5,
      pulseSec: 5,
      milestoneTicks: [10],
    };
  }
  if (roundTimeSec <= 45) {
    return {
      warningSec: 15,
      criticalSec: 10,
      pulseSec: 10,
      milestoneTicks: [15],
    };
  }
  return {
    warningSec: 20,
    criticalSec: 10,
    pulseSec: 10,
    milestoneTicks: [20, 15],
  };
}
