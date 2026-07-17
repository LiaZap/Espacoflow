import { consultarDisponibilidadeAgente, agendarReservaAgente } from "@/lib/reservas/agendar";
import { calcularPrecoAvulsa, precoAvulsaDiaDetalhe } from "@/lib/reservas/preco";
import { pacoteAtivoDoCliente, comprarPacoteAgente } from "@/lib/reservas/pacote-saldo";
import { saldoCreditoCliente } from "@/lib/reservas/credito";
import {
  listarReservasFuturasCliente,
  cancelarReservaAgente,
  alterarReservaAgente,
} from "@/lib/reservas/agente-recorrente";
import { registrarQualificacao, confirmarCadastroPlanilha } from "./onboarding";

export { FERRAMENTAS_AGENDA } from "./ferramentas-defs";


function num(v: unknown): number {
  return typeof v === "number" ? v : Number(String(v ?? ""));
}
function str(v: unknown): string {
  return typeof v === "string" ? v : String(v ?? "");
}
function bool(v: unknown): boolean {
  return v === true || v === "true" || v === 1 || v === "1";
}

/**
 * Executa uma ferramenta chamada pela Hígia e devolve o resultado (JSON string)
 * que volta para o modelo como tool_result. O `clienteId` é fixado pelo servidor.
 */
export async function executarFerramentaAgenda(
  nome: string,
  input: Record<string, unknown>,
  ctx: { clienteId: string }
): Promise<string> {
  try {
    if (nome === "calcular_preco") {
      const lista = Array.isArray(input.sessoes) ? (input.sessoes as Array<Record<string, unknown>>) : [];
      const sessoes = lista.map((s) => ({ data: str(s.data), horas: num(s.horas) }));
      if (sessoes.length === 0) return JSON.stringify({ ok: false, motivo: "sem sessões para calcular" });
      const r = calcularPrecoAvulsa(sessoes);
      if (!r.exato) {
        // Alguma duração não existe na tabela (ex.: 1h30) — NÃO inventar valor proporcional.
        const foraDaTabela = r.porDia
          .filter((d) => !d.exato)
          .map((d) => ({ data: d.data, horas: d.horas, opcoes: d.vizinhas ?? [] }));
        return JSON.stringify({
          ok: true,
          valor_exato: false,
          fora_da_tabela: foraDaTabela,
          instrucao:
            "Uma ou mais durações NÃO existem na tabela. NUNCA invente valor proporcional. Ofereça ao cliente as opções tabeladas mais próximas (ex.: '1h por R$40 ou 2h por R$65') e peça pra ele escolher uma delas.",
        });
      }
      return JSON.stringify({
        ok: true,
        valor_exato: true,
        total: r.total,
        por_dia: r.porDia,
        observacao:
          "Valores avulsos, calculados por dia. Informe o total e, se ajudar, o detalhe por dia. Não cite 'pacote' a menos que o cliente tenha/escolha um.",
      });
    }

    if (nome === "qualificar_cliente") {
      const r = await registrarQualificacao({
        clienteId: ctx.clienteId,
        tipoUso: input.tipo_uso != null ? str(input.tipo_uso) : undefined,
        profissao: input.profissao != null ? str(input.profissao) : undefined,
        pessoas: input.pessoas != null ? num(input.pessoas) : undefined,
        precisaMaca: bool(input.precisa_maca),
      });
      if (r.foraPerfil) {
        return JSON.stringify({
          ok: true,
          apto: false,
          fora_perfil: true,
          mensagem_para_o_cliente: r.mensagem,
          instrucao: "Cliente fora do perfil. Envie a mensagem acima com gentileza e NÃO informe preço nem agende.",
        });
      }
      if (!r.apto) return JSON.stringify({ ok: false, motivo: r.mensagem ?? "não foi possível qualificar" });
      return JSON.stringify({
        ok: true,
        apto: true,
        proximo_passo: "Cliente apto. Pode mostrar as fotos do espaço, informar o valor (calcular_preco) e seguir para o cadastro/aceite.",
      });
    }

    if (nome === "confirmar_cadastro") {
      const r = await confirmarCadastroPlanilha(ctx.clienteId);
      if (r.ok) {
        return JSON.stringify({
          ok: true,
          registrado: true,
          proximo_passo: "Cadastro e aceite confirmados pela planilha. Pode seguir para a disponibilidade e a reserva.",
        });
      }
      if (r.fallback) {
        // Planilha indisponível: NÃO registramos aceite sem prova (planilha é a prova).
        return JSON.stringify({
          ok: false,
          motivo: r.mensagem,
          instrucao:
            "Não consegui validar o cadastro agora. Peça ao cliente que confirme que preencheu o formulário com ESTE número de WhatsApp e tente confirmar_cadastro de novo. NÃO agende sem o cadastro validado.",
        });
      }
      return JSON.stringify({ ok: false, motivo: r.mensagem });
    }

    if (nome === "consultar_disponibilidade") {
      const r = await consultarDisponibilidadeAgente(str(input.data), str(input.hora), num(input.duracao_min), {
        precisaMesa: input.precisa_mesa != null ? bool(input.precisa_mesa) : undefined,
        excluir: Array.isArray(input.excluir) ? (input.excluir as unknown[]).map((x) => str(x)) : undefined,
      });
      if (r.erro) return JSON.stringify({ ok: false, motivo: r.erro });
      const livres = r.livres ?? [];
      if (livres.length === 0) {
        return JSON.stringify({
          ok: true,
          disponivel: false,
          aviso: "Nenhuma sala compatível livre nesse horário. Ofereça outro horário/dia. NÃO liste salas.",
        });
      }
      // Recomenda UMA sala por vez (nunca a lista toda, nunca comparar salas entre si).
      // Devolve o ID da sala recomendada: o LLM DEVE colá-lo em agendar_reserva.sala_id para
      // reservar EXATAMENTE a sala oferecida (senão o agendar re-escolheria e poderia divergir).
      return JSON.stringify({
        ok: true,
        disponivel: true,
        sala_recomendada: livres[0].nome,
        sala_recomendada_id: livres[0].id,
        tem_alternativa: livres.length > 1,
        instrucao:
          "Ofereça SOMENTE a sala_recomendada, uma por vez (ex.: 'a " +
          livres[0].nome +
          " está disponível, quer?'). Quando o cliente aceitar, chame agendar_reserva passando sala_id = sala_recomendada_id (reserva a MESMA sala oferecida). NUNCA liste várias salas nem compare salas entre si. Se o cliente recusar, chame consultar_disponibilidade de novo com excluir=['" +
          livres[0].nome +
          "'] para pegar a próxima compatível.",
      });
    }

    if (nome === "agendar_reserva") {
      const duracaoMin = num(input.duracao_min);
      const usarSaldo = bool(input.usar_saldo);

      // A sala reservada tem que ser EXATAMENTE a oferecida: exige sala_id (o
      // sala_recomendada_id devolvido por consultar_disponibilidade) OU o nome da sala escolhida
      // pelo cliente. Sem isso o agendar re-escolheria por conta própria e poderia divergir da
      // sala oferecida (Item 5). precisa_mesa sozinho NÃO basta mais.
      const temSalaId = input.sala_id != null && str(input.sala_id).trim().length > 0;
      const temSala = input.sala != null && str(input.sala).trim().length > 0;
      if (!temSalaId && !temSala) {
        return JSON.stringify({
          ok: false,
          motivo:
            "Não escolha a sala sozinha. Chame consultar_disponibilidade primeiro e, quando o cliente aceitar a sala oferecida, agende passando sala_id = sala_recomendada_id (ou o nome exato em sala).",
        });
      }

      // Pagamento por SALDO de pacote (recorrente): resolve o pacote ativo no servidor.
      let pacoteClienteId: string | undefined;
      if (usarSaldo) {
        const pac = await pacoteAtivoDoCliente(ctx.clienteId);
        if (!pac) {
          return JSON.stringify({ ok: false, motivo: "O cliente não tem pacote com saldo ativo — siga pelo Pix (avulsa)." });
        }
        pacoteClienteId = pac.id;
      }

      // Avulsa (Pix): só agenda durações que existem na tabela. 1h30 e afins → oferecer
      // as opções vizinhas, sem inventar valor proporcional (nem criar reserva sem preço).
      if (!usarSaldo) {
        const det = precoAvulsaDiaDetalhe(duracaoMin / 60);
        if (!det.exato) {
          const ops = (det.vizinhas ?? []).map((v) => `${v.horas}h por R$ ${v.valor}`).join(" ou ");
          return JSON.stringify({
            ok: false,
            motivo: `Essa duração não tem preço de tabela. Ofereça ao cliente: ${ops}. NÃO invente valor; peça pra ele escolher uma dessas durações e agende com ela.`,
          });
        }
      }

      let valor = input.valor != null ? num(input.valor) : undefined;
      if (!usarSaldo && (valor == null || valor <= 0)) {
        // Deriva o valor avulso no servidor quando o LLM não envia — sem isso o
        // pagamento nasce com valor null e TODA leitura de comprovante consta como
        // "divergente" no painel de inconsistências.
        const calc = calcularPrecoAvulsa([{ data: str(input.data), horas: duracaoMin / 60 }]);
        if (calc.total > 0) valor = calc.total;
      }

      const r = await agendarReservaAgente({
        clienteId: ctx.clienteId,
        data: str(input.data),
        hora: str(input.hora),
        duracaoMin,
        finalidade: input.finalidade ? str(input.finalidade) : undefined,
        salaId: input.sala_id != null && str(input.sala_id).trim() ? str(input.sala_id).trim() : undefined,
        salaNome: input.sala != null && str(input.sala).trim() ? str(input.sala).trim() : undefined,
        valor: usarSaldo ? undefined : valor,
        precisaMesa: input.precisa_mesa != null ? bool(input.precisa_mesa) : undefined,
        pacoteClienteId,
      });
      if ("erro" in r) return JSON.stringify({ ok: false, motivo: r.erro });

      const reservaInfo = { sala: r.salaNome, data: r.data, hora: r.hora, duracao_min: r.duracaoMin };

      if (r.creditoNaoAplicavel) {
        // Crédito é TUDO-OU-NADA: reserva MENOR que o saldo → NÃO aplica. Segue Pix cheio.
        return JSON.stringify({
          ok: true,
          reserva: reservaInfo,
          pago_por: "pix",
          credito_nao_aplicavel: true,
          credito_disponivel: r.creditoDisponivel,
          valor_a_pagar_pix: r.diferenca,
          proximo_passo: `O cliente tem R$ ${r.creditoDisponivel} de crédito, mas esta reserva (R$ ${r.diferenca}) é MENOR que o crédito — então o crédito NÃO pode ser usado aqui (ele é tudo-ou-nada). Avise com gentileza que o crédito só vale numa reserva de valor IGUAL OU MAIOR que R$ ${r.creditoDisponivel} (aí é usado por completo, e o Pix cobre a diferença) e sugira usar numa reserva assim (mais horas/outro dia). Para ESTA reserva, siga o Pix normal do valor cheio (R$ ${r.diferenca}): envie o [PIX] e peça o comprovante. NÃO diga que aplicou crédito.`,
        });
      }
      if (r.viaPacote) {
        return JSON.stringify({
          ok: true,
          reserva: reservaInfo,
          reserva_id: r.reaproveitado ? undefined : r.reservaId,
          pago_por: "pacote",
          saldo_restante: r.saldoApos,
          proximo_passo:
            "Reserva CONFIRMADA usando o saldo do pacote (NÃO peça Pix). Diga ao cliente que está confirmada e informe o saldo restante de horas.",
        });
      }
      if (r.viaCredito && r.jaPago) {
        // Crédito em R$ cobriu tudo → confirmada, sem Pix.
        return JSON.stringify({
          ok: true,
          reserva: reservaInfo,
          reserva_id: r.reaproveitado ? undefined : r.reservaId,
          pago_por: "credito",
          credito_aplicado: r.creditoAplicado,
          proximo_passo:
            "Reserva CONFIRMADA usando o CRÉDITO do cliente (NÃO peça Pix). Diga que aplicou o crédito e confirme data, horário e sala.",
        });
      }
      if (r.viaCredito && !r.jaPago) {
        // Crédito cobriu em PARTE (só ocorre quando a reserva >= saldo): consumiu o crédito
        // INTEIRO e o Pix cobre a diferença. Não há fracionamento nem saldo remanescente.
        return JSON.stringify({
          ok: true,
          reserva: reservaInfo,
          pago_por: "credito_parcial",
          credito_aplicado: r.creditoAplicado,
          diferenca_a_pagar_pix: r.diferenca,
          proximo_passo: `Apliquei TODO o crédito do cliente (R$ ${r.creditoAplicado}) nesta reserva. Ainda FALTA PAGAR R$ ${r.diferenca} por Pix (isso é o valor a pagar, NÃO é crédito): diga isso ao cliente, envie o Pix (marcador [PIX]) e peça o comprovante SÓ dessa diferença. Não peça o valor cheio. Esse R$ ${r.diferenca} nunca deve ser tratado como crédito disponível depois.`,
        });
      }
      if (r.jaPago) {
        return JSON.stringify({
          ok: true,
          reserva: reservaInfo,
          proximo_passo: "Essa reserva já está confirmada/paga — NÃO peça Pix. Só confirme data, horário e sala ao cliente.",
        });
      }
      return JSON.stringify({
        ok: true,
        reserva: reservaInfo,
        proximo_passo:
          "Horário SEGURADO. Confirme ao cliente a DATA, o HORÁRIO e A SALA (use reserva.sala — sempre diga em qual sala ficou). Diga que você já segurou o horário dele (NÃO use a palavra 'provisória'). Depois de agendar TODAS as sessões pedidas, envie o Pix (marcador [PIX]) e peça o comprovante aqui. Quando o comprovante chegar, o sistema confirma tudo automaticamente — não diga que a equipe confirma nem que já está pago.",
      });
    }

    if (nome === "consultar_saldo") {
      const pac = await pacoteAtivoDoCliente(ctx.clienteId);
      const credito = await saldoCreditoCliente(ctx.clienteId);
      if (!pac && credito <= 0) {
        return JSON.stringify({
          ok: true,
          tem_saldo: false,
          credito_reais: 0,
          mensagem: "Cliente sem pacote ativo e sem crédito — a reserva é avulsa (Pix).",
        });
      }
      return JSON.stringify({
        ok: true,
        tem_saldo: !!pac,
        ...(pac ? { pacote: pac.pacoteNome, horas_saldo: pac.horasSaldo, valido_ate: pac.validoAte } : {}),
        credito_reais: credito,
        proximo_passo:
          credito > 0
            ? `O cliente tem R$ ${credito} de crédito. Ele é TUDO-OU-NADA: só pode ser usado numa reserva de valor IGUAL OU MAIOR que R$ ${credito} (aí consome o crédito por completo e o Pix cobre a diferença). Em reserva de valor MENOR, o crédito NÃO é aplicado — avise e sugira usar numa reserva de valor >= R$ ${credito}.${pac ? " Há também pacote de horas: ofereça usar o saldo com usar_saldo=true." : ""}`
            : "Ofereça usar o saldo do pacote; se o cliente topar, agende com usar_saldo=true (sem Pix).",
      });
    }

    if (nome === "comprar_pacote") {
      const r = await comprarPacoteAgente(ctx.clienteId, str(input.pacote));
      if ("erro" in r) return JSON.stringify({ ok: false, motivo: r.erro });
      return JSON.stringify({
        ok: true,
        pacote: r.pacoteNome,
        valor: r.preco,
        horas: r.horas,
        proximo_passo: `Compra do ${r.pacoteNome} registrada (aguardando pagamento). Diga ao cliente o valor (R$ ${r.preco}) e que são ${r.horas}h de saldo com validade de 3 meses, envie o Pix (marcador [PIX]) e peça o comprovante. Quando o comprovante chegar, o sistema ATIVA o saldo automaticamente. NÃO trate como reserva de sala nem chame agendar_reserva.`,
      });
    }

    if (nome === "listar_minhas_reservas") {
      const lista = await listarReservasFuturasCliente(ctx.clienteId);
      return JSON.stringify({
        ok: true,
        reservas: lista,
        ...(lista.length === 0 ? { aviso: "O cliente não tem reservas futuras." } : {}),
      });
    }

    if (nome === "cancelar_reserva") {
      const r = await cancelarReservaAgente(ctx.clienteId, str(input.reserva_id));
      if (r.erro) return JSON.stringify({ ok: false, motivo: r.erro });
      return JSON.stringify({ ok: true, mensagem_para_o_cliente: r.mensagem, horas_creditadas: r.horasCreditadas });
    }

    if (nome === "alterar_reserva") {
      const r = await alterarReservaAgente(ctx.clienteId, str(input.reserva_id), {
        novaData: input.nova_data != null && str(input.nova_data).trim() ? str(input.nova_data).trim() : undefined,
        novaHora: input.nova_hora != null && str(input.nova_hora).trim() ? str(input.nova_hora).trim() : undefined,
        novaSalaNome: input.nova_sala != null && str(input.nova_sala).trim() ? str(input.nova_sala).trim() : undefined,
        novaDuracaoMin: input.nova_duracao_min != null ? num(input.nova_duracao_min) : undefined,
      });
      if (r.erro) return JSON.stringify({ ok: false, motivo: r.erro });
      return JSON.stringify({ ok: true, mensagem_para_o_cliente: r.mensagem });
    }

    return JSON.stringify({ ok: false, motivo: "ferramenta desconhecida" });
  } catch {
    return JSON.stringify({ ok: false, motivo: "erro interno ao executar a ferramenta" });
  }
}
