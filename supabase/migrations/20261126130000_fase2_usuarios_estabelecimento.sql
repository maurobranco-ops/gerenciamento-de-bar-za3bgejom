-- ============================================================================
-- FASE 2 MULTI-TENANT (parte 2) — Usuários por estabelecimento
-- - gerente_listar_usuarios_estabelecimento: todos os usuários do auth com
--   o tenant de cada um + flag de vínculo ao estabelecimento consultado
-- - gerente_criar_usuario_estabelecimento: cria auth user + perfil já
--   vinculado ao tenant informado (mesmo padrão de admin_criar_usuario)
-- Todas as funções validam perfil Gerente e o escopo (tenant próprio ou
-- estabelecimento criado pelo gerente: config->>'criado_por' = auth.uid()).
-- ============================================================================

create or replace function public.gerente_listar_usuarios_estabelecimento(p_estabelecimento_id uuid)
returns table (
  usuario_id uuid,
  email text,
  nome_exibicao text,
  perfil text,
  ativo boolean,
  tenant_id uuid,
  vinculado boolean,
  last_sign_in_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_gerente() then
    raise exception 'Acesso negado: apenas Gerente pode listar usuários.';
  end if;

  if p_estabelecimento_id is distinct from public.estabelecimento_atual() then
    if not exists (
      select 1 from public.estabelecimentos
      where id = p_estabelecimento_id and config ->> 'criado_por' = auth.uid()::text
    ) then
      raise exception 'Você só pode listar usuários do seu próprio estabelecimento ou dos que você criou.';
    end if;
  end if;

  return query
  select
    u.id,
    u.email::text,
    coalesce(p.nome_exibicao, u.raw_user_meta_data ->> 'name', split_part(u.email::text, '@', 1)),
    coalesce(p.perfil, 'garcom'),
    coalesce(p.ativo, true),
    p.tenant_id,
    coalesce(p.tenant_id = p_estabelecimento_id, false),
    u.last_sign_in_at
  from auth.users u
  left join public.perfis_usuarios p on p.id = u.id
  order by coalesce(p.tenant_id = p_estabelecimento_id, false) desc, u.created_at asc;
end;
$$;

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

grant execute on function public.gerente_listar_usuarios_estabelecimento(uuid) to authenticated;
grant execute on function public.gerente_criar_usuario_estabelecimento(uuid, text, text, text, text) to authenticated;
