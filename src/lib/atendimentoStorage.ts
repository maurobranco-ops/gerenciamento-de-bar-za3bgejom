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
   * Lê o atendimento ativo do tenant informado. Sem tenantId, não lê nada
   * (o tenant é resolvido pela mesa via ?mesa=X antes de qualquer gravação).
   */
  get(tenantId?: string | null): AtendimentoAtivoLocal | null {
    if (!tenantId) return null
    try {
      const own = parsePayload(localStorage.getItem(atendimentoKey(tenantId)))
      if (own) return own

      // Migração one-time da chave legada (sem tenant): adota dentro do escopo
      // deste tenant; a validação ao vivo no banco descarta sessões de outro tenant.
      const legacy = parsePayload(localStorage.getItem(LEGACY_STORAGE_KEY))
      if (legacy) {
        localStorage.setItem(atendimentoKey(tenantId), JSON.stringify(legacy))
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
    try {
      const existing = this.get(tenantId)
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
    } catch {
      // Ignora falhas de storage (ex: modo privado restrito)
    }
  },

  clear(tenantId?: string | null): void {
    try {
      if (tenantId) {
        localStorage.removeItem(atendimentoKey(tenantId))
      }
      localStorage.removeItem(LEGACY_STORAGE_KEY)
    } catch {
      // noop
    }
  },

  clearComandaMesa(tenantId?: string | null, mesaNumero?: number): void {
    if (!mesaNumero) return
    try {
      if (tenantId) {
        localStorage.removeItem(cmdMesaKey(tenantId, mesaNumero))
      }
      localStorage.removeItem(legacyCmdKeyForMesa(mesaNumero))
    } catch {
      // noop
    }
  },

  /**
   * Retorna a comanda esperada para uma mesa dentro do tenant.
   * Sem tenantId ainda (resolução em curso), lê apenas a chave legada.
   */
  getComandaIdForMesa(tenantId: string | null | undefined, mesaNumero: number): string {
    try {
      if (tenantId) {
        const existing = this.get(tenantId)
        if (existing && existing.mesaNumero === mesaNumero && existing.comandaId) {
          return existing.comandaId
        }
        const perMesa = localStorage.getItem(cmdMesaKey(tenantId, mesaNumero))
        if (perMesa) return perMesa
      }
      // Compat com chave legada (sem tenant) — a comanda é validada no banco via x-mesa
      const legacy = localStorage.getItem(legacyCmdKeyForMesa(mesaNumero))
      if (legacy) return legacy
      return comandaIdPadraoDaMesa(mesaNumero)
    } catch {
      return comandaIdPadraoDaMesa(mesaNumero)
    }
  },
}
