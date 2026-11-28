// Cor de marca por tenant: helpers de conversão e validação.
// Regra: cada estabelecimento (tenant) traz a própria cor do banco (estabelecimentos.cor_primaria);
// nada fica fixo no código. A cor é aplicada como variáveis CSS na área logada (Layout.tsx).

export const COR_PRIMARIA_PADRAO = '#f59e0b' // âmbar — default da coluna cor_primaria

const HEX_RE = /^#[0-9a-fA-F]{6}$/

export function isHexColorValid(cor: string | null | undefined): boolean {
  return typeof cor === 'string' && HEX_RE.test(cor.trim())
}

/** Normaliza para minúsculas com '#'; devolve '' quando inválida. */
export function normalizeHexColor(cor: string | null | undefined): string {
  if (!isHexColorValid(cor)) return ''
  return (cor as string).trim().toLowerCase()
}

/** "#RRGGBB" -> "H S% L%" (para a variável CSS --primary, que espera HSL sem hsl()). */
export function hexToHslString(hex: string): { h: number; s: number; l: number } {
  const m = hex.replace('#', '')
  const r = parseInt(m.slice(0, 2), 16) / 255
  const g = parseInt(m.slice(2, 4), 16) / 255
  const b = parseInt(m.slice(4, 6), 16) / 255

  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const l = (max + min) / 2
  let h = 0
  let s = 0

  if (max !== min) {
    const d = max - min
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
    switch (max) {
      case r:
        h = (g - b) / d + (g < b ? 6 : 0)
        break
      case g:
        h = (b - r) / d + 2
        break
      default:
        h = (r - g) / d + 4
    }
    h *= 60
  }

  return { h: Math.round(h), s: Math.round(s * 100), l: Math.round(l * 100) }
}

/** Textura escura derivada da cor (para hover de botões com a cor da marca). */
export function darkenHex(hex: string, amount = 0.12): string {
  const m = hex.replace('#', '')
  const channels = [0, 2, 4].map((i) => {
    const v = parseInt(m.slice(i, i + 2), 16)
    return Math.max(0, Math.min(255, Math.round(v * (1 - amount))))
  })
  return `#${channels.map((v) => v.toString(16).padStart(2, '0')).join('')}`
}
