/**
 * Interruptores usados APENAS pelo simulador para testar cenarios de erro
 * (Shopify fora do ar, SAP fora do ar, transportadora com status desconhecido).
 * Nao tem efeito em producao.
 */
export interface SimulacaoFalhas {
  catalogoIndisponivel: boolean;
  pedidosIndisponivel: boolean;
  notaFiscalIndisponivel: boolean;
  rastreioDesconhecido: boolean;
  rastreioAtrasado: boolean;
  rastreioExtraviado: boolean;
  semEstoque: boolean;
}

export const SIMULACAO_PADRAO: SimulacaoFalhas = {
  catalogoIndisponivel: false,
  pedidosIndisponivel: false,
  notaFiscalIndisponivel: false,
  rastreioDesconhecido: false,
  rastreioAtrasado: false,
  rastreioExtraviado: false,
  semEstoque: false,
};

let atual: SimulacaoFalhas = { ...SIMULACAO_PADRAO };

export const simulacao = {
  ler: (): SimulacaoFalhas => ({ ...atual }),
  definir(parcial: Partial<SimulacaoFalhas>): SimulacaoFalhas {
    atual = { ...atual, ...parcial };
    return { ...atual };
  },
  reiniciar(): SimulacaoFalhas {
    atual = { ...SIMULACAO_PADRAO };
    return { ...atual };
  },
};
