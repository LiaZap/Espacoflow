/**
 * Só dígitos, SEM o "0" de tronco. Número BR nunca começa com 0 — o 0 é só prefixo de discagem
 * (ex.: cliente digita "061 99..." no formulário). Sem tirar, "061..." viraria DDD "06" (errado)
 * e não casaria com o mesmo número no formato 55+DDD (foi o caso da Samira).
 */
function digitos(s: string): string {
  const d = (s ?? "").replace(/\D/g, "");
  return d.startsWith("0") ? d.replace(/^0+/, "") : d;
}

/**
 * Variantes canônicas de um telefone BR, para casar o MESMO número entre registros com/sem o
 * 9º dígito e com/sem DDI (55). Ex.: "5548996XXYYZZ" gera as formas com/sem 55 e com/sem o 9.
 * Usado no lookup do cliente para reencontrar o registro certo (ex.: importado da planilha no
 * formato 55+DDD+9XXXX x criado pelo WhatsApp sem o 9) e NÃO criar duplicado.
 */
export function variantesTelefoneBR(raw: string): string[] {
  const d = digitos(raw);
  let local = d;
  if (local.startsWith("55") && (local.length === 12 || local.length === 13)) local = local.slice(2);
  const ddd = local.slice(0, 2);
  const num = local.slice(2);
  const v = new Set<string>();
  const add = (n: string) => {
    if (n.length >= 8) {
      v.add(`55${ddd}${n}`);
      v.add(`${ddd}${n}`);
      v.add(`0${ddd}${n}`); // casa registros gravados com o "0" de tronco (ex.: "061 99...")
    }
  };
  if (ddd.length === 2 && num.length >= 8) {
    add(num);
    // Variante do 9º dígito SÓ para faixa de CELULAR (1º dígito 6-9). Um FIXO de 8 dígitos
    // (começa 2-5) NÃO gera variante-9, senão casaria o celular de outra pessoa (colisão).
    if (num.length === 8 && /^[6-9]/.test(num)) add(`9${num}`); // celular sem 9º → com
    if (num.length === 9 && num.startsWith("9")) add(num.slice(1)); // com 9º → sem
  }
  if (d) v.add(d); // a forma crua original sempre entra
  return [...v].filter(Boolean);
}

/**
 * Forma canônica para GRAVAR um cliente novo vindo do WhatsApp: 55 + DDD + número com 9º dígito
 * (todo WhatsApp é celular). Só usada em INSERT novo — nunca reescreve registros existentes
 * (evita colisão com o UNIQUE(telefone)). Formato inesperado → devolve os dígitos crus.
 */
export function canonicalTelefoneBR(raw: string): string {
  const d = digitos(raw);
  const local = d.startsWith("55") && (d.length === 12 || d.length === 13) ? d.slice(2) : d;
  const ddd = local.slice(0, 2);
  let num = local.slice(2);
  if (ddd.length !== 2 || num.length < 8) return d;
  // Só canoniza para celular (prepend 9) na faixa móvel; fixo (começa 2-5) fica como está.
  if (num.length === 8 && /^[6-9]/.test(num)) num = `9${num}`;
  return `55${ddd}${num}`;
}
