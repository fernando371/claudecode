import { timingSafeEqual } from 'node:crypto';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { auditoria, config } from '@fdc/core';

/**
 * Controle de acesso do painel administrativo (autenticacao basica).
 *
 * - Com ADMIN_PASSWORD definido: exige usuario e senha.
 * - Sem senha e fora de producao: libera (uso local), com aviso no log.
 * - Sem senha em producao: BLOQUEIA tudo. Nunca ficamos abertos em producao.
 */

const ROTAS_PUBLICAS = ['/saude', '/webhooks/whatsapp', '/docs', '/docs/', '/openapi.json'];

function comparar(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ba.length !== bb.length) return false;
  return timingSafeEqual(ba, bb);
}

export async function exigirAcessoAdministrativo(
  requisicao: FastifyRequest,
  resposta: FastifyReply,
): Promise<void> {
  const caminho = requisicao.url.split('?')[0] ?? '';
  if (ROTAS_PUBLICAS.some((r) => caminho === r || caminho.startsWith(`${r}/`))) return;

  const c = config();
  if (!c.ADMIN_AUTH_ENABLED) return;

  if (!c.ADMIN_PASSWORD) {
    if (c.APP_ENV === 'producao') {
      await resposta.code(503).send({
        erro: 'painel_sem_senha',
        mensagem:
          'ADMIN_PASSWORD não configurado. O painel fica bloqueado em produção até isso ser definido.',
      });
      return;
    }
    return; // uso local sem senha
  }

  const cabecalho = requisicao.headers.authorization ?? '';
  if (!cabecalho.startsWith('Basic ')) {
    await resposta
      .code(401)
      .header('WWW-Authenticate', 'Basic realm="FDC WhatsApp AI"')
      .send({ erro: 'nao_autenticado' });
    return;
  }

  const [usuario, senha] = Buffer.from(cabecalho.slice(6), 'base64').toString('utf8').split(':');
  const valido = comparar(usuario ?? '', c.ADMIN_USER) && comparar(senha ?? '', c.ADMIN_PASSWORD);

  if (!valido) {
    auditoria.registrar({
      ator: 'painel',
      acao: 'login:falhou',
      recurso: caminho,
      resultado: 'negado',
      detalhe: 'credenciais inválidas',
    });
    await resposta
      .code(401)
      .header('WWW-Authenticate', 'Basic realm="FDC WhatsApp AI"')
      .send({ erro: 'credenciais_invalidas' });
  }
}

/** Registra no log de auditoria toda acao administrativa que altera algo. */
export function auditarAcaoAdministrativa(acao: string, recurso: string, detalhe: string): void {
  auditoria.registrar({ ator: 'painel', acao, recurso, resultado: 'permitido', detalhe });
}
