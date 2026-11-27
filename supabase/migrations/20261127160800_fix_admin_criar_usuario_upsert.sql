-- Corrige "duplicate key value violates unique constraint perfis_usuarios_pkey"
-- ao criar usuário pela Administração: o gatilho on_auth_user_created
-- (handle_new_user_profile) já insere a linha de perfil quando o usuário nasce
-- em auth.users; a RPC então tentava INSERT de outra linha com o mesmo id.
-- Padrão agora: UPDATE da linha criada pelo gatilho; INSERT (upsert) apenas como
-- fallback se a linha não existir. Nenhuma linha de perfis_usuarios existente é
-- alterada por esta migração — apenas definições de funções são recriadas.

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
set search_path to 'public'
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

  -- O gatilho on_auth_user_created já criou a linha de perfil: atualizá-la
  -- (em vez de inserir outra com o mesmo id). Fallback: upsert se não existir.
  update public.perfis_usuarios
     set tenant_id = p_estabelecimento_id,
         email = v_clean_email,
         nome_exibicao = v_nome_final,
         perfil = v_perfil,
         ativo = true,
         updated_at = now()
   where id = v_new_id;

  if not found then
    insert into public.perfis_usuarios (id, tenant_id, email, nome_exibicao, perfil, ativo, created_at, updated_at)
    values (v_new_id, p_estabelecimento_id, v_clean_email, v_nome_final, v_perfil, true, now(), now())
    on conflict (id) do update
      set tenant_id = excluded.tenant_id,
          email = excluded.email,
          nome_exibicao = excluded.nome_exibicao,
          perfil = excluded.perfil,
          ativo = true,
          updated_at = now();
  end if;

  return jsonb_build_object(
    'sucesso', true,
    'id', v_new_id,
    'email', v_clean_email,
    'nome', v_nome_final,
    'perfil', v_perfil,
    'mensagem', 'Usuário criado e vinculado ao estabelecimento.'
  );
end;
$$;
