import { mascararObjeto } from '@fdc/shared';
import { config } from './config.js';

type Nivel = 'debug' | 'info' | 'warn' | 'error';

const ORDEM: Record<Nivel, number> = { debug: 10, info: 20, warn: 30, error: 40 };

function nivelAtual(): number {
  const c = process.env.LOG_LEVEL?.toLowerCase() as Nivel | undefined;
  return ORDEM[c ?? 'info'] ?? ORDEM.info;
}

function emitir(nivel: Nivel, mensagem: string, dados?: Record<string, unknown>): void {
  if (ORDEM[nivel] < nivelAtual()) return;
  let mascarado = process.env.NODE_ENV === 'test' ? true : true;
  try {
    mascarado = config().PII_MASKING_ENABLED;
  } catch {
    mascarado = true;
  }
  const corpo = {
    nivel,
    ts: new Date().toISOString(),
    msg: mensagem,
    ...(dados ? (mascarado ? mascararObjeto(dados) : dados) : {}),
  };
  const linha = JSON.stringify(corpo);
  if (nivel === 'error') console.error(linha);
  else if (nivel === 'warn') console.warn(linha);
  else console.log(linha);
}

export const log = {
  debug: (m: string, d?: Record<string, unknown>) => emitir('debug', m, d),
  info: (m: string, d?: Record<string, unknown>) => emitir('info', m, d),
  warn: (m: string, d?: Record<string, unknown>) => emitir('warn', m, d),
  error: (m: string, d?: Record<string, unknown>) => emitir('error', m, d),
};
