import type { MassUnit, TimeUnit } from '../types';

const TIME_FACTORS_MS: Record<TimeUnit, number> = {
  minutes: 60_000,
  hours: 3_600_000,
  days: 86_400_000,
};

const MASS_TO_MG: Record<MassUnit, number> = {
  mcg: 0.001,
  mg: 1,
  g: 1_000,
};

export function timeToMs(value: number, unit: TimeUnit): number {
  return value * TIME_FACTORS_MS[unit];
}

export function toMg(value: number, unit: MassUnit): number {
  return value * MASS_TO_MG[unit];
}

export function fromMg(valueMg: number, unit: MassUnit): number {
  return valueMg / MASS_TO_MG[unit];
}

export function formatMass(valueMg: number, unit: MassUnit, digits = 2): string {
  const value = fromMg(valueMg, unit);
  return `${value.toLocaleString('pt-BR', {
    maximumFractionDigits: digits,
    minimumFractionDigits: 0,
  })} ${unit}`;
}
