/**
 * Lê a planilha de RESPOSTAS do formulário de cadastro (Google Forms → Sheets) para
 * validar que o cliente preencheu o cadastro e aceitou a política. Usa a MESMA OAuth do
 * Google (escopo spreadsheets.readonly — exige reconectar a conta uma vez).
 *
 * Config por ENV:
 *  - GOOGLE_CADASTRO_SHEET_ID  (obrigatório) — id da planilha de respostas.
 *  - GOOGLE_CADASTRO_SHEET_GID (opcional)    — gid da aba; default = aba do link do Felipe.
 */
import { obterAccessTokenGoogle } from "./calendar";

const SHEET_ID = process.env.GOOGLE_CADASTRO_SHEET_ID ?? "";
const SHEET_GID = process.env.GOOGLE_CADASTRO_SHEET_GID ?? "981424094";

/** Só dígitos. */
function digitos(s: string): string {
  return (s ?? "").replace(/\D/g, "");
}

/** Casa dois telefones por sufixo (ignora DDI/DDD/formatação). Min. 8 dígitos em comum. */
export function telefoneCasa(a: string, b: string): boolean {
  const da = digitos(a);
  const db = digitos(b);
  if (da.length < 8 || db.length < 8) return false;
  return da.slice(-8) === db.slice(-8);
}

/** Resposta afirmativa de aceite (checkbox/opção do Forms). */
export function ehAceite(valor: string): boolean {
  const v = (valor ?? "").trim().toLowerCase();
  if (!v) return false;
  return /sim|aceito|aceit|concord|de acordo|li e|autorizo|estou ciente/.test(v);
}

/** Acha o índice da coluna cujo cabeçalho contém algum dos termos. -1 se não achar. */
function acharColuna(header: string[], termos: string[]): number {
  const norm = (s: string) =>
    (s ?? "")
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase();
  return header.findIndex((h) => {
    const hn = norm(h);
    return termos.some((t) => hn.includes(t));
  });
}

/** Resolve os índices das colunas relevantes a partir do cabeçalho do formulário. */
export function resolverColunas(header: string[]): { iTel: number; iNome: number; iAceite: number } {
  return {
    iTel: acharColuna(header, ["telefone", "whatsapp", "celular", "telefon", "fone"]),
    iNome: acharColuna(header, ["nome completo", "nome"]),
    // "acordo"/"politica" casa "Está de acordo com a política de uso?". NÃO usar "uso"
    // (casaria "Frequência de uso" / "Telefone ... (Uso frequente)").
    iAceite: acharColuna(header, ["acordo", "politica", "polit", "concord", "aceit", "termo"]),
  };
}

interface LinhaCadastro {
  telefone: string;
  nome: string;
  aceitou: boolean;
}

/** Resolve a aba pelo gid e lê os valores (header + linhas) via Sheets API. */
async function lerRespostas(): Promise<{ header: string[]; linhas: string[][] } | null> {
  if (!SHEET_ID) return null;
  const token = await obterAccessTokenGoogle();
  if (!token) return null;
  const auth = { authorization: `Bearer ${token}` };

  // 1) Descobre o NOME da aba a partir do gid (a Sheets API usa o título no range).
  const metaRes = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}?fields=sheets(properties(sheetId,title))`,
    { headers: auth }
  );
  if (!metaRes.ok) return null;
  const meta = (await metaRes.json()) as { sheets?: { properties?: { sheetId?: number; title?: string } }[] };
  const aba =
    meta.sheets?.find((s) => String(s.properties?.sheetId) === SHEET_GID)?.properties?.title ??
    meta.sheets?.[0]?.properties?.title;
  if (!aba) return null;

  // 2) Lê os valores da aba.
  const range = encodeURIComponent(`${aba}!A1:Z5000`);
  const res = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${range}`,
    { headers: auth }
  );
  if (!res.ok) return null;
  const data = (await res.json()) as { values?: string[][] };
  const values = data.values ?? [];
  if (values.length === 0) return null;
  return { header: values[0], linhas: values.slice(1) };
}

/**
 * Verifica se há um cadastro do cliente (casado por telefone) com a política aceita.
 * Retorna { configurado:false } se a planilha não está configurada/legível (caller decide
 * o fallback). Best-effort: nunca lança.
 */
export async function verificarCadastro(
  telefone: string,
  nome?: string
): Promise<{ configurado: boolean; encontrado: boolean; aceitou: boolean; nomeCadastro?: string }> {
  try {
    const dados = await lerRespostas();
    if (!dados) return { configurado: false, encontrado: false, aceitou: false };

    const { header, linhas } = dados;
    const { iTel, iNome, iAceite } = resolverColunas(header);

    // Sem coluna de telefone não dá para casar com segurança.
    if (iTel < 0) return { configurado: true, encontrado: false, aceitou: false };

    // Procura a ÚLTIMA resposta que casa o telefone (a mais recente sobrescreve).
    let achou: LinhaCadastro | null = null;
    for (const row of linhas) {
      const tel = row[iTel] ?? "";
      if (!telefoneCasa(tel, telefone)) continue;
      achou = {
        telefone: tel,
        nome: iNome >= 0 ? row[iNome] ?? "" : "",
        aceitou: iAceite >= 0 ? ehAceite(row[iAceite] ?? "") : true, // sem coluna de aceite → preenchimento conta como aceite
      };
    }
    if (!achou) return { configurado: true, encontrado: false, aceitou: false };
    return { configurado: true, encontrado: true, aceitou: achou.aceitou, nomeCadastro: achou.nome || undefined };
  } catch {
    return { configurado: false, encontrado: false, aceitou: false };
  }
}

/** A integração de cadastro está configurada (env presente)? */
export function cadastroSheetConfigurado(): boolean {
  return Boolean(SHEET_ID);
}
