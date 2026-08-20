import { buscar, temErro } from '@/lib/api';
import { Aviso } from '@/components/Aviso';
import { Etiqueta, Tabela } from '@/components/Tabela';

interface Doc {
  id: string;
  titulo: string;
  fonte: string;
  atualizadoEm: string;
  aprovadoPor: string;
  status: string;
  proximaRevisaoEm: string;
  utilizavel: boolean;
  motivoIndisponivel: string | null;
}

export default async function Pagina() {
  const docs = await buscar<Doc[]>('/conhecimento');
  if (temErro(docs))
    return (
      <>
        <h2>Base de conhecimento</h2>
        <Aviso tipo="erro">{docs.erroApi}</Aviso>
      </>
    );

  return (
    <>
      <h2>Base de conhecimento</h2>
      <p className="descricao">
        O agente só responde com informação de documento aprovado e dentro da validade. Rascunho é
        aceito apenas fora de produção.
      </p>
      <Aviso>
        Os textos são <strong>modelos de exemplo</strong>. Antes de qualquer uso real, o conteúdo
        oficial da FDC precisa ser preenchido e aprovado.
      </Aviso>
      <div className="bloco">
        <Tabela
          colunas={[
            'Documento',
            'Status',
            'Pode ser usado?',
            'Aprovado por',
            'Próxima revisão',
            'Fonte',
          ]}
          linhas={docs.map((d) => [
            d.titulo,
            <Etiqueta
              key={`s${d.id}`}
              texto={d.status}
              tipo={d.status === 'aprovado' ? 'ok' : d.status === 'expirado' ? 'alerta' : 'atencao'}
            />,
            d.utilizavel ? (
              <Etiqueta key={`u${d.id}`} texto="Sim" />
            ) : (
              <Etiqueta key={`u${d.id}`} texto={d.motivoIndisponivel ?? 'Não'} tipo="alerta" />
            ),
            d.aprovadoPor,
            d.proximaRevisaoEm,
            d.fonte,
          ])}
        />
      </div>
    </>
  );
}
