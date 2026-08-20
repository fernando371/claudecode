import { normalizar } from '@fdc/shared';

/**
 * Extrai, da mensagem do cliente, os dados minimos para consultar um pedido.
 * Enquanto os dois nao existirem, o agente PEDE a informacao e nao consulta nada.
 */

export interface DadosIdentificacao {
  numeroPedido: string | null;
  email: string | null;
  telefone: string | null;
  completo: boolean;
  faltando: string[];
}

const RE_NUMERO_PEDIDO =
  /\b(?:#|pedido\s*(?:n[uú]mero|n[ºo°]|numero)?\s*:?\s*)?((?:FDC)?\d{4,10})\b/i;
const RE_EMAIL = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;
const RE_TELEFONE = /(?:\+?55\s?)?\(?\d{2}\)?[\s.-]?9?\d{4}[\s.-]?\d{4}/;

export function extrairIdentificacao(
  texto: string,
  acumulado?: Partial<DadosIdentificacao>,
): DadosIdentificacao {
  const alvo = normalizar(texto);

  const email = texto.match(RE_EMAIL)?.[0] ?? acumulado?.email ?? null;

  // Evita confundir o numero do pedido com um telefone presente na mesma frase.
  const semEmail = texto.replace(RE_EMAIL, ' ');
  const telefoneBruto = semEmail.match(RE_TELEFONE)?.[0] ?? null;
  const telefone = telefoneBruto ?? acumulado?.telefone ?? null;

  const semTelefone = telefoneBruto ? semEmail.replace(telefoneBruto, ' ') : semEmail;
  const capturado = semTelefone.match(RE_NUMERO_PEDIDO)?.[1] ?? null;
  const numeroPedido =
    (capturado ? capturado.toUpperCase() : null) ?? acumulado?.numeroPedido ?? null;

  const faltando: string[] = [];
  if (!numeroPedido) faltando.push('numero_do_pedido');
  if (!email && !telefone) faltando.push('email_ou_telefone');

  void alvo;
  return {
    numeroPedido,
    email,
    telefone,
    completo: faltando.length === 0,
    faltando,
  };
}

export const PEDIDO_DE_IDENTIFICACAO =
  'Para eu conferir seu pedido com segurança, me confirma o número do pedido e o e-mail (ou o telefone) usado na compra?';

export const IDENTIFICACAO_NAO_CONFERE =
  'Não consegui confirmar esse pedido com os dados informados. Por segurança, só posso mostrar informações depois que os dados baterem. Quer tentar de novo ou prefere falar com um atendente?';
