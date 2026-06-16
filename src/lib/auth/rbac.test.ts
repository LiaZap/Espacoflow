import { describe, it, expect } from "vitest";
import { temPapel, temPermissao } from "./rbac";

describe("temPapel (hierarquia)", () => {
  it("papel superior cobre o inferior", () => {
    expect(temPapel("owner", "recepcao")).toBe(true);
    expect(temPapel("recepcao", "recepcao")).toBe(true);
    expect(temPapel("visualizador", "recepcao")).toBe(false);
  });
});

describe("temPermissao (matriz)", () => {
  it("recepção opera o dia a dia, mas não exclui nem vê painel owner", () => {
    expect(temPermissao("recepcao", "clientes", "criar")).toBe(true);
    expect(temPermissao("recepcao", "clientes", "excluir")).toBe(false);
    expect(temPermissao("recepcao", "painel_owner", "ler")).toBe(false);
  });

  it("visualizador só lê; owner vê o painel", () => {
    expect(temPermissao("visualizador", "clientes", "ler")).toBe(true);
    expect(temPermissao("visualizador", "clientes", "criar")).toBe(false);
    expect(temPermissao("owner", "painel_owner", "ler")).toBe(true);
  });
});
