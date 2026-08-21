import { carregarDocumentos, PASTA_PADRAO } from './index.js';

/**
 * Combinações de produtos e prazos de recompra.
 *
 * Tudo vem do documento `combinacoes-e-recompra.md`, que passa pelas MESMAS
 * regras de governança do resto da base: se ele não estiver aprovado e dentro
 * da validade, o agente simplesmente não sugere combinação nem calcula recompra.
 *
 * As combinações trabalham por FAMÍLIA de produto (Ômega-3, Vitamina C...), não
 * por SKU. Isso evita duas coisas: uma explosão de linhas para cada tamanho de
 * frasco, e sugerir Ômega-3 para quem já está levando Ômega-3 em outra embalagem.
 *
 * O agente nunca inventa uma combinação, e nunca a personaliza com informação
 * de saúde que o cliente tenha mencionado.
 */

export const DOCUMENTO_COMBINACOES = 'combinacoes-e-recompra';

export interface Combinacao {
  familiaA: string;
  familiaB: string;
  motivo: string;
}

export interface FonteCombinacoes {
  utilizavel: boolean;
  motivoIndisponivel: string | null;
  combinacoes: Combinacao[];
  /** SKU (maiúsculas) -> nome da família. */
  familiaPorSku: Map<string, string>;
  /** Família -> SKUs que pertencem a ela, na ordem do documento. */
  skusPorFamilia: Map<string, string[]>;
  duracaoPorSku: Map<string, number>;
  referencia: string;
}

function fonteVazia(motivo: string, referencia = DOCUMENTO_COMBINACOES): FonteCombinacoes {
  return {
    utilizavel: false,
    motivoIndisponivel: motivo,
    combinacoes: [],
    familiaPorSku: new Map(),
    skusPorFamilia: new Map(),
    duracaoPorSku: new Map(),
    referencia,
  };
}

type Secao = 'familias' | 'combinacoes' | 'duracao' | 'outra';

/** Descobre a seção pelo título, para não depender do número de colunas. */
function secaoDoTitulo(titulo: string): Secao {
  const alvo = titulo.toLowerCase();
  if (alvo.includes('famil') || alvo.includes('famíl')) return 'familias';
  if (alvo.includes('combina')) return 'combinacoes';
  if (alvo.includes('dura')) return 'duracao';
  return 'outra';
}

function celulasDaLinha(linha: string): string[] {
  return linha
    .trim()
    .replace(/^\||\|$/g, '')
    .split('|')
    .map((c) => c.trim());
}

const ehSeparador = (celulas: string[]) => celulas.every((c) => /^:?-{2,}:?$/.test(c) || c === '');

export function carregarFonteCombinacoes(pasta = PASTA_PADRAO): FonteCombinacoes {
  const doc = carregarDocumentos(pasta).find((d) => d.id === DOCUMENTO_COMBINACOES);
  if (!doc) return fonteVazia('Documento de combinações não encontrado.');
  if (!doc.utilizavel) {
    return fonteVazia(
      doc.motivoIndisponivel ?? 'Documento não liberado para uso.',
      `${doc.id} · ${doc.fonte}`,
    );
  }

  const combinacoes: Combinacao[] = [];
  const familiaPorSku = new Map<string, string>();
  const skusPorFamilia = new Map<string, string[]>();
  const duracaoPorSku = new Map<string, number>();

  let secao: Secao = 'outra';
  let cabecalhoPulado = false;

  for (const linha of doc.conteudo.split('\n')) {
    if (linha.startsWith('#')) {
      secao = secaoDoTitulo(linha.replace(/^#+\s*/, ''));
      cabecalhoPulado = false;
      continue;
    }
    if (!linha.trim().startsWith('|')) continue;

    const celulas = celulasDaLinha(linha);
    if (ehSeparador(celulas)) continue;
    if (!cabecalhoPulado) {
      // A primeira linha de cada tabela é o cabeçalho.
      cabecalhoPulado = true;
      continue;
    }

    if (secao === 'familias' && celulas.length >= 2 && celulas[0] && celulas[1]) {
      const sku = celulas[0].toUpperCase();
      const familia = celulas[1];
      familiaPorSku.set(sku, familia);
      const lista = skusPorFamilia.get(familia) ?? [];
      lista.push(sku);
      skusPorFamilia.set(familia, lista);
      continue;
    }

    if (secao === 'combinacoes' && celulas.length >= 3 && celulas[0] && celulas[1] && celulas[2]) {
      combinacoes.push({ familiaA: celulas[0], familiaB: celulas[1], motivo: celulas[2] });
      continue;
    }

    if (secao === 'duracao' && celulas.length >= 2 && celulas[0]) {
      const dias = Number.parseInt(celulas[1] ?? '', 10);
      if (Number.isFinite(dias) && dias > 0) duracaoPorSku.set(celulas[0].toUpperCase(), dias);
    }
  }

  return {
    utilizavel: true,
    motivoIndisponivel: null,
    combinacoes,
    familiaPorSku,
    skusPorFamilia,
    duracaoPorSku,
    referencia: `${doc.id} · ${doc.fonte}`,
  };
}

export interface SugestaoCombinacao {
  familia: string;
  /** SKUs dessa família, para o agente tentar em ordem até achar um com estoque. */
  skus: string[];
  motivo: string;
}

/**
 * Devolve as famílias que combinam com o que o cliente já tem, sem repetir
 * nenhuma família que ele já esteja levando.
 */
export function sugerirCombinacoes(
  skusDoCliente: string[],
  opcoes: { pasta?: string; limite?: number } = {},
): { fonte: FonteCombinacoes; sugestoes: SugestaoCombinacao[] } {
  const fonte = carregarFonteCombinacoes(opcoes.pasta);
  if (!fonte.utilizavel) return { fonte, sugestoes: [] };

  const familiasDoCliente = new Set(
    skusDoCliente
      .map((sku) => fonte.familiaPorSku.get(sku.toUpperCase()))
      .filter((f): f is string => Boolean(f)),
  );
  if (familiasDoCliente.size === 0) return { fonte, sugestoes: [] };

  const vistas = new Set<string>();
  const sugestoes: SugestaoCombinacao[] = [];

  for (const combinacao of fonte.combinacoes) {
    const temA = familiasDoCliente.has(combinacao.familiaA);
    const temB = familiasDoCliente.has(combinacao.familiaB);
    if (temA === temB) continue; // não tem nenhuma, ou já tem as duas

    const candidata = temA ? combinacao.familiaB : combinacao.familiaA;
    if (vistas.has(candidata)) continue;

    const skus = fonte.skusPorFamilia.get(candidata) ?? [];
    if (skus.length === 0) continue;

    vistas.add(candidata);
    sugestoes.push({ familia: candidata, skus, motivo: combinacao.motivo });
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
      const duracaoDias = fonte.duracaoPorSku.get(item.sku.toUpperCase());
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
