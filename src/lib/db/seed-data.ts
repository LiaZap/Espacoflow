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

export const SALAS_SEED = [
  { nome: "Sala 01", prioridade_alocacao: 1 },
  { nome: "Sala 02", prioridade_alocacao: 2 },
  { nome: "Sala 03", prioridade_alocacao: 3 },
  { nome: "Sala 04", prioridade_alocacao: 4 },
].map((s) => ({
  ...s,
  tipo: "privativa",
  capacidade: 3,
  ativa: true,
  reservavel_publicamente: true,
  so_sob_pedido: false,
  preco_hora: "40.00",
  descricao: "Sala privativa climatizada, isolamento acústico, poltronas reclináveis e Wi-Fi.",
}));

export const HORARIO_FUNCIONAMENTO = { abre_em: "07:00:00", fecha_em: "23:00:00" };

export const PACOTES_SEED = [
  // Avulsa (com desconto progressivo no dia, calculado por calcular_preco) + pacotes reais (10/20/40h).
  // NÃO existem pacotes de 2h/4h — 2h/4h são horas avulsas com desconto.
  { nome: "Hora avulsa", tipo: "avulsa", horas_incluidas: "1", validade_dias: 1, preco: "40.00", descricao: "Locação avulsa de sala privativa por 1 hora (desconto a partir de 2h no mesmo dia)." },
  { nome: "Pacote 10 horas", tipo: "pacote", horas_incluidas: "10", validade_dias: 60, preco: "305.00", descricao: "Saldo de horas para uso recorrente." },
  { nome: "Pacote 20 horas", tipo: "pacote", horas_incluidas: "20", validade_dias: 60, preco: "585.00", descricao: "Pacote intermediário com maior economia por hora." },
  { nome: "Pacote 40 horas", tipo: "pacote", horas_incluidas: "40", validade_dias: 60, preco: "1105.00", descricao: "Maior desconto progressivo entre os pacotes." },
  { nome: "Plano mensal 4h/semana", tipo: "plano_mensal", horas_incluidas: "16", validade_dias: 30, preco: "455.00", descricao: "Presença semanal fixa com previsibilidade." },
  { nome: "Diária", tipo: "diaria", horas_incluidas: "16", validade_dias: 1, preco: "235.00", descricao: "Uso da sala por período diário, conforme disponibilidade." },
];

/** Preços que a Hígia pode informar (após validar a necessidade). Avulsa progressiva
 * é calculada por calcular_preco; aqui ficam as referências exibidas. */
export const PRECOS_SEED = [
  { descricao: "Hora avulsa", valor: "40.00", unidade: "hora", ordem: 1 },
  { descricao: "2 horas no mesmo dia (desconto)", valor: "65.00", unidade: "no dia", ordem: 2 },
  { descricao: "Pacote 10h", valor: "305.00", unidade: "pacote", ordem: 4 },
  { descricao: "Pacote 20h", valor: "585.00", unidade: "pacote", ordem: 5 },
  { descricao: "Pacote 40h", valor: "1105.00", unidade: "pacote", ordem: 6 },
  { descricao: "Plano mensal 4h/semana", valor: "455.00", unidade: "mes", ordem: 7 },
  { descricao: "Diária", valor: "235.00", unidade: "diaria", ordem: 8 },
];

/** Base de conhecimento oficial injetada no prompt da Hígia em runtime. */
export const BASE_CONHECIMENTO_SEED = [
  { categoria: "estrutura", titulo: "Estrutura do espaço", prioridade: 1, conteudo: "Salas privativas climatizadas com isolamento acústico, poltronas reclináveis, Wi-Fi de alta qualidade, recepção para receber os clientes dos profissionais e estacionamento público próximo. Uso individual ou reuniões com até 3 pessoas." },
  { categoria: "horario", titulo: "Funcionamento", prioridade: 1, conteudo: "Todos os dias, inclusive feriados, das 07h às 23h, sempre mediante reserva e disponibilidade da agenda." },
  { categoria: "localizacao", titulo: "Localização", prioridade: 2, conteudo: "Sudoeste, Brasília – DF." },
  { categoria: "reserva", titulo: "Regras de reserva e pontualidade", prioridade: 1, conteudo: "Reserva mínima de 1 hora; agenda em intervalos de 30 minutos. Pontualidade rigorosa, sem tolerância para atrasos. Permanência além do horário é cobrada automaticamente como 1 hora adicional." },
  { categoria: "cancelamento", titulo: "Cancelamento e reagendamento", prioridade: 1, conteudo: "Cancelamento com no mínimo 12 horas de antecedência vira crédito com validade de 60 dias. Fora desse prazo, não gera crédito. Reagendamento sujeito à disponibilidade." },
  { categoria: "pagamento", titulo: "Pagamento", prioridade: 1, conteudo: "Exclusivamente via Pix. O cliente envia a cópia do comprovante no WhatsApp; a confirmação do pagamento é feita pela equipe interna (nunca pela Hígia)." },
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
