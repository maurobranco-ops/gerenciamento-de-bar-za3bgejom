-- Migração: 20261011220000_storage_produtos_and_admin_users.sql
-- 1. Criação do bucket público de imagens de produtos "produtos"
-- 2. Políticas de Storage para o bucket "produtos" (SELECT público, INSERT/UPDATE/DELETE apenas para Gerente autenticado)
-- 3. Functions RPC de segurança com verificação de Gerente para gestão de usuários:
--    - admin_criar_usuario (cria no auth.users e perfis_usuarios)
--    - admin_atualizar_perfil_usuario (atualiza perfil e nome com trava para auto-rebaixamento)
--    - admin_redefinir_senha_usuario (redefine senha de um usuário no auth.users)
--    - admin_listar_usuarios (lista usuários do auth.users com dados de perfil sincronizados)

-- 1. Inserção do bucket "produtos" em storage.buckets
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'produtos',
  'produtos',
  true,
  5242880, -- 5 MB limite
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif']
)
ON CONFLICT (id) DO UPDATE
SET public = true,
    allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif'];

-- 2. Políticas em storage.objects para o bucket "produtos"
DROP POLICY IF EXISTS "produtos_storage_public_read" ON storage.objects;
CREATE POLICY "produtos_storage_public_read"
  ON storage.objects
  FOR SELECT
  TO public
  USING (bucket_id = 'produtos');

DROP POLICY IF EXISTS "produtos_storage_gerente_insert" ON storage.objects;
CREATE POLICY "produtos_storage_gerente_insert"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'produtos' AND (public.is_gerente())
  );

DROP POLICY IF EXISTS "produtos_storage_gerente_update" ON storage.objects;
CREATE POLICY "produtos_storage_gerente_update"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (bucket_id = 'produtos' AND (public.is_gerente()))
  WITH CHECK (bucket_id = 'produtos' AND (public.is_gerente()));

DROP POLICY IF EXISTS "produtos_storage_gerente_delete" ON storage.objects;
CREATE POLICY "produtos_storage_gerente_delete"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (bucket_id = 'produtos' AND (public.is_gerente()));

-- 3. Functions de Gestão de Usuários pelo Gerente (SECURITY DEFINER)

-- 3.1 Listar usuários com dados consolidados
CREATE OR REPLACE FUNCTION public.admin_listar_usuarios()
RETURNS TABLE (
  id UUID,
  email VARCHAR,
  nome_exibicao TEXT,
  perfil TEXT,
  ativo BOOLEAN,
  created_at TIMESTAMPTZ,
  last_sign_in_at TIMESTAMPTZ
) AS $$
BEGIN
  IF NOT public.is_gerente() THEN
    RAISE EXCEPTION 'Apenas usuários com perfil Gerente podem listar a equipe.';
  END IF;

  RETURN QUERY
  SELECT
    u.id,
    u.email::VARCHAR,
    COALESCE(p.nome_exibicao, u.raw_user_meta_data->>'name', split_part(u.email, '@', 1))::TEXT AS nome_exibicao,
    COALESCE(p.perfil, 'garcom')::TEXT AS perfil,
    COALESCE(p.ativo, true)::BOOLEAN AS ativo,
    u.created_at,
    u.last_sign_in_at
  FROM auth.users u
  LEFT JOIN public.perfis_usuarios p ON p.id = u.id
  ORDER BY u.created_at ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3.2 Criar Usuário pelo Gerente
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
  IF v_perfil_validado NOT IN ('garcom', 'caixa', 'gerente') THEN
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

-- 3.3 Alterar Perfil de Usuário
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
  IF v_perfil_validado NOT IN ('garcom', 'caixa', 'gerente') THEN
    RAISE EXCEPTION 'Perfil inválido: use garcom, caixa ou gerente.';
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

-- 3.4 Redefinir Senha pelo Gerente
CREATE OR REPLACE FUNCTION public.admin_redefinir_senha_usuario(
  p_user_id UUID,
  p_nova_senha TEXT
)
RETURNS JSONB AS $$
BEGIN
  IF NOT public.is_gerente() THEN
    RAISE EXCEPTION 'Acesso negado: apenas Gerente pode redefinir senhas.';
  END IF;

  IF p_nova_senha IS NULL OR char_length(p_nova_senha) < 6 THEN
    RAISE EXCEPTION 'A nova senha deve ter no mínimo 6 caracteres.';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = p_user_id) THEN
    RAISE EXCEPTION 'Usuário não encontrado.';
  END IF;

  UPDATE auth.users
  SET encrypted_password = crypt(p_nova_senha, gen_salt('bf')),
      updated_at = NOW(),
      recovery_token = ''
  WHERE id = p_user_id;

  RETURN jsonb_build_object(
    'sucesso', true,
    'id', p_user_id,
    'mensagem', 'Senha do usuário redefinida com sucesso!'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Permissões de execução para authenticated
GRANT EXECUTE ON FUNCTION public.admin_listar_usuarios() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_criar_usuario(TEXT, TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_atualizar_perfil_usuario(UUID, TEXT, TEXT, BOOLEAN) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_redefinir_senha_usuario(UUID, TEXT) TO authenticated;
