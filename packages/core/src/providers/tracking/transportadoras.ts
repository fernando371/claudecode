import { falha, type Rastreamento, type Resultado } from '@fdc/shared';
import { config } from '../../config.js';
import type { TrackingProvider } from './tipos.js';

/**
 * ADAPTADORES DE TRANSPORTADORAS - CONTRATO APENAS.
 *
 * Nenhuma API foi inventada. Cada transportadora tem seu proprio formato e
 * autenticacao; as informacoes necessarias estao em docs/07-checklist-logistica.md.
 *
 * Todos permanecem DESABILITADOS ate recebermos credenciais e documentacao.
 */

abstract class AdaptadorTransportadoraBase implements TrackingProvider {
  abstract readonly nome: string;
  abstract readonly transportadora: string;
  protected abstract urlBase(): string | null;

  get modo(): 'real_desabilitado' | 'real_habilitado' {
    // Enquanto o contrato tecnico nao for validado, permanece desabilitado
    // mesmo que a URL esteja preenchida.
    return 'real_desabilitado';
  }

  async rastrear(_codigo: string): Promise<Resultado<Rastreamento>> {
    return falha({
      codigo: 'desabilitado',
      mensagem: `Integracao com ${this.transportadora} ainda nao habilitada. Aguardando documentacao e credenciais.`,
      origem: `rastreio:${this.nome}`,
    });
  }
}

export class MandaeTrackingProvider extends AdaptadorTransportadoraBase {
  readonly nome = 'mandae';
  readonly transportadora = 'Mandaê';
  protected override urlBase(): string | null {
    return process.env.MANDAE_BASE_URL || null;
  }
}

export class CorreiosTrackingProvider extends AdaptadorTransportadoraBase {
  readonly nome = 'correios';
  readonly transportadora = 'Correios';
  protected override urlBase(): string | null {
    return process.env.CORREIOS_BASE_URL || null;
  }
}

export class FonteslogTrackingProvider extends AdaptadorTransportadoraBase {
  readonly nome = 'fonteslog';
  readonly transportadora = 'Fonteslog';
  protected override urlBase(): string | null {
    return process.env.FONTESLOG_BASE_URL || null;
  }
}

export class TmLogisticaTrackingProvider extends AdaptadorTransportadoraBase {
  readonly nome = 'tmlogistica';
  readonly transportadora = 'TM Logística';
  protected override urlBase(): string | null {
    return process.env.TMLOGISTICA_BASE_URL || null;
  }
}

export function transportadoraPorNome(nome: string): TrackingProvider | null {
  switch (nome) {
    case 'mandae':
      return new MandaeTrackingProvider();
    case 'correios':
      return new CorreiosTrackingProvider();
    case 'fonteslog':
      return new FonteslogTrackingProvider();
    case 'tmlogistica':
      return new TmLogisticaTrackingProvider();
    default:
      return null;
  }
}

export function transportadoraConfigurada(): string {
  return config().TRACKING_PROVIDER;
}
