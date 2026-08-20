import { conversas, filaHumana, mensagens, metricas as eventos } from './db/repositorios.js';
import { resumoConhecimento } from './knowledge/index.js';

/**
 * Indicadores do painel. Todos calculados a partir de dados SIMULADOS
 * nesta fase - servem para provar que a medicao funciona, nao para
 * projetar resultado real.
 */

export interface Indicadores {
  totalConversas: number;
  totalMensagens: number;
  tempoPrimeiraRespostaMsMediana: number | null;
  tempoPrimeiraRespostaHumanaMinutosMediana: number | null;
  mensagensDeAtendentes: number;
  percentualResolvidoAutomaticamente: number;
  percentualTransferidoHumano: number;
  motivosDeContato: Array<{ intencao: string; total: number }>;
  produtosMaisConsultados: Array<{ produto: string; total: number }>;
  consultasSobreAtraso: number;
  cliquesEmProdutosOuCarrinhos: number;
  crossSellOferecido: number;
  receitaPotencialIdentificadaCentavos: number;
  conversoesAssistidasSimuladas: number;
  carrinhosRecuperadosSimulados: number;
  receitaAssistidaSimuladaCentavos: number;
  errosDeIntegracao: number;
  respostasBloqueadasPorSeguranca: number;
  filaAberta: number;
  conhecimento: ReturnType<typeof resumoConhecimento>;
}

function mediana(valores: number[]): number | null {
  if (valores.length === 0) return null;
  const ordenados = [...valores].sort((a, b) => a - b);
  const meio = Math.floor(ordenados.length / 2);
  if (ordenados.length % 2 === 1) return ordenados[meio]!;
  return Math.round((ordenados[meio - 1]! + ordenados[meio]!) / 2);
}

export function calcularIndicadores(): Indicadores {
  const todasConversas = conversas.listar(1000);
  const todasMensagens = mensagens.todas(5000);
  const saidas = todasMensagens.filter((m) => m.direcao === 'saida');
  const contagens = eventos.contarPorTipo();

  const respostasDoAgente = saidas.filter((m) => m.autor !== 'atendente');
  const transferidas = respostasDoAgente.filter((m) => m.escalonado).length;
  const total = respostasDoAgente.length || 1;

  // Tempo entre a entrada na fila e a primeira resposta escrita por uma pessoa.
  const esperasEmMinutos: number[] = [];
  for (const item of filaHumana.listar()) {
    const primeiraHumana = mensagens
      .porConversa(item.conversaId)
      .find((m) => m.autor === 'atendente' && m.criadoEm >= item.criadoEm);
    if (!primeiraHumana) continue;
    const espera = Date.parse(primeiraHumana.criadoEm) - Date.parse(item.criadoEm);
    if (Number.isFinite(espera) && espera >= 0) esperasEmMinutos.push(Math.round(espera / 60000));
  }

  const motivos = Object.entries(contagens)
    .filter(([tipo]) => tipo.startsWith('intencao:'))
    .map(([tipo, totalIntencao]) => ({
      intencao: tipo.replace('intencao:', ''),
      total: totalIntencao,
    }))
    .sort((a, b) => b.total - a.total);

  const produtos = new Map<string, number>();
  for (const e of eventos.listar(1000)) {
    if (e.tipo !== 'produto_consultado' || !e.detalhe) continue;
    for (const id of e.detalhe.split(',')) {
      produtos.set(id, (produtos.get(id) ?? 0) + 1);
    }
  }

  return {
    totalConversas: todasConversas.length,
    totalMensagens: todasMensagens.length,
    tempoPrimeiraRespostaMsMediana: mediana(
      respostasDoAgente.map((m) => m.duracaoMs ?? 0).filter((v) => v > 0),
    ),
    tempoPrimeiraRespostaHumanaMinutosMediana: mediana(esperasEmMinutos),
    mensagensDeAtendentes: saidas.filter((m) => m.autor === 'atendente').length,
    percentualResolvidoAutomaticamente: Number((((total - transferidas) / total) * 100).toFixed(1)),
    percentualTransferidoHumano: Number(((transferidas / total) * 100).toFixed(1)),
    motivosDeContato: motivos,
    produtosMaisConsultados: [...produtos.entries()]
      .map(([produto, totalProduto]) => ({ produto, total: totalProduto }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 10),
    consultasSobreAtraso: contagens['consulta_atraso'] ?? 0,
    cliquesEmProdutosOuCarrinhos: contagens['link_carrinho_gerado'] ?? 0,
    crossSellOferecido: contagens['crossell_oferecido'] ?? 0,
    receitaPotencialIdentificadaCentavos: eventos.somarValor('oportunidade_identificada'),
    conversoesAssistidasSimuladas: contagens['conversao_assistida'] ?? 0,
    carrinhosRecuperadosSimulados: contagens['carrinho_recuperado'] ?? 0,
    receitaAssistidaSimuladaCentavos: eventos.somarValor('conversao_assistida'),
    errosDeIntegracao: contagens['erro_integracao'] ?? 0,
    respostasBloqueadasPorSeguranca: contagens['resposta_bloqueada_seguranca'] ?? 0,
    filaAberta: filaHumana.listar('aberto').length,
    conhecimento: resumoConhecimento(),
  };
}
