import { z } from 'zod';

/**
 * Leitura e validacao das variaveis de ambiente.
 * Regra de ouro: tudo que envolve envio real ou custo comeca DESLIGADO.
 */

const booleano = (padrao: boolean) =>
  z
    .string()
    .optional()
    .transform((v) => (v === undefined || v === '' ? padrao : v.toLowerCase() === 'true'));

const inteiro = (padrao: number) =>
  z
    .string()
    .optional()
    .transform((v) => (v === undefined || v === '' ? padrao : Number.parseInt(v, 10)))
    .pipe(z.number().int().positive());

const textoOpcional = z
  .string()
  .optional()
  .transform((v) => (v === undefined || v.trim() === '' ? null : v.trim()));

const esquema = z.object({
  NODE_ENV: z.string().default('development'),
  APP_ENV: z.enum(['dev', 'teste', 'producao']).default('dev'),
  LOG_LEVEL: z.string().default('info'),
  API_PORT: inteiro(3333),
  ADMIN_PORT: inteiro(3000),
  CORS_ORIGINS: z.string().default('http://localhost:3000'),
  DATABASE_FILE: z.string().default('./data/runtime/fdc.db'),

  AI_ENABLED: booleano(true),
  WHATSAPP_ENABLED: booleano(true),
  HUMAN_ONLY_MODE: booleano(false),
  OUTBOUND_CAMPAIGNS_ENABLED: booleano(false),
  WHATSAPP_LIVE_ENABLED: booleano(false),

  WHATSAPP_PROVIDER: z.enum(['mock', 'meta']).default('mock'),
  CATALOG_PROVIDER: z.enum(['mock', 'shopify']).default('mock'),
  ORDER_PROVIDER: z.enum(['mock', 'shopify']).default('mock'),
  INVOICE_PROVIDER: z.enum(['mock', 'sap']).default('mock'),
  TRACKING_PROVIDER: z
    .enum(['mock', 'mandae', 'correios', 'fonteslog', 'tmlogistica'])
    .default('mock'),
  LLM_PROVIDER: z.enum(['mock', 'anthropic']).default('mock'),

  META_APP_SECRET: textoOpcional,
  META_PHONE_NUMBER_ID: textoOpcional,
  META_ACCESS_TOKEN: textoOpcional,
  META_WEBHOOK_VERIFY_TOKEN: textoOpcional,
  META_GRAPH_VERSION: z.string().default('v21.0'),

  SHOPIFY_STORE_DOMAIN: textoOpcional,
  SHOPIFY_ADMIN_TOKEN: textoOpcional,
  SHOPIFY_API_VERSION: z.string().default('2025-01'),
  SHOPIFY_STOREFRONT_BASE_URL: textoOpcional,

  SAP_BASE_URL: textoOpcional,
  ANTHROPIC_API_KEY: textoOpcional,
  ANTHROPIC_MODEL: textoOpcional,
  LLM_MAX_OUTPUT_TOKENS: inteiro(1024),

  ADMIN_AUTH_ENABLED: booleano(true),
  ADMIN_USER: z.string().default('admin'),
  ADMIN_PASSWORD: textoOpcional,
  ADMIN_SESSION_SECRET: textoOpcional,

  RETENTION_CONVERSATIONS_DAYS: inteiro(180),
  RETENTION_AUDIT_DAYS: inteiro(365),
  RETENTION_HEALTH_FLAGS_DAYS: inteiro(30),
  PII_MASKING_ENABLED: booleano(true),

  RATE_LIMIT_MAX_PER_MINUTE: inteiro(60),
  INTEGRATION_TIMEOUT_MS: inteiro(8000),
  CIRCUIT_BREAKER_FAILURES: inteiro(3),
  CIRCUIT_BREAKER_COOLDOWN_MS: inteiro(30000),
  CAMPAIGN_MAX_PER_CUSTOMER_PER_WEEK: inteiro(1),
});

export type Config = z.infer<typeof esquema>;

let cache: Config | null = null;

export function carregarConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const analisado = esquema.safeParse(env);
  if (!analisado.success) {
    const problemas = analisado.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`);
    throw new Error(`Configuracao invalida no .env:\n- ${problemas.join('\n- ')}`);
  }
  return analisado.data;
}

export function config(): Config {
  if (!cache) cache = carregarConfig();
  return cache;
}

/** Usado apenas em testes para trocar a configuracao. */
export function definirConfigParaTeste(parcial: Partial<Config>): Config {
  cache = { ...config(), ...parcial };
  return cache;
}

export function limparCacheConfig(): void {
  cache = null;
}

/**
 * TRAVA TECNICA. Precisa de DUAS condicoes verdadeiras ao mesmo tempo para
 * permitir envio real: provedor "meta" E WHATSAPP_LIVE_ENABLED=true.
 * Em ambiente dev/teste o envio real e SEMPRE bloqueado.
 */
export function envioRealPermitido(c: Config = config()): boolean {
  if (c.APP_ENV !== 'producao') return false;
  if (c.WHATSAPP_PROVIDER !== 'meta') return false;
  if (!c.WHATSAPP_LIVE_ENABLED) return false;
  if (!c.WHATSAPP_ENABLED) return false;
  return Boolean(c.META_ACCESS_TOKEN && c.META_PHONE_NUMBER_ID);
}
