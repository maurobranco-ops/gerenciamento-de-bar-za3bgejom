-- Migração: Higienização de Mesa Livre e RPC para Iniciar Atendimento com Nome do Cliente
-- 1. Garante que leitura de mesa Livre nunca herde resíduo de status_conta = 'fechada'
-- 2. Trigger de salvaguarda reseta fluxo de conta completamente quando status = 'Livre'
-- 3. RPC iniciar_atendimento_online: registra nome do cliente na comanda e abre atendimento limpo

-- 1. Atualizar RPC obter_detalhes_conta_mesa com salvaguarda estrita para mesa Livre
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

  -- Salvaguarda em camadas:
  -- Se a comanda OU a mesa estiver 'Livre', OU se estiver 'Ocupada' com resíduo 'fechada', sanitizar para 'nenhum'
  v_status_conta_sanitizado := COALESCE(v_cmd.status_conta, 'nenhum');
  v_conta_solicitada_sanitizada := COALESCE(v_cmd.conta_solicitada, false);

  IF v_cmd.status = 'Livre' OR (v_cmd.status = 'Ocupada' AND v_status_conta_sanitizado = 'fechada') THEN
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

-- 2. Atualizar trigger salvaguarda_reset_fluxo_conta_comanda
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

  -- Se a comanda foi marcada como 'Livre', garante higienização TOTAL do fluxo de conta
  IF NEW.status = 'Livre' THEN
    NEW.status_conta := 'nenhum';
    NEW.conta_solicitada := false;
    NEW.conta_solicitada_em := NULL;
    NEW.forma_pagamento_solicitada := NULL;
    NEW.motivo_recusa_conta := NULL;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_salvaguarda_reset_fluxo_conta ON public.comandas;
CREATE TRIGGER trg_salvaguarda_reset_fluxo_conta
  BEFORE INSERT OR UPDATE ON public.comandas
  FOR EACH ROW
  EXECUTE FUNCTION public.salvaguarda_reset_fluxo_conta_comanda();

-- 3. Nova RPC: iniciar_atendimento_online
-- Permite que o cliente na mesa informe seu nome e abra um atendimento limpo
CREATE OR REPLACE FUNCTION public.iniciar_atendimento_online(
  p_mesa_numero INTEGER,
  p_cliente_nome TEXT
)
RETURNS JSONB AS $$
DECLARE
  v_mesa_num INTEGER := p_mesa_numero;
  v_comanda_id TEXT;
  v_nome TEXT;
  v_now TIMESTAMPTZ := NOW();
BEGIN
  IF v_mesa_num IS NULL OR v_mesa_num < 1 THEN
    RETURN jsonb_build_object(
      'sucesso', false,
      'codigo', 'MESA_INVALIDA',
      'mensagem', 'Número de mesa inválido.'
    );
  END IF;

  v_nome := trim(COALESCE(p_cliente_nome, ''));
  IF v_nome = '' THEN
    RETURN jsonb_build_object(
      'sucesso', false,
      'codigo', 'NOME_OBRIGATORIO',
      'mensagem', 'Por favor, informe seu nome para iniciar o atendimento.'
    );
  END IF;

  -- Limitar a 60 caracteres por segurança
  v_nome := substring(v_nome from 1 for 60);

  -- Garante existência da mesa e marca como Ocupada
  IF NOT EXISTS (SELECT 1 FROM public.mesas WHERE numero = v_mesa_num) THEN
    INSERT INTO public.mesas (numero, status, capacidade)
    VALUES (v_mesa_num, 'Ocupada', 4)
    ON CONFLICT (numero) DO UPDATE SET status = 'Ocupada', updated_at = v_now;
  ELSE
    UPDATE public.mesas
    SET status = 'Ocupada', updated_at = v_now
    WHERE numero = v_mesa_num;
  END IF;

  v_comanda_id := 'cmd-' || LPAD(v_mesa_num::text, 2, '0');

  -- Insere ou atualiza a comanda com o nome do cliente e higienização completa do fluxo de conta
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
    ) VALUES (
      v_comanda_id,
      v_mesa_num,
      v_nome,
      1,
      'Ocupada',
      v_now,
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
        cliente_nome = v_nome,
        aberta_em = COALESCE(aberta_em, v_now),
        status_conta = 'nenhum',
        conta_solicitada = false,
        conta_solicitada_em = NULL,
        forma_pagamento_solicitada = NULL,
        motivo_recusa_conta = NULL,
        fechada_em = NULL,
        updated_at = v_now
    WHERE id = v_comanda_id;
  END IF;

  RETURN jsonb_build_object(
    'sucesso', true,
    'comanda_id', v_comanda_id,
    'mesa_numero', v_mesa_num,
    'cliente_nome', v_nome,
    'mensagem', 'Atendimento iniciado com sucesso!'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.iniciar_atendimento_online(INTEGER, TEXT) TO anon, authenticated;

-- 4. Higienização imediata no banco de quaisquer comandas Livres ou com status residual
UPDATE public.comandas
SET status_conta = 'nenhum',
    conta_solicitada = false,
    conta_solicitada_em = NULL,
    forma_pagamento_solicitada = NULL,
    motivo_recusa_conta = NULL,
    updated_at = NOW()
WHERE status = 'Livre' OR status_conta = 'fechada';
