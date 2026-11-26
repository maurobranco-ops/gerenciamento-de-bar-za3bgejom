-- ============================================================================
-- FASE 1 MULTI-TENANT — Plataforma Provedor de NFC-e (SEFAZ-PB)
-- Estabelecimentos (tenants) + isolamento por RLS + salvaguardas nas RPCs.
-- Seed: Rachide Bar (todos os dados existentes pertencem ao Rachide Bar).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Tabela de estabelecimentos (tenants)
-- ----------------------------------------------------------------------------
create table if not exists public.estabelecimentos (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  cnpj text,
  ativo boolean not null default true,
  config jsonb not null default '{}'::jsonb,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

alter table public.estabelecimentos enable row level security;

drop policy if exists estabelecimentos_select_public on public.estabelecimentos;
create policy estabelecimentos_select_public on public.estabelecimentos
  for select to anon, authenticated
  using (ativo = true or public.is_gerente());

drop policy if exists estabelecimentos_insert_gerente on public.estabelecimentos;
create policy estabelecimentos_insert_gerente on public.estabelecimentos
  for insert to authenticated
  with check (public.is_gerente());

drop policy if exists estabelecimentos_update_gerente on public.estabelecimentos;
create policy estabelecimentos_update_gerente on public.estabelecimentos
  for update to authenticated
  using (public.is_gerente())
  with check (public.is_gerente());

drop policy if exists estabelecimentos_delete_gerente on public.estabelecimentos;
create policy estabelecimentos_delete_gerente on public.estabelecimentos
  for delete to authenticated
  using (public.is_gerente());

-- ----------------------------------------------------------------------------
-- 2. Seed do Rachide Bar (primeiro tenant / piloto)
-- ----------------------------------------------------------------------------
insert into public.estabelecimentos (id, nome, cnpj)
values ('11111111-1111-1111-1111-111111111111', 'Rachide Bar', null)
on conflict (id) do nothing;

-- Copia o CNPJ das configurações existentes, se a coluna existir (tolerante a schema)
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'configuracoes_bar' and column_name = 'cnpj'
  ) then
    update public.estabelecimentos
    set cnpj = (select cnpj from public.configuracoes_bar where id = 'principal')
    where id = '11111111-1111-1111-1111-111111111111' and cnpj is null;
  end if;
end $$;

/*
-- 9.6/9.7 CORREÇÃO 42P13: o PostgreSQL não permite CREATE OR REPLACE que remova
-- parâmetros padrão de função existente. Derrubar ANTES as duas assinaturas
-- (2 params e 3 params, a atual em produção com p_deseja_nfce) e recriar em seguida.
drop function if exists public.solicitar_conta_mesa(integer, text);
drop function if exists public.solicitar_conta_mesa(integer, text, boolean);
grant execute on function public.solicitar_conta_mesa(integer, text) to anon, authenticated;
grant execute on function public.solicitar_conta_mesa(integer, text, boolean) to anon, authenticated;

-- 9.6 Solicitar conta (sem NFC-e)
create or replace function public.solicitar_conta_mesa(p_mesa_numero integer, p_forma_pagamento text)

-- ----------------------------------------------------------------------------
-- 3. Helper: estabelecimento do usuário logado (claim do JWT)
=======
-- ----------------------------------------------------------------------------
-- 3. Helper: estabelecimento do usuário logado (claim do JWT)
=======
-- 9.6/9.7 CORREÇÃO 42P13: o PostgreSQL não permite CREATE OR REPLACE que remova
-- parâmetros padrão de função existente. Derrubar ANTES as duas assinaturas
-- (2 params e 3 params, a atual em produção com p_deseja_nfce) e recriar em seguida.
drop function if exists public.solicitar_conta_mesa(integer, text);
drop function if exists public.solicitar_conta_mesa(integer, text, boolean);
grant execute on function public.solicitar_conta_mesa(integer, text) to anon, authenticated;
grant execute on function public.solicitar_conta_mesa(integer, text, boolean) to anon, authenticated;

-- 9.6 Solicitar conta (sem NFC-e)
create or replace function public.solicitar_conta_mesa(p_mesa_numero integer, p_forma_pagamento text)

-- ----------------------------------------------------------------------------
-- 3. Helper: estabelecimento do usuário logado (claim do JWT)
-- ----------------------------------------------------------------------------
*/
create or replace function public.estabelecimento_atual()
returns uuid
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_claims jsonb;
  v_txt text;
  v_id uuid;
begin
  begin
    v_claims := nullif(current_setting('request.jwt.claims', true), '')::jsonb;
  exception when others then
    v_claims := null;
  end;

  if v_claims is null then
    return null;
  end if;

  v_txt := coalesce(
    v_claims #>> '{app_metadata,estabelecimento_id}',
    v_claims #>> '{user_metadata,estabelecimento_id}',
    v_claims ->> 'estabelecimento_id'
  );

  if v_txt is not null and v_txt <> '' then
    begin
      v_id := v_txt::uuid;
    exception when others then
      v_id := null;
    end;
    if v_id is not null then
      return v_id;
    end if;
  end if;

  -- Fase 1: fallback pelo perfil do usuário logado (perfis_usuarios.tenant_id).
  -- Evita depender de auth hook para injetar claim no JWT; o tenant do usuário
  -- é o valor semeado na migração (Rachide Bar = 11111111-...).
  if coalesce(current_setting('request.jwt.claim.role', true), auth.role()) = 'authenticated' then
    begin
      select tenant_id into v_id
      from public.perfis_usuarios
      where id = auth.uid() and ativo = true
      limit 1;
    exception when others then
      v_id := null;
    end;
  end if;

  return v_id;
end;
$$;

-- ----------------------------------------------------------------------------
-- 4. Helper: contexto de tenant por mesa (usado nas RPCs operacionais).
--    Retorna false quando a mesa/comanda pertence a OUTRO estabelecimento.
--    Quando determina o tenant, fixa o GUC app.estabelecimento_id para a
--    transação, de modo que os INSERTs internos das RPCs sejam marcados.
-- ----------------------------------------------------------------------------
create or replace function public.preparar_contexto_tenant_mesa(p_mesa_numero integer)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant uuid;
  v_atual uuid := public.estabelecimento_atual();
begin
  select tenant_id into v_tenant from public.mesas where numero = p_mesa_numero;
  if v_tenant is null then
    select tenant_id into v_tenant
    from public.comandas
    where id = 'cmd-' || lpad(p_mesa_numero::text, 2, '0');
  end if;

  if v_tenant is not null and v_atual is not null and v_tenant <> v_atual then
    return false;
  end if;

  perform set_config('app.estabelecimento_id', coalesce(v_tenant, v_atual)::text, true);
  return true;
end;
$$;

create or replace function public.preparar_contexto_tenant_comanda(p_comanda_id text)
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

  select tenant_id into v_tenant from public.comandas where id = p_comanda_id;

  if v_tenant is not null and v_atual is not null and v_tenant <> v_atual then
    return false;
  end if;

  perform set_config('app.estabelecimento_id', coalesce(v_tenant, v_atual)::text, true);
  return true;
end;
$$;

-- ----------------------------------------------------------------------------
-- 5. Trigger de atribuição de tenant em INSERT (dados que chegam sem tenant)
-- ----------------------------------------------------------------------------
create or replace function public.atribuir_tenant_insert()
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
    -- GUC fixado por RPC verificada tem precedência; senão, o claim do JWT.
    new.tenant_id := coalesce(v_guc, v_atual);
  end if;

  if new.tenant_id is null then
    select id into new.tenant_id
    from public.estabelecimentos
    where ativo = true
    order by criado_em asc
    limit 1;
  end if;

  return new;
end;
$$;

-- ----------------------------------------------------------------------------
-- 6. Coluna tenant_id nas tabelas operacionais + triggers + backfill
-- ----------------------------------------------------------------------------
alter table public.mesas                 add column if not exists tenant_id uuid;
alter table public.comandas              add column if not exists tenant_id uuid;
alter table public.comanda_itens         add column if not exists tenant_id uuid;
alter table public.fila_cozinha          add column if not exists tenant_id uuid;
alter table public.produtos              add column if not exists tenant_id uuid;
alter table public.movimentacoes_estoque add column if not exists tenant_id uuid;
alter table public.movimentos_caixa      add column if not exists tenant_id uuid;
alter table public.caixa_diarios         add column if not exists tenant_id uuid;
alter table public.documentos_fiscais    add column if not exists tenant_id uuid;
alter table public.perfis_usuarios       add column if not exists tenant_id uuid;
alter table public.configuracoes_bar     add column if not exists tenant_id uuid;

update public.mesas                 set tenant_id = '11111111-1111-1111-1111-111111111111' where tenant_id is null;
update public.comandas              set tenant_id = '11111111-1111-1111-1111-111111111111' where tenant_id is null;
update public.comanda_itens         set tenant_id = '11111111-1111-1111-1111-111111111111' where tenant_id is null;
update public.fila_cozinha          set tenant_id = '11111111-1111-1111-1111-111111111111' where tenant_id is null;
update public.produtos              set tenant_id = '11111111-1111-1111-1111-111111111111' where tenant_id is null;
update public.movimentacoes_estoque set tenant_id = '11111111-1111-1111-1111-111111111111' where tenant_id is null;
update public.movimentos_caixa      set tenant_id = '11111111-1111-1111-1111-111111111111' where tenant_id is null;
update public.caixa_diarios         set tenant_id = '11111111-1111-1111-1111-111111111111' where tenant_id is null;
update public.documentos_fiscais    set tenant_id = '11111111-1111-1111-1111-111111111111' where tenant_id is null;
update public.perfis_usuarios       set tenant_id = '11111111-1111-1111-1111-111111111111' where tenant_id is null;
update public.configuracoes_bar     set tenant_id = '11111111-1111-1111-1111-111111111111' where tenant_id is null;

alter table public.mesas                 alter column tenant_id set not null;
alter table public.comandas              alter column tenant_id set not null;
alter table public.comanda_itens         alter column tenant_id set not null;
alter table public.fila_cozinha          alter column tenant_id set not null;
alter table public.produtos              alter column tenant_id set not null;
alter table public.movimentacoes_estoque alter column tenant_id set not null;
alter table public.movimentos_caixa      alter column tenant_id set not null;
alter table public.caixa_diarios         alter column tenant_id set not null;
alter table public.documentos_fiscais    alter column tenant_id set not null;
alter table public.perfis_usuarios       alter column tenant_id set not null;
alter table public.configuracoes_bar     alter column tenant_id set not null;

do $$
declare
  t text;
begin
  foreach t in array array[
    'mesas','comandas','comanda_itens','fila_cozinha','produtos',
    'movimentacoes_estoque','movimentos_caixa','caixa_diarios',
    'documentos_fiscais','perfis_usuarios','configuracoes_bar'
  ] loop
    execute format('drop trigger if exists trg_%s_tenant on public.%I', t, t);
    execute format(
      'create trigger trg_%s_tenant before insert on public.%I
       for each row execute function public.atribuir_tenant_insert()', t, t);
    execute format('alter table public.%I add constraint %s_tenant_fk foreign key (tenant_id) references public.estabelecimentos(id)', t, t);
  end loop;
end;
$$;

-- ----------------------------------------------------------------------------
-- 7. Unicidade por tenant (números de mesa comandas etc. são por estabelecimento)
-- ----------------------------------------------------------------------------
create unique index if not exists uq_mesas_tenant_numero        on public.mesas (tenant_id, numero);
create unique index if not exists uq_comandas_tenant_id         on public.comandas (tenant_id, id);
create unique index if not exists uq_comanda_itens_tenant_id    on public.comanda_itens (tenant_id, id);
create unique index if not exists uq_fila_cozinha_tenant_item   on public.fila_cozinha (tenant_id, comanda_item_id);
create unique index if not exists uq_produtos_tenant_id         on public.produtos (tenant_id, id);
create unique index if not exists uq_mov_estoque_tenant_id      on public.movimentacoes_estoque (tenant_id, id);
create unique index if not exists uq_mov_caixa_tenant_id        on public.movimentos_caixa (tenant_id, id);
create unique index if not exists uq_caixa_diarios_tenant_data  on public.caixa_diarios (tenant_id, data);
create unique index if not exists uq_documentos_tenant_id       on public.documentos_fiscais (tenant_id, id);
create unique index if not exists uq_perfis_tenant_id           on public.perfis_usuarios (tenant_id, id);

-- A FK de comandas passa a ser composta (tenant_id, mesa_numero):
alter table public.comandas drop constraint if exists comandas_mesa_numero_fkey;
alter table public.mesas drop constraint if exists mesas_numero_key;
alter table public.comandas
  add constraint comandas_mesa_tenant_numero_fkey
  foreign key (tenant_id, mesa_numero)
  references public.mesas (tenant_id, numero)
  on update cascade on delete restrict;

-- ----------------------------------------------------------------------------
-- 8. RLS por estabelecimento
--    Regra: `tenant_id = estabelecimento_atual() OR estabelecimento_atual() IS NULL`
--    O segundo termo preserva o fluxo do cliente on-line (anon, sem claim),
--    que passa pelas RPCs SECURITY DEFINER com contexto de tenant verificado.
-- ----------------------------------------------------------------------------

-- mesas
drop policy if exists mesas_select_policy on public.mesas;
create policy mesas_select_policy on public.mesas for select to anon, authenticated
  using (tenant_id = public.estabelecimento_atual() or public.estabelecimento_atual() is null);
drop policy if exists mesas_insert_policy on public.mesas;
create policy mesas_insert_policy on public.mesas for insert to authenticated
  with check ((tenant_id = public.estabelecimento_atual() or public.estabelecimento_atual() is null) and public.is_gerente());
drop policy if exists mesas_update_policy on public.mesas;
create policy mesas_update_policy on public.mesas for update to authenticated
  using ((tenant_id = public.estabelecimento_atual() or public.estabelecimento_atual() is null) and public.is_garcom())
  with check (tenant_id = public.estabelecimento_atual() or public.estabelecimento_atual() is null);
drop policy if exists mesas_delete_policy on public.mesas;
create policy mesas_delete_policy on public.mesas for delete to authenticated
  using ((tenant_id = public.estabelecimento_atual() or public.estabelecimento_atual() is null) and public.is_gerente());

-- comandas
drop policy if exists comandas_select_policy on public.comandas;
create policy comandas_select_policy on public.comandas for select to anon, authenticated
  using (tenant_id = public.estabelecimento_atual() or public.estabelecimento_atual() is null);
drop policy if exists comandas_insert_policy on public.comandas;
create policy comandas_insert_policy on public.comandas for insert to authenticated
  with check ((tenant_id = public.estabelecimento_atual() or public.estabelecimento_atual() is null) and public.is_garcom());
drop policy if exists comandas_update_policy on public.comandas;
create policy comandas_update_policy on public.comandas for update to authenticated
  using ((tenant_id = public.estabelecimento_atual() or public.estabelecimento_atual() is null) and public.is_garcom())
  with check (tenant_id = public.estabelecimento_atual() or public.estabelecimento_atual() is null);
drop policy if exists comandas_delete_policy on public.comandas;
create policy comandas_delete_policy on public.comandas for delete to authenticated
  using ((tenant_id = public.estabelecimento_atual() or public.estabelecimento_atual() is null) and public.is_gerente());

-- comanda_itens
drop policy if exists comanda_itens_select_policy on public.comanda_itens;
create policy comanda_itens_select_policy on public.comanda_itens for select to anon, authenticated
  using (tenant_id = public.estabelecimento_atual() or public.estabelecimento_atual() is null);
drop policy if exists comanda_itens_insert_policy on public.comanda_itens;
create policy comanda_itens_insert_policy on public.comanda_itens for insert to authenticated
  with check ((tenant_id = public.estabelecimento_atual() or public.estabelecimento_atual() is null) and public.is_garcom() and quantidade > 0);
drop policy if exists comanda_itens_update_policy on public.comanda_itens;
create policy comanda_itens_update_policy on public.comanda_itens for update to authenticated
  using ((tenant_id = public.estabelecimento_atual() or public.estabelecimento_atual() is null) and public.is_garcom())
  with check ((tenant_id = public.estabelecimento_atual() or public.estabelecimento_atual() is null) and quantidade >= 0);
drop policy if exists comanda_itens_delete_policy on public.comanda_itens;
create policy comanda_itens_delete_policy on public.comanda_itens for delete to authenticated
  using ((tenant_id = public.estabelecimento_atual() or public.estabelecimento_atual() is null) and public.is_garcom());

-- fila_cozinha
drop policy if exists fila_cozinha_select_policy on public.fila_cozinha;
create policy fila_cozinha_select_policy on public.fila_cozinha for select to anon, authenticated
  using (
    (tenant_id = public.estabelecimento_atual() or public.estabelecimento_atual() is null)
    and (
      auth.role() = 'authenticated'
      or exists (
        select 1
        from public.comanda_itens ci
        join public.comandas c on c.id = ci.comanda_id
        where ci.id = fila_cozinha.comanda_item_id
          and c.status in ('Ocupada', 'Aguardando Pagamento')
      )
    )
  );
drop policy if exists fila_cozinha_insert_policy on public.fila_cozinha;
create policy fila_cozinha_insert_policy on public.fila_cozinha for insert to authenticated
  with check ((tenant_id = public.estabelecimento_atual() or public.estabelecimento_atual() is null) and public.is_garcom());
drop policy if exists fila_cozinha_update_policy on public.fila_cozinha;
create policy fila_cozinha_update_policy on public.fila_cozinha for update to authenticated
  using ((tenant_id = public.estabelecimento_atual() or public.estabelecimento_atual() is null) and public.is_operador_cozinha())
  with check ((tenant_id = public.estabelecimento_atual() or public.estabelecimento_atual() is null) and public.is_operador_cozinha());
drop policy if exists fila_cozinha_delete_policy on public.fila_cozinha;
create policy fila_cozinha_delete_policy on public.fila_cozinha for delete to authenticated
  using ((tenant_id = public.estabelecimento_atual() or public.estabelecimento_atual() is null) and (public.is_gerente() or public.is_garcom()));

-- produtos
drop policy if exists produtos_select_policy on public.produtos;
create policy produtos_select_policy on public.produtos for select to anon, authenticated
  using ((tenant_id = public.estabelecimento_atual() or public.estabelecimento_atual() is null) and (ativo = true or auth.role() = 'authenticated'));
drop policy if exists produtos_insert_policy on public.produtos;
create policy produtos_insert_policy on public.produtos for insert to authenticated
  with check ((tenant_id = public.estabelecimento_atual() or public.estabelecimento_atual() is null) and public.is_gerente());
drop policy if exists produtos_update_policy on public.produtos;
create policy produtos_update_policy on public.produtos for update to authenticated
  using ((tenant_id = public.estabelecimento_atual() or public.estabelecimento_atual() is null) and public.is_gerente())
  with check ((tenant_id = public.estabelecimento_atual() or public.estabelecimento_atual() is null) and public.is_gerente() and preco >= 0);

-- configuracoes_bar
drop policy if exists configuracoes_bar_select_all on public.configuracoes_bar;
create policy configuracoes_bar_select_all on public.configuracoes_bar for select to anon, authenticated
  using (tenant_id = public.estabelecimento_atual() or public.estabelecimento_atual() is null);
drop policy if exists configuracoes_bar_insert_gerente on public.configuracoes_bar;
create policy configuracoes_bar_insert_gerente on public.configuracoes_bar for insert to authenticated
  with check ((tenant_id = public.estabelecimento_atual() or public.estabelecimento_atual() is null) and public.is_gerente());
drop policy if exists configuracoes_bar_update_gerente on public.configuracoes_bar;
create policy configuracoes_bar_update_gerente on public.configuracoes_bar for update to authenticated
  using ((tenant_id = public.estabelecimento_atual() or public.estabelecimento_atual() is null) and public.is_gerente())
  with check ((tenant_id = public.estabelecimento_atual() or public.estabelecimento_atual() is null) and public.is_gerente());

-- caixa_diarios
drop policy if exists caixa_diarios_select_policy on public.caixa_diarios;
create policy caixa_diarios_select_policy on public.caixa_diarios for select to authenticated
  using (tenant_id = public.estabelecimento_atual() or public.estabelecimento_atual() is null);
drop policy if exists caixa_diarios_insert_policy on public.caixa_diarios;
create policy caixa_diarios_insert_policy on public.caixa_diarios for insert to authenticated
  with check (tenant_id = public.estabelecimento_atual() or public.estabelecimento_atual() is null);
drop policy if exists caixa_diarios_update_policy on public.caixa_diarios;
create policy caixa_diarios_update_policy on public.caixa_diarios for update to authenticated
  using (tenant_id = public.estabelecimento_atual() or public.estabelecimento_atual() is null)
  with check (tenant_id = public.estabelecimento_atual() or public.estabelecimento_atual() is null);

-- movimentos_caixa
drop policy if exists movimentos_caixa_select_policy on public.movimentos_caixa;
create policy movimentos_caixa_select_policy on public.movimentos_caixa for select to authenticated
  using (tenant_id = public.estabelecimento_atual() or public.estabelecimento_atual() is null);
drop policy if exists movimentos_caixa_insert_policy on public.movimentos_caixa;
create policy movimentos_caixa_insert_policy on public.movimentos_caixa for insert to authenticated
  with check (tenant_id = public.estabelecimento_atual() or public.estabelecimento_atual() is null);

-- movimentacoes_estoque
drop policy if exists movimentacoes_estoque_select_policy on public.movimentacoes_estoque;
create policy movimentacoes_estoque_select_policy on public.movimentacoes_estoque for select to authenticated
  using (tenant_id = public.estabelecimento_atual() or public.estabelecimento_atual() is null);
drop policy if exists movimentacoes_estoque_insert_policy on public.movimentacoes_estoque;
create policy movimentacoes_estoque_insert_policy on public.movimentacoes_estoque for insert to authenticated
  with check (tenant_id = public.estabelecimento_atual() or public.estabelecimento_atual() is null);

-- documentos_fiscais
drop policy if exists documentos_fiscais_select_policy on public.documentos_fiscais;
create policy documentos_fiscais_select_policy on public.documentos_fiscais for select to authenticated
  using (tenant_id = public.estabelecimento_atual() or public.estabelecimento_atual() is null);
drop policy if exists documentos_fiscais_insert_policy on public.documentos_fiscais;
create policy documentos_fiscais_insert_policy on public.documentos_fiscais for insert to authenticated
  with check (tenant_id = public.estabelecimento_atual() or public.estabelecimento_atual() is null);
drop policy if exists documentos_fiscais_update_policy on public.documentos_fiscais;
create policy documentos_fiscais_update_policy on public.documentos_fiscais for update to authenticated
  using (tenant_id = public.estabelecimento_atual() or public.estabelecimento_atual() is null)
  with check (tenant_id = public.estabelecimento_atual() or public.estabelecimento_atual() is null);

-- perfis_usuarios
drop policy if exists perfis_usuarios_select on public.perfis_usuarios;
create policy perfis_usuarios_select on public.perfis_usuarios for select to authenticated
  using (tenant_id = public.estabelecimento_atual() or public.estabelecimento_atual() is null);
drop policy if exists perfis_usuarios_manage on public.perfis_usuarios;
create policy perfis_usuarios_manage on public.perfis_usuarios for all to authenticated
  using ((tenant_id = public.estabelecimento_atual() or public.estabelecimento_atual() is null) and public.is_gerente())
  with check ((tenant_id = public.estabelecimento_atual() or public.estabelecimento_atual() is null) and public.is_gerente());

-- ----------------------------------------------------------------------------
-- 9. RPCs com salvaguarda multi-tenant
-- ----------------------------------------------------------------------------

-- 9.1 Perfil de novo usuário → tenant padrão
create or replace function public.handle_new_user_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
DECLARE
  v_role TEXT := 'garcom';
  v_name TEXT;
  v_tenant uuid;
BEGIN
  IF NEW.email ILIKE '%gerente%' OR NEW.email ILIKE '%admin%' OR NEW.email = 'maurobranco@incidesolar.com.br' THEN
    v_role := 'gerente';
  ELSIF NEW.email ILIKE '%caixa%' THEN
    v_role := 'caixa';
  ELSIF NEW.email ILIKE '%cozinha%' THEN
    v_role := 'cozinha';
  END IF;

  v_name := COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1));

  v_tenant := public.estabelecimento_atual();
  IF v_tenant IS NULL THEN
    SELECT id INTO v_tenant FROM public.estabelecimentos WHERE ativo = true ORDER BY criado_em ASC LIMIT 1;
  END IF;

  INSERT INTO public.perfis_usuarios (id, email, nome_exibicao, perfil, ativo, tenant_id)
  VALUES (NEW.id, NEW.email, v_name, v_role, true, v_tenant)
  ON CONFLICT (id) DO UPDATE
    SET email = EXCLUDED.email,
        nome_exibicao = COALESCE(NULLIF(EXCLUDED.nome_exibicao, ''), public.perfis_usuarios.nome_exibicao);

  RETURN NEW;
END;
$$;

-- 9.2 Fechar mesa sem consumo
create or replace function public.fechar_mesa_sem_consumo(p_mesa_numero integer)
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
BEGIN
  v_user_profile := public.get_current_user_profile();
  IF v_user_profile IS NULL OR v_user_profile NOT IN ('garcom', 'caixa', 'gerente') THEN
    RAISE EXCEPTION 'Acesso negado: apenas Garçom, Caixa e Gerente podem fechar mesas sem consumo.'
      USING ERRCODE = '42501';
  END IF;

  IF p_mesa_numero IS NULL OR p_mesa_numero <= 0 THEN
    RETURN jsonb_build_object('sucesso', false, 'codigo', 'MESA_INVALIDA', 'mensagem', 'Número de mesa inválido.');
  END IF;

  -- Isolamento multi-tenant (Fase 1)
  IF NOT public.preparar_contexto_tenant_mesa(p_mesa_numero) THEN
    RETURN jsonb_build_object(
      'sucesso', false,
      'codigo', 'ESTABELECIMENTO_DIFERENTE',
      'mensagem', 'Esta mesa pertence a outro estabelecimento.'
    );
  END IF;

  v_comanda_id := 'cmd-' || LPAD(p_mesa_numero::text, 2, '0');

  SELECT * INTO v_cmd FROM public.comandas WHERE id = v_comanda_id;
  IF NOT FOUND THEN
    UPDATE public.mesas
    SET status = 'Livre', updated_at = v_now
    WHERE numero = p_mesa_numero;

    RETURN jsonb_build_object(
      'sucesso', true,
      'codigo', 'MESA_LIBERADA',
      'mesa_numero', p_mesa_numero,
      'mensagem', 'Mesa ' || p_mesa_numero::text || ' liberada com sucesso.'
    );
  END IF;

  SELECT COUNT(*) INTO v_qtd_itens FROM public.comanda_itens WHERE comanda_id = v_comanda_id;
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

  DELETE FROM public.comanda_itens WHERE comanda_id = v_comanda_id;

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
  WHERE id = v_comanda_id;

  UPDATE public.mesas
  SET status = 'Livre', updated_at = v_now
  WHERE numero = p_mesa_numero;

  RETURN jsonb_build_object(
    'sucesso', true,
    'codigo', 'MESA_FECHADA_SEM_CONSUMO',
    'mesa_numero', p_mesa_numero,
    'comanda_id', v_comanda_id,
    'mensagem', 'Mesa ' || p_mesa_numero::text || ' fechada e liberada com sucesso!'
  );
END;
$$;

-- 9.3 Transferência de mesa
create or replace function public.transferir_mesa_atendimento(p_mesa_origem integer, p_mesa_destino integer)
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

  -- Isolamento multi-tenant (Fase 1)
  IF NOT public.preparar_contexto_tenant_mesa(p_mesa_origem) THEN
    RETURN jsonb_build_object(
      'sucesso', false,
      'codigo', 'ESTABELECIMENTO_DIFERENTE',
      'mensagem', 'Esta mesa pertence a outro estabelecimento.'
    );
  END IF;

  v_cmd_origem_id := 'cmd-' || LPAD(p_mesa_origem::text, 2, '0');
  v_cmd_destino_id := 'cmd-' || LPAD(p_mesa_destino::text, 2, '0');

  SELECT * INTO v_cmd FROM public.comandas WHERE id = v_cmd_origem_id;
  IF NOT FOUND OR v_cmd.status = 'Livre' THEN
    RETURN jsonb_build_object(
      'sucesso', false,
      'codigo', 'ORIGEM_SEM_ATENDIMENTO',
      'mensagem', 'A Mesa ' || p_mesa_origem::text || ' não possui atendimento aberto ou consumo para transferir.'
    );
  END IF;

  SELECT * INTO v_mesa_dest FROM public.mesas WHERE numero = p_mesa_destino;
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

  IF v_mesa_dest.tenant_id IS NOT NULL AND v_mesa_dest.tenant_id <> v_cmd.tenant_id THEN
    RETURN jsonb_build_object(
      'sucesso', false,
      'codigo', 'DESTINO_OUTRO_ESTABELECIMENTO',
      'mensagem', 'A Mesa ' || p_mesa_destino::text || ' pertence a outro estabelecimento.'
    );
  END IF;

  DELETE FROM public.comanda_itens WHERE comanda_id = v_cmd_destino_id;

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
    COALESCE(v_cmd.created_at, v_now), v_now, v_cmd.tenant_id
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
  WHERE comanda_id = v_cmd_origem_id;

  GET DIAGNOSTICS v_itens_transferidos = ROW_COUNT;

  UPDATE public.mesas
  SET status = v_cmd.status, updated_at = v_now
  WHERE numero = p_mesa_destino;

  UPDATE public.mesas
  SET status = 'Livre', updated_at = v_now
  WHERE numero = p_mesa_origem;

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
  WHERE id = v_cmd_origem_id;

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

-- 9.4 Iniciar atendimento on-line (cliente /pedido)
create or replace function public.iniciar_atendimento_online(p_mesa_numero integer, p_cliente_nome text)
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
BEGIN
  IF v_mesa_num IS NULL OR v_mesa_num < 1 THEN
    RETURN jsonb_build_object('sucesso', false, 'codigo', 'MESA_INVALIDA', 'mensagem', 'Número de mesa inválido.');
  END IF;

  v_nome := trim(COALESCE(p_cliente_nome, ''));
  IF v_nome = '' THEN
    RETURN jsonb_build_object('sucesso', false, 'codigo', 'NOME_OBRIGATORIO', 'mensagem', 'Por favor, informe seu nome para iniciar o atendimento.');
  END IF;

  v_nome := substring(v_nome from 1 for 60);

  -- Isolamento multi-tenant (Fase 1)
  IF NOT public.preparar_contexto_tenant_mesa(v_mesa_num) THEN
    RETURN jsonb_build_object(
      'sucesso', false,
      'codigo', 'ESTABELECIMENTO_DIFERENTE',
      'mensagem', 'Esta mesa pertence a outro estabelecimento.'
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.mesas WHERE numero = v_mesa_num) THEN
    INSERT INTO public.mesas (numero, status, capacidade)
    VALUES (v_mesa_num, 'Ocupada', 4);
  ELSE
    UPDATE public.mesas
    SET status = 'Ocupada', updated_at = v_now
    WHERE numero = v_mesa_num;
  END IF;

  v_comanda_id := 'cmd-' || LPAD(v_mesa_num::text, 2, '0');

  IF NOT EXISTS (SELECT 1 FROM public.comandas WHERE id = v_comanda_id) THEN
    INSERT INTO public.comandas (
      id, mesa_numero, cliente_nome, pessoas, status, aberta_em, total,
      status_conta, conta_solicitada, conta_solicitada_em,
      forma_pagamento_solicitada, motivo_recusa_conta
    ) VALUES (
      v_comanda_id, v_mesa_num, v_nome, 1, 'Ocupada', v_now, 0.00,
      'nenhum', false, NULL, NULL, NULL
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
$$;

-- 9.5 Enviar pedido on-line (cliente /pedido)
create or replace function public.enviar_pedido_online(p_mesa_numero integer, p_cliente_nome text, p_itens jsonb)
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
BEGIN
  IF v_mesa_num IS NULL OR v_mesa_num < 1 THEN
    v_mesa_num := 10;
  END IF;

  IF p_itens IS NULL OR jsonb_array_length(p_itens) = 0 THEN
    RETURN jsonb_build_object('sucesso', false, 'codigo', 'ITENS_VAZIOS', 'mensagem', 'Nenhum item válido informado no pedido.');
  END IF;

  -- Isolamento multi-tenant (Fase 1)
  IF NOT public.preparar_contexto_tenant_mesa(v_mesa_num) THEN
    RETURN jsonb_build_object(
      'sucesso', false,
      'codigo', 'ESTABELECIMENTO_DIFERENTE',
      'mensagem', 'Esta mesa pertence a outro estabelecimento.'
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.mesas WHERE numero = v_mesa_num) THEN
    INSERT INTO public.mesas (numero, status, capacidade)
    VALUES (v_mesa_num, 'Livre', 4)
    ON CONFLICT DO NOTHING;
  END IF;

  v_comanda_id := 'cmd-' || LPAD(v_mesa_num::text, 2, '0');

  -- REGRA OBRIGATÓRIA: Não sobrescrever o cliente_nome se já existir na comanda!
  IF NOT EXISTS (SELECT 1 FROM public.comandas WHERE id = v_comanda_id) THEN
    INSERT INTO public.comandas (
      id, mesa_numero, cliente_nome, pessoas, status, aberta_em, total,
      status_conta, conta_solicitada, conta_solicitada_em,
      forma_pagamento_solicitada, motivo_recusa_conta
    )
    VALUES (
      v_comanda_id, v_mesa_num,
      COALESCE(NULLIF(trim(p_cliente_nome), ''), 'Cliente On-line'),
      1, 'Ocupada', NOW(), 0.00, 'nenhum', false, NULL, NULL, NULL
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
    WHERE id = v_comanda_id;
  END IF;

  UPDATE public.mesas
  SET status = 'Ocupada', updated_at = NOW()
  WHERE numero = v_mesa_num;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_itens)
  LOOP
    SELECT * INTO v_prod
    FROM public.produtos
    WHERE id = (v_item->>'produto_id') AND ativo = true;

    IF FOUND THEN
      v_comanda_item_id := 'ci-onl-' || floor(extract(epoch from clock_timestamp()) * 1000)::text || '-' || floor(random() * 9000 + 1000)::text;

      INSERT INTO public.comanda_itens (
        id, comanda_id, produto_id, nome_produto, preco_unitario, quantidade, observacoes, origem_online
      ) VALUES (
        v_comanda_item_id, v_comanda_id, v_prod.id, v_prod.nome, v_prod.preco,
        GREATEST(1, COALESCE((v_item->>'quantidade')::integer, 1)),
        NULLIF(trim(v_item->>'observacoes'), ''),
        true
      );

      v_area := COALESCE(v_prod.area_preparo, 'bar');

      INSERT INTO public.fila_cozinha (
        comanda_item_id, area_preparo, status, observacoes, origem_online
      ) VALUES (
        v_comanda_item_id, v_area, 'pendente',
        COALESCE(NULLIF(trim(v_item->>'observacoes'), ''), 'Pedido On-line'),
        true
      );

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
$$;

-- CORREÇÃO 42P13: derruba as assinaturas existentes antes de recriar
-- (CREATE OR REPLACE não pode remover parâmetros padrão de função existente).
drop function if exists public.solicitar_conta_mesa(integer, text);
drop function if exists public.solicitar_conta_mesa(integer, text, boolean);

-- 9.6 Solicitar conta (sem NFC-e)
create or replace function public.solicitar_conta_mesa(p_mesa_numero integer, p_forma_pagamento text)
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

  -- Isolamento multi-tenant (Fase 1)
  IF NOT public.preparar_contexto_tenant_mesa(p_mesa_numero) THEN
    RETURN jsonb_build_object('sucesso', false, 'codigo', 'ESTABELECIMENTO_DIFERENTE', 'mensagem', 'Esta mesa pertence a outro estabelecimento.');
  END IF;
  v_tenant := nullif(current_setting('app.estabelecimento_id', true), '')::uuid;

  v_comanda_id := 'cmd-' || LPAD(p_mesa_numero::text, 2, '0');

  SELECT status, inclui_taxa_servico, status_conta
  INTO v_status_atual, v_inclui_taxa, v_status_conta_atual
  FROM public.comandas
  WHERE id = v_comanda_id;

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
  WHERE comanda_id = v_comanda_id;

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
  WHERE id = v_comanda_id;

  UPDATE public.mesas
  SET status = 'Aguardando Pagamento', updated_at = NOW()
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
$$;

-- 9.7 Solicitar conta (com NFC-e)
create or replace function public.solicitar_conta_mesa(p_mesa_numero integer, p_forma_pagamento text, p_deseja_nfce boolean default false)
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

  -- Isolamento multi-tenant (Fase 1)
  IF NOT public.preparar_contexto_tenant_mesa(p_mesa_numero) THEN
    RETURN jsonb_build_object('sucesso', false, 'codigo', 'ESTABELECIMENTO_DIFERENTE', 'mensagem', 'Esta mesa pertence a outro estabelecimento.');
  END IF;
  v_tenant := nullif(current_setting('app.estabelecimento_id', true), '')::uuid;

  v_comanda_id := 'cmd-' || LPAD(p_mesa_numero::text, 2, '0');

  SELECT status, inclui_taxa_servico, status_conta
  INTO v_status_atual, v_inclui_taxa, v_status_conta_atual
  FROM public.comandas
  WHERE id = v_comanda_id;

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
  WHERE comanda_id = v_comanda_id;

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
  WHERE id = v_comanda_id;

  UPDATE public.mesas
  SET status = 'Aguardando Pagamento', updated_at = NOW()
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

grant execute on function public.solicitar_conta_mesa(integer, text) to anon, authenticated;
grant execute on function public.solicitar_conta_mesa(integer, text, boolean) to anon, authenticated;

-- 9.8 Caixa: autorizar/fechar conta
create or replace function public.caixa_autorizar_fechar_conta(p_mesa_numero integer, p_forma_pagamento text, p_valor_pago numeric, p_marcar_em_processamento_pix boolean default false)
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
BEGIN
  v_user_profile := public.get_current_user_profile();
  IF v_user_profile IS NULL OR v_user_profile NOT IN ('caixa', 'gerente') THEN
    RAISE EXCEPTION 'Ação não permitida: apenas Caixa ou Gerente podem autorizar e fechar comandas.'
      USING ERRCODE = '42501';
  END IF;

  v_user_label := CASE WHEN v_user_profile = 'gerente' THEN 'Carlos Gerente' ELSE 'Marina Caixa' END;

  -- Isolamento multi-tenant (Fase 1)
  IF NOT public.preparar_contexto_tenant_mesa(p_mesa_numero) THEN
    RETURN jsonb_build_object('sucesso', false, 'codigo', 'ESTABELECIMENTO_DIFERENTE', 'mensagem', 'Esta mesa pertence a outro estabelecimento.');
  END IF;

  v_comanda_id := 'cmd-' || LPAD(p_mesa_numero::text, 2, '0');

  SELECT * INTO v_cmd FROM public.comandas WHERE id = v_comanda_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Comanda % não encontrada.', v_comanda_id;
  END IF;

  v_forma := COALESCE(NULLIF(trim(p_forma_pagamento), ''), v_cmd.forma_pagamento_solicitada, 'Pix');
  v_cliente_salvo := COALESCE(v_cmd.cliente_nome, 'Consumidor Final');
  v_nfce_desejada := COALESCE(v_cmd.nfce_solicitada, false);

  IF p_marcar_em_processamento_pix THEN
    UPDATE public.comandas
    SET status_conta = 'em_processamento_pix', updated_at = v_now
    WHERE id = v_comanda_id;

    RETURN jsonb_build_object(
      'sucesso', true,
      'status_conta', 'em_processamento_pix',
      'mensagem', 'Status atualizado para Pagamento em Processamento (Pix).'
    );
  END IF;

  v_mov_id := 'cm-' || floor(extract(epoch from clock_timestamp()) * 1000)::text;
  INSERT INTO public.movimentos_caixa (
    id, data_hora, descricao, tipo, forma_pagamento, valor, usuario, comanda_id
  ) VALUES (
    v_mov_id, v_now,
    'Pagamento Mesa ' || p_mesa_numero::text || ' (Fechamento Solicitado On-line)',
    'Entrada', v_forma, p_valor_pago, v_user_label, v_comanda_id
  );

  v_seq := floor(100 + random() * 900)::integer;
  v_doc_number := 'NFC-e 000.' || v_seq::text;
  v_fisc_id := 'fisc-' || floor(extract(epoch from clock_timestamp()) * 1000)::text;
  v_access_key := '3525031429384200018465001000000' || floor(1000000000 + random() * 9000000000)::text;

  INSERT INTO public.documentos_fiscais (
    id, numero, serie, tipo, emitido_em, valor, status, nome_cliente, comanda_id, chave_acesso
  ) VALUES (
    v_fisc_id, v_doc_number, '001', 'NFC-e', v_now, p_valor_pago, 'Autorizada',
    v_cliente_salvo, v_comanda_id, v_access_key
  );

  UPDATE public.mesas
  SET status = 'Livre', updated_at = v_now
  WHERE numero = p_mesa_numero;

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

-- 9.9 Caixa: recusar/adiar conta
create or replace function public.caixa_recusar_adiar_conta(p_mesa_numero integer, p_motivo text)
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
BEGIN
  v_user_profile := public.get_current_user_profile();
  IF v_user_profile IS NULL OR v_user_profile NOT IN ('caixa', 'gerente') THEN
    RAISE EXCEPTION 'Ação não permitida: apenas Caixa ou Gerente podem adiar ou recusar fechamento.'
      USING ERRCODE = '42501';
  END IF;

  -- Isolamento multi-tenant (Fase 1)
  IF NOT public.preparar_contexto_tenant_mesa(p_mesa_numero) THEN
    RETURN jsonb_build_object('sucesso', false, 'codigo', 'ESTABELECIMENTO_DIFERENTE', 'mensagem', 'Esta mesa pertence a outro estabelecimento.');
  END IF;

  v_motivo_final := COALESCE(NULLIF(trim(p_motivo), ''), 'Mesa com atendimento em continuidade / novo pedido em andamento');
  v_comanda_id := 'cmd-' || LPAD(p_mesa_numero::text, 2, '0');

  UPDATE public.mesas
  SET status = 'Ocupada', updated_at = v_now
  WHERE numero = p_mesa_numero;

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
$$;

-- 9.10 Detalhes da conta (cliente on-line e caixa)
create or replace function public.obter_detalhes_conta_mesa(p_mesa_numero integer)
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
BEGIN
  v_comanda_id := 'cmd-' || LPAD(p_mesa_numero::text, 2, '0');

  SELECT * INTO v_cmd FROM public.comandas WHERE id = v_comanda_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('encontrada', false);
  END IF;

  -- Isolamento multi-tenant (Fase 1)
  IF v_cmd.tenant_id IS NOT NULL AND public.estabelecimento_atual() IS NOT NULL
     AND v_cmd.tenant_id <> public.estabelecimento_atual() THEN
    RETURN jsonb_build_object('encontrada', false);
  END IF;

  SELECT
    COALESCE(taxa_servico_padrao, 10.00) AS taxa_servico_padrao,
    razao_social, nome_fantasia, cnpj, inscricao_estadual, endereco_completo,
    telefone, impressora_fiscal_nome, pix_chave, pix_beneficiario_nome, pix_cidade
  INTO v_cfg
  FROM public.configuracoes_bar
  WHERE tenant_id = v_cmd.tenant_id
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
  WHERE comanda_id = v_comanda_id;

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

-- 9.11 NFC-e da comanda
create or replace function public.obter_nfce_comanda_mesa(p_mesa_numero integer)
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
BEGIN
  v_comanda_id := 'cmd-' || LPAD(p_mesa_numero::text, 2, '0');

  SELECT * INTO v_cmd FROM public.comandas WHERE id = v_comanda_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('sucesso', false, 'mensagem', 'Comanda não encontrada.');
  END IF;

  -- Isolamento multi-tenant (Fase 1)
  IF v_cmd.tenant_id IS NOT NULL AND public.estabelecimento_atual() IS NOT NULL
     AND v_cmd.tenant_id <> public.estabelecimento_atual() THEN
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

-- 9.12 Status do pedido (acompanhamento do cliente)
create or replace function public.obter_status_pedido_mesa(p_mesa_numero integer default null, p_comanda_id text default null)
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
BEGIN
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
  JOIN public.comandas c ON ci.comanda_id = c.id
  LEFT JOIN public.produtos p ON ci.produto_id = p.id
  WHERE (
    (p_comanda_id IS NOT NULL AND c.id = p_comanda_id)
    OR (p_mesa_numero IS NOT NULL AND c.mesa_numero = p_mesa_numero AND c.status IN ('Ocupada', 'Aguardando Pagamento'))
  )
  AND (c.tenant_id = public.estabelecimento_atual() OR public.estabelecimento_atual() IS NULL)
  ORDER BY f.created_at DESC;
END;
$$;

-- 9.13 Fila de cozinha: atualizar status
create or replace function public.atualizar_status_item_fila(p_item_id uuid, p_novo_status text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
DECLARE
  v_status_validado TEXT;
BEGIN
  IF NOT public.is_operador_cozinha() THEN
    RAISE EXCEPTION 'Acesso negado: apenas perfis de Cozinha, Garçom, Caixa ou Gerente podem atualizar a fila.';
  END IF;

  v_status_validado := lower(trim(p_novo_status));
  IF v_status_validado NOT IN ('pendente', 'preparando', 'pronto', 'entregue') THEN
    RAISE EXCEPTION 'Status inválido: deve ser pendente, preparando, pronto ou entregue.';
  END IF;

  UPDATE public.fila_cozinha
  SET status = v_status_validado, updated_at = NOW()
  WHERE id = p_item_id
    AND (tenant_id = public.estabelecimento_atual() OR public.estabelecimento_atual() IS NULL);

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Item da fila de cozinha não encontrado: %', p_item_id;
  END IF;

  RETURN jsonb_build_object('sucesso', true, 'id', p_item_id, 'status', v_status_validado, 'updated_at', NOW());
END;
$$;

-- 9.14 Abater estoque
create or replace function public.abater_estoque_comanda(p_produto_id text, p_delta numeric)
returns numeric
language plpgsql
security definer
set search_path = public
as $$
DECLARE
  v_novo_estoque NUMERIC;
BEGIN
  IF NOT public.is_garcom() THEN
    RAISE EXCEPTION 'Acesso negado: perfil sem autorização operacional.';
  END IF;

  UPDATE public.produtos
  SET estoque = GREATEST(0.00, ROUND((estoque - p_delta)::numeric, 2)), updated_at = NOW()
  WHERE id = p_produto_id
    AND (tenant_id = public.estabelecimento_atual() OR public.estabelecimento_atual() IS NULL)
  RETURNING estoque INTO v_novo_estoque;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Produto não encontrado: %', p_produto_id;
  END IF;

  RETURN v_novo_estoque;
END;
$$;

-- 9.15 Cancelar documento fiscal
create or replace function public.cancelar_documento_fiscal(p_documento_id text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
BEGIN
  IF NOT public.is_gerente() THEN
    RAISE EXCEPTION 'Acesso negado: apenas Gerente possui autorização fiscal para cancelamento.';
  END IF;

  UPDATE public.documentos_fiscais
  SET status = 'Cancelada'
  WHERE id = p_documento_id
    AND (tenant_id = public.estabelecimento_atual() OR public.estabelecimento_atual() IS NULL);

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Documento fiscal não encontrado: %', p_documento_id;
  END IF;

  RETURN true;
END;
$$;

-- 9.16 Capacidade da mesa
create or replace function public.gerente_atualizar_capacidade_mesa(p_mesa_id uuid, p_capacidade integer)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
BEGIN
  IF NOT public.is_gerente() THEN
    RAISE EXCEPTION 'Acesso negado: apenas Gerente pode alterar a capacidade ou configuração das mesas.';
  END IF;

  IF p_capacidade <= 0 THEN
    RAISE EXCEPTION 'A capacidade da mesa deve ser maior que zero.';
  END IF;

  UPDATE public.mesas
  SET capacidade = p_capacidade, updated_at = NOW()
  WHERE id = p_mesa_id
    AND (tenant_id = public.estabelecimento_atual() OR public.estabelecimento_atual() IS NULL);

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Mesa não encontrada neste estabelecimento.';
  END IF;

  RETURN true;
END;
$$;

-- 9.17 Movimento de caixa seguro
create or replace function public.registrar_movimento_caixa_seguro(p_id text, p_tipo text, p_descricao text, p_valor numeric, p_forma_pagamento text, p_comanda_id text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
DECLARE
  v_perfil TEXT;
  v_user_nome TEXT;
  v_now TIMESTAMPTZ := NOW();
  v_tenant uuid;
BEGIN
  IF NOT public.is_caixa() THEN
    RAISE EXCEPTION 'Acesso negado: apenas Caixa ou Gerente podem operar o fluxo de caixa.';
  END IF;

  SELECT perfil, COALESCE(nome_exibicao, email) INTO v_perfil, v_user_nome
  FROM public.perfis_usuarios
  WHERE id = auth.uid() AND ativo = true;

  -- Isolamento multi-tenant (Fase 1)
  v_tenant := public.estabelecimento_atual();
  IF p_comanda_id IS NOT NULL THEN
    SELECT tenant_id INTO v_tenant FROM public.comandas WHERE id = p_comanda_id;
  END IF;
  PERFORM set_config('app.estabelecimento_id', COALESCE(v_tenant::text, ''), true);

  INSERT INTO public.movimentos_caixa (
    id, data_hora, descricao, tipo, forma_pagamento, valor, usuario, comanda_id
  ) VALUES (
    p_id, v_now, p_descricao, p_tipo, p_forma_pagamento, p_valor,
    COALESCE(v_user_nome, 'Operador'), p_comanda_id
  );

  RETURN jsonb_build_object('sucesso', true, 'id', p_id, 'usuario', v_user_nome, 'data_hora', v_now);
END;
$$;

-- 9.18 Recalcular total da comanda (trigger de itens)
create or replace function public.recalcular_total_comanda(p_comanda_id text)
returns void
language plpgsql
security definer
set search_path = public
as $$
DECLARE
  v_subtotal NUMERIC(10,2) := 0.00;
  v_taxa_padrao NUMERIC(10,2) := 10.00;
  v_taxa_valor NUMERIC(10,2) := 0.00;
  v_inclui_taxa BOOLEAN := true;
  v_cmd_status TEXT;
  v_cmd_status_conta TEXT;
  v_itens_count INTEGER := 0;
  v_tenant uuid;
BEGIN
  IF p_comanda_id IS NULL OR trim(p_comanda_id) = '' THEN
    RETURN;
  END IF;

  SELECT inclui_taxa_servico, status, status_conta, tenant_id
  INTO v_inclui_taxa, v_cmd_status, v_cmd_status_conta, v_tenant
  FROM public.comandas
  WHERE id = p_comanda_id;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  -- Comanda fechada preserva o total do histórico financeiro
  IF v_cmd_status = 'Fechada' OR v_cmd_status_conta = 'fechada' THEN
    RETURN;
  END IF;

  SELECT COALESCE(SUM(preco_unitario * quantidade), 0.00), COUNT(*)
  INTO v_subtotal, v_itens_count
  FROM public.comanda_itens
  WHERE comanda_id = p_comanda_id;

  IF v_itens_count = 0 OR v_subtotal <= 0.00 THEN
    UPDATE public.comandas SET total = 0.00, updated_at = NOW() WHERE id = p_comanda_id;
    RETURN;
  END IF;

  SELECT COALESCE(taxa_servico_padrao, 10.00)
  INTO v_taxa_padrao
  FROM public.configuracoes_bar
  WHERE tenant_id = v_tenant
  LIMIT 1;

  IF COALESCE(v_inclui_taxa, true) THEN
    v_taxa_valor := ROUND((v_subtotal * (v_taxa_padrao / 100.0)), 2);
  ELSE
    v_taxa_valor := 0.00;
  END IF;

  UPDATE public.comandas
  SET total = v_subtotal + v_taxa_valor, updated_at = NOW()
  WHERE id = p_comanda_id;
END;
$$;

-- 9.19 Admin: listar usuários do estabelecimento
create or replace function public.admin_listar_usuarios()
returns table (id uuid, email character varying, nome_exibicao text, perfil text, ativo boolean, created_at timestamptz, last_sign_in_at timestamptz)
language plpgsql
security definer
set search_path = public
as $$
BEGIN
  IF NOT public.is_gerente() THEN
    RAISE EXCEPTION 'Apenas usuários com perfil Gerente podem listar a equipe.';
  END IF;

  RETURN QUERY
  SELECT
    u.id,
    u.email::VARCHAR,
    COALESCE(p.nome_exibicao, u.raw_user_meta_data->>'name', split_part(u.email, '@', 1))::TEXT AS nome_exibicao,
    COALESCE(p.perfil, 'garcom')::TEXT AS perfil,
    COALESCE(p.ativo, true)::BOOLEAN AS ativo,
    u.created_at,
    u.last_sign_in_at
  FROM auth.users u
  LEFT JOIN public.perfis_usuarios p ON p.id = u.id
  WHERE p.id IS NULL
     OR p.tenant_id = public.estabelecimento_atual()
     OR public.estabelecimento_atual() IS NULL
  ORDER BY u.created_at ASC;
END;
$$;

-- 9.20 Admin: criar usuário (no estabelecimento do gerente logado)
create or replace function public.admin_criar_usuario(p_email text, p_senha text, p_nome text, p_perfil text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
DECLARE
  v_new_id UUID;
  v_clean_email TEXT;
  v_perfil_validado TEXT;
  v_tenant uuid;
BEGIN
  IF NOT public.is_gerente() THEN
    RAISE EXCEPTION 'Acesso negado: apenas Gerente pode criar usuários.';
  END IF;

  v_clean_email := lower(trim(p_email));

  IF v_clean_email IS NULL OR v_clean_email = '' OR position('@' IN v_clean_email) = 0 THEN
    RAISE EXCEPTION 'E-mail inválido fornecido.';
  END IF;

  IF p_senha IS NULL OR char_length(p_senha) < 6 THEN
    RAISE EXCEPTION 'A senha deve ter no mínimo 6 caracteres.';
  END IF;

  v_perfil_validado := lower(trim(p_perfil));
  IF v_perfil_validado NOT IN ('garcom', 'caixa', 'gerente', 'cozinha') THEN
    v_perfil_validado := 'garcom';
  END IF;

  IF EXISTS (SELECT 1 FROM auth.users WHERE lower(email) = v_clean_email) THEN
    RAISE EXCEPTION 'O e-mail "%" já está cadastrado no sistema.', v_clean_email;
  END IF;

  v_new_id := gen_random_uuid();

  v_tenant := public.estabelecimento_atual();
  IF v_tenant IS NULL THEN
    SELECT id INTO v_tenant FROM public.estabelecimentos WHERE ativo = true ORDER BY criado_em ASC LIMIT 1;
  END IF;

  INSERT INTO auth.users (
    id, instance_id, email, encrypted_password, email_confirmed_at, created_at, updated_at,
    raw_app_meta_data, raw_user_meta_data, is_super_admin, role, aud,
    confirmation_token, recovery_token, email_change_token_new, email_change,
    email_change_token_current, phone, phone_change, phone_change_token, reauthentication_token
  ) VALUES (
    v_new_id,
    '00000000-0000-0000-0000-000000000000',
    v_clean_email,
    crypt(p_senha, gen_salt('bf')),
    NOW(),
    NOW(),
    NOW(),
    '{"provider": "email", "providers": ["email"]}',
    json_build_object('name', COALESCE(NULLIF(trim(p_nome), ''), split_part(v_clean_email, '@', 1))),
    false,
    'authenticated',
    'authenticated',
    '', '', '', '', '',
    NULL,
    '', '', ''
  );

  INSERT INTO public.perfis_usuarios (
    id, email, nome_exibicao, perfil, ativo, created_at, updated_at, tenant_id
  ) VALUES (
    v_new_id,
    v_clean_email,
    COALESCE(NULLIF(trim(p_nome), ''), split_part(v_clean_email, '@', 1)),
    v_perfil_validado,
    true,
    NOW(),
    NOW(),
    v_tenant
  )
  ON CONFLICT (id) DO UPDATE
  SET perfil = v_perfil_validado,
      nome_exibicao = EXCLUDED.nome_exibicao,
      email = EXCLUDED.email,
      ativo = true,
      tenant_id = EXCLUDED.tenant_id,
      updated_at = NOW();

  RETURN jsonb_build_object(
    'sucesso', true,
    'id', v_new_id,
    'email', v_clean_email,
    'nome', COALESCE(NULLIF(trim(p_nome), ''), split_part(v_clean_email, '@', 1)),
    'perfil', v_perfil_validado,
    'mensagem', 'Usuário cadastrado com sucesso!'
  );
END;
$$;

-- 9.21 Admin: atualizar perfil
create or replace function public.admin_atualizar_perfil_usuario(p_user_id uuid, p_novo_perfil text, p_novo_nome text default null, p_ativo boolean default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
DECLARE
  v_perfil_validado TEXT;
  v_caller_id UUID;
BEGIN
  IF NOT public.is_gerente() THEN
    RAISE EXCEPTION 'Acesso negado: apenas Gerente pode alterar perfis.';
  END IF;

  v_caller_id := auth.uid();

  v_perfil_validado := lower(trim(p_novo_perfil));
  IF v_perfil_validado NOT IN ('garcom', 'caixa', 'gerente', 'cozinha') THEN
    RAISE EXCEPTION 'Perfil inválido: use garcom, caixa, gerente ou cozinha.';
  END IF;

  IF v_caller_id = p_user_id AND v_perfil_validado <> 'gerente' THEN
    RAISE EXCEPTION 'Operação bloqueada: você não pode remover o perfil de Gerente da sua própria conta.';
  END IF;

  IF v_caller_id = p_user_id AND p_ativo = false THEN
    RAISE EXCEPTION 'Operação bloqueada: você não pode desativar seu próprio acesso.';
  END IF;

  UPDATE public.perfis_usuarios
  SET perfil = v_perfil_validado,
      nome_exibicao = COALESCE(NULLIF(trim(p_novo_nome), ''), nome_exibicao),
      ativo = COALESCE(p_ativo, ativo),
      updated_at = NOW()
  WHERE id = p_user_id
    AND (tenant_id = public.estabelecimento_atual() OR public.estabelecimento_atual() IS NULL);

  IF p_novo_nome IS NOT NULL AND trim(p_novo_nome) <> '' THEN
    UPDATE auth.users
    SET raw_user_meta_data = jsonb_set(
      COALESCE(raw_user_meta_data, '{}'::jsonb),
      '{name}',
      to_jsonb(trim(p_novo_nome))
    ),
    updated_at = NOW()
    WHERE id = p_user_id;
  END IF;

  RETURN jsonb_build_object('sucesso', true, 'id', p_user_id, 'perfil', v_perfil_validado, 'mensagem', 'Perfil atualizado com sucesso!');
END;
$$;

-- 9.22 Admin: redefinir senha
create or replace function public.admin_redefinir_senha_usuario(p_user_id uuid, p_nova_senha text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
BEGIN
  IF NOT public.is_gerente() THEN
    RAISE EXCEPTION 'Acesso negado: apenas Gerente pode redefinir senhas.';
  END IF;

  IF p_nova_senha IS NULL OR char_length(p_nova_senha) < 6 THEN
    RAISE EXCEPTION 'A nova senha deve ter no mínimo 6 caracteres.';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.perfis_usuarios
    WHERE id = p_user_id
      AND public.estabelecimento_atual() IS NOT NULL
      AND tenant_id <> public.estabelecimento_atual()
  ) THEN
    RAISE EXCEPTION 'Usuário pertence a outro estabelecimento.';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = p_user_id) THEN
    RAISE EXCEPTION 'Usuário não encontrado.';
  END IF;

  UPDATE auth.users
  SET encrypted_password = crypt(p_nova_senha, gen_salt('bf')),
      updated_at = NOW(),
      recovery_token = ''
  WHERE id = p_user_id;

  RETURN jsonb_build_object('sucesso', true, 'id', p_user_id, 'mensagem', 'Senha do usuário redefinida com sucesso!');
END;
$$;
