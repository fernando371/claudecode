import { contemAlgum, normalizar, type MotivoEscalonamento } from '@fdc/shared';

/**
 * REGRAS DE SEGURANCA PARA SUPLEMENTOS.
 *
 * O agente NUNCA pode diagnosticar, prescrever, substituir profissional de
 * saude, inventar beneficios, contraindicacoes, composicao, dosagem ou
 * modo de uso, nem prometer cura ou resultado garantido.
 *
 * Quando qualquer gatilho abaixo aparecer, a recomendacao individual e
 * interrompida e a conversa vai para atendimento humano.
 */

interface Gatilho {
  motivo: MotivoEscalonamento;
  termos: readonly string[];
}

const GATILHOS: readonly Gatilho[] = [
  {
    motivo: 'gravidez_amamentacao',
    termos: [
      'gravida',
      'gravidez',
      'gestante',
      'gestacao',
      'amamentando',
      'amamentacao',
      'lactante',
      'estou esperando bebe',
      'to gravida',
    ],
  },
  {
    motivo: 'crianca',
    termos: [
      'crianca',
      'criancas',
      'meu filho',
      'minha filha',
      'bebe',
      'infantil',
      'menor de idade',
      'anos de idade',
      'pediatra',
      'adolescente',
    ],
  },
  {
    motivo: 'uso_medicamento',
    termos: [
      'remedio',
      'medicamento',
      'tomo anticoncepcional',
      'anticoagulante',
      'antidepressivo',
      'levotiroxina',
      'metformina',
      'insulina',
      'quimioterapia',
      'interacao medicamentosa',
      'posso tomar junto com o remedio',
      'uso continuo',
    ],
  },
  {
    motivo: 'condicao_clinica',
    termos: [
      'diabetes',
      'hipertensao',
      'pressao alta',
      'cancer',
      'tireoide',
      'hipotireoidismo',
      'renal',
      'rim',
      'figado',
      'hepatite',
      'cirrose',
      'gastrite',
      'anemia',
      'depressao',
      'ansiedade',
      'doenca',
      'cirurgia',
      'bariatrica',
      'colesterol alto',
      'sindrome',
      'autoimune',
      'lupus',
      'artrite',
      'osteoporose',
      'covid',
      'diagnostico',
    ],
  },
  {
    motivo: 'alergia',
    termos: ['alergia', 'alergico', 'alergica', 'intolerancia', 'intolerante', 'lactose', 'gluten'],
  },
  {
    motivo: 'reacao_adversa',
    termos: [
      'passei mal',
      'passando mal',
      'reacao',
      'efeito colateral',
      'me deu',
      'nausea',
      'vomito',
      'vomitei',
      'diarreia',
      'coceira',
      'mancha',
      'urticaria',
      'falta de ar',
      'taquicardia',
      'tontura',
      'dor de estomago depois de tomar',
      'intoxicacao',
    ],
  },
  {
    motivo: 'superdosagem',
    termos: [
      'tomei demais',
      'tomei muitas',
      'dose dobrada',
      'overdose',
      'superdosagem',
      'tomei 10 capsulas',
      'exagerei na dose',
      'tomei o pote',
    ],
  },
  {
    motivo: 'integridade_produto',
    termos: [
      'mudou de cor',
      'cor diferente',
      'cheiro estranho',
      'cheiro forte',
      'gosto estranho',
      'gosto diferente',
      'formato diferente',
      'derretido',
      'empedrado',
      'mofo',
      'lacre violado',
      'embalagem violada',
      'frasco aberto',
      'vazando',
      'estufado',
      'vencido',
      'validade vencida',
    ],
  },
  {
    motivo: 'suspeita_falsificacao',
    termos: [
      'falsificado',
      'falsificacao',
      'pirata',
      'produto falso',
      'nao parece original',
      'contrabando',
    ],
  },
];

/** Perguntas clinicas que ultrapassam o rotulo oficial. */
const TERMOS_DUVIDA_CLINICA = [
  'serve para curar',
  'cura',
  'trata',
  'tratamento para',
  'emagrece quantos quilos',
  'substitui o remedio',
  'posso parar o remedio',
  'qual dose para minha',
  'quanto devo tomar para',
  'diagnostico',
  'e bom para minha doenca',
  'resolve minha',
  'me receita',
  'prescreve',
  'quantos kg vou perder',
];

export interface AvaliacaoSaude {
  seguro: boolean;
  motivo: MotivoEscalonamento | null;
  regrasAcionadas: string[];
}

/** Analisa a mensagem do cliente e decide se a recomendacao pode continuar. */
export function avaliarSeguranca(texto: string): AvaliacaoSaude {
  const regras: string[] = [];
  for (const gatilho of GATILHOS) {
    if (contemAlgum(texto, gatilho.termos)) {
      regras.push(`saude:gatilho:${gatilho.motivo}`);
      return { seguro: false, motivo: gatilho.motivo, regrasAcionadas: regras };
    }
  }
  if (contemAlgum(texto, TERMOS_DUVIDA_CLINICA)) {
    regras.push('saude:duvida_clinica');
    return { seguro: false, motivo: 'duvida_clinica', regrasAcionadas: regras };
  }
  return { seguro: true, motivo: null, regrasAcionadas: ['saude:sem_gatilho'] };
}

/**
 * Frases que o agente NUNCA pode produzir. Funciona como rede de protecao
 * na SAIDA: se a resposta gerada contiver qualquer uma, ela e bloqueada.
 */
const PROIBICOES_NA_SAIDA = [
  'garante a cura',
  'cura garantida',
  'vai curar',
  'cura definitiva',
  'substitui o medicamento',
  'pode parar o remedio',
  'nao precisa de medico',
  'resultado garantido',
  'emagrecimento garantido',
  'perde peso garantido',
  'eu recomendo a dose de',
  'receito',
  'diagnostico e',
];

export function respostaViolaRegras(texto: string): string | null {
  const alvo = normalizar(texto);
  for (const proibicao of PROIBICOES_NA_SAIDA) {
    if (alvo.includes(normalizar(proibicao))) return proibicao;
  }
  return null;
}

/** Aviso padrao adicionado a respostas que envolvem escolha de produto. */
export const AVISO_NAO_PRESCRICAO =
  'Importante: suplementos não são medicamentos e não substituem a orientação de um médico, nutricionista ou farmacêutico. Só posso passar as informações do rótulo oficial.';

export const RESPOSTA_ESCALONAMENTO: Record<MotivoEscalonamento, string> = {
  gravidez_amamentacao:
    'Como você mencionou gravidez ou amamentação, não posso indicar suplementos por aqui. Nesses casos a orientação precisa vir de um profissional de saúde que acompanhe seu caso. Vou te passar para um atendente da FDC para o que for possível ajudar.',
  crianca:
    'Como a dúvida envolve uma criança, não posso fazer indicação por aqui. A orientação precisa vir de um pediatra ou nutricionista. Vou te passar para um atendente da FDC.',
  condicao_clinica:
    'Você mencionou uma condição de saúde. Não posso avaliar isso nem indicar suplemento com base nessa informação — isso é papel de um profissional habilitado. Vou te encaminhar para um atendente da FDC.',
  uso_medicamento:
    'Como há uso de medicamento envolvido, não posso avaliar possíveis interações. Consulte seu médico ou farmacêutico. Vou te encaminhar para um atendente da FDC.',
  alergia:
    'Como você mencionou alergia ou intolerância, prefiro não arriscar uma indicação automática. Vou te passar para um atendente da FDC, que pode conferir a composição oficial com você.',
  reacao_adversa:
    'Sinto muito por isso. Se você está passando mal, interrompa o uso e procure atendimento médico. Vou registrar seu relato e encaminhar imediatamente para um atendente da FDC.',
  superdosagem:
    'Se houve consumo acima do recomendado, procure orientação médica imediatamente. Em caso de emergência, ligue para o SAMU (192) ou vá a um serviço de saúde. Vou encaminhar seu caso para um atendente da FDC agora.',
  integridade_produto:
    'Obrigado por avisar. Não use o produto. Vou encaminhar imediatamente para um atendente da FDC, que vai conferir o lote e orientar sobre troca.',
  suspeita_falsificacao:
    'Obrigado por avisar. Isso é sério e precisa de conferência humana. Não use o produto. Vou encaminhar para um atendente da FDC agora.',
  duvida_clinica:
    'Essa dúvida vai além do que consta no rótulo oficial, então não posso responder por aqui. Vou te encaminhar para um atendente da FDC.',
  pedido_de_humano: 'Claro. Vou te transferir para um atendente da FDC.',
  pedido_atrasado:
    'Vi que esse pedido pode estar fora do prazo previsto. Vou encaminhar para um atendente da FDC verificar com a transportadora.',
  pedido_extraviado:
    'O rastreio indica um problema com a entrega. Vou encaminhar para um atendente da FDC resolver isso com a transportadora.',
  integracao_indisponivel:
    'Não consegui consultar essa informação agora. Para não te passar dado errado, vou encaminhar para um atendente da FDC.',
  sem_fonte_oficial:
    'Não tenho uma fonte oficial aprovada para responder isso com segurança. Vou encaminhar para um atendente da FDC.',
  modo_emergencia:
    'No momento o atendimento automático está desativado. Vou encaminhar sua mensagem para um atendente da FDC.',
  tentativa_acesso_indevido:
    'Por segurança, não consigo seguir com essa consulta. Vou encaminhar para um atendente da FDC.',
};
