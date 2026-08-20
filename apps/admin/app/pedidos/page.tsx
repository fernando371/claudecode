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

interface Carrinho {
  id: string;
  clienteId: string;
  criadoEm: string;
  itens: Array<{ sku: string; quantidade: number }>;
}

export default async function Pagina() {
  const [pedidos, carrinhos] = await Promise.all([
    buscar<Pedido[]>('/pedidos'),
    buscar<Carrinho[]>('/carrinhos'),
  ]);
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

      <div className="bloco">
        <h3>Carrinhos abandonados fictícios</h3>
        <p style={{ color: 'var(--suave)', marginTop: 0 }}>
          O agente só mostra o carrinho quando o próprio cliente pergunta por ele. Nesta fase não
          existe nenhum envio ativo de recuperação.
        </p>
        {temErro(carrinhos) ? (
          <Aviso tipo="erro">{carrinhos.erroApi}</Aviso>
        ) : (
          <Tabela
            colunas={['Carrinho', 'Cliente', 'Criado em', 'Itens']}
            linhas={carrinhos.map((c) => [
              c.id,
              c.clienteId,
              data(c.criadoEm),
              c.itens.map((i) => `${i.quantidade}x ${i.sku}`).join(', '),
            ])}
          />
        )}
      </div>
    </>
  );
}
