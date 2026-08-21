import { beforeEach, describe, expect, it } from 'vitest';
import { CLIENTE_ANA, CLIENTE_BRUNO, conversar, prepararAmbiente } from './apoio.js';
import {
  adaptadores,
  auditoria,
  carregarFonteCombinacoes,
  metricas,
  pedidoDeMarketplace,
  preverRecompra,
  simulacao,
  sugerirCombinacoes,
} from '@fdc/core';

/**
 * Fluxos de venda: carrinho abandonado, recompra e cross-sell.
 * Tudo simulado. Nenhum envio ativo acontece em nenhum destes testes.
 */

beforeEach(() => {
  prepararAmbiente();
});

describe('Fonte das combinações', () => {
  it('lê as combinações e as durações do documento oficial', () => {
    const fonte = carregarFonteCombinacoes();
    expect(fonte.utilizavel).toBe(true);
    expect(fonte.combinacoes.length).toBeGreaterThan(0);
    expect(fonte.duracaoPorSku.get('DEMO-WHEY-900-BAU')).toBe(30);
  });

  it('não sugere nada quando o documento não pode ser usado', () => {
    const { fonte, sugestoes } = sugerirCombinacoes(['DEMO-VITC-60'], {
      pasta: 'tests/fixtures/conhecimento',
    });
    expect(fonte.utilizavel).toBe(false);
    expect(sugestoes).toHaveLength(0);
  });

  it('não repete o que o cliente já tem', () => {
    const { sugestoes } = sugerirCombinacoes(['DEMO-VITC-60', 'DEMO-VITD-60']);
    const sugeridos = sugestoes.flatMap((s) => s.skus);
    expect(sugeridos.every((sku) => !['DEMO-VITC-60', 'DEMO-VITD-60'].includes(sku))).toBe(true);
  });

  it('sugere itens da outra marca (Vitaminas x Nutrition)', () => {
    const { sugestoes } = sugerirCombinacoes(['DEMO-WHEY-900-BAU'], { limite: 3 });
    expect(sugestoes.flatMap((s) => s.skus)).toContain('DEMO-VITD-60');
  });
});

describe('Previsão de recompra', () => {
  const compradoHa = (dias: number) => new Date(Date.now() - dias * 86400000).toISOString();

  it('avisa quando o produto já deve ter acabado', () => {
    const { previsoes } = preverRecompra([{ sku: 'DEMO-WHEY-900-BAU' }], compradoHa(40));
    expect(previsoes[0]?.naHoraDeRepor).toBe(true);
    expect(previsoes[0]?.diasRestantes).toBeLessThan(0);
  });

  it('não avisa quando a compra é recente', () => {
    const { previsoes } = preverRecompra([{ sku: 'DEMO-CREA-300' }], compradoHa(10));
    expect(previsoes[0]?.naHoraDeRepor).toBe(false);
  });

  it('ignora SKU sem duração cadastrada, em vez de chutar', () => {
    const { previsoes } = preverRecompra([{ sku: 'SKU-INEXISTENTE' }], compradoHa(100));
    expect(previsoes).toHaveLength(0);
  });
});

describe('Carrinho abandonado', () => {
  it('mostra o carrinho do cliente e oferece link para retomar', async () => {
    const r = await conversar('deixei uns itens no carrinho', { remetente: CLIENTE_ANA });

    expect(r.intencao).toBe('carrinho_abandonado');
    expect(r.texto).toContain('Vitamina C');
    expect(r.texto).toContain('exemplo.invalido/cart');
    expect(r.links.some((l) => l.titulo === 'Retomar carrinho')).toBe(true);
    expect(r.transferidoParaHumano).toBe(false);
  });

  it('registra a oportunidade com o valor do carrinho', async () => {
    await conversar('deixei uns itens no carrinho', { remetente: CLIENTE_ANA });
    // 2x Vitamina C (R$ 69,90) + 1x Vitamina D (R$ 54,90)
    expect(metricas.somarValor('oportunidade_identificada')).toBe(6990 * 2 + 5490);
  });

  it('registra na auditoria que a identidade veio do canal', async () => {
    await conversar('deixei uns itens no carrinho', { remetente: CLIENTE_ANA });
    const registro = auditoria
      .listar()
      .find((e) => e.acao === 'carrinho:consultado_por_identidade_do_canal');
    expect(registro).toBeDefined();
  });

  it('não revela carrinho para número desconhecido', async () => {
    const r = await conversar('deixei uns itens no carrinho', { remetente: '+5511988887777' });
    expect(r.texto).toContain('Não encontrei nenhum carrinho');
    expect(r.texto).not.toContain('Vitamina');
    expect(r.regrasAcionadas).toContain('carrinho:numero_nao_reconhecido');
  });

  it('não mistura o carrinho de um cliente com o de outro', async () => {
    const r = await conversar('deixei uns itens no carrinho', { remetente: CLIENTE_BRUNO });
    expect(r.texto).toContain('Whey');
    expect(r.texto).not.toContain('Vitamina C');
  });

  it('transfere quando o sistema de carrinhos está fora do ar', async () => {
    simulacao.definir({ pedidosIndisponivel: true });
    const r = await conversar('deixei uns itens no carrinho', { remetente: CLIENTE_ANA });
    expect(r.transferidoParaHumano).toBe(true);
    expect(r.motivoEscalonamento).toBe('integracao_indisponivel');
  });

  it('não oferece link quando nada do carrinho tem estoque', async () => {
    simulacao.definir({ semEstoque: true });
    const r = await conversar('deixei uns itens no carrinho', { remetente: CLIENTE_ANA });
    expect(r.texto).toContain('nenhum desses itens está disponível');
    expect(r.links).toHaveLength(0);
  });
});

describe('Recompra', () => {
  it('usa a última compra e oferece reposição', async () => {
    const r = await conversar('acabou meu produto, quero comprar de novo', {
      remetente: CLIENTE_ANA,
    });

    expect(r.intencao).toBe('recompra');
    expect(r.texto).toContain('última compra');
    expect(r.texto).toContain('exemplo.invalido/cart');
    expect(r.texto).toContain('não substituem a orientação');
  });

  it('não expõe dado além do necessário', async () => {
    const r = await conversar('acabou meu produto, quero comprar de novo', {
      remetente: CLIENTE_ANA,
    });
    // Sem e-mail, sem telefone, sem nota fiscal, sem rastreio.
    expect(r.texto).not.toContain('@');
    expect(r.texto).not.toContain('Nota Fiscal');
    expect(r.texto).not.toContain('DEMOBR');
  });

  it('entende "acabou o meu" sem confundir com comparação de produtos', async () => {
    // "acabOU O meu" já foi classificado como comparação por causa de um termo
    // curto demais na lista. Este teste trava a correção.
    const r = await conversar('acabou o meu, quero comprar de novo', { remetente: CLIENTE_BRUNO });
    expect(r.intencao).toBe('recompra');
    expect(r.texto).toContain('última compra');
  });

  it('não revela histórico para número desconhecido', async () => {
    const r = await conversar('quero comprar de novo', { remetente: '+5511988886666' });
    expect(r.texto).toContain('Não encontrei uma compra anterior');
    expect(r.regrasAcionadas).toContain('recompra:numero_nao_reconhecido');
  });
});

describe('Combinações reais da loja (dados de venda)', () => {
  it('trabalha por família, não por tamanho de frasco', () => {
    const fonte = carregarFonteCombinacoes();
    // Vários SKUs de Ômega-3 caem na mesma família.
    expect(fonte.familiaPorSku.get('200564')).toBe('Ômega-3');
    expect(fonte.familiaPorSku.get('KIT-200622-2UN')).toBe('Ômega-3');
    expect(fonte.familiaPorSku.get('200585')).toBe('Ômega-3');
  });

  it('não sugere Ômega-3 para quem já está levando Ômega-3 em outro frasco', () => {
    const { sugestoes } = sugerirCombinacoes(['KIT-200622-2UN'], { limite: 5 });
    expect(sugestoes.every((s) => s.familia !== 'Ômega-3')).toBe(true);
  });

  it('sugere a dupla mais comprada junto na loja', () => {
    // Coenzima Q10 + Ômega-3 é o par mais frequente nas cestas reais.
    const { sugestoes } = sugerirCombinacoes(['200619'], { limite: 1 });
    expect(sugestoes[0]?.familia).toBe('Ômega-3');
    expect(sugestoes[0]?.skus.length).toBeGreaterThan(1);
  });

  it('o motivo mostrado ao cliente não faz promessa de saúde', () => {
    const fonte = carregarFonteCombinacoes();
    const proibido = [
      'cura',
      'trata',
      'previne',
      'imunidade',
      'emagrec',
      'melhora',
      'fortalece',
      'combate',
      'reduz',
      'ajuda a',
      'indicado para',
    ];
    for (const c of fonte.combinacoes) {
      const motivo = c.motivo.toLowerCase();
      for (const palavra of proibido) {
        expect(motivo).not.toContain(palavra);
      }
    }
  });

  it('só cadastra duração de produto em que a FDC informa os dias', () => {
    const fonte = carregarFonteCombinacoes();
    // A FDC informa no próprio título: Complexo B = 100 dias, Zinco = 90 dias.
    expect(fonte.duracaoPorSku.get('200630')).toBe(100);
    expect(fonte.duracaoPorSku.get('200647')).toBe(90);
    // Vitamina C não informa a duração: não pode ser chutada.
    expect(fonte.duracaoPorSku.has('200481')).toBe(false);
  });
});

describe('Proteção de marketplace', () => {
  it('reconhece pedido vindo de marketplace', () => {
    expect(
      pedidoDeMarketplace([
        { sku: null, titulo: 'Vitamina C 1000mg ... FDC Importado EUA (Not linked to Shopify)' },
        { sku: null, titulo: 'Order Adjustment: Shopee Rebate' },
      ]),
    ).toBe(true);
  });

  it('não confunde pedido normal do site com marketplace', () => {
    expect(pedidoDeMarketplace([{ sku: '200564', titulo: 'Ômega 3 FDC 1.000mg - 140 Unid' }])).toBe(
      false,
    );
  });

  it('não trata item sem SKU como marketplace se o título for normal', () => {
    expect(pedidoDeMarketplace([{ sku: null, titulo: 'Produto novo sem SKU' }])).toBe(false);
  });
});

describe('Cross-sell', () => {
  it('sugere combinação aprovada na busca de produto', async () => {
    const r = await conversar('procuro whey protein');
    expect(r.texto).toContain('Muita gente leva junto');
    expect(r.regrasAcionadas).toContain('crossell:sugestao_de_fonte_aprovada');
    expect(r.fontes.some((f) => f.referencia.includes('combinacoes-e-recompra'))).toBe(true);
  });

  it('não faz cross-sell em pergunta objetiva de preço', async () => {
    const r = await conversar('quanto custa o whey?');
    expect(r.texto).not.toContain('Muita gente leva junto');
  });

  it('nunca sugere produto sem estoque', async () => {
    simulacao.definir({ semEstoque: true });
    const r = await conversar('procuro whey protein');
    expect(r.texto).not.toContain('Muita gente leva junto');
  });

  it('não faz cross-sell quando uma regra de saúde é acionada', async () => {
    const r = await conversar('tenho diabetes, procuro whey protein');
    expect(r.transferidoParaHumano).toBe(true);
    expect(r.texto).not.toContain('Muita gente leva junto');
    expect(r.texto).not.toContain('R$');
  });

  it('não faz cross-sell para quem pediu para parar as mensagens', async () => {
    const r = await conversar('não quero mais receber mensagens, procuro whey');
    expect(r.intencao).toBe('parar_mensagens');
    expect(r.texto).not.toContain('Muita gente leva junto');
  });
});

describe('Nenhum envio ativo nestes fluxos', () => {
  it('carrinho e recompra só respondem, nunca disparam', async () => {
    const { caixaDeSaidaSimulada } = await import('@fdc/core');
    await conversar('deixei uns itens no carrinho', { remetente: CLIENTE_ANA });
    await conversar('quero repor meu produto', { remetente: CLIENTE_BRUNO });
    // O orquestrador não envia nada: quem envia é o webhook, e só em resposta.
    expect(caixaDeSaidaSimulada()).toHaveLength(0);
  });

  it('o adaptador de carrinhos do Shopify continua desabilitado', async () => {
    const { ShopifyCartProvider } = await import('@fdc/core');
    const provedor = new ShopifyCartProvider();
    expect(provedor.modo).toBe('real_desabilitado');
    const r = await provedor.maisRecenteDoCliente('cli_demo_ana');
    expect(r.ok).toBe(false);
  });

  it('o carrinho simulado aparece no status das integrações', () => {
    const carrinhos = adaptadores().carrinhos;
    expect(carrinhos.modo).toBe('mock');
  });
});
