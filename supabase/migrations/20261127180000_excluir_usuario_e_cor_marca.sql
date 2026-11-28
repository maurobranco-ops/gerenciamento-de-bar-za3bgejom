-- (a) Admin da plataforma exclui um usuário de um estabelecimento (perfil + conta de login).
-- (b) Gerente define a cor de marca do PRÓPRIO estabelecimento (coluna cor_primaria).
-- DROP FUNCTION IF EXISTS antes de cada CREATE evita o erro 42P13.

-- 1) Cor de marca por estabelecimento (default = âmbar atual do tema)
alter table public.estabelecimentos
  add column if not exists cor_primaria text not null default '#f59e0b';

alter table public.estabelecimentos
  drop constraint if exists estabelecimentos_cor_primaria_formato;

alter table public.estabelecimentos
  add constraint estabelecimentos_cor_primaria_formato
  check (cor_primaria ~ '^#[0-9a-fA-F]{6}$');

-- 2) Gerente altera a cor do próprio estabelecimento (tenant vem do perfil logado, nunca do cliente)
drop function if exists public.gerente_definir_cor_marca(text);
create or replace function public.gerente_definir_cor_marca(p_cor text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant uuid;
  v_cor text;
begin
  if not public.is_gerente() then
    raise exception 'Acesso negado: apenas o Gerente do estabelecimento pode alterar a cor de marca.';
  end if;

  select tenant_id into v_tenant from public.perfis_usuarios where id = auth.uid();
  if v_tenant is null then
    raise exception 'Gerente sem estabelecimento vinculado.';
  end if;

  v_cor := lower(trim(coalesce(p_cor, '')));
  if v_cor !~ '^#[0-9a-f]{6}$' then
    raise exception 'Cor inválida: use o formato #RRGGBB.';
  end if;

  update public.estabelecimentos
  set cor_primaria = v_cor,
      atualizado_em = now()
  where id = v_tenant;

  return jsonb_build_object('sucesso', true, 'id', v_tenant, 'cor_primaria', v_cor);
end;
$$;

-- 3) Admin da plataforma exclui usuário de um estabelecimento (perfil + conta em auth.users)
drop function if exists public.admin_excluir_usuario_estabelecimento(uuid, uuid);
create or replace function public.admin_excluir_usuario_estabelecimento(
  p_estabelecimento_id uuid,
  p_user_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Acesso negado: apenas o Administrador da plataforma pode excluir usuários de estabelecimentos.';
  end if;

  if not exists (
    select 1 from public.perfis_usuarios
    where id = p_user_id and tenant_id = p_estabelecimento_id
  ) then
    raise exception 'Usuário não pertence a este estabelecimento.';
  end if;

  delete from public.perfis_usuarios
  where id = p_user_id and tenant_id = p_estabelecimento_id;

  delete from auth.users where id = p_user_id;

  return jsonb_build_object('sucesso', true, 'id', p_user_id, 'mensagem', 'Usuário excluído do estabelecimento.');
end;
$$;
