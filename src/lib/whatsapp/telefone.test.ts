import { describe, it, expect } from "vitest";
import { variantesTelefoneBR, canonicalTelefoneBR } from "./telefone";

describe("telefone BR — variantes e canônico (identidade do cliente)", () => {
  it("celular COM 9º dígito gera a variante SEM o 9 (e vice-versa)", () => {
    const com9 = variantesTelefoneBR("5511987654321"); // 55 11 9 8765-4321
    expect(com9).toContain("5511987654321");
    expect(com9).toContain("551187654321"); // sem o 9º dígito
    const sem9 = variantesTelefoneBR("551187654321");
    expect(sem9).toContain("551187654321");
    expect(sem9).toContain("5511987654321"); // com o 9º dígito
  });

  it("planilha (55+DDD+9) e WhatsApp (sem 9) CASAM por variante", () => {
    const daPlanilha = "5511987654321";
    const doWhatsapp = "551187654321";
    // O lookup usa: existe interseção entre as variantes dos dois?
    const vp = new Set(variantesTelefoneBR(daPlanilha));
    const casa = variantesTelefoneBR(doWhatsapp).some((v) => vp.has(v));
    expect(casa).toBe(true);
  });

  it("canônico normaliza para 55+DDD+9XXXXXXXX", () => {
    expect(canonicalTelefoneBR("551187654321")).toBe("5511987654321"); // adiciona o 9
    expect(canonicalTelefoneBR("5511987654321")).toBe("5511987654321"); // já canônico
    expect(canonicalTelefoneBR("11987654321")).toBe("5511987654321"); // sem DDI → adiciona 55
    expect(canonicalTelefoneBR("(11) 98765-4321")).toBe("5511987654321"); // com máscara
  });

  it("trata o '0' de tronco (caso Samira): 061... e 5561... são a mesma pessoa", () => {
    const a = "061993177157"; // digitado com o 0 de tronco (planilha)
    const b = "556193177157"; // formato do WhatsApp (sem o 9º dígito)
    expect(canonicalTelefoneBR(a)).toBe(canonicalTelefoneBR(b)); // mesmo canônico → dedup agrupa
    const va = new Set(variantesTelefoneBR(a));
    expect(variantesTelefoneBR(b).some((x) => va.has(x))).toBe(true); // variantes casam no lookup
  });

  it("formato inesperado não quebra (devolve dígitos crus)", () => {
    expect(canonicalTelefoneBR("123")).toBe("123");
    expect(variantesTelefoneBR("")).toEqual([]);
  });
});
