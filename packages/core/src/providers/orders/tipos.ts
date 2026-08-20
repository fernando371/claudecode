import type { Pedido, Resultado } from '@fdc/shared';

export interface CredenciaisConsultaPedido {
  numeroPedido: string;
  /** E-mail OU telefone informado pelo cliente. Um dos dois e obrigatorio. */
  email?: string | null;
  telefone?: string | null;
}

export interface OrderProvider {
  readonly nome: string;
  readonly modo: 'mock' | 'real_desabilitado' | 'real_habilitado';
  /**
   * Busca o pedido SOMENTE se a identidade conferir.
   * Nunca deve retornar dados antes da validacao.
   */
  buscarComVerificacao(credenciais: CredenciaisConsultaPedido): Promise<Resultado<Pedido>>;
  /** Uso administrativo/interno (painel), nunca exposto ao cliente. */
  listarInterno(): Promise<Resultado<Pedido[]>>;
  ultimoPedidoDoCliente(clienteId: string): Promise<Resultado<Pedido>>;
}
