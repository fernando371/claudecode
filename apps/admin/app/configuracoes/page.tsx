import { buscar, temErro } from '@/lib/api';
import { Aviso } from '@/components/Aviso';
import { Etiqueta, Tabela } from '@/components/Tabela';
import { Emergencia } from './Emergencia';

interface Configuracoes {
  ambiente: string;
  adaptadores: Record<string, string>;
  travas: Record<string, boolean>;
  limites: Record<string, number>;
  retencao: {
    conversasDias: number;
    auditoriaDias: number;
    marcacoesSaudeDias: number;
    mascaramentoAtivo: boolean;
  };
}

const ROTULOS: Record<string, string> = {
  whatsapp: 'WhatsApp',
  catalogo: 'Catálogo',
  pedidos: 'Pedidos',
  notaFiscal: 'Nota Fiscal',
  rastreio: 'Rastreio',
  ia: 'Inteligência artificial',
  envioRealWhatsApp: 'Envio real pelo WhatsApp',
  campanhasAtivas: 'Campanhas ativas',
  iaLigada: 'IA ligada',
  whatsappLigado: 'WhatsApp ligado',
  somenteHumano: 'Modo somente humano',
  requisicoesPorMinutoWebhook: 'Requisições por minuto (webhook)',
  requisicoesPorMinutoPainel: 'Requisições por minuto (painel)',
  tempoLimiteIntegracaoMs: 'Tempo limite de integração (ms)',
  falhasParaAbrirCircuito: 'Falhas para abrir o circuito',
  campanhaPorClientePorSemana: 'Campanhas por cliente por semana',
};

export default async function Pagina() {
  const c = await buscar<Configuracoes>('/configuracoes');
  if (temErro(c))
    return (
      <>
        <h2>Configurações</h2>
        <Aviso tipo="erro">{c.erroApi}</Aviso>
      </>
    );

  return (
    <>
      <h2>Configurações</h2>
      <p className="descricao">
        Somente informações não sensíveis. Chaves e senhas ficam apenas no arquivo .env.
      </p>
      <Aviso>
        Nenhuma senha, token ou chave é exibida aqui — nem no painel, nem nos logs, nem nos
        relatórios.
      </Aviso>

      <div className="bloco">
        <h3>Modo de emergência</h3>
        <p style={{ color: 'var(--suave)', marginTop: 0 }}>
          Efeito imediato, sem precisar reiniciar o sistema.
        </p>
        <Emergencia />
      </div>

      <div className="bloco">
        <h3>Adaptadores em uso</h3>
        <Tabela
          colunas={['Integração', 'Adaptador']}
          linhas={Object.entries(c.adaptadores).map(([k, v]) => [
            ROTULOS[k] ?? k,
            <Etiqueta key={k} texto={v} tipo={v === 'mock' ? 'neutra' : 'atencao'} />,
          ])}
        />
      </div>

      <div className="bloco">
        <h3>Travas</h3>
        <Tabela
          colunas={['Trava', 'Situação']}
          linhas={Object.entries(c.travas).map(([k, v]) => [
            ROTULOS[k] ?? k,
            <Etiqueta key={k} texto={v ? 'Ligada' : 'Desligada'} tipo={v ? 'atencao' : 'neutra'} />,
          ])}
        />
      </div>

      <div className="bloco">
        <h3>Limites e retenção</h3>
        <Tabela
          colunas={['Item', 'Valor']}
          linhas={[
            ...Object.entries(c.limites).map(([k, v]) => [ROTULOS[k] ?? k, String(v)]),
            ['Retenção de conversas (dias)', String(c.retencao.conversasDias)],
            ['Retenção de auditoria (dias)', String(c.retencao.auditoriaDias)],
            ['Retenção de marcações de saúde (dias)', String(c.retencao.marcacoesSaudeDias)],
            ['Mascaramento de dados pessoais', c.retencao.mascaramentoAtivo ? 'Ativo' : 'Inativo'],
            ['Ambiente', c.ambiente],
          ]}
        />
      </div>
    </>
  );
}
