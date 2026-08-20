import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { basename, resolve } from 'node:path';
import {
  normalizar,
  type Canal,
  type DocumentoConhecimento,
  type StatusConhecimento,
} from '@fdc/shared';
import { config } from '../config.js';
import { doProjeto } from '../caminhos.js';

/**
 * Base de conhecimento em arquivos Markdown com cabecalho de governanca.
 *
 * Um documento so pode ser usado como fonte oficial em PRODUCAO quando:
 *   - status = "aprovado", e
 *   - a data de proxima revisao ainda nao passou.
 *
 * Em ambiente de desenvolvimento/teste, rascunhos sao permitidos, mas ficam
 * marcados na resposta (regra "conhecimento:rascunho_permitido_fora_de_producao")
 * para que ninguem confunda protótipo com conteudo oficial.
 */

export const PASTA_PADRAO = 'data/knowledge';

interface Cabecalho {
  titulo?: string;
  fonte?: string;
  atualizado_em?: string;
  aprovado_por?: string;
  status?: string;
  canais?: string[];
  proxima_revisao?: string;
}

/** Leitor simples de front-matter YAML (chaves planas, strings e listas). */
export function lerCabecalho(bruto: string): { cabecalho: Cabecalho; corpo: string } {
  if (!bruto.startsWith('---')) return { cabecalho: {}, corpo: bruto };
  const fim = bruto.indexOf('\n---', 3);
  if (fim === -1) return { cabecalho: {}, corpo: bruto };
  const blocoBruto = bruto.slice(3, fim).trim();
  const corpo = bruto.slice(fim + 4).replace(/^\n/, '');
  const cabecalho: Cabecalho = {};

  for (const linha of blocoBruto.split('\n')) {
    const separador = linha.indexOf(':');
    if (separador === -1) continue;
    const chave = linha.slice(0, separador).trim();
    let valor = linha.slice(separador + 1).trim();
    if (valor.startsWith('[') && valor.endsWith(']')) {
      const lista = valor
        .slice(1, -1)
        .split(',')
        .map((v) => v.trim().replace(/^["']|["']$/g, ''))
        .filter(Boolean);
      (cabecalho as Record<string, unknown>)[chave] = lista;
      continue;
    }
    valor = valor.replace(/^["']|["']$/g, '');
    (cabecalho as Record<string, unknown>)[chave] = valor;
  }
  return { cabecalho, corpo };
}

function avaliarDisponibilidade(
  status: StatusConhecimento,
  proximaRevisao: string,
  hoje: Date,
): { utilizavel: boolean; motivo: string | null } {
  const producao = config().APP_ENV === 'producao';
  const data = Date.parse(proximaRevisao);
  const vencido = !Number.isNaN(data) && data < hoje.getTime();

  if (status === 'expirado')
    return { utilizavel: false, motivo: 'Documento marcado como expirado.' };
  if (vencido) return { utilizavel: false, motivo: 'Revisão vencida. Precisa ser revalidado.' };
  if (status === 'aprovado') return { utilizavel: true, motivo: null };
  // status === 'rascunho'
  if (producao) return { utilizavel: false, motivo: 'Documento ainda não aprovado.' };
  return { utilizavel: true, motivo: 'Rascunho aceito apenas fora de produção.' };
}

export function carregarDocumentos(
  pasta = PASTA_PADRAO,
  hoje = new Date(),
): DocumentoConhecimento[] {
  const caminho = doProjeto(pasta);
  if (!existsSync(caminho)) return [];
  return readdirSync(caminho)
    .filter((a) => a.endsWith('.md'))
    .sort()
    .map((arquivo) => {
      const bruto = readFileSync(resolve(caminho, arquivo), 'utf8');
      const { cabecalho, corpo } = lerCabecalho(bruto);
      const status = (['rascunho', 'aprovado', 'expirado'] as const).includes(
        cabecalho.status as StatusConhecimento,
      )
        ? (cabecalho.status as StatusConhecimento)
        : 'rascunho';
      const proximaRevisao = cabecalho.proxima_revisao ?? '1970-01-01';
      const { utilizavel, motivo } = avaliarDisponibilidade(status, proximaRevisao, hoje);
      return {
        id: basename(arquivo, '.md'),
        arquivo,
        titulo: cabecalho.titulo ?? basename(arquivo, '.md'),
        fonte: cabecalho.fonte ?? 'não informada',
        atualizadoEm: cabecalho.atualizado_em ?? 'não informada',
        aprovadoPor: cabecalho.aprovado_por ?? 'não informado',
        status,
        canais: (cabecalho.canais ?? ['whatsapp']) as Canal[],
        proximaRevisaoEm: proximaRevisao,
        conteudo: corpo.trim(),
        utilizavel,
        motivoIndisponivel: motivo,
      } satisfies DocumentoConhecimento;
    });
}

export interface TrechoEncontrado {
  documentoId: string;
  titulo: string;
  trecho: string;
  fonte: string;
}

/**
 * Busca trechos relevantes APENAS em documentos utilizaveis.
 * Se nada for encontrado, o agente admite que nao tem fonte oficial.
 */
export function buscarTrechos(
  termo: string,
  opcoes: { pasta?: string; canal?: Canal; limite?: number } = {},
): TrechoEncontrado[] {
  const { pasta = PASTA_PADRAO, canal, limite = 3 } = opcoes;
  const palavras = normalizar(termo)
    .split(' ')
    .filter((p) => p.length >= 4);
  if (palavras.length === 0) return [];

  const encontrados: TrechoEncontrado[] = [];
  for (const doc of carregarDocumentos(pasta)) {
    if (!doc.utilizavel) continue;
    if (canal && !doc.canais.includes(canal)) continue;
    const paragrafos = doc.conteudo.split(/\n{2,}/);
    for (const paragrafo of paragrafos) {
      const alvo = normalizar(paragrafo);
      const acertos = palavras.filter((p) => alvo.includes(p)).length;
      if (acertos > 0 && paragrafo.trim().length > 20) {
        encontrados.push({
          documentoId: doc.id,
          titulo: doc.titulo,
          trecho: paragrafo.trim().slice(0, 500),
          fonte: doc.fonte,
        });
      }
      if (encontrados.length >= limite) return encontrados;
    }
  }
  return encontrados;
}

/** Resumo para o painel: quantos documentos estao prontos para uso. */
export function resumoConhecimento(pasta = PASTA_PADRAO) {
  const docs = carregarDocumentos(pasta);
  return {
    total: docs.length,
    aprovados: docs.filter((d) => d.status === 'aprovado').length,
    rascunhos: docs.filter((d) => d.status === 'rascunho').length,
    expirados: docs.filter((d) => d.status === 'expirado').length,
    utilizaveis: docs.filter((d) => d.utilizavel).length,
    bloqueados: docs.filter((d) => !d.utilizavel).length,
  };
}
