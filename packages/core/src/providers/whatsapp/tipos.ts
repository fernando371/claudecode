import type { MensagemEnviada, MensagemRecebida, Resultado } from '@fdc/shared';

export interface WhatsAppProvider {
  readonly nome: string;
  readonly modo: 'mock' | 'real_desabilitado' | 'real_habilitado';
  /** Envia mensagem. Deve recusar quando o envio real nao estiver liberado. */
  enviar(mensagem: MensagemEnviada): Promise<Resultado<{ idExterno: string; simulado: boolean }>>;
  /** Converte o corpo do webhook do canal em mensagens normalizadas. */
  normalizarWebhook(corpo: unknown): MensagemRecebida[];
}
