#!/usr/bin/env node
/**
 * Verificação defensiva: procura segredos que possam ter entrado no código
 * por engano. Roda 100% local, não acessa nada externo.
 *
 * Uso: npm run check:secrets
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { extname, join, relative } from 'node:path';

const RAIZ = process.cwd();

const IGNORAR_PASTAS = new Set([
  'node_modules',
  '.git',
  '.next',
  'dist',
  'build',
  'coverage',
  'data',
  '.vitest',
]);

const EXTENSOES = new Set([
  '.ts',
  '.tsx',
  '.js',
  '.mjs',
  '.cjs',
  '.json',
  '.md',
  '.yml',
  '.yaml',
  '.sql',
  '.env',
]);

const PADROES = [
  [/sk-ant-[A-Za-z0-9_-]{10,}/, 'chave da Anthropic'],
  [/shpat_[a-fA-F0-9]{20,}/, 'token de app do Shopify'],
  [/shpss_[a-fA-F0-9]{20,}/, 'segredo de app do Shopify'],
  [/EAA[A-Za-z0-9]{40,}/, 'token de acesso da Meta'],
  [/AKIA[0-9A-Z]{16}/, 'chave da AWS'],
  [/-----BEGIN [A-Z ]*PRIVATE KEY-----/, 'chave privada'],
  [/xox[baprs]-[A-Za-z0-9-]{10,}/, 'token do Slack'],
  [/ghp_[A-Za-z0-9]{30,}/, 'token do GitHub'],
];

// Linhas do tipo CHAVE=valor com valor preenchido em arquivos de exemplo.
const RE_ENV_PREENCHIDO =
  /^(META_APP_SECRET|META_ACCESS_TOKEN|SHOPIFY_ADMIN_TOKEN|ANTHROPIC_API_KEY|ADMIN_PASSWORD|ADMIN_SESSION_SECRET|SAP_CLIENT_SECRET|MANDAE_TOKEN|CORREIOS_TOKEN|FONTESLOG_TOKEN|TMLOGISTICA_TOKEN)\s*=\s*(.+)$/;

const achados = [];

function percorrer(pasta) {
  for (const nome of readdirSync(pasta)) {
    if (IGNORAR_PASTAS.has(nome)) continue;
    const caminho = join(pasta, nome);
    const info = statSync(caminho);
    if (info.isDirectory()) {
      percorrer(caminho);
      continue;
    }
    const ehEnv = nome.startsWith('.env');
    if (!ehEnv && !EXTENSOES.has(extname(nome))) continue;
    // O .env local é do desenvolvedor e não vai para o Git; só checamos o exemplo.
    if (nome === '.env') continue;

    const relativo = relative(RAIZ, caminho);
    const conteudo = readFileSync(caminho, 'utf8');
    const linhas = conteudo.split('\n');

    linhas.forEach((linha, i) => {
      for (const [padrao, descricao] of PADROES) {
        if (padrao.test(linha)) {
          achados.push(`${relativo}:${i + 1} — possível ${descricao}`);
        }
      }
      if (nome === '.env.example') {
        const semComentario = linha.replace(/\s+#.*$/, '');
        const m = semComentario.match(RE_ENV_PREENCHIDO);
        if (m && m[2].trim() !== '') {
          achados.push(`${relativo}:${i + 1} — ${m[1]} está preenchido no arquivo de exemplo`);
        }
      }
    });
  }
}

percorrer(RAIZ);

if (achados.length > 0) {
  console.error('\nATENÇÃO: possíveis segredos encontrados no código:\n');
  for (const a of achados) console.error(`  - ${a}`);
  console.error('\nRemova o valor, troque a credencial e use apenas o arquivo .env local.\n');
  process.exit(1);
}

console.log('Verificação de segredos: nenhum segredo encontrado no código versionado.');
