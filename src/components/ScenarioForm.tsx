import type { MassUnit, Scenario, TimeUnit } from '../types';
import { fromMg, toMg } from '../domain/units';
import { getLocalDateTimeInputValue } from '../utils/dates';

interface Props {
  scenario: Scenario;
  canRemove: boolean;
  onChange: (scenario: Scenario) => void;
  onRemove: () => void;
}

const timeUnits: Array<{ value: TimeUnit; label: string }> = [
  { value: 'minutes', label: 'Min.' },
  { value: 'hours', label: 'Horas' },
  { value: 'days', label: 'Dias' },
];

const massUnits: MassUnit[] = ['mcg', 'mg', 'g'];

export function ScenarioForm({ scenario, canRemove, onChange, onRemove }: Props) {
  const update = <K extends keyof Scenario>(field: K, value: Scenario[K]) => {
    onChange({ ...scenario, [field]: value });
  };

  return (
    <section
      className="card scenario-card"
      aria-labelledby={`scenario-name-${scenario.id}`}
    >
      <header className="card-header">
        <div className="scenario-title-row">
          <span className="color-dot" style={{ background: scenario.color }} aria-hidden="true" />
          <label className="sr-only" htmlFor={`scenario-name-${scenario.id}`}>
            Nome do cenário
          </label>
          <input
            id={`scenario-name-${scenario.id}`}
            className="scenario-name"
            value={scenario.name}
            onChange={(event) => update('name', event.target.value)}
            required
          />
        </div>
        {canRemove && (
          <button
            type="button"
            className="icon-button danger"
            onClick={onRemove}
            aria-label={`Remover cenário ${scenario.name}`}
          >
            ×
          </button>
        )}
      </header>

      <div className="card-body form-grid">
        <FieldGroup
          id={`half-life-${scenario.id}`}
          label="Tempo de meia-vida"
          value={scenario.halfLifeValue}
          min={0.000001}
          onValue={(value) => update('halfLifeValue', value)}
          unit={scenario.halfLifeUnit}
          onUnit={(value) => update('halfLifeUnit', value)}
        />

        <FieldGroup
          id={`tmax-${scenario.id}`}
          label="Tmax — tempo até o pico"
          hint="0 = absorção instantânea"
          value={scenario.tmaxValue}
          min={0}
          onValue={(value) => update('tmaxValue', value)}
          unit={scenario.tmaxUnit}
          onUnit={(value) => update('tmaxUnit', value)}
        />

        <div className="full-width">
          <div className="row-between">
            <div>
              <strong>Doses</strong>
              <p className="field-hint">Quantidades são normalizadas internamente em mg.</p>
            </div>
            <label>
              <span className="sr-only">Unidade de exibição</span>
              <select
                value={scenario.displayUnit}
                onChange={(event) => update('displayUnit', event.target.value as MassUnit)}
              >
                {massUnits.map((unit) => (
                  <option key={unit} value={unit}>
                    {unit}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="dose-list">
            {scenario.doses.map((dose, index) => {
              const amountForDisplay =
                dose.amountMg === null ? '' : fromMg(dose.amountMg, scenario.displayUnit);

              return (
                <div className="dose-row" key={dose.id}>
                  <div>
                    <label htmlFor={`dose-amount-${dose.id}`}>
                      Dose {index + 1} ({scenario.displayUnit})
                    </label>
                    <input
                      id={`dose-amount-${dose.id}`}
                      type="number"
                      min="0.000001"
                      step="any"
                      value={amountForDisplay}
                      onChange={(event) => {
                        const raw = event.target.value;
                        const amountMg =
                          raw === '' ? null : toMg(Number(raw), scenario.displayUnit);
                        update(
                          'doses',
                          scenario.doses.map((item) =>
                            item.id === dose.id ? { ...item, amountMg } : item,
                          ),
                        );
                      }}
                      required
                    />
                  </div>

                  <div>
                    <label htmlFor={`dose-time-${dose.id}`}>Data e hora</label>
                    <input
                      id={`dose-time-${dose.id}`}
                      type="datetime-local"
                      value={dose.time}
                      onChange={(event) =>
                        update(
                          'doses',
                          scenario.doses.map((item) =>
                            item.id === dose.id ? { ...item, time: event.target.value } : item,
                          ),
                        )
                      }
                      required
                    />
                  </div>

                  <button
                    type="button"
                    className="secondary compact"
                    onClick={() =>
                      update(
                        'doses',
                        scenario.doses.map((item) =>
                          item.id === dose.id
                            ? { ...item, time: getLocalDateTimeInputValue() }
                            : item,
                        ),
                      )
                    }
                  >
                    Agora
                  </button>

                  <button
                    type="button"
                    className="icon-button danger"
                    aria-label={`Remover dose ${index + 1}`}
                    disabled={scenario.doses.length === 1}
                    onClick={() =>
                      update(
                        'doses',
                        scenario.doses.filter((item) => item.id !== dose.id),
                      )
                    }
                  >
                    ×
                  </button>
                </div>
              );
            })}
          </div>

          <button
            type="button"
            className="secondary"
            onClick={() =>
              update('doses', [
                ...scenario.doses,
                {
                  id: crypto.randomUUID(),
                  amountMg: null,
                  time: getLocalDateTimeInputValue(),
                },
              ])
            }
          >
            + Adicionar dose
          </button>
        </div>
      </div>
    </section>
  );
}

interface FieldGroupProps {
  id: string;
  label: string;
  hint?: string;
  value: number | null;
  min: number;
  onValue: (value: number | null) => void;
  unit: TimeUnit;
  onUnit: (unit: TimeUnit) => void;
}

function FieldGroup({
  id,
  label,
  hint,
  value,
  min,
  onValue,
  unit,
  onUnit,
}: FieldGroupProps) {
  return (
    <div className="field-group">
      <label htmlFor={id}>{label}</label>
      {hint && <span className="field-hint">{hint}</span>}
      <div className="input-pair">
        <input
          id={id}
          type="number"
          min={min}
          step="any"
          value={value ?? ''}
          onChange={(event) =>
            onValue(event.target.value === '' ? null : Number(event.target.value))
          }
          required
        />
        <select
          aria-label={`Unidade de ${label}`}
          value={unit}
          onChange={(event) => onUnit(event.target.value as TimeUnit)}
        >
          {timeUnits.map((item) => (
            <option value={item.value} key={item.value}>
              {item.label}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
