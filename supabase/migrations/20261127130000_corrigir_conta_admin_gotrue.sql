-- ----------------------------------------------------------------------------
-- Correção da conta admin da plataforma (GoTrue "Database error querying schema")
--
-- Causa raiz confirmada no banco live: a conta admin@bareserestaurantes.com foi
-- inserida por SQL direto SEM as colunas de token, que ficaram NULL. O GoTrue
-- (Go, sql.Scan) não converte NULL para string e falha ao ler o usuário
-- (supabase/auth#1940 → "Database error querying schema" no login).
-- Os usuários que logam com sucesso têm TODAS essas colunas como '' (vazio).
--
-- O hash da senha já está correto (crypt/bf, formato $2a$06$ — igual ao dos
-- usuários do Rachide Bar) e a senha demo confere: NÃO alterar encrypted_password.
--
-- Escopo restrito à conta admin: nenhum usuário do Rachide Bar é tocado.
-- Idempotente: UPDATE com COALESCE e upsert em perfis_usuarios.
-- ----------------------------------------------------------------------------

-- 1. Alinhar as colunas de token ao padrão que o GoTrue espera ('' e não NULL)
--    e preencher email_confirmed_at / is_super_admin no padrão dos demais usuários.
update auth.users
set
  confirmation_token      = coalesce(confirmation_token, ''),
  recovery_token          = coalesce(recovery_token, ''),
  email_change_token_new  = coalesce(email_change_token_new, ''),
  email_change            = coalesce(email_change, ''),
  email_change_token_current = coalesce(email_change_token_current, ''),
  phone_change            = coalesce(phone_change, ''),
  phone_change_token      = coalesce(phone_change_token, ''),
  reauthentication_token  = coalesce(reauthentication_token, ''),
  is_super_admin          = coalesce(is_super_admin, false),
  email_confirmed_at      = coalesce(email_confirmed_at, now()),
  updated_at              = now()
where email = 'admin@bareserestaurantes.com'
  and id = '00000000-0000-0000-0000-00000000ad01'::uuid;

-- 2. Garantir EXATAMENTE UMA linha admin em perfis_usuarios, ligada ao user recriado
--    (perfil='admin', tenant_id nulo). Remove eventuais duplicatas/linhas órfãs
--    de admin que não apontem para o auth user correto.
delete from public.perfis_usuarios
where perfil = 'admin'
  and id <> '00000000-0000-0000-0000-00000000ad01'::uuid;

insert into public.perfis_usuarios (id, tenant_id, email, nome_exibicao, perfil, ativo)
values (
  '00000000-0000-0000-0000-00000000ad01'::uuid,
  null,
  'admin@bareserestaurantes.com',
  'Administrador da Plataforma',
  'admin',
  true
)
on conflict (id) do update
  set perfil = 'admin',
      tenant_id = null,
      email = 'admin@bareserestaurantes.com',
      nome_exibicao = 'Administrador da Plataforma',
      ativo = true,
      updated_at = now();
