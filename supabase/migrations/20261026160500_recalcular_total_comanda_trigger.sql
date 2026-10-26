-- Migração: Trigger automático para recalcular total de comanda e salvaguarda com mensagem honesta
-- 1. Garante que qualquer INSERT, UPDATE ou DELETE em comanda_itens recalcule automaticamente o total da comanda pai.
-- 2. Atualiza a RPC fechar_mesa_sem_consumo com mensagem honesta diferenciando itens lançados de total residual.
-- 3. Trigger opcional em comandas quando inclui_taxa_servico for alternada.
-- 4. Higienização das comandas não-fechadas no banco com recálculo dos totais reais.

-- 1. Função central de recálculo de total da comanda
CREATE OR REPLACE FUNCTION public.recalcular_total_comanda(p_comanda_id TEXT)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_subtotal NUMERIC(10,2) := 0.00;
  v_taxa_padrao NUMERIC(10,2) := 10.00;
  v_taxa_valor NUMERIC(10,2) := 0.00;
  v_inclui_taxa BOOLEAN := true;
  v_cmd_status TEXT;
  v_cmd_status_conta TEXT;
  v_itens_count INTEGER := 0;
BEGIN
  IF p_comanda_id IS NULL OR trim(p_comanda_id) = '' THEN
    RETURN;
  END IF;

  SELECT inclui_taxa_servico, status, status_conta
  INTO v_inclui_taxa, v_cmd_status, v_cmd_status_conta
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

  -- Obter taxa padrão do bar
  SELECT COALESCE(taxa_servico_padrao, 10.00)
  INTO v_taxa_padrao
  FROM public.configuracoes_bar
  WHERE id = 'principal';

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
$$;

-- 2. Trigger na tabela comanda_itens para disparar o recálculo
CREATE OR REPLACE FUNCTION public.trg_comanda_itens_recalcular_total()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM public.recalcular_total_comanda(OLD.comanda_id);
    RETURN OLD;
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.comanda_id IS DISTINCT FROM NEW.comanda_id THEN
      PERFORM public.recalcular_total_comanda(OLD.comanda_id);
    END IF;
    PERFORM public.recalcular_total_comanda(NEW.comanda_id);
    RETURN NEW;
  ELSIF TG_OP = 'INSERT' THEN
    PERFORM public.recalcular_total_comanda(NEW.comanda_id);
    RETURN NEW;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_comanda_itens_recalcular_total ON public.comanda_itens;
CREATE TRIGGER trg_comanda_itens_recalcular_total
  AFTER INSERT OR UPDATE OR DELETE ON public.comanda_itens
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_comanda_itens_recalcular_total();

-- 3. Trigger na tabela comandas para recalcular se inclui_taxa_servico mudar
CREATE OR REPLACE FUNCTION public.trg_comandas_taxa_servico_alterada()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.inclui_taxa_servico IS DISTINCT FROM OLD.inclui_taxa_servico THEN
    PERFORM public.recalcular_total_comanda(NEW.id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_comandas_taxa_servico_alterada ON public.comandas;
CREATE TRIGGER trg_comandas_taxa_servico_alterada
  AFTER UPDATE OF inclui_taxa_servico ON public.comandas
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_comandas_taxa_servico_alterada();

-- 4. Atualizar a RPC fechar_mesa_sem_consumo com mensagem honesta
CREATE OR REPLACE FUNCTION public.fechar_mesa_sem_consumo(
  p_mesa_numero integer
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_profile TEXT;
  v_comanda_id TEXT;
  v_cmd RECORD;
  v_qtd_itens INTEGER := 0;
  v_now TIMESTAMPTZ := NOW();
  v_total_residual NUMERIC(10,2) := 0.00;
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

  -- 3. Obter a comanda correspondente
  v_comanda_id := 'cmd-' || LPAD(p_mesa_numero::text, 2, '0');

  SELECT * INTO v_cmd FROM public.comandas WHERE id = v_comanda_id;
  IF NOT FOUND THEN
    -- Se nem a comanda existe, apenas garante que a mesa volte a Livre
    UPDATE public.mesas
    SET status = 'Livre',
        updated_at = v_now
    WHERE numero = p_mesa_numero;

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
  -- A) Se houver itens lançados:
  IF v_qtd_itens > 0 THEN
    RETURN jsonb_build_object(
      'sucesso', false,
      'codigo', 'MESA_COM_CONSUMO',
      'itens_count', v_qtd_itens,
      'total', v_total_residual,
      'mensagem', 'A Mesa ' || p_mesa_numero::text || ' possui ' || v_qtd_itens::text || ' item(ns) lançado(s). Para mesas com consumo, utilize o fluxo de Enviar para Pagamento / Caixa.'
    );
  END IF;

  -- B) Se 0 itens mas possui total residual gravado no banco:
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
  WHERE numero = p_mesa_numero;

  RETURN jsonb_build_object(
    'sucesso', true,
    'codigo', 'MESA_FECHADA_SEM_CONSUMO',
    'mesa_numero', p_mesa_numero,
    'comanda_id', v_comanda_id,
    'mensagem', 'Mesa ' || p_mesa_numero::text || ' fechada e liberada com sucesso!'
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.fechar_mesa_sem_consumo(integer) TO authenticated, service_role;

-- 5. Higienização inicial: recalcular todas as comandas ativas no banco para corrigir quaisquer totais órfãos anteriores
DO $$
DECLARE
  v_c RECORD;
BEGIN
  FOR v_c IN SELECT id FROM public.comandas WHERE status <> 'Fechada' LOOP
    PERFORM public.recalcular_total_comanda(v_c.id);
  END LOOP;
END $$;
