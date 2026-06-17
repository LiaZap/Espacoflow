// Health check da infra (Mongo + MinIO). Uso: node --env-file=.env scripts/check-infra.mjs
import { MongoClient } from "mongodb";
import { Client } from "minio";

const mongo = new MongoClient(process.env.MONGO_URL);
await mongo.connect();
await mongo.db().collection("_health").insertOne({ ok: true, at: new Date() });
const n = await mongo.db().collection("_health").countDocuments();
console.log(`MONGO OK — db="${mongo.db().databaseName}" docs=_health:${n}`);
await mongo.close();

const mc = new Client({
  endPoint: process.env.MINIO_ENDPOINT,
  port: Number(process.env.MINIO_PORT ?? 9000),
  useSSL: process.env.MINIO_USE_SSL === "true",
  accessKey: process.env.MINIO_ACCESS_KEY,
  secretKey: process.env.MINIO_SECRET_KEY,
});
const bucket = process.env.MINIO_BUCKET ?? "espaco-flow";
if (!(await mc.bucketExists(bucket))) await mc.makeBucket(bucket);
const conteudo = Buffer.from("ok");
await mc.putObject(bucket, "_health.txt", conteudo, conteudo.length, { "Content-Type": "text/plain" });
console.log(`MINIO OK — bucket="${bucket}" objeto=_health.txt`);
