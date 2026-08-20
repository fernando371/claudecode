import type { Rastreamento, Resultado } from '@fdc/shared';

export interface TrackingProvider {
  readonly nome: string;
  readonly transportadora: string;
  readonly modo: 'mock' | 'real_desabilitado' | 'real_habilitado';
  rastrear(codigo: string): Promise<Resultado<Rastreamento>>;
}
