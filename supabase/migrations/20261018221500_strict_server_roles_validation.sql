-- Migração de segurança: endurecimento de permissões no servidor (RLS e RPCs seguras)
-- Garante que ações sensíveis sejam validadas no backend com base no perfil real (public.perfis_usuarios)

-- 1. Políticas RLS para produtos
-- Apenas GERENTE pode cadastrar, alterar catálogo (nome, categoria, preço, ativo, etc.)
-- O abate operacional de estoque durante pedidos deve ocorrer via função de segurança ou apenas por gerente/caixa
DROP POLICY IF EXISTS "produtos_update_policy" ON public.produtos;
DROP POLICY IF EXISTS "produtos_insert_policy" ON public.produtos;

CREATE POLICY "produtos_insert_policy" ON public.produtos
  FOR INSERT TO authenticated
  WITH CHECK (public.is_gerente());

CREATE POLICY "produtos_update_policy" ON public.produtos
  FOR UPDATE TO authenticated
  USING (public.is_gerente())
  WITH CHECK (public.is_gerente() AND preco >= 0);

-- 2. Função segura para baixa/recomposição de estoque por garçom/caixa durante comandas
CREATE OR REPLACE FUNCTION public.abater_estoque_comanda(
  p_produto_id TEXT,
  p_delta NUMERIC
)
RETURNS NUMERIC
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_novo_estoque NUMERIC;
BEGIN
  -- Permite apenas usuários autenticados com perfil ativo (garçom, caixa ou gerente)
  IF NOT public.is_garcom() THEN
    RAISE EXCEPTION 'Acesso negado: perfil sem autorização operacional.';
  END IF;

  UPDATE public.produtos
  SET estoque = GREATEST(0.00, ROUND((estoque - p_delta)::numeric, 2)),
      updated_at = NOW()
  WHERE id = p_produto_id
  RETURNING estoque INTO v_novo_estoque;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Produto não encontrado: %', p_produto_id;
  END IF;

  RETURN v_novo_estoque;
END;
$$;

-- 3. Função segura para edição de capacidade de mesa (apenas GERENTE)
CREATE OR REPLACE FUNCTION public.gerente_atualizar_capacidade_mesa(
  p_mesa_id UUID,
  p_capacidade INTEGER
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF NOT public.is_gerente() THEN
    RAISE EXCEPTION 'Acesso negado: apenas Gerente pode alterar a capacidade ou configuração das mesas.';
  END IF;

  IF p_capacidade <= 0 THEN
    RAISE EXCEPTION 'A capacidade da mesa deve ser maior que zero.';
  END IF;

  UPDATE public.mesas
  SET capacidade = p_capacidade,
      updated_at = NOW()
  WHERE id = p_mesa_id;

  RETURN true;
END;
$$;

-- 4. Função segura para cancelamento de documento fiscal (apenas GERENTE)
CREATE OR REPLACE FUNCTION public.cancelar_documento_fiscal(
  p_documento_id TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF NOT public.is_gerente() THEN
    RAISE EXCEPTION 'Acesso negado: apenas Gerente possui autorização fiscal para cancelamento.';
  END IF;

  UPDATE public.documentos_fiscais
  SET status = 'Cancelada'
  WHERE id = p_documento_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Documento fiscal não encontrado: %', p_documento_id;
  END IF;

  RETURN true;
END;
$$;

-- 5. Função segura para sangria / suprimento / fechamento de caixa com validação no servidor
CREATE OR REPLACE FUNCTION public.registrar_movimento_caixa_seguro(
  p_id TEXT,
  p_tipo TEXT,
  p_descricao TEXT,
  p_valor NUMERIC,
  p_forma_pagamento TEXT,
  p_comanda_id TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_perfil TEXT;
  v_user_nome TEXT;
  v_now TIMESTAMPTZ := NOW();
BEGIN
  IF NOT public.is_caixa() THEN
    RAISE EXCEPTION 'Acesso negado: apenas Caixa ou Gerente podem operar o fluxo de caixa.';
  END IF;

  SELECT perfil, COALESCE(nome_exibicao, email) INTO v_perfil, v_user_nome
  FROM public.perfis_usuarios
  WHERE id = auth.uid() AND ativo = true;

  INSERT INTO public.movimentos_caixa (
    id,
    data_hora,
    descricao,
    tipo,
    forma_pagamento,
    valor,
    usuario,
    comanda_id
  ) VALUES (
    p_id,
    v_now,
    p_descricao,
    p_tipo,
    p_forma_pagamento,
    p_valor,
    COALESCE(v_user_nome, 'Operador'),
    p_comanda_id
  );

  RETURN jsonb_build_object(
    'sucesso', true,
    'id', p_id,
    'usuario', v_user_nome,
    'data_hora', v_now
  );
END;
$$;

-- 6. Garantir permissões de execução para papéis autenticados
GRANT EXECUTE ON FUNCTION public.abater_estoque_comanda(TEXT, NUMERIC) TO authenticated;
GRANT EXECUTE ON FUNCTION public.gerente_atualizar_capacidade_mesa(UUID, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cancelar_documento_fiscal(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.registrar_movimento_caixa_seguro(TEXT, TEXT, TEXT, NUMERIC, TEXT, TEXT) TO authenticated;
