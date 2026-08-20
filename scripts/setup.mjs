#!/usr/bin/env node
/**
 * Preparação do ambiente local. Cria o .env a partir do .env.example
 * (sem sobrescrever nada) e popula o banco de demonstração.
 */

import { copyFileSync, existsSync, mkdirSync } from 'node:fs';
import { execSync } from 'node:child_process';

if (!existsSync('.env')) {
  copyFileSync('.env.example', '.env');
  console.log('Arquivo .env criado a partir do .env.example.');
} else {
  console.log('Arquivo .env já existe — nada foi alterado.');
}

mkdirSync('data/runtime', { recursive: true });

execSync('npm run db:reset', { stdio: 'inherit' });

console.log('');
console.log('Pronto. Agora rode: npm run dev');
console.log('  Painel:  http://localhost:3000');
console.log('  API:     http://localhost:3333');
