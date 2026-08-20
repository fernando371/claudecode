import { falha, ok, type Resultado } from '@fdc/shared';
import { config } from '../config.js';
import { log } from '../logger.js';

/**
 * Timeout + disjuntor (circuit breaker) para TODAS as integracoes externas.
 * Se a integracao falhar repetidamente, o circuito abre e o agente passa a
 * informar indisponibilidade em vez de inventar dados.
 */

interface EstadoCircuito {
  falhas: number;
  abertoAte: number;
}

const circuitos = new Map<string, EstadoCircuito>();

export function estadoCircuito(nome: string): EstadoCircuito {
  let estado = circuitos.get(nome);
  if (!estado) {
    estado = { falhas: 0, abertoAte: 0 };
    circuitos.set(nome, estado);
  }
  return estado;
}

export function circuitoAberto(nome: string): boolean {
  return estadoCircuito(nome).abertoAte > Date.now();
}

export function reiniciarCircuitos(): void {
  circuitos.clear();
}

export async function executarComProtecao<T>(
  nome: string,
  operacao: (sinal: AbortSignal) => Promise<T>,
): Promise<Resultado<T>> {
  const c = config();
  const estado = estadoCircuito(nome);

  if (estado.abertoAte > Date.now()) {
    return falha({
      codigo: 'circuito_aberto',
      mensagem: `Integracao ${nome} temporariamente indisponivel (protecao ativa).`,
      origem: nome,
    });
  }

  const controlador = new AbortController();
  const relogio = setTimeout(() => controlador.abort(), c.INTEGRATION_TIMEOUT_MS);
  try {
    const dados = await operacao(controlador.signal);
    estado.falhas = 0;
    return ok(dados);
  } catch {
    estado.falhas += 1;
    if (estado.falhas >= c.CIRCUIT_BREAKER_FAILURES) {
      estado.abertoAte = Date.now() + c.CIRCUIT_BREAKER_COOLDOWN_MS;
      log.warn('circuito aberto', { integracao: nome, falhas: estado.falhas });
    }
    const abortado = controlador.signal.aborted;
    log.error('falha em integracao', { integracao: nome, abortado });
    return falha({
      codigo: abortado ? 'timeout' : 'indisponivel',
      mensagem: abortado
        ? `A integracao ${nome} demorou demais para responder.`
        : `A integracao ${nome} nao respondeu corretamente.`,
      origem: nome,
    });
  } finally {
    clearTimeout(relogio);
  }
}
