export function Aviso({
  children,
  tipo = 'atencao',
}: {
  children: React.ReactNode;
  tipo?: 'atencao' | 'erro';
}) {
  return <div className={tipo === 'erro' ? 'aviso erro' : 'aviso'}>{children}</div>;
}

export function AvisoDados() {
  return (
    <Aviso>
      <strong>Ambiente de demonstração.</strong> Todos os produtos, pedidos e clientes exibidos aqui
      são fictícios. Nenhuma mensagem real é enviada e nenhum sistema de produção é acessado.
    </Aviso>
  );
}
