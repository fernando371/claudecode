import { beforeEach, describe, expect, it } from 'vitest';
import { conversar, prepararAmbiente } from './apoio.js';
import {
  auditoria,
  clientes,
  consentimentos,
  conversas,
  db,
  executarExclusao,
  executarExpurgo,
  executarInterrupcao,
  filaHumana,
  limparCacheConfig,
  mensagens,
  notasConversa,
  NOME_ANONIMIZADO,
  pedidosExclusao,
  politicaRetencao,
  responderComoAtendente,
  TEXTO_REMOVIDO,
} from '@fdc/core';

/**
 * Política de retenção e direitos do titular (LGPD).
 */

const DIA = 24 * 3600 * 1000;

beforeEach(() => {
  prepararAmbiente();
});

/** Move um registro para o passado, simulando a passagem do tempo. */
function envelhecer(tabela: string, coluna: string, id: string, dias: number): void {
  const data = new Date(Date.now() - dias * DIA).toISOString();
  db().prepare(`UPDATE ${tabela} SET ${coluna} = ? WHERE id = ?`).run(data, id);
}

describe('Prazos de guarda acordados', () => {
  it('usa os prazos definidos com o cliente', () => {
    const prazos = politicaRetencao();
    expect(prazos.conversasDias).toBe(365);
    expect(prazos.auditoriaDias).toBe(365);
    expect(prazos.marcacoesSaudeDias).toBe(30);
  });

  it('guarda dado de saúde por menos tempo que o resto', () => {
    const prazos = politicaRetencao();
    // Dado de saúde é sensível: a LGPD pede o mínimo necessário.
    expect(prazos.marcacoesSaudeDias).toBeLessThan(prazos.conversasDias);
    expect(prazos.marcacoesSaudeDias).toBeLessThan(prazos.auditoriaDias);
  });
});

describe('Expurgo pela política de retenção', () => {
  it('não apaga nada que ainda está dentro do prazo', async () => {
    const r = await conversar('quanto custa a vitamina C?');
    const relatorio = executarExpurgo();

    expect(relatorio.conversasApagadas).toBe(0);
    expect(mensagens.porConversa(r.conversaId).length).toBeGreaterThan(0);
  });

  it('apaga conversas e mensagens que passaram do prazo', async () => {
    const r = await conversar('quanto custa a vitamina C?');
    envelhecer('conversas', 'iniciada_em', r.conversaId, 400);

    const relatorio = executarExpurgo();
    expect(relatorio.conversasApagadas).toBe(1);
    expect(relatorio.mensagensApagadas).toBeGreaterThan(0);
    expect(conversas.porId(r.conversaId)).toBeNull();
    expect(mensagens.porConversa(r.conversaId)).toHaveLength(0);
  });

  it('apaga as anotações internas junto com a conversa', async () => {
    const r = await conversar('quero falar com um atendente');
    notasConversa.criar(r.conversaId, 'Marina', 'Anotação de teste.');
    envelhecer('conversas', 'iniciada_em', r.conversaId, 400);

    const relatorio = executarExpurgo();
    expect(relatorio.notasApagadas).toBe(1);
    expect(notasConversa.porConversa(r.conversaId)).toHaveLength(0);
  });

  it('apaga o relato de saúde antes do resto, mantendo só o motivo', async () => {
    await conversar('passei mal depois de tomar o produto');
    const item = filaHumana.listar()[0];
    expect(item?.resumo).toContain('passei mal');

    // 40 dias: passou do prazo de saúde (30), mas não do de conversas (365).
    envelhecer('fila_humana', 'criado_em', item!.id, 40);
    const relatorio = executarExpurgo();

    expect(relatorio.relatosSensiveisRemovidos).toBe(1);
    const depois = filaHumana.listar().find((f) => f.id === item!.id);
    expect(depois?.resumo).toBe(TEXTO_REMOVIDO);
    // O motivo continua, para a estatística não se perder.
    expect(depois?.motivo).toBe('reacao_adversa');
  });

  it('não apaga relato de escalonamento que não envolve saúde', async () => {
    await conversar('quero falar com um atendente');
    const item = filaHumana.listar()[0];
    envelhecer('fila_humana', 'criado_em', item!.id, 40);

    executarExpurgo();
    expect(filaHumana.listar().find((f) => f.id === item!.id)?.resumo).not.toBe(TEXTO_REMOVIDO);
  });

  it('apaga a trilha de auditoria antiga e registra o próprio expurgo', async () => {
    const evento = auditoria.registrar({
      ator: 'teste',
      acao: 'teste:antigo',
      recurso: 'x',
      resultado: 'permitido',
      detalhe: 'evento antigo',
    });
    envelhecer('auditoria', 'ocorrido_em', evento.id, 400);

    const relatorio = executarExpurgo();
    expect(relatorio.eventosAuditoriaApagados).toBeGreaterThanOrEqual(1);

    const eventos = auditoria.listar();
    expect(eventos.some((e) => e.id === evento.id)).toBe(false);
    // O registro do expurgo sobrevive: é a prova de que a política rodou.
    expect(eventos.some((e) => e.acao === 'lgpd:expurgo_por_retencao')).toBe(true);
  });

  it('respeita os prazos configurados no .env', async () => {
    const r = await conversar('quanto custa a vitamina C?');
    envelhecer('conversas', 'iniciada_em', r.conversaId, 40);

    expect(executarExpurgo().conversasApagadas).toBe(0);

    process.env.RETENTION_CONVERSATIONS_DAYS = '30';
    limparCacheConfig();
    expect(executarExpurgo().conversasApagadas).toBe(1);

    process.env.RETENTION_CONVERSATIONS_DAYS = '180';
    limparCacheConfig();
  });

  it('pode rodar duas vezes seguidas sem efeito colateral', async () => {
    const r = await conversar('quanto custa a vitamina C?');
    envelhecer('conversas', 'iniciada_em', r.conversaId, 400);

    expect(executarExpurgo().conversasApagadas).toBe(1);
    expect(executarExpurgo().conversasApagadas).toBe(0);
  });
});

describe('Direito de exclusão', () => {
  it('apaga o histórico e anonimiza o cadastro', async () => {
    const r = await conversar('quanto custa a vitamina C?');
    await conversar('passei mal depois de tomar o produto');
    const clienteId = conversas.porId(r.conversaId)!.clienteId;
    notasConversa.criar(r.conversaId, 'Marina', 'Nota de teste.');

    const exclusao = executarExclusao(clienteId);
    expect(exclusao.ok).toBe(true);
    if (!exclusao.ok) return;

    expect(exclusao.dados.conversasApagadas).toBeGreaterThan(0);
    expect(exclusao.dados.cadastroAnonimizado).toBe(true);

    const cliente = clientes.porId(clienteId);
    expect(cliente?.nome).toBe(NOME_ANONIMIZADO);
    expect(cliente?.email).toBe('');
    expect(cliente?.telefone).toBe('');

    expect(conversas.porId(r.conversaId)).toBeNull();
    expect(filaHumana.listar().filter((f) => f.clienteId === clienteId)).toHaveLength(0);
  });

  it('revoga os consentimentos do cliente excluído', () => {
    expect(consentimentos.valido('cli_demo_ana', 'marketing')).toBe(true);
    executarExclusao('cli_demo_ana');
    expect(consentimentos.valido('cli_demo_ana', 'marketing')).toBe(false);
  });

  it('mantém a trilha de auditoria como prova do cumprimento', () => {
    executarExclusao('cli_demo_ana');
    const eventos = auditoria.listar();
    const registro = eventos.find((e) => e.acao === 'lgpd:exclusao_executada');
    expect(registro).toBeDefined();
    expect(registro?.recurso).toBe('cli_demo_ana');
  });

  it('conclui o pedido de exclusão que estava aberto', () => {
    pedidosExclusao.registrar('cli_demo_ana', 'exclusao');
    executarExclusao('cli_demo_ana');
    const pedido = pedidosExclusao.listar().find((p) => p.clienteId === 'cli_demo_ana');
    expect(pedido?.status).toBe('concluido');
    expect(pedido?.concluidoEm).not.toBeNull();
  });

  it('é idempotente e recusa cliente inexistente', () => {
    expect(executarExclusao('cli_demo_ana').ok).toBe(true);
    const segunda = executarExclusao('cli_demo_ana');
    expect(segunda.ok).toBe(true);
    if (segunda.ok) expect(segunda.dados.cadastroAnonimizado).toBe(false);

    const inexistente = executarExclusao('cli_que_nao_existe');
    expect(inexistente.ok).toBe(false);
  });
});

describe('Direito de interrupção das comunicações', () => {
  it('revoga marketing e utilidade e conclui o pedido', () => {
    pedidosExclusao.registrar('cli_demo_bruno', 'interrupcao');
    expect(consentimentos.valido('cli_demo_bruno', 'utilidade')).toBe(true);

    const r = executarInterrupcao('cli_demo_bruno');
    expect(r.ok).toBe(true);
    expect(consentimentos.valido('cli_demo_bruno', 'utilidade')).toBe(false);

    const pedido = pedidosExclusao.listar().find((p) => p.clienteId === 'cli_demo_bruno');
    expect(pedido?.status).toBe('concluido');
  });

  it('não apaga o histórico da conversa', async () => {
    const r = await conversar('quanto custa a vitamina C?', { remetente: '+5511900000002' });
    executarInterrupcao('cli_demo_bruno');
    expect(mensagens.porConversa(r.conversaId).length).toBeGreaterThan(0);
  });
});

describe('Atendimento humano e retenção convivem', () => {
  it('a resposta do atendente também some quando a conversa expira', async () => {
    const r = await conversar('quero falar com um atendente');
    await responderComoAtendente(r.conversaId, 'Marina', 'Oi, sou a Marina.');
    envelhecer('conversas', 'iniciada_em', r.conversaId, 400);

    executarExpurgo();
    expect(mensagens.porConversa(r.conversaId)).toHaveLength(0);
  });
});
