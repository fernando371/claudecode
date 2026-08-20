import { ok, type MensagemEnviada, type MensagemRecebida, type Resultado } from '@fdc/shared';
import { log } from '../../logger.js';
import type { WhatsAppProvider } from './tipos.js';

/** Guarda as mensagens "enviadas" apenas em memoria, para inspecao nos testes/painel. */
const caixaDeSaida: Array<MensagemEnviada & { enviadoEm: string }> = [];

export function caixaDeSaidaSimulada(): Array<MensagemEnviada & { enviadoEm: string }> {
  return [...caixaDeSaida];
}

export function limparCaixaDeSaidaSimulada(): void {
  caixaDeSaida.length = 0;
}

/**
 * Provedor simulado. NUNCA acessa a internet e NUNCA envia mensagem real.
 * E o padrao do sistema.
 */
export class MockWhatsAppProvider implements WhatsAppProvider {
  readonly nome = 'MockWhatsAppProvider';
  readonly modo = 'mock' as const;

  async enviar(
    mensagem: MensagemEnviada,
  ): Promise<Resultado<{ idExterno: string; simulado: boolean }>> {
    caixaDeSaida.push({ ...mensagem, enviadoEm: new Date().toISOString() });
    log.info('mensagem simulada registrada', { destinatario: mensagem.destinatario });
    return ok({ idExterno: `sim_${caixaDeSaida.length}`, simulado: true });
  }

  normalizarWebhook(corpo: unknown): MensagemRecebida[] {
    const c = corpo as { mensagens?: MensagemRecebida[] } | undefined;
    return c?.mensagens ?? [];
  }
}
