-- ============================================================================
-- FASE 1 — MULTI-TENANT: tabela estabelecimentos + isolamento por RLS
-- Rachide Bar = primeiro tenant (todos os dados existentes vinculados a ele).
-- ============================================================================
-- Tenant Rachide Bar (fixo, usado como default de todas as tabelas operacionais)
-- Tenant de demonstração (isola dados próprios; valida o isolamento por RLS)

-- 1. Tabela de estabelecimentos (tenants)
CREATE TABLE IF NOT EXISTS public.estabelecimentos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  cnpj text,
  ativo boolean NOT NULL DEFAULT true,
  taxa_servico_padrao numeric NOT NULL DEFAULT 10.00,
  pix_chave text,
  pix_beneficiario_nome text,
  pix_cidade text,
  razao_social text,
  nome_fantasia text,
  inscricao_estadual text,
  endereco_completo text,
  telefone text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.estabelecimentos ENABLE ROW LEVEL SECURITY;

-- 2. Tenant Rachide Bar a partir das configurações globais existentes (nada é perdido)
INSERT INTO public.estabelecimentos (
  id, nome, cnpj, ativo, taxa_servico_padrao,
  pix_chave, pix_beneficiario_nome, pix_cidade,
  razao_social, nome_fantasia, inscricao_estadual, endereco_completo, telefone
)
SELECT
  'a0000000-0000-0000-0000-000000000001'::uuid,
  COALESCE(c.nome_fantasia, 'Rachide Bar'),
  c.cnpj,
  true,
  COALESCE(c.taxa_servico_padrao, 10.00),
  c.pix_chave,
  c.pix_beneficiario_nome,
  c.pix_cidade,
  c.razao_social,
  c.nome_fantasia,
  c.inscricao_estadual,
  c.endereco_completo,
  c.telefone
FROM public.configuracoes_bar c
WHERE c.id = 'principal'
ON CONFLICT (id) DO NOTHING;

-- Garante o tenant Rachide mesmo sem linha em configuracoes_bar
INSERT INTO public.estabelecimentos (id, nome, cnpj, ativo)
VALUES ('a0000000-0000-0000-0000-000000000001'::uuid, 'Rachide Bar', '14.293.842/0001-84', true)
ON CONFLICT (id) DO NOTHING;

-- Tenant de demonstração (para validar o isolamento entre estabelecimentos)
INSERT INTO public.estabelecimentos (id, nome, cnpj, ativo)
VALUES ('a0000000-0000-0000-0000-000000000002'::uuid, 'Bistrô Demonstração', '00.000.000/00001-91', true)
ON CONFLICT (id) DO NOTHING;

-- 3. Configuração por estabelecimento: linha 'principal' vira a config do Rachide;
--    cada tenant novo recebe sua própria linha (id = uuid do tenant).
-- O Rachide Bar continua usando a linha 'principal' (que a tela Configurações edita);
-- nenhum tenant novo entra na fase 1 operando, mas cada um já nasce com sua linha.
INSERT INTO public.configuracoes_bar (
  id, taxa_servico_padrao, taxa_entrega_delivery,
  razao_social, nome_fantasia, cnpj, inscricao_estadual,
  endereco_completo, telefone,
  pix_chave, pix_beneficiario_nome, pix_cidade
)
SELECT
  e.id::text, e.taxa_servico_padrao, 7.50,
  COALESCE(e.razao_social, e.nome), e.nome, e.cnpj, COALESCE(e.inscricao_estadual, 'Isento'),
  COALESCE(e.endereco_completo, ''), COALESCE(e.telefone, ''),
  e.pix_chave, e.pix_beneficiario_nome, e.pix_cidade
FROM public.estabelecimentos e
WHERE e.id <> 'a0000000-0000-0000-0000-000000000001'::uuid
ON CONFLICT (id) DO NOTHING;

-- Segurança: se por acaso não existir a configuração 'principal' do Rachide, recria
INSERT INTO public.configuracoes_bar (
  id, taxa_servico_padrao, taxa_entrega_delivery,
  razao_social, nome_fantasia, cnpj, inscricao_estadual,
  endereco_completo, telefone,
  pix_chave, pix_beneficiario_nome, pix_cidade
)
SELECT
  'principal', e.taxa_servico_padrao, 7.50,
  COALESCE(e.razao_social, e.nome), e.nome, e.cnpj, COALESCE(e.inscricao_estadual, 'Isento'),
  COALESCE(e.endereco_completo, ''), COALESCE(e.telefone, ''),
  e.pix_chave, e.pix_beneficiario_nome, e.pix_cidade
FROM public.estabelecimentos e
WHERE e.id = 'a0000000-0000-0000-0000-000000000001'::uuid
  AND NOT EXISTS (SELECT 1 FROM public.configuracoes_bar WHERE id = 'principal')
ON CONFLICT (id) DO NOTHING;
=======

-- 4. Coluna de estabelecimento (tenant_id) em TODAS as tabelas operacionais,
--    com default = Rachide Bar para que os dados atuais fiquem vinculados a ele.
ALTER TABLE public.mesas                ADD COLUMN IF NOT EXISTS estabelecimento_id uuid REFERENCES public.estabelecimentos(id);
ALTER TABLE public.comandas             ADD COLUMN IF NOT EXISTS estabelecimento_id uuid REFERENCES public.estabelecimentos(id);
ALTER TABLE public.comanda_itens        ADD COLUMN IF NOT EXISTS estabelecimento_id uuid REFERENCES public.estabelecimentos(id);
ALTER TABLE public.fila_cozinha         ADD COLUMN IF NOT EXISTS estabelecimento_id uuid REFERENCES public.estabelecimentos(id);
ALTER TABLE public.produtos             ADD COLUMN IF NOT EXISTS estabelecimento_id uuid REFERENCES public.estabelecimentos(id);
ALTER TABLE public.movimentacoes_estoque ADD COLUMN IF NOT EXISTS estabelecimento_id uuid REFERENCES public.estabelecimentos(id);
ALTER TABLE public.movimentos_caixa     ADD COLUMN IF NOT EXISTS estabelecimento_id uuid REFERENCES public.estabelecimentos(id);
ALTER TABLE public.caixa_diarios        ADD COLUMN IF NOT EXISTS estabelecimento_id uuid REFERENCES public.estabelecimentos(id);
ALTER TABLE public.documentos_fiscais   ADD COLUMN IF NOT EXISTS estabelecimento_id uuid REFERENCES public.estabelecimentos(id);
ALTER TABLE public.perfis_usuarios      ADD COLUMN IF NOT EXISTS estabelecimento_id uuid REFERENCES public.estabelecimentos(id);

UPDATE public.mesas                 SET estabelecimento_id = 'a0000000-0000-0000-0000-000000000001'::uuid WHERE estabelecimento_id IS NULL;
UPDATE public.comandas              SET estabelecimento_id = 'a0000000-0000-0000-0000-000000000001'::uuid WHERE estabelecimento_id IS NULL;
UPDATE public.comanda_itens         SET estabelecimento_id = 'a0000000-0000-0000-0000-000000000001'::uuid WHERE estabelecimento_id IS NULL;
UPDATE public.fila_cozinha          SET estabelecimento_id = 'a0000000-0000-0000-0000-000000000001'::uuid WHERE estabelecimento_id IS NULL;
UPDATE public.produtos              SET estabelecimento_id = 'a0000000-0000-0000-0000-000000000001'::uuid WHERE estabelecimento_id IS NULL;
UPDATE public.movimentacoes_estoque SET estabelecimento_id = 'a0000000-0000-0000-0000-000000000001'::uuid WHERE estabelecimento_id IS NULL;
UPDATE public.movimentos_caixa      SET estabelecimento_id = 'a0000000-0000-0000-0000-000000000001'::uuid WHERE estabelecimento_id IS NULL;
UPDATE public.caixa_diarios         SET estabelecimento_id = 'a0000000-0000-0000-0000-000000000001'::uuid WHERE estabelecimento_id IS NULL;
UPDATE public.documentos_fiscais    SET estabelecimento_id = 'a0000000-0000-0000-0000-000000000001'::uuid WHERE estabelecimento_id IS NULL;
UPDATE public.perfis_usuarios       SET estabelecimento_id = 'a0000000-0000-0000-0000-000000000001'::uuid WHERE estabelecimento_id IS NULL;

-- Defaults: novos registros nascem vinculados ao estabelecimento do usuário
-- logado (fallback: Rachide Bar, o tenant padrão da fase 1).
CREATE OR REPLACE FUNCTION public.estabelecimento_id_padrao()
RETURNS uuid
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $function$
BEGIN
  RETURN COALESCE(public.estabelecimento_id_do_usuario(), 'a0000000-0000-0000-0000-000000000001'::uuid);
END;
$function$;

ALTER TABLE public.mesas                 ALTER COLUMN estabelecimento_id SET DEFAULT public.estabelecimento_id_padrao();
ALTER TABLE public.comandas              ALTER COLUMN estabelecimento_id SET DEFAULT public.estabelecimento_id_padrao();
ALTER TABLE public.comanda_itens         ALTER COLUMN estabelecimento_id SET DEFAULT public.estabelecimento_id_padrao();
ALTER TABLE public.fila_cozinha          ALTER COLUMN estabelecimento_id SET DEFAULT public.estabelecimento_id_padrao();
ALTER TABLE public.produtos              ALTER COLUMN estabelecimento_id SET DEFAULT public.estabelecimento_id_padrao();
ALTER TABLE public.movimentacoes_estoque ALTER COLUMN estabelecimento_id SET DEFAULT public.estabelecimento_id_padrao();
ALTER TABLE public.movimentos_caixa      ALTER COLUMN estabelecimento_id SET DEFAULT public.estabelecimento_id_padrao();
ALTER TABLE public.caixa_diarios         ALTER COLUMN estabelecimento_id SET DEFAULT public.estabelecimento_id_padrao();
ALTER TABLE public.documentos_fiscais    ALTER COLUMN estabelecimento_id SET DEFAULT public.estabelecimento_id_padrao();
ALTER TABLE public.perfis_usuarios       ALTER COLUMN estabelecimento_id SET DEFAULT public.estabelecimento_id_padrao();

ALTER TABLE public.mesas                 ALTER COLUMN estabelecimento_id SET NOT NULL;
ALTER TABLE public.comandas              ALTER COLUMN estabelecimento_id SET NOT NULL;
ALTER TABLE public.comanda_itens         ALTER COLUMN estabelecimento_id SET NOT NULL;
ALTER TABLE public.fila_cozinha          ALTER COLUMN estabelecimento_id SET NOT NULL;
ALTER TABLE public.produtos              ALTER COLUMN estabelecimento_id SET NOT NULL;
ALTER TABLE public.movimentacoes_estoque ALTER COLUMN estabelecimento_id SET NOT NULL;
ALTER TABLE public.movimentos_caixa      ALTER COLUMN estabelecimento_id SET NOT NULL;
ALTER TABLE public.caixa_diarios         ALTER COLUMN estabelecimento_id SET NOT NULL;
ALTER TABLE public.documentos_fiscais    ALTER COLUMN estabelecimento_id SET NOT NULL;
ALTER TABLE public.perfis_usuarios       ALTER COLUMN estabelecimento_id SET NOT NULL;

-- Índices por tenant
CREATE INDEX IF NOT EXISTS idx_mesas_estabelecimento      ON public.mesas (estabelecimento_id, numero);
CREATE INDEX IF NOT EXISTS idx_comandas_estabelecimento   ON public.comandas (estabelecimento_id, mesa_numero);
CREATE INDEX IF NOT EXISTS idx_comanda_itens_estabelec    ON public.comanda_itens (estabelecimento_id);
CREATE INDEX IF NOT EXISTS idx_fila_cozinha_estabelec     ON public.fila_cozinha (estabelecimento_id, status);
CREATE INDEX IF NOT EXISTS idx_produtos_estabelecimento   ON public.produtos (estabelecimento_id, ativo, categoria);
CREATE INDEX IF NOT EXISTS idx_mov_estq_estabelecimento   ON public.movimentacoes_estoque (estabelecimento_id, data_hora DESC);
CREATE INDEX IF NOT EXISTS idx_mov_caixa_estabelecimento  ON public.movimentos_caixa (estabelecimento_id, data_hora DESC);
CREATE INDEX IF NOT EXISTS idx_doc_fisc_estabelecimento   ON public.documentos_fiscais (estabelecimento_id, emitido_em DESC);
CREATE INDEX IF NOT EXISTS idx_perfis_estabelecimento     ON public.perfis_usuarios (estabelecimento_id);

-- Mesas são identificadas por número DENTRO de cada estabelecimento
ALTER TABLE public.mesas DROP CONSTRAINT IF EXISTS mesas_numero_key;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'mesas_estab_numero_key' AND conrelid = 'public.mesas'::regclass
  ) THEN
    ALTER TABLE public.mesas ADD CONSTRAINT mesas_estab_numero_key UNIQUE (estabelecimento_id, numero);
  END IF;
END $$;

-- Caixa diário: um fechamento por dia POR estabelecimento
ALTER TABLE public.caixa_diarios DROP CONSTRAINT IF EXISTS caixa_diarios_pkey;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'caixa_diarios_estab_data_pkey' AND conrelid = 'public.caixa_diarios'::regclass
  ) THEN
    ALTER TABLE public.caixa_diarios ADD CONSTRAINT caixa_diarios_estab_data_pkey PRIMARY KEY (estabelecimento_id, data);
  END IF;
END $$;

-- Mesas de demonstração do Bistrô Demonstração (dados isolados próprios)
INSERT INTO public.mesas (estabelecimento_id, numero, status, capacidade)
VALUES
  ('a0000000-0000-0000-0000-000000000002'::uuid, 90, 'Livre', 2),
  ('a0000000-0000-0000-0000-000000000002'::uuid, 91, 'Livre', 4)
ON CONFLICT (estabelecimento_id, numero) DO NOTHING;

-- ============================================================================
-- 5. Helpers de sessão por tenant
-- ============================================================================
CREATE OR REPLACE FUNCTION public.estabelecimento_id_sessao()
RETURNS uuid
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_raw TEXT;
  v_id UUID;
BEGIN
  v_raw := NULLIF(current_setting('app.estabelecimento_id', true), '');
  IF v_raw IS NULL THEN
    -- Sem seleção na sessão: assume o tenant padrão (Rachide Bar) — compatibilidade
    -- com sessões antigas e com as RPCs existentes.
    RETURN 'a0000000-0000-0000-0000-000000000001'::uuid;
  END IF;
  BEGIN
    v_id := v_raw::uuid;
  EXCEPTION WHEN invalid_text_representation THEN
    RETURN 'a0000000-0000-0000-0000-000000000001'::uuid;
  END;
  RETURN v_id;
END;
$function$;

-- Estabelecimento do usuário logado (fallback: tenant da sessão)
CREATE OR REPLACE FUNCTION public.estabelecimento_id_do_usuario()
RETURNS uuid
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_id UUID;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN public.estabelecimento_id_sessao();
  END IF;
  SELECT estabelecimento_id INTO v_id
  FROM public.perfis_usuarios
  WHERE id = auth.uid()
  LIMIT 1;
  RETURN COALESCE(v_id, public.estabelecimento_id_sessao());
END;
$function$;

-- 6. Perfis e papéis agora são avaliados DENTRO do estabelecimento do usuário
CREATE OR REPLACE FUNCTION public.get_current_user_profile()
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_perfil TEXT;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN NULL;
  END IF;
  SELECT perfil INTO v_perfil
  FROM public.perfis_usuarios
  WHERE id = auth.uid()
    AND (estabelecimento_id IS NULL OR estabelecimento_id = public.estabelecimento_id_do_usuario())
  LIMIT 1;
  RETURN v_perfil;
END;
$function$;

CREATE OR REPLACE FUNCTION public.is_garcom()
RETURNS boolean
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $function$
DECLARE v_p TEXT;
BEGIN
  v_p := public.get_current_user_profile();
  RETURN COALESCE(v_p IN ('gerente', 'caixa', 'garcom'), false);
END;
$function$;

CREATE OR REPLACE FUNCTION public.is_caixa()
RETURNS boolean
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $function$
DECLARE v_p TEXT;
BEGIN
  v_p := public.get_current_user_profile();
  RETURN COALESCE(v_p IN ('gerente', 'caixa'), false);
END;
$function$;

CREATE OR REPLACE FUNCTION public.is_gerente()
RETURNS boolean
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $function$
BEGIN
  RETURN COALESCE(public.get_current_user_profile() = 'gerente', false);
END;
$function$;

CREATE OR REPLACE FUNCTION public.is_cozinha()
RETURNS boolean
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $function$
BEGIN
  RETURN COALESCE(public.get_current_user_profile() = 'cozinha', false);
END;
$function$;

CREATE OR REPLACE FUNCTION public.is_operador_cozinha()
RETURNS boolean
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $function$
DECLARE v_p TEXT;
BEGIN
  v_p := public.get_current_user_profile();
  RETURN COALESCE(v_p IN ('gerente', 'caixa', 'garcom', 'cozinha'), false);
END;
$function$;

-- Vincula o usuário logado ao estabelecimento informado no login
-- (só funciona se o perfil ainda não estiver vinculado a outro tenant).
CREATE OR REPLACE FUNCTION public.vincular_estabelecimento_usuario(p_estabelecimento_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_atual UUID;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Não autenticado.' USING ERRCODE = '42501';
  END IF;
  IF p_estabelecimento_id IS NULL THEN
    RETURN jsonb_build_object('sucesso', false, 'mensagem', 'Estabelecimento não informado.');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.estabelecimentos WHERE id = p_estabelecimento_id AND ativo = true) THEN
    RETURN jsonb_build_object('sucesso', false, 'mensagem', 'Estabelecimento inexistente ou inativo.');
  END IF;

  SELECT estabelecimento_id INTO v_atual FROM public.perfis_usuarios WHERE id = auth.uid();
  IF NOT FOUND THEN
    RETURN jsonb_build_object('sucesso', false, 'mensagem', 'Perfil do usuário não encontrado.');
  END IF;

  IF v_atual IS NOT NULL AND v_atual <> p_estabelecimento_id THEN
    RETURN jsonb_build_object(
      'sucesso', false,
      'codigo', 'JA_VINCULADO',
      'estabelecimento_atual', v_atual,
      'mensagem', 'Este usuário pertence a outro estabelecimento.'
    );
  END IF;

  UPDATE public.perfis_usuarios
  SET estabelecimento_id = p_estabelecimento_id, updated_at = now()
  WHERE id = auth.uid();

  RETURN jsonb_build_object('sucesso', true, 'estabelecimento_id', p_estabelecimento_id);
END;
$function$;

-- 7. RLS por estabelecimento — políticas reescritas mantendo os papéis existentes
DROP POLICY IF EXISTS "mesas_select_policy" ON public.mesas;
DROP POLICY IF EXISTS "mesas_insert_policy" ON public.mesas;
DROP POLICY IF EXISTS "mesas_update_policy" ON public.mesas;
DROP POLICY IF EXISTS "mesas_delete_policy" ON public.mesas;
CREATE POLICY "mesas_select_policy" ON public.mesas
  FOR SELECT TO anon, authenticated
  USING (
    auth.role() = 'anon'
    OR estabelecimento_id = public.estabelecimento_id_do_usuario()
  );
CREATE POLICY "mesas_insert_policy" ON public.mesas
  FOR INSERT TO authenticated
  WITH CHECK (is_gerente() AND estabelecimento_id = public.estabelecimento_id_do_usuario());
CREATE POLICY "mesas_update_policy" ON public.mesas
  FOR UPDATE TO authenticated
  USING (is_garcom() AND estabelecimento_id = public.estabelecimento_id_do_usuario())
  WITH CHECK (capacidade > 0);
CREATE POLICY "mesas_delete_policy" ON public.mesas
  FOR DELETE TO authenticated
  USING (is_gerente() AND estabelecimento_id = public.estabelecimento_id_do_usuario());

DROP POLICY IF EXISTS "comandas_select_policy" ON public.comandas;
DROP POLICY IF EXISTS "comandas_insert_policy" ON public.comandas;
DROP POLICY IF EXISTS "comandas_update_policy" ON public.comandas;
DROP POLICY IF EXISTS "comandas_delete_policy" ON public.comandas;
CREATE POLICY "comandas_select_policy" ON public.comandas
  FOR SELECT TO anon, authenticated
  USING (
    auth.role() = 'anon'
    OR estabelecimento_id = public.estabelecimento_id_do_usuario()
  );
CREATE POLICY "comandas_insert_policy" ON public.comandas
  FOR INSERT TO authenticated
  WITH CHECK (is_garcom() AND estabelecimento_id = public.estabelecimento_id_do_usuario());
CREATE POLICY "comandas_update_policy" ON public.comandas
  FOR UPDATE TO authenticated
  USING (is_garcom() AND estabelecimento_id = public.estabelecimento_id_do_usuario())
  WITH CHECK (true);
CREATE POLICY "comandas_delete_policy" ON public.comandas
  FOR DELETE TO authenticated
  USING (is_gerente() AND estabelecimento_id = public.estabelecimento_id_do_usuario());

DROP POLICY IF EXISTS "comanda_itens_select_policy" ON public.comanda_itens;
DROP POLICY IF EXISTS "comanda_itens_insert_policy" ON public.comanda_itens;
DROP POLICY IF EXISTS "comanda_itens_update_policy" ON public.comanda_itens;
DROP POLICY IF EXISTS "comanda_itens_delete_policy" ON public.comanda_itens;
CREATE POLICY "comanda_itens_select_policy" ON public.comanda_itens
  FOR SELECT TO anon, authenticated
  USING (
    auth.role() = 'anon'
    OR EXISTS (
      SELECT 1 FROM public.comandas c
      WHERE c.id = comanda_id AND c.estabelecimento_id = public.estabelecimento_id_do_usuario()
    )
  );
CREATE POLICY "comanda_itens_insert_policy" ON public.comanda_itens
  FOR INSERT TO authenticated
  WITH CHECK (
    is_garcom() AND quantidade > 0
    AND EXISTS (
      SELECT 1 FROM public.comandas c
      WHERE c.id = comanda_id AND c.estabelecimento_id = public.estabelecimento_id_do_usuario()
    )
  );
CREATE POLICY "comanda_itens_update_policy" ON public.comanda_itens
  FOR UPDATE TO authenticated
  USING (
    is_garcom()
    AND EXISTS (
      SELECT 1 FROM public.comandas c
      WHERE c.id = comanda_id AND c.estabelecimento_id = public.estabelecimento_id_do_usuario()
    )
  )
  WITH CHECK (quantidade >= 0);
CREATE POLICY "comanda_itens_delete_policy" ON public.comanda_itens
  FOR DELETE TO authenticated
  USING (
    is_garcom()
    AND EXISTS (
      SELECT 1 FROM public.comandas c
      WHERE c.id = comanda_id AND c.estabelecimento_id = public.estabelecimento_id_do_usuario()
    )
  );

DROP POLICY IF EXISTS "fila_cozinha_select_policy" ON public.fila_cozinha;
DROP POLICY IF EXISTS "fila_cozinha_insert_policy" ON public.fila_cozinha;
DROP POLICY IF EXISTS "fila_cozinha_update_policy" ON public.fila_cozinha;
DROP POLICY IF EXISTS "fila_cozinha_delete_policy" ON public.fila_cozinha;
CREATE POLICY "fila_cozinha_select_policy" ON public.fila_cozinha
  FOR SELECT TO anon, authenticated
  USING (
    (
      auth.role() = 'anon'
      AND EXISTS (
        SELECT 1
        FROM public.comanda_itens ci
        JOIN public.comandas c ON c.id = ci.comanda_id
        WHERE ci.id = fila_cozinha.comanda_item_id
          AND c.status = ANY (ARRAY['Ocupada'::text, 'Aguardando Pagamento'::text])
      )
    )
    OR estabelecimento_id = public.estabelecimento_id_do_usuario()
  );
CREATE POLICY "fila_cozinha_insert_policy" ON public.fila_cozinha
  FOR INSERT TO authenticated
  WITH CHECK (
    is_garcom() AND
    EXISTS (
      SELECT 1 FROM public.comanda_itens ci
      JOIN public.comandas c ON c.id = ci.comanda_id
      WHERE ci.id = fila_cozinha.comanda_item_id
        AND c.estabelecimento_id = public.estabelecimento_id_do_usuario()
    )
  );
CREATE POLICY "fila_cozinha_update_policy" ON public.fila_cozinha
  FOR UPDATE TO authenticated
  USING (is_operador_cozinha() AND estabelecimento_id = public.estabelecimento_id_do_usuario())
  WITH CHECK (is_operador_cozinha() AND estabelecimento_id = public.estabelecimento_id_do_usuario());
CREATE POLICY "fila_cozinha_delete_policy" ON public.fila_cozinha
  FOR DELETE TO authenticated
  USING ((is_gerente() OR is_garcom()) AND estabelecimento_id = public.estabelecimento_id_do_usuario());

DROP POLICY IF EXISTS "produtos_select_policy" ON public.produtos;
DROP POLICY IF EXISTS "produtos_insert_policy" ON public.produtos;
DROP POLICY IF EXISTS "produtos_update_policy" ON public.produtos;
CREATE POLICY "produtos_select_policy" ON public.produtos
  FOR SELECT TO anon, authenticated
  USING (
    (auth.role() = 'anon' AND ativo = true)
    OR (auth.role() = 'authenticated' AND estabelecimento_id = public.estabelecimento_id_do_usuario())
  );
CREATE POLICY "produtos_insert_policy" ON public.produtos
  FOR INSERT TO authenticated
  WITH CHECK (is_gerente() AND estabelecimento_id = public.estabelecimento_id_do_usuario());
CREATE POLICY "produtos_update_policy" ON public.produtos
  FOR UPDATE TO authenticated
  USING (is_gerente() AND estabelecimento_id = public.estabelecimento_id_do_usuario())
  WITH CHECK (is_gerente() AND preco >= 0);
DROP POLICY IF EXISTS "produtos_delete_policy" ON public.produtos;
CREATE POLICY "produtos_delete_policy" ON public.produtos
  FOR DELETE TO authenticated
  USING (is_gerente() AND estabelecimento_id = public.estabelecimento_id_do_usuario());

DROP POLICY IF EXISTS "movimentacoes_estoque_select_policy" ON public.movimentacoes_estoque;
DROP POLICY IF EXISTS "movimentacoes_estoque_insert_policy" ON public.movimentacoes_estoque;
CREATE POLICY "movimentacoes_estoque_select_policy" ON public.movimentacoes_estoque
  FOR SELECT TO authenticated
  USING ((is_gerente() OR is_caixa()) AND estabelecimento_id = public.estabelecimento_id_do_usuario());
CREATE POLICY "movimentacoes_estoque_insert_policy" ON public.movimentacoes_estoque
  FOR INSERT TO authenticated
  WITH CHECK ((is_gerente() OR is_caixa()) AND estabelecimento_id = public.estabelecimento_id_do_usuario());

DROP POLICY IF EXISTS "movimentos_caixa_select_policy" ON public.movimentos_caixa;
DROP POLICY IF EXISTS "movimentos_caixa_insert_policy" ON public.movimentos_caixa;
CREATE POLICY "movimentos_caixa_select_policy" ON public.movimentos_caixa
  FOR SELECT TO authenticated
  USING (is_caixa() AND estabelecimento_id = public.estabelecimento_id_do_usuario());
CREATE POLICY "movimentos_caixa_insert_policy" ON public.movimentos_caixa
  FOR INSERT TO authenticated
  WITH CHECK (is_caixa() AND estabelecimento_id = public.estabelecimento_id_do_usuario());

DROP POLICY IF EXISTS "caixa_diarios_select_policy" ON public.caixa_diarios;
DROP POLICY IF EXISTS "caixa_diarios_insert_policy" ON public.caixa_diarios;
DROP POLICY IF EXISTS "caixa_diarios_update_policy" ON public.caixa_diarios;
CREATE POLICY "caixa_diarios_select_policy" ON public.caixa_diarios
  FOR SELECT TO authenticated
  USING (is_caixa() AND estabelecimento_id = public.estabelecimento_id_do_usuario());
CREATE POLICY "caixa_diarios_insert_policy" ON public.caixa_diarios
  FOR INSERT TO authenticated
  WITH CHECK (is_caixa() AND estabelecimento_id = public.estabelecimento_id_do_usuario());
CREATE POLICY "caixa_diarios_update_policy" ON public.caixa_diarios
  FOR UPDATE TO authenticated
  USING (is_caixa() AND estabelecimento_id = public.estabelecimento_id_do_usuario())
  WITH CHECK (is_caixa() AND estabelecimento_id = public.estabelecimento_id_do_usuario());

DROP POLICY IF EXISTS "documentos_fiscais_select_policy" ON public.documentos_fiscais;
DROP POLICY IF EXISTS "documentos_fiscais_insert_policy" ON public.documentos_fiscais;
DROP POLICY IF EXISTS "documentos_fiscais_update_policy" ON public.documentos_fiscais;
CREATE POLICY "documentos_fiscais_select_policy" ON public.documentos_fiscais
  FOR SELECT TO authenticated
  USING (is_caixa() AND estabelecimento_id = public.estabelecimento_id_do_usuario());
CREATE POLICY "documentos_fiscais_insert_policy" ON public.documentos_fiscais
  FOR INSERT TO authenticated
  WITH CHECK (is_caixa() AND estabelecimento_id = public.estabelecimento_id_do_usuario());
CREATE POLICY "documentos_fiscais_update_policy" ON public.documentos_fiscais
  FOR UPDATE TO authenticated
  USING (is_caixa() AND estabelecimento_id = public.estabelecimento_id_do_usuario())
  WITH CHECK (is_caixa() AND estabelecimento_id = public.estabelecimento_id_do_usuario());

DROP POLICY IF EXISTS "configuracoes_bar_select_all" ON public.configuracoes_bar;
DROP POLICY IF EXISTS "configuracoes_bar_insert_gerente" ON public.configuracoes_bar;
DROP POLICY IF EXISTS "configuracoes_bar_update_gerente" ON public.configuracoes_bar;
CREATE POLICY "configuracoes_bar_select_all" ON public.configuracoes_bar
  FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "configuracoes_bar_insert_gerente" ON public.configuracoes_bar
  FOR INSERT TO authenticated
  WITH CHECK (
    is_gerente() AND (
      id = public.estabelecimento_id_do_usuario()::text
      OR (id = 'principal' AND public.estabelecimento_id_do_usuario() = 'a0000000-0000-0000-0000-000000000001'::uuid)
    )
  );
CREATE POLICY "configuracoes_bar_update_gerente" ON public.configuracoes_bar
  FOR UPDATE TO authenticated
  USING (
    is_gerente() AND (
      id = public.estabelecimento_id_do_usuario()::text
      OR (id = 'principal' AND public.estabelecimento_id_do_usuario() = 'a0000000-0000-0000-0000-000000000001'::uuid)
    )
  )
  WITH CHECK (
    is_gerente() AND (
      id = public.estabelecimento_id_do_usuario()::text
      OR (id = 'principal' AND public.estabelecimento_id_do_usuario() = 'a0000000-0000-0000-0000-000000000001'::uuid)
    )
  );

DROP POLICY IF EXISTS "perfis_usuarios_select" ON public.perfis_usuarios;
DROP POLICY IF EXISTS "perfis_usuarios_manage" ON public.perfis_usuarios;
CREATE POLICY "perfis_usuarios_select" ON public.perfis_usuarios
  FOR SELECT TO authenticated
  USING (
    estabelecimento_id IS NULL
    OR estabelecimento_id = public.estabelecimento_id_do_usuario()
  );
CREATE POLICY "perfis_usuarios_manage" ON public.perfis_usuarios
  FOR ALL TO authenticated
  USING (is_gerente() AND (estabelecimento_id IS NULL OR estabelecimento_id = public.estabelecimento_id_do_usuario()))
  WITH CHECK (is_gerente() AND estabelecimento_id = public.estabelecimento_id_do_usuario());

-- Políticas da tabela de tenants: listagem pública (login) + leitura do próprio tenant
DROP POLICY IF EXISTS "estabelecimentos_select_public" ON public.estabelecimentos;
DROP POLICY IF EXISTS "estabelecimentos_select_own" ON public.estabelecimentos;
DROP POLICY IF EXISTS "estabelecimentos_insert_gerente" ON public.estabelecimentos;
DROP POLICY IF EXISTS "estabelecimentos_update_own" ON public.estabelecimentos;
CREATE POLICY "estabelecimentos_select_public" ON public.estabelecimentos
  FOR SELECT TO anon, authenticated USING (ativo = true);
CREATE POLICY "estabelecimentos_insert_gerente" ON public.estabelecimentos
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "estabelecimentos_update_own" ON public.estabelecimentos
  FOR UPDATE TO authenticated
  USING (is_gerente() AND id = public.estabelecimento_id_do_usuario())
  WITH CHECK (is_gerente() AND id = public.estabelecimento_id_do_usuario());

-- ============================================================================
-- 8. RPCs SECURITY DEFINER ajustadas para operar dentro do tenant correto
-- ============================================================================
CREATE OR REPLACE FUNCTION public.recalcular_total_comanda(p_comanda_id TEXT)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_subtotal NUMERIC(10,2) := 0.00;
  v_taxa_padrao NUMERIC(10,2) := 10.00;
  v_taxa_valor NUMERIC(10,2) := 0.00;
  v_inclui_taxa BOOLEAN := true;
  v_cmd_status TEXT;
  v_cmd_status_conta TEXT;
  v_itens_count INTEGER := 0;
  v_tenant UUID;
  v_cfg_id TEXT;
BEGIN
  IF p_comanda_id IS NULL OR trim(p_comanda_id) = '' THEN
    RETURN;
  END IF;

  SELECT inclui_taxa_servico, status, status_conta, estabelecimento_id
  INTO v_inclui_taxa, v_cmd_status, v_cmd_status_conta, v_tenant
  FROM public.comandas
  WHERE id = p_comanda_id;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  -- Se a comanda já foi Fechada pelo caixa, preserva o total do histórico financeiro
  IF v_cmd_status = 'Fechada' OR v_cmd_status_conta = 'fechada' THEN
    RETURN;
  END IF;

  -- Somar itens da comanda
  SELECT COALESCE(SUM(preco_unitario * quantidade), 0.00), COUNT(*)
  INTO v_subtotal, v_itens_count
  FROM public.comanda_itens
  WHERE comanda_id = p_comanda_id;

  -- Se não há itens na comanda, o total é rigorosamente 0.00
  IF v_itens_count = 0 OR v_subtotal <= 0.00 THEN
    UPDATE public.comandas
    SET total = 0.00,
        updated_at = NOW()
    WHERE id = p_comanda_id;
    RETURN;
  END IF;

  -- Taxa de serviço do estabelecimento dono da comanda. O Rachide Bar (fase 1)
  -- segue com a linha 'principal' de configuracoes_bar; demais tenants têm
  -- linha própria com id = uuid do tenant.
  v_cfg_id := COALESCE(v_tenant::text, 'principal');
  SELECT COALESCE(taxa_servico_padrao, 10.00)
  INTO v_taxa_padrao
  FROM public.configuracoes_bar
  WHERE id = v_cfg_id OR id = 'principal'
  ORDER BY (id = v_cfg_id) DESC
  LIMIT 1;
  v_taxa_padrao := COALESCE(v_taxa_padrao, 10.00);

  IF COALESCE(v_inclui_taxa, true) THEN
    v_taxa_valor := ROUND((v_subtotal * (v_taxa_padrao / 100.0)), 2);
  ELSE
    v_taxa_valor := 0.00;
  END IF;

  UPDATE public.comandas
  SET total = v_subtotal + v_taxa_valor,
      updated_at = NOW()
  WHERE id = p_comanda_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.fechar_mesa_sem_consumo(p_mesa_numero integer)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_user_profile TEXT;
  v_comanda_id TEXT;
  v_cmd RECORD;
  v_qtd_itens INTEGER := 0;
  v_now TIMESTAMPTZ := NOW();
  v_total_residual NUMERIC(10,2) := 0.00;
  v_tenant UUID := public.estabelecimento_id_do_usuario();
BEGIN
  -- 1. Validação de perfil da equipe logada (Garçom, Caixa ou Gerente)
  v_user_profile := public.get_current_user_profile();
  IF v_user_profile IS NULL OR v_user_profile NOT IN ('garcom', 'caixa', 'gerente') THEN
    RAISE EXCEPTION 'Acesso negado: apenas Garçom, Caixa e Gerente podem fechar mesas sem consumo.'
      USING ERRCODE = '42501';
  END IF;

  -- 2. Validação básica do número da mesa
  IF p_mesa_numero IS NULL OR p_mesa_numero <= 0 THEN
    RETURN jsonb_build_object(
      'sucesso', false,
      'codigo', 'MESA_INVALIDA',
      'mensagem', 'Número de mesa inválido.'
    );
  END IF;

  -- 3. Obter a comanda correspondente (dentro do estabelecimento do usuário)
  v_comanda_id := 'cmd-' || LPAD(p_mesa_numero::text, 2, '0');

  SELECT * INTO v_cmd FROM public.comandas
  WHERE id = v_comanda_id AND estabelecimento_id = v_tenant;
  IF NOT FOUND THEN
    -- Se nem a comanda existe, apenas garante que a mesa volte a Livre
    UPDATE public.mesas
    SET status = 'Livre',
        updated_at = v_now
    WHERE numero = p_mesa_numero AND estabelecimento_id = v_tenant;

    RETURN jsonb_build_object(
      'sucesso', true,
      'codigo', 'MESA_LIBERADA',
      'mesa_numero', p_mesa_numero,
      'mensagem', 'Mesa ' || p_mesa_numero::text || ' liberada com sucesso.'
    );
  END IF;

  -- 4. Contar itens cadastrados na comanda
  SELECT COUNT(*) INTO v_qtd_itens
  FROM public.comanda_itens
  WHERE comanda_id = v_comanda_id;

  v_total_residual := COALESCE(v_cmd.total, 0.00);

  -- 5. Salvaguarda no servidor com mensagem HONESTA:
  IF v_qtd_itens > 0 THEN
    RETURN jsonb_build_object(
      'sucesso', false,
      'codigo', 'MESA_COM_CONSUMO',
      'itens_count', v_qtd_itens,
      'total', v_total_residual,
      'mensagem', 'A Mesa ' || p_mesa_numero::text || ' possui ' || v_qtd_itens::text || ' item(ns) lançado(s). Para mesas com consumo, utilize o fluxo de Enviar para Pagamento / Caixa.'
    );
  END IF;

  IF v_total_residual > 0.00 THEN
    RETURN jsonb_build_object(
      'sucesso', false,
      'codigo', 'TOTAL_RESIDUAL_SEM_ITENS',
      'itens_count', 0,
      'total', v_total_residual,
      'mensagem', 'A Mesa ' || p_mesa_numero::text || ' possui um total registrado de R$ ' || to_char(v_total_residual, 'FM999990.00') || ' sem itens lançados. Verifique a comanda ou envie para pagamento no Caixa.'
    );
  END IF;

  -- 6. Limpar quaisquer itens órfãos que possam restar
  DELETE FROM public.comanda_itens WHERE comanda_id = v_comanda_id;

  -- 7. Resetar comanda para status 'Livre', zerar dados e higienizar todo o fluxo de conta
  UPDATE public.comandas
  SET status = 'Livre',
      cliente_nome = NULL,
      pessoas = 0,
      aberta_em = NULL,
      fechada_em = NULL,
      total = 0.00,
      conta_solicitada = false,
      conta_solicitada_em = NULL,
      forma_pagamento_solicitada = NULL,
      status_conta = 'nenhum',
      motivo_recusa_conta = NULL,
      nfce_solicitada = false,
      nfce_documento_id = NULL,
      updated_at = v_now
  WHERE id = v_comanda_id;

  -- 8. Atualizar status da mesa no cadastro para Livre
  UPDATE public.mesas
  SET status = 'Livre',
      updated_at = v_now
  WHERE numero = p_mesa_numero AND estabelecimento_id = v_tenant;

  RETURN jsonb_build_object(
    'sucesso', true,
    'codigo', 'MESA_FECHADA_SEM_CONSUMO',
    'mesa_numero', p_mesa_numero,
    'comanda_id', v_comanda_id,
    'mensagem', 'Mesa ' || p_mesa_numero::text || ' fechada e liberada com sucesso!'
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.transferir_mesa_atendimento(p_mesa_origem integer, p_mesa_destino integer)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_user_profile TEXT;
  v_user_label TEXT;
  v_cmd_origem_id TEXT;
  v_cmd_destino_id TEXT;
  v_cmd RECORD;
  v_mesa_dest RECORD;
  v_now TIMESTAMPTZ := NOW();
  v_itens_transferidos INTEGER := 0;
  v_tenant UUID := public.estabelecimento_id_do_usuario();
BEGIN
  -- 1. Validação de perfil da equipe logada (Garçom, Caixa ou Gerente)
  v_user_profile := public.get_current_user_profile();
  IF v_user_profile IS NULL OR v_user_profile NOT IN ('garcom', 'caixa', 'gerente') THEN
    RAISE EXCEPTION 'Acesso negado: apenas Garçom, Caixa e Gerente podem realizar transferência de mesa.'
      USING ERRCODE = '42501';
  END IF;

  v_user_label := CASE
    WHEN v_user_profile = 'gerente' THEN 'Carlos Gerente'
    WHEN v_user_profile = 'caixa' THEN 'Marina Caixa'
    ELSE 'Garçom de Salão'
  END;

  -- 2. Validação básica das mesas
  IF p_mesa_origem IS NULL OR p_mesa_origem <= 0 THEN
    RETURN jsonb_build_object('sucesso', false, 'codigo', 'MESA_ORIGEM_INVALIDA', 'mensagem', 'Mesa de origem inválida.');
  END IF;
  IF p_mesa_destino IS NULL OR p_mesa_destino <= 0 THEN
    RETURN jsonb_build_object('sucesso', false, 'codigo', 'MESA_DESTINO_INVALIDA', 'mensagem', 'Mesa de destino inválida.');
  END IF;
  IF p_mesa_origem = p_mesa_destino THEN
    RETURN jsonb_build_object('sucesso', false, 'codigo', 'MESAS_IGUAIS', 'mensagem', 'A mesa de destino deve ser diferente da mesa de origem.');
  END IF;

  -- 3. Obter e validar a comanda da mesa de origem (no estabelecimento do usuário)
  v_cmd_origem_id := 'cmd-' || LPAD(p_mesa_origem::text, 2, '0');
  v_cmd_destino_id := 'cmd-' || LPAD(p_mesa_destino::text, 2, '0');

  SELECT * INTO v_cmd FROM public.comandas
  WHERE id = v_cmd_origem_id AND estabelecimento_id = v_tenant;
  IF NOT FOUND OR v_cmd.status = 'Livre' THEN
    RETURN jsonb_build_object(
      'sucesso', false,
      'codigo', 'ORIGEM_SEM_ATENDIMENTO',
      'mensagem', 'A Mesa ' || p_mesa_origem::text || ' não possui atendimento aberto ou consumo para transferir.'
    );
  END IF;

  -- 4. Validar se a mesa de destino existe e está livre (mesmo estabelecimento)
  SELECT * INTO v_mesa_dest FROM public.mesas
  WHERE numero = p_mesa_destino AND estabelecimento_id = v_tenant;
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'sucesso', false,
      'codigo', 'DESTINO_INEXISTENTE',
      'mensagem', 'A Mesa ' || p_mesa_destino::text || ' não está cadastrada no sistema.'
    );
  END IF;
  IF v_mesa_dest.status <> 'Livre' THEN
    RETURN jsonb_build_object(
      'sucesso', false,
      'codigo', 'DESTINO_OCUPADO',
      'mensagem', 'A Mesa ' || p_mesa_destino::text || ' não está Livre (status atual: ' || v_mesa_dest.status || '). Escolha uma mesa livre.'
    );
  END IF;

  -- 5. Se já existir comanda residual na mesa de destino, limpar itens órfãos
  DELETE FROM public.comanda_itens WHERE comanda_id = v_cmd_destino_id;

  -- 6. Upsert da comanda de destino copiando integralmente todos os dados do atendimento
  INSERT INTO public.comandas (
    id, mesa_numero, estabelecimento_id, cliente_nome, pessoas, status,
    aberta_em, fechada_em, inclui_taxa_servico, garcom, total,
    conta_solicitada, conta_solicitada_em, forma_pagamento_solicitada,
    status_conta, motivo_recusa_conta, nfce_solicitada, nfce_documento_id,
    created_at, updated_at
  ) VALUES (
    v_cmd_destino_id, p_mesa_destino, v_tenant, v_cmd.cliente_nome, v_cmd.pessoas, v_cmd.status,
    COALESCE(v_cmd.aberta_em, v_now), v_cmd.fechada_em, v_cmd.inclui_taxa_servico,
    COALESCE(v_cmd.garcom, v_user_label), v_cmd.total,
    v_cmd.conta_solicitada, v_cmd.conta_solicitada_em, v_cmd.forma_pagamento_solicitada,
    v_cmd.status_conta, v_cmd.motivo_recusa_conta,
    COALESCE(v_cmd.nfce_solicitada, false), v_cmd.nfce_documento_id,
    COALESCE(v_cmd.created_at, v_now), v_now
  )
  ON CONFLICT (id) DO UPDATE SET
    mesa_numero = EXCLUDED.mesa_numero,
    estabelecimento_id = EXCLUDED.estabelecimento_id,
    cliente_nome = EXCLUDED.cliente_nome,
    pessoas = EXCLUDED.pessoas,
    status = EXCLUDED.status,
    aberta_em = EXCLUDED.aberta_em,
    fechada_em = EXCLUDED.fechada_em,
    inclui_taxa_servico = EXCLUDED.inclui_taxa_servico,
    garcom = EXCLUDED.garcom,
    total = EXCLUDED.total,
    conta_solicitada = EXCLUDED.conta_solicitada,
    conta_solicitada_em = EXCLUDED.conta_solicitada_em,
    forma_pagamento_solicitada = EXCLUDED.forma_pagamento_solicitada,
    status_conta = EXCLUDED.status_conta,
    motivo_recusa_conta = EXCLUDED.motivo_recusa_conta,
    nfce_solicitada = EXCLUDED.nfce_solicitada,
    nfce_documento_id = EXCLUDED.nfce_documento_id,
    updated_at = v_now;

  -- 7. Migrar todos os itens de consumo da comanda de origem para a comanda de destino
  UPDATE public.comanda_itens
  SET comanda_id = v_cmd_destino_id,
      updated_at = v_now
  WHERE comanda_id = v_cmd_origem_id;

  GET DIAGNOSTICS v_itens_transferidos = ROW_COUNT;

  -- 8. Atualizar status da mesa de destino para acompanhar o status da comanda
  UPDATE public.mesas
  SET status = v_cmd.status,
      updated_at = v_now
  WHERE numero = p_mesa_destino AND estabelecimento_id = v_tenant;

  -- 9. Limpar e liberar a mesa de origem imediatamente
  UPDATE public.mesas
  SET status = 'Livre',
      updated_at = v_now
  WHERE numero = p_mesa_origem AND estabelecimento_id = v_tenant;

  -- 10. Resetar comanda de origem para Livre com salvaguarda total de fluxo de conta
  UPDATE public.comandas
  SET status = 'Livre',
      cliente_nome = NULL,
      pessoas = 0,
      aberta_em = NULL,
      fechada_em = NULL,
      total = 0.00,
      conta_solicitada = false,
      conta_solicitada_em = NULL,
      forma_pagamento_solicitada = NULL,
      status_conta = 'nenhum',
      motivo_recusa_conta = NULL,
      nfce_solicitada = false,
      nfce_documento_id = NULL,
      updated_at = v_now
  WHERE id = v_cmd_origem_id;

  RETURN jsonb_build_object(
    'sucesso', true,
    'codigo', 'TRANSFERENCIA_CONCLUIDA',
    'mesa_origem', p_mesa_origem,
    'mesa_destino', p_mesa_destino,
    'comanda_origem_id', v_cmd_origem_id,
    'comanda_destino_id', v_cmd_destino_id,
    'cliente_nome', v_cmd.cliente_nome,
    'status_comanda', v_cmd.status,
    'status_conta', v_cmd.status_conta,
    'conta_solicitada', v_cmd.conta_solicitada,
    'forma_pagamento', v_cmd.forma_pagamento_solicitada,
    'total', v_cmd.total,
    'itens_transferidos', v_itens_transferidos,
    'mensagem', 'Atendimento da Mesa ' || p_mesa_origem::text || ' transferido com sucesso para a Mesa ' || p_mesa_destino::text || '!'
  );
END;
$function$;

-- Detalhes da conta: configurações lidas do estabelecimento dono da comanda
CREATE OR REPLACE FUNCTION public.obter_detalhes_conta_mesa(p_mesa_numero integer)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_comanda_id TEXT;
  v_cmd RECORD;
  v_cfg RECORD;
  v_cfg_id TEXT;
  v_subtotal NUMERIC(10,2) := 0.00;
  v_taxa_padrao NUMERIC(10,2) := 10.00;
  v_taxa_servico NUMERIC(10,2) := 0.00;
  v_total NUMERIC(10,2) := 0.00;
  v_itens JSONB := '[]'::jsonb;
  v_status_conta_sanitizado TEXT;
  v_conta_solicitada_sanitizada BOOLEAN;
  v_fisc RECORD;
  v_nfce_doc JSONB := NULL;
BEGIN
  v_comanda_id := 'cmd-' || LPAD(p_mesa_numero::text, 2, '0');

  SELECT * INTO v_cmd
  FROM public.comandas
  WHERE id = v_comanda_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('encontrada', false);
  END IF;

  v_cfg_id := COALESCE(v_cmd.estabelecimento_id::text, 'principal');

  -- Rachide Bar (fase 1): linha 'principal'; demais tenants: linha id = uuid
  SELECT
    COALESCE(taxa_servico_padrao, 10.00) AS taxa_servico_padrao,
    razao_social,
    nome_fantasia,
    cnpj,
    inscricao_estadual,
    endereco_completo,
    telefone,
    impressora_fiscal_nome,
    pix_chave,
    pix_beneficiario_nome,
    pix_cidade
  INTO v_cfg
  FROM public.configuracoes_bar
  WHERE id = v_cfg_id OR id = 'principal'
  ORDER BY (id = v_cfg_id) DESC
  LIMIT 1;

  v_taxa_padrao := COALESCE(v_cfg.taxa_servico_padrao, 10.00);

  SELECT
    COALESCE(SUM(preco_unitario * quantidade), 0.00),
    COALESCE(
      jsonb_agg(
        jsonb_build_object(
          'id', id,
          'nome_produto', nome_produto,
          'preco_unitario', preco_unitario,
          'quantidade', quantidade,
          'observacoes', observacoes,
          'origem_online', origem_online
        ) ORDER BY created_at ASC
      ),
      '[]'::jsonb
    )
  INTO v_subtotal, v_itens
  FROM public.comanda_itens
  WHERE comanda_id = v_comanda_id;

  IF v_cmd.inclui_taxa_servico THEN
    v_taxa_servico := ROUND((v_subtotal * (v_taxa_padrao / 100.0)), 2);
  ELSE
    v_taxa_servico := 0.00;
  END IF;
  v_total := v_subtotal + v_taxa_servico;

  IF v_cmd.status = 'Fechada' OR v_cmd.status_conta = 'fechada' THEN
    IF v_cmd.total > 0 THEN
      v_total := v_cmd.total;
    END IF;
  END IF;

  v_status_conta_sanitizado := COALESCE(v_cmd.status_conta, 'nenhum');
  v_conta_solicitada_sanitizada := COALESCE(v_cmd.conta_solicitada, false);

  IF v_cmd.status = 'Fechada' OR v_status_conta_sanitizado = 'fechada' THEN
    SELECT * INTO v_fisc
    FROM public.documentos_fiscais
    WHERE (id = v_cmd.nfce_documento_id OR comanda_id = v_comanda_id)
      AND status = 'Autorizada'
    ORDER BY emitido_em DESC
    LIMIT 1;

    IF FOUND THEN
      v_nfce_doc := jsonb_build_object(
        'id', v_fisc.id,
        'numero', v_fisc.numero,
        'serie', v_fisc.serie,
        'tipo', v_fisc.tipo,
        'emitido_em', v_fisc.emitido_em,
        'valor', v_fisc.valor,
        'status', v_fisc.status,
        'nome_cliente', v_fisc.nome_cliente,
        'documento_cliente', v_fisc.documento_cliente,
        'chave_acesso', v_fisc.chave_acesso
      );
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'encontrada', true,
    'comanda_id', v_cmd.id,
    'mesa_numero', v_cmd.mesa_numero,
    'estabelecimento_id', v_cmd.estabelecimento_id,
    'cliente_nome', v_cmd.cliente_nome,
    'pessoas', v_cmd.pessoas,
    'status_mesa', v_cmd.status,
    'conta_solicitada', v_conta_solicitada_sanitizada,
    'conta_solicitada_em', v_cmd.conta_solicitada_em,
    'forma_pagamento_solicitada', v_cmd.forma_pagamento_solicitada,
    'status_conta', v_status_conta_sanitizado,
    'nfce_solicitada', COALESCE(v_cmd.nfce_solicitada, false),
    'nfce_documento', v_nfce_doc,
    'fechada_em', v_cmd.fechada_em,
    'motivo_recusa_conta', CASE WHEN v_status_conta_sanitizado = 'recusada' THEN v_cmd.motivo_recusa_conta ELSE NULL END,
    'subtotal', v_subtotal,
    'taxa_percentual', v_taxa_padrao,
    'taxa_servico', v_taxa_servico,
    'inclui_taxa_servico', v_cmd.inclui_taxa_servico,
    'total', v_total,
    'itens', v_itens,
    'bar_info', jsonb_build_object(
      'razao_social', v_cfg.razao_social,
      'nome_fantasia', v_cfg.nome_fantasia,
      'cnpj', v_cfg.cnpj,
      'inscricao_estadual', v_cfg.inscricao_estadual,
      'endereco_completo', v_cfg.endereco_completo,
      'telefone', v_cfg.telefone,
      'impressora_fiscal_nome', v_cfg.impressora_fiscal_nome
    ),
    'pix_chave', v_cfg.pix_chave,
    'pix_beneficiario_nome', v_cfg.pix_beneficiario_nome,
    'pix_cidade', v_cfg.pix_cidade
  );
END;
$function$;

GRANT EXECUTE ON FUNCTION public.estabelecimento_id_sessao() TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.estabelecimento_id_do_usuario() TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.vincular_estabelecimento_usuario(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.recalcular_total_comanda(text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.fechar_mesa_sem_consumo(integer) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.transferir_mesa_atendimento(integer, integer) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.obter_detalhes_conta_mesa(integer) TO authenticated, service_role;
GRANT SELECT ON TABLE public.estabelecimentos TO anon, authenticated;
