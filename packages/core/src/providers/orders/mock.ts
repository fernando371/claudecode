import { readFileSync } from 'node:fs';
import { falha, ok, type ItemPedido, type Pedido, type Resultado } from '@fdc/shared';
import { doProjeto } from '../../caminhos.js';
import { simulacao } from '../simulacaoFalhas.js';
import type { CredenciaisConsultaPedido, OrderProvider } from './tipos.js';

interface PedidoBruto {
  id: string;
  numero: string;
  clienteId: string;
  criadoEmDias: number;
  statusPagamento: Pedido['statusPagamento'];
  statusProcessamento: Pedido['statusProcessamento'];
  itens: ItemPedido[];
  prazoPrometidoEmDias: number | null;
  codigoRastreio: string | null;
  transportadora: string | null;
  cenario: string;
  notaFiscal: {
    emitida: boolean;
    numero: string | null;
    serie: string | null;
    emitidaEmDias: number | null;
  };
  ficticio: boolean;
}

interface ClienteBruto {
  id: string;
  nome: string;
  email: string;
  telefone: string;
}

export function diasParaIso(dias: number): string {
  return new Date(Date.now() + dias * 24 * 3600 * 1000).toISOString();
}

function lerJson<T>(arquivo: string): T {
  return JSON.parse(readFileSync(doProjeto(arquivo), 'utf8')) as T;
}

export function carregarPedidosBrutos(): PedidoBruto[] {
  return lerJson<PedidoBruto[]>('data/fixtures/pedidos.json');
}

export function carregarClientesBrutos(): ClienteBruto[] {
  return lerJson<ClienteBruto[]>('data/fixtures/clientes.json');
}

export function cenarioDoPedido(numero: string): string | null {
  return carregarPedidosBrutos().find((p) => p.numero === numero)?.cenario ?? null;
}

export function notaFiscalBruta(numero: string) {
  return carregarPedidosBrutos().find((p) => p.numero === numero)?.notaFiscal ?? null;
}

function montar(bruto: PedidoBruto): Pedido {
  const cliente = carregarClientesBrutos().find((c) => c.id === bruto.clienteId);
  return {
    id: bruto.id,
    numero: bruto.numero,
    emailCliente: cliente?.email ?? '',
    telefoneCliente: cliente?.telefone ?? '',
    criadoEm: diasParaIso(bruto.criadoEmDias),
    statusPagamento: bruto.statusPagamento,
    statusProcessamento: bruto.statusProcessamento,
    itens: bruto.itens,
    totalCentavos: bruto.itens.reduce((s, i) => s + i.precoUnitarioCentavos * i.quantidade, 0),
    prazoPrometidoEm:
      bruto.prazoPrometidoEmDias === null ? null : diasParaIso(bruto.prazoPrometidoEmDias),
    codigoRastreio: bruto.codigoRastreio,
    transportadora: bruto.transportadora,
    ficticio: true,
  };
}

const soDigitos = (v: string) => v.replace(/\D/g, '');

const indisponivel = <T>(): Resultado<T> =>
  falha({
    codigo: 'indisponivel',
    mensagem: 'Sistema de pedidos simulado marcado como indisponivel pelo simulador.',
    origem: 'pedidos:mock',
  });

/** Pedidos ficticios. Exige verificacao de identidade igual ao provedor real. */
export class MockOrderProvider implements OrderProvider {
  readonly nome = 'MockOrderProvider';
  readonly modo = 'mock' as const;

  async buscarComVerificacao(cred: CredenciaisConsultaPedido): Promise<Resultado<Pedido>> {
    if (simulacao.ler().pedidosIndisponivel) return indisponivel();

    const numero = cred.numeroPedido.trim().toUpperCase().replace(/^#/, '');
    if (!numero)
      return falha({
        codigo: 'entrada_invalida',
        mensagem: 'Numero do pedido nao informado.',
        origem: 'pedidos:mock',
      });

    if (!cred.email && !cred.telefone) {
      return falha({
        codigo: 'nao_autorizado',
        mensagem: 'E necessario informar e-mail ou telefone do pedido para confirmar a identidade.',
        origem: 'pedidos:mock',
      });
    }

    const bruto = carregarPedidosBrutos().find((p) => p.numero.toUpperCase() === numero);
    if (!bruto) {
      // Resposta deliberadamente igual a "nao autorizado" para nao revelar
      // se o numero existe ou nao (evita enumeracao de pedidos).
      return falha({
        codigo: 'nao_autorizado',
        mensagem: 'Nao foi possivel confirmar esse pedido com os dados informados.',
        origem: 'pedidos:mock',
      });
    }

    const pedido = montar(bruto);
    const emailConfere =
      Boolean(cred.email) && pedido.emailCliente.toLowerCase() === cred.email!.trim().toLowerCase();
    const telefoneConfere =
      Boolean(cred.telefone) &&
      soDigitos(pedido.telefoneCliente).slice(-8) === soDigitos(cred.telefone!).slice(-8) &&
      soDigitos(cred.telefone!).length >= 8;

    if (!emailConfere && !telefoneConfere) {
      return falha({
        codigo: 'nao_autorizado',
        mensagem: 'Nao foi possivel confirmar esse pedido com os dados informados.',
        origem: 'pedidos:mock',
      });
    }
    return ok(pedido);
  }

  async listarInterno(): Promise<Resultado<Pedido[]>> {
    if (simulacao.ler().pedidosIndisponivel) return indisponivel();
    return ok(carregarPedidosBrutos().map(montar));
  }

  async ultimoPedidoDoCliente(clienteId: string): Promise<Resultado<Pedido>> {
    if (simulacao.ler().pedidosIndisponivel) return indisponivel();
    const brutos = carregarPedidosBrutos()
      .filter((p) => p.clienteId === clienteId)
      .sort((a, b) => b.criadoEmDias - a.criadoEmDias);
    const primeiro = brutos[0];
    if (!primeiro)
      return falha({
        codigo: 'nao_encontrado',
        mensagem: 'Cliente sem pedidos registrados.',
        origem: 'pedidos:mock',
      });
    return ok(montar(primeiro));
  }
}
