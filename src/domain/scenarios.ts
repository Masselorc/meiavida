import type { Scenario } from '../types';
import { getLocalDateTimeInputValue } from '../utils/dates';

export const PALETTE = [
  '#2563eb',
  '#059669',
  '#d97706',
  '#7c3aed',
  '#db2777',
  '#0891b2',
];

export function createScenario(index = 0): Scenario {
  return {
    id: crypto.randomUUID(),
    name: `Substância ${String.fromCharCode(65 + index)}`,
    color: PALETTE[index % PALETTE.length],
    halfLifeValue: null,
    halfLifeUnit: 'hours',
    tmaxValue: 0,
    tmaxUnit: 'minutes',
    displayUnit: 'mg',
    doses: [
      {
        id: crypto.randomUUID(),
        amountMg: null,
        time: getLocalDateTimeInputValue(),
      },
    ],
  };
}
