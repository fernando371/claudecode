import { buscar, temErro } from '@/lib/api';
import { Aviso } from '@/components/Aviso';
import { Etiqueta, Tabela } from '@/components/Tabela';

interface Integracao {
  nome: string;
  adaptador: string;
  modo: string;
  saudavel: boolean;
  detalhe: string;
}

export default async function Pagina() {
  const itens = await buscar<Integracao[]>('/integracoes');
  if (temErro(itens))
    return (
      <>
        <h2>Status das integrações</h2>
        <Aviso tipo="erro">{itens.erroApi}</Aviso>
      </>
    );

  return (
    <>
      <h2>Status das integrações</h2>
      <p className="descricao">
        O que está simulado, o que está preparado e o que está realmente ligado. Nenhum segredo
        aparece aqui.
      </p>
      <Aviso>
        <strong>Nada real está conectado.</strong> WhatsApp, Shopify, SAP e transportadoras
        funcionam em modo simulado até você autorizar e cadastrar as credenciais.
      </Aviso>
      <div className="bloco">
        <Tabela
          colunas={['Integração', 'Adaptador', 'Modo', 'Detalhe']}
          linhas={itens.map((i) => [
            i.nome,
            <span className="mono" key={i.nome}>
              {i.adaptador}
            </span>,
            i.modo === 'mock' ? (
              <Etiqueta key={`m${i.nome}`} texto="Simulado" tipo="neutra" />
            ) : i.modo === 'real_habilitado' ? (
              <Etiqueta key={`m${i.nome}`} texto="Real ligado" tipo="atencao" />
            ) : (
              <Etiqueta key={`m${i.nome}`} texto="Real desligado" tipo="neutra" />
            ),
            i.detalhe,
          ])}
        />
      </div>
    </>
  );
}
