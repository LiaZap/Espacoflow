import { describe, it, expect } from "vitest";
import { ordenarSalasPorPreferencia, casaSalaNome } from "./agendar";

// Cenário do espaço: Sala 02 = sem mesa (psicólogo); Sala 01/03/04 = com mesa.
const SALAS = [
  { id: "s1", nome: "Sala 01", prioridade: 1, tem_mesa: true },
  { id: "s2", nome: "Sala 02", prioridade: 2, tem_mesa: false },
  { id: "s3", nome: "Sala 03", prioridade: 3, tem_mesa: true },
];

describe("roteamento de sala por necessidade de mesa", () => {
  it("psicólogo (precisaMesa=false) vai para a Sala 02 (sem mesa)", () => {
    const r = ordenarSalasPorPreferencia(SALAS, false);
    expect(r[0].nome).toBe("Sala 02");
  });

  it("quem precisa de mesa (precisaMesa=true) NÃO cai na Sala 02 primeiro", () => {
    const r = ordenarSalasPorPreferencia(SALAS, true);
    expect(r[0].tem_mesa).toBe(true);
    expect(r[0].nome).toBe("Sala 01"); // com mesa + menor prioridade
  });

  it("quem pede POLTRONA reclinável não cai na Sala 02, mesmo dizendo que não precisa de mesa", () => {
    // Caso real (23/07): cliente disse "não preciso de mesa, preciso da cadeira reclinável".
    // Só pela mesa, a 02 venceria — mas ela é a ÚNICA sem poltrona.
    const comPoltrona = [
      { id: "s1", nome: "Sala 01", prioridade: 1, tem_mesa: true, tem_poltrona: true },
      { id: "s2", nome: "Sala 02", prioridade: 2, tem_mesa: false, tem_poltrona: false },
      { id: "s3", nome: "Sala 03", prioridade: 3, tem_mesa: true, tem_poltrona: true },
    ];
    const r = ordenarSalasPorPreferencia(comPoltrona, false, true);
    expect(r[0].nome).not.toBe("Sala 02");
    expect(r[0].tem_poltrona).toBe(true);
  });

  it("sem preferência (undefined) ordena só por prioridade de alocação", () => {
    const r = ordenarSalasPorPreferencia(SALAS, undefined);
    expect(r.map((s) => s.nome)).toEqual(["Sala 01", "Sala 02", "Sala 03"]);
  });

  it("não bloqueia: se só sobrou sala sem mesa e precisa de mesa, ela ainda é elegível", () => {
    const r = ordenarSalasPorPreferencia([{ id: "s2", nome: "Sala 02", prioridade: 2, tem_mesa: false }], true);
    expect(r).toHaveLength(1);
    expect(r[0].nome).toBe("Sala 02");
  });

  it("não muta o array original", () => {
    const orig = [...SALAS];
    ordenarSalasPorPreferencia(SALAS, false);
    expect(SALAS).toEqual(orig);
  });
});

describe("casaSalaNome (honra a sala escolhida pelo cliente)", () => {
  it("casa por número mesmo com nomes diferentes", () => {
    expect(casaSalaNome("Sala Privativa 03", "Sala 03")).toBe(true);
    expect(casaSalaNome("Sala 03", "03")).toBe(true);
    expect(casaSalaNome("Sala 03", "3")).toBe(true);
    expect(casaSalaNome("Sala 01", "sala 01")).toBe(true);
  });
  it("NÃO casa salas diferentes", () => {
    expect(casaSalaNome("Sala 02", "Sala 03")).toBe(false);
    expect(casaSalaNome("Sala Privativa 03", "Sala 02")).toBe(false);
  });
  it("pedido vazio não casa", () => {
    expect(casaSalaNome("Sala 03", "")).toBe(false);
  });
});
