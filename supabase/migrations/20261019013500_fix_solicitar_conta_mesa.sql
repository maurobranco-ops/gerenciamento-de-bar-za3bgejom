-- Correção e substituição da RPC solicitar_conta_mesa com tipos estritos
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
