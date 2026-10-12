# Recon: Adapta ONE (web)

Escopo: o loop central do Adapta ONE, a plataforma brasileira que reúne vários
modelos de IA numa única interface de chat. Fatia escolhida: chat com troca de
modelo, especialistas (agentes personalizados), biblioteca de prompts e
contextos, anexos, pesquisa web, raciocínio avançado, geração de imagem,
histórico e importação do ChatGPT. Plataforma: web. Público: profissionais
brasileiros que querem "todas as IAs em um lugar".

Regras seguidas: só fontes públicas (documentação e notas de versão). Nenhum
código, imagem, texto ou endpoint privado do original foi usado. O domínio
docs.adapta.org não respondeu deste ambiente; os fatos abaixo vêm dos trechos
públicos indexados pelos buscadores, com o link de cada página.

## Fontes

| fonte | o que deu | url |
| --- | --- | --- |
| docs: Experts (EN) | abas Discover/Personal/Adapta, campos do criador, arquivos docx/pdf, "Chat Start" | https://docs.adapta.org/adapta-one/adapta-one-english/quick-start/experts |
| docs: Experts (PT) | boas práticas; redesenho da área | https://docs.adapta.org/inicio-rapido/experts |
| docs: interface | botão ao lado do envio com contextos, prompts, experts e upload; raciocínio, web, imagem, microfone | https://docs.adapta.org/inicio-rapido/markdown |
| docs: gerar imagens | acesso por botão ou "/", modelo e proporção nas configurações | https://docs.adapta.org/adapta-one/adapta-one-english/quick-start/generating-images |
| docs: modelos de imagem | comparação de modelos de imagem | https://docs.adapta.org/adapta-one/adapta-one-english/image-models |
| notas de versão 12/01/2026 | Experts redesenhados, criação mais simples | https://docs.adapta.org/release-notes-adapta-one-26/adapta-one-26/12-01-2026 |
| notas de versão 03/03/2026 | importar histórico do ChatGPT | https://docs.adapta.org/release-notes-adapta-one-26/adapta-one-26/03-03-2026 |
| notas de versão 10/06/2025 | sugestões de prompts iniciais | https://docs.adapta.org/release-notes-adapta-one-26/adapta-one/10-06-2025-sugestoes-de-prompts-iniciais-seu-ponto-de-partida-inteligente |
| docs: introdução | lista de modelos de texto de vários fornecedores | https://docs.adapta.org/inicio-rapido/introducao |

## Telas

| ID | tela | como chegar | propósito | componentes | estados |
| --- | --- | --- | --- | --- | --- |
| S01 | Chat (início) | abrir o app | começar uma conversa | seletor de modelo, sugestões, composer | vazio, com especialista ativo, mobile |
| S02 | Chat (conversa) | enviar mensagem | conversar com o modelo | mensagens, raciocínio, fontes, ações | streaming, erro, recusa, interrompido, longo |
| S03 | Barra lateral | sempre / menu no mobile | histórico e navegação | nova conversa, busca, grupos por data | vazio, busca sem resultado |
| S04 | Seletor de modelo | topo do chat | trocar de modelo | lista de modelos | aberto, selecionado |
| S05 | Especialistas | barra lateral ou "+" | descobrir e usar agentes | abas, busca, cartões, avaliação | vazio em "Meus" |
| S06 | Criar especialista | "Criar" | montar um agente | nome, ícone, descrição, instruções, modelo, arquivos, sugestões | novo, edição |
| S07 | Biblioteca de prompts | "+" ou "/" | reutilizar prompts | categorias, busca, lista | vazio |
| S08 | Contextos | "+" | informações fixas para a IA | lista com liga/desliga, formulário | vazio |
| S09 | Menu "/" | digitar / no composer | atalhos | comandos, prompts, especialistas | filtrado, vazio |
| S10 | Geração de imagem | botão Imagem ou /imagem | criar imagem | proporção, resultado, baixar | gerando, erro |
| S11 | Importar e exportar | barra lateral | trazer histórico do ChatGPT | seletor de arquivo | sucesso, arquivo inválido |

## Fluxos

```
F01 Perguntar algo a um modelo
    S01 -> digitar -> enviar -> S02 resposta em streaming
    cliques no caminho feliz: 1 (Enter)
    edge: rede cai no meio, modelo recusa, resposta cortada no limite

F02 Trocar de modelo
    S02 -> S04 -> escolher -> próxima mensagem usa o novo modelo
    edge: modelo sem pesquisa web desliga o botão Web

F03 Conversar com um especialista
    S03 -> S05 -> "Conversar" -> S01 com sugestões do especialista -> S02

F04 Criar um especialista com base de conhecimento
    S05 -> "Criar" -> S06 (instruções, modelo, PDF) -> salvar -> "Meus"
    edge: arquivo grande demais, tipo não suportado

F05 Usar um prompt da biblioteca
    S01 -> "/" -> S09 -> escolher -> campos [entre colchetes] selecionados -> enviar

F06 Anexar e analisar arquivo
    S01 -> "+" -> anexar PDF -> perguntar -> S02

F07 Gerar imagem
    S01 -> Imagem -> proporção -> descrever -> S10

F08 Importar histórico do ChatGPT
    S03 -> S11 -> conversations.json -> conversas aparecem no histórico
```

## Componentes

botão (primário, secundário, perigo), chip de alternância (Web, Raciocínio,
Imagem), popover/listbox (modelos, menu "+"), menu "/", diálogo modal, abas,
cartão de especialista com estrelas, item de lista, chip de arquivo, bolha de
mensagem, bloco de raciocínio recolhível, fontes como links, toast.

## Modelo de dados inferido

```
Conversation  id, title, model, expert_id?, pinned, created_at, updated_at
              evidência: histórico na lateral, importação do ChatGPT. confiança: alta
Message       id, conversation_id, role, text, attachments[], thinking?, sources[]
              evidência: S02. confiança: alta
Expert        id, owner, name, description, image, instructions, model, files[],
              starters[] ("Chat Start"), visibility, rating, uses
              evidência: docs Experts. confiança: alta para campos, média para rating/uses
Prompt        id, owner, title, category, body. evidência: docs interface. confiança: média
Context       id, owner, title, body, active. evidência: docs interface. confiança: média (palpite no "active")
```

## O que não dá para clonar

- Modelos de outros fornecedores sob a assinatura do original: o clone usa a
  própria chave do usuário. Esta versão fala só com a família Claude.
- A comunidade de usuários e os especialistas que eles publicaram.
- Conteúdo de cursos e eventos, a marca e os textos do original.

## Tamanho

11 telas, 8 fluxos, 5 entidades. Partes difíceis: streaming com ferramentas de
servidor, anexos binários grandes, contas e cobrança. Tamanho: M. O núcleo
(sem contas, sem pagamentos, armazenamento local) é S.
