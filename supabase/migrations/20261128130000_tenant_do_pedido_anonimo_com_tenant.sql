-- ============================================================================
-- CORREÇÃO FATAL DE ISOLAMENTO MULTI-TENANT NO PEDIDO ANÔNIMO (QR CODE)
--
-- Causa provada: tenant_do_pedido_anonimo(p_mesa int) resolvia a mesa só pelo
-- número ("where m.numero = p_mesa limit 1") — a mesa 1 existe em todos os
-- tenants, então o cardápio/comanda do Rachide Bar aparecia no R Burguer.
--
-- ORDEM OBRIGATÓRIA (evita 2BP01 — "cannot drop function because other
-- objects depend on it"): as políticas RLS dependem da função, então
-- PRIMEIRO derrubamos as políticas, SÓ DEPOIS a função, e então recriamos
-- tudo com a nova assinatura.
--
-- Solução:
-- 1. Nova assinatura tenant_do_pedido_anonimo(p_tenant uuid, p_mesa int):
--    o tenant SÓ é retornado quando existe mesa com tenant_id = p_tenant
--    AND numero = p_mesa (nunca "primeiro que encontrar" cruzando tenants).
-- 2. Políticas RLS anônimas leem o header x-tenant (uuid do QR
--    /pedido?t=<tenant_id>&mesa=X) junto do header x-mesa.
-- Idempotente: DROP ... IF EXISTS antes de cada CREATE.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Derruba PRIMEIRO as políticas anônimas que dependem da função.
-- ----------------------------------------------------------------------------
drop policy if exists produtos_select_anon_mesa on public.produtos;
drop policy if exists comandas_select_anon_mesa on public.comandas;
drop policy if exists comanda_itens_select_anon_mesa on public.comanda_itens;
drop policy if exists configuracoes_bar_select_anon_mesa on public.configuracoes_bar;
drop policy if exists fila_cozinha_select_anon_mesa on public.fila_cozinha;

-- ----------------------------------------------------------------------------
-- 2. Agora sim derruba a função (sem dependentes, sem 2BP01) e recria com
--    o tenant OBRIGATÓRIO no casamento da mesa. Remove também qualquer
--    versão anterior da nova assinatura para não criar overload (42P13).
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

-- Executável pelo cliente anônimo do /pedido
grant execute on function public.tenant_do_pedido_anonimo(uuid, integer) to anon, authenticated;

-- ----------------------------------------------------------------------------
-- 3. Recria as políticas anônimas com a nova assinatura: tenant resolvido
--    pelo header x-tenant (uuid do QR) + mesa pelo header x-mesa.
--    Header ausente/inválido → função retorna NULL → anon não lê nada.
-- ----------------------------------------------------------------------------
create policy produtos_select_anon_mesa on public.produtos
  for select to anon
  using (
    ativo = true
    and tenant_id = public.tenant_do_pedido_anonimo(
      nullif(current_setting('request.headers', true)::json ->> 'x-tenant', '')::uuid,
      nullif(current_setting('request.headers', true)::json ->> 'x-mesa', '')::integer
    )
  );

create policy comandas_select_anon_mesa on public.comandas
  for select to anon
  using (
    tenant_id = public.tenant_do_pedido_anonimo(
      nullif(current_setting('request.headers', true)::json ->> 'x-tenant', '')::uuid,
      nullif(current_setting('request.headers', true)::json ->> 'x-mesa', '')::integer
    )
  );

create policy comanda_itens_select_anon_mesa on public.comanda_itens
  for select to anon
  using (
    tenant_id = public.tenant_do_pedido_anonimo(
      nullif(current_setting('request.headers', true)::json ->> 'x-tenant', '')::uuid,
      nullif(current_setting('request.headers', true)::json ->> 'x-mesa', '')::integer
    )
  );

create policy configuracoes_bar_select_anon_mesa on public.configuracoes_bar
  for select to anon
  using (
    tenant_id = public.tenant_do_pedido_anonimo(
      nullif(current_setting('request.headers', true)::json ->> 'x-tenant', '')::uuid,
      nullif(current_setting('request.headers', true)::json ->> 'x-mesa', '')::integer
    )
  );

create policy fila_cozinha_select_anon_mesa on public.fila_cozinha
  for select to anon
  using (
    tenant_id = public.tenant_do_pedido_anonimo(
      nullif(current_setting('request.headers', true)::json ->> 'x-tenant', '')::uuid,
      nullif(current_setting('request.headers', true)::json ->> 'x-mesa', '')::integer
    )
  );

-- ----------------------------------------------------------------------------
-- 4. Mesas: anon enxerga apenas a mesa do QR, do tenant correto quando o
--    header x-tenant vem (QR novo). Sem x-tenant (placa antiga), mantém o
--    comportamento anterior para não quebrar QRs já impressos.
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
