-- Migração: Função RPC segura fechar_mesa_sem_consumo
-- Permite que Garçom, Caixa e Gerente encerrem e liberem mesas abertas SEM consumo (0 itens lançados e total = 0).
-- Caso a comanda possua itens lançados ou consumo registrado, a operação é terminantemente recusada no servidor.
-- Restaura a mesa para status 'Livre', higieniza a comanda (status 'Livre', cliente_nome = NULL, pessoas = 0, total = 0)
-- e reseta salvaguardas de fluxo de conta (sem resíduos).

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

  -- 5. Salvaguarda no servidor: Se houver produtos lançados ou total > 0, bloquear!
  IF v_qtd_itens > 0 OR COALESCE(v_cmd.total, 0) > 0 THEN
    RETURN jsonb_build_object(
      'sucesso', false,
      'codigo', 'MESA_COM_CONSUMO',
      'itens_count', v_qtd_itens,
      'total', COALESCE(v_cmd.total, 0),
      'mensagem', 'A Mesa ' || p_mesa_numero::text || ' possui ' || v_qtd_itens::text || ' item(ns) lançado(s). Para mesas com consumo, utilize o fluxo de Enviar para Pagamento / Caixa.'
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

-- Permissões de execução
GRANT EXECUTE ON FUNCTION public.fechar_mesa_sem_consumo(integer) TO authenticated, service_role;
