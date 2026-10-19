/**
 * Gerenciamento do atendimento ativo no aparelho do cliente (autoatendimento Rachide Bar).
 * Permite que um cliente que selecionou uma mesa ou enviou pedidos consiga reentrar
 * no próprio atendimento mesmo se sair da tela ou a mesa estiver com status 'Ocupada'.
 */

export interface AtendimentoAtivoLocal {
  mesaNumero: number
  comandaId: string
  clienteNome?: string
  abertoEm: string
  ultimoAcessoEm: string
}

const STORAGE_KEY = 'rachide_atendimento_ativo'

export const AtendimentoStorage = {
  get(): AtendimentoAtivoLocal | null {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (!raw) return null
      const parsed = JSON.parse(raw) as AtendimentoAtivoLocal
      if (parsed && typeof parsed.mesaNumero === 'number' && parsed.mesaNumero > 0) {
        return parsed
      }
      return null
    } catch {
      return null
    }
  },

  set(data: { mesaNumero: number; comandaId?: string; clienteNome?: string }): void {
    try {
      const existing = this.get()
      const mesaPadraoId = `cmd-${data.mesaNumero < 10 ? `0${data.mesaNumero}` : data.mesaNumero}`
      const comandaId = data.comandaId || existing?.comandaId || mesaPadraoId
      const agora = new Date().toISOString()

      const payload: AtendimentoAtivoLocal = {
        mesaNumero: data.mesaNumero,
        comandaId,
        clienteNome: data.clienteNome || existing?.clienteNome,
        abertoEm: existing?.mesaNumero === data.mesaNumero ? existing.abertoEm : agora,
        ultimoAcessoEm: agora,
      }

      localStorage.setItem(STORAGE_KEY, JSON.stringify(payload))
      // Mantém também retrocompatibilidade com a chave legada
      localStorage.setItem(`rachide_active_cmd_mesa_${data.mesaNumero}`, comandaId)
    } catch {
      // Ignora falhas de storage (ex: modo privado restrito)
    }
  },

  clear(): void {
    try {
      localStorage.removeItem(STORAGE_KEY)
    } catch {
      // noop
    }
  },

  /**
   * Retorna a comanda esperada para uma mesa
   */
  getComandaIdForMesa(mesaNumero: number): string {
    const existing = this.get()
    if (existing && existing.mesaNumero === mesaNumero && existing.comandaId) {
      return existing.comandaId
    }
    const legacy = localStorage.getItem(`rachide_active_cmd_mesa_${mesaNumero}`)
    if (legacy) return legacy
    return `cmd-${mesaNumero < 10 ? `0${mesaNumero}` : mesaNumero}`
  },
}
