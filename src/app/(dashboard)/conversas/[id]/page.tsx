import { redirect } from "next/navigation";

/** A conversa agora abre no chat unificado (/conversas?c=<id>). Mantém deep links válidos. */
export default async function ConversaThreadPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  redirect(`/conversas?c=${id}`);
}
