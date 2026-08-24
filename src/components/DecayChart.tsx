import type { Scenario, ScenarioAnalysis } from '../types';
import { formatMass } from '../domain/units';

interface ChartItem {
  scenario: Scenario;
  analysis: ScenarioAnalysis;
}

interface Props {
  items: ChartItem[];
  now: number;
}

const WIDTH = 900;
const HEIGHT = 430;
const PAD_LEFT = 74;
const PAD_RIGHT = 24;
const PAD_TOP = 28;
const PAD_BOTTOM = 54;

export function DecayChart({ items, now }: Props) {
  if (items.length === 0) return null;

  const start = Math.min(...items.map((item) => item.analysis.firstDoseTimeMs));
  const end = Math.max(...items.map((item) => item.analysis.horizonEndMs));
  const maxY = Math.max(
    0.000001,
    ...items.map((item) => item.analysis.projectedPeakMg),
  ) * 1.1;

  const graphWidth = WIDTH - PAD_LEFT - PAD_RIGHT;
  const graphHeight = HEIGHT - PAD_TOP - PAD_BOTTOM;
  const x = (timeMs: number) => PAD_LEFT + ((timeMs - start) / (end - start)) * graphWidth;
  const y = (amountMg: number) => PAD_TOP + graphHeight - (amountMg / maxY) * graphHeight;

  return (
    <section className="card chart-card" aria-labelledby="curve-title">
      <div className="card-body">
        <div className="row-between chart-heading">
          <div>
            <h2 id="curve-title">Curvas farmacocinéticas</h2>
            <p className="muted">
              Linha contínua: período transcorrido. Tracejado: projeção com doses futuras cadastradas.
            </p>
          </div>
          <div className="legend" aria-label="Legenda das curvas">
            {items.map(({ scenario }, index) => (
              <span className="legend-item" key={scenario.id}>
                <svg width="34" height="8" aria-hidden="true">
                  <line
                    x1="0"
                    y1="4"
                    x2="34"
                    y2="4"
                    stroke={scenario.color}
                    strokeWidth="3"
                    strokeDasharray={index % 2 === 0 ? undefined : '8 4'}
                  />
                </svg>
                {scenario.name}
              </span>
            ))}
          </div>
        </div>

        <div className="chart-scroll">
          <svg
            viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
            role="img"
            aria-labelledby="chart-svg-title chart-svg-desc"
          >
            <title id="chart-svg-title">Quantidade estimada no organismo ao longo do tempo</title>
            <desc id="chart-svg-desc">
              Curvas calculadas por modelo de um compartimento com eliminação de primeira ordem e,
              quando Tmax é maior que zero, absorção de primeira ordem.
            </desc>

            {[0, 0.25, 0.5, 0.75, 1].map((fraction) => {
              const amount = maxY * (1 - fraction);
              const yy = PAD_TOP + graphHeight * fraction;
              return (
                <g key={fraction}>
                  <line
                    x1={PAD_LEFT}
                    x2={WIDTH - PAD_RIGHT}
                    y1={yy}
                    y2={yy}
                    className="grid-line"
                  />
                  <text x={PAD_LEFT - 10} y={yy + 4} textAnchor="end" className="axis-label">
                    {amount.toFixed(amount < 10 ? 2 : 1)}
                  </text>
                </g>
              );
            })}

            <text
              x="18"
              y={PAD_TOP + graphHeight / 2}
              transform={`rotate(-90 18 ${PAD_TOP + graphHeight / 2})`}
              textAnchor="middle"
              className="axis-label"
            >
              Quantidade interna (mg)
            </text>

            <line
              x1={PAD_LEFT}
              x2={PAD_LEFT}
              y1={PAD_TOP}
              y2={HEIGHT - PAD_BOTTOM}
              className="axis-line"
            />
            <line
              x1={PAD_LEFT}
              x2={WIDTH - PAD_RIGHT}
              y1={HEIGHT - PAD_BOTTOM}
              y2={HEIGHT - PAD_BOTTOM}
              className="axis-line"
            />

            {items.map(({ scenario, analysis }, index) => {
              const past = analysis.curve.filter((point) => point.timeMs <= now);
              const future = analysis.curve.filter((point) => point.timeMs >= now);
              const currentAmount =
                now >= analysis.firstDoseTimeMs && now <= analysis.horizonEndMs
                  ? interpolateAt(now, analysis.curve)
                  : null;

              return (
                <g key={scenario.id}>
                  <path
                    d={toPath(past, x, y)}
                    fill="none"
                    stroke={scenario.color}
                    strokeWidth="3"
                    strokeDasharray={index % 2 === 0 ? undefined : '8 4'}
                  />
                  <path
                    d={toPath(future, x, y)}
                    fill="none"
                    stroke={scenario.color}
                    strokeWidth="2.5"
                    strokeDasharray="5 6"
                    opacity="0.58"
                  />
                  {currentAmount !== null && (
                    <g>
                      <circle cx={x(now)} cy={y(currentAmount)} r="5" fill={scenario.color} />
                      <text
                        x={Math.min(WIDTH - 105, x(now) + 9)}
                        y={Math.max(16, y(currentAmount) - 9)}
                        fill={scenario.color}
                        className="current-label"
                      >
                        {formatMass(currentAmount, scenario.displayUnit, 3)}
                      </text>
                    </g>
                  )}
                </g>
              );
            })}
          </svg>
        </div>
      </div>
    </section>
  );
}

function toPath(
  points: Array<{ timeMs: number; amountMg: number }>,
  x: (value: number) => number,
  y: (value: number) => number,
): string {
  if (points.length === 0) return '';
  return points
    .map((point, index) => `${index === 0 ? 'M' : 'L'} ${x(point.timeMs)} ${y(point.amountMg)}`)
    .join(' ');
}

function interpolateAt(
  timeMs: number,
  curve: Array<{ timeMs: number; amountMg: number }>,
): number {
  if (timeMs <= curve[0].timeMs) return curve[0].amountMg;
  if (timeMs >= curve[curve.length - 1].timeMs) return curve[curve.length - 1].amountMg;

  let low = 0;
  let high = curve.length - 1;
  while (high - low > 1) {
    const mid = Math.floor((low + high) / 2);
    if (curve[mid].timeMs <= timeMs) low = mid;
    else high = mid;
  }

  const left = curve[low];
  const right = curve[high];
  const ratio = (timeMs - left.timeMs) / (right.timeMs - left.timeMs);
  return left.amountMg + (right.amountMg - left.amountMg) * ratio;
}
