import { supabase } from '@/lib/supabase/client'
import { registrarTenantDaMesa } from '@/lib/atendimentoStorage'

/**
 * Resolve o tenant (estabelecimento) de um cliente anônimo do pedido on-line
 * a partir do número da mesa da URL (?mesa=X ou /pedido/X), via RPC
 * `tenant_do_pedido_anonimo` (SECURITY DEFINER, executável por anon).
 *
 * O resultado é cacheado por mesa para evitar chamadas repetidas à RPC.
 * Retorna null quando a mesa é delivery/inválida (mesa 0) ou a RPC não resolver.
 */
const cachePorMesa = new Map<number, string>()
const emVoo = new Map<number, Promise<string | null>>()

export async function resolveTenantAnonimo(mesa: number): Promise<string | null> {
  if (!mesa || mesa <= 0) return null

  const emCache = cachePorMesa.get(mesa)
  if (emCache) {
    registrarTenantDaMesa(mesa, emCache)
    return emCache
  }

  const existente = emVoo.get(mesa)
  if (existente) return existente

  const promessa = (async () => {
    try {
      const { data, error } = await (supabase.rpc as any)('tenant_do_pedido_anonimo', {
        p_mesa: mesa,
      })
      if (error) {
        console.warn('tenant_do_pedido_anonimo falhou para a mesa', mesa, ':', error)
        return null
      }
      const tenantId = (typeof data === 'string' ? data : null) || null
      if (tenantId) {
        cachePorMesa.set(mesa, tenantId)
        registrarTenantDaMesa(mesa, tenantId)
      }
      return tenantId
    } catch (e) {
      console.warn('Erro ao resolver tenant anônimo da mesa', mesa, ':', e)
      return null
    } finally {
      emVoo.delete(mesa)
    }
  })()

  emVoo.set(mesa, promessa)
  return promessa
}

/**
 * Headers para SELECTs diretos anônimos do /pedido: a política RLS
 * `*_select_anon_mesa` resolve o tenant pelo header `x-mesa`. Requer
 * supabase-js >= 2.119.0 (suporte a options.headers por requisição).
 */
export function anonMesaHeaders(mesa: number | null | undefined): { 'x-mesa': string } | {} {
  return mesa && mesa > 0 ? { 'x-mesa': String(mesa) } : {}
}
