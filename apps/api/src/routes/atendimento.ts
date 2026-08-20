import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import {
  anotarNaConversa,
  conversaCompleta,
  devolverParaOAgente,
  responderComoAtendente,
} from '@fdc/core';

/**
 * Endpoints usados pela pessoa do atendimento no painel:
 * ler o histórico, responder o cliente, anotar e encerrar.
 */

const esquemaResposta = z.object({
  texto: z.string().min(1).max(4000),
  atendente: z.string().min(1).max(60).default('atendente'),
});

const esquemaEncerrar = z.object({
  atendente: z.string().min(1).max(60).default('atendente'),
});

export async function rotasAtendimento(app: FastifyInstance): Promise<void> {
  app.get('/conversas/:id', {
    schema: {
      description: 'Histórico completo de uma conversa, com dados pessoais mascarados.',
      tags: ['atendimento'],
    },
    handler: async (requisicao, resposta) => {
      const { id } = requisicao.params as { id: string };
      const dados = conversaCompleta(id);
      if (!dados) return resposta.code(404).send({ erro: 'conversa_nao_encontrada' });
      return resposta.send(dados);
    },
  });

  app.post('/conversas/:id/responder', {
    schema: {
      description:
        'Envia uma resposta escrita por uma pessoa do atendimento. Respeita a trava de envio real.',
      tags: ['atendimento'],
    },
    handler: async (requisicao, resposta) => {
      const { id } = requisicao.params as { id: string };
      const analisado = esquemaResposta.safeParse(requisicao.body);
      if (!analisado.success) {
        return resposta
          .code(400)
          .send({ erro: 'entrada_invalida', detalhes: analisado.error.issues });
      }
      const r = await responderComoAtendente(id, analisado.data.atendente, analisado.data.texto);
      if (!r.ok) {
        const status = r.erro.codigo === 'nao_encontrado' ? 404 : 400;
        return resposta.code(status).send({ erro: r.erro.codigo, mensagem: r.erro.mensagem });
      }
      return resposta.send(r.dados);
    },
  });

  app.post('/conversas/:id/anotar', {
    schema: {
      description: 'Anotação interna do atendimento. Nunca é enviada ao cliente.',
      tags: ['atendimento'],
    },
    handler: async (requisicao, resposta) => {
      const { id } = requisicao.params as { id: string };
      const analisado = esquemaResposta.safeParse(requisicao.body);
      if (!analisado.success) {
        return resposta
          .code(400)
          .send({ erro: 'entrada_invalida', detalhes: analisado.error.issues });
      }
      const r = anotarNaConversa(id, analisado.data.atendente, analisado.data.texto);
      if (!r.ok) {
        const status = r.erro.codigo === 'nao_encontrado' ? 404 : 400;
        return resposta.code(status).send({ erro: r.erro.codigo, mensagem: r.erro.mensagem });
      }
      return resposta.send(r.dados);
    },
  });

  app.post('/conversas/:id/encerrar', {
    schema: {
      description: 'Encerra o atendimento humano e devolve a conversa ao agente automático.',
      tags: ['atendimento'],
    },
    handler: async (requisicao, resposta) => {
      const { id } = requisicao.params as { id: string };
      const analisado = esquemaEncerrar.safeParse(requisicao.body ?? {});
      const atendente = analisado.success ? analisado.data.atendente : 'atendente';
      const r = devolverParaOAgente(id, atendente);
      if (!r.ok) return resposta.code(404).send({ erro: r.erro.codigo, mensagem: r.erro.mensagem });
      return resposta.send({ ok: true });
    },
  });
}
