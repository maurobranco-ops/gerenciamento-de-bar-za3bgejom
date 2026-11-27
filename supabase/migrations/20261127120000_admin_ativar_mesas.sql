-- Complemento da plataforma admin: RPCs de ativar/desativar e ajuste de mesas,
-- com verificação public.is_admin() dentro do banco (não apenas no frontend).

-- Ativa/desativa um estabelecimento (desativado some do seletor do login)
drop function if exists public.admin_ativar_desativar_estabelecimento(uuid, boolean);
create function public.admin_ativar_desativar_estabelecimento(
  p_id uuid,
  p_ativo boolean
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_nome text;
begin
  if not public.is_admin() then
    raise exception 'Acesso negado: apenas o Administrador da plataforma pode ativar/desativar estabelecimentos.';
  end if;

  select nome into v_nome from public.estabelecimentos where id = p_id;
  if v_nome is null then
    raise exception 'Estabelecimento não encontrado.';
  end if;

  update public.estabelecimentos
  set ativo = p_ativo,
      atualizado_em = now()
  where id = p_id;

  return jsonb_build_object(
    'sucesso', true,
    'id', p_id,
    'ativo', p_ativo,
    'mensagem', case when p_ativo
      then format('Estabelecimento "%s" ativado — voltou a aparecer no seletor do login.', v_nome)
      else format('Estabelecimento "%s" desativado — sumiu do seletor do login.', v_nome)
    end
  );
end;
$$;

-- Ajusta o número de mesas (cria as que faltam; nunca remove existentes com consumo)
drop function if exists public.admin_ajustar_mesas(uuid, integer);
create function public.admin_ajustar_mesas(
  p_estabelecimento_id uuid,
  p_qtd_mesas integer
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_atual integer;
  v_desejado integer;
  v_proximo integer;
begin
  if not public.is_admin() then
    raise exception 'Acesso negado: apenas o Administrador da plataforma pode ajustar mesas.';
  end if;

  if not exists (select 1 from public.estabelecimentos where id = p_estabelecimento_id) then
    raise exception 'Estabelecimento não encontrado.';
  end if;

  select count(*) into v_atual from public.mesas where tenant_id = p_estabelecimento_id;
  v_desejado := greatest(coalesce(p_qtd_mesas, v_atual), 1);

  if v_desejado > v_atual then
    v_proximo := coalesce((select max(numero) from public.mesas where tenant_id = p_estabelecimento_id), 0);
    for i in (v_atual + 1)..v_desejado loop
      v_proximo := v_proximo + 1;
      insert into public.mesas (tenant_id, numero, status, capacidade)
      values (p_estabelecimento_id, v_proximo, 'Livre', 4)
      on conflict do nothing;
    end loop;
  end if;

  return jsonb_build_object(
    'sucesso', true,
    'mesas_antes', v_atual,
    'mesas_depois', greatest(v_atual, v_desejado),
    'mensagem', format('Mesas ajustadas: %s → %s.', v_atual, greatest(v_atual, v_desejado))
  );
end;
$$;

grant execute on function public.admin_ativar_desativar_estabelecimento(uuid, boolean) to authenticated;
grant execute on function public.admin_ajustar_mesas(uuid, integer) to authenticated;
