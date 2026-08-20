import { readFileSync } from 'node:fs';
import { falha, ok, type Produto, type Resultado } from '@fdc/shared';
import { doProjeto } from '../../caminhos.js';
import { simulacao } from '../simulacaoFalhas.js';
import type { CatalogProvider } from './tipos.js';

function carregar(): Produto[] {
  const caminho = doProjeto('data/fixtures/produtos.json');
  return JSON.parse(readFileSync(caminho, 'utf8')) as Produto[];
}

const semAcento = (t: string) =>
  t
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

function aplicarSimulacao(produtos: Produto[]): Produto[] {
  if (!simulacao.ler().semEstoque) return produtos;
  return produtos.map((p) => ({
    ...p,
    variantes: p.variantes.map((v) => ({ ...v, disponivel: false, estoque: 0 })),
  }));
}

const indisponivel = <T>(): Resultado<T> =>
  falha({
    codigo: 'indisponivel',
    mensagem: 'Catalogo simulado marcado como indisponivel pelo simulador.',
    origem: 'catalogo:mock',
  });

/** Catalogo ficticio. Nao acessa internet. Todos os produtos sao de demonstracao. */
export class MockCatalogProvider implements CatalogProvider {
  readonly nome = 'MockCatalogProvider';
  readonly modo = 'mock' as const;

  async listar(): Promise<Resultado<Produto[]>> {
    if (simulacao.ler().catalogoIndisponivel) return indisponivel();
    return ok(aplicarSimulacao(carregar()));
  }

  async buscar(termo: string, limite = 5): Promise<Resultado<Produto[]>> {
    if (simulacao.ler().catalogoIndisponivel) return indisponivel();
    const alvo = semAcento(termo);
    const palavras = alvo.split(/\s+/).filter((p) => p.length >= 3);
    const encontrados = aplicarSimulacao(carregar()).filter((p) => {
      const texto = semAcento(`${p.titulo} ${p.categoria} ${p.marca} ${p.descricaoCurta}`);
      return palavras.some((palavra) => texto.includes(palavra));
    });
    return ok(encontrados.slice(0, limite));
  }

  async porId(id: string): Promise<Resultado<Produto>> {
    if (simulacao.ler().catalogoIndisponivel) return indisponivel();
    const p = aplicarSimulacao(carregar()).find((x) => x.id === id);
    if (!p)
      return falha({
        codigo: 'nao_encontrado',
        mensagem: 'Produto nao encontrado no catalogo.',
        origem: 'catalogo:mock',
      });
    return ok(p);
  }

  async porSku(sku: string): Promise<Resultado<Produto>> {
    if (simulacao.ler().catalogoIndisponivel) return indisponivel();
    const p = aplicarSimulacao(carregar()).find((x) =>
      x.variantes.some((v) => v.sku.toLowerCase() === sku.toLowerCase()),
    );
    if (!p)
      return falha({
        codigo: 'nao_encontrado',
        mensagem: 'SKU nao encontrado no catalogo.',
        origem: 'catalogo:mock',
      });
    return ok(p);
  }

  async linkCarrinho(skus: Array<{ sku: string; quantidade: number }>): Promise<Resultado<string>> {
    if (skus.length === 0)
      return falha({
        codigo: 'entrada_invalida',
        mensagem: 'Informe ao menos um SKU.',
        origem: 'catalogo:mock',
      });
    const partes = skus.map((s) => `${encodeURIComponent(s.sku)}:${s.quantidade}`).join(',');
    return ok(`https://exemplo.invalido/cart/${partes}?utm_source=whatsapp_simulado`);
  }
}
