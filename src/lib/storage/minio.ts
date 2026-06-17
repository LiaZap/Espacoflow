import { Client } from "minio";

let cliente: Client | null = null;
let bucketOk = false;

export function minioConfigurado(): boolean {
  return Boolean(
    process.env.MINIO_ENDPOINT && process.env.MINIO_ACCESS_KEY && process.env.MINIO_SECRET_KEY
  );
}

function bucket(): string {
  return process.env.MINIO_BUCKET ?? "espaco-flow";
}

function getCliente(): Client {
  if (!cliente) {
    cliente = new Client({
      endPoint: process.env.MINIO_ENDPOINT ?? "localhost",
      port: Number(process.env.MINIO_PORT ?? 9000),
      useSSL: process.env.MINIO_USE_SSL === "true",
      accessKey: process.env.MINIO_ACCESS_KEY ?? "minio",
      secretKey: process.env.MINIO_SECRET_KEY ?? "minio12345",
    });
  }
  return cliente;
}

async function garantirBucket(): Promise<void> {
  if (bucketOk) return;
  const c = getCliente();
  const b = bucket();
  const existe = await c.bucketExists(b).catch(() => false);
  if (!existe) await c.makeBucket(b);

  // Garante leitura pública dos objetos SEMPRE (idempotente — mesmo se o bucket
  // já existia sem a política), para servir os arquivos por URL.
  const policy = {
    Version: "2012-10-17",
    Statement: [
      {
        Effect: "Allow",
        Principal: { AWS: ["*"] },
        Action: ["s3:GetObject"],
        Resource: [`arn:aws:s3:::${b}/*`],
      },
    ],
  };
  await c.setBucketPolicy(b, JSON.stringify(policy)).catch(() => undefined);
  bucketOk = true;
}

/** Sobe um arquivo e devolve a URL pública. */
export async function uploadArquivo(
  chave: string,
  conteudo: Buffer,
  contentType: string
): Promise<string> {
  await garantirBucket();
  await getCliente().putObject(bucket(), chave, conteudo, conteudo.length, {
    "Content-Type": contentType,
  });
  return urlPublica(chave);
}

export function urlPublica(chave: string): string {
  const base =
    process.env.MINIO_PUBLIC_URL ??
    `http://${process.env.MINIO_ENDPOINT ?? "localhost"}:${process.env.MINIO_PORT ?? 9000}/${bucket()}`;
  return `${base.replace(/\/$/, "")}/${chave}`;
}
