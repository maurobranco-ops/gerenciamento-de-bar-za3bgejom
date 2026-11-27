-- ============================================================================
-- FASE 2 MULTI-TENANT — Gestão de Estabelecimentos (Gerente)
-- - Coluna endereco em estabelecimentos (+ backfill das configs existentes)
-- - PK composta em configuracoes_bar (id, tenant_id) — permite 1 config/tenant
-- - RPCs SECURITY DEFINER (validam papel Gerente):
--   * gerente_listar_estabelecimentos (com contagem de mesas/usuários)
--   * gerente_criar_estabelecimento (mesas iniciais + configurações + Pix=CNPJ)
--   * gerente_atualizar_estabelecimento (edição + ativação/desativação)
--   * gerente_vincular_usuario / gerente_desvincular_usuario
--
-- REGRA DE QUEM PODE CRIAR/MANAGEAR (documentada no relatório):
-- Não existe papel de super-admin. Qualquer Gerente autenticado pode CRIAR
-- novos estabelecimentos (a plataforma cresce a partir do gerente-piloto).
-- Editar/desativar/vincular usuários: apenas o próprio tenant do gerente
-- (estabelecimento_atual()) OU um estabelecimento criado por ele
-- (estabelecimentos.config->>'criado_por' = auth.uid()).
-- ============================================================================

alter table public.estabelecimentos
  add column if not exists endereco text;

-- Endereço inicial de cada tenant a partir das configurações existentes
update public.estabelecimentos e
set endereco = (
  select c.endereco_completo from public.configuracoes_bar c where c.tenant_id = e.id limit 1
)
where e.endereco is null;

-- ----------------------------------------------------------------------------
-- PK composta em configuracoes_bar: o id 'principal' não pode mais ser único
-- global — cada tenant tem sua própria linha de configuração.
-- ----------------------------------------------------------------------------
alter table public.configuracoes_bar
  drop constraint if exists configuracoes_bar_pkey;
alter table public.configuracoes_bar
  add constraint configuracoes_bar_pkey primary key (id, tenant_id);

-- ----------------------------------------------------------------------------
-- Listagem com contagens (SECURITY DEFINER para atravessar a RLS de mesas/
-- perfis de outros tenants — o próprio RPC valida o papel Gerente)
-- ----------------------------------------------------------------------------
create or replace function public.gerente_listar_estabelecimentos()
returns table (
  id uuid,
  nome text,
  cnpj text,
  endereco text,
  ativo boolean,
  criado_em timestamptz,
  criado_por uuid,
  qtd_mesas bigint,
  qtd_usuarios bigint
)
language sql
stable
security definer
set search_path = public
as $$
  select
    e.id,
    e.nome,
    e.cnpj,
    e.endereco,
    e.ativo,
    e.criado_em,
    nullif(e.config ->> 'criado_por', '')::uuid as criado_por,
    (select count(*) from public.mesas m where m.tenant_id = e.id) as qtd_mesas,
    (select count(*) from public.perfis_usuarios p where p.tenant_id = e.id) as qtd_usuarios
  from public.estabelecimentos e
  order by e.criado_em asc;
$$;

-- ----------------------------------------------------------------------------
-- Criação de novo estabelecimento + dados iniciais do tenant
-- ----------------------------------------------------------------------------
create or replace function public.gerente_criar_estabelecimento(
  p_nome text,
  p_cnpj text,
  p_endereco text,
  p_qtd_mesas integer default 10
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_nome text := nullif(trim(p_nome), '');
  v_cnpj text := nullif(trim(coalesce(p_cnpj, '')), '');
  v_endereco text := nullif(trim(coalesce(p_endereco, '')), '');
  v_qtd integer := greatest(coalesce(p_qtd_mesas, 10), 1);
  v_cnpj_digitos text;
  i integer;
begin
  if not public.is_gerente() then
    raise exception 'Acesso negado: apenas Gerente pode criar estabelecimentos.';
  end if;

  if v_nome is null then
    raise exception 'Informe o nome do estabelecimento.';
  end if;

  if v_cnpj is not null then
    v_cnpj_digitos := regexp_replace(v_cnpj, '\D', '', 'g');
    if char_length(v_cnpj_digitos) <> 14 then
      raise exception 'CNPJ inválido: informe os 14 dígitos.';
    end if;
  end if;

  insert into public.estabelecimentos (nome, cnpj, ativo, config, endereco)
  values (
    v_nome,
    v_cnpj,
    true,
    jsonb_build_object('criado_por', auth.uid()),
    v_endereco
  )
  returning id into v_id;

  -- Mesas iniciais: registros no banco (número, status, capacidade) — nunca lista fixa no código
  i := 1;
  while i <= v_qtd loop
    insert into public.mesas (tenant_id, numero, status, capacidade)
    values (v_id, i, 'Livre', 4);
    i := i + 1;
  end loop;

  -- Configurações do tenant (chave Pix = CNPJ informado, só os 14 dígitos)
  insert into public.configuracoes_bar (
    id, tenant_id, nome_fantasia, cnpj, endereco_completo,
    pix_chave, pix_beneficiario_nome, pix_cidade
  ) values (
    'principal',
    v_id,
    v_nome,
    v_cnpj,
    coalesce(v_endereco, ''),
    coalesce(v_cnpj_digitos, ''),
    v_nome,
    coalesce(nullif(split_part(coalesce(v_endereco, ''), '-', 3), ''), 'SAO PAULO')
  );

  return jsonb_build_object(
    'sucesso', true,
    'id', v_id,
    'qtd_mesas', v_qtd,
    'mensagem', format('Estabelecimento "%s" criado com %s mesas e configurações padrão.', v_nome, v_qtd)
  );
end;
$$;

-- ----------------------------------------------------------------------------
-- Edição e ativação/desativação
-- ----------------------------------------------------------------------------
create or replace function public.gerente_atualizar_estabelecimento(
  p_id uuid,
  p_nome text,
  p_cnpj text,
  p_endereco text,
  p_ativo boolean
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_nome text := nullif(trim(p_nome), '');
  v_cnpj text := nullif(trim(coalesce(p_cnpj, '')), '');
  v_endereco text := nullif(trim(coalesce(p_endereco, '')), '');
  v_cnpj_digitos text;
  v_tenant_atual uuid := public.estabelecimento_atual();
  v_eh_do_meu_escopo boolean;
begin
  if not public.is_gerente() then
    raise exception 'Acesso negado: apenas Gerente pode editar estabelecimentos.';
  end if;

  if v_tenant_atual is null then
    raise exception 'Contexto de estabelecimento não identificado.';
  end if;

  -- Escopo: o próprio tenant OU um estabelecimento criado por este gerente
  select (p_id = v_tenant_atual or config ->> 'criado_por' = auth.uid()::text)
  into v_eh_do_meu_escopo
  from public.estabelecimentos where id = p_id;

  if v_eh_do_meu_escopo is null then
    raise exception 'Estabelecimento não encontrado.';
  end if;

  if not v_eh_do_meu_escopo then
    raise exception 'Você só pode gerenciar o seu próprio estabelecimento ou os que você criou.';
  end if;

  if v_nome is null then
    raise exception 'Informe o nome do estabelecimento.';
  end if;

  if v_cnpj is not null then
    v_cnpj_digitos := regexp_replace(v_cnpj, '\D', '', 'g');
    if char_length(v_cnpj_digitos) <> 14 then
      raise exception 'CNPJ inválido: informe os 14 dígitos.';
    end if;
  end if;

  update public.estabelecimentos
  set nome = v_nome,
      cnpj = v_cnpj,
      endereco = v_endereco,
      ativo = coalesce(p_ativo, true),
      atualizado_em = now()
  where id = p_id;

  -- Mantém nome/CNPJ/Pix do tenant alinhados aos dados editados
  update public.configuracoes_bar
  set nome_fantasia = v_nome,
      cnpj = coalesce(v_cnpj, cnpj),
      pix_chave = case
        when v_cnpj_digitos is not null then v_cnpj_digitos
        else pix_chave
      end,
      updated_at = now()
  where tenant_id = p_id;

  return jsonb_build_object('sucesso', true, 'id', p_id, 'mensagem', 'Estabelecimento atualizado com sucesso!');
end;
$$;

-- ----------------------------------------------------------------------------
-- Vínculo de usuário existente (perfis_usuarios) a um estabelecimento
-- ----------------------------------------------------------------------------
create or replace function public.gerente_vincular_usuario(
  p_user_id uuid,
  p_estabelecimento_id uuid,
  p_perfil text,
  p_usuario_ativo boolean default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_perfil_validado text;
  v_tenant_atual uuid := public.estabelecimento_atual();
  v_eh_do_meu_escopo boolean;
  v_user_email text;
begin
  if not public.is_gerente() then
    raise exception 'Acesso negado: apenas Gerente pode vincular usuários.';
  end if;

  if v_tenant_atual is null then
    raise exception 'Contexto de estabelecimento não identificado.';
  end if;

  v_perfil_validado := lower(trim(coalesce(p_perfil, '')));
  if v_perfil_validado not in ('garcom', 'caixa', 'gerente', 'cozinha') then
    raise exception 'Perfil inválido.';
  end if;

  -- Escopo: o próprio tenant OU um estabelecimento criado por este gerente
  select (p_estabelecimento_id = v_tenant_atual or config ->> 'criado_por' = auth.uid()::text)
  into v_eh_do_meu_escopo
  from public.estabelecimentos where id = p_estabelecimento_id;

  if v_eh_do_meu_escopo is null then
    raise exception 'Estabelecimento não encontrado.';
  end if;

  if not v_eh_do_meu_escopo then
    raise exception 'Você só pode vincular usuários ao seu próprio estabelecimento ou aos que você criou.';
  end if;

  select email into v_user_email from auth.users where id = p_user_id;
  if v_user_email is null then
    raise exception 'Usuário não encontrado no Supabase Auth.';
  end if;

  -- Gerente não pode desativar/alterar a si mesmo pelo vínculo
  if p_user_id = auth.uid() then
    if v_perfil_validado <> 'gerente' or coalesce(p_usuario_ativo, true) = false then
      raise exception 'Operação bloqueada: você não pode remover o próprio acesso de Gerente.';
    end if;
  end if;

  if exists (select 1 from public.perfis_usuarios where id = p_user_id) then
    update public.perfis_usuarios
    set tenant_id = p_estabelecimento_id,
        perfil = v_perfil_validado,
        ativo = coalesce(p_usuario_ativo, true),
        updated_at = now()
    where id = p_user_id;
  else
    insert into public.perfis_usuarios (id, tenant_id, email, nome_exibicao, perfil, ativo)
    values (
      p_user_id,
      p_estabelecimento_id,
      v_user_email,
      coalesce(split_part(v_user_email, '@', 1), 'Usuário'),
      v_perfil_validado,
      coalesce(p_usuario_ativo, true)
    );
  end if;

  return jsonb_build_object(
    'sucesso', true,
    'id', p_user_id,
    'perfil', v_perfil_validado,
    'mensagem', 'Usuário vinculado ao estabelecimento com sucesso!'
  );
end;
$$;

-- ----------------------------------------------------------------------------
-- Desvínculo: usuário fica inativo (sem acesso até novo vínculo)
-- ----------------------------------------------------------------------------
create or replace function public.gerente_desvincular_usuario(p_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant_atual uuid := public.estabelecimento_atual();
  v_tenant_user uuid;
begin
  if not public.is_gerente() then
    raise exception 'Acesso negado: apenas Gerente pode desvincular usuários.';
  end if;

  if p_user_id = auth.uid() then
    raise exception 'Você não pode desvincular o seu próprio usuário.';
  end if;

  select tenant_id into v_tenant_user from public.perfis_usuarios where id = p_user_id;
  if v_tenant_user is null then
    raise exception 'Usuário não possui vínculo registrado.';
  end if;

  -- Escopo: tenant do usuário = tenant do gerente OU tenant criado por ele
  if v_tenant_user <> v_tenant_atual then
    if not exists (
      select 1 from public.estabelecimentos
      where id = v_tenant_user and config ->> 'criado_por' = auth.uid()::text
    ) then
      raise exception 'Você só pode desvincular usuários do seu próprio estabelecimento.';
    end if;
  end if;

  update public.perfis_usuarios
  set ativo = false, updated_at = now()
  where id = p_user_id;

  return jsonb_build_object('sucesso', true, 'id', p_user_id, 'mensagem', 'Usuário desvinculado (inativo).');
end;
$$;

grant execute on function public.gerente_listar_estabelecimentos() to authenticated;
grant execute on function public.gerente_criar_estabelecimento(text, text, text, integer) to authenticated;
grant execute on function public.gerente_atualizar_estabelecimento(uuid, text, text, text, boolean) to authenticated;
grant execute on function public.gerente_vincular_usuario(uuid, uuid, text, boolean) to authenticated;
grant execute on function public.gerente_desvincular_usuario(uuid) to authenticated;
