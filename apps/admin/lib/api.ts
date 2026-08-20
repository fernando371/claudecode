/**
 * Acesso à API do backend. Roda no servidor do Next.js, nunca no navegador,
 * para que credenciais do painel não fiquem expostas.
 */

export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3333';

function cabecalhos(): HeadersInit {
  const usuario = process.env.ADMIN_USER;
  const senha = process.env.ADMIN_PASSWORD;
  if (!senha) return { 'content-type': 'application/json' };
  const credencial = Buffer.from(`${usuario ?? 'admin'}:${senha}`).toString('base64');
  return { 'content-type': 'application/json', authorization: `Basic ${credencial}` };
}

export async function buscar<T>(caminho: string): Promise<T | { erroApi: string }> {
  try {
    const resposta = await fetch(`${API_URL}${caminho}`, {
      headers: cabecalhos(),
      cache: 'no-store',
    });
    if (!resposta.ok) return { erroApi: `A API respondeu ${resposta.status}` };
    return (await resposta.json()) as T;
  } catch {
    return { erroApi: 'Não foi possível falar com a API. Ela está rodando? (npm run dev)' };
  }
}

export function temErro<T>(v: T | { erroApi: string }): v is { erroApi: string } {
  return typeof v === 'object' && v !== null && 'erroApi' in v;
}
