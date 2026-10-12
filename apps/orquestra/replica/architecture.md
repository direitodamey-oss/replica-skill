# Arquitetura

Stack, uma linha cada:

- **Servidor**: Node 18+ com `http` puro. Quatro rotas, nenhum framework para manter.
- **IA**: SDK oficial `@anthropic-ai/sdk`, Messages API com streaming.
- **Front**: HTML, CSS com tokens e módulos ES sem build. Abre em qualquer navegador moderno.
- **Dados**: IndexedDB no navegador. Sem banco: nada a hospedar além do servidor.
- **Testes**: `node --test` para servidor e funções puras; Playwright para o smoke de interface.

## Rotas

| método e rota | o que faz | entrada | saída | fluxo |
| --- | --- | --- | --- | --- |
| GET /api/config | modelos e se está em modo demonstração | - | JSON | todos |
| POST /api/chat | conversa em streaming | modelo, mensagens, anexos, especialista, contextos, opções | SSE: text, thinking, source, status, notice, error, done | F01-F06 |
| POST /api/title | título curto para a conversa | primeira mensagem | JSON | F01 |
| POST /api/image | ilustração SVG | descrição, proporção, modelo | JSON {svg} | F07 |

## Pedido para a API

- Modelo padrão `claude-opus-5-5`; esforço `low` para chat, `high` com Raciocínio.
- Raciocínio: `thinking: {type: "adaptive", display: "summarized"}`.
- Web: ferramenta `web_search_20260209` (Opus 5.5 e Sonnet 5.5); `pause_turn` é continuado até 3 vezes.
- Recusas: `fallbacks: "default"` com o beta `server-side-fallback-2026-07-01` nos modelos que aceitam; `stop_reason: "refusal"` vira aviso na tela.
- Anexos: imagem e PDF em base64 como blocos `image`/`document`; texto como bloco de texto.
- Especialista: instruções e arquivos de texto no `system`; PDFs dele na primeira mensagem.

## Partes que mordem

- Anexos grandes: limite de 20 MB por arquivo no navegador e 30 MB por pedido no servidor.
- Armazenamento local: anexos ficam no IndexedDB; um backup em JSON leva tudo a outro aparelho.
- Imagens são SVG desenhados pelo modelo e exibidas via `<img>`, onde scripts não rodam.
- Markdown do modelo é escapado antes de virar HTML; links só http(s) e mailto.
- Sem contas: quem acessa o servidor usa a chave do servidor. Para expor na internet, coloque autenticação na frente.
