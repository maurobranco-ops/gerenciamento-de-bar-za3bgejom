-- ============================================================================
-- CORREÇÃO FATAL DE ISOLAMENTO MULTI-TENANT NO PEDIDO ANÔNIMO (QR CODE)
--
-- Causa provada: tenant_do_pedido_anonimo(p_mesa int) resolvia a mesa só pelo
-- número ("where m.numero = p_mesa limit 1") — a mesa 1 existe em todos os
-- tenants, então o cardápio/comanda do Rachide Bar aparecia no R Burguer.
--
-- Solução:
-- 1. Nova assinatura tenant_do_pedido_anonimo(p_tenant uuid, p_mesa int):
--    o tenant SÓ é retornado quando existe mesa com tenant_id = p_tenant
--    AND numero = p_mesa (nunca "primeiro que encontrar").
-- 2. Políticas RLS anônimas passam a ler o header x-tenant (uuid do QR
--    ?t=<tenant_id>&mesa=X) além do x-mesa.
-- 3. Compatibilidade: mesas anônimas continuam visíveis por x-mesa quando o
--    header x-tenant não vem (QR antigo sem t), como antes — os dados
--    sensíveis (produtos, comandas, configurações, fila) NÃO.
-- Idempotente: DROP ... IF EXISTS antes de cada CREATE (padrão do projeto,
-- evita 42P13 de overload entre a assinatura antiga e a nova).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Função com o tenant OBRIGATÓRIO no casamento da mesa.
--    Remove a assinatura antiga (integer) e qualquer versão anterior da nova
--    (uuid, integer) para não criar overload.
-- ----------------------------------------------------------------------------
drop function if exists public.tenant_do_pedido_anonimo(integer);
drop function if exists public.tenant_do_pedido_anonimo(uuid, integer);

create function public.tenant_do_pedido_anonimo(p_tenant uuid, p_mesa integer)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select m.tenant_id
  from public.mesas m
  where p_tenant is not null
    and p_mesa is not null
    and m.tenant_id = p_tenant
    and m.numero = p_mesa
  limit 1;
$$;

-- ----------------------------------------------------------------------------
-- 2. Produtos: leitura anônima EXPLÍCITA — tenant do QR + mesa do QR.
-- ----------------------------------------------------------------------------
drop policy if exists produtos_select_anon_mesa on public.produtos;
create policy produtos_select_anon_mesa on public.produtos
  for select to anon
  using (
    ativo = true
    and tenant_id = public.tenant_do_pedido_anonimo(
      nullif(current_setting('request.headers', true)::json ->> 'x-tenant', '')::uuid,
      nullif(current_setting('request.headers', true)::json ->> 'x-mesa', '')::integer
    )
  );

-- ----------------------------------------------------------------------------
-- 3. Comandas e itens: leitura anônima limitada ao tenant+mesa do QR.
-- ----------------------------------------------------------------------------
drop policy if exists comandas_select_anon_mesa on public.comandas;
create policy comandas_select_anon_mesa on public.comandas
  for select to anon
  using (
    tenant_id = public.tenant_do_pedido_anonimo(
      nullif(current_setting('request.headers', true)::json ->> 'x-tenant', '')::uuid,
      nullif(current_setting('request.headers', true)::json ->> 'x-mesa', '')::integer
    )
  );

drop policy if exists comanda_itens_select_anon_mesa on public.comanda_itens;
create policy comanda_itens_select_anon_mesa on public.comanda_itens
  for select to anon
  using (
    tenant_id = public.tenant_do_pedido_anonimo(
      nullif(current_setting('request.headers', true)::json ->> 'x-tenant', '')::uuid,
      nullif(current_setting('request.headers', true)::json ->> 'x-mesa', '')::integer
    )
  );

-- ----------------------------------------------------------------------------
-- 4. Mesas: anon enxerga a mesa do QR. Com x-tenant presente, restrita ao
--    tenant; sem x-tenant (QR antigo), mantém o comportamento anterior
--    (somente a mesa do header x-mesa) para não quebrar placas existentes.
-- ----------------------------------------------------------------------------
drop policy if exists mesas_select_anon_mesa on public.mesas;
create policy mesas_select_anon_mesa on public.mesas
  for select to anon
  using (
    numero = nullif(current_setting('request.headers', true)::json ->> 'x-mesa', '')::integer
    and (
      nullif(current_setting('request.headers', true)::json ->> 'x-tenant', '')::uuid is null
      or tenant_id = nullif(current_setting('request.headers', true)::json ->> 'x-tenant', '')::uuid
    )
  );

-- ----------------------------------------------------------------------------
-- 5. Configurações do bar (marca, Pix, fiscal do tenant): tenant+mesa do QR.
-- ----------------------------------------------------------------------------
drop policy if exists configuracoes_bar_select_anon_mesa on public.configuracoes_bar;
create policy configuracoes_bar_select_anon_mesa on public.configuracoes_bar
  for select to anon
  using (
    tenant_id = public.tenant_do_pedido_anonimo(
      nullif(current_setting('request.headers', true)::json ->> 'x-tenant', '')::uuid,
      nullif(current_setting('request.headers', true)::json ->> 'x-mesa', '')::integer
    )
  );

-- ----------------------------------------------------------------------------
-- 6. Fila da cozinha: leitura anônima limitada ao tenant+mesa do QR.
-- ----------------------------------------------------------------------------
drop policy if exists fila_cozinha_select_anon_mesa on public.fila_cozinha;
create policy fila_cozinha_select_anon_mesa on public.fila_cozinha
  for select to anon
  using (
    tenant_id = public.tenant_do_pedido_anonimo(
      nullif(current_setting('request.headers', true)::json ->> 'x-tenant', '')::uuid,
      nullif(current_setting('request.headers', true)::json ->> 'x-mesa', '')::integer
    )
  );
