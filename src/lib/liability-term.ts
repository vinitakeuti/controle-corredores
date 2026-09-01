export const LIABILITY_TERM_VERSION = "2026-09-01";

type LiabilityTermSection = {
  title: string;
  paragraphs: readonly string[];
  items?: readonly string[];
};

export const liabilityTermSections: readonly LiabilityTermSection[] = [
  {
    title: "1. Do objeto do termo",
    paragraphs: [
      "O presente Termo estabelece as condições de participação do(a) aluno(a) nas atividades de treinamento de corrida, treinos presenciais, atividades orientadas, eventos e demais experiências esportivas oferecidas pela Pace Lab.",
      "A participação nas atividades pressupõe o conhecimento e a concordância do(a) atleta com as orientações técnicas, normas de segurança e responsabilidades estabelecidas neste documento.",
      "A Assessoria tem como propósito proporcionar uma prática esportiva orientada, progressiva, segura e individualizada, respeitando as características, objetivos, histórico esportivo e nível de treinamento de cada atleta.",
    ],
  },
  {
    title: "2. Da condição de saúde e aptidão para a prática esportiva",
    paragraphs: [
      "O(A) atleta declara, sob sua responsabilidade, que possui condições físicas e de saúde compatíveis com a prática de corrida e que fornecerá à Assessoria informações verdadeiras e atualizadas sobre seu estado de saúde, histórico esportivo, lesões, limitações, uso de medicamentos e demais condições que possam interferir na prática esportiva.",
      "O(A) atleta compromete-se a informar à Assessoria, antes ou durante o período de treinamento, qualquer alteração relevante em sua condição física ou de saúde que possa modificar sua capacidade de realizar os treinos propostos.",
      "Recomenda-se que o(a) atleta mantenha acompanhamento médico periódico e, sempre que indicado, obtenha avaliação e liberação profissional para a prática esportiva, especialmente em situações de retorno após período de afastamento, presença de sintomas, lesões, condições clínicas ou aumento significativo da carga de treinamento.",
      "A Assessoria não realiza diagnóstico médico, tratamento clínico ou substituição da avaliação de profissionais da área da saúde.",
    ],
  },
  {
    title: "3. Da responsabilidade do(a) atleta",
    paragraphs: ["São responsabilidades do(a) atleta:"],
    items: [
      "Fornecer informações verdadeiras, completas e atualizadas à Assessoria.",
      "Seguir as orientações técnicas fornecidas pelos profissionais responsáveis pelo treinamento.",
      "Respeitar os limites individuais e comunicar imediatamente ao treinador qualquer dor, mal-estar, tontura, falta de ar incomum, alteração física ou outro sintoma que possa comprometer a continuidade da atividade.",
      "Evitar a realização de treinamento quando apresentar condição física incompatível com a atividade proposta, buscando orientação profissional quando necessário.",
      "Utilizar vestuário, calçados e equipamentos adequados à prática esportiva.",
      "Observar as orientações relativas à hidratação, alimentação, recuperação, descanso e demais recomendações relacionadas ao treinamento.",
      "Informar previamente sobre lesões, afastamentos, procedimentos médicos, alterações de medicação ou qualquer outra circunstância que possa interferir na realização dos treinos.",
      "Respeitar os demais atletas, treinadores, profissionais, espaços públicos e privados utilizados pela Assessoria.",
      "Cumprir as orientações de segurança durante treinos, provas, deslocamentos e demais atividades realizadas em grupo.",
      "Não alterar, por iniciativa própria, a carga, intensidade, volume ou frequência dos treinamentos de forma incompatível com a programação estabelecida, especialmente quando houver orientação expressa do treinador.",
    ],
  },
  {
    title: "4. Da individualização do treinamento",
    paragraphs: [
      "O(A) atleta reconhece que a programação de treinamento é elaborada considerando suas características e objetivos, não sendo recomendável reproduzir, por iniciativa própria, o treinamento destinado a outro atleta.",
      "A evolução esportiva depende de diversos fatores, incluindo treinamento, recuperação, sono, alimentação, histórico esportivo, condições de saúde, disponibilidade para treinamento e aderência à programação proposta pelo profissional habilitado da assessoria.",
    ],
  },
  {
    title: "5. Dos sinais de alerta e interrupção do treinamento",
    paragraphs: [
      "O(A) atleta declara estar ciente de que a prática de corrida envolve esforço físico e que, mesmo quando realizada de maneira orientada, podem ocorrer eventos adversos.",
      "Durante o treinamento, diante de sintomas como dor intensa ou inesperada, tontura, desmaio, falta de ar desproporcional ao esforço, dor no peito, palpitações incomuns, alteração significativa da coordenação ou qualquer outro sinal que cause preocupação, o(a) atleta deverá comunicar imediatamente o profissional responsável e interromper a atividade quando orientado.",
      "Quando necessário, a Assessoria poderá recomendar avaliação por profissional de saúde antes do retorno aos treinamentos.",
    ],
  },
  {
    title: "6. Da progressão, recuperação e autocuidado",
    paragraphs: [
      "O(A) atleta reconhece que a evolução na corrida depende não apenas do treinamento, mas também de recuperação adequada.",
      "Nesse sentido, compromete-se a respeitar os períodos de descanso e recuperação estabelecidos na programação e a comunicar à Assessoria situações de fadiga excessiva, dor persistente, queda de rendimento ou dificuldade de recuperação.",
      "A comunicação entre atleta e treinador constitui elemento essencial para a adequada individualização do treinamento.",
    ],
  },
  {
    title: "7. Da responsabilidade e da ciência sobre os riscos",
    paragraphs: [
      "O(A) atleta declara estar ciente de que a corrida é uma atividade física que envolve riscos inerentes ao esporte, incluindo, entre outros, quedas, lesões musculares ou articulares, mal-estar, desidratação, intercorrências relacionadas às condições climáticas e outros eventos decorrentes da prática esportiva.",
      "A assinatura deste Termo não afasta responsabilidades que eventualmente decorram de condutas que contrariem a legislação aplicável ou de obrigações legalmente atribuídas à Assessoria e aos seus profissionais.",
      "O presente documento tem como finalidade estabelecer ciência, transparência, prevenção e compartilhamento de responsabilidades, não constituindo autorização para negligência ou afastamento de responsabilidades legalmente previstas.",
    ],
  },
  {
    title: "8. Da comunicação entre atleta e assessoria",
    paragraphs: [
      "O(A) atleta reconhece que a comunicação adequada com o treinador e com a Assessoria é parte fundamental do processo de treinamento.",
      "Sempre que houver alteração relevante em sua condição física, disponibilidade, rotina, objetivos esportivos ou capacidade de cumprir a programação, o(a) atleta deverá comunicar a equipe responsável.",
      "Da mesma forma, a Assessoria buscará manter comunicação clara quanto às orientações, ajustes de treinamento e recomendações pertinentes.",
    ],
  },
  {
    title: "9. Proteção de dados e informações do atleta",
    paragraphs: [
      "Os dados pessoais fornecidos pelo(a) atleta serão tratados para as finalidades relacionadas à prestação dos serviços de assessoria esportiva, gestão do treinamento, comunicação, acompanhamento da evolução esportiva e demais finalidades legitimamente relacionadas à relação contratual, observada a legislação aplicável, especialmente a Lei Geral de Proteção de Dados Pessoais – LGPD.",
      "Quando aplicável, informações relacionadas à saúde serão tratadas com os cuidados e fundamentos jurídicos pertinentes à sua natureza.",
    ],
  },
] as const;

export const liabilityTermDeclarations = [
  "Forneci informações verdadeiras sobre minha condição de saúde e histórico esportivo.",
  "Comprometo-me a comunicar alterações relevantes em minha condição física.",
  "Compreendo que o treinamento será orientado de acordo com critérios técnicos e de individualidade esportiva.",
  "Compreendo que a evolução esportiva depende de diversos fatores e que não existe garantia de resultado específico.",
  "Comprometo-me a respeitar as orientações dos profissionais responsáveis.",
  "Estou ciente dos riscos inerentes à prática de corrida.",
  "Comprometo-me a comunicar imediatamente qualquer sintoma ou condição que possa interferir na realização dos treinamentos.",
] as const;

type TermData = {
  name: string;
  cpf: string | null;
  birthDate: Date | null;
  phone: string | null;
  email: string;
  joinedAt: Date;
  planName: string;
};

function documentDate(value: Date) {
  return new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Maceio" }).format(value);
}

export function buildLiabilityTermDocument(data: TermData) {
  const header = [
    "TERMO DE RESPONSABILIDADE, CIÊNCIA E COMPROMISSO PARA PRÁTICA DE CORRIDA",
    "Assessoria esportiva: PACE LAB",
    `Aluno(a)/atleta: ${data.name}`,
    `CPF: ${data.cpf ?? "Não informado"}`,
    `Data de nascimento: ${data.birthDate ? documentDate(data.birthDate) : "Não informada"}`,
    `Telefone: ${data.phone ?? "Não informado"}`,
    `E-mail: ${data.email}`,
    `Data de início: ${documentDate(data.joinedAt)}`,
    `Tipo de plano: ${data.planName}`,
  ];
  const sections = liabilityTermSections.flatMap((section) => [section.title, ...section.paragraphs, ...(section.items ?? []).map((item, index) => `${index + 1}. ${item}`)]);
  const declarations = liabilityTermDeclarations.map((item, index) => `${index + 1}) ${item}`);
  return [...header, "", ...sections, "", "10. Declaração de ciência e compromisso", "Declaro que:", ...declarations, "", "Assim sendo, declaro que li, compreendi e concordo com as condições estabelecidas neste Termo."].join("\n\n");
}
