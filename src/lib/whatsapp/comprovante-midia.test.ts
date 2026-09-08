import { describe, it, expect } from "vitest";
import { midiaEhComprovante, extrairBase64DoPayload } from "./comprovante-midia";

describe("midiaEhComprovante — que arquivo vale como comprovante", () => {
  it("aceita IMAGEM (print/foto), como sempre", () => {
    expect(midiaEhComprovante("image", "image/jpeg", "https://x/y.jpg")).toBe(true);
    expect(midiaEhComprovante("image", "image/png", "https://x/y.png")).toBe(true);
  });

  it("aceita PDF do banco — caso real: PicPay manda o comprovante em PDF", () => {
    // Antes isso caía no LLM, que pedia "print ou imagem", e a reserva nunca confirmava.
    expect(midiaEhComprovante("document", "application/pdf", "https://x/comprovante.pdf")).toBe(true);
    // Content-type genérico do provedor, mas a URL entrega que é PDF:
    expect(midiaEhComprovante("document", "application/octet-stream", "https://x/comprovante_picpay_PIX.pdf")).toBe(true);
  });

  it("RECUSA documento que não é PDF — não pode confirmar reserva", () => {
    expect(midiaEhComprovante("document", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "https://x/a.docx")).toBe(false);
    expect(midiaEhComprovante("document", "application/zip", "https://x/a.zip")).toBe(false);
    expect(midiaEhComprovante("document", "image/jpeg", "https://x/sem-extensao")).toBe(false);
  });
});

describe("extrairBase64DoPayload — o arquivo vem no próprio webhook", () => {
  const pdf = Buffer.from("%PDF-1.4\n" + "x".repeat(200)).toString("base64");

  it("acha o base64 em data.message.base64 (formato do Evolution)", () => {
    expect(extrairBase64DoPayload({ data: { message: { base64: pdf } } })).toBe(pdf);
  });

  it("acha em data.base64 e na raiz também", () => {
    expect(extrairBase64DoPayload({ data: { base64: pdf } })).toBe(pdf);
    expect(extrairBase64DoPayload({ base64: pdf })).toBe(pdf);
  });

  it("remove o prefixo data:...;base64,", () => {
    expect(extrairBase64DoPayload({ base64: `data:application/pdf;base64,${pdf}` })).toBe(pdf);
  });

  it("devolve null quando não há arquivo (não inventa comprovante)", () => {
    expect(extrairBase64DoPayload(null)).toBeNull();
    expect(extrairBase64DoPayload({ data: { message: { conversation: "oi" } } })).toBeNull();
    expect(extrairBase64DoPayload({ base64: "curto" })).toBeNull();
  });
});
