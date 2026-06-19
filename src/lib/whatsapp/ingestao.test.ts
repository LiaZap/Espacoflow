import { describe, it, expect } from "vitest";
import { normalizarEvolution } from "./ingestao";

describe("normalizarEvolution", () => {
  it("mensagem recebida do cliente (fromMe=false)", () => {
    const r = normalizarEvolution({
      data: {
        key: { remoteJid: "5561999990000@s.whatsapp.net", id: "ABC", fromMe: false },
        pushName: "Cliente",
        message: { conversation: "oi" },
      },
    });
    expect(r).not.toBeNull();
    expect(r?.fromMe).toBe(false);
    expect(r?.telefone).toBe("5561999990000");
    expect(r?.texto).toBe("oi");
    expect(r?.nome).toBe("Cliente");
  });

  it("mensagem enviada pelo espaço (fromMe=true) é capturada como saída", () => {
    const r = normalizarEvolution({
      data: {
        key: { remoteJid: "5561999990000@s.whatsapp.net", id: "XYZ", fromMe: true },
        pushName: "Espaço Flow",
        message: { conversation: "já te respondo" },
      },
    });
    expect(r).not.toBeNull();
    expect(r?.fromMe).toBe(true);
    // remoteJid continua sendo o cliente, mesmo em fromMe.
    expect(r?.telefone).toBe("5561999990000");
    expect(r?.texto).toBe("já te respondo");
    // não usa o pushName do remetente (o espaço) como nome do cliente.
    expect(r?.nome).toBeUndefined();
  });

  it("descarta status@broadcast e payload sem key", () => {
    expect(
      normalizarEvolution({ data: { key: { remoteJid: "status@broadcast", id: "1" } } })
    ).toBeNull();
    expect(normalizarEvolution({ data: {} })).toBeNull();
  });
});
