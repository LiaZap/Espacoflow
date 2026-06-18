import { redirect } from "next/navigation";

// O cliente usa o site próprio dele — a landing pública foi desativada.
// A raiz vai direto para o login (logado, o middleware encaminha ao dashboard).
export default function Home() {
  redirect("/login");
}
