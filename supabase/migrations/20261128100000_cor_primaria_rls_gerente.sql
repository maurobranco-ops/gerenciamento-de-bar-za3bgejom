-- Cor de marca: libera a coluna cor_primaria para o GERENTE do PRÓPRIO estabelecimento via RLS.
-- As demais colunas continuam inacessíveis para update direto do cliente (só via RPC admin/gerente).

-- 1) Permissão de coluna: authenticated só pode atualizar cor_primaria diretamente
grant update (cor_primaria) on public.estabelecimentos to authenticated;

-- 2) Política RLS: gerente altera apenas a linha do próprio tenant (tenant vem do perfil logado)
drop policy if exists estabelecimentos_update_cor_primaria on public.estabelecimentos;
create policy estabelecimentos_update_cor_primaria
  on public.estabelecimentos
  for update
  to authenticated
  using (
    public.is_gerente()
    and id = (select tenant_id from public.perfis_usuarios where id = auth.uid())
  )
  with check (
    public.is_gerente()
    and id = (select tenant_id from public.perfis_usuarios where id = auth.uid())
    and cor_primaria ~ '^#[0-9a-fA-F]{6}$'
  );
