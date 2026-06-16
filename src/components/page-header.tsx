import { cn } from "@/lib/utils";

interface PageHeaderProps {
  titulo: string;
  descricao?: string;
  acao?: React.ReactNode;
  className?: string;
}

export function PageHeader({ titulo, descricao, acao, className }: PageHeaderProps) {
  return (
    <div className={cn("flex flex-wrap items-start justify-between gap-4 border-b pb-4", className)}>
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{titulo}</h1>
        {descricao ? <p className="mt-1 text-sm text-muted-foreground">{descricao}</p> : null}
      </div>
      {acao ? <div className="shrink-0">{acao}</div> : null}
    </div>
  );
}
