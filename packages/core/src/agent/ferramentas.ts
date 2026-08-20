import { z } from 'zod';
import type { Intencao, Resultado } from '@fdc/shared';
import { auditoria } from '../db/repositorios.js';
import { adaptadores } from '../providers/registro.js';

/**
 * LISTA FECHADA DE FERRAMENTAS.
 *
 * A IA NUNCA chama Shopify, SAP ou transportadora diretamente. Toda acao
 * passa por uma ferramenta desta lista, com:
 *   - esquema de entrada validado (zod)
 *   - permissao minima (somente leitura)
 *   - limite por conversa
 *   - registro de auditoria
 */

export const ESQUEMAS = {
  buscar_produto: z.object({
    termo: z.string().min(2).max(120),
    limite: z.number().int().min(1).max(5).optional(),
  }),
  detalhar_produto: z.object({ sku: z.string().min(2).max(60) }),
  gerar_link_carrinho: z.object({
    itens: z
      .array(
        z.object({ sku: z.string().min(2).max(60), quantidade: z.number().int().min(1).max(10) }),
      )
      .min(1)
      .max(10),
  }),
  consultar_pedido: z.object({
    numeroPedido: z.string().min(3).max(30),
    email: z.string().email().nullable().optional(),
    telefone: z.string().min(8).max(20).nullable().optional(),
  }),
  consultar_nota_fiscal: z.object({ numeroPedido: z.string().min(3).max(30) }),
  consultar_rastreio: z.object({ codigo: z.string().min(4).max(60) }),
  buscar_conhecimento: z.object({ termo: z.string().min(3).max(160) }),
  consultar_carrinho_abandonado: z.object({ clienteId: z.string().min(3).max(80) }),
  consultar_ultimo_pedido: z.object({ clienteId: z.string().min(3).max(80) }),
  sugerir_combinacao: z.object({
    skus: z.array(z.string().min(2).max(60)).min(1).max(10),
    limite: z.number().int().min(1).max(3).optional(),
  }),
} as const;

export type NomeFerramenta = keyof typeof ESQUEMAS;

export const FERRAMENTAS: readonly NomeFerramenta[] = Object.keys(ESQUEMAS) as NomeFerramenta[];

/** Quais ferramentas cada intencao pode usar. Nada fora disso e permitido. */
export const FERRAMENTAS_POR_INTENCAO: Record<Intencao, readonly NomeFerramenta[]> = {
  saudacao: [],
  busca_produto: [
    'buscar_produto',
    'detalhar_produto',
    'sugerir_combinacao',
    'gerar_link_carrinho',
  ],
  comparacao_produtos: ['buscar_produto', 'detalhar_produto'],
  preco: ['buscar_produto', 'detalhar_produto', 'gerar_link_carrinho'],
  estoque: ['buscar_produto', 'detalhar_produto'],
  composicao: ['buscar_produto', 'detalhar_produto', 'buscar_conhecimento'],
  modo_de_uso: ['buscar_produto', 'detalhar_produto', 'buscar_conhecimento'],
  frete: ['buscar_conhecimento'],
  prazo: ['buscar_conhecimento'],
  status_pedido: ['consultar_pedido', 'consultar_nota_fiscal', 'consultar_rastreio'],
  nota_fiscal: ['consultar_pedido', 'consultar_nota_fiscal'],
  rastreio: ['consultar_pedido', 'consultar_rastreio'],
  atraso: ['consultar_pedido', 'consultar_rastreio'],
  troca_devolucao: ['consultar_pedido', 'buscar_conhecimento'],
  produto_avariado: [],
  reacao_adversa: [],
  falar_atendente: [],
  carrinho_abandonado: [
    'consultar_carrinho_abandonado',
    'detalhar_produto',
    'sugerir_combinacao',
    'gerar_link_carrinho',
    'buscar_produto',
  ],
  recompra: [
    'consultar_ultimo_pedido',
    'detalhar_produto',
    'sugerir_combinacao',
    'gerar_link_carrinho',
    'buscar_produto',
  ],
  parar_mensagens: [],
  desconhecida: ['buscar_conhecimento'],
};

/** Limite de chamadas de ferramenta por mensagem, para conter abuso. */
export const LIMITE_FERRAMENTAS_POR_MENSAGEM = 6;

export interface ContextoFerramenta {
  conversaId: string;
  clienteId: string;
  intencao: Intencao;
  usadas: string[];
}

export function ferramentaPermitida(intencao: Intencao, nome: string): boolean {
  return (FERRAMENTAS_POR_INTENCAO[intencao] ?? []).includes(nome as NomeFerramenta);
}

/**
 * Ponto unico de execucao de ferramenta. Valida permissao, valida entrada,
 * executa e registra auditoria. Qualquer chamada fora do padrao e negada.
 */
export async function executarFerramenta(
  ctx: ContextoFerramenta,
  nome: string,
  entrada: unknown,
): Promise<Resultado<unknown>> {
  const negar = (
    motivo: string,
    codigo: 'nao_autorizado' | 'entrada_invalida',
  ): Resultado<unknown> => {
    auditoria.registrar({
      ator: `agente:${ctx.clienteId}`,
      acao: `ferramenta:${nome}`,
      recurso: ctx.conversaId,
      resultado: 'negado',
      detalhe: motivo,
    });
    return { ok: false, erro: { codigo, mensagem: motivo, origem: 'ferramentas' } };
  };

  if (!FERRAMENTAS.includes(nome as NomeFerramenta)) {
    return negar(`Ferramenta desconhecida: ${nome}`, 'nao_autorizado');
  }
  if (!ferramentaPermitida(ctx.intencao, nome)) {
    return negar(
      `Ferramenta ${nome} nao permitida para a intencao ${ctx.intencao}`,
      'nao_autorizado',
    );
  }
  if (ctx.usadas.length >= LIMITE_FERRAMENTAS_POR_MENSAGEM) {
    return negar('Limite de ferramentas por mensagem atingido', 'nao_autorizado');
  }

  const esquema = ESQUEMAS[nome as NomeFerramenta];
  const validado = esquema.safeParse(entrada);
  if (!validado.success) {
    return negar(`Entrada invalida para ${nome}`, 'entrada_invalida');
  }

  ctx.usadas.push(nome);
  const a = adaptadores();
  const dados: unknown = validado.data;

  let resultado: Resultado<unknown>;
  switch (nome as NomeFerramenta) {
    case 'buscar_produto':
      resultado = await a.catalogo.buscar(
        (dados as { termo: string }).termo,
        (dados as { limite?: number }).limite ?? 3,
      );
      break;
    case 'detalhar_produto':
      resultado = await a.catalogo.porSku((dados as { sku: string }).sku);
      break;
    case 'gerar_link_carrinho':
      resultado = await a.catalogo.linkCarrinho(
        (dados as { itens: Array<{ sku: string; quantidade: number }> }).itens,
      );
      break;
    case 'consultar_pedido': {
      const d = dados as unknown as {
        numeroPedido: string;
        email?: string | null;
        telefone?: string | null;
      };
      resultado = await a.pedidos.buscarComVerificacao({
        numeroPedido: d.numeroPedido,
        email: d.email ?? null,
        telefone: d.telefone ?? null,
      });
      break;
    }
    case 'consultar_nota_fiscal':
      resultado = await a.notaFiscal.porPedido((dados as { numeroPedido: string }).numeroPedido);
      break;
    case 'consultar_rastreio':
      resultado = await a.rastreio.rastrear((dados as { codigo: string }).codigo);
      break;
    case 'consultar_carrinho_abandonado':
      resultado = await a.carrinhos.maisRecenteDoCliente(
        (dados as { clienteId: string }).clienteId,
      );
      break;
    case 'consultar_ultimo_pedido': {
      // Minimização de dados: devolve só o que a recompra precisa.
      // Endereço, pagamento, nota fiscal e contato ficam de fora.
      const r = await a.pedidos.ultimoPedidoDoCliente((dados as { clienteId: string }).clienteId);
      resultado = r.ok
        ? {
            ok: true,
            dados: {
              numero: r.dados.numero,
              criadoEm: r.dados.criadoEm,
              itens: r.dados.itens.map((i) => ({
                sku: i.sku,
                titulo: i.titulo,
                quantidade: i.quantidade,
              })),
            },
          }
        : r;
      break;
    }
    case 'sugerir_combinacao': {
      const { sugerirCombinacoes } = await import('../knowledge/combinacoes.js');
      const d = dados as { skus: string[]; limite?: number };
      resultado = {
        ok: true,
        dados: sugerirCombinacoes(d.skus, d.limite ? { limite: d.limite } : {}),
      };
      break;
    }
    case 'buscar_conhecimento': {
      const { buscarTrechos } = await import('../knowledge/index.js');
      resultado = { ok: true, dados: buscarTrechos((dados as { termo: string }).termo) };
      break;
    }
    default:
      return negar(`Ferramenta nao implementada: ${nome}`, 'nao_autorizado');
  }

  auditoria.registrar({
    ator: `agente:${ctx.clienteId}`,
    acao: `ferramenta:${nome}`,
    recurso: ctx.conversaId,
    resultado: resultado.ok ? 'permitido' : 'erro',
    detalhe: resultado.ok ? 'execucao concluida' : resultado.erro.mensagem,
  });
  return resultado;
}
