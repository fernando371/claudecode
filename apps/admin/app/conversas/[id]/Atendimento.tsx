'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

interface Mensagem {
  id: string;
  direcao: 'entrada' | 'saida';
  autor: 'cliente' | 'agente' | 'atendente';
  texto: string;
  intencao: string | null;
  regras: string[];
  escalonado: boolean;
  motivoEscalonamento: string | null;
  criadoEm: string;
}

interface Nota {
  id: string;
  atendente: string;
  texto: string;
  criadoEm: string;
}

interface ItemFila {
  id: string;
  motivo: string;
  prioridade: string;
  status: string;
  criadoEm: string;
}

interface Dados {
  conversa: {
    id: string;
    clienteId: string;
    canal: string;
    iniciadaEm: string;
    assumidaPor: string | null;
  };
  cliente: { id: string; nome: string; email: string; telefone: string } | null;
  mensagens: Mensagem[];
  notas: Nota[];
  fila: ItemFila[];
}

const hora = (iso: string) => new Date(iso).toLocaleString('pt-BR');

export function Atendimento({ conversaId }: { conversaId: string }) {
  const [dados, setDados] = useState<Dados | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [texto, setTexto] = useState('');
  const [nota, setNota] = useState('');
  const [atendente, setAtendente] = useState('atendente');
  const [ocupado, setOcupado] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  const fim = useRef<HTMLDivElement>(null);

  const carregar = useCallback(async () => {
    try {
      const r = await fetch(`/api/proxy/conversas/${conversaId}`, { cache: 'no-store' });
      if (!r.ok) {
        setErro('Conversa não encontrada.');
        return;
      }
      const corpo = (await r.json()) as Dados;
      setDados(corpo);
      // Se alguém já assumiu, o campo passa a mostrar essa pessoa.
      setAtendente((atual) => (atual === 'atendente' && corpo.conversa.assumidaPor) || atual);
      setErro(null);
    } catch {
      setErro('Não foi possível falar com a API. Ela está rodando?');
    }
  }, [conversaId]);

  useEffect(() => {
    void carregar();
    const relogio = setInterval(() => void carregar(), 5000);
    return () => clearInterval(relogio);
  }, [carregar]);

  useEffect(() => {
    fim.current?.scrollIntoView({ behavior: 'smooth' });
  }, [dados?.mensagens.length]);

  const responder = useCallback(async () => {
    if (!texto.trim() || ocupado) return;
    setOcupado(true);
    setAviso(null);
    try {
      const r = await fetch(`/api/proxy/conversas/${conversaId}/responder`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ texto, atendente }),
      });
      const corpo = (await r.json()) as {
        avisoEnvio?: string | null;
        mensagem?: string;
        erro?: string;
      };
      if (!r.ok) {
        setAviso(corpo.mensagem ?? 'Não foi possível enviar.');
      } else {
        setTexto('');
        if (corpo.avisoEnvio) setAviso(corpo.avisoEnvio);
      }
      await carregar();
    } finally {
      setOcupado(false);
    }
  }, [atendente, carregar, conversaId, ocupado, texto]);

  const anotar = useCallback(async () => {
    if (!nota.trim() || ocupado) return;
    setOcupado(true);
    await fetch(`/api/proxy/conversas/${conversaId}/anotar`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ texto: nota, atendente }),
    });
    setNota('');
    await carregar();
    setOcupado(false);
  }, [atendente, carregar, conversaId, nota, ocupado]);

  const encerrar = useCallback(async () => {
    setOcupado(true);
    await fetch(`/api/proxy/conversas/${conversaId}/encerrar`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ atendente }),
    });
    await carregar();
    setOcupado(false);
  }, [atendente, carregar, conversaId]);

  if (erro) return <div className="aviso erro">{erro}</div>;
  if (!dados) return <p style={{ color: 'var(--suave)' }}>Carregando...</p>;

  const emAtendimento = Boolean(dados.conversa.assumidaPor);

  return (
    <div className="duas-colunas">
      <div className="bloco">
        <h3>Histórico</h3>
        <p style={{ color: 'var(--suave)', marginTop: 0, fontSize: 13 }}>
          Atualiza sozinho a cada 5 segundos.
        </p>

        <div className="conversa" style={{ maxHeight: 460, overflowY: 'auto' }}>
          {dados.mensagens.length === 0 && (
            <p style={{ color: 'var(--suave)' }}>Nenhuma mensagem nesta conversa.</p>
          )}
          {dados.mensagens.map((m) => (
            <div key={m.id} className={m.autor === 'cliente' ? 'balao cliente' : 'balao agente'}>
              <div className="autor-balao">
                {m.autor === 'cliente'
                  ? 'Cliente'
                  : m.autor === 'atendente'
                    ? 'Atendente'
                    : 'Agente (IA)'}
                {' · '}
                {hora(m.criadoEm)}
                {m.escalonado && m.motivoEscalonamento
                  ? ` · transferido: ${m.motivoEscalonamento}`
                  : ''}
              </div>
              {m.texto || <em style={{ color: 'var(--suave)' }}>(sem resposta automática)</em>}
            </div>
          ))}
          <div ref={fim} />
        </div>

        {aviso && <div className="aviso">{aviso}</div>}

        <form
          onSubmit={(e) => {
            e.preventDefault();
            void responder();
          }}
        >
          <label className="rotulo-campo" htmlFor="resposta">
            Responder o cliente
          </label>
          <textarea
            id="resposta"
            rows={3}
            value={texto}
            placeholder="Escreva a resposta que o cliente vai receber..."
            onChange={(e) => setTexto(e.target.value)}
            disabled={ocupado}
          />
          <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
            <button className="principal" type="submit" disabled={ocupado || !texto.trim()}>
              Enviar resposta
            </button>
            <button type="button" onClick={() => void encerrar()} disabled={ocupado}>
              Encerrar e devolver ao agente
            </button>
          </div>
        </form>
      </div>

      <div>
        <div className="bloco">
          <h3>Situação</h3>
          <p style={{ margin: '4px 0' }}>
            <strong>Atendimento:</strong>{' '}
            {emAtendimento ? (
              <span className="etiqueta atencao">com {dados.conversa.assumidaPor}</span>
            ) : (
              <span className="etiqueta neutra">com o agente automático</span>
            )}
          </p>
          <p style={{ margin: '4px 0' }}>
            <strong>Canal:</strong> {dados.conversa.canal}
          </p>
          <p style={{ margin: '4px 0' }}>
            <strong>Início:</strong> {hora(dados.conversa.iniciadaEm)}
          </p>
          {dados.cliente && (
            <>
              <p style={{ margin: '4px 0' }}>
                <strong>Cliente:</strong> {dados.cliente.nome}
              </p>
              <p style={{ margin: '4px 0' }} className="mono">
                {dados.cliente.email || '—'} · {dados.cliente.telefone}
              </p>
            </>
          )}

          <label className="rotulo-campo" htmlFor="atendente" style={{ marginTop: 12 }}>
            Seu nome
          </label>
          <input
            id="atendente"
            type="text"
            value={atendente}
            onChange={(e) => setAtendente(e.target.value)}
          />
        </div>

        {dados.fila.length > 0 && (
          <div className="bloco">
            <h3>Por que foi transferida</h3>
            <ul className="lista-simples">
              {dados.fila.map((f) => (
                <li key={f.id}>
                  <strong>{f.motivo}</strong> · prioridade {f.prioridade} · {f.status}
                  <br />
                  <span style={{ color: 'var(--suave)', fontSize: 13 }}>{hora(f.criadoEm)}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="bloco">
          <h3>Anotações internas</h3>
          <p style={{ color: 'var(--suave)', marginTop: 0, fontSize: 13 }}>
            Só a equipe vê. Nunca é enviada ao cliente.
          </p>
          {dados.notas.map((n) => (
            <div key={n.id} className="nota">
              <div className="autor-balao">
                {n.atendente} · {hora(n.criadoEm)}
              </div>
              {n.texto}
            </div>
          ))}
          <textarea
            rows={2}
            value={nota}
            placeholder="Anotar algo sobre este atendimento..."
            onChange={(e) => setNota(e.target.value)}
            disabled={ocupado}
            style={{ marginTop: 8 }}
          />
          <button
            type="button"
            onClick={() => void anotar()}
            disabled={ocupado || !nota.trim()}
            style={{ marginTop: 8 }}
          >
            Salvar anotação
          </button>
        </div>
      </div>
    </div>
  );
}
