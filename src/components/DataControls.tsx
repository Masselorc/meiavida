import { useRef, useState } from 'react';
import type { Scenario } from '../types';

interface Props {
  persistenceEnabled: boolean;
  onPersistenceChange: (enabled: boolean) => void;
  scenarios: Scenario[];
  onImport: (scenarios: Scenario[]) => void;
}

export function DataControls({
  persistenceEnabled,
  onPersistenceChange,
  scenarios,
  onImport,
}: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [importError, setImportError] = useState<string | null>(null);

  const exportData = () => {
    const payload = JSON.stringify(
      {
        schemaVersion: 2,
        exportedAt: new Date().toISOString(),
        scenarios,
      },
      null,
      2,
    );
    const blob = new Blob([payload], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `meiavida-${new Date().toISOString().slice(0, 10)}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const importData = async (file: File) => {
    const parsed: unknown = JSON.parse(await file.text());
    if (!isValidExport(parsed)) {
      throw new Error('Arquivo inválido ou incompatível.');
    }
    onImport(parsed.scenarios);
  };

  return (
    <section className="data-controls" aria-label="Privacidade e dados">
      <label className="toggle-row">
        <input
          type="checkbox"
          checked={persistenceEnabled}
          onChange={(event) => onPersistenceChange(event.target.checked)}
        />
        <span>
          <strong>Salvar localmente neste dispositivo</strong>
          <small>Desativado por padrão. Nenhum dado é enviado para servidor.</small>
        </span>
      </label>
      <div>
        <div className="button-row">
          <button type="button" className="secondary" onClick={exportData}>
            Exportar JSON
          </button>
          <button
            type="button"
            className="secondary"
            onClick={() => {
              setImportError(null);
              fileRef.current?.click();
            }}
          >
            Importar JSON
          </button>
          <input
            className="sr-only"
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            onChange={async (event) => {
              const file = event.target.files?.[0];
              if (!file) return;
              try {
                await importData(file);
                setImportError(null);
              } catch (error) {
                setImportError(
                  error instanceof Error ? error.message : 'Falha ao importar.',
                );
              } finally {
                event.target.value = '';
              }
            }}
          />
        </div>
        {importError && (
          <p className="import-error" role="alert">
            {importError}
          </p>
        )}
      </div>
    </section>
  );
}

function isValidExport(
  value: unknown,
): value is { schemaVersion: 2; scenarios: Scenario[] } {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as { schemaVersion?: unknown; scenarios?: unknown };
  return candidate.schemaVersion === 2 && isValidScenarioArray(candidate.scenarios);
}

function isFiniteNumberOrNull(value: unknown): value is number | null {
  return value === null || (typeof value === 'number' && Number.isFinite(value));
}

export function isValidScenarioArray(value: unknown): value is Scenario[] {
  if (!Array.isArray(value) || value.length === 0) return false;

  const validTimeUnits = new Set(['minutes', 'hours', 'days']);
  const validMassUnits = new Set(['mcg', 'mg', 'g']);

  return value.every((candidate) => {
    if (typeof candidate !== 'object' || candidate === null) return false;
    const scenario = candidate as Partial<Scenario>;

    if (
      typeof scenario.id !== 'string' ||
      typeof scenario.name !== 'string' ||
      typeof scenario.color !== 'string' ||
      !isFiniteNumberOrNull(scenario.halfLifeValue) ||
      !validTimeUnits.has(String(scenario.halfLifeUnit)) ||
      !isFiniteNumberOrNull(scenario.tmaxValue) ||
      !validTimeUnits.has(String(scenario.tmaxUnit)) ||
      !validMassUnits.has(String(scenario.displayUnit)) ||
      !Array.isArray(scenario.doses) ||
      scenario.doses.length === 0
    ) {
      return false;
    }

    return scenario.doses.every((dose) => {
      if (typeof dose !== 'object' || dose === null) return false;
      const item = dose as { id?: unknown; amountMg?: unknown; time?: unknown };
      return (
        typeof item.id === 'string' &&
        isFiniteNumberOrNull(item.amountMg) &&
        typeof item.time === 'string'
      );
    });
  });
}
