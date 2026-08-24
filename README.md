# Comparador de Meia-vida

Aplicação web educacional para comparar curvas de múltiplas doses usando um modelo farmacocinético de um compartimento.

## Modelo matemático

- Eliminação de primeira ordem: `ke = ln(2) / meia-vida`.
- `Tmax = 0`: absorção instantânea seguida de eliminação exponencial.
- `Tmax > 0`: absorção e eliminação de primeira ordem (função de Bateman).
- `ka` é inferido numericamente a partir de `ke` e `Tmax` pela relação:
  `Tmax = ln(ka/ke) / (ka - ke)`.
- Para múltiplas doses, as contribuições são somadas.
- O pico global é localizado sobre a curva total.
- Marcos de 50%, 25%, 12,5%, 10%, 5%, 1% e 0,1% representam a **descida final** abaixo de cada percentual do pico projetado e são obtidos por busca numérica.

### Limitações

O simulador assume biodisponibilidade relativa `F=1`, um único compartimento e cinética linear de primeira ordem. Não modela variabilidade individual, volume de distribuição real, clearance não linear, metabólitos ativos, ligação proteica, função renal/hepática, interações medicamentosas ou formulações complexas. Não deve ser usado para prescrição, ajuste de dose ou decisões clínicas.

## Privacidade

A aplicação é totalmente cliente-side e não possui backend. A persistência local fica **desativada por padrão**. Quando o usuário habilita "Salvar localmente neste dispositivo", os cenários são armazenados no `localStorage` do navegador. Também é possível exportar/importar JSON.

## Desenvolvimento

```bash
npm install
npm run check
npm run dev
```

## Build

```bash
npm run build
```

O artefato estático é gerado em `dist/`.

## Deploy

O workflow `pages.yml` publica `dist/` no GitHub Pages. O `base` do Vite está configurado como `/meiavida/`.
