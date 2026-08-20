import { buscar, temErro } from '@/lib/api';
import { Aviso, AvisoDados } from '@/components/Aviso';
import { Etiqueta, Tabela } from '@/components/Tabela';

interface VisaoGeral {
  indicadores: {
    totalConversas: number;
    totalMensagens: number;
    percentualResolvidoAutomaticamente: number;
    percentualTransferidoHumano: number;
    filaAberta: number;
    respostasBloqueadasPorSeguranca: number;
    errosDeIntegracao: number;
    conhecimento: { total: number; aprovados: number; utilizaveis: number; bloqueados: number };
  };
  integracoes: Array<{ nome: string; modo: string; detalhe: string }>;
  emergencia: { iaDesativada: boolean; whatsappDesativado: boolean; somenteHumano: boolean };
  retencao: { conversasDias: number; auditoriaDias: number; ambiente: string };
}

export default async function Pagina() {
  const dados = await buscar<VisaoGeral>('/visao-geral');
  if (temErro(dados)) {
    return (
      <>
        <h2>Visão geral</h2>
        <Aviso tipo="erro">{dados.erroApi}</Aviso>
      </>
    );
  }

  const i = dados.indicadores;
  const cartoes: Array<[string, string | number]> = [
    ['Conversas', i.totalConversas],
    ['Mensagens', i.totalMensagens],
    ['Resolvido pela IA', `${i.percentualResolvidoAutomaticamente}%`],
    ['Transferido p/ humano', `${i.percentualTransferidoHumano}%`],
    ['Fila aberta', i.filaAberta],
    ['Bloqueios de segurança', i.respostasBloqueadasPorSeguranca],
    ['Erros de integração', i.errosDeIntegracao],
    ['Documentos utilizáveis', `${i.conhecimento.utilizaveis}/${i.conhecimento.total}`],
  ];

  return (
    <>
      <h2>Visão geral</h2>
      <p className="descricao">Situação atual do protótipo, em um relance.</p>
      <AvisoDados />

      <div className="cartoes">
        {cartoes.map(([rotulo, valor]) => (
          <div className="cartao" key={rotulo}>
            <div className="rotulo">{rotulo}</div>
            <div className="valor">{valor}</div>
          </div>
        ))}
      </div>

      <div className="bloco" style={{ marginTop: 20 }}>
        <h3>Travas de segurança</h3>
        <Tabela
          colunas={['Trava', 'Situação']}
          linhas={[
            [
              'Inteligência artificial',
              dados.emergencia.iaDesativada ? (
                <Etiqueta texto="DESLIGADA" tipo="alerta" />
              ) : (
                <Etiqueta texto="Ligada" />
              ),
            ],
            [
              'Canal WhatsApp',
              dados.emergencia.whatsappDesativado ? (
                <Etiqueta texto="DESLIGADO" tipo="alerta" />
              ) : (
                <Etiqueta texto="Ligado" />
              ),
            ],
            [
              'Modo somente humano',
              dados.emergencia.somenteHumano ? (
                <Etiqueta texto="ATIVO" tipo="atencao" />
              ) : (
                <Etiqueta texto="Inativo" tipo="neutra" />
              ),
            ],
            ['Ambiente', <Etiqueta key="a" texto={dados.retencao.ambiente} tipo="neutra" />],
          ]}
        />
      </div>

      <div className="bloco">
        <h3>Integrações</h3>
        <Tabela
          colunas={['Integração', 'Modo', 'Detalhe']}
          linhas={dados.integracoes.map((it) => [
            it.nome,
            it.modo === 'mock' ? (
              <Etiqueta texto="Simulado" tipo="neutra" />
            ) : it.modo === 'real_habilitado' ? (
              <Etiqueta texto="Real ligado" tipo="atencao" />
            ) : (
              <Etiqueta texto="Real desligado" tipo="neutra" />
            ),
            it.detalhe,
          ])}
        />
      </div>
    </>
  );
}
