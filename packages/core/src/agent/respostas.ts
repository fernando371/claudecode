import {
  ROTULO_RASTREIO,
  type NotaFiscal,
  type Pedido,
  type Produto,
  type Rastreamento,
  type ResumoPedidoCliente,
} from '@fdc/shared';

export function formatarPreco(centavos: number): string {
  return (centavos / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export function formatarData(iso: string | null): string {
  if (!iso) return 'não informada';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return 'não informada';
  return d.toLocaleDateString('pt-BR');
}

export function linhaProduto(p: Produto): string {
  const disponiveis = p.variantes.filter((v) => v.disponivel);
  const precos = disponiveis.map((v) => v.precoCentavos);
  const menor = precos.length ? Math.min(...precos) : null;
  const situacao = disponiveis.length === 0 ? ' — sem estoque no momento' : '';
  return `• ${p.titulo} (${p.marca})${menor !== null ? ` — a partir de ${formatarPreco(menor)}` : ''}${situacao}`;
}

export function blocoDisponibilidade(p: Produto): string {
  const linhas = p.variantes.map(
    (v) =>
      `• ${v.titulo}: ${v.disponivel ? `disponível — ${formatarPreco(v.precoCentavos)}` : 'sem estoque no momento'}`,
  );
  return `${p.titulo} (${p.marca})\n${linhas.join('\n')}`;
}

export function resumoPedidoParaCliente(
  pedido: Pedido,
  nota: NotaFiscal | null,
  rastreio: Rastreamento | null,
  possivelAtraso: boolean,
): ResumoPedidoCliente {
  return {
    numero: pedido.numero,
    criadoEm: pedido.criadoEm,
    statusPagamento: pedido.statusPagamento,
    statusProcessamento: pedido.statusProcessamento,
    itens: pedido.itens.map((i) => ({ titulo: i.titulo, quantidade: i.quantidade })),
    faturamento: {
      emitida: nota?.emitida ?? false,
      numeroNota: nota?.numero ?? null,
      emitidaEm: nota?.emitidaEm ?? null,
    },
    rastreio: {
      codigo: rastreio?.codigo ?? pedido.codigoRastreio,
      transportadora: rastreio?.transportadora ?? pedido.transportadora,
      status: rastreio?.status ?? null,
    },
    prazoPrometidoEm: pedido.prazoPrometidoEm,
    possivelAtraso,
  };
}

const ROTULO_PAGAMENTO: Record<Pedido['statusPagamento'], string> = {
  pendente: 'pagamento pendente',
  pago: 'pagamento aprovado',
  estornado: 'estornado',
  cancelado: 'cancelado',
};

const ROTULO_PROCESSAMENTO: Record<Pedido['statusProcessamento'], string> = {
  aguardando_faturamento: 'aguardando faturamento',
  faturado: 'faturado',
  em_separacao: 'em separação',
  despachado: 'despachado',
  entregue: 'entregue',
  cancelado: 'cancelado',
};

export function textoStatusPedido(r: ResumoPedidoCliente): string {
  const partes: string[] = [];
  partes.push(`Pedido ${r.numero} (feito em ${formatarData(r.criadoEm)})`);
  partes.push(
    `Situação: ${ROTULO_PAGAMENTO[r.statusPagamento]} · ${ROTULO_PROCESSAMENTO[r.statusProcessamento]}`,
  );
  partes.push(`Itens: ${r.itens.map((i) => `${i.quantidade}x ${i.titulo}`).join(', ')}`);

  if (r.faturamento.emitida) {
    partes.push(
      `Nota Fiscal: emitida (nº ${r.faturamento.numeroNota}) em ${formatarData(r.faturamento.emitidaEm)}`,
    );
  } else {
    partes.push('Nota Fiscal: ainda não emitida');
  }

  if (r.rastreio.codigo) {
    const situacao = r.rastreio.status ? ROTULO_RASTREIO[r.rastreio.status] : 'sem atualização';
    partes.push(
      `Rastreio: ${r.rastreio.codigo} (${r.rastreio.transportadora ?? 'transportadora'}) — ${situacao}`,
    );
  } else {
    partes.push('Rastreio: ainda não disponível');
  }

  if (r.prazoPrometidoEm) {
    partes.push(`Prazo previsto: ${formatarData(r.prazoPrometidoEm)}`);
  }
  return partes.join('\n');
}

export const SAUDACAO =
  'Oi! Aqui é o atendimento da FDC. Posso te ajudar com produtos, preços, disponibilidade, status do pedido, Nota Fiscal, prazo e rastreio. O que você precisa?';

export const NAO_ENTENDI =
  'Não tenho certeza do que você precisa. Posso ajudar com: produtos e preços, status do pedido, Nota Fiscal, prazo de entrega e rastreio. Pode me dizer com outras palavras?';

export const SEM_FONTE_OFICIAL =
  'Não tenho essa informação confirmada em uma fonte oficial, e prefiro não arriscar um palpite. Vou encaminhar para um atendente da FDC confirmar para você.';

export const INTEGRACAO_FORA =
  'Não consegui consultar essa informação agora — o sistema que responde por ela está indisponível. Para não te passar dado errado, vou encaminhar para um atendente da FDC.';

export const PRODUTO_NAO_ENCONTRADO =
  'Não encontrei esse produto no nosso catálogo. Quer que eu procure por outro nome, ou prefere falar com um atendente?';

export const DESCADASTRO_CONFIRMADO =
  'Pronto. Registrei seu pedido e você não vai mais receber mensagens de campanha nossas. Se precisar falar sobre um pedido, é só me chamar aqui.';
