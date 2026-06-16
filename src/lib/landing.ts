/** Conteúdo da landing pública do Espaço Flow. */

// Número oficial do FLOW (WhatsApp do contato do briefing). Ajuste se mudar.
export const WHATSAPP_NUMERO = "5561992499268";

export function linkWhatsapp(mensagem: string): string {
  return `https://wa.me/${WHATSAPP_NUMERO}?text=${encodeURIComponent(mensagem)}`;
}

export const RECURSOS = [
  { titulo: "Salas climatizadas", desc: "Ambiente confortável com isolamento acústico." },
  { titulo: "Poltronas reclináveis", desc: "Conforto para atendimentos e sessões." },
  { titulo: "Wi-Fi de alta qualidade", desc: "Internet rápida e estável o tempo todo." },
  { titulo: "Recepção", desc: "Recebemos os clientes dos profissionais." },
  { titulo: "07h–23h, todos os dias", desc: "Inclusive feriados, sempre mediante reserva." },
  { titulo: "Estacionamento próximo", desc: "Estacionamento público nas redondezas." },
];

export const FAQ = [
  {
    q: "Como funciona a reserva?",
    a: "Você escolhe dia, horário e duração (mínimo 1h, em intervalos de 30 min), confirma a disponibilidade, faz o cadastro, aceita a política de uso e paga via Pix enviando o comprovante.",
  },
  {
    q: "Qual a política de cancelamento?",
    a: "Cancelamento com no mínimo 12h de antecedência vira crédito válido por 60 dias. Fora desse prazo não gera crédito.",
  },
  {
    q: "Quantas pessoas cabem na sala?",
    a: "Uso individual ou reuniões com até 3 pessoas.",
  },
  {
    q: "Quais as formas de pagamento?",
    a: "Exclusivamente via Pix, com envio do comprovante no WhatsApp.",
  },
  {
    q: "Funciona em feriados?",
    a: "Sim, todos os dias das 07h às 23h, sempre mediante reserva e disponibilidade da agenda.",
  },
];

/**
 * Galeria de espaços (fotos reais). Salve os arquivos em public/salas/ com estes
 * nomes — fotos ausentes simplesmente não aparecem (degrada com elegância).
 */
export const ESPACOS = [
  { src: "/salas/sala-01.jpg", titulo: "Sala 01", desc: "Privativa e climatizada, com poltrona reclinável." },
  { src: "/salas/sala-02.jpg", titulo: "Sala 02", desc: "Reservada e silenciosa, ideal para atendimentos." },
  { src: "/salas/sala-03.jpg", titulo: "Sala 03", desc: "Ampla, com poltrona e mesa de trabalho." },
  { src: "/salas/sala-04.jpg", titulo: "Sala 04", desc: "Privativa, perfeita para sessões e reuniões." },
  { src: "/salas/lounge.jpg", titulo: "Lounge & recepção", desc: "Parede verde e ambiente acolhedor para receber." },
  { src: "/salas/ambiente.jpg", titulo: "Ambiente Flow", desc: "Conforto, identidade e bom gosto em cada detalhe." },
];
