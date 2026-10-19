-- Migração: Incluir dados Pix das configurações na RPC obter_detalhes_conta_mesa
-- Permite que o cliente na mesa visualize o QR Code Pix real (BR Code do Banco Central)
-- e o código Pix Copia e Cola quando o Caixa marcar o status como "em_processamento_pix".

CREATE OR REPLACE FUNCTION public.obter_detalhes_conta_mesa(
  p_mesa_numero INTEGER
)
RETURNS JSONB AS $$
DECLARE
  v_comanda_id TEXT;
  v_cmd RECORD;
  v_cfg RECORD;
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

  SELECT
    COALESCE(taxa_servico_padrao, 10.00) AS taxa_servico_padrao,
    pix_chave,
    pix_beneficiario_nome,
    pix_cidade
  INTO v_cfg
  FROM public.configuracoes_bar
  WHERE id = 'principal';

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
    'itens', v_itens,
    'pix_chave', v_cfg.pix_chave,
    'pix_beneficiario_nome', v_cfg.pix_beneficiario_nome,
    'pix_cidade', v_cfg.pix_cidade
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.obter_detalhes_conta_mesa(INTEGER) TO anon, authenticated;
