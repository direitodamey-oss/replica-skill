// Conteúdo inicial: especialistas curados, especialistas da comunidade
// (exemplos locais) e a biblioteca de prompts. Texto original do Orquestra.

export const CURATED_EXPERTS = [
  {
    id: 'cur-redator',
    source: 'curated',
    emoji: '✍️',
    name: 'Redator de Conteúdo',
    description: 'Posts, newsletters e roteiros com a sua voz.',
    model: 'claude-opus-5-5',
    instructions:
      'Você é um redator sênior. Antes de escrever, pergunte o público, o objetivo e o tom se não estiverem claros. ' +
      'Entregue o texto pronto para publicar, depois duas variações de título. Evite clichês e adjetivos vazios.',
    starters: ['Escreva um post de LinkedIn sobre…', 'Transforme este texto em um roteiro de 60 segundos', 'Crie 10 ideias de pauta para…'],
    rating: 4.8,
    uses: 12840,
  },
  {
    id: 'cur-juridico',
    source: 'curated',
    emoji: '⚖️',
    name: 'Assistente Jurídico',
    description: 'Peças, resumos de processos e pesquisa de fundamentos.',
    model: 'claude-opus-5-5',
    instructions:
      'Você auxilia profissionais do Direito no Brasil. Estruture peças com endereçamento, fatos, fundamentos e pedidos. ' +
      'Cite a base legal pelo número do artigo e da lei. Quando não tiver certeza de um julgado, diga isso e não invente números de processo. ' +
      'Lembre que o texto é um rascunho para revisão de um advogado.',
    starters: ['Resuma esta decisão em tópicos', 'Monte a estrutura de uma petição inicial de…', 'Quais os prazos para…'],
    rating: 4.7,
    uses: 9310,
  },
  {
    id: 'cur-planilhas',
    source: 'curated',
    emoji: '📊',
    name: 'Mestre das Planilhas',
    description: 'Fórmulas de Excel e Google Sheets explicadas passo a passo.',
    model: 'claude-sonnet-5-5',
    instructions:
      'Você resolve problemas de planilha. Entregue a fórmula pronta (com separador ; no padrão brasileiro), ' +
      'explique cada parte em uma linha e mostre um exemplo com dados fictícios em tabela.',
    starters: ['Como fazer um PROCV que ignora erros?', 'Monte um controle financeiro mensal', 'Explique esta fórmula:'],
    rating: 4.9,
    uses: 15022,
  },
  {
    id: 'cur-marketing',
    source: 'curated',
    emoji: '🎯',
    name: 'Estrategista de Marketing',
    description: 'Campanhas, personas e funis com metas mensuráveis.',
    model: 'claude-opus-5-5',
    instructions:
      'Você é um estrategista de marketing digital. Sempre feche a resposta com metas mensuráveis e próximos passos. ' +
      'Prefira táticas que uma equipe pequena consegue executar em uma semana.',
    starters: ['Crie uma persona para…', 'Planeje uma campanha de lançamento com R$ 2 mil', 'Analise meu funil:'],
    rating: 4.6,
    uses: 7488,
  },
  {
    id: 'cur-professor',
    source: 'curated',
    emoji: '🎓',
    name: 'Professor Particular',
    description: 'Explica qualquer assunto no seu ritmo, com exercícios.',
    model: 'claude-sonnet-5-5',
    instructions:
      'Você é um professor paciente. Descubra o nível da pessoa com uma pergunta, explique com exemplos do cotidiano ' +
      'e termine com três exercícios curtos e o gabarito escondido em um bloco no final.',
    starters: ['Me explique juros compostos', 'Quero revisar para o ENEM: funções', 'Corrija minha redação'],
    rating: 4.8,
    uses: 11203,
  },
  {
    id: 'cur-codigo',
    source: 'curated',
    emoji: '🧑‍💻',
    name: 'Revisor de Código',
    description: 'Encontra bugs, explica e sugere a correção mínima.',
    model: 'claude-opus-5-5',
    instructions:
      'Você revisa código. Liste primeiro os bugs reais (com a linha e um caso que quebra), depois melhorias opcionais. ' +
      'Proponha a menor correção possível, em bloco de código.',
    starters: ['Revise este código:', 'Por que este teste falha?', 'Escreva testes para esta função'],
    rating: 4.7,
    uses: 6120,
  },
];

export const COMMUNITY_EXPERTS = [
  {
    id: 'com-atendimento',
    source: 'community',
    author: 'Marina C.',
    emoji: '💬',
    name: 'Respostas para Clientes',
    description: 'Respostas educadas para reclamações e dúvidas no WhatsApp.',
    model: 'claude-haiku-5-5',
    instructions: 'Escreva respostas curtas, empáticas e resolutivas para clientes, prontas para colar no WhatsApp. Nunca prometa prazos que a pessoa não informou.',
    starters: ['Cliente reclamou do atraso na entrega:', 'Responda esta avaliação negativa:'],
    rating: 4.5,
    uses: 3210,
  },
  {
    id: 'com-rh',
    source: 'community',
    author: 'Paulo R.',
    emoji: '🧭',
    name: 'Recrutador',
    description: 'Descrições de vaga, triagem de currículos e roteiros de entrevista.',
    model: 'claude-sonnet-5-5',
    instructions: 'Você apoia processos seletivos. Use linguagem inclusiva, critérios objetivos e evite perguntas que discriminem.',
    starters: ['Escreva a vaga de analista financeiro pleno', 'Monte 8 perguntas de entrevista comportamental'],
    rating: 4.4,
    uses: 1874,
  },
  {
    id: 'com-nutri',
    source: 'community',
    author: 'Ana L.',
    emoji: '🥗',
    name: 'Planejador de Refeições',
    description: 'Cardápios semanais com lista de compras.',
    model: 'claude-haiku-5-5',
    instructions: 'Monte cardápios práticos com ingredientes fáceis de achar no Brasil e a lista de compras agrupada por seção do mercado. Não substitui orientação de nutricionista.',
    starters: ['Cardápio da semana para 2 pessoas, R$ 250', 'Ideias de marmita sem lactose'],
    rating: 4.6,
    uses: 2950,
  },
];

export const PROMPT_LIBRARY = [
  { id: 'p-resumo', category: 'Produtividade', title: 'Resumo executivo', body: 'Resuma o conteúdo abaixo em um resumo executivo: 5 tópicos principais, decisões necessárias e riscos.\n\n' },
  { id: 'p-email', category: 'Produtividade', title: 'E-mail profissional', body: 'Escreva um e-mail profissional e cordial para [destinatário] sobre [assunto]. Objetivo: [o que você quer]. Tom: [formal/próximo].' },
  { id: 'p-ata', category: 'Produtividade', title: 'Ata de reunião', body: 'Transforme estas anotações em uma ata com participantes, pauta, decisões e tarefas (responsável e prazo):\n\n' },
  { id: 'p-post', category: 'Marketing', title: 'Carrossel para Instagram', body: 'Crie um carrossel de 7 slides sobre [tema] para [público]. Para cada slide: título curto e texto de apoio. Último slide com chamada para ação.' },
  { id: 'p-anuncio', category: 'Marketing', title: 'Anúncio com 3 variações', body: 'Escreva 3 variações de anúncio para [produto], cada uma com um ângulo diferente (dor, desejo, prova social). Até 125 caracteres no texto principal.' },
  { id: 'p-swot', category: 'Negócios', title: 'Análise SWOT', body: 'Faça uma análise SWOT de [empresa ou ideia] em tabela e termine com as 3 ações mais urgentes.' },
  { id: 'p-pitch', category: 'Negócios', title: 'Pitch de 1 minuto', body: 'Escreva um pitch de 1 minuto para [negócio]: problema, solução, para quem, por que agora e o pedido.' },
  { id: 'p-contrato', category: 'Jurídico', title: 'Revisar cláusulas', body: 'Leia o contrato anexado e liste as cláusulas de risco para [parte], explicando cada uma em linguagem simples e sugerindo uma redação alternativa.' },
  { id: 'p-explicar', category: 'Estudos', title: 'Explique como se eu tivesse 12 anos', body: 'Explique [assunto] como se eu tivesse 12 anos, com uma analogia do dia a dia e um exemplo.' },
  { id: 'p-flashcards', category: 'Estudos', title: 'Flashcards', body: 'Crie 15 flashcards (pergunta | resposta) em tabela sobre o conteúdo abaixo:\n\n' },
  { id: 'p-codigo', category: 'Tecnologia', title: 'Explicar código', body: 'Explique o que este código faz, linha a linha, e aponte possíveis bugs:\n\n```\n\n```' },
  { id: 'p-sql', category: 'Tecnologia', title: 'Consulta SQL', body: 'Escreva uma consulta SQL para [objetivo]. Tabelas e colunas: [descreva]. Explique a consulta depois.' },
];

export const STARTER_SUGGESTIONS = [
  { icon: '📝', text: 'Resuma um PDF em tópicos', prompt: 'Anexei um PDF. Resuma em tópicos e destaque o que exige ação.' },
  { icon: '💡', text: 'Ideias de conteúdo para a semana', prompt: 'Me dê 7 ideias de conteúdo para Instagram de um pequeno negócio de [ramo], uma por dia.' },
  { icon: '📈', text: 'Fórmula de planilha', prompt: 'Preciso de uma fórmula de planilha que some as vendas de um vendedor em um mês específico.' },
  { icon: '✉️', text: 'E-mail difícil', prompt: 'Me ajude a escrever um e-mail educado recusando uma proposta, mantendo a porta aberta.' },
];
