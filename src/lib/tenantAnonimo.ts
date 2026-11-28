import { supabase } from '@/lib/supabase/client'
import { registrarTenantDaMesa } from '@/lib/atendimentoStorage'

/**
 * Resolve o tenant (estabelecimento) de um cliente anônimo do pedido on-line.
 *
 * Fluxo preferencial (QR novo, gerado pelo PedidosOnlineManager): a URL traz
 * `?t=<uuid do estabelecimento>&mesa=X` e a RPC `tenant_do_pedido_anonimo`
 * é chamada com { p_tenant, p_mesa } — só retorna tenant quando a mesa X
 * existe NO estabelecimento t (m.tenant_id = p_tenant AND m.numero = p_mesa),
 * o que impede colisão de número de mesa entre estabelecimentos.
 *
 * Fallback (placas antigas, sem ?t=): chama com { p_mesa } — a RPC usa o
 * p_tenant nulo e devolve null quando o número existir em mais de um tenant.
 *
 * O resultado é cacheado por par (tenant, mesa) para evitar chamadas repetidas.
 * Retorna null quando a mesa é delivery/inválida (mesa 0) ou a RPC não resolver.
 */
const cachePorPar = new Map<string, string>()
const emVoo = new Map<string, Promise<string | null>>()

export async function resolveTenantAnonimo(
  mesa: number,
  tenantUrl?: string | null,
): Promise<string | null> {
  if (!mesa || mesa <= 0) return null
  // Só aceita o parâmetro ?t= se for um UUID válido (defesa contra URL adulterada)
  const tenantParam =
    tenantUrl && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(tenantUrl)
      ? tenantUrl
      : null

  const chaveCache = `${tenantParam || ''}::${mesa}`
  const emCache = cachePorPar.get(chaveCache)
  if (emCache) {
    registrarTenantDaMesa(mesa, emCache)
    return emCache
  }

  const existente = emVoo.get(chaveCache)
  if (existente) return existente

  const promessa = (async () => {
    try {
      // QR novo: p_tenant presente → RPC casa m.tenant_id = p_tenant AND m.numero = p_mesa.
      // Placa antiga (sem ?t=): p_tenant nulo → comportamento legado da RPC.
      const args: Record<string, unknown> = tenantParam
        ? { p_tenant: tenantParam, p_mesa: mesa }
        : { p_mesa: mesa }
      const { data, error } = await (supabase.rpc as any)('tenant_do_pedido_anonimo', args)
      if (error) {
        console.warn('tenant_do_pedido_anonimo falhou para a mesa', mesa, ':', error)
        return null
      }
      const tenantId = (typeof data === 'string' ? data : null) || null
      if (tenantId) {
        cachePorPar.set(chaveCache, tenantId)
        registrarTenantDaMesa(mesa, tenantId)
      }
      return tenantId
    } catch (e) {
      console.warn('Erro ao resolver tenant anônimo da mesa', mesa, ':', e)
      return null
    } finally {
      emVoo.delete(chaveCache)
    }
  })()

  emVoo.set(chaveCache, promessa)
  return promessa
}

/**
 * Headers para SELECTs diretos anônimos do /pedido: a política RLS
 * `*_select_anon_mesa` resolve o tenant pelos headers `x-tenant` + `x-mesa`.
 */
export function anonMesaHeaders(
  mesa: number | null | undefined,
  tenantId?: string | null,
): { 'x-mesa': string; 'x-tenant': string } | { 'x-mesa': string } | {} {
  if (mesa && mesa > 0 && tenantId) {
    return { 'x-mesa': String(mesa), 'x-tenant': tenantId }
  }
  return mesa && mesa > 0 ? { 'x-mesa': String(mesa) } : {}
}
