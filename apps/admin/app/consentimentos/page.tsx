import { buscar, temErro } from '@/lib/api';
import { Aviso } from '@/components/Aviso';
import { Etiqueta, Tabela } from '@/components/Tabela';

interface Dados {
  consentimentos: Array<{
    id: string;
    clienteId: string;
    finalidade: string;
    concedido: boolean;
    origem: string;
    prova: string;
    registradoEm: string;
    revogadoEm: string | null;
  }>;
  pedidosLgpd: Array<{
    id: string;
    clienteId: string;
    tipo: string;
    status: string;
    criadoEm: string;
  }>;
  clientes: Array<{ id: string; nome: string; email: string; telefone: string }>;
}

export default async function Pagina() {
  const dados = await buscar<Dados>('/consentimentos');
  if (temErro(dados))
    return (
      <>
        <h2>Consentimentos (LGPD)</h2>
        <Aviso tipo="erro">{dados.erroApi}</Aviso>
      </>
    );

  return (
    <>
      <h2>Consentimentos (LGPD)</h2>
      <p className="descricao">
        Registro de finalidade, origem e prova do consentimento, além dos pedidos de exclusão e
        interrupção.
      </p>
      <Aviso>
        Nesta fase <strong>nenhum envio ativo acontece</strong>, mesmo com consentimento válido. A
        estrutura existe para quando as campanhas forem autorizadas.
      </Aviso>

      <div className="bloco">
        <h3>Consentimentos</h3>
        <Tabela
          colunas={['Cliente', 'Finalidade', 'Situação', 'Origem', 'Prova', 'Registrado em']}
          linhas={dados.consentimentos.map((c) => [
            c.clienteId,
            c.finalidade,
            c.revogadoEm ? (
              <Etiqueta key={c.id} texto="Revogado" tipo="alerta" />
            ) : c.concedido ? (
              <Etiqueta key={c.id} texto="Concedido" />
            ) : (
              <Etiqueta key={c.id} texto="Recusado" tipo="neutra" />
            ),
            c.origem,
            c.prova,
            new Date(c.registradoEm).toLocaleString('pt-BR'),
          ])}
        />
      </div>

      <div className="bloco">
        <h3>Pedidos de exclusão / interrupção</h3>
        <Tabela
          colunas={['Cliente', 'Tipo', 'Status', 'Criado em']}
          linhas={dados.pedidosLgpd.map((p) => [
            p.clienteId,
            p.tipo,
            p.status,
            new Date(p.criadoEm).toLocaleString('pt-BR'),
          ])}
        />
      </div>

      <div className="bloco">
        <h3>Clientes fictícios (dados mascarados)</h3>
        <Tabela
          colunas={['ID', 'Nome', 'E-mail', 'Telefone']}
          linhas={dados.clientes.map((c) => [c.id, c.nome, c.email, c.telefone])}
        />
      </div>
    </>
  );
}
