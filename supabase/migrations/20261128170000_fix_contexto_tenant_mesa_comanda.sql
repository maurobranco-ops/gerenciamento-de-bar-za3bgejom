-- ============================================================================
-- CORREÇÃO FATAL MULTI-TENANT: contexto de mesa/comanda sem filtro de tenant
--
-- Causa provada: preparar_contexto_tenant_mesa(p_mesa_numero) buscava
-- "select tenant_id from mesas where numero = p_mesa_numero" SEM filtrar o
-- estabelecimento do usuário logado. Mesas 1, 2 e 3 existem nos 2 tenants
-- (Rachide Bar e R Burguer), então a busca pegava a primeira linha global:
-- a comanda abria no tenant errado e o fechamento recusava com
-- "Esta mesa pertence a outro estabelecimento".
--
-- Regra corrigida:
-- 1. Usuário logado (estabelecimento_atual() não nulo): a mesa DEVE pertencer
--    ao estabelecimento do usuário (where numero = ... and tenant_id = v_atual).
--    Não encontrada → return false (sem fallback para linha de outro tenant).
--    Idem para preparar_contexto_tenant_comanda (comanda do estabelecimento
--    atual; comanda de outro tenant → false).
-- 2. Caminho anônimo (estabelecimento_atual() nulo — cliente /pedido):
--    mantém a resolução via tenant_do_pedido_anonimo (header x-tenant do QR
--    + x-mesa), que já é estrita pelo par (tenant, mesa).
--
-- Também blinda toda consulta de comandas/comanda_itens por id 'cmd-XX' nas
-- RPCs operacionais com "AND tenant_id = v_tenant" (o GUC app.estabelecimento_id
-- fixado pelo contexto): comanda_id é igual nos 2 tenants, então SELECT/UPDATE/
-- DELETE sem filtro de tenant tocava a linha errada.
--
-- Convenções: pgcrypto vive no schema extensions (nada aqui usa gen_salt/crypt);
-- toda função usada em política/dependente é recriada na ordem
-- DROP FUNCTION IF EXISTS → CREATE FUNCTION (evita 42P13/2BP01).
-- Idempotente: DROP ... IF EXISTS antes de cada CREATE.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Funções de contexto recriadas com o filtro estrito de tenant.
-- ----------------------------------------------------------------------------

-- 1.a Contexto por mesa
drop function if exists public.preparar_contexto_tenant_mesa(integer);

create function public.preparar_contexto_tenant_mesa(p_mesa_numero integer)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant uuid;
  v_atual uuid := public.estabelecimento_atual();
begin
  if p_mesa_numero is null or p_mesa_numero < 1 then
    return false;
  end if;

  if v_atual is not null then
    -- Usuário logado: a mesa DEVE ser do estabelecimento dele.
    -- Sem fallback "primeira linha global" (era a causa do bug).
    select tenant_id into v_tenant
    from public.mesas
    where numero = p_mesa_numero
      and tenant_id = v_atual
    limit 1;

    if v_tenant is null then
      return false;
    end if;
  else
    -- Caminho anônimo (cliente /pedido): resolve pelo par (tenant do QR, mesa)
    -- via header x-tenant + x-mesa; nunca cruza tenants por número de mesa.
    select public.tenant_do_pedido_anonimo(
      nullif(current_setting('request.headers', true)::json ->> 'x-tenant', '')::uuid,
      p_mesa_numero
    ) into v_tenant;

    if v_tenant is null then
      return false;
    end if;
  end if;

  perform set_config('app.estabelecimento_id', v_tenant::text, true);
  return true;
end;
$$;

-- 1.b Contexto por comanda
drop function if exists public.preparar_contexto_tenant_comanda(text);

create function public.preparar_contexto_tenant_comanda(p_comanda_id text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant uuid;
  v_atual uuid := public.estabelecimento_atual();
begin
  if p_comanda_id is null or trim(p_comanda_id) = '' then
    perform set_config('app.estabelecimento_id', coalesce(v_atual::text, ''), true);
    return true;
  end if;

  if v_atual is not null then
    -- A comanda DEVE pertencer ao estabelecimento do usuário logado.
    select tenant_id into v_tenant
    from public.comandas
    where id = p_comanda_id
      and tenant_id = v_atual
    limit 1;

    if v_tenant is null then
      return false;
    end if;
  else
    -- Anônimo: lê a comanda para descobrir o tenant e valida contra o
    -- par (tenant, mesa) do QR — a comanda precisa ser do tenant da mesa.
    select tenant_id into v_tenant
    from public.comandas
    where id = p_comanda_id
      and tenant_id = public.tenant_do_pedido_anonimo(
        nullif(current_setting('request.headers', true)::json ->> 'x-tenant', '')::uuid,
        (select c2.mesa_numero from public.comandas c2 where c2.id = p_comanda_id)
      )
    limit 1;

    if v_tenant is null then
      return false;
    end if;
  end if;

  perform set_config('app.estabelecimento_id', v_tenant::text, true);
  return true;
end;
$$;

-- ----------------------------------------------------------------------------
-- 2. RPCs operacionais recriadas com filtro de tenant em toda consulta de
--    comandas/comanda_itens por id 'cmd-XX' (mesma assinatura exata).
-- ----------------------------------------------------------------------------

-- 2.a Fechar mesa sem consumo
drop function if exists public.fechar_mesa_sem_consumo(integer);

create function public.fechar_mesa_sem_consumo(p_mesa_numero integer)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
DECLARE
  v_user_profile TEXT;
  v_comanda_id TEXT;
  v_cmd RECORD;
  v_qtd_itens INTEGER := 0;
  v_now TIMESTAMPTZ := NOW();
  v_total_residual NUMERIC(10,2) := 0.00;
  v_tenant uuid;
BEGIN
  v_user_profile := public.get_current_user_profile();
  IF v_user_profile IS NULL OR v_user_profile NOT IN ('garcom', 'caixa', 'gerente') THEN
    RAISE EXCEPTION 'Acesso negado: apenas Garçom, Caixa e Gerente podem fechar mesas sem consumo.'
      USING ERRCODE = '42501';
  END IF;

  IF p_mesa_numero IS NULL OR p_mesa_numero <= 0 THEN
    RETURN jsonb_build_object('sucesso', false, 'codigo', 'MESA_INVALIDA', 'mensagem', 'Número de mesa inválido.');
  END IF;

  -- Isolamento multi-tenant
  IF NOT public.preparar_contexto_tenant_mesa(p_mesa_numero) THEN
    RETURN jsonb_build_object(
      'sucesso', false,
      'codigo', 'ESTABELECIMENTO_DIFERENTE',
      'mensagem', 'Esta mesa pertence a outro estabelecimento.'
    );
  END IF;

  v_tenant := nullif(current_setting('app.estabelecimento_id', true), '')::uuid;
  v_comanda_id := 'cmd-' || LPAD(p_mesa_numero::text, 2, '0');

  SELECT * INTO v_cmd FROM public.comandas
  WHERE id = v_comanda_id AND tenant_id = v_tenant;
  IF NOT FOUND THEN
    UPDATE public.mesas
    SET status = 'Livre', updated_at = v_now
    WHERE numero = p_mesa_numero AND tenant_id = v_tenant;

    RETURN jsonb_build_object(
      'sucesso', true,
      'codigo', 'MESA_LIBERADA',
      'mesa_numero', p_mesa_numero,
      'mensagem', 'Mesa ' || p_mesa_numero::text || ' liberada com sucesso.'
    );
  END IF;

  SELECT COUNT(*) INTO v_qtd_itens
  FROM public.comanda_itens
  WHERE comanda_id = v_comanda_id AND tenant_id = v_tenant;

  v_total_residual := COALESCE(v_cmd.total, 0.00);

  IF v_qtd_itens > 0 THEN
    RETURN jsonb_build_object(
      'sucesso', false,
      'codigo', 'MESA_COM_CONSUMO',
      'itens_count', v_qtd_itens,
      'total', v_total_residual,
      'mensagem', 'A Mesa ' || p_mesa_numero::text || ' possui ' || v_qtd_itens::text || ' item(ns) lançado(s). Para mesas com consumo, utilize o fluxo de Enviar para Pagamento / Caixa.'
    );
  END IF;

  IF v_total_residual > 0.00 THEN
    RETURN jsonb_build_object(
      'sucesso', false,
      'codigo', 'TOTAL_RESIDUAL_SEM_ITENS',
      'itens_count', 0,
      'total', v_total_residual,
      'mensagem', 'A Mesa ' || p_mesa_numero::text || ' possui um total registrado de R$ ' || to_char(v_total_residual, 'FM999990.00') || ' sem itens lançados. Verifique a comanda ou envie para pagamento no Caixa.'
    );
  END IF;

  DELETE FROM public.comanda_itens
  WHERE comanda_id = v_comanda_id AND tenant_id = v_tenant;

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
  WHERE id = v_comanda_id AND tenant_id = v_tenant;

  UPDATE public.mesas
  SET status = 'Livre', updated_at = v_now
  WHERE numero = p_mesa_numero AND tenant_id = v_tenant;

  RETURN jsonb_build_object(
    'sucesso', true,
    'codigo', 'MESA_FECHADA_SEM_CONSUMO',
    'mesa_numero', p_mesa_numero,
    'comanda_id', v_comanda_id,
    'mensagem', 'Mesa ' || p_mesa_numero::text || ' fechada e liberada com sucesso!'
  );
END;
$$;

-- 2.b Transferência de mesa
drop function if exists public.transferir_mesa_atendimento(integer, integer);

create function public.transferir_mesa_atendimento(p_mesa_origem integer, p_mesa_destino integer)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
DECLARE
  v_user_profile TEXT;
  v_user_label TEXT;
  v_cmd_origem_id TEXT;
  v_cmd_destino_id TEXT;
  v_cmd RECORD;
  v_mesa_dest RECORD;
  v_now TIMESTAMPTZ := NOW();
  v_itens_transferidos INTEGER := 0;
  v_tenant uuid;
BEGIN
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

  IF p_mesa_origem IS NULL OR p_mesa_origem <= 0 THEN
    RETURN jsonb_build_object('sucesso', false, 'codigo', 'MESA_ORIGEM_INVALIDA', 'mensagem', 'Mesa de origem inválida.');
  END IF;

  IF p_mesa_destino IS NULL OR p_mesa_destino <= 0 THEN
    RETURN jsonb_build_object('sucesso', false, 'codigo', 'MESA_DESTINO_INVALIDA', 'mensagem', 'Mesa de destino inválida.');
  END IF;

  IF p_mesa_origem = p_mesa_destino THEN
    RETURN jsonb_build_object('sucesso', false, 'codigo', 'MESAS_IGUAIS', 'mensagem', 'A mesa de destino deve ser diferente da mesa de origem.');
  END IF;

  -- Isolamento multi-tenant
  IF NOT public.preparar_contexto_tenant_mesa(p_mesa_origem) THEN
    RETURN jsonb_build_object(
      'sucesso', false,
      'codigo', 'ESTABELECIMENTO_DIFERENTE',
      'mensagem', 'Esta mesa pertence a outro estabelecimento.'
    );
  END IF;

  v_tenant := nullif(current_setting('app.estabelecimento_id', true), '')::uuid;
  v_cmd_origem_id := 'cmd-' || LPAD(p_mesa_origem::text, 2, '0');
  v_cmd_destino_id := 'cmd-' || LPAD(p_mesa_destino::text, 2, '0');

  SELECT * INTO v_cmd FROM public.comandas
  WHERE id = v_cmd_origem_id AND tenant_id = v_tenant;
  IF NOT FOUND OR v_cmd.status = 'Livre' THEN
    RETURN jsonb_build_object(
      'sucesso', false,
      'codigo', 'ORIGEM_SEM_ATENDIMENTO',
      'mensagem', 'A Mesa ' || p_mesa_origem::text || ' não possui atendimento aberto ou consumo para transferir.'
    );
  END IF;

  SELECT * INTO v_mesa_dest FROM public.mesas
  WHERE numero = p_mesa_destino AND tenant_id = v_tenant;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('sucesso', false, 'codigo', 'DESTINO_INEXISTENTE', 'mensagem', 'A Mesa ' || p_mesa_destino::text || ' não está cadastrada no sistema.');
  END IF;

  IF v_mesa_dest.status <> 'Livre' THEN
    RETURN jsonb_build_object(
      'sucesso', false,
      'codigo', 'DESTINO_OCUPADO',
      'mensagem', 'A Mesa ' || p_mesa_destino::text || ' não está Livre (status atual: ' || v_mesa_dest.status || '). Escolha uma mesa livre.'
    );
  END IF;

  DELETE FROM public.comanda_itens
  WHERE comanda_id = v_cmd_destino_id AND tenant_id = v_tenant;

  INSERT INTO public.comandas (
    id, mesa_numero, cliente_nome, pessoas, status, aberta_em, fechada_em,
    inclui_taxa_servico, garcom, total, conta_solicitada, conta_solicitada_em,
    forma_pagamento_solicitada, status_conta, motivo_recusa_conta,
    nfce_solicitada, nfce_documento_id, created_at, updated_at, tenant_id
  ) VALUES (
    v_cmd_destino_id, p_mesa_destino, v_cmd.cliente_nome, v_cmd.pessoas, v_cmd.status,
    COALESCE(v_cmd.aberta_em, v_now), v_cmd.fechada_em, v_cmd.inclui_taxa_servico,
    COALESCE(v_cmd.garcom, v_user_label), v_cmd.total, v_cmd.conta_solicitada,
    v_cmd.conta_solicitada_em, v_cmd.forma_pagamento_solicitada, v_cmd.status_conta,
    v_cmd.motivo_recusa_conta, COALESCE(v_cmd.nfce_solicitada, false), v_cmd.nfce_documento_id,
    COALESCE(v_cmd.created_at, v_now), v_now, v_tenant
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

  UPDATE public.comanda_itens
  SET comanda_id = v_cmd_destino_id, updated_at = v_now
  WHERE comanda_id = v_cmd_origem_id AND tenant_id = v_tenant;

  GET DIAGNOSTICS v_itens_transferidos = ROW_COUNT;

  UPDATE public.mesas
  SET status = v_cmd.status, updated_at = v_now
  WHERE numero = p_mesa_destino AND tenant_id = v_tenant;

  UPDATE public.mesas
  SET status = 'Livre', updated_at = v_now
  WHERE numero = p_mesa_origem AND tenant_id = v_tenant;

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
  WHERE id = v_cmd_origem_id AND tenant_id = v_tenant;

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

-- 2.c Iniciar atendimento on-line (cliente /pedido)
drop function if exists public.iniciar_atendimento_online(integer, text);

create function public.iniciar_atendimento_online(p_mesa_numero integer, p_cliente_nome text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
DECLARE
  v_mesa_num INTEGER := p_mesa_numero;
  v_comanda_id TEXT;
  v_nome TEXT;
  v_now TIMESTAMPTZ := NOW();
  v_tenant uuid;
BEGIN
  IF v_mesa_num IS NULL OR v_mesa_num < 1 THEN
    RETURN jsonb_build_object('sucesso', false, 'codigo', 'MESA_INVALIDA', 'mensagem', 'Número de mesa inválido.');
  END IF;

  v_nome := trim(COALESCE(p_cliente_nome, ''));
  IF v_nome = '' THEN
    RETURN jsonb_build_object('sucesso', false, 'codigo', 'NOME_OBRIGATORIO', 'mensagem', 'Por favor, informe seu nome para iniciar o atendimento.');
  END IF;

  v_nome := substring(v_nome from 1 for 60);

  -- Isolamento multi-tenant
  IF NOT public.preparar_contexto_tenant_mesa(v_mesa_num) THEN
    RETURN jsonb_build_object(
      'sucesso', false,
      'codigo', 'ESTABELECIMENTO_DIFERENTE',
      'mensagem', 'Esta mesa pertence a outro estabelecimento.'
    );
  END IF;

  v_tenant := nullif(current_setting('app.estabelecimento_id', true), '')::uuid;

  IF NOT EXISTS (
    SELECT 1 FROM public.mesas
    WHERE numero = v_mesa_num AND tenant_id = v_tenant
  ) THEN
    INSERT INTO public.mesas (numero, status, capacidade, tenant_id)
    VALUES (v_mesa_num, 'Ocupada', 4, v_tenant);
  ELSE
    UPDATE public.mesas
    SET status = 'Ocupada', updated_at = v_now
    WHERE numero = v_mesa_num AND tenant_id = v_tenant;
  END IF;

  v_comanda_id := 'cmd-' || LPAD(v_mesa_num::text, 2, '0');

  IF NOT EXISTS (
    SELECT 1 FROM public.comandas
    WHERE id = v_comanda_id AND tenant_id = v_tenant
  ) THEN
    INSERT INTO public.comandas (
      id, mesa_numero, cliente_nome, pessoas, status, aberta_em, total,
      status_conta, conta_solicitada, conta_solicitada_em,
      forma_pagamento_solicitada, motivo_recusa_conta, tenant_id
    ) VALUES (
      v_comanda_id, v_mesa_num, v_nome, 1, 'Ocupada', v_now, 0.00,
      'nenhum', false, NULL, NULL, NULL, v_tenant
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
    WHERE id = v_comanda_id AND tenant_id = v_tenant;
  END IF;

  RETURN jsonb_build_object(
    'sucesso', true,
    'comanda_id', v_comanda_id,
    'mesa_numero', v_mesa_num,
    'cliente_nome', v_nome,
    'mensagem', 'Atendimento iniciado com sucesso!'
  );
END;
$$;

-- 2.d Enviar pedido on-line (cliente /pedido)
drop function if exists public.enviar_pedido_online(integer, text, jsonb);

create function public.enviar_pedido_online(p_mesa_numero integer, p_cliente_nome text, p_itens jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
DECLARE
  v_mesa_num INTEGER := p_mesa_numero;
  v_comanda_id TEXT;
  v_item JSONB;
  v_prod RECORD;
  v_comanda_item_id TEXT;
  v_itens_inseridos INTEGER := 0;
  v_total_pedido NUMERIC(10,2) := 0.00;
  v_area TEXT := 'bar';
  v_tenant uuid;
BEGIN
  IF v_mesa_num IS NULL OR v_mesa_num < 1 THEN
    v_mesa_num := 10;
  END IF;

  IF p_itens IS NULL OR jsonb_array_length(p_itens) = 0 THEN
    RETURN jsonb_build_object('sucesso', false, 'codigo', 'ITENS_VAZIOS', 'mensagem', 'Nenhum item válido informado no pedido.');
  END IF;

  -- Isolamento multi-tenant
  IF NOT public.preparar_contexto_tenant_mesa(v_mesa_num) THEN
    RETURN jsonb_build_object(
      'sucesso', false,
      'codigo', 'ESTABELECIMENTO_DIFERENTE',
      'mensagem', 'Esta mesa pertence a outro estabelecimento.'
    );
  END IF;

  v_tenant := nullif(current_setting('app.estabelecimento_id', true), '')::uuid;

  IF NOT EXISTS (
    SELECT 1 FROM public.mesas
    WHERE numero = v_mesa_num AND tenant_id = v_tenant
  ) THEN
    INSERT INTO public.mesas (numero, status, capacidade, tenant_id)
    VALUES (v_mesa_num, 'Livre', 4, v_tenant)
    ON CONFLICT DO NOTHING;
  END IF;

  v_comanda_id := 'cmd-' || LPAD(v_mesa_num::text, 2, '0');

  -- REGRA OBRIGATÓRIA: Não sobrescrever o cliente_nome se já existir na comanda!
  IF NOT EXISTS (
    SELECT 1 FROM public.comandas
    WHERE id = v_comanda_id AND tenant_id = v_tenant
  ) THEN
    INSERT INTO public.comandas (
      id, mesa_numero, cliente_nome, pessoas, status, aberta_em, total,
      status_conta, conta_solicitada, conta_solicitada_em,
      forma_pagamento_solicitada, motivo_recusa_conta, tenant_id
    )
    VALUES (
      v_comanda_id, v_mesa_num,
      COALESCE(NULLIF(trim(p_cliente_nome), ''), 'Cliente On-line'),
      1, 'Ocupada', NOW(), 0.00, 'nenhum', false, NULL, NULL, NULL, v_tenant
    );
  ELSE
    UPDATE public.comandas
    SET status = 'Ocupada',
        cliente_nome = COALESCE(NULLIF(trim(comandas.cliente_nome), ''), NULLIF(trim(p_cliente_nome), ''), 'Cliente On-line'),
        aberta_em = COALESCE(aberta_em, NOW()),
        status_conta = 'nenhum',
        conta_solicitada = false,
        conta_solicitada_em = NULL,
        forma_pagamento_solicitada = NULL,
        motivo_recusa_conta = NULL,
        updated_at = NOW()
    WHERE id = v_comanda_id AND tenant_id = v_tenant;
  END IF;

  UPDATE public.mesas
  SET status = 'Ocupada', updated_at = NOW()
  WHERE numero = v_mesa_num AND tenant_id = v_tenant;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_itens)
  LOOP
    SELECT * INTO v_prod
    FROM public.produtos
    WHERE id = (v_item->>'produto_id') AND ativo = true
      AND tenant_id = v_tenant;

    IF FOUND THEN
      v_comanda_item_id := 'ci-onl-' || floor(extract(epoch from clock_timestamp()) * 1000)::text || '-' || floor(random() * 9000 + 1000)::text;

      INSERT INTO public.comanda_itens (
        id, comanda_id, produto_id, nome_produto, preco_unitario, quantidade, observacoes, origem_online, tenant_id
      ) VALUES (
        v_comanda_item_id, v_comanda_id, v_prod.id, v_prod.nome, v_prod.preco,
        GREATEST(1, COALESCE((v_item->>'quantidade')::integer, 1)),
        NULLIF(trim(v_item->>'observacoes'), ''),
        true,
        v_tenant
      );

      v_area := COALESCE(v_prod.area_preparo, 'bar');

      INSERT INTO public.fila_cozinha (
        comanda_item_id, area_preparo, status, observacoes, origem_online, tenant_id
      ) VALUES (
        v_comanda_item_id, v_area, 'pendente',
        COALESCE(NULLIF(trim(v_item->>'observacoes'), ''), 'Pedido On-line'),
        true,
        v_tenant
      );

      UPDATE public.produtos
      SET estoque = GREATEST(0.00, estoque - GREATEST(1, COALESCE((v_item->>'quantidade')::integer, 1))),
          updated_at = NOW()
      WHERE id = v_prod.id AND tenant_id = v_tenant;

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
$$;

-- 2.e Solicitar conta — assinatura simples (sem NFC-e)
-- 42P13: CREATE OR REPLACE não remove parâmetro padrão de overload existente;
-- derruba AMBAS as assinaturas antes de recriar.
drop function if exists public.solicitar_conta_mesa(integer, text);
drop function if exists public.solicitar_conta_mesa(integer, text, boolean);

create function public.solicitar_conta_mesa(p_mesa_numero integer, p_forma_pagamento text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
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
  v_tenant uuid;
BEGIN
  v_forma_normalizada := trim(p_forma_pagamento);
  IF v_forma_normalizada NOT IN ('Pix', 'Cartão Crédito', 'Cartão Débito', 'Dinheiro') THEN
    RETURN jsonb_build_object('sucesso', false, 'codigo', 'FORMA_INVALIDA', 'mensagem', 'Forma de pagamento inválida. Escolha entre Pix, Cartão Crédito, Cartão Débito ou Dinheiro.');
  END IF;

  -- Isolamento multi-tenant
  IF NOT public.preparar_contexto_tenant_mesa(p_mesa_numero) THEN
    RETURN jsonb_build_object('sucesso', false, 'codigo', 'ESTABELECIMENTO_DIFERENTE', 'mensagem', 'Esta mesa pertence a outro estabelecimento.');
  END IF;

  v_tenant := nullif(current_setting('app.estabelecimento_id', true), '')::uuid;
  v_comanda_id := 'cmd-' || LPAD(p_mesa_numero::text, 2, '0');

  SELECT status, inclui_taxa_servico, status_conta
  INTO v_status_atual, v_inclui_taxa, v_status_conta_atual
  FROM public.comandas
  WHERE id = v_comanda_id AND tenant_id = v_tenant;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('sucesso', false, 'codigo', 'COMANDA_NAO_ENCONTRADA', 'mensagem', 'Comanda não encontrada para esta mesa.');
  END IF;

  IF v_status_atual = 'Livre' THEN
    RETURN jsonb_build_object('sucesso', false, 'codigo', 'MESA_LIVRE', 'mensagem', 'A mesa está livre. Não há consumo a ser pago.');
  END IF;

  IF v_status_conta_atual IN ('solicitada', 'autorizada', 'em_processamento_pix') THEN
    RETURN jsonb_build_object(
      'sucesso', true,
      'codigo', 'JA_SOLICITADA',
      'mensagem', 'A conta desta mesa já foi solicitada e está em processamento no caixa.',
      'status_conta', v_status_conta_atual,
      'comanda_id', v_comanda_id
    );
  END IF;

  SELECT COALESCE(taxa_servico_padrao, 10.00)
  INTO v_taxa
  FROM public.configuracoes_bar
  WHERE tenant_id = v_tenant OR (v_tenant IS NULL AND id = 'principal');

  SELECT COALESCE(SUM(preco_unitario * quantidade), 0.00), COUNT(*)
  INTO v_subtotal, v_itens_count
  FROM public.comanda_itens
  WHERE comanda_id = v_comanda_id AND tenant_id = v_tenant;

  IF v_itens_count = 0 THEN
    RETURN jsonb_build_object('sucesso', false, 'codigo', 'COMANDA_VAZIA', 'mensagem', 'Não há itens lançados nesta comanda para pedir a conta.');
  END IF;

  IF v_inclui_taxa THEN
    v_taxa_valor := ROUND((v_subtotal * (v_taxa / 100.0)), 2);
  ELSE
    v_taxa_valor := 0.00;
  END IF;
  v_total := v_subtotal + v_taxa_valor;

  UPDATE public.comandas
  SET status = 'Aguardando Pagamento',
      conta_solicitada = true,
      conta_solicitada_em = NOW(),
      forma_pagamento_solicitada = v_forma_normalizada,
      status_conta = 'solicitada',
      motivo_recusa_conta = NULL,
      total = v_total,
      updated_at = NOW()
  WHERE id = v_comanda_id AND tenant_id = v_tenant;

  UPDATE public.mesas
  SET status = 'Aguardando Pagamento', updated_at = NOW()
  WHERE numero = p_mesa_numero AND tenant_id = v_tenant;

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
$$;

-- 2.f Solicitar conta — assinatura com NFC-e
create function public.solicitar_conta_mesa(p_mesa_numero integer, p_forma_pagamento text, p_deseja_nfce boolean default false)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
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
  v_tenant uuid;
BEGIN
  v_forma_normalizada := trim(p_forma_pagamento);
  IF v_forma_normalizada NOT IN ('Pix', 'Cartão Crédito', 'Cartão Débito', 'Dinheiro') THEN
    RETURN jsonb_build_object('sucesso', false, 'codigo', 'FORMA_INVALIDA', 'mensagem', 'Forma de pagamento inválida. Escolha entre Pix, Cartão Crédito, Cartão Débito ou Dinheiro.');
  END IF;

  -- Isolamento multi-tenant
  IF NOT public.preparar_contexto_tenant_mesa(p_mesa_numero) THEN
    RETURN jsonb_build_object('sucesso', false, 'codigo', 'ESTABELECIMENTO_DIFERENTE', 'mensagem', 'Esta mesa pertence a outro estabelecimento.');
  END IF;

  v_tenant := nullif(current_setting('app.estabelecimento_id', true), '')::uuid;
  v_comanda_id := 'cmd-' || LPAD(p_mesa_numero::text, 2, '0');

  SELECT status, inclui_taxa_servico, status_conta
  INTO v_status_atual, v_inclui_taxa, v_status_conta_atual
  FROM public.comandas
  WHERE id = v_comanda_id AND tenant_id = v_tenant;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('sucesso', false, 'codigo', 'COMANDA_NAO_ENCONTRADA', 'mensagem', 'Comanda não encontrada para esta mesa.');
  END IF;

  IF v_status_atual = 'Livre' THEN
    RETURN jsonb_build_object('sucesso', false, 'codigo', 'MESA_LIVRE', 'mensagem', 'A mesa está livre. Não há consumo a ser pago.');
  END IF;

  IF v_status_conta_atual IN ('solicitada', 'autorizada', 'em_processamento_pix') THEN
    RETURN jsonb_build_object(
      'sucesso', true,
      'codigo', 'JA_SOLICITADA',
      'mensagem', 'A conta desta mesa já foi solicitada e está em processamento no caixa.',
      'status_conta', v_status_conta_atual,
      'comanda_id', v_comanda_id
    );
  END IF;

  SELECT COALESCE(taxa_servico_padrao, 10.00)
  INTO v_taxa
  FROM public.configuracoes_bar
  WHERE tenant_id = v_tenant OR (v_tenant IS NULL AND id = 'principal');

  SELECT COALESCE(SUM(preco_unitario * quantidade), 0.00), COUNT(*)
  INTO v_subtotal, v_itens_count
  FROM public.comanda_itens
  WHERE comanda_id = v_comanda_id AND tenant_id = v_tenant;

  IF v_itens_count = 0 THEN
    RETURN jsonb_build_object('sucesso', false, 'codigo', 'COMANDA_VAZIA', 'mensagem', 'Não há itens lançados nesta comanda para pedir a conta.');
  END IF;

  IF v_inclui_taxa THEN
    v_taxa_valor := ROUND((v_subtotal * (v_taxa / 100.0)), 2);
  ELSE
    v_taxa_valor := 0.00;
  END IF;
  v_total := v_subtotal + v_taxa_valor;

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
  WHERE id = v_comanda_id AND tenant_id = v_tenant;

  UPDATE public.mesas
  SET status = 'Aguardando Pagamento', updated_at = NOW()
  WHERE numero = p_mesa_numero AND tenant_id = v_tenant;

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

grant execute on function public.solicitar_conta_mesa(integer, text) to anon, authenticated;
grant execute on function public.solicitar_conta_mesa(integer, text, boolean) to anon, authenticated;

-- 2.g Caixa: autorizar/fechar conta
drop function if exists public.caixa_autorizar_fechar_conta(integer, text, numeric, boolean);

create function public.caixa_autorizar_fechar_conta(p_mesa_numero integer, p_forma_pagamento text, p_valor_pago numeric, p_marcar_em_processamento_pix boolean default false)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
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
  v_tenant uuid;
BEGIN
  v_user_profile := public.get_current_user_profile();
  IF v_user_profile IS NULL OR v_user_profile NOT IN ('caixa', 'gerente') THEN
    RAISE EXCEPTION 'Ação não permitida: apenas Caixa ou Gerente podem autorizar e fechar comandas.'
      USING ERRCODE = '42501';
  END IF;

  v_user_label := CASE WHEN v_user_profile = 'gerente' THEN 'Carlos Gerente' ELSE 'Marina Caixa' END;

  -- Isolamento multi-tenant
  IF NOT public.preparar_contexto_tenant_mesa(p_mesa_numero) THEN
    RETURN jsonb_build_object('sucesso', false, 'codigo', 'ESTABELECIMENTO_DIFERENTE', 'mensagem', 'Esta mesa pertence a outro estabelecimento.');
  END IF;

  v_tenant := nullif(current_setting('app.estabelecimento_id', true), '')::uuid;
  v_comanda_id := 'cmd-' || LPAD(p_mesa_numero::text, 2, '0');

  SELECT * INTO v_cmd FROM public.comandas
  WHERE id = v_comanda_id AND tenant_id = v_tenant;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Comanda % não encontrada.', v_comanda_id;
  END IF;

  v_forma := COALESCE(NULLIF(trim(p_forma_pagamento), ''), v_cmd.forma_pagamento_solicitada, 'Pix');
  v_cliente_salvo := COALESCE(v_cmd.cliente_nome, 'Consumidor Final');
  v_nfce_desejada := COALESCE(v_cmd.nfce_solicitada, false);

  IF p_marcar_em_processamento_pix THEN
    UPDATE public.comandas
    SET status_conta = 'em_processamento_pix', updated_at = v_now
    WHERE id = v_comanda_id AND tenant_id = v_tenant;

    RETURN jsonb_build_object(
      'sucesso', true,
      'status_conta', 'em_processamento_pix',
      'mensagem', 'Status atualizado para Pagamento em Processamento (Pix).'
    );
  END IF;

  v_mov_id := 'cm-' || floor(extract(epoch from clock_timestamp()) * 1000)::text;
  INSERT INTO public.movimentos_caixa (
    id, data_hora, descricao, tipo, forma_pagamento, valor, usuario, comanda_id, tenant_id
  ) VALUES (
    v_mov_id, v_now,
    'Pagamento Mesa ' || p_mesa_numero::text || ' (Fechamento Solicitado On-line)',
    'Entrada', v_forma, p_valor_pago, v_user_label, v_comanda_id, v_tenant
  );

  v_seq := floor(100 + random() * 900)::integer;
  v_doc_number := 'NFC-e 000.' || v_seq::text;
  v_fisc_id := 'fisc-' || floor(extract(epoch from clock_timestamp()) * 1000)::text;
  v_access_key := '3525031429384200018465001000000' || floor(1000000000 + random() * 9000000000)::text;

  INSERT INTO public.documentos_fiscais (
    id, numero, serie, tipo, emitido_em, valor, status, nome_cliente, comanda_id, chave_acesso, tenant_id
  ) VALUES (
    v_fisc_id, v_doc_number, '001', 'NFC-e', v_now, p_valor_pago, 'Autorizada',
    v_cliente_salvo, v_comanda_id, v_access_key, v_tenant
  );

  UPDATE public.mesas
  SET status = 'Livre', updated_at = v_now
  WHERE numero = p_mesa_numero AND tenant_id = v_tenant;

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
  WHERE id = v_comanda_id AND tenant_id = v_tenant;

  DELETE FROM public.comanda_itens
  WHERE comanda_id = v_comanda_id AND tenant_id = v_tenant;

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

-- 2.h Caixa: recusar/adiar conta
drop function if exists public.caixa_recusar_adiar_conta(integer, text);

create function public.caixa_recusar_adiar_conta(p_mesa_numero integer, p_motivo text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
DECLARE
  v_comanda_id TEXT;
  v_user_profile TEXT;
  v_now TIMESTAMPTZ := NOW();
  v_motivo_final TEXT;
  v_tenant uuid;
BEGIN
  v_user_profile := public.get_current_user_profile();
  IF v_user_profile IS NULL OR v_user_profile NOT IN ('caixa', 'gerente') THEN
    RAISE EXCEPTION 'Ação não permitida: apenas Caixa ou Gerente podem adiar ou recusar fechamento.'
      USING ERRCODE = '42501';
  END IF;

  -- Isolamento multi-tenant
  IF NOT public.preparar_contexto_tenant_mesa(p_mesa_numero) THEN
    RETURN jsonb_build_object('sucesso', false, 'codigo', 'ESTABELECIMENTO_DIFERENTE', 'mensagem', 'Esta mesa pertence a outro estabelecimento.');
  END IF;

  v_tenant := nullif(current_setting('app.estabelecimento_id', true), '')::uuid;
  v_motivo_final := COALESCE(NULLIF(trim(p_motivo), ''), 'Mesa com atendimento em continuidade / novo pedido em andamento');
  v_comanda_id := 'cmd-' || LPAD(p_mesa_numero::text, 2, '0');

  UPDATE public.mesas
  SET status = 'Ocupada', updated_at = v_now
  WHERE numero = p_mesa_numero AND tenant_id = v_tenant;

  UPDATE public.comandas
  SET status = 'Ocupada',
      conta_solicitada = false,
      status_conta = 'recusada',
      motivo_recusa_conta = v_motivo_final,
      updated_at = v_now
  WHERE id = v_comanda_id AND tenant_id = v_tenant;

  RETURN jsonb_build_object(
    'sucesso', true,
    'mesa_numero', p_mesa_numero,
    'status_mesa', 'Ocupada',
    'status_conta', 'recusada',
    'motivo', v_motivo_final,
    'mensagem', 'Solicitação de conta adiada/recusada. A mesa retornou ao estado Ocupada.'
  );
END;
$$;

-- 2.i Detalhes da conta (cliente on-line e caixa)
drop function if exists public.obter_detalhes_conta_mesa(integer);

create function public.obter_detalhes_conta_mesa(p_mesa_numero integer)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
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
  v_tenant uuid;
  v_atual uuid := public.estabelecimento_atual();
BEGIN
  v_comanda_id := 'cmd-' || LPAD(p_mesa_numero::text, 2, '0');

  SELECT * INTO v_cmd FROM public.comandas WHERE id = v_comanda_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('encontrada', false);
  END IF;

  -- Isolamento multi-tenant: logado → comanda do próprio estabelecimento;
  -- anônimo → comanda do tenant resolvido pelo QR (par tenant + mesa).
  IF v_atual IS NOT NULL THEN
    IF v_cmd.tenant_id IS NULL OR v_cmd.tenant_id <> v_atual THEN
      RETURN jsonb_build_object('encontrada', false);
    END IF;
  ELSE
    IF v_cmd.tenant_id IS DISTINCT FROM public.tenant_do_pedido_anonimo(
      nullif(current_setting('request.headers', true)::json ->> 'x-tenant', '')::uuid,
      v_cmd.mesa_numero
    ) THEN
      RETURN jsonb_build_object('encontrada', false);
    END IF;
  END IF;

  v_tenant := v_cmd.tenant_id;

  SELECT
    COALESCE(taxa_servico_padrao, 10.00) AS taxa_servico_padrao,
    razao_social, nome_fantasia, cnpj, inscricao_estadual, endereco_completo,
    telefone, impressora_fiscal_nome, pix_chave, pix_beneficiario_nome, pix_cidade
  INTO v_cfg
  FROM public.configuracoes_bar
  WHERE tenant_id = v_tenant
  LIMIT 1;

  v_taxa_padrao := COALESCE(v_cfg.taxa_servico_padrao, 10.00);

  SELECT
    COALESCE(SUM(preco_unitario * quantidade), 0.00),
    COALESCE(
      jsonb_agg(
        jsonb_build_object(
          'id', id, 'nome_produto', nome_produto, 'preco_unitario', preco_unitario,
          'quantidade', quantidade, 'observacoes', observacoes, 'origem_online', origem_online
        ) ORDER BY created_at ASC
      ),
      '[]'::jsonb
    )
  INTO v_subtotal, v_itens
  FROM public.comanda_itens
  WHERE comanda_id = v_comanda_id AND tenant_id = v_tenant;

  IF v_cmd.inclui_taxa_servico THEN
    v_taxa_servico := ROUND((v_subtotal * (v_taxa_padrao / 100.0)), 2);
  ELSE
    v_taxa_servico := 0.00;
  END IF;
  v_total := v_subtotal + v_taxa_servico;

  IF v_cmd.status = 'Fechada' OR v_cmd.status_conta = 'fechada' THEN
    IF v_cmd.total > 0 THEN
      v_total := v_cmd.total;
    END IF;
  END IF;

  v_status_conta_sanitizado := COALESCE(v_cmd.status_conta, 'nenhum');
  v_conta_solicitada_sanitizada := COALESCE(v_cmd.conta_solicitada, false);

  IF v_cmd.status = 'Fechada' OR v_status_conta_sanitizado = 'fechada' THEN
    SELECT * INTO v_fisc
    FROM public.documentos_fiscais
    WHERE (id = v_cmd.nfce_documento_id OR comanda_id = v_comanda_id)
      AND tenant_id = v_tenant
      AND status = 'Autorizada'
    ORDER BY emitido_em DESC
    LIMIT 1;

    IF FOUND THEN
      v_nfce_doc := jsonb_build_object(
        'id', v_fisc.id, 'numero', v_fisc.numero, 'serie', v_fisc.serie, 'tipo', v_fisc.tipo,
        'emitido_em', v_fisc.emitido_em, 'valor', v_fisc.valor, 'status', v_fisc.status,
        'nome_cliente', v_fisc.nome_cliente, 'documento_cliente', v_fisc.documento_cliente,
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

-- 2.j NFC-e da comanda
drop function if exists public.obter_nfce_comanda_mesa(integer);

create function public.obter_nfce_comanda_mesa(p_mesa_numero integer)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
DECLARE
  v_comanda_id TEXT;
  v_cmd RECORD;
  v_fisc RECORD;
  v_cfg RECORD;
  v_atual uuid := public.estabelecimento_atual();
BEGIN
  v_comanda_id := 'cmd-' || LPAD(p_mesa_numero::text, 2, '0');

  SELECT * INTO v_cmd FROM public.comandas WHERE id = v_comanda_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('sucesso', false, 'mensagem', 'Comanda não encontrada.');
  END IF;

  -- Isolamento multi-tenant: logado → própria estabelecimento;
  -- anônimo → tenant resolvido pelo QR (par tenant + mesa).
  IF v_atual IS NOT NULL THEN
    IF v_cmd.tenant_id IS NULL OR v_cmd.tenant_id <> v_atual THEN
      RETURN jsonb_build_object('sucesso', false, 'mensagem', 'Comanda não encontrada.');
    END IF;
  ELSE
    IF v_cmd.tenant_id IS DISTINCT FROM public.tenant_do_pedido_anonimo(
      nullif(current_setting('request.headers', true)::json ->> 'x-tenant', '')::uuid,
      v_cmd.mesa_numero
    ) THEN
      RETURN jsonb_build_object('sucesso', false, 'mensagem', 'Comanda não encontrada.');
    END IF;
  END IF;

  SELECT * INTO v_fisc
  FROM public.documentos_fiscais
  WHERE (id = v_cmd.nfce_documento_id OR comanda_id = v_comanda_id)
    AND tenant_id = v_cmd.tenant_id
    AND status = 'Autorizada'
  ORDER BY emitido_em DESC
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('sucesso', false, 'mensagem', 'Nenhum documento fiscal emitido para esta comanda.');
  END IF;

  SELECT * INTO v_cfg
  FROM public.configuracoes_bar
  WHERE tenant_id = v_cmd.tenant_id
  LIMIT 1;

  RETURN jsonb_build_object(
    'sucesso', true,
    'documento', jsonb_build_object(
      'id', v_fisc.id, 'numero', v_fisc.numero, 'serie', v_fisc.serie, 'tipo', v_fisc.tipo,
      'emitido_em', v_fisc.emitido_em, 'valor', v_fisc.valor, 'status', v_fisc.status,
      'nome_cliente', v_fisc.nome_cliente, 'documento_cliente', v_fisc.documento_cliente,
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

-- 2.k Status do pedido (acompanhamento do cliente)
drop function if exists public.obter_status_pedido_mesa(integer, text);

create function public.obter_status_pedido_mesa(p_mesa_numero integer default null, p_comanda_id text default null)
returns table (
  fila_id uuid, comanda_item_id text, comanda_id text, mesa_numero integer,
  produto_id text, nome_produto text, categoria text, image_url text,
  quantidade integer, observacoes text, area_preparo text, status text,
  origem_online boolean, created_at timestamptz, updated_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
DECLARE
  v_tenant uuid := public.estabelecimento_atual();
BEGIN
  IF v_tenant IS NULL THEN
    v_tenant := public.tenant_do_pedido_anonimo(
      nullif(current_setting('request.headers', true)::json ->> 'x-tenant', '')::uuid,
      nullif(current_setting('request.headers', true)::json ->> 'x-mesa', '')::integer
    );
  END IF;

  RETURN QUERY
  SELECT
    f.id AS fila_id,
    f.comanda_item_id,
    c.id AS comanda_id,
    c.mesa_numero,
    ci.produto_id,
    ci.nome_produto,
    p.categoria,
    p.image_url,
    ci.quantidade,
    f.observacoes,
    f.area_preparo,
    f.status,
    f.origem_online,
    f.created_at,
    f.updated_at
  FROM public.fila_cozinha f
  JOIN public.comanda_itens ci ON f.comanda_item_id = ci.id
  JOIN public.comandas c ON ci.comanda_id = c.id AND c.tenant_id = ci.tenant_id
  LEFT JOIN public.produtos p ON ci.produto_id = p.id
  WHERE ci.tenant_id = v_tenant
    AND (
      (p_comanda_id IS NOT NULL AND c.id = p_comanda_id)
      OR (p_mesa_numero IS NOT NULL AND c.mesa_numero = p_mesa_numero AND c.status IN ('Ocupada', 'Aguardando Pagamento'))
    )
  ORDER BY f.created_at DESC;
END;
$$;

-- ----------------------------------------------------------------------------
-- 3. Grants das funções de contexto (execução interna pelas RPCs; manter
--    públicos para não quebrar chamadas existentes das políticas/RPCs).
-- ----------------------------------------------------------------------------
grant execute on function public.preparar_contexto_tenant_mesa(integer) to anon, authenticated;
grant execute on function public.preparar_contexto_tenant_comanda(text) to anon, authenticated;
grant execute on function public.fechar_mesa_sem_consumo(integer) to authenticated, service_role;
grant execute on function public.transferir_mesa_atendimento(integer, integer) to authenticated, service_role;
grant execute on function public.iniciar_atendimento_online(integer, text) to anon, authenticated;
grant execute on function public.enviar_pedido_online(integer, text, jsonb) to anon, authenticated;
grant execute on function public.caixa_autorizar_fechar_conta(integer, text, numeric, boolean) to authenticated, service_role;
grant execute on function public.caixa_recusar_adiar_conta(integer, text) to authenticated, service_role;
grant execute on function public.obter_detalhes_conta_mesa(integer) to anon, authenticated;
grant execute on function public.obter_nfce_comanda_mesa(integer) to anon, authenticated;
grant execute on function public.obter_status_pedido_mesa(integer, text) to anon, authenticated;
