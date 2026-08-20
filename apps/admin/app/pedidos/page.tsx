import { buscar, temErro } from '@/lib/api';
import { Aviso, AvisoDados } from '@/components/Aviso';
import { Tabela } from '@/components/Tabela';

interface Pedido {
  numero: string;
  emailCliente: string;
  telefoneCliente: string;
  criadoEm: string;
  statusPagamento: string;
  statusProcessamento: string;
  totalCentavos: number;
  codigoRastreio: string | null;
  transportadora: string | null;
}

const real = (c: number) =>
  (c / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const data = (iso: string) => new Date(iso).toLocaleDateString('pt-BR');

export default async function Pagina() {
  const pedidos = await buscar<Pedido[]>('/pedidos');
  if (temErro(pedidos))
    return (
      <>
        <h2>Pedidos fictícios</h2>
        <Aviso tipo="erro">{pedidos.erroApi}</Aviso>
      </>
    );

  return (
    <>
      <h2>Pedidos fictícios</h2>
      <p className="descricao">
        Dados de demonstração usados para testar consulta de pedido, Nota Fiscal, rastreio e atraso.
        E-mail e telefone aparecem mascarados, como manda a política de privacidade.
      </p>
      <AvisoDados />
      <div className="bloco">
        <Tabela
          colunas={[
            'Pedido',
            'Data',
            'Pagamento',
            'Processamento',
            'Total',
            'Rastreio',
            'E-mail',
            'Telefone',
          ]}
          linhas={pedidos.map((p) => [
            p.numero,
            data(p.criadoEm),
            p.statusPagamento,
            p.statusProcessamento,
            real(p.totalCentavos),
            p.codigoRastreio ? `${p.codigoRastreio} (${p.transportadora})` : '—',
            p.emailCliente,
            p.telefoneCliente,
          ])}
        />
      </div>
    </>
  );
}
