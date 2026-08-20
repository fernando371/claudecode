import { Aviso } from '@/components/Aviso';
import { Fila } from './Fila';

export default function Pagina() {
  return (
    <>
      <h2>Fila de atendimento humano</h2>
      <p className="descricao">
        Conversas que o agente transferiu. Ao assumir uma conversa, a IA para de responder nela até
        o atendimento ser encerrado.
      </p>
      <Aviso>
        O resumo enviado ao atendente já vai <strong>mascarado</strong>: sem CPF, dados financeiros
        ou texto clínico completo.
      </Aviso>
      <div className="bloco">
        <Fila />
      </div>
    </>
  );
}
