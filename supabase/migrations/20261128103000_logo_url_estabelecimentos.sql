-- Logo do estabelecimento (tenant): coluna logo_url + bucket público "logos" + RPC do gerente.
-- Padrão das RPCs admin_*/gerente_*: DROP FUNCTION IF EXISTS antes do CREATE e checagem de perfil no banco.

-- 1) Coluna logo_url (nullable — ausência mantém o ícone padrão)
alter table public.estabelecimentos
  add column if not exists logo_url text;

-- 2) Bucket público "logos" com caminho por tenant (logos/{tenant_id}/logo_*.{ext})
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'logos',
  'logos',
  true,
  2097152, -- 2 MB
  array['image/png', 'image/jpeg', 'image/svg+xml']
)
on conflict (id) do update
set public = true,
    file_size_limit = 2097152,
    allowed_mime_types = array['image/png', 'image/jpeg', 'image/svg+xml'];

-- 3) Políticas de Storage: leitura pública; escrita só do gerente autenticado no PRÓPRIO caminho do tenant
drop policy if exists "logos_storage_public_read" on storage.objects;
create policy "logos_storage_public_read"
  on storage.objects
  for select
  to public
  using (bucket_id = 'logos');

drop policy if exists "logos_storage_gerente_insert" on storage.objects;
create policy "logos_storage_gerente_insert"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'logos'
    and public.is_gerente()
    and (storage.foldername(name))[1] = (
      select tenant_id::text from public.perfis_usuarios where id = auth.uid()
    )
  );

drop policy if exists "logos_storage_gerente_update" on storage.objects;
create policy "logos_storage_gerente_update"
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'logos'
    and public.is_gerente()
    and (storage.foldername(name))[1] = (
      select tenant_id::text from public.perfis_usuarios where id = auth.uid()
    )
  )
  with check (
    bucket_id = 'logos'
    and public.is_gerente()
    and (storage.foldername(name))[1] = (
      select tenant_id::text from public.perfis_usuarios where id = auth.uid()
    )
  );

drop policy if exists "logos_storage_gerente_delete" on storage.objects;
create policy "logos_storage_gerente_delete"
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'logos'
    and public.is_gerente()
    and (storage.foldername(name))[1] = (
      select tenant_id::text from public.perfis_usuarios where id = auth.uid()
    )
  );

-- 4) RPC: gerente grava/remove a logo_url do PRÓPRIO estabelecimento (tenant vem do perfil logado)
drop function if exists public.gerente_definir_logo_url(text);
create or replace function public.gerente_definir_logo_url(p_logo_url text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant uuid;
  v_url text;
begin
  if not public.is_gerente() then
    raise exception 'Acesso negado: apenas o Gerente do estabelecimento pode alterar a logo.';
  end if;

  select tenant_id into v_tenant from public.perfis_usuarios where id = auth.uid();
  if v_tenant is null then
    raise exception 'Gerente sem estabelecimento vinculado.';
  end if;

  v_url := nullif(trim(coalesce(p_logo_url, '')), '');

  if v_url is not null then
    -- A URL tem de apontar para o caminho do PRÓPRIO tenant no bucket público "logos"
    if position('/object/public/logos/' || v_tenant::text || '/' in v_url) = 0 then
      raise exception 'URL de logo inválida para este estabelecimento.';
    end if;
    if char_length(v_url) > 2048 then
      raise exception 'URL da logo muito longa.';
    end if;
  end if;

  update public.estabelecimentos
  set logo_url = v_url,
      atualizado_em = now()
  where id = v_tenant;

  return jsonb_build_object('sucesso', true, 'id', v_tenant, 'logo_url', v_url);
end;
$$;
