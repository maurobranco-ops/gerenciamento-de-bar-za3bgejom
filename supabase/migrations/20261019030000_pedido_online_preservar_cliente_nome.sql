-- Migration: Preservar cliente_nome em enviar_pedido_online
-- O envio de itens on-line não deve sobrescrever o nome definido na abertura da mesa.

CREATE OR REPLACE FUNCTION public.enviar_pedido_online(
  p_mesa_numero INTEGER,
  p_cliente_nome TEXT,
  p_itens JSONB
)
RETURNS JSONB AS $$
DECLARE
  v_mesa_num INTEGER := p_mesa_numero;
  v_comanda_id TEXT;
  v_item JSONB;
  v_prod RECORD;
  v_comanda_item_id TEXT;
  v_itens_inseridos INTEGER := 0;
  v_total_pedido NUMERIC(10,2) := 0.00;
  v_area TEXT := 'bar';
BEGIN
  -- Validação de entrada
  IF v_mesa_num IS NULL OR v_mesa_num < 1 THEN
    v_mesa_num := 10;
  END IF;

  IF p_itens IS NULL OR jsonb_array_length(p_itens) = 0 THEN
    RETURN jsonb_build_object(
      'sucesso', false,
      'codigo', 'ITENS_VAZIOS',
      'mensagem', 'Nenhum item válido informado no pedido.'
    );
  END IF;

  -- Garante existência da mesa
  IF NOT EXISTS (SELECT 1 FROM public.mesas WHERE numero = v_mesa_num) THEN
    INSERT INTO public.mesas (numero, status, capacidade)
    VALUES (v_mesa_num, 'Livre', 4)
    ON CONFLICT (numero) DO NOTHING;
  END IF;

  v_comanda_id := 'cmd-' || LPAD(v_mesa_num::text, 2, '0');

  -- Garante ou atualiza comanda da mesa
  -- REGRA OBRIGATÓRIA: Não sobrescrever o cliente_nome se já existir na comanda!
  IF NOT EXISTS (SELECT 1 FROM public.comandas WHERE id = v_comanda_id) THEN
    INSERT INTO public.comandas (
      id,
      mesa_numero,
      cliente_nome,
      pessoas,
      status,
      aberta_em,
      total,
      status_conta,
      conta_solicitada,
      conta_solicitada_em,
      forma_pagamento_solicitada,
      motivo_recusa_conta
    )
    VALUES (
      v_comanda_id,
      v_mesa_num,
      COALESCE(NULLIF(trim(p_cliente_nome), ''), 'Cliente On-line'),
      1,
      'Ocupada',
      NOW(),
      0.00,
      'nenhum',
      false,
      NULL,
      NULL,
      NULL
    );
  ELSE
    UPDATE public.comandas
    SET status = 'Ocupada',
        -- Preserva rigorosamente o nome já existente; só usa p_cliente_nome se cliente_nome for nulo/vazio
        cliente_nome = COALESCE(NULLIF(trim(comandas.cliente_nome), ''), NULLIF(trim(p_cliente_nome), ''), 'Cliente On-line'),
        aberta_em = COALESCE(aberta_em, NOW()),
        status_conta = 'nenhum',
        conta_solicitada = false,
        conta_solicitada_em = NULL,
        forma_pagamento_solicitada = NULL,
        motivo_recusa_conta = NULL,
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

GRANT EXECUTE ON FUNCTION public.enviar_pedido_online(INTEGER, TEXT, JSONB) TO anon, authenticated;
