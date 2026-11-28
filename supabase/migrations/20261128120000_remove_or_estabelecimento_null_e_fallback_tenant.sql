-- ============================================================================
-- CORREÇÃO CRÍTICA DE ISOLAMENTO MULTI-TENANT (RLS)
--
-- 1. Remove a cláusula "OR estabelecimento_atual() IS NULL" de TODAS as
--    políticas RLS das tabelas operacionais: ela liberava acesso cruzado
--    quando o usuário/anon não tinha tenant resolvido (ex.: R Burguer sem
--    produtos enxergava o cardápio do Rachide Bar).
-- 2. Cria política EXPLÍCITA e SEPARADA para a leitura anônima do pedido
--    on-line (QR Code ?mesa=X): anon só lê cardápio/mesas/status do
--    estabelecimento DONO da mesa — nunca tudo.
-- 3. Corrige o gatilho atribuir_tenant_insert: sem fallback para o
--    "primeiro estabelecimento criado" (nunca cair no Rachide Bar);
--    inserção sem tenant falha com erro claro.
-- Idempotente: DROP POLICY IF EXISTS + CREATE POLICY e DROP FUNCTION
-- IF EXISTS + CREATE FUNCTION (padrão do projeto, evita 42P13).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Helper para a política anônima: tenant resolve pelo claim do JWT OU
--    pelo parâmetro da mesa (?mesa=X) — e NUNCA libera tudo.
--    Retorna o tenant resolvido; NULL não satisfaz tenant_id = ...,
--    portanto anon sem mesa válida não lê nada.
-- ----------------------------------------------------------------------------
drop function if exists public.tenant_do_pedido_anonimo(integer);
create function public.tenant_do_pedido_anonimo(p_mesa integer)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select m.tenant_id
  from public.mesas m
  where p_mesa is not null
    and m.numero = p_mesa
  limit 1;
$$;

-- ----------------------------------------------------------------------------
-- 2. Produtos: leitura anônima EXPLÍCITA, limitada ao tenant da mesa.
-- ----------------------------------------------------------------------------
drop policy if exists produtos_select_policy on public.produtos;
create policy produtos_select_policy on public.produtos
  for select to authenticated
  using (tenant_id = public.estabelecimento_atual());

drop policy if exists produtos_select_anon_mesa on public.produtos;
create policy produtos_select_anon_mesa on public.produtos
  for select to anon
  using (
    ativo = true
    and tenant_id = public.tenant_do_pedido_anonimo(
      nullif(current_setting('request.headers', true)::json ->> 'x-mesa', '')::integer
    )
  );

drop policy if exists produtos_insert_policy on public.produtos;
create policy produtos_insert_policy on public.produtos
  for insert to authenticated
  with check (tenant_id = public.estabelecimento_atual() and public.is_gerente());

drop policy if exists produtos_update_policy on public.produtos;
create policy produtos_update_policy on public.produtos
  for update to authenticated
  using (tenant_id = public.estabelecimento_atual() and public.is_gerente())
  with check (tenant_id = public.estabelecimento_atual() and public.is_gerente());

-- ----------------------------------------------------------------------------
-- 3. Comandas e itens: leitura anônima limitada a uma mesa específica
--    (pedido on-line), sem vazamento entre tenants.
-- ----------------------------------------------------------------------------
drop policy if exists comandas_select_policy on public.comandas;
create policy comandas_select_policy on public.comandas
  for select to authenticated
  using (tenant_id = public.estabelecimento_atual());

drop policy if exists comandas_select_anon_mesa on public.comandas;
create policy comandas_select_anon_mesa on public.comandas
  for select to anon
  using (
    tenant_id = public.tenant_do_pedido_anonimo(
      nullif(current_setting('request.headers', true)::json ->> 'x-mesa', '')::integer
    )
  );

drop policy if exists comandas_insert_policy on public.comandas;
create policy comandas_insert_policy on public.comandas
  for insert to authenticated
  with check (tenant_id = public.estabelecimento_atual() and public.is_garcom());

drop policy if exists comandas_update_policy on public.comandas;
create policy comandas_update_policy on public.comandas
  for update to authenticated
  using (tenant_id = public.estabelecimento_atual() and public.is_garcom())
  with check (tenant_id = public.estabelecimento_atual());

drop policy if exists comandas_delete_policy on public.comandas;
create policy comandas_delete_policy on public.comandas
  for delete to authenticated
  using (tenant_id = public.estabelecimento_atual() and public.is_gerente());

drop policy if exists comanda_itens_select_policy on public.comanda_itens;
create policy comanda_itens_select_policy on public.comanda_itens
  for select to authenticated
  using (tenant_id = public.estabelecimento_atual());

drop policy if exists comanda_itens_select_anon_mesa on public.comanda_itens;
create policy comanda_itens_select_anon_mesa on public.comanda_itens
  for select to anon
  using (
    tenant_id = public.tenant_do_pedido_anonimo(
      nullif(current_setting('request.headers', true)::json ->> 'x-mesa', '')::integer
    )
  );

drop policy if exists comanda_itens_insert_policy on public.comanda_itens;
create policy comanda_itens_insert_policy on public.comanda_itens
  for insert to authenticated
  with check (tenant_id = public.estabelecimento_atual() and public.is_garcom() and quantidade > 0);

drop policy if exists comanda_itens_update_policy on public.comanda_itens;
create policy comanda_itens_update_policy on public.comanda_itens
  for update to authenticated
  using (tenant_id = public.estabelecimento_atual() and public.is_garcom())
  with check (tenant_id = public.estabelecimento_atual() and quantidade >= 0);

drop policy if exists comanda_itens_delete_policy on public.comanda_itens;
create policy comanda_itens_delete_policy on public.comanda_itens
  for delete to authenticated
  using (tenant_id = public.estabelecimento_atual() and public.is_garcom());

-- ----------------------------------------------------------------------------
-- 4. Mesas: leitura anônima do pedido on-line — a mesa consultada (a do QR)
--    precisa ser visível ao anon para o app resolver o tenant.
-- ----------------------------------------------------------------------------
drop policy if exists mesas_select_policy on public.mesas;
create policy mesas_select_policy on public.mesas
  for select to authenticated
  using (tenant_id = public.estabelecimento_atual());

drop policy if exists mesas_select_anon_mesa on public.mesas;
create policy mesas_select_anon_mesa on public.mesas
  for select to anon
  using (
    numero = nullif(current_setting('request.headers', true)::json ->> 'x-mesa', '')::integer
  );

drop policy if exists mesas_insert_policy on public.mesas;
create policy mesas_insert_policy on public.mesas
  for insert to authenticated
  with check (tenant_id = public.estabelecimento_atual() and public.is_gerente());

drop policy if exists mesas_update_policy on public.mesas;
create policy mesas_update_policy on public.mesas
  for update to authenticated
  using (tenant_id = public.estabelecimento_atual() and public.is_garcom())
  with check (tenant_id = public.estabelecimento_atual());

drop policy if exists mesas_delete_policy on public.mesas;
create policy mesas_delete_policy on public.mesas
  for delete to authenticated
  using (tenant_id = public.estabelecimento_atual() and public.is_gerente());

-- ----------------------------------------------------------------------------
-- 5. Configurações do bar (marca, Pix, fiscal do tenant): leitura anônima
--    limitada ao tenant da mesa (?mesa=X).
-- ----------------------------------------------------------------------------
drop policy if exists configuracoes_bar_select_all on public.configuracoes_bar;
create policy configuracoes_bar_select_all on public.configuracoes_bar
  for select to authenticated
  using (tenant_id = public.estabelecimento_atual());

drop policy if exists configuracoes_bar_select_anon_mesa on public.configuracoes_bar;
create policy configuracoes_bar_select_anon_mesa on public.configuracoes_bar
  for select to anon
  using (
    tenant_id = public.tenant_do_pedido_anonimo(
      nullif(current_setting('request.headers', true)::json ->> 'x-mesa', '')::integer
    )
  );

drop policy if exists configuracoes_bar_insert_gerente on public.configuracoes_bar;
create policy configuracoes_bar_insert_gerente on public.configuracoes_bar
  for insert to authenticated
  with check (tenant_id = public.estabelecimento_atual() and public.is_gerente());

drop policy if exists configuracoes_bar_update_gerente on public.configuracoes_bar;
create policy configuracoes_bar_update_gerente on public.configuracoes_bar
  for update to authenticated
  using (tenant_id = public.estabelecimento_atual() and public.is_gerente())
  with check (tenant_id = public.estabelecimento_atual() and public.is_gerente());

-- ----------------------------------------------------------------------------
-- 6. Fila da cozinha: leitura anônima limitada aos itens da mesa (?mesa=X).
-- ----------------------------------------------------------------------------
drop policy if exists fila_cozinha_select_policy on public.fila_cozinha;
create policy fila_cozinha_select_policy on public.fila_cozinha
  for select to authenticated
  using (tenant_id = public.estabelecimento_atual());

drop policy if exists fila_cozinha_select_anon_mesa on public.fila_cozinha;
create policy fila_cozinha_select_anon_mesa on public.fila_cozinha
  for select to anon
  using (
    tenant_id = public.tenant_do_pedido_anonimo(
      nullif(current_setting('request.headers', true)::json ->> 'x-mesa', '')::integer
    )
  );

drop policy if exists fila_cozinha_insert_policy on public.fila_cozinha;
create policy fila_cozinha_insert_policy on public.fila_cozinha
  for insert to authenticated
  with check (tenant_id = public.estabelecimento_atual() and public.is_garcom());

drop policy if exists fila_cozinha_update_policy on public.fila_cozinha;
create policy fila_cozinha_update_policy on public.fila_cozinha
  for update to authenticated
  using (tenant_id = public.estabelecimento_atual() and public.is_operador_cozinha())
  with check (tenant_id = public.estabelecimento_atual() and public.is_operador_cozinha());

drop policy if exists fila_cozinha_delete_policy on public.fila_cozinha;
create policy fila_cozinha_delete_policy on public.fila_cozinha
  for delete to authenticated
  using (tenant_id = public.estabelecimento_atual() and (public.is_gerente() or public.is_garcom()));

-- ----------------------------------------------------------------------------
-- 7. Demais tabelas operacionais: sem anon, sem brecha.
-- ----------------------------------------------------------------------------
drop policy if exists caixa_diarios_select_policy on public.caixa_diarios;
create policy caixa_diarios_select_policy on public.caixa_diarios
  for select to authenticated
  using (tenant_id = public.estabelecimento_atual());

drop policy if exists caixa_diarios_insert_policy on public.caixa_diarios;
create policy caixa_diarios_insert_policy on public.caixa_diarios
  for insert to authenticated
  with check (tenant_id = public.estabelecimento_atual());

drop policy if exists caixa_diarios_update_policy on public.caixa_diarios;
create policy caixa_diarios_update_policy on public.caixa_diarios
  for update to authenticated
  using (tenant_id = public.estabelecimento_atual())
  with check (tenant_id = public.estabelecimento_atual());

drop policy if exists documentos_fiscais_select_policy on public.documentos_fiscais;
create policy documentos_fiscais_select_policy on public.documentos_fiscais
  for select to authenticated
  using (tenant_id = public.estabelecimento_atual());

drop policy if exists documentos_fiscais_insert_policy on public.documentos_fiscais;
create policy documentos_fiscais_insert_policy on public.documentos_fiscais
  for insert to authenticated
  with check (tenant_id = public.estabelecimento_atual());

drop policy if exists documentos_fiscais_update_policy on public.documentos_fiscais;
create policy documentos_fiscais_update_policy on public.documentos_fiscais
  for update to authenticated
  using (tenant_id = public.estabelecimento_atual())
  with check (tenant_id = public.estabelecimento_atual());

drop policy if exists movimentacoes_estoque_select_policy on public.movimentacoes_estoque;
create policy movimentacoes_estoque_select_policy on public.movimentacoes_estoque
  for select to authenticated
  using (tenant_id = public.estabelecimento_atual());

drop policy if exists movimentacoes_estoque_insert_policy on public.movimentacoes_estoque;
create policy movimentacoes_estoque_insert_policy on public.movimentacoes_estoque
  for insert to authenticated
  with check (tenant_id = public.estabelecimento_atual());

drop policy if exists movimentos_caixa_select_policy on public.movimentos_caixa;
create policy movimentos_caixa_select_policy on public.movimentos_caixa
  for select to authenticated
  using (tenant_id = public.estabelecimento_atual());

drop policy if exists movimentos_caixa_insert_policy on public.movimentos_caixa;
create policy movimentos_caixa_insert_policy on public.movimentos_caixa
  for insert to authenticated
  with check (tenant_id = public.estabelecimento_atual());

drop policy if exists perfis_usuarios_select on public.perfis_usuarios;
create policy perfis_usuarios_select on public.perfis_usuarios
  for select to authenticated
  using (tenant_id = public.estabelecimento_atual() or id = auth.uid());

drop policy if exists perfis_usuarios_manage on public.perfis_usuarios;
create policy perfis_usuarios_manage on public.perfis_usuarios
  for all to authenticated
  using (tenant_id = public.estabelecimento_atual() and public.is_gerente())
  with check (tenant_id = public.estabelecimento_atual() and public.is_gerente());

-- ----------------------------------------------------------------------------
-- 8. Trigger de atribuição de tenant: sem fallback ao primeiro
--    estabelecimento criado (nunca cair no Rachide Bar). Inserção sem
--    tenant falha com erro claro. DROP FUNCTION IF EXISTS antes (padrão
--    do projeto, evita 42P13).
-- ----------------------------------------------------------------------------
do $$
declare
  t text;
begin
  -- O DROP da função exige derrubar antes os triggers que dependem dela
  -- (PostgreSQL não substitui a definição ligada a objetos dependentes);
  -- recriados logo abaixo com a nova lógica.
  foreach t in array array[
    'mesas','comandas','comanda_itens','fila_cozinha','produtos',
    'movimentacoes_estoque','movimentos_caixa','caixa_diarios',
    'documentos_fiscais','perfis_usuarios','configuracoes_bar'
  ] loop
    execute format('drop trigger if exists trg_%s_tenant on public.%I', t, t);
  end loop;
end $$;

drop function if exists public.atribuir_tenant_insert();
create function public.atribuir_tenant_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_atual uuid := public.estabelecimento_atual();
  v_guc uuid;
begin
  begin
    v_guc := nullif(current_setting('app.estabelecimento_id', true), '')::uuid;
  exception when others then
    v_guc := null;
  end;

  if new.tenant_id is null then
    -- Tenant obrigatório: GUC fixado por RPC verificada, senão o claim do JWT.
    new.tenant_id := coalesce(v_guc, v_atual);
  end if;

  if new.tenant_id is null then
    raise exception 'tenant_id obrigatório: não foi possível determinar o estabelecimento (mesa, comanda ou usuário logado) — inserção bloqueada'
      using errcode = '23502';
  end if;
  
  return new;
end;
$$;

-- Recria os triggers de atribuição de tenant com a função corrigida.
do $$
declare
  t text;
begin
  foreach t in array array[
    'mesas','comandas','comanda_itens','fila_cozinha','produtos',
    'movimentacoes_estoque','movimentos_caixa','caixa_diarios',
    'documentos_fiscais','perfis_usuarios','configuracoes_bar'
  ] loop
    execute format('create trigger trg_%s_tenant before insert on public.%I
       for each row execute function public.atribuir_tenant_insert()', t, t);
  end loop;
end $$;
