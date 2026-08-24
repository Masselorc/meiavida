export type TimeUnit = 'minutes' | 'hours' | 'days';
export type MassUnit = 'mcg' | 'mg' | 'g';

export interface Dose {
  id: string;
  amountMg: number | null;
  time: string;
}

export interface Scenario {
  id: string;
  name: string;
  color: string;
  halfLifeValue: number | null;
  halfLifeUnit: TimeUnit;
  tmaxValue: number | null;
  tmaxUnit: TimeUnit;
  displayUnit: MassUnit;
  doses: Dose[];
}

export interface ParsedDose {
  id: string;
  amountMg: number;
  timeMs: number;
}

export interface CurvePoint {
  timeMs: number;
  amountMg: number;
}

export interface Milestone {
  percentage: number;
  targetMg: number;
  timeMs: number | null;
}

export interface ScenarioAnalysis {
  halfLifeMs: number;
  tmaxMs: number;
  kePerMs: number;
  kaPerMs: number | null;
  terminalHalfLifeMs: number;
  parsedDoses: ParsedDose[];
  firstDoseTimeMs: number;
  lastDoseTimeMs: number;
  horizonEndMs: number;
  projectedPeakMg: number;
  projectedPeakTimeMs: number;
  curve: CurvePoint[];
  milestones: Milestone[];
}
