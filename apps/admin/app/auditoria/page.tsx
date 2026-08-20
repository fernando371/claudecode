import { buscar, temErro } from '@/lib/api';
import { Aviso } from '@/components/Aviso';
import { Etiqueta, Tabela } from '@/components/Tabela';

interface Evento {
  id: string;
  ocorridoEm: string;
  ator: string;
  acao: string;
  recurso: string;
  resultado: string;
  detalhe: string;
}

export default async function Pagina() {
  const eventos = await buscar<Evento[]>('/auditoria');
  if (temErro(eventos))
    return (
      <>
        <h2>Eventos de auditoria</h2>
        <Aviso tipo="erro">{eventos.erroApi}</Aviso>
      </>
    );

  return (
    <>
      <h2>Eventos de auditoria</h2>
      <p className="descricao">
        Registro de tudo que importa: consultas a pedido, escalonamentos, bloqueios de segurança e
        ações administrativas.
      </p>
      <Aviso>
        Os detalhes são gravados já mascarados — nenhum dado pessoal aparece por inteiro.
      </Aviso>
      <div className="bloco">
        <Tabela
          colunas={['Quando', 'Ator', 'Ação', 'Recurso', 'Resultado', 'Detalhe']}
          linhas={eventos.map((e) => [
            new Date(e.ocorridoEm).toLocaleString('pt-BR'),
            e.ator,
            e.acao,
            e.recurso,
            <Etiqueta
              key={e.id}
              texto={e.resultado}
              tipo={
                e.resultado === 'permitido' ? 'ok' : e.resultado === 'negado' ? 'alerta' : 'atencao'
              }
            />,
            e.detalhe,
          ])}
        />
      </div>
    </>
  );
}
