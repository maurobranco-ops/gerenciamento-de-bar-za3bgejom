/**
 * Headers globais aplicados a TODAS as requisições do supabase-js via
 * `global.fetch` (disponível a partir do supabase-js 2.119.0; este projeto
 * usa 2.117.3, então envolvemos o `globalThis.fetch`).
 *
 * Aqui entra o header `x-mesa`, usado pelas políticas RLS anônimas do
 * pedido on-line (`*_select_anon_mesa`) para resolver o tenant pela mesa
 * da URL (?mesa=X ou /pedido/X).
 */
type Fetch = typeof globalThis.fetch

const HEADER_X_MESA = 'x-mesa'

let mesaAnonimaAtual: number | null = null

/** Registra a mesa anônima da sessão atual do /pedido (para o header x-mesa). */
export function setMesaAnonimaAtual(mesa: number | null): void {
  mesaAnonimaAtual = typeof mesa === 'number' && !isNaN(mesa) && mesa > 0 ? mesa : null
}

const globalHeaders = (options: { headers?: Record<string, string> } = {}) => {
  if (options.headers) {
    for (const [k, v] of Object.entries(options.headers)) {
      if (k === HEADER_X_MESA) {
        const n = parseInt(v, 10)
        setMesaAnonimaAtual(isNaN(n) ? null : n)
      }
    }
  }
}

/** Extrai o header x-mesa de um init de fetch, se presente. */
function extrairXMesa(init?: RequestInit): string | null {
  if (!init) return null
  const h = init.headers
  if (!h) return null
  try {
    if (h instanceof Headers) {
      return h.get(HEADER_X_MESA)
    }
    if (Array.isArray(h)) {
      const achado = h.find(([k]) => k.toLowerCase() === HEADER_X_MESA)
      return achado ? achado[1] : null
    }
    const rec = h as Record<string, string>
    return rec[HEADER_X_MESA] ?? null
  } catch {
    return null
  }
}

/** Instala (uma única vez) o wrapper de fetch que injeta o header x-mesa. */
export function installXMesaFetch(): void {
  const g = globalThis as { __xmesaFetchInstalled?: boolean; fetch: Fetch }
  if (g.__xmesaFetchInstalled) return
  g.__xmesaFetchInstalled = true

  const originalFetch: Fetch = g.fetch.bind(g)

  g.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
    // O header x-mesa vem por requisição (options.headers do supabase-js)
    // quando disponível; senão, usa a mesa registrada globalmente.
    const daRequisicao = extrairXMesa(init)
    const mesa = daRequisicao ? parseInt(daRequisicao, 10) : mesaAnonimaAtual

    if (mesa && mesa > 0) {
      const headers = new Headers(
        init?.headers || (input instanceof Request ? input.headers : undefined),
      )
      headers.set(HEADER_X_MESA, String(mesa))
      init = { ...(init || {}), headers }
    }
    return originalFetch(input as RequestInfo, init)
  }
}

export { globalHeaders }
