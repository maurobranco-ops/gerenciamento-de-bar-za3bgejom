-- Migração: 20261011040000_perfis_auth_and_pedidos_online.sql
-- Implementa:
-- 1. Coluna origem_online em comanda_itens e fila_cozinha
-- 2. Tabela public.perfis_usuarios (id uuid PK refs auth.users, nome_exibicao, perfil text, email, ativo)
-- 3. Functions de segurança is_gerente(), is_caixa(), is_garcom() (SECURITY DEFINER)
-- 4. Trigger on_auth_user_created para provisionar perfil padrão
-- 5. Função RPC SECURITY DEFINER enviar_pedido_online(...) para clientes anônimos
-- 6. Seeds de usuários demo no auth.users (gerente@rachide.bar, caixa@rachide.bar, garcom@rachide.bar, maurobranco@incidesolar.com.br)
-- 7. Endurecimento real das policies RLS por perfil e anon

-- Extensão pgcrypto para senhas se necessário
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

-- 1. Colunas para sinalizar Pedido On-line
ALTER TABLE public.comanda_itens
  ADD COLUMN IF NOT EXISTS origem_online BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE public.fila_cozinha
  ADD COLUMN IF NOT EXISTS origem_online BOOLEAN NOT NULL DEFAULT false;

-- 2. Tabela de perfis reais
CREATE TABLE IF NOT EXISTS public.perfis_usuarios (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL DEFAULT '',
  nome_exibicao TEXT NOT NULL DEFAULT '',
  perfil TEXT NOT NULL DEFAULT 'garcom' CHECK (perfil IN ('garcom', 'caixa', 'gerente')),
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_perfis_usuarios_perfil ON public.perfis_usuarios(perfil);

-- Funções helper de checagem de perfil (Security Definer)
CREATE OR REPLACE FUNCTION public.get_current_user_profile()
RETURNS TEXT AS $$
DECLARE
  v_perfil TEXT;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT perfil INTO v_perfil
  FROM public.perfis_usuarios
  WHERE id = auth.uid() AND ativo = true;

  RETURN v_perfil;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION public.is_gerente()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN COALESCE(public.get_current_user_profile() = 'gerente', false);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION public.is_caixa()
RETURNS BOOLEAN AS $$
DECLARE
  v_p TEXT;
BEGIN
  v_p := public.get_current_user_profile();
  RETURN COALESCE(v_p IN ('gerente', 'caixa'), false);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION public.is_garcom()
RETURNS BOOLEAN AS $$
DECLARE
  v_p TEXT;
BEGIN
  v_p := public.get_current_user_profile();
  RETURN COALESCE(v_p IN ('gerente', 'caixa', 'garcom'), false);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Trigger para provisionar perfil em novos cadastros
CREATE OR REPLACE FUNCTION public.handle_new_user_profile()
RETURNS TRIGGER AS $$
DECLARE
  v_role TEXT := 'garcom';
  v_name TEXT;
BEGIN
  -- Se o email contiver gerente ou admin, concede gerente
  IF NEW.email ILIKE '%gerente%' OR NEW.email ILIKE '%admin%' OR NEW.email = 'maurobranco@incidesolar.com.br' THEN
    v_role := 'gerente';
  ELSIF NEW.email ILIKE '%caixa%' THEN
    v_role := 'caixa';
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

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_profile();

-- Seed de contas de demonstração no auth.users
DO $$
DECLARE
  v_uid_gerente UUID;
  v_uid_caixa UUID;
  v_uid_garcom UUID;
  v_uid_mauro UUID;
BEGIN
  -- 1. GERENTE (gerente@rachide.bar / rachide123)
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE email = 'gerente@rachide.bar') THEN
    v_uid_gerente := gen_random_uuid();
    INSERT INTO auth.users (
      id, instance_id, email, encrypted_password, email_confirmed_at,
      created_at, updated_at, raw_app_meta_data, raw_user_meta_data,
      is_super_admin, role, aud,
      confirmation_token, recovery_token, email_change_token_new,
      email_change, email_change_token_current,
      phone, phone_change, phone_change_token, reauthentication_token
    ) VALUES (
      v_uid_gerente,
      '00000000-0000-0000-0000-000000000000',
      'gerente@rachide.bar',
      crypt('rachide123', gen_salt('bf')),
      NOW(), NOW(), NOW(),
      '{"provider": "email", "providers": ["email"]}',
      '{"name": "Carlos Gerente"}',
      false, 'authenticated', 'authenticated',
      '', '', '', '', '',
      NULL,
      '', '', ''
    );

    INSERT INTO public.perfis_usuarios (id, email, nome_exibicao, perfil, ativo)
    VALUES (v_uid_gerente, 'gerente@rachide.bar', 'Carlos Gerente', 'gerente', true)
    ON CONFLICT (id) DO UPDATE SET perfil = 'gerente';
  END IF;

  -- 2. CAIXA (caixa@rachide.bar / rachide123)
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE email = 'caixa@rachide.bar') THEN
    v_uid_caixa := gen_random_uuid();
    INSERT INTO auth.users (
      id, instance_id, email, encrypted_password, email_confirmed_at,
      created_at, updated_at, raw_app_meta_data, raw_user_meta_data,
      is_super_admin, role, aud,
      confirmation_token, recovery_token, email_change_token_new,
      email_change, email_change_token_current,
      phone, phone_change, phone_change_token, reauthentication_token
    ) VALUES (
      v_uid_caixa,
      '00000000-0000-0000-0000-000000000000',
      'caixa@rachide.bar',
      crypt('rachide123', gen_salt('bf')),
      NOW(), NOW(), NOW(),
      '{"provider": "email", "providers": ["email"]}',
      '{"name": "Marina Caixa"}',
      false, 'authenticated', 'authenticated',
      '', '', '', '', '',
      NULL,
      '', '', ''
    );

    INSERT INTO public.perfis_usuarios (id, email, nome_exibicao, perfil, ativo)
    VALUES (v_uid_caixa, 'caixa@rachide.bar', 'Marina Caixa', 'caixa', true)
    ON CONFLICT (id) DO UPDATE SET perfil = 'caixa';
  END IF;

  -- 3. GARÇOM (garcom@rachide.bar / rachide123)
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE email = 'garcom@rachide.bar') THEN
    v_uid_garcom := gen_random_uuid();
    INSERT INTO auth.users (
      id, instance_id, email, encrypted_password, email_confirmed_at,
      created_at, updated_at, raw_app_meta_data, raw_user_meta_data,
      is_super_admin, role, aud,
      confirmation_token, recovery_token, email_change_token_new,
      email_change, email_change_token_current,
      phone, phone_change, phone_change_token, reauthentication_token
    ) VALUES (
      v_uid_garcom,
      '00000000-0000-0000-0000-000000000000',
      'garcom@rachide.bar',
      crypt('rachide123', gen_salt('bf')),
      NOW(), NOW(), NOW(),
      '{"provider": "email", "providers": ["email"]}',
      '{"name": "Garçom de Salão"}',
      false, 'authenticated', 'authenticated',
      '', '', '', '', '',
      NULL,
      '', '', ''
    );

    INSERT INTO public.perfis_usuarios (id, email, nome_exibicao, perfil, ativo)
    VALUES (v_uid_garcom, 'garcom@rachide.bar', 'Garçom de Salão', 'garcom', true)
    ON CONFLICT (id) DO UPDATE SET perfil = 'garcom';
  END IF;

  -- 4. CONTA MAURO BRANCO (maurobranco@incidesolar.com.br / Skip@Pass)
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE email = 'maurobranco@incidesolar.com.br') THEN
    v_uid_mauro := gen_random_uuid();
    INSERT INTO auth.users (
      id, instance_id, email, encrypted_password, email_confirmed_at,
      created_at, updated_at, raw_app_meta_data, raw_user_meta_data,
      is_super_admin, role, aud,
      confirmation_token, recovery_token, email_change_token_new,
      email_change, email_change_token_current,
      phone, phone_change, phone_change_token, reauthentication_token
    ) VALUES (
      v_uid_mauro,
      '00000000-0000-0000-0000-000000000000',
      'maurobranco@incidesolar.com.br',
      crypt('Skip@Pass', gen_salt('bf')),
      NOW(), NOW(), NOW(),
      '{"provider": "email", "providers": ["email"]}',
      '{"name": "Mauro Branco (Gerente)"}',
      false, 'authenticated', 'authenticated',
      '', '', '', '', '',
      NULL,
      '', '', ''
    );

    INSERT INTO public.perfis_usuarios (id, email, nome_exibicao, perfil, ativo)
    VALUES (v_uid_mauro, 'maurobranco@incidesolar.com.br', 'Mauro Branco', 'gerente', true)
    ON CONFLICT (id) DO UPDATE SET perfil = 'gerente';
  END IF;
END $$;

-- 5. RPC SECURITY DEFINER para envio seguro de pedidos on-line por clientes anônimos
-- Recebe número da mesa (ou null/0 para delivery), nome do cliente, e array json de itens [{produto_id, quantidade, observacoes}]
CREATE OR REPLACE FUNCTION public.enviar_pedido_online(
  p_mesa_numero INTEGER,
  p_cliente_nome TEXT,
  p_itens JSONB
)
RETURNS JSONB AS $$
DECLARE
  v_comanda_id TEXT;
  v_mesa_existe BOOLEAN;
  v_item JSONB;
  v_prod RECORD;
  v_comanda_item_id TEXT;
  v_area TEXT;
  v_itens_inseridos INTEGER := 0;
  v_total_pedido NUMERIC(10,2) := 0.00;
  v_mesa_num INTEGER;
BEGIN
  -- Se mesa for 0 ou null, usamos mesa 10 como mesa virtual de delivery/retirada ou a primeira livre
  v_mesa_num := COALESCE(NULLIF(p_mesa_numero, 0), 10);

  -- Verifica se a mesa existe
  SELECT EXISTS(SELECT 1 FROM public.mesas WHERE numero = v_mesa_num) INTO v_mesa_existe;
  IF NOT v_mesa_existe THEN
    -- Garante existência da mesa
    INSERT INTO public.mesas (numero, status, capacidade)
    VALUES (v_mesa_num, 'Livre', 4)
    ON CONFLICT (numero) DO NOTHING;
  END IF;

  v_comanda_id := 'cmd-' || LPAD(v_mesa_num::text, 2, '0');

  -- Garante ou abre comanda da mesa
  IF NOT EXISTS (SELECT 1 FROM public.comandas WHERE id = v_comanda_id) THEN
    INSERT INTO public.comandas (id, mesa_numero, cliente_nome, pessoas, status, aberta_em, total)
    VALUES (v_comanda_id, v_mesa_num, COALESCE(NULLIF(trim(p_cliente_nome), ''), 'Cliente On-line'), 1, 'Ocupada', NOW(), 0.00);
  ELSE
    UPDATE public.comandas
    SET status = 'Ocupada',
        cliente_nome = COALESCE(NULLIF(trim(p_cliente_nome), ''), comandas.cliente_nome, 'Cliente On-line'),
        aberta_em = COALESCE(aberta_em, NOW()),
        updated_at = NOW()
    WHERE id = v_comanda_id;
  END IF;

  -- Marca mesa como Ocupada
  UPDATE public.mesas
  SET status = 'Ocupada', updated_at = NOW()
  WHERE numero = v_mesa_num;

  -- Itera sobre os itens do pedido
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_itens)
  LOOP
    SELECT * INTO v_prod
    FROM public.produtos
    WHERE id = (v_item->>'produto_id') AND ativo = true;

    IF FOUND THEN
      v_comanda_item_id := 'ci-onl-' || floor(extract(epoch from clock_timestamp()) * 1000)::text || '-' || floor(random() * 9000 + 1000)::text;

      -- Insere o item na comanda com origem_online = true
      INSERT INTO public.comanda_itens (
        id,
        comanda_id,
        produto_id,
        nome_produto,
        preco_unitario,
        quantidade,
        observacoes,
        origem_online
      ) VALUES (
        v_comanda_item_id,
        v_comanda_id,
        v_prod.id,
        v_prod.nome,
        v_prod.preco,
        GREATEST(1, COALESCE((v_item->>'quantidade')::integer, 1)),
        NULLIF(trim(v_item->>'observacoes'), ''),
        true
      );

      -- Determina área de preparo
      v_area := COALESCE(v_prod.area_preparo, 'bar');

      -- Insere na fila de cozinha com origem_online = true
      INSERT INTO public.fila_cozinha (
        comanda_item_id,
        area_preparo,
        status,
        observacoes,
        origem_online
      ) VALUES (
        v_comanda_item_id,
        v_area,
        'pendente',
        COALESCE(NULLIF(trim(v_item->>'observacoes'), ''), 'Pedido On-line'),
        true
      );

      -- Baixa de estoque controlada
      UPDATE public.produtos
      SET estoque = GREATEST(0.00, estoque - GREATEST(1, COALESCE((v_item->>'quantidade')::integer, 1))),
          updated_at = NOW()
      WHERE id = v_prod.id;

      v_itens_inseridos := v_itens_inseridos + 1;
      v_total_pedido := v_total_pedido + (v_prod.preco * GREATEST(1, COALESCE((v_item->>'quantidade')::integer, 1)));
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'sucesso', true,
    'comanda_id', v_comanda_id,
    'mesa_numero', v_mesa_num,
    'itens_inseridos', v_itens_inseridos,
    'total_pedido', v_total_pedido,
    'mensagem', 'Pedido on-line registrado com sucesso e enviado para a fila!'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Permite anon e authenticated executarem enviar_pedido_online
GRANT EXECUTE ON FUNCTION public.enviar_pedido_online(INTEGER, TEXT, JSONB) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_current_user_profile() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_gerente() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_caixa() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_garcom() TO anon, authenticated;

-- 6. RLS NA TABELA DE PERFIS
ALTER TABLE public.perfis_usuarios ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "perfis_usuarios_select" ON public.perfis_usuarios;
CREATE POLICY "perfis_usuarios_select" ON public.perfis_usuarios
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "perfis_usuarios_manage" ON public.perfis_usuarios;
CREATE POLICY "perfis_usuarios_manage" ON public.perfis_usuarios
  FOR ALL TO authenticated USING (public.is_gerente()) WITH CHECK (public.is_gerente());

-- 7. ENDURECIMENTO RLS NAS TABELAS PRINCIPAIS CONFORME PASSO 3

-- PRODUTOS:
-- anon: pode ler apenas produtos ativos
-- garcom e caixa: leitura de produtos
-- gerente: tudo (exceto delete que é desativação lógica)
DROP POLICY IF EXISTS "produtos_select_policy" ON public.produtos;
DROP POLICY IF EXISTS "produtos_insert_policy" ON public.produtos;
DROP POLICY IF EXISTS "produtos_update_policy" ON public.produtos;

CREATE POLICY "produtos_select_policy" ON public.produtos
  FOR SELECT TO anon, authenticated
  USING (
    ativo = true OR (auth.role() = 'authenticated')
  );

CREATE POLICY "produtos_insert_policy" ON public.produtos
  FOR INSERT TO authenticated
  WITH CHECK (public.is_gerente());

CREATE POLICY "produtos_update_policy" ON public.produtos
  FOR UPDATE TO authenticated
  USING (public.is_gerente() OR public.is_caixa() OR public.is_garcom())
  WITH CHECK (preco >= 0);

-- MESAS:
-- Leitura permitida para anon (para verificar mesa no pedido on-line) e autenticados
-- Insert/Delete apenas Gerente
-- Update permitido para garcom/caixa/gerente (status da mesa)
DROP POLICY IF EXISTS "mesas_select_policy" ON public.mesas;
DROP POLICY IF EXISTS "mesas_insert_policy" ON public.mesas;
DROP POLICY IF EXISTS "mesas_update_policy" ON public.mesas;
DROP POLICY IF EXISTS "mesas_delete_policy" ON public.mesas;

CREATE POLICY "mesas_select_policy" ON public.mesas
  FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "mesas_insert_policy" ON public.mesas
  FOR INSERT TO authenticated WITH CHECK (public.is_gerente());

CREATE POLICY "mesas_update_policy" ON public.mesas
  FOR UPDATE TO authenticated USING (public.is_garcom()) WITH CHECK (capacidade > 0);

CREATE POLICY "mesas_delete_policy" ON public.mesas
  FOR DELETE TO authenticated USING (public.is_gerente());

-- COMANDAS E ITENS:
-- Leitura permitida para autenticados e anon (apenas select básico de status)
-- Escrita: autenticados (garcom, caixa, gerente); anon escreve exclusivamente via RPC enviar_pedido_online
DROP POLICY IF EXISTS "comandas_select_policy" ON public.comandas;
DROP POLICY IF EXISTS "comandas_insert_policy" ON public.comandas;
DROP POLICY IF EXISTS "comandas_update_policy" ON public.comandas;
DROP POLICY IF EXISTS "comandas_delete_policy" ON public.comandas;

CREATE POLICY "comandas_select_policy" ON public.comandas
  FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "comandas_insert_policy" ON public.comandas
  FOR INSERT TO authenticated WITH CHECK (public.is_garcom());

CREATE POLICY "comandas_update_policy" ON public.comandas
  FOR UPDATE TO authenticated USING (public.is_garcom()) WITH CHECK (true);

CREATE POLICY "comandas_delete_policy" ON public.comandas
  FOR DELETE TO authenticated USING (public.is_gerente());

DROP POLICY IF EXISTS "comanda_itens_select_policy" ON public.comanda_itens;
DROP POLICY IF EXISTS "comanda_itens_insert_policy" ON public.comanda_itens;
DROP POLICY IF EXISTS "comanda_itens_update_policy" ON public.comanda_itens;
DROP POLICY IF EXISTS "comanda_itens_delete_policy" ON public.comanda_itens;

CREATE POLICY "comanda_itens_select_policy" ON public.comanda_itens
  FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "comanda_itens_insert_policy" ON public.comanda_itens
  FOR INSERT TO authenticated WITH CHECK (public.is_garcom() AND quantidade > 0);

CREATE POLICY "comanda_itens_update_policy" ON public.comanda_itens
  FOR UPDATE TO authenticated USING (public.is_garcom()) WITH CHECK (quantidade >= 0);

CREATE POLICY "comanda_itens_delete_policy" ON public.comanda_itens
  FOR DELETE TO authenticated USING (public.is_garcom());

-- FILA DE COZINHA:
DROP POLICY IF EXISTS "fila_cozinha_select_policy" ON public.fila_cozinha;
DROP POLICY IF EXISTS "fila_cozinha_insert_policy" ON public.fila_cozinha;
DROP POLICY IF EXISTS "fila_cozinha_update_policy" ON public.fila_cozinha;
DROP POLICY IF EXISTS "fila_cozinha_delete_policy" ON public.fila_cozinha;

CREATE POLICY "fila_cozinha_select_policy" ON public.fila_cozinha
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "fila_cozinha_insert_policy" ON public.fila_cozinha
  FOR INSERT TO authenticated WITH CHECK (public.is_garcom());

CREATE POLICY "fila_cozinha_update_policy" ON public.fila_cozinha
  FOR UPDATE TO authenticated USING (public.is_garcom());

CREATE POLICY "fila_cozinha_delete_policy" ON public.fila_cozinha
  FOR DELETE TO authenticated USING (public.is_gerente() OR public.is_garcom());

-- MOVIMENTACOES DE ESTOQUE:
DROP POLICY IF EXISTS "movimentacoes_estoque_select_policy" ON public.movimentacoes_estoque;
DROP POLICY IF EXISTS "movimentacoes_estoque_insert_policy" ON public.movimentacoes_estoque;

CREATE POLICY "movimentacoes_estoque_select_policy" ON public.movimentacoes_estoque
  FOR SELECT TO authenticated USING (public.is_gerente() OR public.is_caixa());

CREATE POLICY "movimentacoes_estoque_insert_policy" ON public.movimentacoes_estoque
  FOR INSERT TO authenticated WITH CHECK (public.is_gerente() OR public.is_caixa());

-- MOVIMENTOS DE CAIXA:
DROP POLICY IF EXISTS "movimentos_caixa_select_policy" ON public.movimentos_caixa;
DROP POLICY IF EXISTS "movimentos_caixa_insert_policy" ON public.movimentos_caixa;

CREATE POLICY "movimentos_caixa_select_policy" ON public.movimentos_caixa
  FOR SELECT TO authenticated USING (public.is_caixa());

CREATE POLICY "movimentos_caixa_insert_policy" ON public.movimentos_caixa
  FOR INSERT TO authenticated WITH CHECK (public.is_caixa());

-- CAIXA DIARIOS:
DROP POLICY IF EXISTS "caixa_diarios_select_policy" ON public.caixa_diarios;
DROP POLICY IF EXISTS "caixa_diarios_insert_policy" ON public.caixa_diarios;
DROP POLICY IF EXISTS "caixa_diarios_update_policy" ON public.caixa_diarios;

CREATE POLICY "caixa_diarios_select_policy" ON public.caixa_diarios
  FOR SELECT TO authenticated USING (public.is_caixa());

CREATE POLICY "caixa_diarios_insert_policy" ON public.caixa_diarios
  FOR INSERT TO authenticated WITH CHECK (public.is_caixa());

CREATE POLICY "caixa_diarios_update_policy" ON public.caixa_diarios
  FOR UPDATE TO authenticated USING (public.is_caixa());

-- DOCUMENTOS FISCAIS:
DROP POLICY IF EXISTS "documentos_fiscais_select_policy" ON public.documentos_fiscais;
DROP POLICY IF EXISTS "documentos_fiscais_insert_policy" ON public.documentos_fiscais;
DROP POLICY IF EXISTS "documentos_fiscais_update_policy" ON public.documentos_fiscais;

CREATE POLICY "documentos_fiscais_select_policy" ON public.documentos_fiscais
  FOR SELECT TO authenticated USING (public.is_caixa());

CREATE POLICY "documentos_fiscais_insert_policy" ON public.documentos_fiscais
  FOR INSERT TO authenticated WITH CHECK (public.is_caixa());

CREATE POLICY "documentos_fiscais_update_policy" ON public.documentos_fiscais
  FOR UPDATE TO authenticated USING (public.is_caixa());
