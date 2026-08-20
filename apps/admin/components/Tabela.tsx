export function Tabela({ colunas, linhas }: { colunas: string[]; linhas: React.ReactNode[][] }) {
  if (linhas.length === 0) {
    return <p style={{ color: 'var(--suave)' }}>Nenhum registro ainda.</p>;
  }
  return (
    <div className="tabela-rolavel">
      <table>
        <thead>
          <tr>
            {colunas.map((c) => (
              <th key={c}>{c}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {linhas.map((linha, i) => (
            <tr key={i}>
              {linha.map((celula, j) => (
                <td key={j}>{celula}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function Etiqueta({
  texto,
  tipo = 'ok',
}: {
  texto: string;
  tipo?: 'ok' | 'alerta' | 'atencao' | 'neutra';
}) {
  const classe = tipo === 'ok' ? 'etiqueta' : `etiqueta ${tipo}`;
  return <span className={classe}>{texto}</span>;
}
