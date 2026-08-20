import { falha, type NotaFiscal, type Resultado } from '@fdc/shared';
import { config } from '../../config.js';
import type { InvoiceProvider } from './tipos.js';

/**
 * ADAPTADOR SAP - CONTRATO APENAS.
 *
 * IMPORTANTE: nenhum endpoint, formato de payload ou regra do SAP foi inventado.
 * A implementacao real depende das informacoes listadas em docs/06-checklist-sap.md:
 *   - forma de integracao usada (API REST, OData, SOAP, arquivo, middleware)
 *   - documentacao tecnica
 *   - campos disponiveis (numero, serie, chave de acesso, data, DANFE)
 *   - metodo de autenticacao
 *   - ambiente de homologacao
 *
 * Enquanto isso, este adaptador SEMPRE devolve "desabilitado".
 */
export class SapInvoiceProvider implements InvoiceProvider {
  readonly nome = 'SapInvoiceProvider';

  get modo(): 'real_desabilitado' | 'real_habilitado' {
    // Permanece desabilitado ate o contrato de integracao ser definido.
    return config().SAP_BASE_URL ? 'real_desabilitado' : 'real_desabilitado';
  }

  async porPedido(_numeroPedido: string): Promise<Resultado<NotaFiscal>> {
    return falha({
      codigo: 'desabilitado',
      mensagem:
        'Integracao com o SAP ainda nao definida. Aguardando documentacao tecnica e ambiente de homologacao.',
      origem: 'nota_fiscal:sap',
    });
  }
}
