import { falha, ok, type Resultado } from '@fdc/shared';
import { config } from '../../config.js';
import { executarComProtecao } from '../resiliencia.js';
import type { LLMProvider, PedidoLLM, RespostaLLM } from './tipos.js';

/**
 * Adaptador para a API da Anthropic (Claude).
 *
 * ATENCAO SOBRE CUSTO: a assinatura do Claude Code NAO inclui credito da API.
 * O uso desta integracao e contratado e cobrado separadamente na Anthropic Console.
 * Enquanto ANTHROPIC_API_KEY e ANTHROPIC_MODEL nao forem preenchidos, este
 * adaptador fica DESABILITADO e o sistema usa o provedor simulado.
 *
 * O modelo NAO e fixado no codigo: vem de ANTHROPIC_MODEL no .env.
 */
export class AnthropicLLMProvider implements LLMProvider {
  readonly nome = 'AnthropicLLMProvider';

  get modo(): 'real_desabilitado' | 'real_habilitado' {
    const c = config();
    return c.ANTHROPIC_API_KEY && c.ANTHROPIC_MODEL ? 'real_habilitado' : 'real_desabilitado';
  }

  async gerar(pedido: PedidoLLM): Promise<Resultado<RespostaLLM>> {
    const c = config();
    if (this.modo !== 'real_habilitado') {
      return falha({
        codigo: 'desabilitado',
        mensagem:
          'Provedor de IA da Anthropic nao configurado. Preencha ANTHROPIC_API_KEY e ANTHROPIC_MODEL no .env (cobranca separada da assinatura do Claude Code).',
        origem: 'llm:anthropic',
      });
    }

    const sistema = [
      pedido.sistema,
      '',
      'FONTES OFICIAIS APROVADAS (use exclusivamente o conteudo abaixo):',
      ...pedido.contexto.map((c2, i) => `[${i + 1}] ${c2}`),
      '',
      `FERRAMENTAS PERMITIDAS NESTA RESPOSTA: ${pedido.ferramentasPermitidas.join(', ') || 'nenhuma'}`,
    ].join('\n');

    return executarComProtecao('llm:anthropic', async (sinal) => {
      const resposta = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        signal: sinal,
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': c.ANTHROPIC_API_KEY as string,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: c.ANTHROPIC_MODEL,
          max_tokens: pedido.maxTokens ?? c.LLM_MAX_OUTPUT_TOKENS,
          system: sistema,
          messages: pedido.mensagens.map((m) => ({
            role: m.papel === 'usuario' ? 'user' : 'assistant',
            content: m.texto,
          })),
        }),
      });
      if (!resposta.ok) throw new Error(`Anthropic respondeu ${resposta.status}`);
      const corpo = (await resposta.json()) as {
        content?: Array<{ type: string; text?: string }>;
        model?: string;
      };
      const texto = (corpo.content ?? [])
        .filter((p) => p.type === 'text')
        .map((p) => p.text ?? '')
        .join('\n')
        .trim();
      return {
        texto,
        modelo: corpo.model ?? String(c.ANTHROPIC_MODEL),
        ferramentasSolicitadas: [],
      } satisfies RespostaLLM;
    }).then((r) => (r.ok ? ok(r.dados) : r));
  }
}
