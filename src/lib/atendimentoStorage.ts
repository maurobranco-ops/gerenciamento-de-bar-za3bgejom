/**
 * Gerenciamento do atendimento ativo no aparelho do cliente (multi-tenant).
 * As chaves são por tenant: `atendimento_{tenantId}` e `active_cmd_mesa_{tenantId}_{mesa}`,
 * de modo que o atendimento salvo nunca vaza entre estabelecimentos.
 * Chaves legadas (sem tenant, herdadas do piloto) são adotadas uma única vez
 * dentro do escopo do tenant resolvido pela mesa e validadas ao vivo no banco
 * (a consulta de comandas usa o header x-mesa) — sem crash se não existirem.
 */

export interface AtendimentoAtivoLocal {
  mesaNumero: number
  comandaId: string
  clienteNome?: string
  abertoEm: string
  ultimoAcessoEm: string
}

const LEGACY_STORAGE_KEY = 'rachide_atendimento_ativo'

const legacyCmdKeyForMesa = (mesaNumero: number) => `rachide_active_cmd_mesa_${mesaNumero}`

const atendimentoKey = (tenantId: string) => `atendimento_${tenantId}`

const cmdMesaKey = (tenantId: string, mesaNumero: number) =>
  `active_cmd_mesa_${tenantId}_${mesaNumero}`

const comandaIdPadraoDaMesa = (mesaNumero: number) =>
  `cmd-${mesaNumero < 10 ? `0${mesaNumero}` : mesaNumero}`

// Tenant conhecido por mesa (preenchido na resolução anônima via RPC e nas
// gravações com tenant explícito) e tenant em uso no momento (última gravação).
const tenantPorMesa = new Map<number, string>()
const tenantAtual: { v: string | null } = { v: null }

/** Registra qual tenant pertence a uma mesa (chamado quando o tenant é resolvido). */
export function registrarTenantDaMesa(
  mesaNumero: number,
  tenantId: string | null | undefined,
): void {
  if (!mesaNumero || mesaNumero <= 0 || !tenantId) return
  tenantPorMesa.set(mesaNumero, tenantId)
}

/** Registra o tenant em uso no momento (última gravação com tenant explícito). */
export function registrarTenantAtual(tenantId: string | null | undefined): void {
  tenantAtual.v = tenantId || null
}

/**
 * Resolve o tenant para leitura/escrita: explícito > conhecido da mesa > último usado.
 * Sem tenant resolvido, NÃO lê nem grava nada — evita vazamento entre estabelecimentos.
 */
function resolveTenant(tenantId?: string | null, mesaNumero?: number): string | null {
  if (tenantId) return tenantId
  if (mesaNumero && mesaNumero > 0) {
    const daMesa = tenantPorMesa.get(mesaNumero)
    if (daMesa) return daMesa
  }
  return tenantAtual.v
}

function parsePayload(raw: string | null): AtendimentoAtivoLocal | null {
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as AtendimentoAtivoLocal
    if (parsed && typeof parsed.mesaNumero === 'number' && parsed.mesaNumero > 0) {
      return parsed
    }
    return null
  } catch {
    return null
  }
}

export const AtendimentoStorage = {
  /**
   * Lê o atendimento ativo do tenant informado. Sem tenant resolvível (explícito
   * ou pela mesa), não lê nada — o tenant é resolvido pela mesa via ?mesa=X antes.
   */
  get(tenantId?: string | null, mesaNumero?: number): AtendimentoAtivoLocal | null {
    const tenant = resolveTenant(tenantId, mesaNumero)
    if (!tenant) return null
    try {
      const own = parsePayload(localStorage.getItem(atendimentoKey(tenant)))
      if (own) {
        registrarTenantDaMesa(own.mesaNumero, tenant)
        return own
      }

      // Migração one-time da chave legada (sem tenant): adota somente se a mesa
      // conferir com o tenant resolvido; a validação ao vivo no banco (header
      // x-mesa) descarta sessões de outro tenant.
      const legacy = parsePayload(localStorage.getItem(LEGACY_STORAGE_KEY))
      if (legacy && (!mesaNumero || legacy.mesaNumero === mesaNumero)) {
        localStorage.setItem(atendimentoKey(tenant), JSON.stringify(legacy))
        return legacy
      }
      return null
    } catch {
      return null
    }
  },

  set(
    tenantId: string | null | undefined,
    data: { mesaNumero: number; comandaId?: string; clienteNome?: string },
  ): void {
    if (!tenantId) return
    registrarTenantDaMesa(data.mesaNumero, tenantId)
    registrarTenantAtual(tenantId)
    try {
      const existing = this.get(tenantId, data.mesaNumero)
      const comandaId =
        data.comandaId || existing?.comandaId || comandaIdPadraoDaMesa(data.mesaNumero)
      const agora = new Date().toISOString()

      const payload: AtendimentoAtivoLocal = {
        mesaNumero: data.mesaNumero,
        comandaId,
        clienteNome: data.clienteNome || existing?.clienteNome,
        abertoEm: existing?.mesaNumero === data.mesaNumero ? existing.abertoEm : agora,
        ultimoAcessoEm: agora,
      }

      localStorage.setItem(atendimentoKey(tenantId), JSON.stringify(payload))
      localStorage.setItem(cmdMesaKey(tenantId, data.mesaNumero), comandaId)
      // Legado (sem tenant) sai de circulação depois da migração
      localStorage.removeItem(LEGACY_STORAGE_KEY)
      localStorage.removeItem(legacyCmdKeyForMesa(data.mesaNumero))
    } catch {
      // Ignora falhas de storage (ex: modo privado restrito)
    }
  },

  clear(tenantId?: string | null, mesaNumero?: number): void {
    const tenant = resolveTenant(tenantId, mesaNumero)
    try {
      if (tenant) {
        localStorage.removeItem(atendimentoKey(tenant))
      }
      localStorage.removeItem(LEGACY_STORAGE_KEY)
      if (mesaNumero && mesaNumero > 0) {
        localStorage.removeItem(legacyCmdKeyForMesa(mesaNumero))
      }
    } catch {
      // Ignora falhas de storage
    }
  },

  getComandaIdForMesa(tenantId: string | null | undefined, mesaNumero: number): string {
    const tenant = resolveTenant(tenantId, mesaNumero)
    if (tenant) {
      try {
        const v = localStorage.getItem(cmdMesaKey(tenant, mesaNumero))
        if (v) return v
        const att = parsePayload(localStorage.getItem(atendimentoKey(tenant)))
        if (att && att.mesaNumero === mesaNumero && att.comandaId) return att.comandaId
      } catch {
        /* segue para fallback */
      }
    }
    // Fallback legado (chave sem tenant) para aparelhos que abriram antes da migração
    try {
      const legado = localStorage.getItem(legacyCmdKeyForMesa(mesaNumero))
      if (legado) return legado
    } catch {
      /* ignore */
    }
    return comandaIdPadraoDaMesa(mesaNumero)
  },
}
