import { falha, mascararEmail, mascararTelefone, ok, type Resultado } from '@fdc/shared';
import { config } from '../config.js';
import { log } from '../logger.js';
import {
  auditoria,
  clientes,
  conversas,
  filaHumana,
  mensagens,
  metricas,
  notasConversa,
  type MensagemRegistro,
  type NotaConversa,
} from '../db/repositorios.js';
import { adaptadores } from '../providers/registro.js';
import { higienizarEntrada } from '../policies/promptInjection.js';

/**
 * ATENDIMENTO HUMANO.
 *
 * Quando uma conversa é transferida, uma pessoa do atendimento precisa
 * conseguir três coisas: ler o histórico, responder o cliente e encerrar.
 * Este módulo cuida disso.
 *
 * Regras que valem aqui:
 * - A resposta humana também respeita a trava de envio real do WhatsApp.
 * - Toda resposta e toda anotação ficam registradas na auditoria.
 * - As anotações internas NUNCA são enviadas ao cliente.
 */

export interface ConversaCompleta {
  conversa: {
    id: string;
    clienteId: string;
    canal: string;
    iniciadaEm: string;
    assumidaPor: string | null;
  };
  cliente: {
    id: string;
    nome: string;
    /** Sempre mascarado. */
    email: string;
    telefone: string;
  } | null;
  mensagens: MensagemRegistro[];
  notas: NotaConversa[];
  fila: ReturnType<typeof filaHumana.listar>;
}

/** Monta a visão completa que o atendente vê no painel, com dados mascarados. */
export function conversaCompleta(conversaId: string): ConversaCompleta | null {
  const conversa = conversas.porId(conversaId);
  if (!conversa) return null;

  const cliente = clientes.porId(conversa.clienteId);
  return {
    conversa: {
      id: conversa.id,
      clienteId: conversa.clienteId,
      canal: conversa.canal,
      iniciadaEm: conversa.iniciadaEm,
      assumidaPor: conversa.assumidaPor,
    },
    cliente: cliente
      ? {
          id: cliente.id,
          nome: cliente.nome,
          email: mascararEmail(cliente.email),
          telefone: mascararTelefone(cliente.telefone),
        }
      : null,
    mensagens: mensagens.porConversa(conversaId),
    notas: notasConversa.porConversa(conversaId),
    fila: filaHumana.listar().filter((f) => f.conversaId === conversaId),
  };
}

export interface ResultadoRespostaHumana {
  mensagem: MensagemRegistro;
  /** true quando a mensagem só foi registrada (ambiente simulado). */
  simulado: boolean;
  avisoEnvio: string | null;
}

/**
 * Envia uma resposta escrita por uma pessoa do atendimento.
 * Assume a conversa automaticamente se ainda não estiver assumida.
 */
export async function responderComoAtendente(
  conversaId: string,
  atendente: string,
  textoBruto: string,
): Promise<Resultado<ResultadoRespostaHumana>> {
  const conversa = conversas.porId(conversaId);
  if (!conversa) {
    return falha({
      codigo: 'nao_encontrado',
      mensagem: 'Conversa não encontrada.',
      origem: 'atendimento',
    });
  }

  const texto = higienizarEntrada(textoBruto, 4000);
  if (!texto) {
    return falha({
      codigo: 'entrada_invalida',
      mensagem: 'A resposta não pode ficar vazia.',
      origem: 'atendimento',
    });
  }

  // Se ninguém assumiu ainda, este atendente passa a ser o responsável.
  if (!conversa.assumidaPor) {
    conversas.assumir(conversaId, atendente);
    for (const item of filaHumana.listar('aberto').filter((f) => f.conversaId === conversaId)) {
      filaHumana.atualizarStatus(item.id, 'em_atendimento', atendente);
    }
  }

  const cliente = clientes.porId(conversa.clienteId);
  const registro = mensagens.registrarAtendente(conversaId, texto, atendente);

  let simulado = true;
  let avisoEnvio: string | null = null;

  if (cliente?.telefone) {
    const envio = await adaptadores().whatsapp.enviar({
      destinatario: cliente.telefone,
      texto,
    });
    if (envio.ok) {
      simulado = envio.dados.simulado;
    } else {
      // A resposta fica registrada mesmo assim: o histórico não pode ter buraco.
      avisoEnvio = envio.erro.mensagem;
      log.warn('resposta humana registrada sem envio', { motivo: envio.erro.codigo });
    }
  } else {
    avisoEnvio =
      'Cliente sem telefone cadastrado; a resposta ficou registrada apenas no histórico.';
  }

  auditoria.registrar({
    ator: `atendente:${atendente}`,
    acao: 'atendimento:responder',
    recurso: conversaId,
    resultado: 'permitido',
    detalhe: `${texto.length} caracteres · ambiente ${config().APP_ENV}`,
  });
  metricas.registrar('mensagem_atendente', { conversaId });

  return ok({ mensagem: registro, simulado, avisoEnvio });
}

/** Anotação interna: fica só no painel, nunca vai para o cliente. */
export function anotarNaConversa(
  conversaId: string,
  atendente: string,
  textoBruto: string,
): Resultado<NotaConversa> {
  if (!conversas.porId(conversaId)) {
    return falha({
      codigo: 'nao_encontrado',
      mensagem: 'Conversa não encontrada.',
      origem: 'atendimento',
    });
  }
  const texto = higienizarEntrada(textoBruto, 1000);
  if (!texto) {
    return falha({
      codigo: 'entrada_invalida',
      mensagem: 'A anotação não pode ficar vazia.',
      origem: 'atendimento',
    });
  }
  const nota = notasConversa.criar(conversaId, atendente, texto);
  auditoria.registrar({
    ator: `atendente:${atendente}`,
    acao: 'atendimento:anotar',
    recurso: conversaId,
    resultado: 'permitido',
    detalhe: 'anotação interna registrada',
  });
  return ok(nota);
}

/** Devolve a conversa para o agente automático. */
export function devolverParaOAgente(conversaId: string, atendente: string): Resultado<true> {
  if (!conversas.porId(conversaId)) {
    return falha({
      codigo: 'nao_encontrado',
      mensagem: 'Conversa não encontrada.',
      origem: 'atendimento',
    });
  }
  conversas.liberar(conversaId);
  for (const item of filaHumana
    .listar()
    .filter((f) => f.conversaId === conversaId && f.status !== 'resolvido')) {
    filaHumana.atualizarStatus(item.id, 'resolvido', atendente);
  }
  auditoria.registrar({
    ator: `atendente:${atendente}`,
    acao: 'atendimento:encerrar',
    recurso: conversaId,
    resultado: 'permitido',
    detalhe: 'conversa devolvida ao agente automático',
  });
  metricas.registrar('atendimento_encerrado', { conversaId });
  return ok(true);
}
