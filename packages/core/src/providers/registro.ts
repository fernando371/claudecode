import type { StatusIntegracao } from '@fdc/shared';
import { config, envioRealPermitido } from '../config.js';
import { MockCatalogProvider } from './catalog/mock.js';
import { ShopifyCatalogProvider } from './catalog/shopify.js';
import type { CatalogProvider } from './catalog/tipos.js';
import { MockInvoiceProvider } from './invoice/mock.js';
import { SapInvoiceProvider } from './invoice/sap.js';
import type { InvoiceProvider } from './invoice/tipos.js';
import { AnthropicLLMProvider } from './llm/anthropic.js';
import { MockLLMProvider } from './llm/mock.js';
import type { LLMProvider } from './llm/tipos.js';
import { MockOrderProvider } from './orders/mock.js';
import { ShopifyOrderProvider } from './orders/shopify.js';
import type { OrderProvider } from './orders/tipos.js';
import { MockTrackingProvider } from './tracking/mock.js';
import type { TrackingProvider } from './tracking/tipos.js';
import { transportadoraPorNome } from './tracking/transportadoras.js';
import { MetaWhatsAppCloudProvider } from './whatsapp/meta.js';
import { MockWhatsAppProvider } from './whatsapp/mock.js';
import type { WhatsAppProvider } from './whatsapp/tipos.js';

export interface Adaptadores {
  whatsapp: WhatsAppProvider;
  catalogo: CatalogProvider;
  pedidos: OrderProvider;
  notaFiscal: InvoiceProvider;
  rastreio: TrackingProvider;
  llm: LLMProvider;
}

/** Monta o conjunto de adaptadores conforme o .env. Padrao: tudo simulado. */
export function adaptadores(): Adaptadores {
  const c = config();
  return {
    whatsapp:
      c.WHATSAPP_PROVIDER === 'meta' ? new MetaWhatsAppCloudProvider() : new MockWhatsAppProvider(),
    catalogo:
      c.CATALOG_PROVIDER === 'shopify' ? new ShopifyCatalogProvider() : new MockCatalogProvider(),
    pedidos: c.ORDER_PROVIDER === 'shopify' ? new ShopifyOrderProvider() : new MockOrderProvider(),
    notaFiscal: c.INVOICE_PROVIDER === 'sap' ? new SapInvoiceProvider() : new MockInvoiceProvider(),
    rastreio:
      c.TRACKING_PROVIDER === 'mock'
        ? new MockTrackingProvider()
        : (transportadoraPorNome(c.TRACKING_PROVIDER) ?? new MockTrackingProvider()),
    llm: c.LLM_PROVIDER === 'anthropic' ? new AnthropicLLMProvider() : new MockLLMProvider(),
  };
}

/** Painel: "Status das integracoes". Nunca expoe segredos, so o estado. */
export function statusIntegracoes(): StatusIntegracao[] {
  const a = adaptadores();
  const c = config();
  const descrever = (modo: string) =>
    modo === 'mock'
      ? 'Simulado (sem internet, sem custo)'
      : modo === 'real_habilitado'
        ? 'Real habilitado'
        : 'Real preparado, porém desabilitado (faltam credenciais ou autorização)';

  return [
    {
      nome: 'WhatsApp',
      adaptador: a.whatsapp.nome,
      modo: a.whatsapp.modo,
      saudavel: true,
      detalhe: `${descrever(a.whatsapp.modo)} · Envio real permitido: ${envioRealPermitido() ? 'SIM' : 'NÃO'}`,
    },
    {
      nome: 'Catálogo (Shopify)',
      adaptador: a.catalogo.nome,
      modo: a.catalogo.modo,
      saudavel: true,
      detalhe: `${descrever(a.catalogo.modo)} · Somente leitura`,
    },
    {
      nome: 'Pedidos (Shopify)',
      adaptador: a.pedidos.nome,
      modo: a.pedidos.modo,
      saudavel: true,
      detalhe: `${descrever(a.pedidos.modo)} · Exige verificação de identidade`,
    },
    {
      nome: 'Nota Fiscal (SAP)',
      adaptador: a.notaFiscal.nome,
      modo: a.notaFiscal.modo,
      saudavel: a.notaFiscal.modo === 'mock',
      detalhe:
        a.notaFiscal.modo === 'mock'
          ? descrever('mock')
          : 'Contrato criado; implementação real pendente de documentação do SAP',
    },
    {
      nome: 'Rastreio (logística)',
      adaptador: a.rastreio.nome,
      modo: a.rastreio.modo,
      saudavel: a.rastreio.modo === 'mock',
      detalhe: `${descrever(a.rastreio.modo)} · Transportadora: ${a.rastreio.transportadora}`,
    },
    {
      nome: 'Inteligência artificial',
      adaptador: a.llm.nome,
      modo: a.llm.modo,
      saudavel: true,
      detalhe:
        a.llm.modo === 'mock'
          ? 'Simulado e determinístico (sem custo)'
          : 'API da Anthropic — cobrança separada da assinatura do Claude Code',
    },
    {
      nome: 'Campanhas (envio ativo)',
      adaptador: 'motorDeCampanhas',
      modo: c.OUTBOUND_CAMPAIGNS_ENABLED ? 'real_habilitado' : 'real_desabilitado',
      saudavel: true,
      detalhe: c.OUTBOUND_CAMPAIGNS_ENABLED
        ? 'ATENÇÃO: envio ativo habilitado'
        : 'Desabilitado nesta fase (correto)',
    },
  ];
}
