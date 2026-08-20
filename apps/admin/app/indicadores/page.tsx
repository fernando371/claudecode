import { buscar, temErro } from '@/lib/api';
import { Aviso } from '@/components/Aviso';
import { Tabela } from '@/components/Tabela';

interface Indicadores {
  totalConversas: number;
  totalMensagens: number;
  tempoPrimeiraRespostaMsMediana: number | null;
  tempoPrimeiraRespostaHumanaMinutosMediana: number | null;
  mensagensDeAtendentes: number;
  percentualResolvidoAutomaticamente: number;
  percentualTransferidoHumano: number;
  motivosDeContato: Array<{ intencao: string; total: number }>;
  produtosMaisConsultados: Array<{ produto: string; total: number }>;
  consultasSobreAtraso: number;
  cliquesEmProdutosOuCarrinhos: number;
  crossSellOferecido: number;
  receitaPotencialIdentificadaCentavos: number;
  conversoesAssistidasSimuladas: number;
  carrinhosRecuperadosSimulados: number;
  receitaAssistidaSimuladaCentavos: number;
  errosDeIntegracao: number;
  respostasBloqueadasPorSeguranca: number;
}

const real = (c: number) =>
  (c / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export default async function Pagina() {
  const i = await buscar<Indicadores>('/indicadores');
  if (temErro(i))
    return (
      <>
        <h2>Indicadores</h2>
        <Aviso tipo="erro">{i.erroApi}</Aviso>
      </>
    );

  const cartoes: Array<[string, string | number]> = [
    ['Total de conversas', i.totalConversas],
    ['Total de mensagens', i.totalMensagens],
    [
      'Tempo de 1ª resposta (mediana)',
      i.tempoPrimeiraRespostaMsMediana === null ? '—' : `${i.tempoPrimeiraRespostaMsMediana} ms`,
    ],
    ['Resolvido automaticamente', `${i.percentualResolvidoAutomaticamente}%`],
    ['Transferido para humano', `${i.percentualTransferidoHumano}%`],
    [
      'Espera até a resposta humana (mediana)',
      i.tempoPrimeiraRespostaHumanaMinutosMediana === null
        ? '—'
        : `${i.tempoPrimeiraRespostaHumanaMinutosMediana} min`,
    ],
    ['Respostas escritas por atendentes', i.mensagensDeAtendentes],
    ['Consultas sobre atraso', i.consultasSobreAtraso],
    ['Links de produto/carrinho', i.cliquesEmProdutosOuCarrinhos],
    ['Combinações oferecidas', i.crossSellOferecido],
    ['Receita potencial identificada', real(i.receitaPotencialIdentificadaCentavos)],
    ['Conversões assistidas (simul.)', i.conversoesAssistidasSimuladas],
    ['Carrinhos recuperados (simul.)', i.carrinhosRecuperadosSimulados],
    ['Receita assistida (simul.)', real(i.receitaAssistidaSimuladaCentavos)],
    ['Erros de integração', i.errosDeIntegracao],
    ['Respostas bloqueadas', i.respostasBloqueadasPorSeguranca],
  ];

  return (
    <>
      <h2>Indicadores</h2>
      <p className="descricao">Medição do atendimento, das vendas e da operação.</p>
      <Aviso>
        Os números vêm de <strong>conversas simuladas</strong>. Servem para provar que a medição
        funciona, não para projetar resultado de negócio.
      </Aviso>
      <div className="cartoes">
        {cartoes.map(([rotulo, valor]) => (
          <div className="cartao" key={rotulo}>
            <div className="rotulo">{rotulo}</div>
            <div className="valor">{valor}</div>
          </div>
        ))}
      </div>
      <div className="bloco" style={{ marginTop: 20 }}>
        <h3>Motivos de contato</h3>
        <Tabela
          colunas={['Intenção', 'Total']}
          linhas={i.motivosDeContato.map((m) => [m.intencao, m.total])}
        />
      </div>
      <div className="bloco">
        <h3>Produtos mais consultados</h3>
        <Tabela
          colunas={['Produto', 'Consultas']}
          linhas={i.produtosMaisConsultados.map((p) => [p.produto, p.total])}
        />
      </div>
    </>
  );
}
