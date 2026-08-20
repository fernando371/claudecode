import type {
  Consentimento,
  EventoAuditoria,
  Finalidade,
  ItemFilaHumana,
  MotivoEscalonamento,
  RespostaAgente,
} from '@fdc/shared';
import { mascararTexto } from '@fdc/shared';
import { agora, db, novoId } from './index.js';

type Linha = Record<string, unknown>;

const texto = (l: Linha, c: string): string => String(l[c] ?? '');
const textoOuNulo = (l: Linha, c: string): string | null =>
  l[c] === null || l[c] === undefined ? null : String(l[c]);
const numero = (l: Linha, c: string): number => Number(l[c] ?? 0);
const bool = (l: Linha, c: string): boolean => Number(l[c] ?? 0) === 1;

// ---------------------------------------------------------------------------
// Clientes
// ---------------------------------------------------------------------------

export interface ClienteRegistro {
  id: string;
  nome: string;
  email: string;
  telefone: string;
  criadoEm: string;
  ficticio: boolean;
}

export const clientes = {
  criar(c: Omit<ClienteRegistro, 'criadoEm'> & { criadoEm?: string }): ClienteRegistro {
    const registro: ClienteRegistro = { ...c, criadoEm: c.criadoEm ?? agora() };
    db()
      .prepare(
        `INSERT OR REPLACE INTO clientes (id, nome, email, telefone, criado_em, ficticio)
         VALUES (?, ?, ?, ?, ?, ?)`,
      )
      .run(
        registro.id,
        registro.nome,
        registro.email,
        registro.telefone,
        registro.criadoEm,
        registro.ficticio ? 1 : 0,
      );
    return registro;
  },
  porId(id: string): ClienteRegistro | null {
    const l = db().prepare('SELECT * FROM clientes WHERE id = ?').get(id) as Linha | undefined;
    return l ? mapearCliente(l) : null;
  },
  porTelefone(telefone: string): ClienteRegistro | null {
    const chave = telefone.replace(/\D/g, '').slice(-11);
    const l = db()
      .prepare(
        `SELECT * FROM clientes WHERE replace(replace(replace(replace(telefone,'+',''),'-',''),' ',''),')','') LIKE ?`,
      )
      .get(`%${chave}`) as Linha | undefined;
    return l ? mapearCliente(l) : null;
  },
  listar(): ClienteRegistro[] {
    return (db().prepare('SELECT * FROM clientes ORDER BY nome').all() as Linha[]).map(
      mapearCliente,
    );
  },
};

function mapearCliente(l: Linha): ClienteRegistro {
  return {
    id: texto(l, 'id'),
    nome: texto(l, 'nome'),
    email: texto(l, 'email'),
    telefone: texto(l, 'telefone'),
    criadoEm: texto(l, 'criado_em'),
    ficticio: bool(l, 'ficticio'),
  };
}

// ---------------------------------------------------------------------------
// Conversas e mensagens
// ---------------------------------------------------------------------------

export interface ConversaRegistro {
  id: string;
  clienteId: string;
  canal: string;
  iniciadaEm: string;
  encerradaEm: string | null;
  assumidaPor: string | null;
}

export const conversas = {
  abrir(clienteId: string, canal: string, id = novoId('conv')): ConversaRegistro {
    const registro: ConversaRegistro = {
      id,
      clienteId,
      canal,
      iniciadaEm: agora(),
      encerradaEm: null,
      assumidaPor: null,
    };
    db()
      .prepare(
        'INSERT OR IGNORE INTO conversas (id, cliente_id, canal, iniciada_em) VALUES (?, ?, ?, ?)',
      )
      .run(registro.id, registro.clienteId, registro.canal, registro.iniciadaEm);
    return this.porId(id) ?? registro;
  },
  porId(id: string): ConversaRegistro | null {
    const l = db().prepare('SELECT * FROM conversas WHERE id = ?').get(id) as Linha | undefined;
    if (!l) return null;
    return {
      id: texto(l, 'id'),
      clienteId: texto(l, 'cliente_id'),
      canal: texto(l, 'canal'),
      iniciadaEm: texto(l, 'iniciada_em'),
      encerradaEm: textoOuNulo(l, 'encerrada_em'),
      assumidaPor: textoOuNulo(l, 'assumida_por'),
    };
  },
  assumir(id: string, atendente: string): void {
    db().prepare('UPDATE conversas SET assumida_por = ? WHERE id = ?').run(atendente, id);
  },
  liberar(id: string): void {
    db().prepare('UPDATE conversas SET assumida_por = NULL WHERE id = ?').run(id);
  },
  listar(limite = 100): ConversaRegistro[] {
    return (
      db()
        .prepare('SELECT * FROM conversas ORDER BY iniciada_em DESC LIMIT ?')
        .all(limite) as Linha[]
    ).map((l) => ({
      id: texto(l, 'id'),
      clienteId: texto(l, 'cliente_id'),
      canal: texto(l, 'canal'),
      iniciadaEm: texto(l, 'iniciada_em'),
      encerradaEm: textoOuNulo(l, 'encerrada_em'),
      assumidaPor: textoOuNulo(l, 'assumida_por'),
    }));
  },
  apagar(id: string): void {
    db().prepare('DELETE FROM mensagens WHERE conversa_id = ?').run(id);
    db().prepare('DELETE FROM conversas WHERE id = ?').run(id);
  },
};

export interface MensagemRegistro {
  id: string;
  conversaId: string;
  direcao: 'entrada' | 'saida';
  texto: string;
  intencao: string | null;
  confianca: number | null;
  fontes: string[];
  regras: string[];
  escalonado: boolean;
  motivoEscalonamento: string | null;
  bloqueadoSeguranca: boolean;
  duracaoMs: number | null;
  criadoEm: string;
}

export const mensagens = {
  registrarEntrada(conversaId: string, conteudo: string): MensagemRegistro {
    return inserirMensagem({
      conversaId,
      direcao: 'entrada',
      texto: conteudo,
      intencao: null,
      confianca: null,
      fontes: [],
      regras: [],
      escalonado: false,
      motivoEscalonamento: null,
      bloqueadoSeguranca: false,
      duracaoMs: null,
    });
  },
  registrarSaida(resposta: RespostaAgente): MensagemRegistro {
    return inserirMensagem({
      conversaId: resposta.conversaId,
      direcao: 'saida',
      texto: resposta.texto,
      intencao: resposta.intencao,
      confianca: resposta.confianca,
      fontes: resposta.fontes.map((f) => `${f.tipo}:${f.referencia}`),
      regras: resposta.regrasAcionadas,
      escalonado: resposta.transferidoParaHumano,
      motivoEscalonamento: resposta.motivoEscalonamento,
      bloqueadoSeguranca: resposta.bloqueadoPorSeguranca,
      duracaoMs: resposta.duracaoMs,
    });
  },
  porConversa(conversaId: string): MensagemRegistro[] {
    return (
      db()
        .prepare('SELECT * FROM mensagens WHERE conversa_id = ? ORDER BY criado_em, rowid')
        .all(conversaId) as Linha[]
    ).map(mapearMensagem);
  },
  todas(limite = 500): MensagemRegistro[] {
    return (
      db().prepare('SELECT * FROM mensagens ORDER BY criado_em DESC LIMIT ?').all(limite) as Linha[]
    ).map(mapearMensagem);
  },
};

function inserirMensagem(m: Omit<MensagemRegistro, 'id' | 'criadoEm'>): MensagemRegistro {
  const registro: MensagemRegistro = { ...m, id: novoId('msg'), criadoEm: agora() };
  db()
    .prepare(
      `INSERT INTO mensagens (id, conversa_id, direcao, texto, intencao, confianca, fontes, regras,
        escalonado, motivo_escalonamento, bloqueado_seguranca, duracao_ms, criado_em)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    )
    .run(
      registro.id,
      registro.conversaId,
      registro.direcao,
      registro.texto,
      registro.intencao,
      registro.confianca,
      JSON.stringify(registro.fontes),
      JSON.stringify(registro.regras),
      registro.escalonado ? 1 : 0,
      registro.motivoEscalonamento,
      registro.bloqueadoSeguranca ? 1 : 0,
      registro.duracaoMs,
      registro.criadoEm,
    );
  return registro;
}

function mapearMensagem(l: Linha): MensagemRegistro {
  return {
    id: texto(l, 'id'),
    conversaId: texto(l, 'conversa_id'),
    direcao: texto(l, 'direcao') as 'entrada' | 'saida',
    texto: texto(l, 'texto'),
    intencao: textoOuNulo(l, 'intencao'),
    confianca: l['confianca'] === null ? null : numero(l, 'confianca'),
    fontes: JSON.parse(texto(l, 'fontes') || '[]') as string[],
    regras: JSON.parse(texto(l, 'regras') || '[]') as string[],
    escalonado: bool(l, 'escalonado'),
    motivoEscalonamento: textoOuNulo(l, 'motivo_escalonamento'),
    bloqueadoSeguranca: bool(l, 'bloqueado_seguranca'),
    duracaoMs: l['duracao_ms'] === null ? null : numero(l, 'duracao_ms'),
    criadoEm: texto(l, 'criado_em'),
  };
}

// ---------------------------------------------------------------------------
// Idempotencia de webhook
// ---------------------------------------------------------------------------

export const idempotencia = {
  /** Retorna true se a mensagem for NOVA. Retorna false se ja foi processada. */
  registrarSeNova(idExterno: string, canal: string): boolean {
    const existente = db()
      .prepare('SELECT id_externo FROM mensagens_processadas WHERE id_externo = ?')
      .get(idExterno);
    if (existente) return false;
    db()
      .prepare(
        'INSERT INTO mensagens_processadas (id_externo, canal, processado_em) VALUES (?,?,?)',
      )
      .run(idExterno, canal, agora());
    return true;
  },
};

// ---------------------------------------------------------------------------
// Consentimentos
// ---------------------------------------------------------------------------

export const consentimentos = {
  registrar(entrada: Omit<Consentimento, 'id' | 'registradoEm' | 'revogadoEm'>): Consentimento {
    const registro: Consentimento = {
      ...entrada,
      id: novoId('cons'),
      registradoEm: agora(),
      revogadoEm: null,
    };
    db()
      .prepare(
        `INSERT INTO consentimentos (id, cliente_id, finalidade, concedido, origem, prova, registrado_em)
         VALUES (?,?,?,?,?,?,?)`,
      )
      .run(
        registro.id,
        registro.clienteId,
        registro.finalidade,
        registro.concedido ? 1 : 0,
        registro.origem,
        registro.prova,
        registro.registradoEm,
      );
    return registro;
  },
  revogar(clienteId: string, finalidade: Finalidade): void {
    db()
      .prepare(
        'UPDATE consentimentos SET revogado_em = ? WHERE cliente_id = ? AND finalidade = ? AND revogado_em IS NULL',
      )
      .run(agora(), clienteId, finalidade);
  },
  /** So considera valido consentimento concedido e nao revogado. */
  valido(clienteId: string, finalidade: Finalidade): boolean {
    const l = db()
      .prepare(
        `SELECT * FROM consentimentos
         WHERE cliente_id = ? AND finalidade = ? AND concedido = 1 AND revogado_em IS NULL
         ORDER BY registrado_em DESC LIMIT 1`,
      )
      .get(clienteId, finalidade) as Linha | undefined;
    return Boolean(l);
  },
  listar(): Consentimento[] {
    return (
      db().prepare('SELECT * FROM consentimentos ORDER BY registrado_em DESC').all() as Linha[]
    ).map((l) => ({
      id: texto(l, 'id'),
      clienteId: texto(l, 'cliente_id'),
      finalidade: texto(l, 'finalidade') as Finalidade,
      concedido: bool(l, 'concedido'),
      origem: texto(l, 'origem'),
      prova: texto(l, 'prova'),
      registradoEm: texto(l, 'registrado_em'),
      revogadoEm: textoOuNulo(l, 'revogado_em'),
    }));
  },
};

export const pedidosExclusao = {
  registrar(clienteId: string, tipo: 'exclusao' | 'interrupcao') {
    const id = novoId('lgpd');
    db()
      .prepare(
        'INSERT INTO pedidos_exclusao (id, cliente_id, tipo, status, criado_em) VALUES (?,?,?,?,?)',
      )
      .run(id, clienteId, tipo, 'aberto', agora());
    return id;
  },
  listar() {
    return (
      db().prepare('SELECT * FROM pedidos_exclusao ORDER BY criado_em DESC').all() as Linha[]
    ).map((l) => ({
      id: texto(l, 'id'),
      clienteId: texto(l, 'cliente_id'),
      tipo: texto(l, 'tipo'),
      status: texto(l, 'status'),
      criadoEm: texto(l, 'criado_em'),
      concluidoEm: textoOuNulo(l, 'concluido_em'),
    }));
  },
};

// ---------------------------------------------------------------------------
// Fila de atendimento humano
// ---------------------------------------------------------------------------

export const filaHumana = {
  criar(entrada: {
    conversaId: string;
    clienteId: string;
    motivo: MotivoEscalonamento;
    resumo: string;
    prioridade?: 'alta' | 'normal';
  }): ItemFilaHumana {
    const registro: ItemFilaHumana = {
      id: novoId('fila'),
      conversaId: entrada.conversaId,
      clienteId: entrada.clienteId,
      motivo: entrada.motivo,
      resumo: mascararTexto(entrada.resumo).slice(0, 400),
      prioridade: entrada.prioridade ?? 'normal',
      status: 'aberto',
      criadoEm: agora(),
      atendente: null,
    };
    db()
      .prepare(
        `INSERT INTO fila_humana (id, conversa_id, cliente_id, motivo, resumo, prioridade, status, criado_em)
         VALUES (?,?,?,?,?,?,?,?)`,
      )
      .run(
        registro.id,
        registro.conversaId,
        registro.clienteId,
        registro.motivo,
        registro.resumo,
        registro.prioridade,
        registro.status,
        registro.criadoEm,
      );
    return registro;
  },
  atualizarStatus(id: string, status: ItemFilaHumana['status'], atendente: string | null): void {
    db()
      .prepare('UPDATE fila_humana SET status = ?, atendente = ? WHERE id = ?')
      .run(status, atendente, id);
  },
  listar(status?: ItemFilaHumana['status']): ItemFilaHumana[] {
    const linhas = status
      ? (db()
          .prepare('SELECT * FROM fila_humana WHERE status = ? ORDER BY criado_em DESC')
          .all(status) as Linha[])
      : (db().prepare('SELECT * FROM fila_humana ORDER BY criado_em DESC').all() as Linha[]);
    return linhas.map((l) => ({
      id: texto(l, 'id'),
      conversaId: texto(l, 'conversa_id'),
      clienteId: texto(l, 'cliente_id'),
      motivo: texto(l, 'motivo') as MotivoEscalonamento,
      resumo: texto(l, 'resumo'),
      prioridade: texto(l, 'prioridade') as 'alta' | 'normal',
      status: texto(l, 'status') as ItemFilaHumana['status'],
      criadoEm: texto(l, 'criado_em'),
      atendente: textoOuNulo(l, 'atendente'),
    }));
  },
};

// ---------------------------------------------------------------------------
// Auditoria
// ---------------------------------------------------------------------------

export const auditoria = {
  registrar(entrada: Omit<EventoAuditoria, 'id' | 'ocorridoEm'>): EventoAuditoria {
    const registro: EventoAuditoria = {
      ...entrada,
      detalhe: mascararTexto(entrada.detalhe).slice(0, 500),
      id: novoId('aud'),
      ocorridoEm: agora(),
    };
    db()
      .prepare(
        'INSERT INTO auditoria (id, ocorrido_em, ator, acao, recurso, resultado, detalhe) VALUES (?,?,?,?,?,?,?)',
      )
      .run(
        registro.id,
        registro.ocorridoEm,
        registro.ator,
        registro.acao,
        registro.recurso,
        registro.resultado,
        registro.detalhe,
      );
    return registro;
  },
  listar(limite = 200): EventoAuditoria[] {
    return (
      db()
        .prepare('SELECT * FROM auditoria ORDER BY ocorrido_em DESC LIMIT ?')
        .all(limite) as Linha[]
    ).map((l) => ({
      id: texto(l, 'id'),
      ocorridoEm: texto(l, 'ocorrido_em'),
      ator: texto(l, 'ator'),
      acao: texto(l, 'acao'),
      recurso: texto(l, 'recurso'),
      resultado: texto(l, 'resultado') as EventoAuditoria['resultado'],
      detalhe: texto(l, 'detalhe'),
    }));
  },
};

// ---------------------------------------------------------------------------
// Eventos de metricas
// ---------------------------------------------------------------------------

export const metricas = {
  registrar(
    tipo: string,
    dados?: { conversaId?: string; valorCentavos?: number; detalhe?: string },
  ) {
    const id = novoId('met');
    db()
      .prepare(
        'INSERT INTO eventos_metricas (id, tipo, conversa_id, valor_centavos, detalhe, criado_em) VALUES (?,?,?,?,?,?)',
      )
      .run(
        id,
        tipo,
        dados?.conversaId ?? null,
        dados?.valorCentavos ?? null,
        dados?.detalhe ?? null,
        agora(),
      );
    return id;
  },
  contarPorTipo(): Record<string, number> {
    const linhas = db()
      .prepare('SELECT tipo, COUNT(*) as total FROM eventos_metricas GROUP BY tipo')
      .all() as Linha[];
    return Object.fromEntries(linhas.map((l) => [texto(l, 'tipo'), numero(l, 'total')]));
  },
  somarValor(tipo: string): number {
    const l = db()
      .prepare(
        'SELECT COALESCE(SUM(valor_centavos),0) as total FROM eventos_metricas WHERE tipo = ?',
      )
      .get(tipo) as Linha | undefined;
    return l ? numero(l, 'total') : 0;
  },
  listar(limite = 200) {
    return (
      db()
        .prepare('SELECT * FROM eventos_metricas ORDER BY criado_em DESC LIMIT ?')
        .all(limite) as Linha[]
    ).map((l) => ({
      id: texto(l, 'id'),
      tipo: texto(l, 'tipo'),
      conversaId: textoOuNulo(l, 'conversa_id'),
      valorCentavos: l['valor_centavos'] === null ? null : numero(l, 'valor_centavos'),
      detalhe: textoOuNulo(l, 'detalhe'),
      criadoEm: texto(l, 'criado_em'),
    }));
  },
};

// ---------------------------------------------------------------------------
// Campanhas (estrutura criada, envio desligado)
// ---------------------------------------------------------------------------

export const modelosMensagem = {
  criar(nome: string, categoria: Finalidade, corpo: string, status = 'rascunho') {
    const id = novoId('modelo');
    db()
      .prepare(
        'INSERT INTO modelos_mensagem (id, nome, categoria, corpo, status, criado_em) VALUES (?,?,?,?,?,?)',
      )
      .run(id, nome, categoria, corpo, status, agora());
    return id;
  },
  listar() {
    return (db().prepare('SELECT * FROM modelos_mensagem ORDER BY nome').all() as Linha[]).map(
      (l) => ({
        id: texto(l, 'id'),
        nome: texto(l, 'nome'),
        categoria: texto(l, 'categoria') as Finalidade,
        corpo: texto(l, 'corpo'),
        status: texto(l, 'status'),
        criadoEm: texto(l, 'criado_em'),
      }),
    );
  },
};

export const enviosCampanha = {
  registrar(campanhaId: string, clienteId: string, status: string, motivoBloqueio: string | null) {
    const id = novoId('envio');
    db()
      .prepare(
        'INSERT INTO envios_campanha (id, campanha_id, cliente_id, status, motivo_bloqueio, criado_em) VALUES (?,?,?,?,?,?)',
      )
      .run(id, campanhaId, clienteId, status, motivoBloqueio, agora());
    return id;
  },
  contarNaSemana(clienteId: string): number {
    const limite = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString();
    const l = db()
      .prepare(
        "SELECT COUNT(*) as total FROM envios_campanha WHERE cliente_id = ? AND status = 'enviado' AND criado_em >= ?",
      )
      .get(clienteId, limite) as Linha | undefined;
    return l ? numero(l, 'total') : 0;
  },
  listar() {
    return (
      db()
        .prepare('SELECT * FROM envios_campanha ORDER BY criado_em DESC LIMIT 200')
        .all() as Linha[]
    ).map((l) => ({
      id: texto(l, 'id'),
      campanhaId: texto(l, 'campanha_id'),
      clienteId: texto(l, 'cliente_id'),
      status: texto(l, 'status'),
      motivoBloqueio: textoOuNulo(l, 'motivo_bloqueio'),
      criadoEm: texto(l, 'criado_em'),
    }));
  },
};
