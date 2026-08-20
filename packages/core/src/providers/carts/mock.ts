import { readFileSync } from 'node:fs';
import { falha, ok, type Resultado } from '@fdc/shared';
import { doProjeto } from '../../caminhos.js';
import { simulacao } from '../simulacaoFalhas.js';
import type { CarrinhoAbandonado, CartProvider, ItemCarrinho } from './tipos.js';

interface CarrinhoBruto {
  id: string;
  clienteId: string;
  criadoEmDias: number;
  itens: ItemCarrinho[];
  ficticio: boolean;
}

function carregar(): CarrinhoAbandonado[] {
  const brutos = JSON.parse(
    readFileSync(doProjeto('data/fixtures/carrinhos.json'), 'utf8'),
  ) as CarrinhoBruto[];
  return brutos.map((c) => ({
    id: c.id,
    clienteId: c.clienteId,
    criadoEm: new Date(Date.now() + c.criadoEmDias * 24 * 3600 * 1000).toISOString(),
    itens: c.itens,
    ficticio: true,
  }));
}

const indisponivel = <T>(): Resultado<T> =>
  falha({
    codigo: 'indisponivel',
    mensagem: 'Carrinhos simulados marcados como indisponíveis pelo simulador.',
    origem: 'carrinho:mock',
  });

/** Carrinhos abandonados fictícios. Não acessa internet. */
export class MockCartProvider implements CartProvider {
  readonly nome = 'MockCartProvider';
  readonly modo = 'mock' as const;

  async maisRecenteDoCliente(clienteId: string): Promise<Resultado<CarrinhoAbandonado>> {
    if (simulacao.ler().pedidosIndisponivel) return indisponivel();
    const meus = carregar()
      .filter((c) => c.clienteId === clienteId)
      .sort((a, b) => Date.parse(b.criadoEm) - Date.parse(a.criadoEm));
    const primeiro = meus[0];
    if (!primeiro) {
      return falha({
        codigo: 'nao_encontrado',
        mensagem: 'Nenhum carrinho abandonado para esse cliente.',
        origem: 'carrinho:mock',
      });
    }
    return ok(primeiro);
  }

  async listarInterno(): Promise<Resultado<CarrinhoAbandonado[]>> {
    if (simulacao.ler().pedidosIndisponivel) return indisponivel();
    return ok(carregar());
  }
}
