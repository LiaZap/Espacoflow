import { fileURLToPath } from "node:url";
import { dirname } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // Há outro lockfile em C:\Users\Paulo — fixa a raiz neste projeto.
  outputFileTracingRoot: __dirname,
  // libs Node com require dinâmico / deps opcionais — externaliza (não empacota).
  serverExternalPackages: ["bullmq", "mongodb", "minio"],
  experimental: {
    serverActions: {
      bodySizeLimit: "5mb",
    },
  },
};

export default nextConfig;
