"use client";

import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";

export function SeletorData({ data }: { data: string }) {
  const router = useRouter();
  return (
    <Input
      type="date"
      defaultValue={data}
      className="w-44"
      onChange={(e) => {
        if (e.target.value) router.push(`/reservas/ocupacao?data=${e.target.value}`);
      }}
    />
  );
}
