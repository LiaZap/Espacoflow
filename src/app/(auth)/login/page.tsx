import { redirect } from "next/navigation";
import { Check } from "lucide-react";
import { getSession } from "@/lib/auth";
import { LoginForm } from "./_components/login-form";

export const metadata = { title: "Entrar — Espaço Flow" };

const DESTAQUES = [
  "Reservas e ocupação em tempo real",
  "Atendimento automático no WhatsApp",
  "Pix, comprovantes e relatórios num só lugar",
];

export default async function LoginPage() {
  // Já autenticado de verdade (sessão válida no banco) → vai direto ao painel.
  const session = await getSession();
  if (session) redirect("/dashboard");

  return (
    <main className="grid min-h-screen lg:grid-cols-2">
      {/* Painel da marca (desktop) */}
      <aside className="relative hidden overflow-hidden bg-primary lg:block">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/salas/ambiente.jpg"
          alt=""
          className="absolute inset-0 h-full w-full object-cover opacity-25"
        />
        <div className="absolute inset-0 bg-gradient-to-br from-primary via-primary/90 to-primary/95" />

        <div className="relative flex h-full flex-col justify-between p-12 text-primary-foreground">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-foreground/15 font-display text-lg font-bold ring-1 ring-primary-foreground/20">
              F
            </span>
            <span className="font-display text-xl font-semibold">Espaço Flow</span>
          </div>

          <div className="max-w-md">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent">
              Hospitalidade produtiva
            </p>
            <h1 className="mt-3 font-display text-4xl font-bold leading-[1.1] tracking-tight">
              A gestão do seu coworking, num só lugar.
            </h1>
            <p className="mt-4 text-primary-foreground/80">
              Reservas, pagamentos, o atendimento da Hígia no WhatsApp e relatórios — com a cara do Espaço Flow.
            </p>
            <ul className="mt-8 space-y-3 text-sm text-primary-foreground/90">
              {DESTAQUES.map((t) => (
                <li key={t} className="flex items-center gap-3">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent/20 text-accent">
                    <Check className="h-3.5 w-3.5" />
                  </span>
                  {t}
                </li>
              ))}
            </ul>
          </div>

          <p className="text-xs text-primary-foreground/60">Sudoeste · Brasília-DF</p>
        </div>
      </aside>

      {/* Painel do formulário */}
      <section className="flex items-center justify-center bg-background p-6">
        <div className="w-full max-w-sm">
          <div className="mb-8 flex flex-col items-center text-center lg:hidden">
            <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary font-display text-lg font-bold text-primary-foreground">
              F
            </span>
            <span className="mt-3 font-display text-lg font-semibold">Espaço Flow</span>
          </div>

          <h2 className="font-display text-2xl font-bold tracking-tight">Bem-vindo de volta</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Entre para acessar o painel de gestão.
          </p>

          <div className="mt-8">
            <LoginForm />
          </div>

          <p className="mt-8 text-center text-xs text-muted-foreground">
            Acesso restrito à equipe do Espaço Flow.
          </p>
        </div>
      </section>
    </main>
  );
}
