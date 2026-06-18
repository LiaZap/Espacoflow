"use client";

import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function PresencaData({ dia }: { dia: string }) {
  const router = useRouter();
  return (
    <div className="flex items-end gap-3 print:hidden">
      <div className="space-y-1.5">
        <Label>Dia</Label>
        <Input
          type="date"
          defaultValue={dia}
          onChange={(e) => {
            if (e.target.value) router.push(`/reservas/presenca?data=${e.target.value}`);
          }}
          className="w-44"
        />
      </div>
    </div>
  );
}
