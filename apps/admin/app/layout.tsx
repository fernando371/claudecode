import type { Metadata } from 'next';
import Link from 'next/link';
import './globals.css';

export const metadata: Metadata = {
  title: 'FDC WhatsApp AI — Painel',
  description: 'Painel do protótipo de atendimento e vendas pelo WhatsApp da FDC.',
};

const MENU = [
  ['/', 'Visão geral'],
  ['/simulador', 'Simulador de Conversas'],
  ['/conversas', 'Conversas simuladas'],
  ['/conhecimento', 'Base de conhecimento'],
  ['/produtos', 'Produtos fictícios'],
  ['/pedidos', 'Pedidos fictícios'],
  ['/fila', 'Fila de atendimento'],
  ['/indicadores', 'Indicadores'],
  ['/consentimentos', 'Consentimentos (LGPD)'],
  ['/auditoria', 'Eventos de auditoria'],
  ['/integracoes', 'Status das integrações'],
  ['/configuracoes', 'Configurações'],
] as const;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>
        <div className="layout">
          <nav className="menu">
            <h1>FDC WhatsApp AI</h1>
            <p className="sub">Protótipo · dados fictícios</p>
            {MENU.map(([href, rotulo]) => (
              <Link key={href} href={href}>
                {rotulo}
              </Link>
            ))}
          </nav>
          <main className="conteudo">{children}</main>
        </div>
      </body>
    </html>
  );
}
