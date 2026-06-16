import { and, asc, eq } from "drizzle-orm";
import { Check } from "lucide-react";
import { db } from "@/lib/db";
import { agentePrecos } from "@/lib/db/schema/agente";
import { Button } from "@/components/ui/button";
import { LandingNavbar } from "@/components/landing/navbar";
import { LandingHero } from "@/components/landing/hero";
import { Reveal } from "@/components/landing/motion";
import { EspacosGallery } from "@/components/landing/espacos-gallery";
import { WhatsappFab } from "@/components/landing/whatsapp-fab";
import { RECURSOS, FAQ, linkWhatsapp } from "@/lib/landing";
import { formatarBRL } from "@/lib/utils";

// Lê preços do banco em runtime — não pré-renderizar no build (DB pode não existir no build).
export const dynamic = "force-dynamic";

const PASSOS: Array<[string, string, string]> = [
  ["1", "Escolha o plano", "Hora avulsa, pacote de horas, diária ou plano mensal."],
  ["2", "Reserve", "Pelo WhatsApp com a Hígia: dia, horário e duração."],
  ["3", "Faça check-in", "Pague via Pix, envie o comprovante e use a sala."],
];

export default async function LandingPage() {
  const precos = await db
    .select()
    .from(agentePrecos)
    .where(and(eq(agentePrecos.is_deleted, false), eq(agentePrecos.ativo, true)))
    .orderBy(asc(agentePrecos.ordem));

  return (
    <div className="flex min-h-screen flex-col">
      <LandingNavbar />
      <LandingHero />

      <section id="estrutura" className="container py-20">
        <Reveal>
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="font-display text-3xl font-semibold">Estrutura pensada para o seu trabalho</h2>
            <p className="mt-3 text-muted-foreground">
              Tudo o que um bom atendimento precisa — sem o custo de uma sala fixa.
            </p>
          </div>
        </Reveal>
        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {RECURSOS.map((r, i) => (
            <Reveal key={r.titulo} delay={i * 0.05}>
              <div className="group h-full rounded-lg border bg-card p-6 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-md">
                <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-md bg-primary/10 text-primary">
                  <Check className="h-5 w-5" />
                </div>
                <h3 className="font-medium">{r.titulo}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{r.desc}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      <section id="espacos" className="border-t bg-secondary/40 py-20">
        <div className="container">
          <Reveal>
            <div className="mx-auto max-w-2xl text-center">
              <h2 className="font-display text-3xl font-semibold">Conheça os espaços</h2>
              <p className="mt-3 text-muted-foreground">
                Salas privativas e um lounge acolhedor no coração do Sudoeste.
              </p>
            </div>
          </Reveal>
          <div className="mt-12">
            <EspacosGallery />
          </div>
        </div>
      </section>

      <section className="border-t py-20">
        <div className="container">
          <Reveal>
            <h2 className="text-center font-display text-3xl font-semibold">Como funciona</h2>
          </Reveal>
          <div className="mx-auto mt-12 grid max-w-4xl gap-6 sm:grid-cols-3">
            {PASSOS.map(([n, t, d], i) => (
              <Reveal key={n} delay={i * 0.08}>
                <div className="h-full rounded-lg border bg-card p-6 shadow-sm">
                  <div className="font-mono text-lg font-semibold text-accent-foreground/60">{n}</div>
                  <h3 className="mt-2 font-medium">{t}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">{d}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <section id="planos" className="container py-20">
        <Reveal>
          <div className="text-center">
            <h2 className="font-display text-3xl font-semibold">Planos e valores</h2>
            <p className="mt-3 text-muted-foreground">
              Desconto progressivo: a partir de 2 horas você já economiza.
            </p>
          </div>
        </Reveal>
        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {precos.map((p, i) => (
            <Reveal key={p.id} delay={i * 0.04}>
              <div className="flex h-full flex-col rounded-lg border bg-card p-6 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-md">
                <h3 className="font-medium">{p.descricao}</h3>
                <p className="mt-3 font-display text-3xl font-bold">
                  {formatarBRL(Math.round(Number(p.valor) * 100))}
                </p>
                <p className="font-mono text-xs text-muted-foreground">por {p.unidade}</p>
                <Button asChild variant="accent" size="sm" className="mt-5">
                  <a
                    href={linkWhatsapp(`Olá! Tenho interesse no plano "${p.descricao}".`)}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Reservar
                  </a>
                </Button>
              </div>
            </Reveal>
          ))}
        </div>
        <p className="mt-6 text-center text-xs text-muted-foreground">
          Uso individual ou reuniões com até 3 pessoas. Sem maca, procedimentos corporais ou endereço fiscal.
        </p>
      </section>

      <section id="faq" className="border-t bg-secondary/40 py-20">
        <div className="container mx-auto max-w-2xl">
          <Reveal>
            <h2 className="text-center font-display text-3xl font-semibold">Perguntas frequentes</h2>
          </Reveal>
          <div className="mt-10 space-y-3">
            {FAQ.map((f, i) => (
              <Reveal key={f.q} delay={i * 0.04}>
                <details className="group rounded-lg border bg-card p-5 shadow-sm">
                  <summary className="flex cursor-pointer items-center justify-between font-medium">
                    {f.q}
                    <span className="text-xl text-muted-foreground transition-transform duration-300 group-open:rotate-45">
                      +
                    </span>
                  </summary>
                  <p className="mt-3 text-sm text-muted-foreground">{f.a}</p>
                </details>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <section className="container py-20">
        <Reveal>
          <div className="overflow-hidden rounded-xl border bg-primary px-8 py-14 text-center text-primary-foreground shadow-lg">
            <h2 className="font-display text-3xl font-semibold sm:text-4xl">Agende uma visita ao Flow</h2>
            <p className="mx-auto mt-3 max-w-lg text-primary-foreground/80">
              Conheça o espaço e escolha a melhor opção para a sua rotina.
            </p>
            <Button asChild size="lg" variant="accent" className="mt-8">
              <a
                href={linkWhatsapp("Olá! Gostaria de agendar uma visita ao Espaço Flow.")}
                target="_blank"
                rel="noreferrer"
              >
                Falar no WhatsApp
              </a>
            </Button>
          </div>
        </Reveal>
      </section>

      <footer className="border-t bg-secondary/40">
        <div className="container flex flex-col items-center gap-2 py-10 text-center text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-md bg-primary font-display text-xs font-bold text-primary-foreground">
              F
            </span>
            <span className="font-display font-semibold text-foreground">Espaço Flow</span>
          </div>
          <p>Sudoeste, Brasília – DF • 07h às 23h, todos os dias</p>
          <p>Instagram: @coworkingespacoflow</p>
          <p className="mt-2">© Espaço Flow — Felipe Geraldo Torres LTDA</p>
        </div>
      </footer>

      <WhatsappFab />
    </div>
  );
}
