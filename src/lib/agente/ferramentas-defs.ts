/** Definições das ferramentas (formato tool use da Anthropic) que a Hígia pode chamar. */
export const FERRAMENTAS_AGENDA = [
  {
    name: "calcular_preco",
    description:
      "Calcula o valor TOTAL de reservas avulsas, somando POR DIA (cada dia separado). SEMPRE use esta ferramenta para informar qualquer valor — nunca calcule de cabeça. NÃO aplique pacotes (10h/20h/40h) aqui: pacote só quando o cliente já tem ou escolhe um.",
    input_schema: {
      type: "object",
      properties: {
        sessoes: {
          type: "array",
          description: "Uma entrada por sessão/uso. Sessões do mesmo dia são somadas automaticamente.",
          items: {
            type: "object",
            properties: {
              data: { type: "string", description: "Data da sessão (AAAA-MM-DD)" },
              horas: { type: "number", description: "Duração em horas (ex.: 1, 1.5, 2)" },
            },
            required: ["data", "horas"],
          },
        },
      },
      required: ["sessoes"],
    },
  },
  {
    name: "qualificar_cliente",
    description:
      "Registra a qualificação de perfil de um cliente NOVO. Chame UMA VEZ, depois de coletar as respostas e ANTES de informar preço ou agendar. Se precisa_maca=true ou pessoas>3, o cliente fica FORA do perfil (a ferramenta retorna a mensagem a enviar). NÃO chame para cliente recorrente.",
    input_schema: {
      type: "object",
      properties: {
        tipo_uso: { type: "string", description: "Tipo de uso (atendimento, reunião, mentoria, consultoria...)" },
        profissao: { type: "string", description: "Profissão/especialidade do cliente (ex.: psicólogo, advogado)" },
        pessoas: { type: "integer", description: "Quantas pessoas vão usar a sala (máximo 3)" },
        precisa_maca: {
          type: "boolean",
          description: "true se o cliente precisa de maca, procedimento corporal, licença sanitária ou endereço fiscal",
        },
      },
      required: ["pessoas", "precisa_maca"],
    },
  },
  {
    name: "confirmar_cadastro",
    description:
      "ÚNICA forma de registrar o aceite da política de um cliente NOVO: valida o cadastro lendo a planilha do formulário (casa pelo telefone). Use quando o cliente disser que preencheu o formulário. Se não encontrar, peça para ele confirmar o número de WhatsApp usado no formulário. O aceite NÃO pode ser registrado só porque o cliente diz 'aceito' no chat — ele precisa preencher o formulário.",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "consultar_disponibilidade",
    description:
      "Verifica a disponibilidade e devolve UMA sala recomendada por vez (compatível com a necessidade de mesa). SEMPRE use antes de oferecer ou marcar um horário. NUNCA afirme disponibilidade sem checar. Passe precisa_mesa; se o cliente recusar a sala oferecida, chame de novo com essa sala em `excluir` para pegar a próxima.",
    input_schema: {
      type: "object",
      properties: {
        data: { type: "string", description: "Data no formato AAAA-MM-DD" },
        hora: { type: "string", description: "Hora de início no formato HH:MM (24h)" },
        duracao_min: {
          type: "integer",
          description: "Duração em minutos (mínimo 60, em múltiplos de 30)",
        },
        precisa_mesa: {
          type: "boolean",
          description:
            "true se o cliente precisa de mesa/apoio para notebook — o sistema NÃO oferece salas sem mesa (ex.: Sala 02). Sempre informe conforme a necessidade já dita pelo cliente.",
        },
        excluir: {
          type: "array",
          items: { type: "string" },
          description: "Nomes de salas que o cliente já recusou (ex.: ['Sala 03']) — para o sistema recomendar a próxima.",
        },
      },
      required: ["data", "hora", "duracao_min"],
    },
  },
  {
    name: "agendar_reserva",
    description:
      "Cria uma reserva PROVISÓRIA (hold) para o cliente desta conversa, pendente de Pix. Chame UMA VEZ POR SESSÃO (cada horário/dia é uma reserva separada). Use depois de checar a disponibilidade e o cliente concordar. Para cliente NOVO, só funciona se você já tiver chamado qualificar_cliente e o cadastro/aceite já estiver confirmado (confirmar_cadastro). Se o cliente ESCOLHEU uma sala específica, informe em `sala`; senão o sistema escolhe pela necessidade de mesa. A confirmação é automática quando o cliente enviar o comprovante (não depende da equipe).",
    input_schema: {
      type: "object",
      properties: {
        data: { type: "string", description: "Data no formato AAAA-MM-DD" },
        hora: { type: "string", description: "Hora de início no formato HH:MM (24h)" },
        duracao_min: { type: "integer", description: "Duração em minutos (mínimo 60, múltiplos de 30)" },
        finalidade: {
          type: "string",
          description: "Para que o cliente vai usar a sala (ex.: atendimento, reunião, mentoria)",
        },
        sala_id: {
          type: "string",
          description:
            "ID da sala a reservar — cole aqui o `sala_recomendada_id` que consultar_disponibilidade devolveu, assim que o cliente aceitar a sala oferecida. Garante que a reserva sai EXATAMENTE na sala que você ofereceu. Use este campo no fluxo normal.",
        },
        sala: {
          type: "string",
          description:
            "Alternativa ao sala_id: nome EXATO da sala quando o cliente pede uma sala específica pelo nome (ex.: 'Sala 03'). Prefira sala_id (do consultar_disponibilidade). É obrigatório informar sala_id OU sala — o sistema NÃO escolhe a sala sozinho.",
        },
        precisa_mesa: {
          type: "boolean",
          description:
            "Informe em consultar_disponibilidade para recomendar a sala certa. Em agendar_reserva não decide mais a sala sozinho (use sala_id/sala): true = precisa de mesa/apoio p/ notebook; false = terapia de conversa (psicólogo → sala sem mesa).",
        },
        usar_saldo: {
          type: "boolean",
          description:
            "true para pagar com o SALDO do pacote do cliente (recorrente com pacote ativo) — a reserva já fica confirmada, SEM Pix. Só use se a memória indicar pacote ativo e o cliente concordar em usar o saldo.",
        },
        valor: {
          type: "number",
          description:
            "Valor TOTAL combinado da reserva, em reais (conforme a tabela de preços). Usado para validar o comprovante de Pix. Ignorado quando usar_saldo=true.",
        },
      },
      required: ["data", "hora", "duracao_min"],
    },
  },
  {
    name: "consultar_saldo",
    description:
      "Consulta o saldo de pacote ativo do cliente desta conversa (horas restantes e validade). Use quando um cliente recorrente quiser reservar para saber se pode usar o saldo do pacote em vez de Pix.",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "comprar_pacote",
    description:
      "Registra a COMPRA de um pacote de horas (10h/20h/40h) pelo cliente desta conversa. Use quando o cliente disser que quer COMPRAR/adquirir um pacote de horas. Cria o pacote como PENDENTE de pagamento; depois você envia o Pix ([PIX]) e pede o comprovante — quando ele chegar, o saldo é ATIVADO automaticamente. NÃO confunda com reservar uma sala: comprar pacote NÃO é agendar_reserva.",
    input_schema: {
      type: "object",
      properties: {
        pacote: { type: "string", description: "Qual pacote o cliente quer: '10h', '20h' ou '40h' (ou o nome do pacote)." },
      },
      required: ["pacote"],
    },
  },
  {
    name: "listar_minhas_reservas",
    description:
      "Lista as reservas FUTURAS do cliente desta conversa (id, sala, data, hora). Use antes de cancelar/alterar, para saber QUAL reserva o cliente quer mexer (e pegar o reserva_id).",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "cancelar_reserva",
    description:
      "Cancela uma reserva do cliente desta conversa. Use o reserva_id de listar_minhas_reservas. Se o cancelamento for dentro do prazo e a reserva foi paga por pacote, as horas voltam ao saldo automaticamente.",
    input_schema: {
      type: "object",
      properties: {
        reserva_id: { type: "string", description: "ID da reserva a cancelar (de listar_minhas_reservas)" },
      },
      required: ["reserva_id"],
    },
  },
  {
    name: "alterar_reserva",
    description:
      "Remarca a data/hora, troca a SALA E/OU muda a DURAÇÃO de uma reserva do cliente. Use o reserva_id de listar_minhas_reservas. Verifica disponibilidade/conflito antes de mover. Para só trocar de sala mantendo o horário, informe apenas nova_sala. Se o cliente pedir mais ou menos horas, use nova_duracao_min — quando a reserva foi paga por PACOTE o saldo é recalculado automaticamente (devolve/debita horas); reserva avulsa paga por Pix/crédito não muda de duração (oriente cancelar e refazer). VOCÊ resolve isso sozinha — nunca escale troca de sala/duração para a equipe.",
    input_schema: {
      type: "object",
      properties: {
        reserva_id: { type: "string", description: "ID da reserva a alterar (de listar_minhas_reservas)" },
        nova_data: { type: "string", description: "Nova data AAAA-MM-DD (omita para manter a data atual)" },
        nova_hora: { type: "string", description: "Novo horário de início HH:MM 24h (omita para manter o horário atual)" },
        nova_sala: {
          type: "string",
          description: "Nome da sala destino (ex.: 'Sala 03') quando o cliente quer TROCAR de sala. Omita para manter a mesma sala.",
        },
        nova_duracao_min: {
          type: "integer",
          description:
            "Nova duração em MINUTOS (mínimo 60, em múltiplos de 30; ex.: 2h = 120). Omita para manter a duração atual.",
        },
      },
      required: ["reserva_id"],
    },
  },
] as const;
