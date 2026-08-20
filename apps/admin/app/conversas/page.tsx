import Link from 'next/link';
import { buscar, temErro } from '@/lib/api';
import { Aviso } from '@/components/Aviso';
import { Tabela } from '@/components/Tabela';

interface Conversa {
  id: string;
  clienteId: string;
  canal: string;
  iniciadaEm: string;
  assumidaPor: string | null;
  totalMensagens: number;
}

export default async function Pagina() {
  const conversas = await buscar<Conversa[]>('/conversas');
  if (temErro(conversas))
    return (
      <>
        <h2>Conversas simuladas</h2>
        <Aviso tipo="erro">{conversas.erroApi}</Aviso>
      </>
    );

  return (
    <>
      <h2>Conversas simuladas</h2>
      <p className="descricao">Todas as conversas processadas pelo agente neste ambiente.</p>
      <div className="bloco">
        <Tabela
          colunas={['Início', 'Canal', 'Cliente', 'Mensagens', 'Atendente', 'Abrir']}
          linhas={conversas.map((c) => [
            new Date(c.iniciadaEm).toLocaleString('pt-BR'),
            c.canal,
            c.clienteId,
            c.totalMensagens,
            c.assumidaPor ?? '—',
            <Link key={c.id} href={`/conversas/${c.id}`}>
              Atender
            </Link>,
          ])}
        />
      </div>
    </>
  );
}
