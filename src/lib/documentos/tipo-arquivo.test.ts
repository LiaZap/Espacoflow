import { describe, it, expect } from "vitest";
import { tipoRealDoArquivo } from "./tipo-arquivo";

const cab = (bytes: number[]) => Buffer.concat([Buffer.from(bytes), Buffer.alloc(16)]);

describe("tipoRealDoArquivo — tipo pelo CONTEÚDO, não pela extensão", () => {
  it("reconhece PDF (caso real: comprovante do PicPay salvo como .bin)", () => {
    expect(tipoRealDoArquivo(Buffer.concat([Buffer.from("%PDF-1.7"), Buffer.alloc(16)]))).toBe("application/pdf");
  });

  it("reconhece JPEG e PNG (PNG era enviado declarado como JPEG e a API recusava)", () => {
    expect(tipoRealDoArquivo(cab([0xff, 0xd8, 0xff, 0xe0]))).toBe("image/jpeg");
    expect(tipoRealDoArquivo(cab([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))).toBe("image/png");
  });

  it("reconhece GIF e WEBP", () => {
    expect(tipoRealDoArquivo(cab([0x47, 0x49, 0x46, 0x38]))).toBe("image/gif");
    expect(tipoRealDoArquivo(Buffer.concat([Buffer.from("RIFF"), Buffer.from([0, 0, 0, 0]), Buffer.from("WEBP"), Buffer.alloc(8)]))).toBe("image/webp");
  });

  it("devolve null para o que não reconhece (docx, zip, vazio) — não pode virar comprovante", () => {
    expect(tipoRealDoArquivo(cab([0x50, 0x4b, 0x03, 0x04]))).toBeNull(); // zip/docx
    expect(tipoRealDoArquivo(Buffer.from("texto qualquer aqui"))).toBeNull();
    expect(tipoRealDoArquivo(Buffer.alloc(0))).toBeNull();
  });
});
