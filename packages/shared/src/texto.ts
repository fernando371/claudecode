/** Normaliza texto para comparacao: minusculas, sem acentos, sem espacos extras. */
export function normalizar(valor: string): string {
  return valor
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/** Verifica se o texto contem qualquer um dos termos (ja normalizados internamente). */
export function contemAlgum(texto: string, termos: readonly string[]): boolean {
  const alvo = normalizar(texto);
  return termos.some((t) => alvo.includes(normalizar(t)));
}

/** Retorna o primeiro termo encontrado, ou null. */
export function primeiroTermo(texto: string, termos: readonly string[]): string | null {
  const alvo = normalizar(texto);
  return termos.find((t) => alvo.includes(normalizar(t))) ?? null;
}
