-- Migração: Salvaguarda para reset dos campos de fluxo de conta ao abrir ou reabrir mesa/comanda
-- Garante que estados residuais de fechamentos anteriores (status_conta = 'fechada', conta_solicitada = true, etc.)
-- nunca persistam quando uma mesa/comanda estiver ou for colocada em atendimento ('Ocupada')

-- 1. Função trigger para higienização automática em public.comandas
CREATE OR REPLACE FUNCTION public.salvaguarda_reset_fluxo_conta_comanda()
RETURNS TRIGGER AS $$
BEGIN
  -- Se a comanda está sendo criada ou reaberta como 'Ocupada',
  -- ou transicionando de 'Livre' / 'Fechada' para 'Ocupada',
  -- ou se estiver 'Ocupada' e com status_conta residual 'fechada', reseta tudo para o estado limpo
  IF NEW.status = 'Ocupada' THEN
    IF (TG_OP = 'INSERT')
       OR (OLD.status IS DISTINCT FROM 'Ocupada')
       OR (OLD.status_conta = 'fechada')
       OR (NEW.status_conta = 'fechada')
       OR (NEW.status_conta IS NULL) THEN
      NEW.status_conta := 'nenhum';
      NEW.conta_solicitada := false;
      NEW.conta_solicitada_em := NULL;
      NEW.forma_pagamento_solicitada := NULL;
      NEW.motivo_recusa_conta := NULL;
    END IF;
  END IF;

  -- Se a comanda foi marcada como 'Livre', garante que solicitações pendentes sejam limpas
  IF NEW.status = 'Livre' THEN
    NEW.conta_solicitada := false;
    NEW.conta_solicitada_em := NULL;
    NEW.forma_pagamento_solicitada := NULL;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_salvaguarda_reset_fluxo_conta ON public.comandas;
CREATE TRIGGER trg_salvaguarda_reset_fluxo_conta
  BEFORE INSERT OR UPDATE ON public.comandas
  FOR EACH ROW
  EXECUTE FUNCTION public.salvaguarda_reset_fluxo_conta_comanda();

-- 2. Atualizar RPC enviar_pedido_online com a salvaguarda explícita ao abrir ou atualizar comanda
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

  -- Garante ou abre comanda da mesa resetando completamente os campos do fluxo de conta
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
        cliente_nome = COALESCE(NULLIF(trim(p_cliente_nome), ''), comandas.cliente_nome, 'Cliente On-line'),
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

-- 3. Atualizar RPC obter_detalhes_conta_mesa com salvaguarda de leitura:
-- Se a mesa estiver 'Ocupada' e tiver status_conta = 'fechada', retornar status_conta = 'nenhum'
CREATE OR REPLACE FUNCTION public.obter_detalhes_conta_mesa(
  p_mesa_numero INTEGER
)
RETURNS JSONB AS $$
DECLARE
  v_comanda_id TEXT;
  v_cmd RECORD;
  v_subtotal NUMERIC(10,2) := 0.00;
  v_taxa_padrao NUMERIC(10,2) := 10.00;
  v_taxa_servico NUMERIC(10,2) := 0.00;
  v_total NUMERIC(10,2) := 0.00;
  v_itens JSONB := '[]'::jsonb;
  v_status_conta_sanitizado TEXT;
  v_conta_solicitada_sanitizada BOOLEAN;
BEGIN
  v_comanda_id := 'cmd-' || LPAD(p_mesa_numero::text, 2, '0');

  SELECT * INTO v_cmd
  FROM public.comandas
  WHERE id = v_comanda_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('encontrada', false);
  END IF;

  SELECT COALESCE(taxa_servico_padrao, 10.00)
  INTO v_taxa_padrao
  FROM public.configuracoes_bar
  WHERE id = 'principal';

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

  -- Salvaguarda: se comanda ou mesa estiver Ocupada e status_conta for 'fechada', sanitizar para 'nenhum'
  v_status_conta_sanitizado := COALESCE(v_cmd.status_conta, 'nenhum');
  v_conta_solicitada_sanitizada := COALESCE(v_cmd.conta_solicitada, false);

  IF v_cmd.status = 'Ocupada' AND v_status_conta_sanitizado = 'fechada' THEN
    v_status_conta_sanitizado := 'nenhum';
    v_conta_solicitada_sanitizada := false;
  END IF;

  RETURN jsonb_build_object(
    'encontrada', true,
    'comanda_id', v_cmd.id,
    'mesa_numero', v_cmd.mesa_numero,
    'cliente_nome', v_cmd.cliente_nome,
    'pessoas', v_cmd.pessoas,
    'status_mesa', v_cmd.status,
    'conta_solicitada', v_conta_solicitada_sanitizada,
    'conta_solicitada_em', CASE WHEN v_status_conta_sanitizado = 'nenhum' THEN NULL ELSE v_cmd.conta_solicitada_em END,
    'forma_pagamento_solicitada', CASE WHEN v_status_conta_sanitizado = 'nenhum' THEN NULL ELSE v_cmd.forma_pagamento_solicitada END,
    'status_conta', v_status_conta_sanitizado,
    'motivo_recusa_conta', CASE WHEN v_status_conta_sanitizado = 'recusada' THEN v_cmd.motivo_recusa_conta ELSE NULL END,
    'subtotal', v_subtotal,
    'taxa_percentual', v_taxa_padrao,
    'taxa_servico', v_taxa_servico,
    'inclui_taxa_servico', v_cmd.inclui_taxa_servico,
    'total', v_total,
    'itens', v_itens
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.obter_detalhes_conta_mesa(INTEGER) TO anon, authenticated;

-- 4. Higienização imediata das comandas que estejam atualmente Ocupadas
UPDATE public.comandas
SET status_conta = 'nenhum',
    conta_solicitada = false,
    conta_solicitada_em = NULL,
    forma_pagamento_solicitada = NULL,
    motivo_recusa_conta = NULL,
    updated_at = NOW()
WHERE status = 'Ocupada' AND status_conta = 'fechada';
