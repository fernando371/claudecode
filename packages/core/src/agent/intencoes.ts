import { contemAlgum, normalizar, type Intencao } from '@fdc/shared';

/**
 * Classificacao de intencao DETERMINISTICA (sem IA, sem custo).
 *
 * A ordem importa: intencoes criticas de seguranca sao avaliadas primeiro,
 * para que nenhuma pergunta comercial "passe na frente" de um relato de
 * reacao adversa, por exemplo.
 */

interface Regra {
  intencao: Intencao;
  termos: readonly string[];
  peso: number;
}

const REGRAS: readonly Regra[] = [
  // --- criticas (avaliadas primeiro) ---
  {
    intencao: 'reacao_adversa',
    peso: 100,
    termos: [
      'passei mal',
      'passando mal',
      'efeito colateral',
      'reacao ao produto',
      'me deu alergia',
      'vomitei',
      'diarreia depois',
      'urticaria',
      'coceira depois',
      'intoxicacao',
    ],
  },
  {
    intencao: 'produto_avariado',
    peso: 95,
    termos: [
      'chegou quebrado',
      'chegou amassado',
      'lacre violado',
      'embalagem violada',
      'produto vazando',
      'frasco aberto',
      'mudou de cor',
      'cheiro estranho',
      'gosto estranho',
      'mofo',
      'empedrado',
      'produto estragado',
      'veio danificado',
      'produto falsificado',
      'parece falso',
    ],
  },
  {
    intencao: 'parar_mensagens',
    peso: 90,
    termos: [
      'parar mensagens',
      'nao quero mais receber',
      'para de mandar',
      'descadastrar',
      'me remove da lista',
      'sair da lista',
      'unsubscribe',
      'nao me manda mais',
    ],
  },
  {
    intencao: 'falar_atendente',
    peso: 85,
    termos: [
      'falar com atendente',
      'falar com humano',
      'quero uma pessoa',
      'atendente',
      'atendimento humano',
      'falar com alguem',
      'suporte humano',
      'transferir',
    ],
  },

  // --- pos-venda ---
  {
    intencao: 'atraso',
    peso: 70,
    termos: [
      'esta atrasado',
      'ta atrasado',
      'atraso',
      'passou do prazo',
      'nao chegou ainda',
      'demorando muito',
      'era pra ter chegado',
      'sumiu',
      'extraviado',
    ],
  },
  {
    intencao: 'rastreio',
    peso: 65,
    termos: [
      'rastreio',
      'rastrear',
      'codigo de rastreamento',
      'onde esta meu pedido',
      'onde ta meu pedido',
      'objeto',
      'transportadora',
    ],
  },
  {
    intencao: 'nota_fiscal',
    peso: 65,
    termos: ['nota fiscal', 'nf', 'nfe', 'danfe', 'chave de acesso', 'faturamento', 'faturado'],
  },
  {
    intencao: 'troca_devolucao',
    peso: 60,
    termos: [
      'trocar',
      'troca',
      'devolver',
      'devolucao',
      'estorno',
      'arrependimento',
      'cancelar pedido',
      'reembolso',
    ],
  },
  {
    intencao: 'status_pedido',
    peso: 55,
    termos: [
      'status do pedido',
      'meu pedido',
      'como esta meu pedido',
      'ja saiu',
      'ja enviaram',
      'pedido numero',
      'acompanhar pedido',
      'situacao do pedido',
    ],
  },

  // --- comercial ---
  {
    intencao: 'comparacao_produtos',
    peso: 50,
    termos: [
      'diferenca entre',
      'qual a diferenca',
      'comparar',
      'melhor que',
      'ou o',
      'versus',
      'vs',
    ],
  },
  {
    intencao: 'modo_de_uso',
    peso: 48,
    termos: [
      'como tomar',
      'como usar',
      'modo de uso',
      'quantas capsulas',
      'quantas vezes ao dia',
      'antes ou depois',
      'em jejum',
      'posologia',
    ],
  },
  {
    intencao: 'composicao',
    peso: 46,
    termos: [
      'composicao',
      'ingredientes',
      'contem',
      'tem gluten',
      'tem lactose',
      'formula',
      'tabela nutricional',
      'quantos mg',
      'quantidade por porcao',
    ],
  },
  {
    intencao: 'estoque',
    peso: 44,
    termos: [
      'tem estoque',
      'em estoque',
      'disponivel',
      'disponiveis',
      'acabou',
      'em falta',
      'esgotado',
      'quando volta',
      'reposicao de estoque',
      'ainda tem',
    ],
  },
  {
    intencao: 'preco',
    peso: 42,
    termos: [
      'preco',
      'quanto custa',
      'quanto e',
      'valor',
      'quanto ta',
      'promocao',
      'desconto',
      'cupom',
    ],
  },
  {
    intencao: 'frete',
    peso: 40,
    termos: ['frete', 'quanto custa a entrega', 'frete gratis', 'valor da entrega'],
  },
  {
    intencao: 'prazo',
    peso: 38,
    termos: ['prazo', 'quanto tempo demora', 'quantos dias', 'quando chega', 'em quanto tempo'],
  },
  {
    intencao: 'recompra',
    peso: 36,
    termos: [
      'comprar de novo',
      'repor',
      'reposicao',
      'acabou meu',
      'quero mais',
      'renovar',
      'recompra',
    ],
  },
  {
    intencao: 'carrinho_abandonado',
    peso: 34,
    termos: [
      'deixei no carrinho',
      'carrinho',
      'nao finalizei a compra',
      'nao consegui pagar',
      'travou o pagamento',
    ],
  },
  {
    intencao: 'busca_produto',
    peso: 30,
    termos: [
      'procuro',
      'quero comprar',
      'tem vitamina',
      'tem whey',
      'voces vendem',
      'qual produto',
      'me indica',
      'recomenda',
      'sugestao de produto',
      'preciso de',
    ],
  },

  {
    intencao: 'saudacao',
    peso: 10,
    termos: ['ola', 'oi', 'bom dia', 'boa tarde', 'boa noite', 'tudo bem', 'e ai', 'opa'],
  },
];

export interface ClassificacaoIntencao {
  intencao: Intencao;
  confianca: number;
  alternativas: Intencao[];
}

export function classificarIntencao(texto: string): ClassificacaoIntencao {
  const alvo = normalizar(texto);
  if (!alvo) return { intencao: 'desconhecida', confianca: 0, alternativas: [] };

  const pontuacoes = new Map<Intencao, number>();
  for (const regra of REGRAS) {
    const acertos = regra.termos.filter((t) => alvo.includes(normalizar(t))).length;
    if (acertos > 0) {
      const atual = pontuacoes.get(regra.intencao) ?? 0;
      pontuacoes.set(regra.intencao, Math.max(atual, regra.peso + acertos));
    }
  }

  if (pontuacoes.size === 0) {
    return { intencao: 'desconhecida', confianca: 0.2, alternativas: [] };
  }

  const ordenadas = [...pontuacoes.entries()].sort((a, b) => b[1] - a[1]);
  const primeiro = ordenadas[0]!;
  const segundo = ordenadas[1];
  const distancia = segundo ? primeiro[1] - segundo[1] : primeiro[1];
  const confianca = Math.min(0.98, 0.55 + Math.min(distancia, 40) / 100);

  return {
    intencao: primeiro[0],
    confianca: Number(confianca.toFixed(2)),
    alternativas: ordenadas.slice(1, 3).map(([i]) => i),
  };
}

/** Intencoes que exigem confirmacao de identidade antes de consultar dados. */
export const INTENCOES_COM_AUTENTICACAO: readonly Intencao[] = [
  'status_pedido',
  'nota_fiscal',
  'rastreio',
  'atraso',
  'troca_devolucao',
];

/** Intencoes que dependem de fonte oficial aprovada. */
export const INTENCOES_COM_FONTE_OFICIAL: readonly Intencao[] = [
  'composicao',
  'modo_de_uso',
  'frete',
  'prazo',
  'troca_devolucao',
];

export function contemPerguntaSobrePreco(texto: string): boolean {
  return contemAlgum(texto, ['preco', 'quanto custa', 'valor', 'quanto e']);
}
