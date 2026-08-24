import { useMemo, useState } from 'react';
import type { Scenario, ScenarioAnalysis } from '../types';
import { stateAt } from '../domain/pharmacokinetics';
import { formatMass, fromMg, toMg } from '../domain/units';
import { formatDateTime, formatDuration, getLocalDateTimeInputValue } from '../utils/dates';

interface Props {
  scenario: Scenario;
  analysis: ScenarioAnalysis;
  now: number;
  onChange: (scenario: Scenario) => void;
}

export function ScenarioDashboard({ scenario, analysis, now, onChange }: Props) {
  const current = useMemo(
    () =>
      stateAt(
        now,
        analysis.parsedDoses,
        analysis.halfLifeMs,
        analysis.tmaxMs,
      ),
    [analysis, now],
  );

  const [quickAmount, setQuickAmount] = useState('');
  const [quickTime, setQuickTime] = useState(getLocalDateTimeInputValue());

  const nextPlannedDose = analysis.parsedDoses.find((dose) => dose.timeMs > now);
  const latestAdministered = [...analysis.parsedDoses]
    .reverse()
    .find((dose) => dose.timeMs <= now);

  const latestPeakTime =
    latestAdministered && analysis.tmaxMs > 0
      ? latestAdministered.timeMs + analysis.tmaxMs
      : null;

  const phase =
    current.administeredCount === 0
      ? 'Aguardando primeira dose'
      : latestPeakTime !== null && now < latestPeakTime
        ? `Absorção da dose mais recente até ${formatDateTime(latestPeakTime)}`
        : nextPlannedDose
          ? `Próxima dose planejada em ${formatDateTime(nextPlannedDose.timeMs)}`
          : 'Fase de declínio terminal projetada';

  const addQuickDose = () => {
    const amount = Number(quickAmount);
    if (!Number.isFinite(amount) || amount <= 0 || !quickTime) return;

    onChange({
      ...scenario,
      doses: [
        ...scenario.doses,
        {
          id: crypto.randomUUID(),
          amountMg: toMg(amount, scenario.displayUnit),
          time: quickTime,
        },
      ],
    });
    setQuickAmount('');
    setQuickTime(getLocalDateTimeInputValue());
  };

  return (
    <section className="card dashboard-card" aria-labelledby={`dash-${scenario.id}`}>
      <header className="card-header dashboard-header">
        <div className="scenario-title-row">
          <span className="color-dot" style={{ background: scenario.color }} aria-hidden="true" />
          <h2 id={`dash-${scenario.id}`}>{scenario.name}</h2>
        </div>
        <div className="headline-value">
          {formatMass(current.centralMg, scenario.displayUnit, 4)}
        </div>
      </header>

      <div className="card-body">
        <div className="notice">
          <strong>Estado atual:</strong> {phase}
        </div>

        <div className="metric-grid">
          <Metric
            label="No organismo"
            value={`${current.centralPercent.toFixed(1)}%`}
            detail={formatMass(current.centralMg, scenario.displayUnit, 3)}
          />
          <Metric
            label="Ainda não absorvido"
            value={`${current.depotPercent.toFixed(1)}%`}
            detail={formatMass(current.depotMg, scenario.displayUnit, 3)}
          />
          <Metric
            label="Eliminado"
            value={`${current.eliminatedPercent.toFixed(1)}%`}
            detail={formatMass(current.eliminatedMg, scenario.displayUnit, 3)}
          />
          <Metric
            label="Doses"
            value={`${current.administeredCount} / ${current.plannedCount}`}
            detail="administradas / planejadas"
          />
          <Metric
            label="Pico projetado"
            value={formatMass(analysis.projectedPeakMg, scenario.displayUnit, 3)}
            detail={formatDateTime(analysis.projectedPeakTimeMs)}
          />
          <Metric
            label="Horizonte calculado"
            value={formatDuration(analysis.horizonEndMs - analysis.lastDoseTimeMs)}
            detail="após a última dose"
          />
        </div>

        <div className="table-wrap">
          <table>
            <caption>Descida final abaixo de cada percentual do pico projetado</caption>
            <thead>
              <tr>
                <th>Marco</th>
                <th>Quantidade</th>
                <th>Data/hora estimada</th>
              </tr>
            </thead>
            <tbody>
              {analysis.milestones.map((milestone) => (
                <tr key={milestone.percentage}>
                  <td>{milestone.percentage}%</td>
                  <td>{formatMass(milestone.targetMg, scenario.displayUnit, 3)}</td>
                  <td>{formatDateTime(milestone.timeMs)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="quick-dose">
          <h3>Registrar nova dose</h3>
          <div className="quick-dose-grid">
            <div>
              <label htmlFor={`quick-amount-${scenario.id}`}>
                Quantidade ({scenario.displayUnit})
              </label>
              <input
                id={`quick-amount-${scenario.id}`}
                type="number"
                min="0.000001"
                step="any"
                value={quickAmount}
                onChange={(event) => setQuickAmount(event.target.value)}
              />
            </div>
            <div>
              <label htmlFor={`quick-time-${scenario.id}`}>Data e hora</label>
              <input
                id={`quick-time-${scenario.id}`}
                type="datetime-local"
                value={quickTime}
                onChange={(event) => setQuickTime(event.target.value)}
              />
            </div>
            <button
              type="button"
              className="primary"
              disabled={!quickAmount || !quickTime}
              onClick={addQuickDose}
            >
              Incluir
            </button>
          </div>
          <p className="field-hint">
            Uma dose futura é tratada como planejamento e não altera os percentuais do estado atual.
          </p>
        </div>

        {analysis.kaPerMs !== null && (
          <details className="model-details">
            <summary>Detalhes do modelo</summary>
            <p>
              Modelo de um compartimento, absorção e eliminação de primeira ordem. O Tmax informado
              é usado para inferir ka; a meia-vida informa ke. A quantidade exibida é uma estimativa
              relativa de massa no compartimento sistêmico, assumindo biodisponibilidade F=1.
            </p>
          </details>
        )}

        {scenario.doses.some((dose) => dose.amountMg !== null) && (
          <p className="sr-only">
            Unidade atual de exibição: {scenario.displayUnit}. Exemplo da primeira dose:
            {scenario.doses[0].amountMg === null
              ? 'não informada'
              : fromMg(scenario.doses[0].amountMg, scenario.displayUnit)}
          </p>
        )}
      </div>
    </section>
  );
}

function Metric({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="metric">
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{detail}</small>
    </div>
  );
}
