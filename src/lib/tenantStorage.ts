import { Estabelecimento } from '@/types/tenant'

const KEY = 'rachide_estabelecimento_ativo'

export const TenantStorage = {
  get(): Estabelecimento | null {
    if (typeof window === 'undefined') return null
    try {
      const raw = window.localStorage.getItem(KEY)
      if (!raw) return null
      return JSON.parse(raw) as Estabelecimento
    } catch {
      return null
    }
  },
  set(e: Estabelecimento) {
    if (typeof window === 'undefined') return
    try {
      window.localStorage.setItem(KEY, JSON.stringify(e))
    } catch {
      // ignore
    }
  },
  clear() {
    if (typeof window === 'undefined') return
    try {
      window.localStorage.removeItem(KEY)
    } catch {
      // ignore
    }
  },
}
