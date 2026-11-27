-- Gestão de usuários por estabelecimento pela Administração da PLATAFORMA (perfil 'admin').
-- As RPCs gerente_* e admin_criar_usuario/admin_redefinir_senha_usuario exigem is_gerente(),
-- que o admin da plataforma não satisfaz. Aqui criamos RPCs próprias, todas com public.is_admin().
-- DROP FUNCTION IF EXISTS antes de cada CREATE evita o erro 42P13 (assinatura já existente).

-- 1) Listar usuários vinculados a um estabelecimento
drop function if exists public.admin_listar_usuarios_estabelecimento(uuid);
create or replace function public.admin_listar_usuarios_estabelecimento(p_estabelecimento_id uuid)
returns table(
  usuario_id uuid,
  email text,
  nome_exibicao text,
  perfil text,
  ativo boolean,
  last_sign_in_at timestamp with time zone
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Acesso negado: apenas o Administrador da plataforma pode listar usuários de estabelecimentos.';
  end if;

  return query
  select
    p.id,
    coalesce(u.email, p.email)::text,
    coalesce(nullif(p.nome_exibicao, ''), u.raw_user_meta_data ->> 'name', split_part(coalesce(u.email, p.email), '@', 1))::text,
    p.perfil::text,
    p.ativo,
    u.last_sign_in_at
  from public.perfis_usuarios p
  join auth.users u on u.id = p.id
  where p.tenant_id = p_estabelecimento_id
  order by p.perfil = 'gerente' desc, p.created_at asc;
end;
$$;

-- 2) Criar usuário já vinculado ao estabelecimento escolhido
drop function if exists public.admin_criar_usuario_estabelecimento(uuid, text, text, text, text);
create or replace function public.admin_criar_usuario_estabelecimento(
  p_estabelecimento_id uuid,
  p_email text,
  p_senha text,
  p_nome text,
  p_perfil text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_new_id uuid;
  v_clean_email text;
  v_nome_final text;
  v_perfil text;
begin
  if not public.is_admin() then
    raise exception 'Acesso negado: apenas o Administrador da plataforma pode criar usuários de estabelecimentos.';
  end if;

  if not exists (select 1 from public.estabelecimentos where id = p_estabelecimento_id) then
    raise exception 'Estabelecimento não encontrado.';
  end if;

  v_clean_email := lower(trim(coalesce(p_email, '')));
  if v_clean_email = '' or position('@' in v_clean_email) = 0 then
    raise exception 'E-mail inválido fornecido.';
  end if;

  if p_senha is null or char_length(p_senha) < 6 then
    raise exception 'A senha provisória deve ter no mínimo 6 caracteres.';
  end if;

  v_perfil := lower(trim(coalesce(p_perfil, '')));
  if v_perfil not in ('garcom', 'caixa', 'gerente', 'cozinha') then
    raise exception 'Perfil inválido: use garcom, caixa, gerente ou cozinha.';
  end if;

  if exists (select 1 from auth.users where lower(email) = v_clean_email) then
    raise exception 'O e-mail "%" já está cadastrado no sistema.', v_clean_email;
  end if;

  v_new_id := gen_random_uuid();
  v_nome_final := coalesce(nullif(trim(coalesce(p_nome, '')), ''), split_part(v_clean_email, '@', 1));

  insert into auth.users (
    id, instance_id, email, encrypted_password, email_confirmed_at, created_at, updated_at,
    raw_app_meta_data, raw_user_meta_data, is_super_admin, role, aud,
    confirmation_token, recovery_token, email_change_token_new, email_change,
    email_change_token_current, phone, phone_change, phone_change_token, reauthentication_token
  ) values (
    v_new_id,
    '00000000-0000-0000-0000-000000000000',
    v_clean_email,
    crypt(p_senha, gen_salt('bf')),
    now(),
    now(),
    now(),
    '{"provider": "email", "providers": ["email"]}',
    json_build_object('name', v_nome_final),
    false,
    'authenticated',
    'authenticated',
    '', '', '', '', '',
    null,
    '', '', ''
  );

  insert into public.perfis_usuarios (id, tenant_id, email, nome_exibicao, perfil, ativo, created_at, updated_at)
  values (v_new_id, p_estabelecimento_id, v_clean_email, v_nome_final, v_perfil, true, now(), now());

  return jsonb_build_object(
    'sucesso', true,
    'id', v_new_id,
    'email', v_clean_email,
    'perfil', v_perfil,
    'mensagem', 'Usuário criado e vinculado ao estabelecimento.'
  );
end;
$$;

-- 3) Redefinir senha provisória de um usuário de um estabelecimento
drop function if exists public.admin_redefinir_senha_usuario_estabelecimento(uuid, uuid, text);
create or replace function public.admin_redefinir_senha_usuario_estabelecimento(
  p_estabelecimento_id uuid,
  p_user_id uuid,
  p_nova_senha text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Acesso negado: apenas o Administrador da plataforma pode redefinir senhas de estabelecimentos.';
  end if;

  if p_nova_senha is null or char_length(p_nova_senha) < 6 then
    raise exception 'A nova senha provisória deve ter no mínimo 6 caracteres.';
  end if;

  if not exists (
    select 1 from public.perfis_usuarios
    where id = p_user_id and tenant_id = p_estabelecimento_id
  ) then
    raise exception 'Usuário não pertence a este estabelecimento.';
  end if;

  update auth.users
  set encrypted_password = crypt(p_nova_senha, gen_salt('bf')),
      updated_at = now(),
      recovery_token = ''
  where id = p_user_id;

  return jsonb_build_object('sucesso', true, 'id', p_user_id, 'mensagem', 'Senha provisória redefinida.');
end;
$$;

-- 4) Ativar/desativar usuário de um estabelecimento
drop function if exists public.admin_ativar_usuario_estabelecimento(uuid, uuid, boolean);
create or replace function public.admin_ativar_usuario_estabelecimento(
  p_estabelecimento_id uuid,
  p_user_id uuid,
  p_ativo boolean
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Acesso negado: apenas o Administrador da plataforma pode ativar ou desativar usuários de estabelecimentos.';
  end if;

  if not exists (
    select 1 from public.perfis_usuarios
    where id = p_user_id and tenant_id = p_estabelecimento_id
  ) then
    raise exception 'Usuário não pertence a este estabelecimento.';
  end if;

  update public.perfis_usuarios
  set ativo = coalesce(p_ativo, ativo),
      updated_at = now()
  where id = p_user_id and tenant_id = p_estabelecimento_id;

  return jsonb_build_object('sucesso', true, 'id', p_user_id, 'ativo', p_ativo);
end;
$$;
