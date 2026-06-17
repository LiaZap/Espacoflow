"use client";

import { useEffect, useRef } from "react";
import { useActionState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Paperclip } from "lucide-react";
import { uploadComprovante, type FormState } from "@/lib/actions/pagamentos";

export function ComprovanteUpload({ id, atual }: { id: string; atual: string | null }) {
  const [state, action] = useActionState<FormState, FormData>(uploadComprovante, {});
  const formRef = useRef<HTMLFormElement>(null);
  const router = useRouter();

  useEffect(() => {
    if (state?.ok) {
      toast.success("Comprovante anexado.");
      router.refresh();
    } else if (state?.erro) {
      toast.error(state.erro);
    }
  }, [state, router]);

  return (
    <form ref={formRef} action={action} className="flex items-center gap-2">
      <input type="hidden" name="id" value={id} />
      {atual ? (
        <a href={atual} target="_blank" rel="noreferrer" className="text-xs text-primary underline">
          ver
        </a>
      ) : null}
      <label className="inline-flex cursor-pointer items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
        <Paperclip className="h-3.5 w-3.5" />
        <span>{atual ? "trocar" : "anexar"}</span>
        <input
          type="file"
          name="arquivo"
          accept="image/*,application/pdf"
          className="hidden"
          onChange={() => formRef.current?.requestSubmit()}
        />
      </label>
    </form>
  );
}
