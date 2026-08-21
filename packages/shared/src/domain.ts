/**
 * Tipos de dominio compartilhados entre backend, nucleo e painel.
 * Tudo em portugues para facilitar a leitura por quem nao programa.
 */

// ---------------------------------------------------------------------------
// Canais e mensagens
// ---------------------------------------------------------------------------

export const CANAIS = ['whatsapp', 'instagram', 'simulador', 'web'] as const;
export type Canal = (typeof CANAIS)[number];

export interface MensagemRecebida {
  /** Identificador unico da mensagem no canal de origem (usado para idempotencia). */
  idExterno: string;
  canal: Canal;
  /** Telefone/handle do cliente, sempre mascarado nos logs. */
  remetente: string;
  texto: string;
  /** Momento em que o canal recebeu a mensagem (ISO 8601). */
  recebidoEm: string;
  tipo: 'texto' | 'botao' | 'lista' | 'midia' | 'desconhecido';
  /** Payload de botao/lista interativa, quando houver. */
  payload?: string;
}

export interface MensagemEnviada {
  destinatario: string;
  texto: string;
  botoes?: Array<{ id: string; titulo: string }>;
}

// ---------------------------------------------------------------------------
// Intencoes reconhecidas pelo agente
// ---------------------------------------------------------------------------

export const INTENCOES = [
  'saudacao',
  'busca_produto',
  'comparacao_produtos',
  'preco',
  'estoque',
  'composicao',
  'modo_de_uso',
  'frete',
  'prazo',
  'status_pedido',
  'nota_fiscal',
  'rastreio',
  'atraso',
  'troca_devolucao',
  'produto_avariado',
  'reacao_adversa',
  'falar_atendente',
  'carrinho_abandonado',
  'recompra',
  'parar_mensagens',
  'desconhecida',
] as const;
export type Intencao = (typeof INTENCOES)[number];

export const ROTULO_INTENCAO: Record<Intencao, string> = {
  saudacao: 'Saudação',
  busca_produto: 'Busca de produto',
  comparacao_produtos: 'Comparação de produtos',
  preco: 'Preço',
  estoque: 'Estoque',
  composicao: 'Composição',
  modo_de_uso: 'Modo de uso',
  frete: 'Frete',
  prazo: 'Prazo',
  status_pedido: 'Status do pedido',
  nota_fiscal: 'Nota Fiscal',
  rastreio: 'Rastreio',
  atraso: 'Atraso',
  troca_devolucao: 'Troca e devolução',
  produto_avariado: 'Produto avariado',
  reacao_adversa: 'Reação adversa',
  falar_atendente: 'Falar com atendente',
  carrinho_abandonado: 'Carrinho abandonado',
  recompra: 'Recompra',
  parar_mensagens: 'Parar mensagens',
  desconhecida: 'Intenção desconhecida',
};

// ---------------------------------------------------------------------------
// Marcas
// ---------------------------------------------------------------------------

export const MARCAS = ['FDC Vitaminas', 'FDC Nutrition'] as const;
export type Marca = (typeof MARCAS)[number];

// ---------------------------------------------------------------------------
// Catalogo
// ---------------------------------------------------------------------------

export interface VarianteProduto {
  sku: string;
  titulo: string;
  precoCentavos: number;
  moeda: 'BRL';
  disponivel: boolean;
  estoque: number | null;
}

export interface Produto {
  id: string;
  marca: Marca;
  titulo: string;
  descricaoCurta: string;
  categoria: string;
  url: string;
  imagemUrl: string | null;
  variantes: VarianteProduto[];
  /** Texto EXATAMENTE como consta no rotulo oficial. Nao pode ser inventado. */
  rotulo: {
    composicao: string | null;
    modoDeUso: string | null;
    advertencias: string | null;
    porcaoPorEmbalagem: string | null;
  };
  /**
   * Dias que a embalagem dura, conforme o campo oficial da loja
   * (metafield custom.dias_de_uso no Shopify). null quando nao cadastrado —
   * nesse caso o agente NAO afirma que o produto esta acabando.
   */
  duracaoDiasEstimada: number | null;
  /** Marcacao obrigatoria de dado de demonstracao. */
  ficticio: boolean;
}

// ---------------------------------------------------------------------------
// Pedidos
// ---------------------------------------------------------------------------

export const STATUS_PAGAMENTO = ['pendente', 'pago', 'estornado', 'cancelado'] as const;
export type StatusPagamento = (typeof STATUS_PAGAMENTO)[number];

export const STATUS_PROCESSAMENTO = [
  'aguardando_faturamento',
  'faturado',
  'em_separacao',
  'despachado',
  'entregue',
  'cancelado',
] as const;
export type StatusProcessamento = (typeof STATUS_PROCESSAMENTO)[number];

export interface ItemPedido {
  sku: string;
  titulo: string;
  marca: Marca;
  quantidade: number;
  precoUnitarioCentavos: number;
}

export interface Pedido {
  id: string;
  numero: string;
  /** Sempre mascarado ao sair da API. */
  emailCliente: string;
  telefoneCliente: string;
  criadoEm: string;
  statusPagamento: StatusPagamento;
  statusProcessamento: StatusProcessamento;
  itens: ItemPedido[];
  totalCentavos: number;
  prazoPrometidoEm: string | null;
  codigoRastreio: string | null;
  transportadora: string | null;
  ficticio: boolean;
}

/** Versao segura para enviar ao cliente apos verificacao de identidade. */
export interface ResumoPedidoCliente {
  numero: string;
  criadoEm: string;
  statusPagamento: StatusPagamento;
  statusProcessamento: StatusProcessamento;
  itens: Array<{ titulo: string; quantidade: number }>;
  faturamento: { emitida: boolean; numeroNota: string | null; emitidaEm: string | null };
  rastreio: { codigo: string | null; transportadora: string | null; status: StatusRastreio | null };
  prazoPrometidoEm: string | null;
  possivelAtraso: boolean;
}

// ---------------------------------------------------------------------------
// Nota Fiscal
// ---------------------------------------------------------------------------

export interface NotaFiscal {
  pedidoNumero: string;
  emitida: boolean;
  numero: string | null;
  serie: string | null;
  chaveAcesso: string | null;
  emitidaEm: string | null;
  danfeUrl: string | null;
  ficticio: boolean;
}

// ---------------------------------------------------------------------------
// Rastreio
// ---------------------------------------------------------------------------

export const STATUS_RASTREIO = [
  'aguardando_coleta',
  'coletado',
  'em_transito',
  'saiu_para_entrega',
  'entregue',
  'atrasado',
  'extraviado',
  'devolvido',
  'desconhecido',
] as const;
export type StatusRastreio = (typeof STATUS_RASTREIO)[number];

export const ROTULO_RASTREIO: Record<StatusRastreio, string> = {
  aguardando_coleta: 'Aguardando coleta',
  coletado: 'Coletado',
  em_transito: 'Em trânsito',
  saiu_para_entrega: 'Saiu para entrega',
  entregue: 'Entregue',
  atrasado: 'Atrasado',
  extraviado: 'Extraviado',
  devolvido: 'Devolvido',
  desconhecido: 'Status desconhecido',
};

export interface EventoRastreio {
  data: string;
  descricao: string;
  local: string | null;
}

export interface Rastreamento {
  codigo: string;
  transportadora: string;
  status: StatusRastreio;
  ultimaMovimentacaoEm: string | null;
  previsaoEntregaEm: string | null;
  coletadoEm: string | null;
  eventos: EventoRastreio[];
  ficticio: boolean;
}

// ---------------------------------------------------------------------------
// Base de conhecimento
// ---------------------------------------------------------------------------

export const STATUS_CONHECIMENTO = ['rascunho', 'aprovado', 'expirado'] as const;
export type StatusConhecimento = (typeof STATUS_CONHECIMENTO)[number];

export interface DocumentoConhecimento {
  id: string;
  arquivo: string;
  titulo: string;
  fonte: string;
  atualizadoEm: string;
  aprovadoPor: string;
  status: StatusConhecimento;
  canais: Canal[];
  proximaRevisaoEm: string;
  conteudo: string;
  /** Calculado: aprovado E dentro da data de revisao. */
  utilizavel: boolean;
  motivoIndisponivel: string | null;
}

// ---------------------------------------------------------------------------
// Consentimento (LGPD)
// ---------------------------------------------------------------------------

export const FINALIDADES = ['servico', 'utilidade', 'marketing'] as const;
export type Finalidade = (typeof FINALIDADES)[number];

export interface Consentimento {
  id: string;
  clienteId: string;
  finalidade: Finalidade;
  concedido: boolean;
  origem: string;
  prova: string;
  registradoEm: string;
  revogadoEm: string | null;
}

// ---------------------------------------------------------------------------
// Atendimento humano
// ---------------------------------------------------------------------------

export const MOTIVOS_ESCALONAMENTO = [
  'gravidez_amamentacao',
  'crianca',
  'condicao_clinica',
  'uso_medicamento',
  'alergia',
  'reacao_adversa',
  'superdosagem',
  'integridade_produto',
  'suspeita_falsificacao',
  'duvida_clinica',
  'pedido_de_humano',
  'pedido_atrasado',
  'pedido_extraviado',
  'integracao_indisponivel',
  'sem_fonte_oficial',
  'modo_emergencia',
  'tentativa_acesso_indevido',
] as const;
export type MotivoEscalonamento = (typeof MOTIVOS_ESCALONAMENTO)[number];

export const ROTULO_ESCALONAMENTO: Record<MotivoEscalonamento, string> = {
  gravidez_amamentacao: 'Gravidez ou amamentação',
  crianca: 'Uso por criança',
  condicao_clinica: 'Doença ou condição clínica',
  uso_medicamento: 'Uso de medicamento',
  alergia: 'Alergia',
  reacao_adversa: 'Reação adversa',
  superdosagem: 'Superdosagem',
  integridade_produto: 'Alteração ou avaria do produto',
  suspeita_falsificacao: 'Suspeita de falsificação',
  duvida_clinica: 'Dúvida clínica ou nutricional',
  pedido_de_humano: 'Cliente pediu atendente',
  pedido_atrasado: 'Pedido atrasado',
  pedido_extraviado: 'Pedido extraviado',
  integracao_indisponivel: 'Integração indisponível',
  sem_fonte_oficial: 'Sem fonte oficial aprovada',
  modo_emergencia: 'Modo de emergência ativo',
  tentativa_acesso_indevido: 'Tentativa de acesso indevido',
};

export interface ItemFilaHumana {
  id: string;
  conversaId: string;
  clienteId: string;
  motivo: MotivoEscalonamento;
  resumo: string;
  prioridade: 'alta' | 'normal';
  status: 'aberto' | 'em_atendimento' | 'resolvido';
  criadoEm: string;
  atendente: string | null;
}

// ---------------------------------------------------------------------------
// Resposta do agente
// ---------------------------------------------------------------------------

export interface FonteUtilizada {
  tipo: 'conhecimento' | 'catalogo' | 'pedido' | 'nota_fiscal' | 'rastreio' | 'nenhuma';
  referencia: string;
}

export interface RespostaAgente {
  conversaId: string;
  texto: string;
  intencao: Intencao;
  confianca: number;
  fontes: FonteUtilizada[];
  regrasAcionadas: string[];
  transferidoParaHumano: boolean;
  motivoEscalonamento: MotivoEscalonamento | null;
  bloqueadoPorSeguranca: boolean;
  /** Sugestoes de link de produto/carrinho, quando aplicavel. */
  links: Array<{ titulo: string; url: string }>;
  ferramentasUsadas: string[];
  /** Milissegundos gastos no processamento. */
  duracaoMs: number;
}

// ---------------------------------------------------------------------------
// Auditoria
// ---------------------------------------------------------------------------

export interface EventoAuditoria {
  id: string;
  ocorridoEm: string;
  ator: string;
  acao: string;
  recurso: string;
  resultado: 'permitido' | 'negado' | 'erro';
  detalhe: string;
}

// ---------------------------------------------------------------------------
// Status das integracoes
// ---------------------------------------------------------------------------

export interface StatusIntegracao {
  nome: string;
  adaptador: string;
  modo: 'mock' | 'real_desabilitado' | 'real_habilitado';
  saudavel: boolean;
  detalhe: string;
}
