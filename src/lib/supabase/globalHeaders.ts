/**
 * Headers globais aplicados a TODAS as requisições do supabase-js via
 * `global.fetch` (disponível a partir do supabase-js 2.119.0; este projeto
 * usa 2.117.3, então envolvemos o `globalThis.fetch`).
 *
 * Aqui entram os headers `x-mesa` e `x-tenant`, usados pelas políticas RLS
 * anônimas do pedido on-line (`*_select_anon_mesa`) para resolver o tenant:
 * o QR novo codifica /pedido?t=<uuid>&mesa=X e ambos os headers casam a mesa
 * DENTRO do estabelecimento — impede a colisão entre tenants (erro fatal
 * "mesa do Rachide aparecia no R Burguer").
 */
type Fetch = typeof globalThis.fetch

const HEADER_X_MESA = 'x-mesa'
const HEADER_X_TENANT = 'x-tenant'

let mesaAnonimaAtual: number | null = null
let tenantAnonimoAtual: string | null = null

/** Registra a mesa anônima da sessão atual do /pedido (para o header x-mesa). */
export function setMesaAnonimaAtual(mesa: number | null): void {
  mesaAnonimaAtual = typeof mesa === 'number' && !isNaN(mesa) && mesa > 0 ? mesa : null
}

/** Registra o tenant (uuid) anônimo da sessão atual do /pedido (header x-tenant). */
export function setTenantAnonimoAtual(tenantId: string | null): void {
  tenantAnonimoAtual =
    typeof tenantId === 'string' &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(tenantId)
      ? tenantId
      : null
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

/** Extrai o valor de um header (case-insensitive) de um init de fetch, se presente. */
function extrairHeader(init: RequestInit | undefined, nome: string): string | null {
  if (!init) return null
  const h = init.headers
  if (!h) return null
  try {
    if (h instanceof Headers) {
      return h.get(nome)
    }
    if (Array.isArray(h)) {
      const achado = h.find(([k]) => k.toLowerCase() === nome)
      return achado ? achado[1] : null
    }
    const rec = h as Record<string, string>
    return rec[nome] ?? rec[nome.toLowerCase()] ?? null
  } catch {
    return null
  }
}

/** Instala (uma única vez) o wrapper de fetch que injeta x-mesa + x-tenant. */
export function installXMesaFetch(): void {
  const g = globalThis as { __xmesaFetchInstalled?: boolean; fetch: Fetch }
  if (g.__xmesaFetchInstalled) return
  g.__xmesaFetchInstalled = true

  const originalFetch: Fetch = g.fetch.bind(g)

  g.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
    // Os headers vêm por requisição (options.headers do supabase-js) quando
    // disponível; senão, usam a sessão anônima registrada globalmente.
    const daRequisicaoMesa = extrairHeader(init, HEADER_X_MESA)
    const daRequisicaoTenant = extrairHeader(init, HEADER_X_TENANT)

    const mesaRaw = daRequisicaoMesa ? parseInt(daRequisicaoMesa, 10) : mesaAnonimaAtual
    const mesa = mesaRaw && mesaRaw > 0 ? mesaRaw : null
    const tenant = daRequisicaoTenant || tenantAnonimoAtual

    if (mesa || tenant) {
      const headers = new Headers(
        init?.headers || (input instanceof Request ? input.headers : undefined),
      )
      if (mesa) {
        headers.set(HEADER_X_MESA, String(mesa))
      }
      if (tenant) {
        headers.set(HEADER_X_TENANT, tenant)
      }
      init = { ...(init || {}), headers }
    }
    return originalFetch(input as RequestInfo, init)
  }
}

export { globalHeaders }
