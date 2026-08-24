import type {
  CurvePoint,
  ParsedDose,
  Scenario,
  ScenarioAnalysis,
} from '../types';
import { timeToMs } from './units';

const LN2 = Math.log(2);
const EPSILON = 1e-12;
const CURVE_STEPS = 1_600;
const MILESTONE_PERCENTAGES = [50, 25, 12.5, 10, 5, 1, 0.1] as const;

export function eliminationRatePerMs(halfLifeMs: number): number {
  if (!Number.isFinite(halfLifeMs) || halfLifeMs <= 0) {
    throw new Error('A meia-vida deve ser maior que zero.');
  }
  return LN2 / halfLifeMs;
}

/**
 * Infere ka a partir de ke e Tmax no modelo de um compartimento:
 * Tmax = ln(ka/ke) / (ka - ke).
 *
 * Resolve y / expm1(y) = ke*Tmax, com y = ln(ka/ke).
 */
export function absorptionRateFromTmax(
  halfLifeMs: number,
  tmaxMs: number,
): number | null {
  if (!Number.isFinite(tmaxMs) || tmaxMs < 0) {
    throw new Error('O Tmax deve ser zero ou um valor positivo.');
  }
  if (tmaxMs === 0) return null;

  const ke = eliminationRatePerMs(halfLifeMs);
  const target = ke * tmaxMs;

  const ratioEquation = (y: number): number => {
    if (Math.abs(y) < 1e-8) {
      return 1 - y / 2 + (y * y) / 12;
    }
    return y / Math.expm1(y);
  };

  let low = -Math.max(80, target * 2 + 10);
  let high = Math.max(80, -Math.log(Math.max(target, Number.MIN_VALUE)) * 2 + 10);

  for (let i = 0; i < 180; i += 1) {
    const mid = (low + high) / 2;
    if (ratioEquation(mid) > target) low = mid;
    else high = mid;
  }

  const ratio = Math.exp((low + high) / 2);
  const ka = ke * ratio;

  if (!Number.isFinite(ka) || ka <= 0) {
    throw new Error(
      'O Tmax informado gera uma constante de absorção fora da faixa numérica do simulador.',
    );
  }

  return ka;
}

function amountFromDoseAtRates(
  timestampMs: number,
  dose: ParsedDose,
  kePerMs: number,
  kaPerMs: number | null,
): number {
  const elapsedMs = timestampMs - dose.timeMs;
  if (elapsedMs < 0) return 0;

  if (kaPerMs === null) {
    return dose.amountMg * Math.exp(-kePerMs * elapsedMs);
  }

  if (
    Math.abs(kaPerMs - kePerMs) <=
    Math.max(kaPerMs, kePerMs) * 1e-8
  ) {
    const amount =
      dose.amountMg *
      kaPerMs *
      elapsedMs *
      Math.exp(-kePerMs * elapsedMs);
    return clampPhysicalAmount(amount, dose.amountMg);
  }

  const amount =
    dose.amountMg *
    (kaPerMs / (kaPerMs - kePerMs)) *
    (Math.exp(-kePerMs * elapsedMs) - Math.exp(-kaPerMs * elapsedMs));

  return clampPhysicalAmount(amount, dose.amountMg);
}

export function amountFromDoseAt(
  timestampMs: number,
  dose: ParsedDose,
  halfLifeMs: number,
  tmaxMs: number,
): number {
  return amountFromDoseAtRates(
    timestampMs,
    dose,
    eliminationRatePerMs(halfLifeMs),
    absorptionRateFromTmax(halfLifeMs, tmaxMs),
  );
}

function clampPhysicalAmount(value: number, doseMg: number): number {
  if (!Number.isFinite(value)) return 0;
  if (value < 0 && value > -EPSILON) return 0;
  return Math.min(doseMg, Math.max(0, value));
}

function depotAmountFromDoseAtRate(
  timestampMs: number,
  dose: ParsedDose,
  kaPerMs: number | null,
): number {
  const elapsedMs = timestampMs - dose.timeMs;
  if (elapsedMs < 0 || kaPerMs === null) return 0;
  return dose.amountMg * Math.exp(-kaPerMs * elapsedMs);
}

function totalAmountAtRates(
  timestampMs: number,
  doses: ParsedDose[],
  kePerMs: number,
  kaPerMs: number | null,
): number {
  return doses.reduce(
    (sum, dose) =>
      sum + amountFromDoseAtRates(timestampMs, dose, kePerMs, kaPerMs),
    0,
  );
}

export function totalAmountAt(
  timestampMs: number,
  doses: ParsedDose[],
  halfLifeMs: number,
  tmaxMs: number,
): number {
  return totalAmountAtRates(
    timestampMs,
    doses,
    eliminationRatePerMs(halfLifeMs),
    absorptionRateFromTmax(halfLifeMs, tmaxMs),
  );
}

export function stateAt(
  timestampMs: number,
  doses: ParsedDose[],
  halfLifeMs: number,
  tmaxMs: number,
) {
  const administered = doses.filter((dose) => dose.timeMs <= timestampMs);
  const kePerMs = eliminationRatePerMs(halfLifeMs);
  const kaPerMs = absorptionRateFromTmax(halfLifeMs, tmaxMs);

  const administeredMg = administered.reduce(
    (sum, dose) => sum + dose.amountMg,
    0,
  );
  const centralMg = totalAmountAtRates(
    timestampMs,
    administered,
    kePerMs,
    kaPerMs,
  );
  const depotMg = administered.reduce(
    (sum, dose) =>
      sum + depotAmountFromDoseAtRate(timestampMs, dose, kaPerMs),
    0,
  );
  const eliminatedMg = Math.max(
    0,
    administeredMg - centralMg - depotMg,
  );

  return {
    administeredMg,
    centralMg,
    depotMg,
    eliminatedMg,
    plannedCount: doses.filter((dose) => dose.timeMs > timestampMs).length,
    administeredCount: administered.length,
    centralPercent:
      administeredMg > 0 ? (centralMg / administeredMg) * 100 : 0,
    depotPercent:
      administeredMg > 0 ? (depotMg / administeredMg) * 100 : 0,
    eliminatedPercent:
      administeredMg > 0 ? (eliminatedMg / administeredMg) * 100 : 0,
  };
}

export function parseScenarioDoses(scenario: Scenario): ParsedDose[] {
  return scenario.doses
    .map((dose) => ({
      id: dose.id,
      amountMg: dose.amountMg ?? 0,
      timeMs: new Date(dose.time).getTime(),
    }))
    .filter(
      (dose) =>
        Number.isFinite(dose.amountMg) &&
        dose.amountMg > 0 &&
        Number.isFinite(dose.timeMs),
    )
    .sort((a, b) => a.timeMs - b.timeMs);
}

export function validateScenario(scenario: Scenario): string[] {
  const errors: string[] = [];

  if (!scenario.name.trim()) {
    errors.push('Informe o nome da substância/cenário.');
  }

  if (
    scenario.halfLifeValue === null ||
    !Number.isFinite(scenario.halfLifeValue) ||
    scenario.halfLifeValue <= 0
  ) {
    errors.push('A meia-vida deve ser maior que zero.');
  }

  if (
    scenario.tmaxValue === null ||
    !Number.isFinite(scenario.tmaxValue) ||
    scenario.tmaxValue < 0
  ) {
    errors.push('O Tmax deve ser zero ou um valor positivo.');
  }

  if (!Array.isArray(scenario.doses) || scenario.doses.length === 0) {
    errors.push('Cadastre pelo menos uma dose.');
  } else {
    scenario.doses.forEach((dose, index) => {
      if (
        dose.amountMg === null ||
        !Number.isFinite(dose.amountMg) ||
        dose.amountMg <= 0
      ) {
        errors.push(
          `Dose ${index + 1}: informe uma quantidade maior que zero.`,
        );
      }
      if (!dose.time || !Number.isFinite(new Date(dose.time).getTime())) {
        errors.push(`Dose ${index + 1}: informe uma data e hora válidas.`);
      }
    });
  }

  if (
    errors.length === 0 &&
    scenario.halfLifeValue !== null &&
    scenario.tmaxValue !== null
  ) {
    try {
      const halfLifeMs = timeToMs(
        scenario.halfLifeValue,
        scenario.halfLifeUnit,
      );
      const tmaxMs = timeToMs(scenario.tmaxValue, scenario.tmaxUnit);
      const ka = absorptionRateFromTmax(halfLifeMs, tmaxMs);
      const ke = eliminationRatePerMs(halfLifeMs);
      const terminalRate = ka === null ? ke : Math.min(ke, ka);
      const terminalHalfLife = LN2 / terminalRate;
      if (!Number.isFinite(terminalHalfLife) || terminalHalfLife <= 0) {
        errors.push('Os parâmetros geraram um horizonte farmacocinético inválido.');
      }
    } catch (error) {
      errors.push(
        error instanceof Error
          ? error.message
          : 'Os parâmetros farmacocinéticos são inválidos.',
      );
    }
  }

  return errors;
}

export function analyzeScenario(scenario: Scenario): ScenarioAnalysis {
  const errors = validateScenario(scenario);
  if (errors.length > 0) throw new Error(errors.join(' '));

  const halfLifeMs = timeToMs(
    scenario.halfLifeValue as number,
    scenario.halfLifeUnit,
  );
  const tmaxMs = timeToMs(
    scenario.tmaxValue as number,
    scenario.tmaxUnit,
  );
  const kePerMs = eliminationRatePerMs(halfLifeMs);
  const kaPerMs = absorptionRateFromTmax(halfLifeMs, tmaxMs);
  const terminalRate =
    kaPerMs === null ? kePerMs : Math.min(kePerMs, kaPerMs);
  const terminalHalfLifeMs = LN2 / terminalRate;
  const parsedDoses = parseScenarioDoses(scenario);

  const firstDoseTimeMs = parsedDoses[0].timeMs;
  const lastDoseTimeMs = parsedDoses[parsedDoses.length - 1].timeMs;
  const horizonEndMs =
    lastDoseTimeMs +
    Math.max(
      terminalHalfLifeMs * 10.5,
      tmaxMs * 2,
      halfLifeMs * 2,
    );

  const quantityAt = (timeMs: number) =>
    totalAmountAtRates(timeMs, parsedDoses, kePerMs, kaPerMs);

  const baseCurve = sampleCurve(
    parsedDoses,
    tmaxMs,
    firstDoseTimeMs,
    horizonEndMs,
    CURVE_STEPS,
    quantityAt,
  );

  const peakIndex = findPeakIndex(baseCurve);
  const peakBracketStart =
    baseCurve[Math.max(0, peakIndex - 1)]?.timeMs ?? firstDoseTimeMs;
  const peakBracketEnd =
    baseCurve[Math.min(baseCurve.length - 1, peakIndex + 1)]?.timeMs ??
    horizonEndMs;

  const projectedPeakTimeMs = maximizeInBracket(
    peakBracketStart,
    peakBracketEnd,
    quantityAt,
  );
  const projectedPeakMg = quantityAt(projectedPeakTimeMs);

  const curve = mergePointIntoCurve(baseCurve, {
    timeMs: projectedPeakTimeMs,
    amountMg: projectedPeakMg,
  });

  const milestones = MILESTONE_PERCENTAGES.map((percentage) => {
    const targetMg = projectedPeakMg * (percentage / 100);
    return {
      percentage,
      targetMg,
      timeMs: findFinalDescendingCrossing(curve, targetMg, quantityAt),
    };
  });

  return {
    halfLifeMs,
    tmaxMs,
    kePerMs,
    kaPerMs,
    terminalHalfLifeMs,
    parsedDoses,
    firstDoseTimeMs,
    lastDoseTimeMs,
    horizonEndMs,
    projectedPeakMg,
    projectedPeakTimeMs,
    curve,
    milestones,
  };
}

function sampleCurve(
  doses: ParsedDose[],
  tmaxMs: number,
  startMs: number,
  endMs: number,
  steps: number,
  quantityAt: (timeMs: number) => number,
): CurvePoint[] {
  const points: CurvePoint[] = [];

  for (let i = 0; i <= steps; i += 1) {
    const timeMs = startMs + ((endMs - startMs) * i) / steps;
    points.push({ timeMs, amountMg: quantityAt(timeMs) });
  }

  for (const dose of doses) {
    if (dose.timeMs >= startMs && dose.timeMs <= endMs) {
      points.push({
        timeMs: dose.timeMs,
        amountMg: quantityAt(dose.timeMs),
      });
    }

    const doseTmax = dose.timeMs + tmaxMs;
    if (doseTmax >= startMs && doseTmax <= endMs) {
      points.push({
        timeMs: doseTmax,
        amountMg: quantityAt(doseTmax),
      });
    }
  }

  return dedupeCurvePoints(points.sort((a, b) => a.timeMs - b.timeMs));
}

function dedupeCurvePoints(points: CurvePoint[]): CurvePoint[] {
  const result: CurvePoint[] = [];
  for (const point of points) {
    const previous = result[result.length - 1];
    if (previous && previous.timeMs === point.timeMs) {
      if (point.amountMg > previous.amountMg) result[result.length - 1] = point;
    } else {
      result.push(point);
    }
  }
  return result;
}

function findPeakIndex(curve: CurvePoint[]): number {
  let peakIndex = 0;
  for (let i = 1; i < curve.length; i += 1) {
    if (curve[i].amountMg > curve[peakIndex].amountMg) peakIndex = i;
  }
  return peakIndex;
}

function maximizeInBracket(
  startMs: number,
  endMs: number,
  fn: (timeMs: number) => number,
): number {
  if (endMs <= startMs) return startMs;

  let left = startMs;
  let right = endMs;

  for (let i = 0; i < 80; i += 1) {
    const third = (right - left) / 3;
    const m1 = left + third;
    const m2 = right - third;
    if (fn(m1) < fn(m2)) left = m1;
    else right = m2;
  }

  return (left + right) / 2;
}

function mergePointIntoCurve(
  curve: CurvePoint[],
  point: CurvePoint,
): CurvePoint[] {
  return dedupeCurvePoints(
    [...curve, point].sort((a, b) => a.timeMs - b.timeMs),
  );
}

function findFinalDescendingCrossing(
  curve: CurvePoint[],
  targetMg: number,
  quantityAt: (timeMs: number) => number,
): number | null {
  for (let i = curve.length - 1; i > 0; i -= 1) {
    const later = curve[i];
    const earlier = curve[i - 1];

    if (later.amountMg <= targetMg && earlier.amountMg > targetMg) {
      return bisectCrossing(
        earlier.timeMs,
        later.timeMs,
        targetMg,
        quantityAt,
      );
    }
  }

  return null;
}

function bisectCrossing(
  startMs: number,
  endMs: number,
  target: number,
  fn: (timeMs: number) => number,
): number {
  let left = startMs;
  let right = endMs;

  for (let i = 0; i < 80; i += 1) {
    const mid = (left + right) / 2;
    if (fn(mid) > target) left = mid;
    else right = mid;
  }

  return (left + right) / 2;
}
