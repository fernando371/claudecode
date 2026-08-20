import { resolve } from 'node:path';
import { config as carregarDotenv } from 'dotenv';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import { config, db, envioRealPermitido, log, popular } from '@fdc/core';
import { exigirAcessoAdministrativo } from './seguranca.js';
import { rotasPainel } from './routes/painel.js';
import { rotasSimulador } from './routes/simulador.js';
import { rotasWebhook } from './routes/webhook.js';

carregarDotenv({ path: resolve(process.cwd(), '.env'), quiet: true });

export async function criarServidor() {
  const c = config();
  const app = Fastify({ logger: false, bodyLimit: 1024 * 256 });

  // Guarda o corpo bruto: necessario para validar a assinatura do webhook.
  app.addContentTypeParser(
    'application/json',
    { parseAs: 'string' },
    (requisicao, corpo, pronto) => {
      (requisicao as unknown as { rawBody: string }).rawBody = corpo as string;
      try {
        pronto(null, corpo === '' ? {} : JSON.parse(corpo as string));
      } catch (erro) {
        pronto(erro as Error, undefined);
      }
    },
  );

  await app.register(helmet, { contentSecurityPolicy: false });
  await app.register(cors, {
    origin: c.CORS_ORIGINS.split(',')
      .map((o) => o.trim())
      .filter(Boolean),
    credentials: true,
    methods: ['GET', 'POST', 'PUT'],
  });
  await app.register(rateLimit, {
    max: c.RATE_LIMIT_MAX_PER_MINUTE,
    timeWindow: '1 minute',
    allowList: [],
  });

  await app.register(swagger, {
    openapi: {
      info: {
        title: 'FDC WhatsApp AI - API',
        description:
          'API do protótipo de atendimento e vendas pelo WhatsApp da FDC. Todos os dados são fictícios nesta fase.',
        version: '0.1.0',
      },
      servers: [{ url: `http://localhost:${c.API_PORT}` }],
    },
  });
  await app.register(swaggerUi, { routePrefix: '/docs' });

  app.addHook('onRequest', exigirAcessoAdministrativo);

  app.setErrorHandler((erro: unknown, _requisicao, resposta) => {
    // Nunca devolvemos detalhes internos ao cliente.
    const falha = erro as { message?: string; statusCode?: number };
    log.error('erro nao tratado na API', { mensagem: falha.message ?? 'desconhecido' });
    const status = falha.statusCode && falha.statusCode >= 400 ? falha.statusCode : 500;
    void resposta.code(status).send({
      erro: status === 429 ? 'muitas_requisicoes' : 'erro_interno',
      mensagem:
        status === 429
          ? 'Muitas requisições. Tente novamente em instantes.'
          : 'Não foi possível concluir a operação.',
    });
  });

  app.get('/saude', {
    schema: { description: 'Verificação de saúde da API.', tags: ['sistema'] },
    handler: async (_r, resposta) =>
      resposta.send({
        ok: true,
        ambiente: c.APP_ENV,
        envioRealWhatsAppPermitido: envioRealPermitido(),
        versao: '0.1.0',
      }),
  });

  app.get('/openapi.json', {
    schema: { hide: true },
    handler: async (_r, resposta) => resposta.send(app.swagger()),
  });

  await app.register(rotasWebhook);
  await app.register(rotasSimulador);
  await app.register(rotasPainel);

  return app;
}

export async function iniciar(): Promise<void> {
  const c = config();
  db();
  try {
    popular();
  } catch (erro) {
    log.warn('não foi possível popular dados de demonstração', { erro: String(erro) });
  }

  const app = await criarServidor();
  await app.listen({ port: c.API_PORT, host: '0.0.0.0' });

  log.info('API iniciada', { porta: c.API_PORT, ambiente: c.APP_ENV });
  console.log('');
  console.log('  FDC WhatsApp AI - API');
  console.log(`  http://localhost:${c.API_PORT}`);
  console.log(`  Documentação: http://localhost:${c.API_PORT}/docs`);
  console.log(
    `  Ambiente: ${c.APP_ENV} | Envio real pelo WhatsApp: ${envioRealPermitido() ? 'PERMITIDO' : 'BLOQUEADO'}`,
  );
  console.log('');
}

const executadoDiretamente = process.argv[1]?.includes('server');
if (executadoDiretamente) {
  iniciar().catch((erro) => {
    console.error('Falha ao iniciar a API:', erro instanceof Error ? erro.message : erro);
    process.exit(1);
  });
}
