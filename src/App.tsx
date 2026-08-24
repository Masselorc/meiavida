import { useEffect, useMemo, useState } from 'react';
import type { Scenario, ScenarioAnalysis } from './types';
import { analyzeScenario, validateScenario } from './domain/pharmacokinetics';
import { createScenario } from './domain/scenarios';
import { useClock } from './hooks/useClock';
import { ScenarioForm } from './components/ScenarioForm';
import { DecayChart } from './components/DecayChart';
import { ScenarioDashboard } from './components/ScenarioDashboard';
import { DataControls, isValidScenarioArray } from './components/DataControls';

const STORAGE_KEY = 'meiavida:v2:data';
const CONSENT_KEY = 'meiavida:v2:persistence-enabled';

export default function App() {
  const [isRunning, setIsRunning] = useState(false);
  const [scenarios, setScenarios] = useState<Scenario[]>(() => loadInitialScenarios());
  const [errors, setErrors] = useState<string[]>([]);
  const [persistenceEnabled, setPersistenceEnabled] = useState(
    () => localStorage.getItem(CONSENT_KEY) === 'true',
  );
  const now = useClock(isRunning, 1_000);

  useEffect(() => {
    if (!persistenceEnabled) return;
    localStorage.setItem(CONSENT_KEY, 'true');
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ schemaVersion: 2, scenarios }));
  }, [persistenceEnabled, scenarios]);

  const analyses = useMemo(() => {
    if (!isRunning) return new Map<string, ScenarioAnalysis>();
    return new Map(
      scenarios.map((scenario) => [scenario.id, analyzeScenario(scenario)] as const),
    );
  }, [isRunning, scenarios]);

  const startAnalysis = () => {
    const nextErrors = scenarios.flatMap((scenario) =>
      validateScenario(scenario).map((error) => `${scenario.name || 'Cenário'}: ${error}`),
    );
    setErrors(nextErrors);
    if (nextErrors.length === 0) setIsRunning(true);
  };

  const updateScenario = (updated: Scenario) => {
    setScenarios((current) =>
      current.map((scenario) => (scenario.id === updated.id ? updated : scenario)),
    );
  };

  const changePersistence = (enabled: boolean) => {
    setPersistenceEnabled(enabled);
    if (!enabled) {
      localStorage.removeItem(CONSENT_KEY);
      localStorage.removeItem(STORAGE_KEY);
    }
  };

  return (
    <main className="app-shell">
      <div className="container">
        <header className="app-header">
          <div>
            <p className="eyebrow">Simulador educacional</p>
            <h1>Comparador de Meia-vida</h1>
            <p className="muted">
              Modelo de um compartimento para estimar absorção, eliminação, acúmulo e projeções de
              múltiplas doses. Não substitui avaliação clínica, prescrição ou monitorização laboratorial.
            </p>
          </div>
          {isRunning && (
            <button type="button" className="secondary" onClick={() => setIsRunning(false)}>
              Editar cenários
            </button>
          )}
        </header>

        <DataControls
          persistenceEnabled={persistenceEnabled}
          onPersistenceChange={changePersistence}
          scenarios={scenarios}
          onImport={(imported) => {
            setScenarios(imported);
            setIsRunning(false);
            setErrors([]);
          }}
        />

        {errors.length > 0 && (
          <div className="error-box" role="alert">
            <strong>Revise os dados:</strong>
            <ul>
              {errors.map((error) => (
                <li key={error}>{error}</li>
              ))}
            </ul>
          </div>
        )}

        {!isRunning ? (
          <>
            <div className="scenario-grid">
              {scenarios.map((scenario) => (
                <ScenarioForm
                  key={scenario.id}
                  scenario={scenario}
                  canRemove={scenarios.length > 1}
                  onChange={updateScenario}
                  onRemove={() =>
                    setScenarios((current) =>
                      current.filter((item) => item.id !== scenario.id),
                    )
                  }
                />
              ))}

              <button
                type="button"
                className="add-scenario"
                onClick={() =>
                  setScenarios((current) => [...current, createScenario(current.length)])
                }
              >
                <span aria-hidden="true">＋</span>
                <strong>Adicionar cenário comparativo</strong>
                <small>Compare doses ou substâncias diferentes.</small>
              </button>
            </div>

            <button type="button" className="primary start-button" onClick={startAnalysis}>
              Iniciar análise comparativa
            </button>
          </>
        ) : (
          <>
            <DecayChart
              items={scenarios.map((scenario) => ({
                scenario,
                analysis: analyses.get(scenario.id) as ScenarioAnalysis,
              }))}
              now={now}
            />

            <div className="dashboard-grid">
              {scenarios.map((scenario) => (
                <ScenarioDashboard
                  key={scenario.id}
                  scenario={scenario}
                  analysis={analyses.get(scenario.id) as ScenarioAnalysis}
                  now={now}
                  onChange={updateScenario}
                />
              ))}
            </div>
          </>
        )}

        <footer className="app-footer">
          <p>
            Premissas: biodisponibilidade relativa F=1; um compartimento; eliminação de primeira
            ordem; absorção instantânea quando Tmax=0 e de primeira ordem quando Tmax&gt;0.
          </p>
        </footer>
      </div>
    </main>
  );
}

function loadInitialScenarios(): Scenario[] {
  const enabled = localStorage.getItem(CONSENT_KEY) === 'true';
  if (!enabled) return [createScenario(0)];

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [createScenario(0)];
    const parsed = JSON.parse(raw) as { schemaVersion?: number; scenarios?: unknown };
    if (parsed.schemaVersion === 2 && isValidScenarioArray(parsed.scenarios)) {
      return parsed.scenarios;
    }
  } catch {
    localStorage.removeItem(STORAGE_KEY);
  }

  return [createScenario(0)];
}
