import type { FastifyInstance } from 'fastify';
import {
  adaptadores,
  assinaturaValida,
  auditoria,
  config,
  log,
  processarMensagem,
} from '@fdc/core';

/**
 * Webhook do WhatsApp (Meta Cloud API).
 *
 * - GET: verificacao do webhook (hub.challenge).
 * - POST: recebimento. Exige assinatura valida e trata duplicatas.
 *
 * O envio da resposta e feito pelo adaptador configurado. Com o adaptador
 * simulado (padrao), nada sai para a internet.
 */
export async function rotasWebhook(app: FastifyInstance): Promise<void> {
  app.get('/webhooks/whatsapp', {
    schema: {
      description: 'Verificação do webhook exigida pela Meta.',
      tags: ['webhook'],
    },
    handler: async (requisicao, resposta) => {
      const q = requisicao.query as Record<string, string | undefined>;
      const c = config();
      const modo = q['hub.mode'];
      const token = q['hub.verify_token'];
      const desafio = q['hub.challenge'];

      if (!c.META_WEBHOOK_VERIFY_TOKEN) {
        return resposta.code(503).send({ erro: 'verificacao_nao_configurada' });
      }
      if (modo === 'subscribe' && token === c.META_WEBHOOK_VERIFY_TOKEN) {
        log.info('webhook verificado com sucesso');
        return resposta
          .code(200)
          .type('text/plain')
          .send(desafio ?? '');
      }
      auditoria.registrar({
        ator: 'meta',
        acao: 'webhook:verificacao',
        recurso: '/webhooks/whatsapp',
        resultado: 'negado',
        detalhe: 'token de verificação inválido',
      });
      return resposta.code(403).send({ erro: 'token_invalido' });
    },
  });

  app.post('/webhooks/whatsapp', {
    schema: {
      description: 'Recebimento de mensagens do WhatsApp. Valida assinatura e ignora duplicatas.',
      tags: ['webhook'],
    },
    handler: async (requisicao, resposta) => {
      const c = config();
      const bruto =
        (requisicao as unknown as { rawBody?: string }).rawBody ??
        JSON.stringify(requisicao.body ?? {});
      const assinatura = requisicao.headers['x-hub-signature-256'] as string | undefined;

      if (!assinaturaValida(bruto, assinatura, c.META_APP_SECRET)) {
        auditoria.registrar({
          ator: 'desconhecido',
          acao: 'webhook:assinatura',
          recurso: '/webhooks/whatsapp',
          resultado: 'negado',
          detalhe: 'assinatura X-Hub-Signature-256 inválida ou ausente',
        });
        return resposta.code(401).send({ erro: 'assinatura_invalida' });
      }

      // Responde rapido para a Meta e processa em seguida (evita reenvio).
      void resposta.code(200).send({ recebido: true });

      const mensagens = adaptadores().whatsapp.normalizarWebhook(requisicao.body);
      for (const m of mensagens) {
        try {
          const r = await processarMensagem({
            texto: m.texto,
            canal: m.canal,
            remetente: m.remetente,
            idExterno: m.idExterno,
          });
          if (r.texto) {
            await adaptadores().whatsapp.enviar({ destinatario: m.remetente, texto: r.texto });
          }
        } catch (erro) {
          log.error('falha ao processar mensagem do webhook', { erro: String(erro) });
        }
      }
    },
  });
}
