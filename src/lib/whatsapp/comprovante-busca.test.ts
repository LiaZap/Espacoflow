import { describe, it, expect } from "vitest";
import { acharComprovanteNovo, midiaEhComprovante, type MsgHistorico } from "./comprovante-higia";

const u = (tipo: string, midia_url: string | null = null, processada_por_higia = false): MsgHistorico =>
  ({ id: "m" + Math.random(), origem: "user", tipo, midia_url, processada_por_higia });
const h = (): MsgHistorico => ({ origem: "higia", tipo: "text", midia_url: null });

describe("acharComprovanteNovo — achar o comprovante no bloco novo do cliente", () => {
  it("acha o PDF mesmo quando o cliente escreve algo DEPOIS (caso Valdemir: PDF + 'Obrigado')", () => {
    const hist = [h(), u("document", "https://x/a.bin"), u("text")];
    expect(acharComprovanteNovo(hist)?.midia_url).toBe("https://x/a.bin");
  });

  it("acha a imagem seguida de texto (caso Alessandro: comprovante + 'Esse é o comprovante')", () => {
    const hist = [h(), u("image", "https://x/b.jpg"), u("text")];
    expect(acharComprovanteNovo(hist)?.tipo).toBe("image");
  });

  it("pega a mídia MAIS RECENTE quando o cliente manda duas vezes", () => {
    const hist = [h(), u("document", "https://x/1.bin"), u("document", "https://x/2.bin")];
    expect(acharComprovanteNovo(hist)?.midia_url).toBe("https://x/2.bin");
  });

  it("acha o comprovante mesmo quando a EQUIPE respondeu manualmente depois (caso 08/09)", () => {
    // A resposta humana zerava o "bloco novo" e o comprovante ficava sem processar.
    // O reuso de comprovante antigo é barrado por URL já usada, não por posição.
    const hist = [u("document", "https://x/a.bin"), { origem: "humano", tipo: "text", midia_url: null }];
    expect(acharComprovanteNovo(hist)?.midia_url).toBe("https://x/a.bin");
  });

  it("ignora mídia enviada por NÓS (só conta a do cliente)", () => {
    const hist = [{ origem: "higia", tipo: "image", midia_url: "https://x/foto-sala.jpg" }, u("text")];
    expect(acharComprovanteNovo(hist)).toBeUndefined();
  });

  it("IGNORA mídia JÁ avaliada — foto antiga não confirma reserva criada depois dela", () => {
    // Falso positivo com dinheiro: sem esta barreira, a foto que o cliente mandou perguntando
    // "a sala é essa?" voltaria como "mídia mais recente" e daria a reserva como paga.
    const hist = [u("image", "https://x/foto-antiga.jpg", true), u("text")];
    expect(acharComprovanteNovo(hist)).toBeUndefined();
  });

  it("entre uma mídia já avaliada e uma nova, pega a NOVA", () => {
    const hist = [u("image", "https://x/velha.jpg", true), u("document", "https://x/nova.bin", false)];
    expect(acharComprovanteNovo(hist)?.midia_url).toBe("https://x/nova.bin");
  });

  it("sem mídia no bloco novo, não há comprovante", () => {
    expect(acharComprovanteNovo([h(), u("text")])).toBeUndefined();
    expect(acharComprovanteNovo([])).toBeUndefined();
  });
});

describe("midiaEhComprovante — com o tipo REAL detectado pelo conteúdo", () => {
  it("aceita o PDF salvo como .bin, porque o tipo vem do conteúdo do arquivo", () => {
    // Era exatamente aqui que o fix anterior falhava: extensão .bin e MIME genérico.
    expect(midiaEhComprovante("document", "application/pdf", "https://x/midia/123.bin")).toBe(true);
  });

  it("recusa documento cujo conteúdo não é PDF", () => {
    expect(midiaEhComprovante("document", "application/octet-stream", "https://x/midia/123.bin")).toBe(false);
    expect(midiaEhComprovante("document", "", "https://x/midia/123.bin")).toBe(false);
  });
});
