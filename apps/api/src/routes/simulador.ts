import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import {
  caixaDeSaidaSimulada,
  conversas,
  limparCaixaDeSaidaSimulada,
  mensagens,
  processarMensagem,
  simulacao,
  clientes,
} from '@fdc/core';
import { auditarAcaoAdministrativa } from '../seguranca.js';

const esquemaMensagem = z.object({
  texto: z.string().min(1).max(2000),
  remetente: z.string().min(3).max(40).default('+5511900000001'),
  conversaId: z.string().max(80).optional(),
  idExterno: z.string().max(120).optional(),
});

const esquemaFalhas = z.object({
  catalogoIndisponivel: z.boolean().optional(),
  pedidosIndisponivel: z.boolean().optional(),
  notaFiscalIndisponivel: z.boolean().optional(),
  rastreioDesconhecido: z.boolean().optional(),
  rastreioAtrasado: z.boolean().optional(),
  rastreioExtraviado: z.boolean().optional(),
  semEstoque: z.boolean().optional(),
});

/** Endpoints do "Simulador de Conversas". Nunca tocam em sistema real. */
export async function rotasSimulador(app: FastifyInstance): Promise<void> {
  app.post('/simulador/mensagem', {
    schema: { description: 'Envia uma mensagem como se fosse um cliente.', tags: ['simulador'] },
    handler: async (requisicao, resposta) => {
      const analisado = esquemaMensagem.safeParse(requisicao.body);
      if (!analisado.success) {
        return resposta
          .code(400)
          .send({ erro: 'entrada_invalida', detalhes: analisado.error.issues });
      }
      const entrada = analisado.data;
      const r = await processarMensagem({
        texto: entrada.texto,
        canal: 'simulador',
        remetente: entrada.remetente,
        ...(entrada.conversaId ? { conversaId: entrada.conversaId } : {}),
        ...(entrada.idExterno ? { idExterno: entrada.idExterno } : {}),
      });
      return resposta.send(r);
    },
  });

  app.get('/simulador/conversas/:id', {
    schema: { description: 'Histórico de uma conversa simulada.', tags: ['simulador'] },
    handler: async (requisicao, resposta) => {
      const { id } = requisicao.params as { id: string };
      const conversa = conversas.porId(id);
      if (!conversa) return resposta.code(404).send({ erro: 'conversa_nao_encontrada' });
      return resposta.send({ conversa, mensagens: mensagens.porConversa(id) });
    },
  });

  app.post('/simulador/reiniciar', {
    schema: {
      description: 'Reinicia a conversa e os interruptores de falha.',
      tags: ['simulador'],
    },
    handler: async (requisicao, resposta) => {
      const corpo = (requisicao.body ?? {}) as { conversaId?: string };
      if (corpo.conversaId) conversas.apagar(corpo.conversaId);
      simulacao.reiniciar();
      limparCaixaDeSaidaSimulada();
      auditarAcaoAdministrativa(
        'simulador:reiniciar',
        corpo.conversaId ?? 'todas',
        'conversa reiniciada',
      );
      return resposta.send({ ok: true, falhas: simulacao.ler() });
    },
  });

  app.get('/simulador/falhas', {
    schema: { description: 'Interruptores de simulação de erro.', tags: ['simulador'] },
    handler: async (_r, resposta) => resposta.send(simulacao.ler()),
  });

  app.put('/simulador/falhas', {
    schema: {
      description: 'Liga/desliga cenários de erro (Shopify, SAP, transportadora).',
      tags: ['simulador'],
    },
    handler: async (requisicao, resposta) => {
      const analisado = esquemaFalhas.safeParse(requisicao.body);
      if (!analisado.success) {
        return resposta
          .code(400)
          .send({ erro: 'entrada_invalida', detalhes: analisado.error.issues });
      }
      const atual = simulacao.definir(analisado.data);
      auditarAcaoAdministrativa('simulador:falhas', 'simulador', JSON.stringify(analisado.data));
      return resposta.send(atual);
    },
  });

  app.get('/simulador/caixa-de-saida', {
    schema: {
      description: 'Mensagens que teriam sido enviadas (nada sai de verdade).',
      tags: ['simulador'],
    },
    handler: async (_r, resposta) => resposta.send(caixaDeSaidaSimulada()),
  });

  app.get('/simulador/clientes', {
    schema: { description: 'Clientes fictícios disponíveis no simulador.', tags: ['simulador'] },
    handler: async (_r, resposta) => resposta.send(clientes.listar()),
  });
}
