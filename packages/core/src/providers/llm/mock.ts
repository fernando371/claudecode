import { ok, type Resultado } from '@fdc/shared';
import type { LLMProvider, PedidoLLM, RespostaLLM } from './tipos.js';

/**
 * Provedor de IA simulado e DETERMINISTICO (padrao do sistema).
 * Nao chama nenhuma API, nao gera custo e sempre produz a mesma saida
 * para a mesma entrada - o que torna os testes confiaveis.
 *
 * Ele nunca inventa conteudo: apenas monta o texto a partir do contexto
 * oficial que o nucleo entregou.
 */
export class MockLLMProvider implements LLMProvider {
  readonly nome = 'MockLLMProvider';
  readonly modo = 'mock' as const;

  async gerar(pedido: PedidoLLM): Promise<Resultado<RespostaLLM>> {
    const ultima = [...pedido.mensagens].reverse().find((m) => m.papel === 'usuario');
    const base = pedido.contexto.filter(Boolean).join('\n');
    const texto = base
      ? base
      : `Não encontrei uma fonte oficial aprovada para responder com segurança${
          ultima ? '' : ''
        }. Vou encaminhar para um atendente humano.`;
    return ok({
      texto,
      modelo: 'mock-deterministico',
      ferramentasSolicitadas: [],
    } satisfies RespostaLLM);
  }
}
