import type { Resultado } from '@fdc/shared';

export interface PedidoLLM {
  /** Instrucao de sistema montada pelo nucleo (nunca pelo cliente). */
  sistema: string;
  /** Historico ja higienizado. */
  mensagens: Array<{ papel: 'usuario' | 'assistente'; texto: string }>;
  /** Trechos de fontes oficiais aprovadas que o modelo pode citar. */
  contexto: string[];
  /** Lista FECHADA de ferramentas permitidas nesta chamada. */
  ferramentasPermitidas: string[];
  maxTokens?: number;
}

export interface RespostaLLM {
  texto: string;
  modelo: string;
  /** Ferramentas que o modelo pediu para usar (validadas pelo nucleo). */
  ferramentasSolicitadas: string[];
}

export interface LLMProvider {
  readonly nome: string;
  readonly modo: 'mock' | 'real_desabilitado' | 'real_habilitado';
  gerar(pedido: PedidoLLM): Promise<Resultado<RespostaLLM>>;
}
