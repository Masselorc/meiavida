import { describe, expect, it } from 'vitest';
import {
  absorptionRateFromTmax,
  amountFromDoseAt,
  analyzeScenario,
  stateAt,
} from '../src/domain/pharmacokinetics';
import type { ParsedDose, Scenario } from '../src/types';

const hour = 3_600_000;

describe('pharmacokinetics', () => {
  it('halves an instantaneously absorbed dose after one half-life', () => {
    const dose: ParsedDose = { id: 'd1', amountMg: 100, timeMs: 0 };
    expect(amountFromDoseAt(8 * hour, dose, 8 * hour, 0)).toBeCloseTo(50, 8);
  });

  it('derives ka so the Bateman peak occurs at the requested Tmax', () => {
    const halfLife = 24 * hour;
    const tmax = 4 * hour;
    const ka = absorptionRateFromTmax(halfLife, tmax);
    expect(ka).not.toBeNull();

    const dose: ParsedDose = { id: 'd1', amountMg: 100, timeMs: 0 };
    const atPeak = amountFromDoseAt(tmax, dose, halfLife, tmax);
    const before = amountFromDoseAt(tmax - 60_000, dose, halfLife, tmax);
    const after = amountFromDoseAt(tmax + 60_000, dose, halfLife, tmax);
    expect(atPeak).toBeGreaterThan(before);
    expect(atPeak).toBeGreaterThan(after);
  });

  it('does not count future doses in current-state percentages', () => {
    const doses: ParsedDose[] = [
      { id: 'now', amountMg: 100, timeMs: 0 },
      { id: 'future', amountMg: 1000, timeMs: 48 * hour },
    ];
    const state = stateAt(8 * hour, doses, 8 * hour, 0);
    expect(state.administeredMg).toBe(100);
    expect(state.centralMg).toBeCloseTo(50, 8);
    expect(state.eliminatedPercent).toBeCloseTo(50, 8);
    expect(state.plannedCount).toBe(1);
  });

  it('keeps mass accounting consistent during absorption', () => {
    const doses: ParsedDose[] = [{ id: 'd1', amountMg: 100, timeMs: 0 }];
    const state = stateAt(2 * hour, doses, 24 * hour, 4 * hour);
    expect(state.centralMg + state.depotMg + state.eliminatedMg).toBeCloseTo(100, 8);
    expect(state.eliminatedPercent).toBeGreaterThanOrEqual(0);
    expect(state.eliminatedPercent).toBeLessThanOrEqual(100);
  });

  it('finds the final 0.1% milestone after more than five half-lives', () => {
    const scenario: Scenario = {
      id: 's',
      name: 'Teste',
      color: '#000',
      halfLifeValue: 8,
      halfLifeUnit: 'hours',
      tmaxValue: 0,
      tmaxUnit: 'hours',
      displayUnit: 'mg',
      doses: [{ id: 'd', amountMg: 100, time: '2026-01-01T00:00' }],
    };

    const analysis = analyzeScenario(scenario);
    const milestone = analysis.milestones.find((item) => item.percentage === 0.1);
    expect(milestone?.timeMs).not.toBeNull();

    const elapsedHalfLives =
      ((milestone?.timeMs ?? 0) - analysis.firstDoseTimeMs) / analysis.halfLifeMs;
    expect(elapsedHalfLives).toBeGreaterThan(9.9);
    expect(elapsedHalfLives).toBeLessThan(10.1);
  });
});
