// AVOID UPDATING THIS FILE DIRECTLY. It is automatically generated.
import { createClient } from '@supabase/supabase-js'
import type { Database } from './types'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string
const SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string

// Import the supabase client like this:
// import { supabase } from "@/lib/supabase/client";

// Número da mesa do cliente anônimo (?mesa=X), injetado como header x-mesa
// em TODAS as requisições enquanto o cliente navega no /pedido. As políticas
// RLS `*_select_anon_mesa` resolvem o tenant por esse header. Logado, o valor
// fica null e nada é injetado.
let mesaAtualAnonima: number | null = null

export function setMesaAnonimaAtual(mesa: number | null): void {
  mesaAtualAnonima = mesa && mesa > 0 ? mesa : null
}

export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    storage: localStorage,
    persistSession: true,
    autoRefreshToken: true,
  },
  global: {
    headers: () =>
      mesaAtualAnonima
        ? {
            'x-mesa': String(mesaAtualAnonima),
          }
        : {},
  },
})
