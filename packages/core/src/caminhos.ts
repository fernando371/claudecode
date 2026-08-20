import { existsSync, readFileSync } from 'node:fs';
import { dirname, isAbsolute, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Descobre a pasta raiz do projeto.
 *
 * Isso é necessário porque alguns comandos (por exemplo `npm run seed -w @fdc/core`)
 * rodam a partir de uma subpasta. Sem isso, os arquivos de dados não seriam encontrados.
 */

let cache: string | null = null;

function ehRaiz(pasta: string): boolean {
  const pacote = resolve(pasta, 'package.json');
  if (!existsSync(pacote)) return false;
  try {
    const conteudo = JSON.parse(readFileSync(pacote, 'utf8')) as { name?: string };
    return conteudo.name === 'fdc-whatsapp-ai';
  } catch {
    return false;
  }
}

export function raizProjeto(): string {
  if (cache) return cache;

  const candidatos = [process.cwd(), dirname(fileURLToPath(import.meta.url))];
  for (const inicio of candidatos) {
    let atual = resolve(inicio);
    for (let i = 0; i < 8; i += 1) {
      if (ehRaiz(atual)) {
        cache = atual;
        return atual;
      }
      const pai = dirname(atual);
      if (pai === atual) break;
      atual = pai;
    }
  }

  cache = process.cwd();
  return cache;
}

/** Resolve um caminho relativo à raiz do projeto. */
export function doProjeto(...partes: string[]): string {
  const primeiro = partes[0];
  if (primeiro && isAbsolute(primeiro) && partes.length === 1) return primeiro;
  return resolve(raizProjeto(), ...partes);
}
