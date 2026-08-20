import { AvisoDados } from '@/components/Aviso';
import { Simulador } from './Simulador';

export default function Pagina() {
  return (
    <>
      <h2>Simulador de Conversas</h2>
      <p className="descricao">
        Teste a jornada completa do cliente sem enviar nenhuma mensagem real e sem acessar nenhum
        sistema de produção.
      </p>
      <AvisoDados />
      <Simulador />
    </>
  );
}
