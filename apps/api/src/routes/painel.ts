import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import {
  adaptadores,
  auditoria,
  calcularIndicadores,
  carregarDocumentos,
  config,
  conversas,
  definirEmergencia,
  estadoEmergencia,
  filaHumana,
  mensagens,
  modelosMensagem,
  politicaRetencao,
  statusIntegracoes,
  enviosCampanha,
} from '@fdc/core';
import { mascararEmail, mascararTelefone } from '@fdc/shared';
import { auditarAcaoAdministrativa } from '../seguranca.js';

/** Endpoints consumidos pelo painel administrativo. Nunca expõem segredos. */
export async function rotasPainel(app: FastifyInstance): Promise<void> {
  app.get('/visao-geral', {
    schema: { description: 'Resumo geral do sistema.', tags: ['painel'] },
    handler: async (_r, resposta) =>
      resposta.send({
        indicadores: calcularIndicadores(),
        integracoes: statusIntegracoes(),
        emergencia: estadoEmergencia(),
        retencao: politicaRetencao(),
      }),
  });

  app.get('/indicadores', {
    schema: { description: 'Indicadores de atendimento, vendas e operação.', tags: ['painel'] },
    handler: async (_r, resposta) => resposta.send(calcularIndicadores()),
  });

  app.get('/integracoes', {
    schema: { description: 'Status de cada integração (sem segredos).', tags: ['painel'] },
    handler: async (_r, resposta) => resposta.send(statusIntegracoes()),
  });

  app.get('/conhecimento', {
    schema: { description: 'Documentos da base de conhecimento e sua validade.', tags: ['painel'] },
    handler: async (_r, resposta) =>
      resposta.send(
        carregarDocumentos().map((d) => ({ ...d, conteudo: `${d.conteudo.slice(0, 600)}...` })),
      ),
  });

  app.get('/conhecimento/:id', {
    schema: { description: 'Conteúdo completo de um documento.', tags: ['painel'] },
    handler: async (requisicao, resposta) => {
      const { id } = requisicao.params as { id: string };
      const doc = carregarDocumentos().find((d) => d.id === id);
      if (!doc) return resposta.code(404).send({ erro: 'documento_nao_encontrado' });
      return resposta.send(doc);
    },
  });

  app.get('/produtos', {
    schema: { description: 'Produtos fictícios do catálogo simulado.', tags: ['painel'] },
    handler: async (_r, resposta) => {
      const r = await adaptadores().catalogo.listar();
      if (!r.ok) return resposta.code(503).send({ erro: r.erro.codigo, mensagem: r.erro.mensagem });
      return resposta.send(r.dados);
    },
  });

  app.get('/pedidos', {
    schema: {
      description: 'Pedidos fictícios (uso interno do painel, dados mascarados).',
      tags: ['painel'],
    },
    handler: async (_r, resposta) => {
      const r = await adaptadores().pedidos.listarInterno();
      if (!r.ok) return resposta.code(503).send({ erro: r.erro.codigo, mensagem: r.erro.mensagem });
      return resposta.send(
        r.dados.map((p) => ({
          ...p,
          emailCliente: mascararEmail(p.emailCliente),
          telefoneCliente: mascararTelefone(p.telefoneCliente),
        })),
      );
    },
  });

  app.get('/conversas', {
    schema: { description: 'Conversas simuladas registradas.', tags: ['painel'] },
    handler: async (_r, resposta) =>
      resposta.send(
        conversas.listar(200).map((c) => ({
          ...c,
          totalMensagens: mensagens.porConversa(c.id).length,
        })),
      ),
  });

  app.get('/fila', {
    schema: { description: 'Fila de atendimento humano.', tags: ['painel'] },
    handler: async (requisicao, resposta) => {
      const q = requisicao.query as { status?: 'aberto' | 'em_atendimento' | 'resolvido' };
      return resposta.send(q.status ? filaHumana.listar(q.status) : filaHumana.listar());
    },
  });

  app.post('/fila/:id/assumir', {
    schema: {
      description: 'Atendente assume a conversa (a IA para de responder).',
      tags: ['painel'],
    },
    handler: async (requisicao, resposta) => {
      const { id } = requisicao.params as { id: string };
      const corpo = (requisicao.body ?? {}) as { atendente?: string };
      const atendente = corpo.atendente ?? 'atendente';
      const item = filaHumana.listar().find((f) => f.id === id);
      if (!item) return resposta.code(404).send({ erro: 'item_nao_encontrado' });
      filaHumana.atualizarStatus(id, 'em_atendimento', atendente);
      conversas.assumir(item.conversaId, atendente);
      auditarAcaoAdministrativa('fila:assumir', id, `assumido por ${atendente}`);
      return resposta.send({ ok: true });
    },
  });

  app.post('/fila/:id/resolver', {
    schema: { description: 'Encerra o atendimento humano e devolve a conversa.', tags: ['painel'] },
    handler: async (requisicao, resposta) => {
      const { id } = requisicao.params as { id: string };
      const item = filaHumana.listar().find((f) => f.id === id);
      if (!item) return resposta.code(404).send({ erro: 'item_nao_encontrado' });
      filaHumana.atualizarStatus(id, 'resolvido', item.atendente);
      conversas.liberar(item.conversaId);
      auditarAcaoAdministrativa('fila:resolver', id, 'atendimento encerrado');
      return resposta.send({ ok: true });
    },
  });

  app.get('/auditoria', {
    schema: { description: 'Trilha de auditoria (dados mascarados).', tags: ['painel'] },
    handler: async (_r, resposta) => resposta.send(auditoria.listar(300)),
  });

  app.get('/campanhas', {
    schema: {
      description: 'Modelos de mensagem e histórico de avaliação (envio desligado).',
      tags: ['painel'],
    },
    handler: async (_r, resposta) =>
      resposta.send({
        envioAtivoHabilitado: config().OUTBOUND_CAMPAIGNS_ENABLED,
        modelos: modelosMensagem.listar(),
        envios: enviosCampanha.listar(),
      }),
  });

  app.get('/configuracoes', {
    schema: { description: 'Configurações não sensíveis do sistema.', tags: ['painel'] },
    handler: async (_r, resposta) => {
      const c = config();
      return resposta.send({
        ambiente: c.APP_ENV,
        adaptadores: {
          whatsapp: c.WHATSAPP_PROVIDER,
          catalogo: c.CATALOG_PROVIDER,
          pedidos: c.ORDER_PROVIDER,
          notaFiscal: c.INVOICE_PROVIDER,
          rastreio: c.TRACKING_PROVIDER,
          ia: c.LLM_PROVIDER,
        },
        travas: {
          envioRealWhatsApp: c.WHATSAPP_LIVE_ENABLED,
          campanhasAtivas: c.OUTBOUND_CAMPAIGNS_ENABLED,
          iaLigada: c.AI_ENABLED,
          whatsappLigado: c.WHATSAPP_ENABLED,
          somenteHumano: c.HUMAN_ONLY_MODE,
        },
        limites: {
          requisicoesPorMinutoWebhook: c.RATE_LIMIT_MAX_PER_MINUTE,
          requisicoesPorMinutoPainel: c.RATE_LIMIT_PANEL_MAX_PER_MINUTE,
          tempoLimiteIntegracaoMs: c.INTEGRATION_TIMEOUT_MS,
          falhasParaAbrirCircuito: c.CIRCUIT_BREAKER_FAILURES,
          campanhaPorClientePorSemana: c.CAMPAIGN_MAX_PER_CUSTOMER_PER_WEEK,
        },
        retencao: politicaRetencao(),
      });
    },
  });

  const esquemaEmergencia = z.object({
    iaDesativada: z.boolean().optional(),
    whatsappDesativado: z.boolean().optional(),
    somenteHumano: z.boolean().optional(),
  });

  app.post('/emergencia', {
    schema: { description: 'Liga/desliga IA, WhatsApp ou modo somente humano.', tags: ['painel'] },
    handler: async (requisicao, resposta) => {
      const analisado = esquemaEmergencia.safeParse(requisicao.body);
      if (!analisado.success) {
        return resposta
          .code(400)
          .send({ erro: 'entrada_invalida', detalhes: analisado.error.issues });
      }
      const estado = definirEmergencia(analisado.data);
      auditarAcaoAdministrativa('emergencia:alterar', 'sistema', JSON.stringify(analisado.data));
      return resposta.send(estado);
    },
  });

  app.get('/emergencia', {
    schema: { description: 'Estado atual dos interruptores de emergência.', tags: ['painel'] },
    handler: async (_r, resposta) => resposta.send(estadoEmergencia()),
  });
}
