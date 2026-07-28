/** Regras puras de escolha de sala (preferência e casamento de nome). Separado de agendar.ts
 * (SOLID: regra pura x orquestração) e reexportado por ele para não quebrar quem já importa. */
/**
 * Ordena salas livres pela preferência do cliente e depois pela prioridade de alocação.
 * PADRÃO = salas COM poltrona reclinável (01/03/04). A Sala 02 (única sem poltrona) é EXCEÇÃO:
 * cai por último e só é recomendada quando as demais estão ocupadas — nunca vira o padrão só
 * porque o cliente disse que não precisa de mesa. Assim a maioria (recorrentes) não recebe a 02
 * por engano.
 * - poltrona: SEMPRE preferida (sala sem poltrona vai pro fim);
 * - precisaMesa === true  → entre as de poltrona, as COM mesa primeiro;
 * - precisaMesa === false → as SEM mesa primeiro (só reordena entre as de poltrona);
 * Nunca bloqueia: a sala "errada" fica no fim, mas segue elegível se for a única livre.
 */
export function ordenarSalasPorPreferencia<
  T extends { prioridade: number | null; tem_mesa: boolean; tem_poltrona?: boolean },
>(livres: T[], precisaMesa?: boolean): T[] {
  const prefPoltrona = (s: T): number => (s.tem_poltrona === false ? 1 : 0); // poltrona é o padrão
  const prefMesa = (s: T): number => {
    if (precisaMesa === true) return s.tem_mesa ? 0 : 1;
    if (precisaMesa === false) return s.tem_mesa ? 1 : 0;
    return 0;
  };
  return [...livres].sort(
    (a, b) =>
      prefPoltrona(a) - prefPoltrona(b) || prefMesa(a) - prefMesa(b) || (a.prioridade ?? 99) - (b.prioridade ?? 99)
  );
}

/**
 * Casa o nome da sala pedido pelo cliente com o nome cadastrado, tolerante a variações:
 * "Sala 03" ~ "Sala Privativa 03" ~ "03" ~ "3" (compara o NÚMERO da sala) e também
 * por igualdade/inclusão do texto normalizado. Serve p/ honrar a escolha explícita do cliente.
 */
export function casaSalaNome(nome: string, pedido: string): boolean {
  const norm = (s: string) =>
    (s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
  const n = norm(nome);
  const p = norm(pedido);
  if (!p) return false;
  if (n === p) return true;
  const numN = nome.match(/\d+/)?.[0];
  const numP = pedido.match(/\d+/)?.[0];
  if (numN && numP && parseInt(numN, 10) === parseInt(numP, 10)) return true;
  return n.includes(p) || p.includes(n);
}
