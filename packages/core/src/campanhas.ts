import type { Finalidade } from '@fdc/shared';
import { config } from './config.js';
import { auditoria, enviosCampanha } from './db/repositorios.js';
import { podeEnviarAtivo } from './policies/privacidade.js';

/**
 * Motor de campanhas: ESTRUTURA CRIADA, ENVIO DESLIGADO nesta fase.
 *
 * Mesmo que alguem ligue OUTBOUND_CAMPAIGNS_ENABLED por engano, o envio real
 * ainda depende da trava do WhatsApp (WHATSAPP_LIVE_ENABLED + APP_ENV=producao).
 */

export interface AlvoCampanha {
  clienteId: string;
  finalidade: Finalidade;
}

export interface ResultadoAvaliacao {
  clienteId: string;
  permitido: boolean;
  motivo: string;
}

export function avaliarAlvos(campanhaId: string, alvos: AlvoCampanha[]): ResultadoAvaliacao[] {
  const c = config();
  const jaAvaliados = new Set<string>();
  const saida: ResultadoAvaliacao[] = [];

  for (const alvo of alvos) {
    // Evita duplicidade dentro da mesma campanha.
    if (jaAvaliados.has(alvo.clienteId)) {
      saida.push({ clienteId: alvo.clienteId, permitido: false, motivo: 'duplicado_na_campanha' });
      continue;
    }
    jaAvaliados.add(alvo.clienteId);

    const consentimento = podeEnviarAtivo(alvo.clienteId, alvo.finalidade);
    if (!consentimento.permitido) {
      enviosCampanha.registrar(campanhaId, alvo.clienteId, 'bloqueado', consentimento.motivo);
      saida.push({ clienteId: alvo.clienteId, permitido: false, motivo: consentimento.motivo });
      continue;
    }

    if (enviosCampanha.contarNaSemana(alvo.clienteId) >= c.CAMPAIGN_MAX_PER_CUSTOMER_PER_WEEK) {
      enviosCampanha.registrar(campanhaId, alvo.clienteId, 'bloqueado', 'limite_de_frequencia');
      saida.push({ clienteId: alvo.clienteId, permitido: false, motivo: 'limite_de_frequencia' });
      continue;
    }

    enviosCampanha.registrar(
      campanhaId,
      alvo.clienteId,
      'aprovado_sem_envio',
      'envio_desligado_nesta_fase',
    );
    saida.push({ clienteId: alvo.clienteId, permitido: true, motivo: 'aprovado_sem_envio' });
  }

  auditoria.registrar({
    ator: 'sistema',
    acao: 'campanha:avaliar_alvos',
    recurso: campanhaId,
    resultado: 'permitido',
    detalhe: `${saida.filter((s) => s.permitido).length} aprovados de ${alvos.length}`,
  });
  return saida;
}

/** Bloqueio explicito: nesta fase nenhuma campanha pode ser disparada. */
export function dispararCampanha(): { enviado: false; motivo: string } {
  return {
    enviado: false,
    motivo:
      'Disparo de campanha desabilitado nesta fase do projeto. Depende de autorização expressa, consentimento válido e modelos aprovados pela Meta.',
  };
}
