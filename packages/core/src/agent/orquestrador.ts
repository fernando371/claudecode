import {
  apelidoAnonimo,
  type Canal,
  type FonteUtilizada,
  type MotivoEscalonamento,
  type NotaFiscal,
  type Pedido,
  type Produto,
  type Rastreamento,
  type RespostaAgente,
} from '@fdc/shared';
import { log } from '../logger.js';
import {
  auditoria,
  clientes,
  conversas,
  filaHumana,
  idempotencia,
  mensagens,
  metricas,
} from '../db/repositorios.js';
import { buscarTrechos } from '../knowledge/index.js';
import { preverRecompra } from '../knowledge/combinacoes.js';
import { avaliarAtraso } from '../policies/atraso.js';
import {
  extrairIdentificacao,
  IDENTIFICACAO_NAO_CONFERE,
  PEDIDO_DE_IDENTIFICACAO,
  type DadosIdentificacao,
} from '../policies/autenticacaoPedido.js';
import { exigeAtendimentoHumano } from '../policies/emergencia.js';
import { pedidoDeMarketplace, RECOMPRA_EM_MARKETPLACE } from '../policies/marketplace.js';
import {
  pediuDescadastro,
  processarDescadastro,
  resumirSemDadoSensivel,
} from '../policies/privacidade.js';
import { avaliarInjecao, higienizarEntrada, RESPOSTA_AMEACA } from '../policies/promptInjection.js';
import {
  avaliarSeguranca,
  AVISO_NAO_PRESCRICAO,
  respostaViolaRegras,
  RESPOSTA_ESCALONAMENTO,
} from '../policies/saude.js';
import { executarFerramenta, type ContextoFerramenta } from './ferramentas.js';
import { classificarIntencao, INTENCOES_COM_FONTE_OFICIAL } from './intencoes.js';
import {
  blocoDisponibilidade,
  formatarData,
  DESCADASTRO_CONFIRMADO,
  formatarPreco,
  INTEGRACAO_FORA,
  linhaProduto,
  NAO_ENTENDI,
  PRODUTO_NAO_ENCONTRADO,
  resumoPedidoParaCliente,
  SAUDACAO,
  SEM_FONTE_OFICIAL,
  textoStatusPedido,
} from './respostas.js';

/**
 * ORQUESTRADOR DO AGENTE.
 *
 * Segue sempre a mesma sequencia:
 *  1. recebe e normaliza  2. identifica cliente e canal  3. classifica intencao
 *  4. verifica consentimento/autenticacao  5. consulta so o necessario
 *  6. aplica regras  7. responde com base em fonte oficial  8. pede esclarecimento
 *  9. transfere para humano quando ha risco  10. registra metricas e auditoria
 * 11. nunca executa acao nao autorizada.
 */

export interface EntradaMensagem {
  texto: string;
  canal: Canal;
  /** Telefone/handle do cliente OU identificador ja conhecido. */
  remetente: string;
  conversaId?: string;
  /** Id da mensagem no canal externo, para idempotencia. */
  idExterno?: string;
}

/** Estado curto da conversa (dados de identificacao ja informados). */
const estadoConversa = new Map<string, Partial<DadosIdentificacao>>();

export function limparEstadoConversas(): void {
  estadoConversa.clear();
}

interface Acumulador {
  fontes: FonteUtilizada[];
  regras: string[];
  links: Array<{ titulo: string; url: string }>;
  ferramentas: string[];
}

export async function processarMensagem(entrada: EntradaMensagem): Promise<RespostaAgente> {
  const inicio = Date.now();
  const acumulador: Acumulador = { fontes: [], regras: [], links: [], ferramentas: [] };

  // ---- 1. Normalizacao e idempotencia -------------------------------------
  const texto = higienizarEntrada(entrada.texto);
  if (entrada.idExterno) {
    const nova = idempotencia.registrarSeNova(entrada.idExterno, entrada.canal);
    if (!nova) {
      log.info('mensagem duplicada ignorada', { canal: entrada.canal });
      return montar({
        conversaId: entrada.conversaId ?? 'duplicada',
        texto: '',
        intencao: 'desconhecida',
        confianca: 1,
        acumulador: { ...acumulador, regras: ['idempotencia:mensagem_duplicada_ignorada'] },
        inicio,
      });
    }
  }

  // ---- 2. Cliente e conversa ----------------------------------------------
  const cliente = identificarCliente(entrada.remetente);
  const conversa = entrada.conversaId
    ? (conversas.porId(entrada.conversaId) ??
      conversas.abrir(cliente.id, entrada.canal, entrada.conversaId))
    : conversas.abrir(cliente.id, entrada.canal);

  mensagens.registrarEntrada(conversa.id, texto);
  metricas.registrar('mensagem_recebida', { conversaId: conversa.id });

  const escalar = (
    motivo: MotivoEscalonamento,
    textoResposta?: string,
    prioridade: 'alta' | 'normal' = 'normal',
  ) =>
    transferir(
      conversa.id,
      cliente.id,
      motivo,
      texto,
      acumulador,
      inicio,
      textoResposta,
      prioridade,
    );

  // ---- Conversa ja assumida por atendente ---------------------------------
  if (conversa.assumidaPor) {
    acumulador.regras.push('atendimento:conversa_assumida_por_humano');
    return finalizar(
      montar({
        conversaId: conversa.id,
        texto: '',
        intencao: 'falar_atendente',
        confianca: 1,
        acumulador,
        inicio,
        transferido: true,
        motivo: 'pedido_de_humano',
      }),
    );
  }

  // ---- Modo de emergencia --------------------------------------------------
  if (exigeAtendimentoHumano()) {
    return finalizar(escalar('modo_emergencia'));
  }

  // ---- 3. Protecao contra prompt injection --------------------------------
  const injecao = avaliarInjecao(texto);
  if (!injecao.seguro && injecao.tipo) {
    acumulador.regras.push(...injecao.regrasAcionadas);
    auditoria.registrar({
      ator: `cliente:${cliente.id}`,
      acao: `seguranca:${injecao.tipo}`,
      recurso: conversa.id,
      resultado: 'negado',
      detalhe: resumirSemDadoSensivel(texto),
    });
    metricas.registrar('resposta_bloqueada_seguranca', {
      conversaId: conversa.id,
      detalhe: injecao.tipo,
    });
    return finalizar(
      montar({
        conversaId: conversa.id,
        texto: RESPOSTA_AMEACA[injecao.tipo],
        intencao: 'desconhecida',
        confianca: 0.9,
        acumulador,
        inicio,
        bloqueado: true,
      }),
    );
  }
  acumulador.regras.push(...injecao.regrasAcionadas);

  // ---- 4. Classificacao de intencao ---------------------------------------
  const classificacao = classificarIntencao(texto);
  const intencao = classificacao.intencao;
  acumulador.regras.push(`intencao:${intencao}`);
  metricas.registrar(`intencao:${intencao}`, { conversaId: conversa.id });

  // ---- 5. Descadastro (LGPD) - tem prioridade sobre qualquer venda --------
  if (intencao === 'parar_mensagens' || pediuDescadastro(texto)) {
    processarDescadastro(cliente.id);
    acumulador.regras.push('lgpd:descadastro_registrado');
    auditoria.registrar({
      ator: `cliente:${cliente.id}`,
      acao: 'lgpd:interrupcao_comunicacoes',
      recurso: conversa.id,
      resultado: 'permitido',
      detalhe: 'cliente solicitou parar mensagens',
    });
    metricas.registrar('descadastro', { conversaId: conversa.id });
    return finalizar(
      montar({
        conversaId: conversa.id,
        texto: DESCADASTRO_CONFIRMADO,
        intencao: 'parar_mensagens',
        confianca: classificacao.confianca,
        acumulador,
        inicio,
      }),
    );
  }

  // ---- 6. Regras de seguranca para suplementos ----------------------------
  const seguranca = avaliarSeguranca(texto);
  acumulador.regras.push(...seguranca.regrasAcionadas);
  if (!seguranca.seguro && seguranca.motivo) {
    const prioridade: 'alta' | 'normal' = [
      'reacao_adversa',
      'superdosagem',
      'integridade_produto',
      'suspeita_falsificacao',
    ].includes(seguranca.motivo)
      ? 'alta'
      : 'normal';
    metricas.registrar('resposta_bloqueada_seguranca', {
      conversaId: conversa.id,
      detalhe: seguranca.motivo,
    });
    return finalizar(escalar(seguranca.motivo, undefined, prioridade));
  }

  // ---- 7. Intencoes que sempre vao para humano ----------------------------
  if (intencao === 'reacao_adversa') return finalizar(escalar('reacao_adversa', undefined, 'alta'));
  if (intencao === 'produto_avariado')
    return finalizar(escalar('integridade_produto', undefined, 'alta'));
  if (intencao === 'falar_atendente') return finalizar(escalar('pedido_de_humano'));

  // ---- 8. Rotas por intencao ----------------------------------------------
  const ctx: ContextoFerramenta = {
    conversaId: conversa.id,
    clienteId: cliente.id,
    intencao,
    usadas: [],
  };

  switch (intencao) {
    case 'saudacao':
      return finalizar(
        montar({
          conversaId: conversa.id,
          texto: SAUDACAO,
          intencao,
          confianca: classificacao.confianca,
          acumulador,
          inicio,
        }),
      );

    case 'busca_produto':
    case 'preco':
    case 'estoque':
    case 'comparacao_produtos':
      return finalizar(
        await rotaCatalogo(ctx, texto, intencao, classificacao.confianca, acumulador, inicio),
      );

    case 'carrinho_abandonado':
      return finalizar(
        await rotaCarrinhoAbandonado(
          ctx,
          cliente.conhecido,
          classificacao.confianca,
          acumulador,
          inicio,
        ),
      );

    case 'recompra':
      return finalizar(
        await rotaRecompra(ctx, cliente.conhecido, classificacao.confianca, acumulador, inicio),
      );

    case 'composicao':
    case 'modo_de_uso':
      return finalizar(
        await rotaRotulo(
          ctx,
          texto,
          intencao,
          classificacao.confianca,
          acumulador,
          inicio,
          escalar,
        ),
      );

    case 'frete':
    case 'prazo':
    case 'troca_devolucao':
      return finalizar(
        await rotaConhecimento(
          ctx,
          texto,
          intencao,
          classificacao.confianca,
          acumulador,
          inicio,
          escalar,
        ),
      );

    case 'status_pedido':
    case 'nota_fiscal':
    case 'rastreio':
    case 'atraso':
      return finalizar(
        await rotaPedido(
          ctx,
          texto,
          intencao,
          classificacao.confianca,
          acumulador,
          inicio,
          escalar,
          cliente.id,
        ),
      );

    default:
      return finalizar(
        await rotaDesconhecida(ctx, texto, classificacao.confianca, acumulador, inicio),
      );
  }
}

// ---------------------------------------------------------------------------
// Rotas
// ---------------------------------------------------------------------------

type Escalador = (
  motivo: MotivoEscalonamento,
  textoResposta?: string,
  prioridade?: 'alta' | 'normal',
) => RespostaAgente;

async function rotaCatalogo(
  ctx: ContextoFerramenta,
  texto: string,
  intencao: RespostaAgente['intencao'],
  confianca: number,
  acumulador: Acumulador,
  inicio: number,
): Promise<RespostaAgente> {
  const resultado = await executarFerramenta(ctx, 'buscar_produto', { termo: texto, limite: 4 });
  acumulador.ferramentas.push(...ctx.usadas);

  if (!resultado.ok) {
    acumulador.regras.push(`integracao:${resultado.erro.codigo}`);
    metricas.registrar('erro_integracao', {
      conversaId: ctx.conversaId,
      detalhe: resultado.erro.origem,
    });
    return transferir(
      ctx.conversaId,
      ctx.clienteId,
      'integracao_indisponivel',
      texto,
      acumulador,
      inicio,
      INTEGRACAO_FORA,
    );
  }

  const produtos = resultado.dados as Produto[];
  if (produtos.length === 0) {
    acumulador.regras.push('catalogo:sem_resultado');
    return montar({
      conversaId: ctx.conversaId,
      texto: PRODUTO_NAO_ENCONTRADO,
      intencao,
      confianca,
      acumulador,
      inicio,
    });
  }

  for (const p of produtos) {
    acumulador.fontes.push({ tipo: 'catalogo', referencia: `${p.id} (${p.marca})` });
    if (p.url) acumulador.links.push({ titulo: p.titulo, url: p.url });
  }
  metricas.registrar('produto_consultado', {
    conversaId: ctx.conversaId,
    detalhe: produtos.map((p) => p.id).join(','),
  });

  let corpo: string;
  if (intencao === 'estoque') {
    corpo = produtos.map(blocoDisponibilidade).join('\n\n');
  } else if (intencao === 'preco') {
    corpo = produtos
      .map((p) => {
        const linhas = p.variantes.map(
          (v) =>
            `   - ${v.titulo}: ${formatarPreco(v.precoCentavos)}${v.disponivel ? '' : ' (sem estoque)'}`,
        );
        return `• ${p.titulo}\n${linhas.join('\n')}`;
      })
      .join('\n');
  } else if (intencao === 'comparacao_produtos') {
    corpo = produtos.map((p) => `• ${p.titulo} (${p.marca}) — ${p.descricaoCurta}`).join('\n');
  } else {
    corpo = produtos.map(linhaProduto).join('\n');
  }

  const marcas = new Set(produtos.map((p) => p.marca));
  const notaMarcas =
    marcas.size > 1
      ? '\n\nObs.: itens da FDC Vitaminas e da FDC Nutrition podem ir no mesmo carrinho, sem problema.'
      : '';

  // SKUs disponíveis, usados para a sugestão de combinação.
  const disponiveis = produtos.flatMap((p) =>
    p.variantes.filter((v) => v.disponivel).map((v) => v.sku),
  );

  const aviso =
    intencao === 'busca_produto' || intencao === 'comparacao_produtos'
      ? `\n\n${AVISO_NAO_PRESCRICAO}`
      : '';

  // Cross-sell só na busca de produto: em pergunta de preço ou estoque seria
  // empurrar venda em cima de uma dúvida objetiva.
  let crossSell = '';
  if (intencao === 'busca_produto' && disponiveis.length > 0) {
    crossSell = await montarCrossSell(ctx, disponiveis.slice(0, 3), acumulador);
  }

  acumulador.regras.push('catalogo:resposta_com_dado_oficial');
  acumulador.ferramentas.push(...ctx.usadas);
  return montar({
    conversaId: ctx.conversaId,
    texto: `${corpo}${notaMarcas}${crossSell}${aviso}`,
    intencao,
    confianca,
    acumulador,
    inicio,
  });
}

// ---------------------------------------------------------------------------
// Vendas: carrinho abandonado, recompra e cross-sell
// ---------------------------------------------------------------------------

/**
 * Identidade no carrinho e na recompra.
 *
 * Aqui a identidade vem do PRÓPRIO CANAL: o WhatsApp garante que quem escreve é
 * o dono do número. Por isso não pedimos número de pedido, como fazemos na
 * consulta de pedido.
 *
 * A contrapartida é que só devolvemos o mínimo: nome dos produtos e a data.
 * Endereço, pagamento, nota fiscal e valor pago continuam exigindo a verificação
 * completa da rota de pedidos.
 */
const NAO_ACHEI_CARRINHO =
  'Não encontrei nenhum carrinho aberto no seu número. Quer que eu procure algum produto para você?';

const SEM_HISTORICO_DE_COMPRA =
  'Não encontrei uma compra anterior no seu número. Se você comprou com outro número ou e-mail, me diga qual produto você quer repor que eu procuro.';

/** Monta a lista de produtos de um conjunto de SKUs, usando o catálogo oficial. */
async function detalharSkus(
  ctx: ContextoFerramenta,
  skus: Array<{ sku: string; quantidade: number }>,
): Promise<{
  produtos: Array<{
    sku: string;
    titulo: string;
    quantidade: number;
    precoCentavos: number;
    disponivel: boolean;
  }>;
  falhou: boolean;
}> {
  const produtos: Array<{
    sku: string;
    titulo: string;
    quantidade: number;
    precoCentavos: number;
    disponivel: boolean;
  }> = [];
  let falhou = false;

  for (const item of skus) {
    const r = await executarFerramenta(ctx, 'detalhar_produto', { sku: item.sku });
    if (!r.ok) {
      falhou = true;
      continue;
    }
    const produto = r.dados as Produto;
    const variante = produto.variantes.find((v) => v.sku.toUpperCase() === item.sku.toUpperCase());
    produtos.push({
      sku: item.sku,
      titulo: `${produto.titulo}${variante && produto.variantes.length > 1 ? ` — ${variante.titulo}` : ''}`,
      quantidade: item.quantidade,
      precoCentavos: variante?.precoCentavos ?? 0,
      disponivel: variante?.disponivel ?? false,
    });
  }
  return { produtos, falhou };
}

/** Busca uma combinação aprovada para sugerir junto. Nunca inventa. */
async function montarCrossSell(
  ctx: ContextoFerramenta,
  skusDoCliente: string[],
  acumulador: Acumulador,
): Promise<string> {
  // Pedimos mais de uma sugestão de propósito: a primeira pode estar sem estoque,
  // e nesse caso queremos a próxima em vez de desistir do cross-sell.
  const r = await executarFerramenta(ctx, 'sugerir_combinacao', { skus: skusDoCliente, limite: 3 });
  if (!r.ok) return '';

  const { fonte, sugestoes } = r.dados as {
    fonte: { utilizavel: boolean; motivoIndisponivel: string | null; referencia: string };
    sugestoes: Array<{ familia: string; skus: string[]; motivo: string }>;
  };

  if (!fonte.utilizavel) {
    acumulador.regras.push('crossell:sem_fonte_aprovada');
    return '';
  }
  if (sugestoes.length === 0) {
    acumulador.regras.push('crossell:sem_combinacao_para_estes_itens');
    return '';
  }

  // Cada sugestão é uma FAMÍLIA; tentamos os SKUs dela até achar um com estoque.
  let escolhida: { sku: string; motivo: string; titulo: string; precoCentavos: number } | null =
    null;
  busca: for (const sugestao of sugestoes) {
    for (const sku of sugestao.skus) {
      const detalhe = await executarFerramenta(ctx, 'detalhar_produto', { sku });
      if (!detalhe.ok) continue;
      const produto = detalhe.dados as Produto;
      const variante = produto.variantes.find((v) => v.sku.toUpperCase() === sku.toUpperCase());
      if (!variante?.disponivel) {
        acumulador.regras.push('crossell:sugestao_sem_estoque_descartada');
        continue;
      }
      escolhida = {
        sku,
        motivo: sugestao.motivo,
        titulo: produto.titulo,
        precoCentavos: variante.precoCentavos,
      };
      break busca;
    }
  }

  if (!escolhida) return '';

  acumulador.fontes.push({ tipo: 'conhecimento', referencia: fonte.referencia });
  acumulador.regras.push('crossell:sugestao_de_fonte_aprovada');
  metricas.registrar('crossell_oferecido', { conversaId: ctx.conversaId, detalhe: escolhida.sku });

  return `\n\nMuita gente leva junto: ${escolhida.titulo} (${formatarPreco(escolhida.precoCentavos)}). ${escolhida.motivo}`;
}

async function rotaCarrinhoAbandonado(
  ctx: ContextoFerramenta,
  clienteConhecido: boolean,
  confianca: number,
  acumulador: Acumulador,
  inicio: number,
): Promise<RespostaAgente> {
  const responder = (texto: string) =>
    montar({
      conversaId: ctx.conversaId,
      texto,
      intencao: 'carrinho_abandonado',
      confianca,
      acumulador,
      inicio,
    });

  if (!clienteConhecido) {
    acumulador.regras.push('carrinho:numero_nao_reconhecido');
    return responder(NAO_ACHEI_CARRINHO);
  }

  const consulta = await executarFerramenta(ctx, 'consultar_carrinho_abandonado', {
    clienteId: ctx.clienteId,
  });
  acumulador.ferramentas.push(...ctx.usadas);

  if (!consulta.ok) {
    acumulador.regras.push(`carrinho:${consulta.erro.codigo}`);
    if (consulta.erro.codigo === 'nao_encontrado') return responder(NAO_ACHEI_CARRINHO);
    metricas.registrar('erro_integracao', {
      conversaId: ctx.conversaId,
      detalhe: consulta.erro.origem,
    });
    return transferir(
      ctx.conversaId,
      ctx.clienteId,
      'integracao_indisponivel',
      'consulta de carrinho',
      acumulador,
      inicio,
      INTEGRACAO_FORA,
    );
  }

  const carrinho = consulta.dados as {
    id: string;
    criadoEm: string;
    itens: Array<{ sku: string; quantidade: number }>;
  };
  acumulador.fontes.push({ tipo: 'catalogo', referencia: `carrinho ${carrinho.id}` });
  auditoria.registrar({
    ator: `agente:${ctx.clienteId}`,
    acao: 'carrinho:consultado_por_identidade_do_canal',
    recurso: ctx.conversaId,
    resultado: 'permitido',
    detalhe: 'identidade verificada pelo número do WhatsApp; devolvido apenas nome dos produtos',
  });

  const { produtos } = await detalharSkus(ctx, carrinho.itens);
  const disponiveis = produtos.filter((p) => p.disponivel);

  if (produtos.length === 0) {
    acumulador.regras.push('carrinho:itens_fora_do_catalogo');
    return responder(NAO_ACHEI_CARRINHO);
  }

  const linhas = produtos
    .map((p) => `• ${p.quantidade}x ${p.titulo}${p.disponivel ? '' : ' — sem estoque no momento'}`)
    .join('\n');

  let corpo = `Encontrei um carrinho aberto no seu número, de ${formatarData(carrinho.criadoEm)}:\n${linhas}`;

  if (disponiveis.length === 0) {
    acumulador.regras.push('carrinho:sem_item_disponivel');
    return responder(
      `${corpo}\n\nNo momento nenhum desses itens está disponível. Quer que eu te avise ou procure uma alternativa?`,
    );
  }

  const valorCentavos = disponiveis.reduce((soma, p) => soma + p.precoCentavos * p.quantidade, 0);
  const link = await executarFerramenta(ctx, 'gerar_link_carrinho', {
    itens: disponiveis.map((p) => ({ sku: p.sku, quantidade: p.quantidade })),
  });

  if (link.ok) {
    acumulador.links.push({ titulo: 'Retomar carrinho', url: link.dados as string });
    corpo += `\n\nTotal: ${formatarPreco(valorCentavos)}. É só usar este link para retomar: ${link.dados as string}`;
    metricas.registrar('link_carrinho_gerado', { conversaId: ctx.conversaId });
    metricas.registrar('oportunidade_identificada', {
      conversaId: ctx.conversaId,
      valorCentavos,
      detalhe: 'carrinho_abandonado',
    });
    acumulador.regras.push('carrinho:link_de_retomada_gerado');
  }

  corpo += await montarCrossSell(
    ctx,
    disponiveis.map((p) => p.sku),
    acumulador,
  );
  acumulador.ferramentas.push(...ctx.usadas);
  return responder(corpo);
}

async function rotaRecompra(
  ctx: ContextoFerramenta,
  clienteConhecido: boolean,
  confianca: number,
  acumulador: Acumulador,
  inicio: number,
): Promise<RespostaAgente> {
  const responder = (texto: string) =>
    montar({
      conversaId: ctx.conversaId,
      texto,
      intencao: 'recompra',
      confianca,
      acumulador,
      inicio,
    });

  if (!clienteConhecido) {
    acumulador.regras.push('recompra:numero_nao_reconhecido');
    return responder(SEM_HISTORICO_DE_COMPRA);
  }

  const consulta = await executarFerramenta(ctx, 'consultar_ultimo_pedido', {
    clienteId: ctx.clienteId,
  });
  acumulador.ferramentas.push(...ctx.usadas);

  if (!consulta.ok) {
    acumulador.regras.push(`recompra:${consulta.erro.codigo}`);
    if (consulta.erro.codigo === 'nao_encontrado') return responder(SEM_HISTORICO_DE_COMPRA);
    metricas.registrar('erro_integracao', {
      conversaId: ctx.conversaId,
      detalhe: consulta.erro.origem,
    });
    return transferir(
      ctx.conversaId,
      ctx.clienteId,
      'integracao_indisponivel',
      'consulta de recompra',
      acumulador,
      inicio,
      INTEGRACAO_FORA,
    );
  }

  const pedido = consulta.dados as {
    numero: string;
    criadoEm: string;
    itens: Array<{ sku: string; titulo: string; quantidade: number }>;
  };
  // Regra de canal: pedido de marketplace não vira oferta de recompra no site.
  if (pedidoDeMarketplace(pedido.itens.map((i) => ({ sku: i.sku, titulo: i.titulo })))) {
    acumulador.regras.push('marketplace:recompra_nao_oferecida');
    metricas.registrar('pedido_de_marketplace', { conversaId: ctx.conversaId });
    return responder(RECOMPRA_EM_MARKETPLACE);
  }

  acumulador.fontes.push({ tipo: 'pedido', referencia: `último pedido ${pedido.numero}` });
  auditoria.registrar({
    ator: `agente:${ctx.clienteId}`,
    acao: 'recompra:consultada_por_identidade_do_canal',
    recurso: ctx.conversaId,
    resultado: 'permitido',
    detalhe: 'identidade verificada pelo número do WhatsApp; devolvido apenas produtos e data',
  });

  const { previsoes, fonte } = preverRecompra(pedido.itens, pedido.criadoEm);
  if (!fonte.utilizavel) {
    acumulador.regras.push('recompra:sem_fonte_aprovada_de_duracao');
  } else {
    acumulador.fontes.push({ tipo: 'conhecimento', referencia: fonte.referencia });
  }

  const paraRepor = previsoes.filter((p) => p.naHoraDeRepor).map((p) => p.sku);
  const itensAlvo =
    paraRepor.length > 0 ? pedido.itens.filter((i) => paraRepor.includes(i.sku)) : pedido.itens;

  const { produtos } = await detalharSkus(
    ctx,
    itensAlvo.map((i) => ({ sku: i.sku, quantidade: i.quantidade })),
  );
  const disponiveis = produtos.filter((p) => p.disponivel);

  const abertura =
    paraRepor.length > 0
      ? `Pela sua última compra (${formatarData(pedido.criadoEm)}), estes itens já devem estar acabando:`
      : `Sua última compra foi em ${formatarData(pedido.criadoEm)} e teve:`;

  const linhas = produtos
    .map((p) => `• ${p.quantidade}x ${p.titulo}${p.disponivel ? '' : ' — sem estoque no momento'}`)
    .join('\n');

  if (produtos.length === 0) {
    acumulador.regras.push('recompra:itens_fora_do_catalogo');
    return responder(SEM_HISTORICO_DE_COMPRA);
  }

  let corpo = `${abertura}\n${linhas}`;
  acumulador.regras.push(
    paraRepor.length > 0 ? 'recompra:item_no_prazo_de_reposicao' : 'recompra:sem_item_vencendo',
  );

  if (disponiveis.length === 0) {
    return responder(
      `${corpo}\n\nNo momento nenhum desses itens está disponível. Quer que eu procure uma alternativa?`,
    );
  }

  const valorCentavos = disponiveis.reduce((soma, p) => soma + p.precoCentavos * p.quantidade, 0);
  const link = await executarFerramenta(ctx, 'gerar_link_carrinho', {
    itens: disponiveis.map((p) => ({ sku: p.sku, quantidade: p.quantidade })),
  });

  if (link.ok) {
    acumulador.links.push({ titulo: 'Repor a compra', url: link.dados as string });
    corpo += `\n\nSe quiser repor, deixei o carrinho pronto (${formatarPreco(valorCentavos)}): ${link.dados as string}`;
    metricas.registrar('link_carrinho_gerado', { conversaId: ctx.conversaId });
    metricas.registrar('oportunidade_identificada', {
      conversaId: ctx.conversaId,
      valorCentavos,
      detalhe: 'recompra',
    });
    acumulador.regras.push('recompra:link_gerado');
  }

  corpo += await montarCrossSell(
    ctx,
    disponiveis.map((p) => p.sku),
    acumulador,
  );
  corpo += `\n\n${AVISO_NAO_PRESCRICAO}`;
  acumulador.ferramentas.push(...ctx.usadas);
  return responder(corpo);
}

async function rotaRotulo(
  ctx: ContextoFerramenta,
  texto: string,
  intencao: RespostaAgente['intencao'],
  confianca: number,
  acumulador: Acumulador,
  inicio: number,
  escalar: Escalador,
): Promise<RespostaAgente> {
  const resultado = await executarFerramenta(ctx, 'buscar_produto', { termo: texto, limite: 1 });
  acumulador.ferramentas.push(...ctx.usadas);

  if (!resultado.ok) {
    acumulador.regras.push(`integracao:${resultado.erro.codigo}`);
    metricas.registrar('erro_integracao', {
      conversaId: ctx.conversaId,
      detalhe: resultado.erro.origem,
    });
    return finalizar(escalar('integracao_indisponivel', INTEGRACAO_FORA));
  }

  const produtos = resultado.dados as Produto[];
  const produto = produtos[0];
  if (!produto) {
    acumulador.regras.push('catalogo:sem_resultado');
    return montar({
      conversaId: ctx.conversaId,
      texto: PRODUTO_NAO_ENCONTRADO,
      intencao,
      confianca,
      acumulador,
      inicio,
    });
  }

  const campo = intencao === 'composicao' ? produto.rotulo.composicao : produto.rotulo.modoDeUso;
  if (!campo) {
    acumulador.regras.push('conhecimento:sem_fonte_oficial_no_rotulo');
    return finalizar(escalar('sem_fonte_oficial', SEM_FONTE_OFICIAL));
  }

  acumulador.fontes.push({ tipo: 'catalogo', referencia: `rótulo oficial · ${produto.id}` });
  acumulador.regras.push('rotulo:resposta_somente_com_texto_oficial');

  const rotuloCampo = intencao === 'composicao' ? 'Composição' : 'Modo de uso';
  const advertencias = produto.rotulo.advertencias ? `\n\n${produto.rotulo.advertencias}` : '';
  return montar({
    conversaId: ctx.conversaId,
    texto: `${produto.titulo}\n${rotuloCampo} (texto do rótulo oficial):\n${campo}${advertencias}\n\n${AVISO_NAO_PRESCRICAO}`,
    intencao,
    confianca,
    acumulador,
    inicio,
  });
}

async function rotaConhecimento(
  ctx: ContextoFerramenta,
  texto: string,
  intencao: RespostaAgente['intencao'],
  confianca: number,
  acumulador: Acumulador,
  inicio: number,
  escalar: Escalador,
): Promise<RespostaAgente> {
  const trechos = buscarTrechos(texto);
  acumulador.ferramentas.push('buscar_conhecimento');

  if (trechos.length === 0) {
    acumulador.regras.push('conhecimento:sem_fonte_aprovada');
    if (INTENCOES_COM_FONTE_OFICIAL.includes(intencao)) {
      return finalizar(escalar('sem_fonte_oficial', SEM_FONTE_OFICIAL));
    }
    return montar({
      conversaId: ctx.conversaId,
      texto: SEM_FONTE_OFICIAL,
      intencao,
      confianca,
      acumulador,
      inicio,
    });
  }

  for (const t of trechos)
    acumulador.fontes.push({ tipo: 'conhecimento', referencia: `${t.documentoId} · ${t.fonte}` });
  acumulador.regras.push('conhecimento:resposta_com_fonte_aprovada');

  return montar({
    conversaId: ctx.conversaId,
    texto: trechos.map((t) => t.trecho).join('\n\n'),
    intencao,
    confianca,
    acumulador,
    inicio,
  });
}

async function rotaPedido(
  ctx: ContextoFerramenta,
  texto: string,
  intencao: RespostaAgente['intencao'],
  confianca: number,
  acumulador: Acumulador,
  inicio: number,
  escalar: Escalador,
  clienteId: string,
): Promise<RespostaAgente> {
  // ---- Autenticacao minima -------------------------------------------------
  const anterior = estadoConversa.get(ctx.conversaId) ?? {};
  const identificacao = extrairIdentificacao(texto, anterior);
  estadoConversa.set(ctx.conversaId, {
    numeroPedido: identificacao.numeroPedido,
    email: identificacao.email,
    telefone: identificacao.telefone,
  });

  if (!identificacao.completo) {
    acumulador.regras.push(`autenticacao:faltando:${identificacao.faltando.join('+')}`);
    return montar({
      conversaId: ctx.conversaId,
      texto: PEDIDO_DE_IDENTIFICACAO,
      intencao,
      confianca,
      acumulador,
      inicio,
    });
  }

  const consulta = await executarFerramenta(ctx, 'consultar_pedido', {
    numeroPedido: identificacao.numeroPedido,
    email: identificacao.email,
    telefone: identificacao.telefone,
  });
  acumulador.ferramentas.push(...ctx.usadas);

  if (!consulta.ok) {
    acumulador.regras.push(`pedido:${consulta.erro.codigo}`);
    if (consulta.erro.codigo === 'nao_autorizado') {
      auditoria.registrar({
        ator: `cliente:${clienteId}`,
        acao: 'pedido:verificacao_falhou',
        recurso: ctx.conversaId,
        resultado: 'negado',
        detalhe: `tentativa de acesso ao pedido ${identificacao.numeroPedido}`,
      });
      metricas.registrar('acesso_pedido_negado', { conversaId: ctx.conversaId });
      return montar({
        conversaId: ctx.conversaId,
        texto: IDENTIFICACAO_NAO_CONFERE,
        intencao,
        confianca,
        acumulador,
        inicio,
      });
    }
    metricas.registrar('erro_integracao', {
      conversaId: ctx.conversaId,
      detalhe: consulta.erro.origem,
    });
    return finalizar(escalar('integracao_indisponivel', INTEGRACAO_FORA));
  }

  const pedido = consulta.dados as Pedido;
  acumulador.fontes.push({ tipo: 'pedido', referencia: `pedido ${pedido.numero}` });
  metricas.registrar('consulta_pedido_autorizada', { conversaId: ctx.conversaId });

  // ---- Nota Fiscal ---------------------------------------------------------
  let nota: NotaFiscal | null = null;
  if (intencao === 'status_pedido' || intencao === 'nota_fiscal') {
    const r = await executarFerramenta(ctx, 'consultar_nota_fiscal', {
      numeroPedido: pedido.numero,
    });
    if (r.ok) {
      nota = r.dados as NotaFiscal;
      acumulador.fontes.push({
        tipo: 'nota_fiscal',
        referencia: `NF ${nota.numero ?? 'não emitida'}`,
      });
    } else {
      acumulador.regras.push(`nota_fiscal:${r.erro.codigo}`);
      metricas.registrar('erro_integracao', { conversaId: ctx.conversaId, detalhe: r.erro.origem });
      if (intencao === 'nota_fiscal')
        return finalizar(escalar('integracao_indisponivel', INTEGRACAO_FORA));
    }
  }

  // ---- Rastreio ------------------------------------------------------------
  let rastreio: Rastreamento | null = null;
  let rastreioFalhou = false;
  if (pedido.codigoRastreio && intencao !== 'nota_fiscal') {
    const r = await executarFerramenta(ctx, 'consultar_rastreio', {
      codigo: pedido.codigoRastreio,
    });
    if (r.ok) {
      rastreio = r.dados as Rastreamento;
      acumulador.fontes.push({
        tipo: 'rastreio',
        referencia: `${rastreio.transportadora} · ${rastreio.status}`,
      });
    } else {
      rastreioFalhou = true;
      acumulador.regras.push(`rastreio:${r.erro.codigo}`);
      metricas.registrar('erro_integracao', { conversaId: ctx.conversaId, detalhe: r.erro.origem });
    }
  }

  // ---- Regra de atraso -----------------------------------------------------
  const avaliacao = avaliarAtraso(pedido, rastreio);
  acumulador.regras.push(...avaliacao.motivos);
  if (avaliacao.possivelAtraso || avaliacao.indefinido || rastreioFalhou) {
    metricas.registrar('consulta_atraso', { conversaId: ctx.conversaId });
  }

  const resumo = resumoPedidoParaCliente(pedido, nota, rastreio, avaliacao.possivelAtraso);
  const corpo = textoStatusPedido(resumo);

  if (rastreio?.status === 'extraviado') {
    return finalizar(
      escalar(
        'pedido_extraviado',
        `${corpo}\n\n${RESPOSTA_ESCALONAMENTO.pedido_extraviado}`,
        'alta',
      ),
    );
  }
  if (avaliacao.possivelAtraso) {
    return finalizar(
      escalar('pedido_atrasado', `${corpo}\n\n${RESPOSTA_ESCALONAMENTO.pedido_atrasado}`),
    );
  }
  if (avaliacao.indefinido || rastreioFalhou) {
    return finalizar(
      escalar(
        'integracao_indisponivel',
        `${corpo}\n\nA transportadora não retornou uma situação clara para esse envio. Vou encaminhar para um atendente da FDC confirmar.`,
      ),
    );
  }

  acumulador.regras.push('pedido:resposta_apos_verificacao_de_identidade');
  return montar({
    conversaId: ctx.conversaId,
    texto: corpo,
    intencao,
    confianca,
    acumulador,
    inicio,
  });
}

async function rotaDesconhecida(
  ctx: ContextoFerramenta,
  texto: string,
  confianca: number,
  acumulador: Acumulador,
  inicio: number,
): Promise<RespostaAgente> {
  const trechos = buscarTrechos(texto);
  if (trechos.length > 0) {
    for (const t of trechos)
      acumulador.fontes.push({ tipo: 'conhecimento', referencia: t.documentoId });
    acumulador.regras.push('conhecimento:resposta_com_fonte_aprovada');
    return montar({
      conversaId: ctx.conversaId,
      texto: trechos.map((t) => t.trecho).join('\n\n'),
      intencao: 'desconhecida',
      confianca,
      acumulador,
      inicio,
    });
  }
  acumulador.regras.push('agente:pedido_de_esclarecimento');
  return montar({
    conversaId: ctx.conversaId,
    texto: NAO_ENTENDI,
    intencao: 'desconhecida',
    confianca,
    acumulador,
    inicio,
  });
}

// ---------------------------------------------------------------------------
// Auxiliares
// ---------------------------------------------------------------------------

function identificarCliente(remetente: string) {
  const existente = clientes.porId(remetente) ?? clientes.porTelefone(remetente);
  if (existente) return { ...existente, conhecido: true };
  const novo = clientes.criar({
    id: apelidoAnonimo(remetente),
    nome: 'Cliente não identificado',
    email: '',
    telefone: remetente,
    ficticio: true,
  });
  return { ...novo, conhecido: false };
}

function transferir(
  conversaId: string,
  clienteId: string,
  motivo: MotivoEscalonamento,
  textoOriginal: string,
  acumulador: Acumulador,
  inicio: number,
  textoResposta?: string,
  prioridade: 'alta' | 'normal' = 'normal',
): RespostaAgente {
  filaHumana.criar({
    conversaId,
    clienteId,
    motivo,
    resumo: resumirSemDadoSensivel(textoOriginal),
    prioridade,
  });
  auditoria.registrar({
    ator: 'agente',
    acao: `escalonamento:${motivo}`,
    recurso: conversaId,
    resultado: 'permitido',
    detalhe: `prioridade ${prioridade}`,
  });
  metricas.registrar('transferido_humano', { conversaId, detalhe: motivo });
  acumulador.regras.push(`escalonamento:${motivo}`);

  return montar({
    conversaId,
    texto: textoResposta ?? RESPOSTA_ESCALONAMENTO[motivo],
    intencao: 'falar_atendente',
    confianca: 1,
    acumulador,
    inicio,
    transferido: true,
    motivo,
  });
}

function montar(args: {
  conversaId: string;
  texto: string;
  intencao: RespostaAgente['intencao'];
  confianca: number;
  acumulador: Acumulador;
  inicio: number;
  transferido?: boolean;
  motivo?: MotivoEscalonamento;
  bloqueado?: boolean;
}): RespostaAgente {
  return {
    conversaId: args.conversaId,
    texto: args.texto,
    intencao: args.intencao,
    confianca: args.confianca,
    fontes: args.acumulador.fontes.length
      ? args.acumulador.fontes
      : [{ tipo: 'nenhuma', referencia: '-' }],
    regrasAcionadas: args.acumulador.regras,
    transferidoParaHumano: args.transferido ?? false,
    motivoEscalonamento: args.motivo ?? null,
    bloqueadoPorSeguranca: args.bloqueado ?? false,
    links: args.acumulador.links,
    ferramentasUsadas: [...new Set(args.acumulador.ferramentas)],
    duracaoMs: Date.now() - args.inicio,
  };
}

/** Evita registrar a mesma resposta duas vezes quando as rotas ja finalizaram. */
const jaFinalizadas = new WeakSet<RespostaAgente>();

/**
 * Rede de protecao na SAIDA: se a resposta contiver frase proibida,
 * ela e substituida e a conversa vai para humano.
 * Chamar duas vezes com a mesma resposta nao duplica o registro.
 */
function finalizar(resposta: RespostaAgente): RespostaAgente {
  if (jaFinalizadas.has(resposta)) return resposta;
  jaFinalizadas.add(resposta);
  const violacao = respostaViolaRegras(resposta.texto);
  if (violacao) {
    log.warn('resposta bloqueada pela regra de saida', { violacao });
    metricas.registrar('resposta_bloqueada_seguranca', {
      conversaId: resposta.conversaId,
      detalhe: 'saida',
    });
    const corrigida: RespostaAgente = {
      ...resposta,
      texto: RESPOSTA_ESCALONAMENTO.sem_fonte_oficial,
      transferidoParaHumano: true,
      motivoEscalonamento: 'sem_fonte_oficial',
      bloqueadoPorSeguranca: true,
      regrasAcionadas: [...resposta.regrasAcionadas, 'saida:frase_proibida_bloqueada'],
    };
    jaFinalizadas.add(corrigida);
    mensagens.registrarSaida(corrigida);
    return corrigida;
  }
  if (resposta.texto) mensagens.registrarSaida(resposta);
  return resposta;
}
