import { createHmac } from 'node:crypto';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { prepararAmbiente } from './apoio.js';
import { limparCacheConfig } from '@fdc/core';
import { criarServidor } from '../apps/api/src/server.js';

/** Testes de integração da API, sem rede e sem credenciais. */

const SEGREDO = 'segredo-webhook-de-teste';
let app: Awaited<ReturnType<typeof criarServidor>>;

beforeAll(async () => {
  process.env.META_APP_SECRET = SEGREDO;
  process.env.META_WEBHOOK_VERIFY_TOKEN = 'token-de-verificacao-de-teste';
  process.env.RATE_LIMIT_MAX_PER_MINUTE = '1000';
  limparCacheConfig();
  app = await criarServidor();
  await app.ready();
});

afterAll(async () => {
  await app.close();
});

beforeEach(() => {
  prepararAmbiente();
  process.env.META_APP_SECRET = SEGREDO;
  process.env.META_WEBHOOK_VERIFY_TOKEN = 'token-de-verificacao-de-teste';
  process.env.RATE_LIMIT_MAX_PER_MINUTE = '1000';
  limparCacheConfig();
});

const assinar = (corpo: string) =>
  `sha256=${createHmac('sha256', SEGREDO).update(corpo).digest('hex')}`;

describe('API — saúde e documentação', () => {
  it('responde /saude e informa que o envio real está bloqueado', async () => {
    const r = await app.inject({ method: 'GET', url: '/saude' });
    expect(r.statusCode).toBe(200);
    expect(r.json()).toMatchObject({ ok: true, envioRealWhatsAppPermitido: false });
  });

  it('publica a especificação OpenAPI', async () => {
    const r = await app.inject({ method: 'GET', url: '/openapi.json' });
    expect(r.statusCode).toBe(200);
    expect(r.json()).toHaveProperty('openapi');
  });
});

describe('API — webhook do WhatsApp', () => {
  it('verifica o webhook com o token correto', async () => {
    const r = await app.inject({
      method: 'GET',
      url: '/webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=token-de-verificacao-de-teste&hub.challenge=1234',
    });
    expect(r.statusCode).toBe(200);
    expect(r.body).toBe('1234');
  });

  it('recusa verificação com token errado', async () => {
    const r = await app.inject({
      method: 'GET',
      url: '/webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=errado&hub.challenge=1234',
    });
    expect(r.statusCode).toBe(403);
  });

  it('recusa POST sem assinatura', async () => {
    const r = await app.inject({
      method: 'POST',
      url: '/webhooks/whatsapp',
      payload: { entry: [] },
    });
    expect(r.statusCode).toBe(401);
    expect(r.json().erro).toBe('assinatura_invalida');
  });

  it('recusa POST com assinatura inválida', async () => {
    const corpo = JSON.stringify({ entry: [] });
    const r = await app.inject({
      method: 'POST',
      url: '/webhooks/whatsapp',
      headers: {
        'content-type': 'application/json',
        'x-hub-signature-256': `sha256=${'a'.repeat(64)}`,
      },
      payload: corpo,
    });
    expect(r.statusCode).toBe(401);
  });

  it('aceita POST com assinatura válida', async () => {
    const corpo = JSON.stringify({ entry: [] });
    const r = await app.inject({
      method: 'POST',
      url: '/webhooks/whatsapp',
      headers: { 'content-type': 'application/json', 'x-hub-signature-256': assinar(corpo) },
      payload: corpo,
    });
    expect(r.statusCode).toBe(200);
  });
});

describe('API — simulador', () => {
  it('processa mensagem e devolve diagnóstico', async () => {
    const r = await app.inject({
      method: 'POST',
      url: '/simulador/mensagem',
      payload: { texto: 'quanto custa a vitamina C?' },
    });
    expect(r.statusCode).toBe(200);
    const corpo = r.json();
    expect(corpo.intencao).toBe('preco');
    expect(corpo.regrasAcionadas.length).toBeGreaterThan(0);
  });

  it('recusa entrada inválida', async () => {
    const r = await app.inject({
      method: 'POST',
      url: '/simulador/mensagem',
      payload: { texto: '' },
    });
    expect(r.statusCode).toBe(400);
  });

  it('liga e desliga cenários de falha', async () => {
    const r = await app.inject({
      method: 'PUT',
      url: '/simulador/falhas',
      payload: { catalogoIndisponivel: true },
    });
    expect(r.json().catalogoIndisponivel).toBe(true);

    const conversa = await app.inject({
      method: 'POST',
      url: '/simulador/mensagem',
      payload: { texto: 'quanto custa a vitamina C?' },
    });
    expect(conversa.json().transferidoParaHumano).toBe(true);
  });
});

describe('API — painel não expõe segredos', () => {
  it('as configurações não trazem nenhuma chave ou senha', async () => {
    const r = await app.inject({ method: 'GET', url: '/configuracoes' });
    const texto = JSON.stringify(r.json());
    for (const proibido of [
      'META_APP_SECRET',
      SEGREDO,
      'ANTHROPIC_API_KEY',
      'ADMIN_PASSWORD',
      'SHOPIFY_ADMIN_TOKEN',
    ]) {
      expect(texto).not.toContain(proibido);
    }
  });

  it('o status das integrações não traz credenciais', async () => {
    const r = await app.inject({ method: 'GET', url: '/integracoes' });
    expect(JSON.stringify(r.json())).not.toContain(SEGREDO);
  });

  it('os pedidos saem com e-mail e telefone mascarados', async () => {
    const r = await app.inject({ method: 'GET', url: '/pedidos' });
    const texto = JSON.stringify(r.json());
    expect(texto).not.toContain('ana.exemplo@exemplo.invalido');
    expect(texto).toContain('***');
  });
});

describe('API — controle de acesso do painel', () => {
  it('exige autenticação quando há senha configurada', async () => {
    process.env.ADMIN_AUTH_ENABLED = 'true';
    process.env.ADMIN_PASSWORD = 'senha-de-teste';
    limparCacheConfig();

    const semCredencial = await app.inject({ method: 'GET', url: '/indicadores' });
    expect(semCredencial.statusCode).toBe(401);

    const credencial = Buffer.from('admin:senha-de-teste').toString('base64');
    const comCredencial = await app.inject({
      method: 'GET',
      url: '/indicadores',
      headers: { authorization: `Basic ${credencial}` },
    });
    expect(comCredencial.statusCode).toBe(200);

    const saude = await app.inject({ method: 'GET', url: '/saude' });
    expect(saude.statusCode).toBe(200);

    delete process.env.ADMIN_PASSWORD;
    process.env.ADMIN_AUTH_ENABLED = 'false';
    limparCacheConfig();
  });

  it('bloqueia o painel em produção quando não há senha definida', async () => {
    process.env.APP_ENV = 'producao';
    process.env.ADMIN_AUTH_ENABLED = 'true';
    delete process.env.ADMIN_PASSWORD;
    limparCacheConfig();

    const r = await app.inject({ method: 'GET', url: '/indicadores' });
    expect(r.statusCode).toBe(503);
    expect(r.json().erro).toBe('painel_sem_senha');

    process.env.APP_ENV = 'dev';
    process.env.ADMIN_AUTH_ENABLED = 'false';
    limparCacheConfig();
  });
});

describe('API — atendimento humano', () => {
  async function conversaEscalonada(): Promise<string> {
    const r = await app.inject({
      method: 'POST',
      url: '/simulador/mensagem',
      payload: { texto: 'passei mal depois de tomar o produto' },
    });
    return r.json().conversaId as string;
  }

  it('entrega o histórico da conversa para o atendente', async () => {
    const id = await conversaEscalonada();
    const r = await app.inject({ method: 'GET', url: `/conversas/${id}` });
    expect(r.statusCode).toBe(200);
    const corpo = r.json();
    expect(corpo.fila[0].motivo).toBe('reacao_adversa');
    expect(JSON.stringify(corpo)).not.toContain('ana.exemplo@exemplo.invalido');
  });

  it('devolve 404 para conversa inexistente', async () => {
    const r = await app.inject({ method: 'GET', url: '/conversas/conv_nao_existe' });
    expect(r.statusCode).toBe(404);
  });

  it('envia a resposta do atendente e devolve a conversa ao agente', async () => {
    const id = await conversaEscalonada();

    const resposta = await app.inject({
      method: 'POST',
      url: `/conversas/${id}/responder`,
      payload: { texto: 'Oi, sou a Marina do time da FDC.', atendente: 'Marina' },
    });
    expect(resposta.statusCode).toBe(200);
    expect(resposta.json().mensagem.autor).toBe('atendente');

    const nota = await app.inject({
      method: 'POST',
      url: `/conversas/${id}/anotar`,
      payload: { texto: 'Conferir o lote com a produção.', atendente: 'Marina' },
    });
    expect(nota.statusCode).toBe(200);

    const encerrar = await app.inject({
      method: 'POST',
      url: `/conversas/${id}/encerrar`,
      payload: { atendente: 'Marina' },
    });
    expect(encerrar.statusCode).toBe(200);

    const depois = await app.inject({ method: 'GET', url: `/conversas/${id}` });
    expect(depois.json().conversa.assumidaPor).toBeNull();
    expect(depois.json().notas).toHaveLength(1);
  });

  it('recusa resposta vazia', async () => {
    const id = await conversaEscalonada();
    const r = await app.inject({
      method: 'POST',
      url: `/conversas/${id}/responder`,
      payload: { texto: '' },
    });
    expect(r.statusCode).toBe(400);
  });
});

describe('API — limites de requisição separados', () => {
  it('aperta o webhook público e dá folga ao painel autenticado', async () => {
    process.env.RATE_LIMIT_MAX_PER_MINUTE = '2';
    process.env.RATE_LIMIT_PANEL_MAX_PER_MINUTE = '50';
    limparCacheConfig();

    const restrito = await criarServidor();
    await restrito.ready();

    try {
      const chamarWebhook = () =>
        restrito.inject({ method: 'POST', url: '/webhooks/whatsapp', payload: { entry: [] } });

      // As duas primeiras passam pelo limite (e param na assinatura, com 401).
      expect((await chamarWebhook()).statusCode).toBe(401);
      expect((await chamarWebhook()).statusCode).toBe(401);
      // A terceira é barrada pelo limite.
      expect((await chamarWebhook()).statusCode).toBe(429);

      // O painel continua respondendo bem além do limite do webhook.
      for (let i = 0; i < 10; i += 1) {
        expect((await restrito.inject({ method: 'GET', url: '/indicadores' })).statusCode).toBe(
          200,
        );
      }
    } finally {
      await restrito.close();
      process.env.RATE_LIMIT_MAX_PER_MINUTE = '1000';
      process.env.RATE_LIMIT_PANEL_MAX_PER_MINUTE = '600';
      limparCacheConfig();
    }
  });
});
