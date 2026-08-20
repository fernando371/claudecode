'use client';

import { useCallback, useState } from 'react';

interface Cliente {
  id: string;
  nome: string;
  email: string;
  telefone: string;
}

interface RelatorioExpurgo {
  conversasApagadas: number;
  mensagensApagadas: number;
  eventosAuditoriaApagados: number;
  relatosSensiveisRemovidos: number;
  prazos: { conversasDias: number; auditoriaDias: number; marcacoesSaudeDias: number };
}

async function chamar<T>(caminho: string, corpo?: unknown): Promise<T> {
  const r = await fetch(`/api/proxy${caminho}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    ...(corpo ? { body: JSON.stringify(corpo) } : {}),
  });
  return (await r.json()) as T;
}

export function Expurgo() {
  const [relatorio, setRelatorio] = useState<RelatorioExpurgo | null>(null);
  const [ocupado, setOcupado] = useState(false);

  const executar = useCallback(async () => {
    setOcupado(true);
    setRelatorio(await chamar<RelatorioExpurgo>('/lgpd/expurgo'));
    setOcupado(false);
  }, []);

  return (
    <div>
      <p style={{ color: 'var(--suave)', marginTop: 0 }}>
        O sistema já aplica a política sozinho: ao iniciar e a cada 24 horas. Use o botão se quiser
        rodar agora.
      </p>
      <button type="button" onClick={() => void executar()} disabled={ocupado}>
        {ocupado ? 'Executando...' : 'Aplicar a política de retenção agora'}
      </button>

      {relatorio && (
        <div className="aviso" style={{ marginTop: 14 }}>
          <strong>Expurgo concluído.</strong>
          <br />
          Conversas removidas: {relatorio.conversasApagadas} · mensagens:{' '}
          {relatorio.mensagensApagadas} · eventos de auditoria: {relatorio.eventosAuditoriaApagados}{' '}
          · relatos sensíveis apagados: {relatorio.relatosSensiveisRemovidos}
          <br />
          <span style={{ color: 'var(--suave)' }}>
            Prazos aplicados: conversas {relatorio.prazos.conversasDias} dias · auditoria{' '}
            {relatorio.prazos.auditoriaDias} dias · marcações de saúde{' '}
            {relatorio.prazos.marcacoesSaudeDias} dias.
          </span>
        </div>
      )}
    </div>
  );
}

export function PedidosDoTitular({ clientes }: { clientes: Cliente[] }) {
  const [clienteId, setClienteId] = useState(clientes[0]?.id ?? '');
  const [confirmando, setConfirmando] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const [mensagem, setMensagem] = useState<string | null>(null);

  const nome = clientes.find((c) => c.id === clienteId)?.nome ?? clienteId;

  const interromper = useCallback(async () => {
    setOcupado(true);
    await chamar('/lgpd/pedidos', { clienteId, tipo: 'interrupcao' });
    await chamar('/lgpd/interrupcao', { clienteId });
    setMensagem(`Comunicações interrompidas para ${nome}.`);
    setOcupado(false);
  }, [clienteId, nome]);

  const excluir = useCallback(async () => {
    setOcupado(true);
    await chamar('/lgpd/pedidos', { clienteId, tipo: 'exclusao' });
    const r = await chamar<{ conversasApagadas: number; mensagensApagadas: number }>(
      '/lgpd/exclusao',
      {
        clienteId,
      },
    );
    setMensagem(
      `Dados de ${nome} excluídos: ${r.conversasApagadas} conversas e ${r.mensagensApagadas} mensagens removidas, cadastro anonimizado.`,
    );
    setConfirmando(false);
    setOcupado(false);
  }, [clienteId, nome]);

  if (clientes.length === 0) {
    return <p style={{ color: 'var(--suave)' }}>Nenhum cliente cadastrado.</p>;
  }

  return (
    <div>
      <label className="rotulo-campo" htmlFor="titular">
        Cliente
      </label>
      <select
        id="titular"
        value={clienteId}
        onChange={(e) => {
          setClienteId(e.target.value);
          setConfirmando(false);
          setMensagem(null);
        }}
      >
        {clientes.map((c) => (
          <option key={c.id} value={c.id}>
            {c.nome} — {c.telefone}
          </option>
        ))}
      </select>

      <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
        <button type="button" onClick={() => void interromper()} disabled={ocupado}>
          Parar comunicações
        </button>

        {!confirmando ? (
          <button type="button" onClick={() => setConfirmando(true)} disabled={ocupado}>
            Excluir dados do cliente
          </button>
        ) : (
          <>
            <button
              type="button"
              className="perigo"
              onClick={() => void excluir()}
              disabled={ocupado}
            >
              Confirmar exclusão de {nome}
            </button>
            <button type="button" onClick={() => setConfirmando(false)} disabled={ocupado}>
              Cancelar
            </button>
          </>
        )}
      </div>

      {confirmando && (
        <div className="aviso erro" style={{ marginTop: 12 }}>
          <strong>Isso não tem volta.</strong> Todas as conversas e mensagens desse cliente serão
          apagadas e o cadastro será anonimizado. A trilha de auditoria é mantida de propósito — ela
          é a prova de que o pedido foi cumprido.
        </div>
      )}

      {mensagem && (
        <div className="aviso" style={{ marginTop: 12 }}>
          {mensagem} <a href="/consentimentos">Atualizar a página</a> para ver o resultado.
        </div>
      )}
    </div>
  );
}
