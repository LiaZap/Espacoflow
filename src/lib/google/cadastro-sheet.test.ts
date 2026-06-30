import { describe, it, expect } from "vitest";
import { resolverColunas, telefoneCasa, ehAceite } from "./cadastro-sheet";

// Cabeçalho REAL da planilha de respostas do Felipe (UAT R04).
const HEADER = [
  "Carimbo de data/hora",
  "Nome completo",
  "Data de Nascimento",
  "Documento de identificação (CPF ou outros)",
  "Endereço residencial ",
  "Profissão ou área de atuação",
  "E-mail",
  "Telefone de Contato com DDD ( Uso frequente )",
  "Endereço de redes sociais",
  "Razão social e nome fantasia",
  "CNPJ",
  "Endereço comercial",
  "Site e redes sociais",
  "Frequência de uso ",
  "Diga como você encontrou o “Flow”?",
  "Está de acordo com a política de uso?",
  "CEP",
  "CEP",
  "Coluna 17",
  "Coluna 15",
];

describe("planilha de cadastro: mapeamento de colunas", () => {
  it("acha telefone, nome e aceite nas colunas certas do cabeçalho real", () => {
    const { iTel, iNome, iAceite } = resolverColunas(HEADER);
    expect(iTel).toBe(7); // "Telefone de Contato com DDD"
    expect(iNome).toBe(1); // "Nome completo" (não "Razão social e nome fantasia")
    expect(iAceite).toBe(15); // "Está de acordo com a política de uso?" (não "Frequência de uso")
  });
});

describe("telefoneCasa (sufixo, ignora DDI/DDD/formatação)", () => {
  it("casa o mesmo número em formatos diferentes", () => {
    expect(telefoneCasa("5511989922411", "(11) 98992-2411")).toBe(true);
    expect(telefoneCasa("11989922411", "+55 11 98992 2411")).toBe(true);
  });
  it("não casa números diferentes nem curtos demais", () => {
    expect(telefoneCasa("5511989922411", "5511000000000")).toBe(false);
    expect(telefoneCasa("123", "123")).toBe(false);
  });
});

describe("ehAceite", () => {
  it("reconhece respostas afirmativas e rejeita negativa/vazia", () => {
    expect(ehAceite("Sim")).toBe(true);
    expect(ehAceite("Sim, estou de acordo")).toBe(true);
    expect(ehAceite("Li e aceito a política")).toBe(true);
    expect(ehAceite("Não")).toBe(false);
    expect(ehAceite("")).toBe(false);
  });
});
