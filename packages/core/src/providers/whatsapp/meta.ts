import { createHmac, timingSafeEqual } from 'node:crypto';
import { falha, type MensagemEnviada, type MensagemRecebida, type Resultado } from '@fdc/shared';
import { config, envioRealPermitido } from '../../config.js';
import { log } from '../../logger.js';
import { executarComProtecao } from '../resiliencia.js';
import type { WhatsAppProvider } from './tipos.js';

/**
 * Adaptador da WhatsApp Business Platform (Meta Cloud API).
 *
 * ENVIO REAL BLOQUEADO POR PADRAO. Para enviar, TODAS estas condicoes precisam
 * ser verdadeiras ao mesmo tempo (ver config.envioRealPermitido):
 *   APP_ENV=producao, WHATSAPP_PROVIDER=meta, WHATSAPP_LIVE_ENABLED=true,
 *   WHATSAPP_ENABLED=true, token e phone number id preenchidos.
 */
export class MetaWhatsAppCloudProvider implements WhatsAppProvider {
  readonly nome = 'MetaWhatsAppCloudProvider';

  get modo(): 'real_desabilitado' | 'real_habilitado' {
    return envioRealPermitido() ? 'real_habilitado' : 'real_desabilitado';
  }

  async enviar(
    mensagem: MensagemEnviada,
  ): Promise<Resultado<{ idExterno: string; simulado: boolean }>> {
    if (!envioRealPermitido()) {
      log.warn('envio real bloqueado pela trava de seguranca', {
        destinatario: mensagem.destinatario,
      });
      return falha({
        codigo: 'desabilitado',
        mensagem:
          'Envio real pelo WhatsApp esta bloqueado. Necessario APP_ENV=producao e WHATSAPP_LIVE_ENABLED=true com autorizacao expressa.',
        origem: 'whatsapp:meta',
      });
    }

    const c = config();
    return executarComProtecao('whatsapp:meta', async (sinal) => {
      const url = `https://graph.facebook.com/${c.META_GRAPH_VERSION}/${c.META_PHONE_NUMBER_ID}/messages`;
      const resposta = await fetch(url, {
        method: 'POST',
        signal: sinal,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${c.META_ACCESS_TOKEN}`,
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to: mensagem.destinatario,
          type: 'text',
          text: { body: mensagem.texto },
        }),
      });
      if (!resposta.ok) throw new Error(`Meta respondeu ${resposta.status}`);
      const corpo = (await resposta.json()) as { messages?: Array<{ id: string }> };
      return { idExterno: corpo.messages?.[0]?.id ?? 'desconhecido', simulado: false };
    });
  }

  /** Normaliza texto, botoes e mensagens interativas recebidas da Meta. */
  normalizarWebhook(corpo: unknown): MensagemRecebida[] {
    const saida: MensagemRecebida[] = [];
    const raiz = corpo as
      | {
          entry?: Array<{
            changes?: Array<{
              value?: {
                messages?: Array<Record<string, unknown>>;
              };
            }>;
          }>;
        }
      | undefined;

    for (const entrada of raiz?.entry ?? []) {
      for (const mudanca of entrada.changes ?? []) {
        for (const m of mudanca.value?.messages ?? []) {
          const tipo = String(m['type'] ?? 'desconhecido');
          let texto = '';
          let payload: string | undefined;
          let tipoNormalizado: MensagemRecebida['tipo'] = 'desconhecido';

          if (tipo === 'text') {
            tipoNormalizado = 'texto';
            texto = String((m['text'] as { body?: string } | undefined)?.body ?? '');
          } else if (tipo === 'button') {
            tipoNormalizado = 'botao';
            const b = m['button'] as { text?: string; payload?: string } | undefined;
            texto = String(b?.text ?? '');
            payload = b?.payload;
          } else if (tipo === 'interactive') {
            const i = m['interactive'] as
              | {
                  type?: string;
                  button_reply?: { id?: string; title?: string };
                  list_reply?: { id?: string; title?: string };
                }
              | undefined;
            if (i?.type === 'list_reply') {
              tipoNormalizado = 'lista';
              texto = String(i.list_reply?.title ?? '');
              payload = i.list_reply?.id;
            } else {
              tipoNormalizado = 'botao';
              texto = String(i?.button_reply?.title ?? '');
              payload = i?.button_reply?.id;
            }
          } else if (['image', 'audio', 'video', 'document', 'sticker'].includes(tipo)) {
            tipoNormalizado = 'midia';
            texto = '';
          }

          const carimbo = m['timestamp'];
          saida.push({
            idExterno: String(m['id'] ?? ''),
            canal: 'whatsapp',
            remetente: String(m['from'] ?? ''),
            texto,
            recebidoEm: carimbo
              ? new Date(Number(carimbo) * 1000).toISOString()
              : new Date().toISOString(),
            tipo: tipoNormalizado,
            ...(payload ? { payload } : {}),
          });
        }
      }
    }
    return saida;
  }
}

/**
 * Valida a assinatura X-Hub-Signature-256 enviada pela Meta.
 * Comparacao em tempo constante para evitar vazamento por tempo de resposta.
 */
export function assinaturaValida(
  corpoBruto: string | Buffer,
  cabecalhoAssinatura: string | undefined,
  segredo: string | null,
): boolean {
  if (!segredo) return false;
  if (!cabecalhoAssinatura?.startsWith('sha256=')) return false;
  const esperado = createHmac('sha256', segredo)
    .update(typeof corpoBruto === 'string' ? Buffer.from(corpoBruto, 'utf8') : corpoBruto)
    .digest('hex');
  const recebido = cabecalhoAssinatura.slice('sha256='.length);
  const a = Buffer.from(esperado, 'utf8');
  const b = Buffer.from(recebido, 'utf8');
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
