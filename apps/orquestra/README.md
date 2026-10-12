# Orquestra

Todos os modelos Claude, especialistas e biblioteca de prompts em uma só tela.
Feito com o Replica pack a partir das funcionalidades públicas do Adapta ONE
(clean room: nada de código, textos, marca ou imagens do original).

## Rodar

```bash
cd apps/orquestra
npm install
export ANTHROPIC_API_KEY=sk-ant-...   # sem a chave, abre em modo demonstração
npm start                              # http://localhost:3000
```

`PORT` muda a porta. Node 18 ou mais novo.

## O que tem

- **Chat em streaming** com Claude Opus 5.5 (padrão), Fable 5.1, Sonnet 5.5 e Haiku 5.5. Troque de modelo a qualquer momento.
- **Especialistas**: crie agentes com instruções, modelo, base de conhecimento (PDF, DOCX, imagens, texto) e sugestões de início. Abas Descobrir, Meus e Curadoria, com busca e avaliação.
- **Biblioteca de prompts** por categoria, com campos `[entre colchetes]` já selecionados para preencher. Salve os seus.
- **Contextos**: textos fixos (sua empresa, seu público) que entram em todas as conversas enquanto estiverem ligados.
- **Anexos**: PDF, imagens e arquivos de texto, por botão, arrastar ou colar.
- **Web**: pesquisa na web com as fontes como links (Opus 5.5 e Sonnet 5.5).
- **Raciocínio**: o modelo pensa mais e mostra um resumo do raciocínio.
- **Imagem**: ilustrações vetoriais em 1:1, 16:9, 9:16 ou 4:3, para baixar em SVG.
- **Menu `/`**: comandos, prompts e especialistas pelo teclado.
- **Histórico** agrupado por data, com busca, fixar, renomear e excluir. Títulos gerados pelo Haiku.
- **Importar do ChatGPT** (`conversations.json`), backup completo em JSON e download da conversa em Markdown.
- Ditado por voz, tema claro e escuro, layout mobile, atalhos (Ctrl+Shift+O nova conversa, Ctrl+K buscar, Esc para a resposta).

## Como funciona

```
public/          interface (HTML, CSS com tokens, módulos ES, sem build)
  js/app.js      telas e estado
  js/markdown.js Markdown seguro (escapa tudo antes)
  js/importers.js importação do ChatGPT, backup, agrupamento do histórico
  js/files.js    leitura de anexos e extração de .docx
  js/store.js    IndexedDB
server.js        estáticos + /api/config, /api/chat (SSE), /api/title, /api/image
lib/prompt.js    monta o pedido da Messages API (anexos, especialista, contextos, opções)
lib/claude.js    SDK oficial da Anthropic, streaming, pesquisa web, recusas
lib/demo.js      respostas de exemplo quando não há chave
replica/         recon, matriz de funcionalidades, arquitetura, marca, build log
```

Conversas, especialistas, prompts e contextos ficam **no navegador** (IndexedDB).
Não há contas: quem acessar o servidor usa a sua chave. Para colocar na internet,
ponha autenticação na frente (um proxy com login, por exemplo).

## Testes

```bash
npm test                                                  # 26 testes: servidor, pedido, Markdown, importação
python3 ../../replica-diff/parity.py replica/features.csv # paridade: 82,1
python3 ../../replica-brand/sweep.py . --config replica/brand.json
```

## O que falta para lançar

- Contas e login, e sincronização entre aparelhos (hoje é local + backup).
- Planos e pagamento.
- Outros fornecedores de modelos (a interface já lê o catálogo de `lib/models.js`).
- Imagens fotográficas (hoje são ilustrações SVG).
- As checagens de marca em `replica/brand.md`.
