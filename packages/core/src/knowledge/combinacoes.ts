import { carregarDocumentos, PASTA_PADRAO } from './index.js';

/**
 * Combinações de produtos e prazos de recompra.
 *
 * Tudo vem do documento `combinacoes-e-recompra.md`, que passa pelas MESMAS
 * regras de governança do resto da base: se ele não estiver aprovado e dentro
 * da validade, o agente simplesmente não sugere combinação nem calcula recompra.
 *
 * O agente nunca inventa uma combinação, e nunca a personaliza com informação
 * de saúde que o cliente tenha mencionado.
 */

export const DOCUMENTO_COMBINACOES = 'combinacoes-e-recompra';

export interface Combinacao {
  skuA: string;
  skuB: string;
  motivo: string;
}

export interface FonteCombinacoes {
  utilizavel: boolean;
  motivoIndisponivel: string | null;
  combinacoes: Combinacao[];
  duracaoPorSku: Map<string, number>;
  referencia: string;
}

const VAZIO: FonteCombinacoes = {
  utilizavel: false,
  motivoIndisponivel: 'Documento de combinações não encontrado.',
  combinacoes: [],
  duracaoPorSku: new Map(),
  referencia: DOCUMENTO_COMBINACOES,
};

/** Lê as linhas de uma tabela markdown, ignorando cabeçalho e separador. */
function linhasDeTabela(conteudo: string): string[][] {
  return conteudo
    .split('\n')
    .filter((linha) => linha.trim().startsWith('|'))
    .map((linha) =>
      linha
        .trim()
        .replace(/^\||\|$/g, '')
        .split('|')
        .map((celula) => celula.trim()),
    )
    .filter((celulas) => celulas.length >= 2)
    .filter((celulas) => !celulas.every((c) => /^-{2,}$/.test(c) || c === ''))
    .filter((celulas) => !/^sku a$/i.test(celulas[0] ?? '') && !/^sku$/i.test(celulas[0] ?? ''));
}

export function carregarFonteCombinacoes(pasta = PASTA_PADRAO): FonteCombinacoes {
  const doc = carregarDocumentos(pasta).find((d) => d.id === DOCUMENTO_COMBINACOES);
  if (!doc) return VAZIO;

  if (!doc.utilizavel) {
    return {
      utilizavel: false,
      motivoIndisponivel: doc.motivoIndisponivel ?? 'Documento não liberado para uso.',
      combinacoes: [],
      duracaoPorSku: new Map(),
      referencia: `${doc.id} · ${doc.fonte}`,
    };
  }

  const combinacoes: Combinacao[] = [];
  const duracaoPorSku = new Map<string, number>();

  for (const celulas of linhasDeTabela(doc.conteudo)) {
    // Tabela de combinações: SKU A | SKU B | Motivo
    if (celulas.length >= 3 && celulas[0] && celulas[1] && celulas[2]) {
      combinacoes.push({ skuA: celulas[0], skuB: celulas[1], motivo: celulas[2] });
      continue;
    }
    // Tabela de duração: SKU | Dias
    if (celulas.length === 2 && celulas[0]) {
      const dias = Number.parseInt(celulas[1] ?? '', 10);
      if (Number.isFinite(dias) && dias > 0) duracaoPorSku.set(celulas[0], dias);
    }
  }

  return {
    utilizavel: true,
    motivoIndisponivel: null,
    combinacoes,
    duracaoPorSku,
    referencia: `${doc.id} · ${doc.fonte}`,
  };
}

/**
 * Devolve os SKUs que combinam com os informados, sem repetir o que o cliente
 * já tem no carrinho ou no pedido.
 */
export function sugerirCombinacoes(
  skusDoCliente: string[],
  opcoes: { pasta?: string; limite?: number } = {},
): { fonte: FonteCombinacoes; sugestoes: Array<{ sku: string; motivo: string }> } {
  const fonte = carregarFonteCombinacoes(opcoes.pasta);
  if (!fonte.utilizavel) return { fonte, sugestoes: [] };

  const jaTem = new Set(skusDoCliente.map((s) => s.toUpperCase()));
  const vistos = new Set<string>();
  const sugestoes: Array<{ sku: string; motivo: string }> = [];

  for (const combinacao of fonte.combinacoes) {
    const a = combinacao.skuA.toUpperCase();
    const b = combinacao.skuB.toUpperCase();
    const candidato = jaTem.has(a) && !jaTem.has(b) ? b : jaTem.has(b) && !jaTem.has(a) ? a : null;
    if (!candidato || vistos.has(candidato)) continue;
    vistos.add(candidato);
    sugestoes.push({ sku: candidato, motivo: combinacao.motivo });
    if (sugestoes.length >= (opcoes.limite ?? 2)) break;
  }

  return { fonte, sugestoes };
}

export interface PrevisaoRecompra {
  sku: string;
  duracaoDias: number;
  diasDesdeACompra: number;
  diasRestantes: number;
  /** true quando o produto provavelmente já acabou ou está para acabar. */
  naHoraDeRepor: boolean;
}

/** Estima se o produto comprado já está acabando, usando a duração do rótulo. */
export function preverRecompra(
  itens: Array<{ sku: string }>,
  compradoEm: string,
  opcoes: { pasta?: string; agoraMs?: number; margemDias?: number } = {},
): { fonte: FonteCombinacoes; previsoes: PrevisaoRecompra[] } {
  const fonte = carregarFonteCombinacoes(opcoes.pasta);
  if (!fonte.utilizavel) return { fonte, previsoes: [] };

  const agoraMs = opcoes.agoraMs ?? Date.now();
  const margem = opcoes.margemDias ?? 7;
  const compra = Date.parse(compradoEm);
  if (Number.isNaN(compra)) return { fonte, previsoes: [] };

  const diasDesdeACompra = Math.floor((agoraMs - compra) / (24 * 3600 * 1000));

  const previsoes = itens
    .map((item) => {
      const duracaoDias =
        fonte.duracaoPorSku.get(item.sku.toUpperCase()) ?? fonte.duracaoPorSku.get(item.sku);
      if (!duracaoDias) return null;
      const diasRestantes = duracaoDias - diasDesdeACompra;
      return {
        sku: item.sku,
        duracaoDias,
        diasDesdeACompra,
        diasRestantes,
        naHoraDeRepor: diasRestantes <= margem,
      } satisfies PrevisaoRecompra;
    })
    .filter((p): p is PrevisaoRecompra => p !== null);

  return { fonte, previsoes };
}
