-- Correção do bug "function gen_salt(unknown) does not exist".
-- A extensão pgcrypto está instalada no schema `extensions`, mas as RPCs de
-- administração de usuários chamam gen_salt/crypt SEM qualificar o schema e
-- com `set search_path = public` — portanto o PostgreSQL não encontra as
-- funções. A correção qualifica explicitamente extensions.gen_salt() e
-- extensions.crypt() em TODAS as funções do banco que usam criptografia de
-- senha (mais à prova de regressão do que ampliar o search_path).
-- Nenhuma linha de usuário é alterada: apenas definição de funções.

-- ============================================================
-- 1) Admin da plataforma: criar usuário de estabelecimento
-- ============================================================
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
    extensions.crypt(p_senha, extensions.gen_salt('bf')),
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

-- ============================================================
-- 2) Admin da plataforma: redefinir senha de usuário de estabelecimento
-- ============================================================
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
  set encrypted_password = extensions.crypt(p_nova_senha, extensions.gen_salt('bf')),
      updated_at = now(),
      recovery_token = ''
  where id = p_user_id;

  return jsonb_build_object('sucesso', true, 'id', p_user_id, 'mensagem', 'Senha provisória redefinida.');
end;
$$;

-- ============================================================
-- 3) Gerente: criar usuário de estabelecimento
-- ============================================================
drop function if exists public.gerente_criar_usuario_estabelecimento(uuid, text, text, text, text);
create or replace function public.gerente_criar_usuario_estabelecimento(
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
  v_perfil_validado text;
begin
  if not public.is_gerente() then
    raise exception 'Acesso negado: apenas Gerente pode criar usuários.';
  end if;

  -- Escopo: o próprio tenant OU estabelecimento criado por este gerente
  if p_estabelecimento_id is distinct from public.estabelecimento_atual() then
    if not exists (
      select 1 from public.estabelecimentos
      where id = p_estabelecimento_id and config ->> 'criado_por' = auth.uid()::text
    ) then
      raise exception 'Você só pode criar usuários no seu próprio estabelecimento ou nos que você criou.';
    end if;
  end if;

  v_clean_email := lower(trim(p_email));
  if v_clean_email is null or v_clean_email = '' or position('@' in v_clean_email) = 0 then
    raise exception 'E-mail inválido fornecido.';
  end if;

  if p_senha is null or char_length(p_senha) < 6 then
    raise exception 'A senha deve ter no mínimo 6 caracteres.';
  end if;

  v_perfil_validado := lower(trim(coalesce(p_perfil, '')));
  if v_perfil_validado not in ('garcom', 'caixa', 'gerente', 'cozinha') then
    raise exception 'Perfil inválido: use garcom, caixa, gerente ou cozinha.';
  end if;

  if exists (select 1 from auth.users where lower(email) = v_clean_email) then
    raise exception 'O e-mail "%" já está cadastrado no sistema.', v_clean_email;
  end if;

  v_new_id := gen_random_uuid();
  v_nome_final := coalesce(nullif(trim(p_nome), ''), split_part(v_clean_email, '@', 1));

  insert into auth.users (
    id, instance_id, email, encrypted_password, email_confirmed_at, created_at, updated_at,
    raw_app_meta_data, raw_user_meta_data, is_super_admin, role, aud,
    confirmation_token, recovery_token, email_change_token_new, email_change,
    email_change_token_current, phone, phone_change, phone_change_token, reauthentication_token
  ) values (
    v_new_id,
    '00000000-0000-0000-0000-000000000000',
    v_clean_email,
    extensions.crypt(p_senha, extensions.gen_salt('bf')),
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

  insert into public.perfis_usuarios (id, tenant_id, email, nome_exibicao, perfil, ativo)
  values (v_new_id, p_estabelecimento_id, v_clean_email, v_nome_final, v_perfil_validado, true)
  on conflict (id) do update
  set tenant_id = excluded.tenant_id,
      perfil = excluded.perfil,
      nome_exibicao = excluded.nome_exibicao,
      email = excluded.email,
      ativo = true,
      updated_at = now();

  return jsonb_build_object(
    'sucesso', true,
    'id', v_new_id,
    'email', v_clean_email,
    'nome', v_nome_final,
    'perfil', v_perfil_validado,
    'mensagem', 'Usuário criado e vinculado ao estabelecimento com sucesso!'
  );
end;
$$;

grant execute on function public.gerente_criar_usuario_estabelecimento(uuid, text, text, text, text) to authenticated;

-- ============================================================
-- 4) Gerente: criar usuário (função legada da tela Usuários)
-- ============================================================
drop function if exists public.admin_criar_usuario(text, text, text, text);
create or replace function public.admin_criar_usuario(p_email text, p_senha text, p_nome text, p_perfil text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
DECLARE
  v_new_id UUID;
  v_clean_email TEXT;
  v_perfil_validado TEXT;
  v_tenant uuid;
BEGIN
  IF NOT public.is_gerente() THEN
    RAISE EXCEPTION 'Acesso negado: apenas Gerente pode criar usuários.';
  END IF;

  v_clean_email := lower(trim(p_email));

  IF v_clean_email IS NULL OR v_clean_email = '' OR position('@' IN v_clean_email) = 0 THEN
    RAISE EXCEPTION 'E-mail inválido fornecido.';
  END IF;

  IF p_senha IS NULL OR char_length(p_senha) < 6 THEN
    RAISE EXCEPTION 'A senha deve ter no mínimo 6 caracteres.';
  END IF;

  v_perfil_validado := lower(trim(p_perfil));
  IF v_perfil_validado NOT IN ('garcom', 'caixa', 'gerente', 'cozinha') THEN
    v_perfil_validado := 'garcom';
  END IF;

  IF EXISTS (SELECT 1 FROM auth.users WHERE lower(email) = v_clean_email) THEN
    RAISE EXCEPTION 'O e-mail "%" já está cadastrado no sistema.', v_clean_email;
  END IF;

  v_new_id := gen_random_uuid();

  v_tenant := public.estabelecimento_atual();
  IF v_tenant IS NULL THEN
    SELECT id INTO v_tenant FROM public.estabelecimentos WHERE ativo = true ORDER BY criado_em ASC LIMIT 1;
  END IF;

  INSERT INTO auth.users (
    id, instance_id, email, encrypted_password, email_confirmed_at, created_at, updated_at,
    raw_app_meta_data, raw_user_meta_data, is_super_admin, role, aud,
    confirmation_token, recovery_token, email_change_token_new, email_change,
    email_change_token_current, phone, phone_change, phone_change_token, reauthentication_token
  ) VALUES (
    v_new_id,
    '00000000-0000-0000-0000-000000000000',
    v_clean_email,
    extensions.crypt(p_senha, extensions.gen_salt('bf')),
    NOW(),
    NOW(),
    NOW(),
    '{"provider": "email", "providers": ["email"]}',
    json_build_object('name', COALESCE(NULLIF(trim(p_nome), ''), split_part(v_clean_email, '@', 1))),
    false,
    'authenticated',
    'authenticated',
    '', '', '', '', '',
    NULL,
    '', '', ''
  );

  INSERT INTO public.perfis_usuarios (
    id, email, nome_exibicao, perfil, ativo, created_at, updated_at, tenant_id
  ) VALUES (
    v_new_id,
    v_clean_email,
    COALESCE(NULLIF(trim(p_nome), ''), split_part(v_clean_email, '@', 1)),
    v_perfil_validado,
    true,
    NOW(),
    NOW(),
    v_tenant
  )
  ON CONFLICT (id) DO UPDATE
  SET perfil = v_perfil_validado,
      nome_exibicao = EXCLUDED.nome_exibicao,
      email = EXCLUDED.email,
      ativo = true,
      tenant_id = EXCLUDED.tenant_id,
      updated_at = NOW();

  RETURN jsonb_build_object(
    'sucesso', true,
    'id', v_new_id,
    'email', v_clean_email,
    'nome', COALESCE(NULLIF(trim(p_nome), ''), split_part(v_clean_email, '@', 1)),
    'perfil', v_perfil_validado,
    'mensagem', 'Usuário cadastrado com sucesso!'
  );
END;
$$;

grant execute on function public.admin_criar_usuario(TEXT, TEXT, TEXT, TEXT) to authenticated;

-- ============================================================
-- 5) Gerente: redefinir senha (função legada da tela Usuários)
-- ============================================================
drop function if exists public.admin_redefinir_senha_usuario(uuid, text);
create or replace function public.admin_redefinir_senha_usuario(p_user_id uuid, p_nova_senha text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
BEGIN
  IF NOT public.is_gerente() THEN
    RAISE EXCEPTION 'Acesso negado: apenas Gerente pode redefinir senhas.';
  END IF;

  IF p_nova_senha IS NULL OR char_length(p_nova_senha) < 6 THEN
    RAISE EXCEPTION 'A nova senha deve ter no mínimo 6 caracteres.';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.perfis_usuarios
    WHERE id = p_user_id
      AND public.estabelecimento_atual() IS NOT NULL
      AND tenant_id <> public.estabelecimento_atual()
  ) THEN
    RAISE EXCEPTION 'Usuário pertence a outro estabelecimento.';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = p_user_id) THEN
    RAISE EXCEPTION 'Usuário não encontrado.';
  END IF;

  UPDATE auth.users
  SET encrypted_password = extensions.crypt(p_nova_senha, extensions.gen_salt('bf')),
      updated_at = NOW(),
      recovery_token = ''
  WHERE id = p_user_id;

  RETURN jsonb_build_object('sucesso', true, 'id', p_user_id, 'mensagem', 'Senha do usuário redefinida com sucesso!');
END;
$$;

grant execute on function public.admin_redefinir_senha_usuario(UUID, TEXT) to authenticated;
