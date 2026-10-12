// Catálogo de modelos. Tudo que a interface mostra sobre um modelo vem daqui.
// `fallbacks`: o modelo aceita o parâmetro server-side `fallbacks: "default"`.
// `webSearch`: o modelo aceita a ferramenta web_search_20260209.

export const MODELS = [
  {
    id: 'claude-opus-5-5',
    label: 'Claude Opus 5.5',
    tagline: 'O padrão: raciocínio forte para quase tudo',
    tier: 'equilibrado',
    fallbacks: true,
    webSearch: true,
  },
  {
    id: 'claude-fable-5-1',
    label: 'Claude Fable 5.1',
    tagline: 'O mais capaz, para os problemas mais difíceis',
    tier: 'máximo',
    fallbacks: true,
    webSearch: false,
  },
  {
    id: 'claude-sonnet-5-5',
    label: 'Claude Sonnet 5.5',
    tagline: 'Rápido e capaz para o dia a dia',
    tier: 'rápido',
    fallbacks: true,
    webSearch: true,
  },
  {
    id: 'claude-haiku-5-5',
    label: 'Claude Haiku 5.5',
    tagline: 'O mais rápido e econômico',
    tier: 'econômico',
    fallbacks: false,
    webSearch: false,
  },
];

export const DEFAULT_MODEL = 'claude-opus-5-5';
export const TITLE_MODEL = 'claude-haiku-5-5';

export function findModel(id) {
  return MODELS.find((m) => m.id === id) || null;
}
