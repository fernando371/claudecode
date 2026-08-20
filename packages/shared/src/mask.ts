/**
 * Mascaramento de dados pessoais (LGPD).
 * Usado em TODOS os logs, respostas do painel e relatorios.
 */

const RE_EMAIL = /([A-Z0-9._%+-])[A-Z0-9._%+-]*@([A-Z0-9.-]+\.[A-Z]{2,})/gi;
// Telefones brasileiros com ou sem DDI/DDD e separadores.
const RE_TELEFONE = /(\+?55\s?)?\(?\d{2}\)?[\s.-]?\d{4,5}[\s.-]?\d{4}/g;
const RE_CPF = /\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/g;
const RE_CNPJ = /\b\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}\b/g;
const RE_CARTAO = /\b(?:\d[ -]*?){13,16}\b/g;
const RE_CEP = /\b\d{5}-?\d{3}\b/g;

export function mascararEmail(valor: string): string {
  return valor.replace(
    RE_EMAIL,
    (_m, primeira: string, dominio: string) => `${primeira}***@${dominio}`,
  );
}

export function mascararTelefone(valor: string): string {
  return valor.replace(RE_TELEFONE, (m) => {
    const digitos = m.replace(/\D/g, '');
    if (digitos.length < 10) return m;
    return `***${digitos.slice(-4)}`;
  });
}

export function mascararDocumentos(valor: string): string {
  return valor.replace(RE_CPF, '***.***.***-**').replace(RE_CNPJ, '**.***.***/****-**');
}

/**
 * Mascara qualquer texto livre antes de gravar em log ou exibir no painel.
 * A ordem importa: documentos antes de telefone/cartao para evitar colisao.
 */
export function mascararTexto(valor: string | null | undefined): string {
  if (!valor) return '';
  let saida = valor;
  saida = mascararDocumentos(saida);
  saida = saida.replace(RE_CEP, '*****-***');
  saida = mascararEmail(saida);
  saida = saida.replace(RE_CARTAO, (m) =>
    m.replace(/\D/g, '').length >= 13 ? '**** **** **** ****' : m,
  );
  saida = mascararTelefone(saida);
  return saida;
}

const CHAVES_SENSIVEIS = [
  'password',
  'senha',
  'token',
  'secret',
  'segredo',
  'apikey',
  'api_key',
  'authorization',
  'cpf',
  'cnpj',
  'cartao',
  'card',
];

/** Mascara recursivamente um objeto antes de ir para o log. */
export function mascararObjeto<T>(entrada: T): T {
  if (entrada === null || entrada === undefined) return entrada;
  if (typeof entrada === 'string') return mascararTexto(entrada) as unknown as T;
  if (Array.isArray(entrada)) return entrada.map((i) => mascararObjeto(i)) as unknown as T;
  if (typeof entrada === 'object') {
    const saida: Record<string, unknown> = {};
    for (const [chave, valor] of Object.entries(entrada as Record<string, unknown>)) {
      if (CHAVES_SENSIVEIS.some((c) => chave.toLowerCase().includes(c))) {
        saida[chave] = '[REDIGIDO]';
      } else {
        saida[chave] = mascararObjeto(valor);
      }
    }
    return saida as unknown as T;
  }
  return entrada;
}

/** Identificador estavel e nao reversivel para um telefone (usado como clienteId em logs). */
export function apelidoAnonimo(valor: string): string {
  const digitos = valor.replace(/\D/g, '');
  let hash = 0;
  for (let i = 0; i < digitos.length; i += 1) {
    hash = (hash * 31 + digitos.charCodeAt(i)) >>> 0;
  }
  return `cli_${hash.toString(36)}`;
}
