/**
 * Resultado padrao das integracoes.
 * Nunca "inventamos" dados quando uma integracao falha: devolvemos indisponibilidade.
 */
export type Resultado<T> = { ok: true; dados: T } | { ok: false; erro: FalhaIntegracao };

export interface FalhaIntegracao {
  codigo:
    | 'indisponivel'
    | 'timeout'
    | 'nao_encontrado'
    | 'nao_autorizado'
    | 'circuito_aberto'
    | 'desabilitado'
    | 'entrada_invalida'
    | 'erro_interno';
  mensagem: string;
  origem: string;
}

export const ok = <T>(dados: T): Resultado<T> => ({ ok: true, dados });
export const falha = <T>(erro: FalhaIntegracao): Resultado<T> => ({ ok: false, erro });
