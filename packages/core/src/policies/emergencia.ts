import { config } from '../config.js';

/**
 * Modos de emergencia. Podem ser acionados a qualquer momento pelo .env
 * ou pelo painel (em memoria), sem precisar mexer no codigo.
 */

export interface EstadoEmergencia {
  iaDesativada: boolean;
  whatsappDesativado: boolean;
  somenteHumano: boolean;
}

let sobreposicao: Partial<EstadoEmergencia> = {};

export function estadoEmergencia(): EstadoEmergencia {
  const c = config();
  return {
    iaDesativada: sobreposicao.iaDesativada ?? !c.AI_ENABLED,
    whatsappDesativado: sobreposicao.whatsappDesativado ?? !c.WHATSAPP_ENABLED,
    somenteHumano: sobreposicao.somenteHumano ?? c.HUMAN_ONLY_MODE,
  };
}

export function definirEmergencia(parcial: Partial<EstadoEmergencia>): EstadoEmergencia {
  sobreposicao = { ...sobreposicao, ...parcial };
  return estadoEmergencia();
}

export function limparEmergencia(): EstadoEmergencia {
  sobreposicao = {};
  return estadoEmergencia();
}

/** true quando qualquer interruptor exige mandar tudo para humano. */
export function exigeAtendimentoHumano(): boolean {
  const e = estadoEmergencia();
  return e.iaDesativada || e.somenteHumano;
}
