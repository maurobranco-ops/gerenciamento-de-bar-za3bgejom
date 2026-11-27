-- Pós-login do admin da plataforma: a política de SELECT de perfis_usuarios
-- só liberava linhas por tenant (tenant_id = estabelecimento_atual() ou nulo).
-- O admin tem tenant_id nulo por design e o JWT dele não carrega tenant, e a
-- consulta do perfil voltava vazia — o login então assumia o papel Garçom e os
-- guardas de rota devolviam o admin ao /login.
-- Correção: cada usuário autenticado passa a ler a PRÓPRIA linha (id = auth.uid()),
-- sem abrir leitura de perfis alheios além do que já existia.

DROP POLICY IF EXISTS "perfis_usuarios_select" ON public.perfis_usuarios;

CREATE POLICY "perfis_usuarios_select"
  ON public.perfis_usuarios
  FOR SELECT
  TO authenticated
  USING (
    (tenant_id = public.estabelecimento_atual())
    OR (public.estabelecimento_atual() IS NULL)
    OR (id = auth.uid())
  );
