/**
 * Dados-semente do Espaço Flow (a partir do briefing e da política de uso oficial).
 * Usados por src/lib/db/seed.ts. Valores em reais como string (coluna numeric).
 */

export const OWNER_SEED = {
  nome: "Felipe Geraldo Torres",
  email: process.env.SEED_OWNER_EMAIL ?? "owner@espacoflow.com.br",
  // Senha padrão de bootstrap — TROQUE no primeiro acesso.
  senha: process.env.SEED_OWNER_SENHA ?? "FlowOwner@2026",
  role: "owner" as const,
  telefone: "61992499268",
};

/** Instrução de acesso de exemplo (Felipe ajusta as demais salas no painel). */
export const ACESSO_EXEMPLO_SALA_01 =
  "Ao chegar na sala 135, pressione a fechadura eletrônica por uns 2 segundos (as luzes do painel acendem) e digite a senha: 0135#";

export const SALAS_SEED = [
  // Sala 02 NÃO tem mesa (destino padrão de psicólogo/terapia de conversa). As demais
  // têm mesa de apoio (p/ quem precisa de notebook etc.).
  { nome: "Sala 01", prioridade_alocacao: 1, tem_mesa: true, codigo_acesso: ACESSO_EXEMPLO_SALA_01 as string | null },
  { nome: "Sala 02", prioridade_alocacao: 2, tem_mesa: false, codigo_acesso: null as string | null },
  { nome: "Sala 03", prioridade_alocacao: 3, tem_mesa: true, codigo_acesso: null as string | null },
  { nome: "Sala 04", prioridade_alocacao: 4, tem_mesa: true, codigo_acesso: null as string | null },
].map((s) => ({
  ...s,
  tipo: "privativa",
  capacidade: 3,
  ativa: true,
  reservavel_publicamente: true,
  so_sob_pedido: false,
  preco_hora: "40.00",
  descricao: s.tem_mesa
    ? "Sala privativa climatizada, isolamento acústico, poltronas, mesa de apoio e Wi-Fi."
    : "Sala privativa climatizada, isolamento acústico, poltronas reclináveis (sem mesa) e Wi-Fi.",
}));

export const HORARIO_FUNCIONAMENTO = { abre_em: "07:00:00", fecha_em: "23:00:00" };

export const PACOTES_SEED = [
  // Avulsa (com desconto progressivo no dia, calculado por calcular_preco) + pacotes reais (10/20/40h).
  // NÃO existem pacotes de 2h/4h — 2h/4h são horas avulsas com desconto.
  { nome: "Hora avulsa", tipo: "avulsa", horas_incluidas: "1", validade_dias: 1, preco: "40.00", descricao: "Locação avulsa de sala privativa por 1 hora (desconto a partir de 2h no mesmo dia)." },
  { nome: "Pacote 10 horas", tipo: "pacote", horas_incluidas: "10", validade_dias: 90, preco: "305.00", descricao: "Saldo de 10h, válido por 3 meses a partir do pagamento." },
  { nome: "Pacote 20 horas", tipo: "pacote", horas_incluidas: "20", validade_dias: 90, preco: "585.00", descricao: "Saldo de 20h, válido por 3 meses a partir do pagamento." },
  { nome: "Pacote 40 horas", tipo: "pacote", horas_incluidas: "40", validade_dias: 90, preco: "1105.00", descricao: "Saldo de 40h, válido por 3 meses a partir do pagamento." },
  { nome: "Plano mensal 4h/semana", tipo: "plano_mensal", horas_incluidas: "16", validade_dias: 30, preco: "455.00", descricao: "Presença semanal fixa com previsibilidade." },
  { nome: "Diária", tipo: "diaria", horas_incluidas: "16", validade_dias: 1, preco: "235.00", descricao: "Uso da sala por período diário, conforme disponibilidade." },
];

/** Preços que a Hígia pode informar (após validar a necessidade). Avulsa progressiva
 * é calculada por calcular_preco; aqui ficam as referências exibidas. */
export const PRECOS_SEED = [
  { descricao: "Hora avulsa", valor: "40.00", unidade: "hora", ordem: 1 },
  { descricao: "2 horas", valor: "65.00", unidade: "no dia", ordem: 2 },
  { descricao: "Período de 4h (meia diária)", valor: "125.00", unidade: "no dia", ordem: 3 },
  { descricao: "Pacote 10h", valor: "305.00", unidade: "pacote (3 meses)", ordem: 4 },
  { descricao: "Pacote 20h", valor: "585.00", unidade: "pacote (3 meses)", ordem: 5 },
  { descricao: "Pacote 40h", valor: "1105.00", unidade: "pacote (3 meses)", ordem: 6 },
  { descricao: "Mensal fixo (1x/semana, 4h)", valor: "455.00", unidade: "mes", ordem: 7 },
  { descricao: "Diária (8h às 19h)", valor: "235.00", unidade: "diaria", ordem: 8 },
];

/** Base de conhecimento oficial injetada no prompt da Hígia em runtime. */
export const BASE_CONHECIMENTO_SEED = [
  { categoria: "estrutura", titulo: "Estrutura do espaço", prioridade: 1, conteudo: "Salas privativas climatizadas com isolamento acústico, poltronas reclináveis, Wi-Fi de alta qualidade, recepção para receber os clientes dos profissionais e estacionamento público próximo. Uso individual ou reuniões com até 3 pessoas. A Sala 02 não tem mesa (ideal para terapia de conversa); as demais têm mesa de apoio." },
  { categoria: "internet", titulo: "Internet / atendimento online", prioridade: 1, conteudo: "Sim, há Wi-Fi de alta qualidade em todas as salas, adequado para atendimento online por vídeo (telepsicologia, reuniões, mentorias). Quem atende online costuma preferir uma sala com mesa para apoiar o notebook." },
  { categoria: "horario", titulo: "Funcionamento", prioridade: 1, conteudo: "Todos os dias, inclusive feriados, das 07h às 23h, sempre mediante reserva e disponibilidade da agenda." },
  { categoria: "localizacao", titulo: "Localização", prioridade: 2, conteudo: "Sudoeste, Brasília – DF." },
  { categoria: "reserva", titulo: "Regras de reserva e pontualidade", prioridade: 1, conteudo: "Reserva mínima de 1 hora; agenda em intervalos de 30 minutos. Pontualidade rigorosa, sem tolerância para atrasos. Permanência além do horário é cobrada automaticamente como 1 hora adicional." },
  { categoria: "cancelamento", titulo: "Cancelamento e reagendamento", prioridade: 1, conteudo: "Cancelamento com no mínimo 12 horas de antecedência vira crédito com validade de 60 dias. Fora desse prazo, não gera crédito. Reagendamento sujeito à disponibilidade." },
  { categoria: "pagamento", titulo: "Pagamento", prioridade: 1, conteudo: "Exclusivamente via Pix. O cliente faz o Pix e envia o comprovante aqui no WhatsApp; assim que chega, o sistema confirma a reserva automaticamente." },
  { categoria: "cadastro", titulo: "Cadastro e aceite da política", prioridade: 1, conteudo: "Antes da primeira reserva, o cliente novo deve preencher o cadastro e aceitar a política de uso pelo formulário: https://docs.google.com/forms/d/e/1FAIpQLSdKhPouX6I5ll3l-o-vVREGD7oA4lAt8t7XuZLAzni8oWAYLA/viewform" },
  { categoria: "fora_perfil", titulo: "O que o FLOW não oferece", prioridade: 1, conteudo: "Sem maca e sem procedimentos corporais; sem endereço fiscal; sem reuniões com mais de 3 pessoas; sem serviços que exijam estrutura ou licença sanitária específica. Nesses casos o cliente está fora do perfil." },
  { categoria: "encerramento", titulo: "Ao encerrar o uso da sala", prioridade: 2, conteudo: "Desligar o ar-condicionado, organizar mesa e cadeiras, apagar as luzes, ajustar a tarja da porta para LIVRE e segurar a porta por 3 segundos pelo lado de fora para acionar a fechadura." },
  { categoria: "objetos", titulo: "Objetos esquecidos", prioridade: 3, conteudo: "O FLOW não se responsabiliza por objetos esquecidos. Caso esqueça algo, avisar o quanto antes." },
  { categoria: "politica", titulo: "Aceite da política", prioridade: 2, conteudo: "O aceite integral da política de uso é obrigatório no cadastro. Sem aceite, a reserva não é confirmada." },
  { categoria: "contato", titulo: "Site e redes", prioridade: 3, conteudo: "Site: coworkingespacoflow.com.br | Instagram: @coworkingespacoflow." },
];

export const POLITICA_CANCELAMENTO_SEED = {
  janela_horas: 12,
  percentual_devolvido: 100,
  validade_credito_dias: 60,
};

/** Mensagem de boas-vindas/onboarding (pós-reserva confirmada). {{SALA}} e {{ACESSO}}. */
export const MSG_BOAS_VINDAS_SEED = `*Seja muito bem-vinda(o) ao Espaço Flow!* 🌸

Que alegria ter você aqui! Sua reserva da {{SALA}} está confirmada. Desejamos um atendimento produtivo e tranquilo 🚀

{{ACESSO}}

Obs: use a sala reservada, de porta fechada. Não troque de sala sem a nossa confirmação — ela pode já estar locada. 🙏
Para abrir a fechadura por dentro, aperte o botão redondinho com o cadeadinho.

💧 Água: filtro na recepção.

Ao sair: desligue o ar-condicionado, deixe o display em LIVRE, apague as luzes e segure a porta fechada por fora uns 3 segundos até a fechadura travar 🙌

📶 Internet
3G — rede internetFlow3g, senha 1234flow
5G — rede flowcoworking, senha 1234flow

📍 Localização: https://maps.google.com/?cid=13531186749440921807`;
