import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import {
  abrirPedidoDoTitular,
  clientes,
  consentimentos,
  executarExclusao,
  executarExpurgo,
  executarInterrupcao,
  pedidosExclusao,
  politicaRetencao,
} from '@fdc/core';
import { mascararEmail, mascararTelefone } from '@fdc/shared';
import { auditarAcaoAdministrativa } from '../seguranca.js';

/**
 * Endpoints de LGPD: política de retenção, expurgo e direitos do titular.
 * Toda ação aqui é registrada na auditoria.
 */

const esquemaCliente = z.object({ clienteId: z.string().min(3).max(80) });
const esquemaPedido = esquemaCliente.extend({ tipo: z.enum(['exclusao', 'interrupcao']) });

export async function rotasLgpd(app: FastifyInstance): Promise<void> {
  app.get('/lgpd', {
    schema: {
      description: 'Situação da privacidade: retenção, consentimentos e pedidos.',
      tags: ['lgpd'],
    },
    handler: async (_r, resposta) =>
      resposta.send({
        retencao: politicaRetencao(),
        consentimentos: consentimentos.listar(),
        pedidos: pedidosExclusao.listar(),
        clientes: clientes.listar().map((c) => ({
          ...c,
          email: mascararEmail(c.email),
          telefone: mascararTelefone(c.telefone),
        })),
      }),
  });

  app.post('/lgpd/expurgo', {
    schema: {
      description: 'Executa agora o expurgo pela política de retenção.',
      tags: ['lgpd'],
    },
    handler: async (_r, resposta) => {
      const relatorio = executarExpurgo();
      auditarAcaoAdministrativa(
        'lgpd:expurgo_manual',
        'banco_de_dados',
        `${relatorio.conversasApagadas} conversas removidas`,
      );
      return resposta.send(relatorio);
    },
  });

  app.post('/lgpd/pedidos', {
    schema: {
      description: 'Registra um pedido do titular (exclusão ou interrupção).',
      tags: ['lgpd'],
    },
    handler: async (requisicao, resposta) => {
      const analisado = esquemaPedido.safeParse(requisicao.body);
      if (!analisado.success) {
        return resposta
          .code(400)
          .send({ erro: 'entrada_invalida', detalhes: analisado.error.issues });
      }
      const r = abrirPedidoDoTitular(analisado.data.clienteId, analisado.data.tipo);
      if (!r.ok) return resposta.code(404).send({ erro: r.erro.codigo, mensagem: r.erro.mensagem });
      return resposta.send(r.dados);
    },
  });

  app.post('/lgpd/exclusao', {
    schema: {
      description:
        'Executa a exclusão dos dados de um cliente. Apaga conversas e anonimiza o cadastro. Não tem volta.',
      tags: ['lgpd'],
    },
    handler: async (requisicao, resposta) => {
      const analisado = esquemaCliente.safeParse(requisicao.body);
      if (!analisado.success) {
        return resposta
          .code(400)
          .send({ erro: 'entrada_invalida', detalhes: analisado.error.issues });
      }
      const r = executarExclusao(analisado.data.clienteId, 'painel');
      if (!r.ok) return resposta.code(404).send({ erro: r.erro.codigo, mensagem: r.erro.mensagem });
      auditarAcaoAdministrativa(
        'lgpd:exclusao_solicitada',
        analisado.data.clienteId,
        'exclusão executada',
      );
      return resposta.send(r.dados);
    },
  });

  app.post('/lgpd/interrupcao', {
    schema: { description: 'Executa a interrupção de comunicações de um cliente.', tags: ['lgpd'] },
    handler: async (requisicao, resposta) => {
      const analisado = esquemaCliente.safeParse(requisicao.body);
      if (!analisado.success) {
        return resposta
          .code(400)
          .send({ erro: 'entrada_invalida', detalhes: analisado.error.issues });
      }
      const r = executarInterrupcao(analisado.data.clienteId, 'painel');
      if (!r.ok) return resposta.code(404).send({ erro: r.erro.codigo, mensagem: r.erro.mensagem });
      return resposta.send({ ok: true });
    },
  });
}
