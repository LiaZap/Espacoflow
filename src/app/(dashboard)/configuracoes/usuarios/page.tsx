import { listarUsuarios } from "@/lib/actions/usuarios";
import { exigirPermissao } from "@/lib/actions/_helpers";
import { ROLES, ROLE_LABEL, temPapel, temPermissao, type Role } from "@/lib/auth/rbac";
import { PageHeader } from "@/components/page-header";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatarDataHora } from "@/lib/utils";
import { NovoUsuarioForm } from "./_components/novo-usuario-form";
import { UsuarioAcoes } from "./_components/usuario-acoes";

export default async function UsuariosPage() {
  const sessao = await exigirPermissao("usuarios", "ler");
  const usuarios = await listarUsuarios();

  // Papéis que ESTE usuário pode atribuir (nunca acima do próprio nível).
  const papeis = ROLES.filter((r) => temPapel(sessao.role, r)).map((r) => ({
    value: r,
    label: ROLE_LABEL[r],
  }));
  const podeCriar = temPermissao(sessao.role, "usuarios", "criar");
  const podeExcluir = temPermissao(sessao.role, "usuarios", "excluir");

  return (
    <div className="space-y-6 p-8">
      <PageHeader
        titulo="Usuários"
        descricao="Equipe interna que acessa o backoffice e seus papéis (RBAC)."
      />

      {podeCriar ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Novo usuário</CardTitle>
            <CardDescription>
              A pessoa entra com e-mail e a senha provisória — recomende a troca no primeiro acesso.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <NovoUsuarioForm papeis={papeis} />
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Equipe ({usuarios.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b text-left text-muted-foreground">
                <tr>
                  <th className="py-2 font-medium">Nome</th>
                  <th className="py-2 font-medium">E-mail</th>
                  <th className="py-2 font-medium">Papel</th>
                  <th className="py-2 font-medium">Último acesso</th>
                  <th className="py-2 text-right font-medium">Ações</th>
                </tr>
              </thead>
              <tbody>
                {usuarios.map((u) => {
                  const editavel = temPapel(sessao.role, u.role as Role);
                  const bloqueado = u.bloqueado_ate && u.bloqueado_ate.getTime() > Date.now();
                  return (
                    <tr key={u.id} className="border-b last:border-0">
                      <td className="py-2 font-medium">
                        {u.nome}
                        {u.id === sessao.userId ? (
                          <span className="ml-1 text-xs text-muted-foreground">(você)</span>
                        ) : null}
                        {bloqueado ? (
                          <Badge variant="destructive" className="ml-2">
                            bloqueado
                          </Badge>
                        ) : null}
                      </td>
                      <td className="py-2 text-muted-foreground">{u.email}</td>
                      <td className="py-2">
                        <Badge variant="secondary">{ROLE_LABEL[u.role as Role] ?? u.role}</Badge>
                      </td>
                      <td className="py-2 text-muted-foreground">
                        {u.ultimo_acesso ? formatarDataHora(u.ultimo_acesso) : "—"}
                      </td>
                      <td className="py-2">
                        {editavel ? (
                          <UsuarioAcoes
                            id={u.id}
                            role={u.role}
                            nome={u.nome}
                            papeis={papeis}
                            podeExcluir={podeExcluir}
                            ehVoceMesmo={u.id === sessao.userId}
                          />
                        ) : (
                          <p className="text-right text-xs text-muted-foreground">—</p>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
