-- Migração: Adicionar suporte à solicitação de NFC-e pelo cliente,
-- persistência no fechamento e consulta do documento fiscal emitido
-- Data: 2026-10-19 04:15:00

-- 1. Adicionar colunas na tabela comandas se ainda não existirem
ALTER TABLE public.comandas
  ADD COLUMN IF NOT EXISTS nfce_solicitada BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS nfce_documento_id TEXT;

-- 2. Garantir publicação no canal Supabase Realtime para comandas e mesas
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'comandas'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.comandas;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'mesas'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.mesas;
  END IF;
END $$;

-- 3. Atualizar a função solicitar_conta_mesa para aceitar p_deseja_nfce
CREATE OR REPLACE FUNCTION public.solicitar_conta_mesa(
  p_mesa_numero integer,
  p_forma_pagamento text,
  p_deseja_nfce boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
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
  v_deseja_nfce BOOLEAN := COALESCE(p_deseja_nfce, false);
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

  -- Se comanda já está Livre, não faz sentido pedir conta
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

  -- Atualiza comanda: marca como Aguardando Pagamento, define conta_solicitada = true, forma de pagamento e nfce
  UPDATE public.comandas
  SET status = 'Aguardando Pagamento',
      conta_solicitada = true,
      conta_solicitada_em = NOW(),
      forma_pagamento_solicitada = v_forma_normalizada,
      nfce_solicitada = v_deseja_nfce,
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
    'nfce_solicitada', v_deseja_nfce,
    'subtotal', v_subtotal,
    'taxa_servico', v_taxa_valor,
    'total', v_total,
    'status_conta', 'solicitada',
    'mensagem', 'Conta solicitada com sucesso! O caixa já recebeu o aviso.'
  );
END;
$$;

-- 4. Atualizar caixa_autorizar_fechar_conta para manter nfce_solicitada e registrar o documento emitido
CREATE OR REPLACE FUNCTION public.caixa_autorizar_fechar_conta(
  p_mesa_numero integer,
  p_forma_pagamento text,
  p_valor_pago numeric,
  p_marcar_em_processamento_pix boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
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
  v_cliente_salvo TEXT;
  v_nfce_desejada BOOLEAN;
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
  v_cliente_salvo := COALESCE(v_cmd.cliente_nome, 'Consumidor Final');
  v_nfce_desejada := COALESCE(v_cmd.nfce_solicitada, false);

  -- Se for apenas o passo intermediário de "em_processamento_pix"
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
    v_cliente_salvo,
    v_comanda_id,
    v_access_key
  );

  -- C. Atualizar mesa para Livre
  UPDATE public.mesas
  SET status = 'Livre',
      updated_at = v_now
  WHERE numero = p_mesa_numero;

  -- D. Atualizar comanda para Fechada (status = 'Fechada', status_conta = 'fechada')
  -- preservando cliente_nome e fechada_em e registrando nfce_documento_id
  UPDATE public.comandas
  SET status = 'Fechada',
      status_conta = 'fechada',
      conta_solicitada = false,
      conta_solicitada_em = NULL,
      forma_pagamento_solicitada = v_forma,
      fechada_em = v_now,
      total = p_valor_pago,
      nfce_solicitada = v_nfce_desejada,
      nfce_documento_id = v_fisc_id,
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
    'fiscal_documento_id', v_fisc_id,
    'nfce_solicitada', v_nfce_desejada,
    'valor_pago', p_valor_pago,
    'forma_pagamento', v_forma,
    'mensagem', 'Mesa ' || p_mesa_numero::text || ' fechada com sucesso!'
  );
END;
$$;

-- 5. Atualizar a salvaguarda de reset da comanda para preservar o estado 'Fechada' e 'fechada'
CREATE OR REPLACE FUNCTION public.salvaguarda_reset_fluxo_conta_comanda()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  -- Se a comanda estiver sendo reaberta como 'Ocupada'
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
      NEW.nfce_solicitada := false;
      NEW.nfce_documento_id := NULL;
    END IF;
  END IF;

  -- Se a comanda for explicitamente marcada como 'Livre' por reset manual
  IF NEW.status = 'Livre' AND NEW.status_conta IS DISTINCT FROM 'fechada' THEN
    NEW.status_conta := 'nenhum';
    NEW.conta_solicitada := false;
    NEW.conta_solicitada_em := NULL;
    NEW.forma_pagamento_solicitada := NULL;
    NEW.motivo_recusa_conta := NULL;
    NEW.nfce_solicitada := false;
    NEW.nfce_documento_id := NULL;
  END IF;

  RETURN NEW;
END;
$$;

-- 6. Atualizar obter_detalhes_conta_mesa para retornar dados de fechamento e NFC-e
CREATE OR REPLACE FUNCTION public.obter_detalhes_conta_mesa(p_mesa_numero integer)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
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
  v_fisc RECORD;
  v_nfce_doc JSONB := NULL;
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
    razao_social,
    nome_fantasia,
    cnpj,
    inscricao_estadual,
    endereco_completo,
    telefone,
    impressora_fiscal_nome,
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

  -- Se a comanda estiver fechada, o total registrado na comanda é o valor pago final
  IF v_cmd.status = 'Fechada' OR v_cmd.status_conta = 'fechada' THEN
    IF v_cmd.total > 0 THEN
      v_total := v_cmd.total;
    END IF;
  END IF;

  v_status_conta_sanitizado := COALESCE(v_cmd.status_conta, 'nenhum');
  v_conta_solicitada_sanitizada := COALESCE(v_cmd.conta_solicitada, false);

  -- Se a comanda estiver Fechada ou fechada, busca o documento fiscal emitido
  IF v_cmd.status = 'Fechada' OR v_status_conta_sanitizado = 'fechada' THEN
    SELECT * INTO v_fisc
    FROM public.documentos_fiscais
    WHERE (id = v_cmd.nfce_documento_id OR comanda_id = v_comanda_id)
      AND status = 'Autorizada'
    ORDER BY emitido_em DESC
    LIMIT 1;

    IF FOUND THEN
      v_nfce_doc := jsonb_build_object(
        'id', v_fisc.id,
        'numero', v_fisc.numero,
        'serie', v_fisc.serie,
        'tipo', v_fisc.tipo,
        'emitido_em', v_fisc.emitido_em,
        'valor', v_fisc.valor,
        'status', v_fisc.status,
        'nome_cliente', v_fisc.nome_cliente,
        'documento_cliente', v_fisc.documento_cliente,
        'chave_acesso', v_fisc.chave_acesso
      );
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'encontrada', true,
    'comanda_id', v_cmd.id,
    'mesa_numero', v_cmd.mesa_numero,
    'cliente_nome', v_cmd.cliente_nome,
    'pessoas', v_cmd.pessoas,
    'status_mesa', v_cmd.status,
    'conta_solicitada', v_conta_solicitada_sanitizada,
    'conta_solicitada_em', v_cmd.conta_solicitada_em,
    'forma_pagamento_solicitada', v_cmd.forma_pagamento_solicitada,
    'status_conta', v_status_conta_sanitizado,
    'nfce_solicitada', COALESCE(v_cmd.nfce_solicitada, false),
    'nfce_documento', v_nfce_doc,
    'fechada_em', v_cmd.fechada_em,
    'motivo_recusa_conta', CASE WHEN v_status_conta_sanitizado = 'recusada' THEN v_cmd.motivo_recusa_conta ELSE NULL END,
    'subtotal', v_subtotal,
    'taxa_percentual', v_taxa_padrao,
    'taxa_servico', v_taxa_servico,
    'inclui_taxa_servico', v_cmd.inclui_taxa_servico,
    'total', v_total,
    'itens', v_itens,
    'bar_info', jsonb_build_object(
      'razao_social', v_cfg.razao_social,
      'nome_fantasia', v_cfg.nome_fantasia,
      'cnpj', v_cfg.cnpj,
      'inscricao_estadual', v_cfg.inscricao_estadual,
      'endereco_completo', v_cfg.endereco_completo,
      'telefone', v_cfg.telefone,
      'impressora_fiscal_nome', v_cfg.impressora_fiscal_nome
    ),
    'pix_chave', v_cfg.pix_chave,
    'pix_beneficiario_nome', v_cfg.pix_beneficiario_nome,
    'pix_cidade', v_cfg.pix_cidade
  );
END;
$$;

-- 7. Função dedicada para o cliente autenticado/anônimo obter o documento fiscal da comanda da mesa
CREATE OR REPLACE FUNCTION public.obter_nfce_comanda_mesa(p_mesa_numero integer)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_comanda_id TEXT;
  v_cmd RECORD;
  v_fisc RECORD;
  v_cfg RECORD;
BEGIN
  v_comanda_id := 'cmd-' || LPAD(p_mesa_numero::text, 2, '0');

  SELECT * INTO v_cmd
  FROM public.comandas
  WHERE id = v_comanda_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('sucesso', false, 'mensagem', 'Comanda não encontrada.');
  END IF;

  SELECT * INTO v_fisc
  FROM public.documentos_fiscais
  WHERE (id = v_cmd.nfce_documento_id OR comanda_id = v_comanda_id)
    AND status = 'Autorizada'
  ORDER BY emitido_em DESC
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('sucesso', false, 'mensagem', 'Nenhum documento fiscal emitido para esta comanda.');
  END IF;

  SELECT * INTO v_cfg
  FROM public.configuracoes_bar
  WHERE id = 'principal';

  RETURN jsonb_build_object(
    'sucesso', true,
    'documento', jsonb_build_object(
      'id', v_fisc.id,
      'numero', v_fisc.numero,
      'serie', v_fisc.serie,
      'tipo', v_fisc.tipo,
      'emitido_em', v_fisc.emitido_em,
      'valor', v_fisc.valor,
      'status', v_fisc.status,
      'nome_cliente', v_fisc.nome_cliente,
      'documento_cliente', v_fisc.documento_cliente,
      'chave_acesso', v_fisc.chave_acesso
    ),
    'bar_info', jsonb_build_object(
      'razao_social', v_cfg.razao_social,
      'nome_fantasia', v_cfg.nome_fantasia,
      'cnpj', v_cfg.cnpj,
      'inscricao_estadual', v_cfg.inscricao_estadual,
      'endereco_completo', v_cfg.endereco_completo,
      'telefone', v_cfg.telefone,
      'impressora_fiscal_nome', v_cfg.impressora_fiscal_nome
    )
  );
END;
$$;

-- Permissões de execução para anon e authenticated
GRANT EXECUTE ON FUNCTION public.solicitar_conta_mesa(integer, text, boolean) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.obter_detalhes_conta_mesa(integer) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.obter_nfce_comanda_mesa(integer) TO anon, authenticated;
