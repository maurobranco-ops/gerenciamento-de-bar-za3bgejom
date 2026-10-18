-- Migração: 20261018223000_perfil_cozinha_and_kds.sql
-- Adiciona suporte ao perfil 'cozinha' no banco de dados Supabase:
-- 1. Atualiza constraint CHECK em perfis_usuarios para incluir 'cozinha'
-- 2. Cria helper function public.is_cozinha() e public.is_operador_cozinha()
-- 3. Atualiza public.admin_criar_usuario e public.admin_atualizar_perfil_usuario para aceitar 'cozinha'
-- 4. Atualiza trigger handle_new_user_profile para reconhecer e-mails com 'cozinha'
-- 5. Atualiza RLS em fila_cozinha para permitir UPDATE (avançar status) por quem tem perfil cozinha, garçom, caixa ou gerente
-- 6. Cria RPC segura public.atualizar_status_item_fila(uuid, text)
-- 7. Cria seed de demonstração para usuário Cozinha (cozinha@rachide.bar / rachide123)

-- 1. Atualiza a constraint CHECK na tabela perfis_usuarios
ALTER TABLE public.perfis_usuarios
  DROP CONSTRAINT IF EXISTS perfis_usuarios_perfil_check;

ALTER TABLE public.perfis_usuarios
  ADD CONSTRAINT perfis_usuarios_perfil_check
  CHECK (perfil IN ('garcom', 'caixa', 'gerente', 'cozinha'));

-- 2. Helper functions para checagem do perfil cozinha
CREATE OR REPLACE FUNCTION public.is_cozinha()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN COALESCE(public.get_current_user_profile() = 'cozinha', false);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION public.is_operador_cozinha()
RETURNS BOOLEAN AS $$
DECLARE
  v_p TEXT;
BEGIN
  v_p := public.get_current_user_profile();
  RETURN COALESCE(v_p IN ('gerente', 'caixa', 'garcom', 'cozinha'), false);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

GRANT EXECUTE ON FUNCTION public.is_cozinha() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_operador_cozinha() TO anon, authenticated;

-- 3. Atualiza admin_criar_usuario para aceitar perfil 'cozinha'
CREATE OR REPLACE FUNCTION public.admin_criar_usuario(
  p_email TEXT,
  p_senha TEXT,
  p_nome TEXT,
  p_perfil TEXT
)
RETURNS JSONB AS $$
DECLARE
  v_new_id UUID;
  v_clean_email TEXT;
  v_perfil_validado TEXT;
BEGIN
  -- Valida se quem está chamando é Gerente
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

  -- Checa se já existe
  IF EXISTS (SELECT 1 FROM auth.users WHERE lower(email) = v_clean_email) THEN
    RAISE EXCEPTION 'O e-mail "%" já está cadastrado no sistema.', v_clean_email;
  END IF;

  v_new_id := gen_random_uuid();

  -- Insere no auth.users cumprindo as regras obrigatórias de GoTrue (tokens não nulos, phone null)
  INSERT INTO auth.users (
    id,
    instance_id,
    email,
    encrypted_password,
    email_confirmed_at,
    created_at,
    updated_at,
    raw_app_meta_data,
    raw_user_meta_data,
    is_super_admin,
    role,
    aud,
    confirmation_token,
    recovery_token,
    email_change_token_new,
    email_change,
    email_change_token_current,
    phone,
    phone_change,
    phone_change_token,
    reauthentication_token
  ) VALUES (
    v_new_id,
    '00000000-0000-0000-0000-000000000000',
    v_clean_email,
    crypt(p_senha, gen_salt('bf')),
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

  -- Atualiza ou insere o perfil correspondente
  INSERT INTO public.perfis_usuarios (
    id,
    email,
    nome_exibicao,
    perfil,
    ativo,
    created_at,
    updated_at
  ) VALUES (
    v_new_id,
    v_clean_email,
    COALESCE(NULLIF(trim(p_nome), ''), split_part(v_clean_email, '@', 1)),
    v_perfil_validado,
    true,
    NOW(),
    NOW()
  )
  ON CONFLICT (id) DO UPDATE
  SET perfil = v_perfil_validado,
      nome_exibicao = EXCLUDED.nome_exibicao,
      email = EXCLUDED.email,
      ativo = true,
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Atualiza admin_atualizar_perfil_usuario para aceitar 'cozinha'
CREATE OR REPLACE FUNCTION public.admin_atualizar_perfil_usuario(
  p_user_id UUID,
  p_novo_perfil TEXT,
  p_novo_nome TEXT DEFAULT NULL,
  p_ativo BOOLEAN DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
  v_perfil_validado TEXT;
  v_caller_id UUID;
BEGIN
  IF NOT public.is_gerente() THEN
    RAISE EXCEPTION 'Acesso negado: apenas Gerente pode alterar perfis.';
  END IF;

  v_caller_id := auth.uid();

  v_perfil_validado := lower(trim(p_novo_perfil));
  IF v_perfil_validado NOT IN ('garcom', 'caixa', 'gerente', 'cozinha') THEN
    RAISE EXCEPTION 'Perfil inválido: use garcom, caixa, gerente ou cozinha.';
  END IF;

  -- Regra de proteção: O gerente logado não pode rebaixar seu próprio perfil para evitar se trancar para fora
  IF v_caller_id = p_user_id AND v_perfil_validado <> 'gerente' THEN
    RAISE EXCEPTION 'Operação bloqueada: você não pode remover o perfil de Gerente da sua própria conta.';
  END IF;

  -- Se estiver desativando a própria conta, bloqueia também
  IF v_caller_id = p_user_id AND p_ativo = false THEN
    RAISE EXCEPTION 'Operação bloqueada: você não pode desativar seu próprio acesso.';
  END IF;

  -- Atualiza perfis_usuarios
  UPDATE public.perfis_usuarios
  SET perfil = v_perfil_validado,
      nome_exibicao = COALESCE(NULLIF(trim(p_novo_nome), ''), nome_exibicao),
      ativo = COALESCE(p_ativo, ativo),
      updated_at = NOW()
  WHERE id = p_user_id;

  -- Atualiza metadata do auth.users se informado nome
  IF p_novo_nome IS NOT NULL AND trim(p_novo_nome) <> '' THEN
    UPDATE auth.users
    SET raw_user_meta_data = jsonb_set(
      COALESCE(raw_user_meta_data, '{}'::jsonb),
      '{name}',
      to_jsonb(trim(p_novo_nome))
    ),
    updated_at = NOW()
    WHERE id = p_user_id;
  END IF;

  RETURN jsonb_build_object(
    'sucesso', true,
    'id', p_user_id,
    'perfil', v_perfil_validado,
    'mensagem', 'Perfil atualizado com sucesso!'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Atualiza handle_new_user_profile
CREATE OR REPLACE FUNCTION public.handle_new_user_profile()
RETURNS TRIGGER AS $$
DECLARE
  v_role TEXT := 'garcom';
  v_name TEXT;
BEGIN
  IF NEW.email ILIKE '%gerente%' OR NEW.email ILIKE '%admin%' OR NEW.email = 'maurobranco@incidesolar.com.br' THEN
    v_role := 'gerente';
  ELSIF NEW.email ILIKE '%caixa%' THEN
    v_role := 'caixa';
  ELSIF NEW.email ILIKE '%cozinha%' THEN
    v_role := 'cozinha';
  END IF;

  v_name := COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1));

  INSERT INTO public.perfis_usuarios (id, email, nome_exibicao, perfil, ativo)
  VALUES (NEW.id, NEW.email, v_name, v_role, true)
  ON CONFLICT (id) DO UPDATE
    SET email = EXCLUDED.email,
        nome_exibicao = COALESCE(NULLIF(EXCLUDED.nome_exibicao, ''), public.perfis_usuarios.nome_exibicao);

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. Atualiza política de UPDATE em fila_cozinha para incluir 'cozinha'
DROP POLICY IF EXISTS "fila_cozinha_update_policy" ON public.fila_cozinha;
CREATE POLICY "fila_cozinha_update_policy" ON public.fila_cozinha
  FOR UPDATE TO authenticated
  USING (public.is_operador_cozinha())
  WITH CHECK (public.is_operador_cozinha());

-- RPC para avanço de status do item da fila com validação no servidor
CREATE OR REPLACE FUNCTION public.atualizar_status_item_fila(
  p_item_id UUID,
  p_novo_status TEXT
)
RETURNS JSONB AS $$
DECLARE
  v_status_validado TEXT;
BEGIN
  IF NOT public.is_operador_cozinha() THEN
    RAISE EXCEPTION 'Acesso negado: apenas perfis de Cozinha, Garçom, Caixa ou Gerente podem atualizar a fila.';
  END IF;

  v_status_validado := lower(trim(p_novo_status));
  IF v_status_validado NOT IN ('pendente', 'preparando', 'pronto', 'entregue') THEN
    RAISE EXCEPTION 'Status inválido: deve ser pendente, preparando, pronto ou entregue.';
  END IF;

  UPDATE public.fila_cozinha
  SET status = v_status_validado,
      updated_at = NOW()
  WHERE id = p_item_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Item da fila de cozinha não encontrado: %', p_item_id;
  END IF;

  RETURN jsonb_build_object(
    'sucesso', true,
    'id', p_item_id,
    'status', v_status_validado,
    'updated_at', NOW()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.atualizar_status_item_fila(UUID, TEXT) TO authenticated;

-- 7. Seed do usuário Cozinha demo (cozinha@rachide.bar / rachide123)
DO $$
DECLARE
  v_uid_cozinha UUID;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE email = 'cozinha@rachide.bar') THEN
    v_uid_cozinha := gen_random_uuid();
    INSERT INTO auth.users (
      id, instance_id, email, encrypted_password, email_confirmed_at,
      created_at, updated_at, raw_app_meta_data, raw_user_meta_data,
      is_super_admin, role, aud,
      confirmation_token, recovery_token, email_change_token_new,
      email_change, email_change_token_current,
      phone, phone_change, phone_change_token, reauthentication_token
    ) VALUES (
      v_uid_cozinha,
      '00000000-0000-0000-0000-000000000000',
      'cozinha@rachide.bar',
      crypt('rachide123', gen_salt('bf')),
      NOW(), NOW(), NOW(),
      '{"provider": "email", "providers": ["email"]}',
      '{"name": "Equipe Cozinha & Bar"}',
      false, 'authenticated', 'authenticated',
      '', '', '', '', '',
      NULL,
      '', '', ''
    );

    INSERT INTO public.perfis_usuarios (id, email, nome_exibicao, perfil, ativo)
    VALUES (v_uid_cozinha, 'cozinha@rachide.bar', 'Equipe Cozinha & Bar', 'cozinha', true)
    ON CONFLICT (id) DO UPDATE SET perfil = 'cozinha';
  ELSE
    -- Garante que se o usuário já existir por acaso, o perfil é 'cozinha'
    UPDATE public.perfis_usuarios
    SET perfil = 'cozinha'
    WHERE email = 'cozinha@rachide.bar';
  END IF;
END $$;
