'use client';

import { useCallback, useEffect, useState } from 'react';

interface Estado {
  iaDesativada: boolean;
  whatsappDesativado: boolean;
  somenteHumano: boolean;
}

const OPCOES: Array<[keyof Estado, string, string]> = [
  [
    'iaDesativada',
    'Desligar a inteligência artificial',
    'Tudo passa a ir para atendimento humano.',
  ],
  ['whatsappDesativado', 'Desligar o canal WhatsApp', 'O canal para de processar mensagens.'],
  [
    'somenteHumano',
    'Modo somente humano',
    'A IA não responde; todas as conversas vão para a fila.',
  ],
];

export function Emergencia() {
  const [estado, setEstado] = useState<Estado | null>(null);
  const [ocupado, setOcupado] = useState(false);

  useEffect(() => {
    void fetch('/api/proxy/emergencia', { cache: 'no-store' })
      .then((r) => r.json())
      .then((d: Estado) => setEstado(d));
  }, []);

  const alternar = useCallback(async (chave: keyof Estado, valor: boolean) => {
    setOcupado(true);
    const r = await fetch('/api/proxy/emergencia', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ [chave]: valor }),
    });
    setEstado((await r.json()) as Estado);
    setOcupado(false);
  }, []);

  if (!estado) return <p style={{ color: 'var(--suave)' }}>Carregando...</p>;

  return (
    <div>
      {OPCOES.map(([chave, rotulo, ajuda]) => (
        <label
          className="linha-interruptor"
          key={chave}
          style={{ alignItems: 'flex-start', padding: '8px 0' }}
        >
          <input
            type="checkbox"
            checked={estado[chave]}
            disabled={ocupado}
            onChange={(e) => void alternar(chave, e.target.checked)}
            style={{ marginTop: 4 }}
          />
          <span>
            <strong>{rotulo}</strong>
            <br />
            <span style={{ color: 'var(--suave)', fontSize: 13 }}>{ajuda}</span>
          </span>
        </label>
      ))}
    </div>
  );
}
