-- ============================================================================
-- ADMIN DA PLATAFORMA (Fase 3 — administração central)
-- - Papel 'admin' em perfis_usuarios (sem vínculo de tenant: tenant_id NULL)
-- - perfis_usuarios.tenant_id passa a aceitar NULL
-- - Função auxiliar public.is_admin()
-- - RPCs SECURITY DEFINER do admin (listar/criar/atualizar estabelecimentos,
--   vincular/desvincular usuários) com verificação de perfil admin no banco
-- - Conta demo do administrador da plataforma (o dono do sistema)
--
-- O admin da plataforma NÃO pertence a nenhum estabelecimento: vê todos os
-- tenants. Gerente continua sendo gerente de UM estabelecimento (ou dos que
-- criou), com as RPCs gerente_* existentes.
-- ============================================================================

-- tenant_id nullable: linha 'admin' não pertence a nenhum tenant
alter table public.perfis_usuarios
  alter column tenant_id drop not null;

-- Papel 'admin' passa a ser válido em perfis_usuarios
alter table public.perfis_usuarios
  drop constraint if exists perfis_usuarios_perfil_check;
alter table public.perfis_usuarios
  add constraint perfis_usuarios_perfil_check
  check (perfil in ('garcom', 'caixa', 'gerente', 'cozinha', 'admin'));

-- Auxiliar: usuário autenticado atual é admin da plataforma?
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.perfis_usuarios
    where id = auth.uid() and perfil = 'admin' and ativo
  );
$$;

grant execute on function public.is_admin() to authenticated;

-- ----------------------------------------------------------------------------
-- RPCs do ADMIN — versão plataforma das RPCs gerente_*: sem escopo de tenant,
-- sempre validando public.is_admin() dentro do banco
-- ----------------------------------------------------------------------------
drop function if exists public.admin_listar_estabelecimentos();
create function public.admin_listar_estabelecimentos()
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

drop function if exists public.admin_criar_estabelecimento(text, text, text, integer);
create function public.admin_criar_estabelecimento(
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
  if not public.is_admin() then
    raise exception 'Acesso negado: apenas o Administrador da plataforma pode criar estabelecimentos.';
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

  if exists (select 1 from public.estabelecimentos where lower(nome) = lower(v_nome)) then
    raise exception 'Já existe um estabelecimento com esse nome.';
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

  -- Mesas iniciais como registros no banco (número, status, capacidade)
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

drop function if exists public.admin_atualizar_estabelecimento(uuid, text, text, text, boolean);
create function public.admin_atualizar_estabelecimento(
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
begin
  if not public.is_admin() then
    raise exception 'Acesso negado: apenas o Administrador da plataforma pode editar estabelecimentos.';
  end if;

  if not exists (select 1 from public.estabelecimentos where id = p_id) then
    raise exception 'Estabelecimento não encontrado.';
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

-- Assinatura OUT divergente da já existente no banco (usuarios.tsx) — 42P13
drop function if exists public.admin_listar_usuarios();
create function public.admin_listar_usuarios()
returns table (
  usuario_id uuid,
  email text,
  nome_exibicao text,
  perfil text,
  ativo boolean,
  tenant_id uuid,
  tenant_nome text,
  vinculado boolean,
  last_sign_in_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    p.id as usuario_id,
    p.email,
    p.nome_exibicao,
    p.perfil,
    p.ativo,
    p.tenant_id,
    e.nome as tenant_nome,
    (p.tenant_id is not null and p.ativo) as vinculado,
    au.last_sign_in_at
  from public.perfis_usuarios p
  left join public.estabelecimentos e on e.id = p.tenant_id
  left join auth.users au on au.id = p.id
  order by p.created_at asc;
$$;

drop function if exists public.admin_vincular_usuario(uuid, uuid, text, boolean);
create function public.admin_vincular_usuario(
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
  v_user_email text;
begin
  if not public.is_admin() then
    raise exception 'Acesso negado: apenas o Administrador da plataforma pode vincular usuários.';
  end if;

  v_perfil_validado := lower(trim(coalesce(p_perfil, '')));
  if v_perfil_validado not in ('garcom', 'caixa', 'gerente', 'cozinha', 'admin') then
    raise exception 'Perfil inválido.';
  end if;

  if p_estabelecimento_id is not null
     and not exists (select 1 from public.estabelecimentos where id = p_estabelecimento_id) then
    raise exception 'Estabelecimento não encontrado.';
  end if;

  if v_perfil_validado = 'admin' and p_estabelecimento_id is not null then
    raise exception 'Usuário admin da plataforma não pode ser vinculado a um estabelecimento.';
  end if;

  select email into v_user_email from auth.users where id = p_user_id;
  if v_user_email is null then
    raise exception 'Usuário não encontrado no Supabase Auth.';
  end if;

  if p_user_id = auth.uid() then
    if v_perfil_validado <> 'admin' or coalesce(p_usuario_ativo, true) = false then
      raise exception 'Operação bloqueada: você não pode remover o próprio acesso de Administrador.';
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
    'mensagem', 'Usuário vinculado com sucesso!'
  );
end;
$$;

drop function if exists public.admin_desvincular_usuario(uuid);
create function public.admin_desvincular_usuario(p_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Acesso negado: apenas o Administrador da plataforma pode desvincular usuários.';
  end if;

  if p_user_id = auth.uid() then
    raise exception 'Você não pode desvincular o seu próprio usuário.';
  end if;

  update public.perfis_usuarios
  set ativo = false, updated_at = now()
  where id = p_user_id;

  return jsonb_build_object('sucesso', true, 'id', p_user_id, 'mensagem', 'Usuário desvinculado (inativo).');
end;
$$;

grant execute on function public.admin_listar_estabelecimentos() to authenticated;
grant execute on function public.admin_criar_estabelecimento(text, text, text, integer) to authenticated;
grant execute on function public.admin_atualizar_estabelecimento(uuid, text, text, text, boolean) to authenticated;
grant execute on function public.admin_listar_usuarios() to authenticated;
grant execute on function public.admin_vincular_usuario(uuid, uuid, text, boolean) to authenticated;
grant execute on function public.admin_desvincular_usuario(uuid) to authenticated;

-- ----------------------------------------------------------------------------
-- Conta demo do Administrador da Plataforma (dono do sistema).
-- Mesmo padrão das contas demo existentes — senha em texto puro apenas
-- porque o projeto já provisiona usuários demo assim (crypt via hook).
-- ----------------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from auth.users where email = 'admin@bareserestaurantes.com') then
    insert into auth.users (
      instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data
)
values (
  '00000000-0000-0000-0000-000000000000',
  '00000000-0000-0000-0000-00000000ad01',
  'authenticated', 'authenticated',
  'admin@bareserestaurantes.com',
  crypt('admin123', gen_salt('bf')),
  now(), now(), now(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  '{"nome_exibicao":"Administrador da Plataforma"}'::jsonb
    );
  end if;
end $$;

insert into public.perfis_usuarios (id, tenant_id, email, nome_exibicao, perfil, ativo)
values (
  '00000000-0000-0000-0000-00000000ad01',
  null,
  'admin@bareserestaurantes.com',
  'Administrador da Plataforma',
  'admin',
  true
)
on conflict (id) do update
  set perfil = 'admin', tenant_id = null, ativo = true, updated_at = now();
