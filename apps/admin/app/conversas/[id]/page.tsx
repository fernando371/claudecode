import Link from 'next/link';
import { Atendimento } from './Atendimento';

export default async function Pagina({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <>
      <h2>Atendimento humano</h2>
      <p className="descricao">
        <Link href="/fila">← Voltar para a fila</Link> · conversa <span className="mono">{id}</span>
      </p>
      <Atendimento conversaId={id} />
    </>
  );
}
