import { NextRequest, NextResponse } from 'next/server';
import { API_URL } from '@/lib/api';

/**
 * Repasse do navegador para a API.
 * Mantém as credenciais do painel no servidor — elas nunca chegam ao navegador.
 */

function cabecalhos(): HeadersInit {
  const senha = process.env.ADMIN_PASSWORD;
  if (!senha) return { 'content-type': 'application/json' };
  const credencial = Buffer.from(`${process.env.ADMIN_USER ?? 'admin'}:${senha}`).toString(
    'base64',
  );
  return { 'content-type': 'application/json', authorization: `Basic ${credencial}` };
}

async function repassar(requisicao: NextRequest, caminho: string[], metodo: string) {
  const alvo = `${API_URL}/${caminho.join('/')}${requisicao.nextUrl.search}`;
  const corpo = metodo === 'GET' ? undefined : await requisicao.text();
  try {
    const resposta = await fetch(alvo, {
      method: metodo,
      headers: cabecalhos(),
      ...(corpo ? { body: corpo } : {}),
      cache: 'no-store',
    });
    const texto = await resposta.text();
    return new NextResponse(texto, {
      status: resposta.status,
      headers: { 'content-type': resposta.headers.get('content-type') ?? 'application/json' },
    });
  } catch {
    return NextResponse.json(
      { erro: 'api_indisponivel', mensagem: 'Não foi possível falar com a API.' },
      { status: 503 },
    );
  }
}

type Contexto = { params: Promise<{ caminho: string[] }> };

export async function GET(requisicao: NextRequest, contexto: Contexto) {
  const { caminho } = await contexto.params;
  return repassar(requisicao, caminho, 'GET');
}

export async function POST(requisicao: NextRequest, contexto: Contexto) {
  const { caminho } = await contexto.params;
  return repassar(requisicao, caminho, 'POST');
}

export async function PUT(requisicao: NextRequest, contexto: Contexto) {
  const { caminho } = await contexto.params;
  return repassar(requisicao, caminho, 'PUT');
}
