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
import { avaliarAtraso } from '../policies/atraso.js';
import {
  extrairIdentificacao,
  IDENTIFICACAO_NAO_CONFERE,
  PEDIDO_DE_IDENTIFICACAO,
  type DadosIdentificacao,
} from '../policies/autenticacaoPedido.js';
import { exigeAtendimentoHumano } from '../policies/emergencia.js';
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
    case 'recompra':
    case 'carrinho_abandonado':
      return finalizar(
        await rotaCatalogo(ctx, texto, intencao, classificacao.confianca, acumulador, inicio),
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

  // Link de carrinho: so quando ha item disponivel.
  const disponiveis = produtos.flatMap((p) =>
    p.variantes.filter((v) => v.disponivel).map((v) => v.sku),
  );
  let linhaCarrinho = '';
  if (disponiveis.length > 0 && (intencao === 'recompra' || intencao === 'carrinho_abandonado')) {
    const primeiro = disponiveis[0]!;
    const carrinho = await executarFerramenta(ctx, 'gerar_link_carrinho', {
      itens: [{ sku: primeiro, quantidade: 1 }],
    });
    if (carrinho.ok) {
      acumulador.links.push({ titulo: 'Carrinho pronto', url: carrinho.dados as string });
      linhaCarrinho = `\n\nSe quiser, deixei o carrinho pronto: ${carrinho.dados as string}`;
      metricas.registrar('link_carrinho_gerado', { conversaId: ctx.conversaId });
    }
  }

  const aviso =
    intencao === 'busca_produto' || intencao === 'comparacao_produtos' || intencao === 'recompra'
      ? `\n\n${AVISO_NAO_PRESCRICAO}`
      : '';

  acumulador.regras.push('catalogo:resposta_com_dado_oficial');
  return montar({
    conversaId: ctx.conversaId,
    texto: `${corpo}${notaMarcas}${linhaCarrinho}${aviso}`,
    intencao,
    confianca,
    acumulador,
    inicio,
  });
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
  if (existente) return existente;
  return clientes.criar({
    id: apelidoAnonimo(remetente),
    nome: 'Cliente não identificado',
    email: '',
    telefone: remetente,
    ficticio: true,
  });
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
