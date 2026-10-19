-- Migração: Pedir a Conta no Pedido On-line (Rachide Bar)
-- Suporte ao fluxo ponta a ponta:
-- 1. Colunas em comandas para armazenar solicitação de conta, forma de pagamento, motivo de recusa/adiamento e status do fechamento
-- 2. RPC solicitar_conta_mesa (anon e authenticated) para clientes pedirem a conta da mesa
-- 3. RPC obter_detalhes_conta_mesa (anon e authenticated) para cliente e caixa obterem totais, itens e status em tempo real
-- 4. RPC caixa_autorizar_fechar_conta (restrita a Caixa e Gerente) com suporte a Pix (BR Code), Dinheiro, Cartão e emissão automática de caixa/fiscal
-- 5. RPC caixa_recusar_adiar_conta (restrita a Caixa e Gerente) devolvendo a mesa ao estado normal com motivo para o cliente

-- 1. Colunas na tabela comandas
ALTER TABLE public.comandas
  ADD COLUMN IF NOT EXISTS conta_solicitada BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS conta_solicitada_em TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS forma_pagamento_solicitada TEXT,
  ADD COLUMN IF NOT EXISTS status_conta TEXT NOT NULL DEFAULT 'nenhum'
    CHECK (status_conta IN ('nenhum', 'solicitada', 'autorizada', 'em_processamento_pix', 'fechada', 'recusada')),
  ADD COLUMN IF NOT EXISTS motivo_recusa_conta TEXT;

CREATE INDEX IF NOT EXISTS idx_comandas_conta_solicitada
  ON public.comandas(conta_solicitada, status);

-- 2. RPC: solicitar_conta_mesa (pode ser chamada por anon da tela /pedido)
CREATE OR REPLACE FUNCTION public.solicitar_conta_mesa(
  p_mesa_numero INTEGER,
  p_forma_pagamento TEXT
)
RETURNS JSONB AS $$
DECLARE
  v_comanda_id TEXT;
  v_status_atual TEXT;
  v_total NUMERIC(10,2) := 0.00;
  v_subtotal NUMERIC(10,2) := 0.00;
  v_taxa NUMERIC(10,2) := 10.00;
  v_inclui_taxa BOOLEAN := true;
  v_taxa_valor NUMERIC(10,2) := 0.00;
  v_itens_count INTEGER := 0;
  v_status_conta_atual TEXT;
  v_forma_normalizada TEXT;
BEGIN
  -- Validar forma de pagamento
  v_forma_normalizada := trim(p_forma_pagamento);
  IF v_forma_normalizada NOT IN ('Pix', 'Cartão Crédito', 'Cartão Débito', 'Dinheiro') THEN
    RETURN jsonb_build_object(
      'sucesso', false,
      'codigo', 'FORMA_INVALIDA',
      'mensagem', 'Forma de pagamento inválida. Escolha entre Pix, Cartão Crédito, Cartão Débito ou Dinheiro.'
    );
  END IF;

  v_comanda_id := 'cmd-' || LPAD(p_mesa_numero::text, 2, '0');

  -- Verifica se existe comanda para a mesa
  SELECT status, inclui_taxa_servico, status_conta
  INTO v_status_atual, v_inclui_taxa, v_status_conta_atual
  FROM public.comandas
  WHERE id = v_comanda_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'sucesso', false,
      'codigo', 'COMANDA_NAO_ENCONTRADA',
      'mensagem', 'Comanda não encontrada para esta mesa.'
    );
  END IF;

  -- Se comanda já está Livre ou Fechada, não faz sentido pedir conta
  IF v_status_atual = 'Livre' THEN
    RETURN jsonb_build_object(
      'sucesso', false,
      'codigo', 'MESA_LIVRE',
      'mensagem', 'A mesa está livre. Não há consumo a ser pago.'
    );
  END IF;

  -- Se já estiver com solicitação ativa, previne duplicação
  IF v_status_conta_atual IN ('solicitada', 'autorizada', 'em_processamento_pix') THEN
    RETURN jsonb_build_object(
      'sucesso', true,
      'codigo', 'JA_SOLICITADA',
      'mensagem', 'A conta desta mesa já foi solicitada e está em processamento no caixa.',
      'status_conta', v_status_conta_atual,
      'comanda_id', v_comanda_id
    );
  END IF;

  -- Obter taxa padrão do bar
  SELECT COALESCE(taxa_servico_padrao, 10.00)
  INTO v_taxa
  FROM public.configuracoes_bar
  WHERE id = 'principal';

  -- Calcular consumo atual dos itens da comanda
  SELECT COALESCE(SUM(preco_unitario * quantidade), 0.00), COUNT(*)
  INTO v_subtotal, v_itens_count
  FROM public.comanda_itens
  WHERE comanda_id = v_comanda_id;

  IF v_itens_count = 0 THEN
    RETURN jsonb_build_object(
      'sucesso', false,
      'codigo', 'COMANDA_VAZIA',
      'mensagem', 'Não há itens lançados nesta comanda para pedir a conta.'
    );
  END IF;

  IF v_inclui_taxa THEN
    v_taxa_valor := ROUND((v_subtotal * (v_taxa / 100.0)), 2);
  ELSE
    v_taxa_valor := 0.00;
  END IF;
  v_total := v_subtotal + v_taxa_valor;

  -- Atualiza comanda: marca como Aguardando Pagamento, define conta_solicitada = true, forma de pagamento
  UPDATE public.comandas
  SET status = 'Aguardando Pagamento',
      conta_solicitada = true,
      conta_solicitada_em = NOW(),
      forma_pagamento_solicitada = v_forma_normalizada,
      status_conta = 'solicitada',
      motivo_recusa_conta = NULL,
      total = v_total,
      updated_at = NOW()
  WHERE id = v_comanda_id;

  -- Atualiza status da mesa para Aguardando Pagamento
  UPDATE public.mesas
  SET status = 'Aguardando Pagamento',
      updated_at = NOW()
  WHERE numero = p_mesa_numero;

  RETURN jsonb_build_object(
    'sucesso', true,
    'codigo', 'SOLICITADA_COM_SUCESSO',
    'comanda_id', v_comanda_id,
    'mesa_numero', p_mesa_numero,
    'forma_pagamento', v_forma_normalizada,
    'subtotal', v_subtotal,
    'taxa_servico', v_taxa_valor,
    'total', v_total,
    'status_conta', 'solicitada',
    'mensagem', 'Conta solicitada com sucesso! O caixa já recebeu o aviso.'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.solicitar_conta_mesa(INTEGER, TEXT) TO anon, authenticated;

-- 3. RPC: obter_detalhes_conta_mesa
-- Permite ao cliente na /pedido e ao Caixa obterem os dados completos da comanda aberta
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

  RETURN jsonb_build_object(
    'encontrada', true,
    'comanda_id', v_cmd.id,
    'mesa_numero', v_cmd.mesa_numero,
    'cliente_nome', v_cmd.cliente_nome,
    'pessoas', v_cmd.pessoas,
    'status_mesa', v_cmd.status,
    'conta_solicitada', COALESCE(v_cmd.conta_solicitada, false),
    'conta_solicitada_em', v_cmd.conta_solicitada_em,
    'forma_pagamento_solicitada', v_cmd.forma_pagamento_solicitada,
    'status_conta', COALESCE(v_cmd.status_conta, 'nenhum'),
    'motivo_recusa_conta', v_cmd.motivo_recusa_conta,
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

-- 4. RPC: caixa_autorizar_fechar_conta
-- Exclusivo para perfis Caixa ou Gerente
CREATE OR REPLACE FUNCTION public.caixa_autorizar_fechar_conta(
  p_mesa_numero INTEGER,
  p_forma_pagamento TEXT,
  p_valor_pago NUMERIC,
  p_marcar_em_processamento_pix BOOLEAN DEFAULT false
)
RETURNS JSONB AS $$
DECLARE
  v_comanda_id TEXT;
  v_cmd RECORD;
  v_user_profile TEXT;
  v_user_label TEXT;
  v_mov_id TEXT;
  v_fisc_id TEXT;
  v_seq INTEGER;
  v_doc_number TEXT;
  v_access_key TEXT;
  v_now TIMESTAMPTZ := NOW();
  v_forma TEXT;
BEGIN
  -- 1. Validação de segurança de perfil (apenas caixa ou gerente)
  v_user_profile := public.get_current_user_profile();
  IF v_user_profile IS NULL OR v_user_profile NOT IN ('caixa', 'gerente') THEN
    RAISE EXCEPTION 'Ação não permitida: apenas Caixa ou Gerente podem autorizar e fechar comandas.'
      USING ERRCODE = '42501';
  END IF;

  v_user_label := CASE WHEN v_user_profile = 'gerente' THEN 'Carlos Gerente' ELSE 'Marina Caixa' END;
  v_comanda_id := 'cmd-' || LPAD(p_mesa_numero::text, 2, '0');

  SELECT * INTO v_cmd FROM public.comandas WHERE id = v_comanda_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Comanda % não encontrada.', v_comanda_id;
  END IF;

  v_forma := COALESCE(NULLIF(trim(p_forma_pagamento), ''), v_cmd.forma_pagamento_solicitada, 'Pix');

  -- Se for apenas o passo intermediário de "em_processamento_pix" (exibir QR Code Pix e aguardar conferência)
  IF p_marcar_em_processamento_pix THEN
    UPDATE public.comandas
    SET status_conta = 'em_processamento_pix',
        updated_at = v_now
    WHERE id = v_comanda_id;

    RETURN jsonb_build_object(
      'sucesso', true,
      'status_conta', 'em_processamento_pix',
      'mensagem', 'Status atualizado para Pagamento em Processamento (Pix).'
    );
  END IF;

  -- Fechamento final e homologação:
  -- A. Registrar movimento no caixa
  v_mov_id := 'cm-' || floor(extract(epoch from clock_timestamp()) * 1000)::text;
  INSERT INTO public.movimentos_caixa (
    id, data_hora, descricao, tipo, forma_pagamento, valor, usuario, comanda_id
  ) VALUES (
    v_mov_id,
    v_now,
    'Pagamento Mesa ' || p_mesa_numero::text || ' (Fechamento Solicitado On-line)',
    'Entrada',
    v_forma,
    p_valor_pago,
    v_user_label,
    v_comanda_id
  );

  -- B. Emitir documento fiscal simulado
  v_seq := floor(100 + random() * 900)::integer;
  v_doc_number := 'NFC-e 000.' || v_seq::text;
  v_fisc_id := 'fisc-' || floor(extract(epoch from clock_timestamp()) * 1000)::text;
  v_access_key := '3525031429384200018465001000000' || floor(1000000000 + random() * 9000000000)::text;

  INSERT INTO public.documentos_fiscais (
    id, numero, serie, tipo, emitido_em, valor, status, nome_cliente, comanda_id, chave_acesso
  ) VALUES (
    v_fisc_id,
    v_doc_number,
    '001',
    'NFC-e',
    v_now,
    p_valor_pago,
    'Autorizada',
    COALESCE(v_cmd.cliente_nome, 'Consumidor Final'),
    v_comanda_id,
    v_access_key
  );

  -- C. Atualizar mesa para Livre
  UPDATE public.mesas
  SET status = 'Livre',
      updated_at = v_now
  WHERE numero = p_mesa_numero;

  -- D. Atualizar comanda para Livre, limpando solicitação e itens
  UPDATE public.comandas
  SET status = 'Livre',
      status_conta = 'fechada',
      conta_solicitada = false,
      conta_solicitada_em = NULL,
      forma_pagamento_solicitada = NULL,
      cliente_nome = NULL,
      pessoas = 0,
      fechada_em = v_now,
      total = 0.00,
      motivo_recusa_conta = NULL,
      updated_at = v_now
  WHERE id = v_comanda_id;

  -- E. Limpar itens da comanda
  DELETE FROM public.comanda_itens WHERE comanda_id = v_comanda_id;

  RETURN jsonb_build_object(
    'sucesso', true,
    'comanda_id', v_comanda_id,
    'mesa_numero', p_mesa_numero,
    'status_conta', 'fechada',
    'movimento_id', v_mov_id,
    'fiscal_numero', v_doc_number,
    'valor_pago', p_valor_pago,
    'forma_pagamento', v_forma,
    'mensagem', 'Mesa ' || p_mesa_numero::text || ' fechada com sucesso!'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.caixa_autorizar_fechar_conta(INTEGER, TEXT, NUMERIC, BOOLEAN) TO authenticated;

-- 5. RPC: caixa_recusar_adiar_conta
-- Exclusivo para perfis Caixa ou Gerente
CREATE OR REPLACE FUNCTION public.caixa_recusar_adiar_conta(
  p_mesa_numero INTEGER,
  p_motivo TEXT
)
RETURNS JSONB AS $$
DECLARE
  v_comanda_id TEXT;
  v_user_profile TEXT;
  v_now TIMESTAMPTZ := NOW();
  v_motivo_final TEXT;
BEGIN
  -- 1. Validação de perfil (Caixa ou Gerente)
  v_user_profile := public.get_current_user_profile();
  IF v_user_profile IS NULL OR v_user_profile NOT IN ('caixa', 'gerente') THEN
    RAISE EXCEPTION 'Ação não permitida: apenas Caixa ou Gerente podem adiar ou recusar fechamento.'
      USING ERRCODE = '42501';
  END IF;

  v_motivo_final := COALESCE(NULLIF(trim(p_motivo), ''), 'Mesa com atendimento em continuidade / novo pedido em andamento');
  v_comanda_id := 'cmd-' || LPAD(p_mesa_numero::text, 2, '0');

  -- Devolve mesa ao status 'Ocupada'
  UPDATE public.mesas
  SET status = 'Ocupada',
      updated_at = v_now
  WHERE numero = p_mesa_numero;

  -- Atualiza comanda devolvendo para 'Ocupada', gravando o motivo para exibição ao cliente
  UPDATE public.comandas
  SET status = 'Ocupada',
      conta_solicitada = false,
      status_conta = 'recusada',
      motivo_recusa_conta = v_motivo_final,
      updated_at = v_now
  WHERE id = v_comanda_id;

  RETURN jsonb_build_object(
    'sucesso', true,
    'mesa_numero', p_mesa_numero,
    'status_mesa', 'Ocupada',
    'status_conta', 'recusada',
    'motivo', v_motivo_final,
    'mensagem', 'Solicitação de conta adiada/recusada. A mesa retornou ao estado Ocupada.'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.caixa_recusar_adiar_conta(INTEGER, TEXT) TO authenticated;
