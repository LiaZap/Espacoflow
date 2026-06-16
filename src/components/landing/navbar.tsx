"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { linkWhatsapp } from "@/lib/landing";
import { cn } from "@/lib/utils";

export function LandingNavbar() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={cn(
        "sticky top-0 z-40 transition-all duration-300",
        scrolled ? "glass border-b shadow-sm" : "border-b border-transparent"
      )}
    >
      <div className="container flex h-16 items-center justify-between">
        <Link href="/" className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-md bg-primary font-display font-bold text-primary-foreground">
            F
          </span>
          <span className="font-display text-lg font-semibold">Espaço Flow</span>
        </Link>
        <nav className="hidden items-center gap-7 text-sm md:flex">
          <a href="#estrutura" className="text-muted-foreground transition-colors hover:text-foreground">Estrutura</a>
          <a href="#espacos" className="text-muted-foreground transition-colors hover:text-foreground">Espaços</a>
          <a href="#planos" className="text-muted-foreground transition-colors hover:text-foreground">Planos</a>
          <a href="#faq" className="text-muted-foreground transition-colors hover:text-foreground">FAQ</a>
        </nav>
        <div className="flex items-center gap-2">
          <Button asChild variant="ghost" size="sm">
            <Link href="/login">Entrar</Link>
          </Button>
          <Button asChild variant="accent" size="sm">
            <a
              href={linkWhatsapp("Olá! Gostaria de agendar uma visita ao Espaço Flow.")}
              target="_blank"
              rel="noreferrer"
            >
              Agendar visita
            </a>
          </Button>
        </div>
      </div>
    </header>
  );
}
