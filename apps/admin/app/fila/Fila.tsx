'use client';

import { useCallback, useEffect, useState } from 'react';

interface Item {
  id: string;
  conversaId: string;
  clienteId: string;
  motivo: string;
  resumo: string;
  prioridade: string;
  status: string;
  criadoEm: string;
  atendente: string | null;
}

export function Fila() {
  const [itens, setItens] = useState<Item[]>([]);
  const [ocupado, setOcupado] = useState(false);

  const carregar = useCallback(async () => {
    const r = await fetch('/api/proxy/fila', { cache: 'no-store' });
    const dados = (await r.json()) as Item[] | { erro: string };
    if (Array.isArray(dados)) setItens(dados);
  }, []);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  const agir = useCallback(
    async (id: string, acao: 'assumir' | 'resolver') => {
      setOcupado(true);
      await fetch(`/api/proxy/fila/${id}/${acao}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ atendente: 'atendente-demo' }),
      });
      await carregar();
      setOcupado(false);
    },
    [carregar],
  );

  if (itens.length === 0) return <p style={{ color: 'var(--suave)' }}>Nenhuma conversa na fila.</p>;

  return (
    <div className="tabela-rolavel">
      <table>
        <thead>
          <tr>
            <th>Criado em</th>
            <th>Motivo</th>
            <th>Prioridade</th>
            <th>Resumo (mascarado)</th>
            <th>Status</th>
            <th>Ação</th>
          </tr>
        </thead>
        <tbody>
          {itens.map((i) => (
            <tr key={i.id}>
              <td>{new Date(i.criadoEm).toLocaleString('pt-BR')}</td>
              <td>{i.motivo}</td>
              <td>
                <span className={i.prioridade === 'alta' ? 'etiqueta alerta' : 'etiqueta neutra'}>
                  {i.prioridade}
                </span>
              </td>
              <td>{i.resumo}</td>
              <td>
                {i.status}
                {i.atendente ? ` (${i.atendente})` : ''}
              </td>
              <td>
                {i.status === 'aberto' && (
                  <button disabled={ocupado} onClick={() => void agir(i.id, 'assumir')}>
                    Assumir
                  </button>
                )}
                {i.status === 'em_atendimento' && (
                  <button disabled={ocupado} onClick={() => void agir(i.id, 'resolver')}>
                    Encerrar
                  </button>
                )}
                {i.status === 'resolvido' && <span style={{ color: 'var(--suave)' }}>—</span>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
