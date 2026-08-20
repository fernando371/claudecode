import { readFileSync } from 'node:fs';
import { doProjeto } from '../caminhos.js';
import { clientes, consentimentos, modelosMensagem } from './repositorios.js';
import { caminhoBanco, db } from './index.js';

/**
 * Popula o banco local com dados FICTICIOS de demonstracao.
 * Rode com: npm run db:reset
 */

interface ClienteBruto {
  id: string;
  nome: string;
  email: string;
  telefone: string;
  ficticio: boolean;
}

export function popular(): { clientes: number; consentimentos: number; modelos: number } {
  db();
  const brutos = JSON.parse(
    readFileSync(doProjeto('data/fixtures/clientes.json'), 'utf8'),
  ) as ClienteBruto[];

  for (const c of brutos) {
    clientes.criar({
      id: c.id,
      nome: c.nome,
      email: c.email,
      telefone: c.telefone,
      ficticio: true,
    });
  }

  // Consentimentos de exemplo: Ana aceitou marketing, Bruno so utilidade,
  // Carla e Diego nao aceitaram nada alem do atendimento (servico).
  const registros: Array<[string, 'servico' | 'utilidade' | 'marketing', boolean]> = [
    ['cli_demo_ana', 'marketing', true],
    ['cli_demo_ana', 'utilidade', true],
    ['cli_demo_bruno', 'utilidade', true],
    ['cli_demo_bruno', 'marketing', false],
  ];
  for (const [clienteId, finalidade, concedido] of registros) {
    consentimentos.registrar({
      clienteId,
      finalidade,
      concedido,
      origem: '[EXEMPLO] checkout do site',
      prova: '[EXEMPLO] caixa de aceite marcada em 2026-08-01',
    });
  }

  modelosMensagem.criar(
    '[EXEMPLO] Aviso de faturamento',
    'utilidade',
    'Olá! Seu pedido {{numero}} foi faturado. Assim que houver rastreio, te aviso por aqui.',
    'rascunho',
  );
  modelosMensagem.criar(
    '[EXEMPLO] Carrinho abandonado',
    'marketing',
    'Oi! Vi que você deixou itens no carrinho. Quer que eu deixe o link pronto?',
    'rascunho',
  );

  return { clientes: brutos.length, consentimentos: registros.length, modelos: 2 };
}

const executadoDiretamente = process.argv[1]?.includes('seed');
if (executadoDiretamente) {
  const r = popular();
  console.log(`Banco populado em ${caminhoBanco()}`);
  console.log(`  clientes ficticios: ${r.clientes}`);
  console.log(`  consentimentos: ${r.consentimentos}`);
  console.log(`  modelos de mensagem: ${r.modelos}`);
  console.log('Todos os dados sao de demonstracao.');
}
