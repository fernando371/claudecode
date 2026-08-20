import { buscar, temErro } from '@/lib/api';
import { Aviso, AvisoDados } from '@/components/Aviso';
import { Etiqueta, Tabela } from '@/components/Tabela';

interface Produto {
  id: string;
  titulo: string;
  marca: string;
  categoria: string;
  variantes: Array<{
    sku: string;
    titulo: string;
    precoCentavos: number;
    disponivel: boolean;
    estoque: number | null;
  }>;
}

const real = (c: number) =>
  (c / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export default async function Pagina() {
  const produtos = await buscar<Produto[]>('/produtos');
  if (temErro(produtos))
    return (
      <>
        <h2>Produtos fictícios</h2>
        <Aviso tipo="erro">{produtos.erroApi}</Aviso>
      </>
    );

  const linhas = produtos.flatMap((p) =>
    p.variantes.map((v) => [
      p.titulo,
      p.marca,
      v.titulo,
      v.sku,
      real(v.precoCentavos),
      v.disponivel ? (
        <Etiqueta key={v.sku} texto={`${v.estoque ?? '?'} un.`} />
      ) : (
        <Etiqueta key={v.sku} texto="Sem estoque" tipo="alerta" />
      ),
    ]),
  );

  return (
    <>
      <h2>Produtos fictícios</h2>
      <p className="descricao">
        Catálogo simulado usado pelo agente enquanto o Shopify não está conectado.
      </p>
      <AvisoDados />
      <div className="bloco">
        <Tabela
          colunas={['Produto', 'Marca', 'Variante', 'SKU', 'Preço', 'Disponibilidade']}
          linhas={linhas}
        />
      </div>
    </>
  );
}
