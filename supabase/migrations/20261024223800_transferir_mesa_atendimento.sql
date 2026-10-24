-- Migração: Função RPC segura transferir_mesa_atendimento
-- Permite que Garçom, Caixa e Gerente transfiram o atendimento integral de uma mesa de origem para uma mesa de destino.
-- A comanda (com cliente_nome, status, pessoas, total, conta_solicitada, status_conta, forma_pagamento_solicitada,
-- nfce_solicitada, nfce_documento_id, motivo_recusa_conta), seus itens e a fila de cozinha acompanham na íntegra.
-- A mesa de origem é higienizada e marcada como Livre imediatamente, pronta para novos atendimentos.

CREATE OR REPLACE FUNCTION public.transferir_mesa_atendimento(
  p_mesa_origem integer,
  p_mesa_destino integer
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_profile TEXT;
  v_user_label TEXT;
  v_cmd_origem_id TEXT;
  v_cmd_destino_id TEXT;
  v_cmd RECORD;
  v_mesa_dest RECORD;
  v_now TIMESTAMPTZ := NOW();
  v_itens_transferidos INTEGER := 0;
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
    RETURN jsonb_build_object(
      'sucesso', false,
      'codigo', 'MESA_ORIGEM_INVALIDA',
      'mensagem', 'Mesa de origem inválida.'
    );
  END IF;

  IF p_mesa_destino IS NULL OR p_mesa_destino <= 0 THEN
    RETURN jsonb_build_object(
      'sucesso', false,
      'codigo', 'MESA_DESTINO_INVALIDA',
      'mensagem', 'Mesa de destino inválida.'
    );
  END IF;

  IF p_mesa_origem = p_mesa_destino THEN
    RETURN jsonb_build_object(
      'sucesso', false,
      'codigo', 'MESAS_IGUAIS',
      'mensagem', 'A mesa de destino deve ser diferente da mesa de origem.'
    );
  END IF;

  -- 3. Obter e validar a comanda da mesa de origem
  v_cmd_origem_id := 'cmd-' || LPAD(p_mesa_origem::text, 2, '0');
  v_cmd_destino_id := 'cmd-' || LPAD(p_mesa_destino::text, 2, '0');

  SELECT * INTO v_cmd FROM public.comandas WHERE id = v_cmd_origem_id;
  IF NOT FOUND OR v_cmd.status = 'Livre' THEN
    RETURN jsonb_build_object(
      'sucesso', false,
      'codigo', 'ORIGEM_SEM_ATENDIMENTO',
      'mensagem', 'A Mesa ' || p_mesa_origem::text || ' não possui atendimento aberto ou consumo para transferir.'
    );
  END IF;

  -- 4. Validar se a mesa de destino existe e está livre
  SELECT * INTO v_mesa_dest FROM public.mesas WHERE numero = p_mesa_destino;
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
    id,
    mesa_numero,
    cliente_nome,
    pessoas,
    status,
    aberta_em,
    fechada_em,
    inclui_taxa_servico,
    garcom,
    total,
    conta_solicitada,
    conta_solicitada_em,
    forma_pagamento_solicitada,
    status_conta,
    motivo_recusa_conta,
    nfce_solicitada,
    nfce_documento_id,
    created_at,
    updated_at
  ) VALUES (
    v_cmd_destino_id,
    p_mesa_destino,
    v_cmd.cliente_nome,
    v_cmd.pessoas,
    v_cmd.status,
    COALESCE(v_cmd.aberta_em, v_now),
    v_cmd.fechada_em,
    v_cmd.inclui_taxa_servico,
    COALESCE(v_cmd.garcom, v_user_label),
    v_cmd.total,
    v_cmd.conta_solicitada,
    v_cmd.conta_solicitada_em,
    v_cmd.forma_pagamento_solicitada,
    v_cmd.status_conta,
    v_cmd.motivo_recusa_conta,
    COALESCE(v_cmd.nfce_solicitada, false),
    v_cmd.nfce_documento_id,
    COALESCE(v_cmd.created_at, v_now),
    v_now
  )
  ON CONFLICT (id) DO UPDATE SET
    mesa_numero = EXCLUDED.mesa_numero,
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
  WHERE numero = p_mesa_destino;

  -- 9. Limpar e liberar a mesa de origem imediatamente
  UPDATE public.mesas
  SET status = 'Livre',
      updated_at = v_now
  WHERE numero = p_mesa_origem;

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
$$;

-- Permissões de execução: conceder para authenticated e service_role
GRANT EXECUTE ON FUNCTION public.transferir_mesa_atendimento(integer, integer) TO authenticated, service_role;
