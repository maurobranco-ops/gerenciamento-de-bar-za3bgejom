import React, { useState, useEffect } from 'react'
import {
  QrCode,
  Loader2,
  Sparkles,
  Beer,
  ArrowRight,
  ShieldAlert,
  Info,
  CheckCircle2,
  Users,
  RotateCcw,
  Receipt,
} from 'lucide-react'
import { TableRecord } from '@/types/bar'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { QRScanner } from './QRScanner'
import { AtendimentoStorage, AtendimentoAtivoLocal } from '@/lib/atendimentoStorage'
import { supabase } from '@/lib/supabase/client'

interface MesaSelectorProps {
  mesas: TableRecord[]
  loadingMesas: boolean
  onSelectMesa: (mesaNumero: number) => void
  errorBanner?: string | null
  onClearError?: () => void
  atendimentoAtivo?: AtendimentoAtivoLocal | null
  onContinuarAtendimento?: (mesaNumero: number) => void
}

export function MesaSelector({
  mesas,
  loadingMesas,
  onSelectMesa,
  errorBanner,
  onClearError,
  atendimentoAtivo: propAtendimentoAtivo,
  onContinuarAtendimento,
}: MesaSelectorProps) {
  const [showScanner, setShowScanner] = useState(false)
  const [inputNumber, setInputNumber] = useState('')
  const [localError, setLocalError] = useState<string | null>(null)
  const [activeSession, setActiveSession] = useState<AtendimentoAtivoLocal | null>(
    propAtendimentoAtivo !== undefined ? propAtendimentoAtivo : AtendimentoStorage.get(),
  )
  const [verificandoSessao, setVerificandoSessao] = useState(false)
  const [sessaoValidaNoBanco, setSessaoValidaNoBanco] = useState(false)
  const [detalhesComandaSessao, setDetalhesComandaSessao] = useState<{
    total?: number
    itensCount?: number
  } | null>(null)

  // Sincroniza se a prop mudar
  useEffect(() => {
    if (propAtendimentoAtivo !== undefined) {
      setActiveSession(propAtendimentoAtivo)
    }
  }, [propAtendimentoAtivo])

  // Verifica ao vivo no banco se a comanda/atendimento local ainda está aberto
  useEffect(() => {
    let isMounted = true

    const verificarSessaoAoVivo = async () => {
      const stored = activeSession || AtendimentoStorage.get()
      if (!stored || !stored.mesaNumero) {
        if (isMounted) {
          setSessaoValidaNoBanco(false)
          setDetalhesComandaSessao(null)
        }
        return
      }

      setVerificandoSessao(true)
      try {
        const comandaId =
          stored.comandaId ||
          `cmd-${stored.mesaNumero < 10 ? `0${stored.mesaNumero}` : stored.mesaNumero}`
        const { data: cmd, error } = await supabase
          .from('comandas')
          .select('id, mesa_numero, status, total, comanda_itens(count)')
          .eq('id', comandaId)
          .maybeSingle()

        if (!error && cmd && (cmd.status === 'Ocupada' || cmd.status === 'Aguardando Pagamento')) {
          if (isMounted) {
            setSessaoValidaNoBanco(true)
            const countItens = (cmd as any).comanda_itens?.[0]?.count || 0
            setDetalhesComandaSessao({
              total: Number(cmd.total || 0),
              itensCount: countItens,
            })
          }
        } else {
          // Se a comanda está Livre ou não existe mais, limpa a sessão local
          if (isMounted) {
            setSessaoValidaNoBanco(false)
            setDetalhesComandaSessao(null)
          }
          if (cmd && cmd.status === 'Livre') {
            AtendimentoStorage.clear()
          }
        }
      } catch (err) {
        console.warn('Erro ao verificar atendimento ativo no banco:', err)
        // Em caso de falha de rede temporária, mantém a sessão se o storage possuir
        if (isMounted && stored.mesaNumero) {
          setSessaoValidaNoBanco(true)
        }
      } finally {
        if (isMounted) {
          setVerificandoSessao(false)
        }
      }
    }

    verificarSessaoAoVivo()

    return () => {
      isMounted = false
    }
  }, [activeSession])

  // Mesas ordenadas por número
  const sortedMesas = [...mesas].sort((a, b) => a.numero - b.numero)

  // Extrai número da mesa a partir de texto lido no QR Code ou link
  const parseMesaFromQR = (raw: string): number | null => {
    try {
      const clean = raw.trim()
      // Se for apenas dígitos
      if (/^\d+$/.test(clean)) {
        return parseInt(clean, 10)
      }

      // Se for URL completa (ex: https://dominio/pedido/4 ou https://dominio/pedido?mesa=4)
      try {
        const url = new URL(clean, window.location.origin)
        const pathParts = url.pathname.split('/').filter(Boolean)
        const pedidoIdx = pathParts.indexOf('pedido')
        if (pedidoIdx !== -1 && pathParts[pedidoIdx + 1]) {
          const num = parseInt(pathParts[pedidoIdx + 1], 10)
          if (!isNaN(num) && num > 0) return num
        }
        const mesaQuery = url.searchParams.get('mesa')
        if (mesaQuery) {
          const num = parseInt(mesaQuery, 10)
          if (!isNaN(num) && num > 0) return num
        }
      } catch {
        // Não é URL válida, tentar regex no texto
      }

      // Regex para encontrar /pedido/(\d+) ou mesa\s*(\d+)
      const pathMatch = clean.match(/pedido\/(\d+)/i)
      if (pathMatch && pathMatch[1]) {
        return parseInt(pathMatch[1], 10)
      }

      const mesaMatch = clean.match(/mesa\s*[:=]?\s*(\d+)/i)
      if (mesaMatch && mesaMatch[1]) {
        return parseInt(mesaMatch[1], 10)
      }

      return null
    } catch {
      return null
    }
  }

  // Tenta selecionar mesa com validação de status
  const attemptSelect = (num: number) => {
    if (onClearError) onClearError()
    setLocalError(null)

    if (num <= 0) {
      setLocalError('Informe um número de mesa válido.')
      return
    }

    const found = mesas.find((m) => m.numero === num)

    // Checar se a mesa pertence ao próprio atendimento deste aparelho
    const stored = activeSession || AtendimentoStorage.get()
    const isMinhaMesa = stored && stored.mesaNumero === num && sessaoValidaNoBanco

    // Se a mesa estiver ocupada mas for deste mesmo aparelho, permite reentrar diretamente!
    if (isMinhaMesa) {
      if (onContinuarAtendimento) {
        onContinuarAtendimento(num)
      } else {
        onSelectMesa(num)
      }
      return
    }

    // Se as mesas já foram carregadas e encontramos a mesa no banco
    if (found) {
      if (found.status !== 'Livre') {
        const motivo =
          found.status === 'Ocupada'
            ? 'já está ocupada por outros clientes'
            : found.status === 'Aguardando Pagamento'
              ? 'está em fechamento de conta'
              : 'está fechada no momento'

        setLocalError(
          `A Mesa ${num} não está disponível (${motivo}). Por favor, escolha uma mesa livre ou chame o garçom.`,
        )
        return
      }
    } else if (mesas.length > 0) {
      // Se a lista de mesas existe e o número não foi encontrado
      setLocalError(`Mesa ${num} não foi encontrada no Rachide Bar. Verifique o número da placa.`)
      return
    }

    // Mesa livre e validada!
    onSelectMesa(num)
  }

  const handleScanResult = (scannedText: string) => {
    setShowScanner(false)
    const parsed = parseMesaFromQR(scannedText)

    if (parsed && parsed > 0) {
      attemptSelect(parsed)
    } else {
      setLocalError(`QR Code não reconhecido como mesa do bar ("${scannedText.slice(0, 40)}").`)
    }
  }

  const handleNumberSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const num = parseInt(inputNumber.trim(), 10)
    if (isNaN(num) || num <= 0) {
      setLocalError('Digite um número de mesa válido.')
      return
    }
    attemptSelect(num)
  }

  const activeError = localError || errorBanner

  return (
    <div className="min-h-screen bg-[#1C1917] text-[#F5F5F4] flex flex-col justify-between font-sans">
      {/* Header simples e acolhedor */}
      <header className="bg-[#292524] border-b border-[#44403C] px-4 py-3 shadow-md">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-500 to-amber-700 flex items-center justify-center text-[#1C1917] shadow-md shadow-amber-950/40">
              <Beer className="w-5 h-5 fill-current" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-black text-base text-stone-100">
                  Rachide <span className="text-amber-500">Bar</span>
                </span>
                <Badge
                  variant="outline"
                  className="bg-amber-500/10 text-amber-400 border-amber-500/40 text-[10px] font-bold"
                >
                  Autoatendimento
                </Badge>
              </div>
              <p className="text-[10px] text-stone-400">Cardápio Digital & Pedido Direto</p>
            </div>
          </div>

          <a
            href="/login"
            className="text-[11px] text-stone-400 hover:text-amber-400 font-semibold transition-colors"
          >
            Acesso da equipe
          </a>
        </div>
      </header>

      {/* Conteúdo Principal */}
      <main className="flex-1 max-w-2xl mx-auto w-full px-4 py-6 sm:py-8 space-y-6">
        {/* Banner de Boas-Vindas */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-bold mb-1">
            <Sparkles className="w-3.5 h-3.5" />
            Bem-vindo ao Rachide Bar
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-stone-100 tracking-tight">
            Em qual mesa você está?
          </h1>
          <p className="text-xs sm:text-sm text-stone-300 max-w-md mx-auto leading-relaxed">
            Identifique sua mesa para abrir o cardápio e enviar seus pedidos direto para o bar e
            cozinha.
          </p>
        </div>

        {/* Card de Destaque: Continuar meu atendimento (quando houver comanda aberta deste aparelho) */}
        {sessaoValidaNoBanco && activeSession && (
          <div className="p-5 sm:p-6 rounded-2xl bg-gradient-to-br from-amber-950/50 via-[#292524] to-[#342D26] border-2 border-amber-500 shadow-xl shadow-amber-950/40 space-y-3.5 animate-fade-in">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <div className="w-12 h-12 rounded-2xl bg-amber-500 text-stone-950 flex items-center justify-center shrink-0 shadow-md shadow-amber-950/40">
                  <RotateCcw className="w-6 h-6 stroke-[2.4]" />
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[11px] uppercase tracking-wider font-extrabold text-amber-400">
                      Atendimento em Aberto
                    </span>
                    <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/40 text-[10px] font-bold">
                      Mesa {activeSession.mesaNumero}
                    </Badge>
                  </div>
                  <h2 className="text-base sm:text-lg font-black text-stone-100 mt-0.5">
                    Você já tem uma comanda ativa neste aparelho
                  </h2>
                  <p className="text-xs text-stone-300 mt-1 leading-relaxed">
                    Seu consumo e pedidos continuam salvos e em andamento na{' '}
                    <strong>Mesa {activeSession.mesaNumero}</strong>. Reentre agora para ver seu
                    carrinho, status do preparo e pedir a conta.
                  </p>
                </div>
              </div>
            </div>

            {/* Informações adicionais se disponíveis */}
            {detalhesComandaSessao && (
              <div className="flex items-center justify-between p-3 rounded-xl bg-[#1C1917]/80 border border-[#44403C] text-xs">
                <div className="flex items-center gap-2 text-stone-300">
                  <Receipt className="w-4 h-4 text-amber-400" />
                  <span>Consumo da sua mesa:</span>
                </div>
                <div className="font-extrabold text-amber-400 tabular-nums text-sm">
                  R$ {(detalhesComandaSessao.total || 0).toFixed(2)}
                </div>
              </div>
            )}

            <Button
              type="button"
              onClick={() => {
                if (onContinuarAtendimento) {
                  onContinuarAtendimento(activeSession.mesaNumero)
                } else {
                  onSelectMesa(activeSession.mesaNumero)
                }
              }}
              className="w-full bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-stone-950 font-black text-sm h-12 shadow-lg shadow-amber-950/50 rounded-xl flex items-center justify-center gap-2 transition-transform active:scale-[0.99]"
            >
              <RotateCcw className="w-4 h-4" />
              <span>Continuar meu atendimento — Mesa {activeSession.mesaNumero}</span>
              <ArrowRight className="w-4 h-4 ml-1" />
            </Button>
          </div>
        )}

        {/* Alerta de erro / Mesa ocupada */}
        {activeError && (
          <div className="p-4 rounded-2xl bg-red-950/50 border-2 border-red-500/60 text-red-200 text-xs sm:text-sm flex items-start gap-3 shadow-lg shadow-red-950/30 animate-fade-in">
            <ShieldAlert className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
            <div className="space-y-1">
              <strong className="block font-bold text-red-300">Atenção</strong>
              <p className="leading-relaxed">{activeError}</p>
            </div>
          </div>
        )}

        {/* Bloco 1: Escanear QR Code da Mesa (Ação Principal) */}
        <div className="p-5 sm:p-6 rounded-2xl bg-gradient-to-br from-[#292524] to-[#342D26] border-2 border-amber-500/40 shadow-xl space-y-4">
          <div className="flex items-start gap-3">
            <div className="w-12 h-12 rounded-2xl bg-amber-500 text-stone-950 flex items-center justify-center flex-shrink-0 shadow-md shadow-amber-950/40">
              <QrCode className="w-6 h-6" />
            </div>
            <div>
              <h2 className="font-black text-base sm:text-lg text-stone-100">
                Ler QR Code da Mesa
              </h2>
              <p className="text-xs text-stone-300 mt-0.5 leading-relaxed">
                Aponte a câmera do celular para o display com QR Code localizado na sua mesa.
              </p>
            </div>
          </div>

          <Button
            type="button"
            onClick={() => {
              if (onClearError) onClearError()
              setLocalError(null)
              setShowScanner(true)
            }}
            className="w-full bg-amber-500 hover:bg-amber-600 text-stone-950 font-black text-sm h-12 shadow-lg shadow-amber-950/40 rounded-xl flex items-center justify-center gap-2 transition-all hover:scale-[1.01]"
          >
            <QrCode className="w-5 h-5" />
            <span>Abrir Câmera e Escanear QR Code</span>
          </Button>
          <div className="flex items-center justify-center gap-1.5 text-[11px] text-stone-400">
            <Info className="w-3.5 h-3.5 text-amber-400" />
            <span>A permissão de câmera só é solicitada ao clicar acima.</span>
          </div>
        </div>

        {/* Divisor "ou" */}
        <div className="relative flex items-center justify-center">
          <div className="border-t border-[#44403C] w-full" />
          <span className="bg-[#1C1917] px-3 text-xs uppercase font-bold text-stone-500 absolute tracking-wider">
            ou escolha direta pelo número
          </span>
        </div>

        {/* Bloco 2: Digitar número da mesa */}
        <div className="p-5 rounded-2xl bg-[#292524] border border-[#44403C] space-y-4 shadow-sm">
          <form onSubmit={handleNumberSubmit} className="space-y-3">
            <label className="block text-xs font-bold text-stone-300">
              Digite o número da sua mesa:
            </label>
            <div className="flex gap-2">
              <input
                type="number"
                min="1"
                max="999"
                value={inputNumber}
                onChange={(e) => {
                  setInputNumber(e.target.value)
                  if (localError) setLocalError(null)
                  if (onClearError) onClearError()
                }}
                placeholder="Ex: 4"
                className="w-full bg-[#1C1917] border border-[#44403C] rounded-xl px-4 py-3 text-lg font-black text-amber-400 text-center focus:outline-none focus:border-amber-500 tabular-nums shadow-inner"
              />
              <Button
                type="submit"
                disabled={!inputNumber.trim() || loadingMesas}
                className="bg-amber-500 hover:bg-amber-600 text-stone-950 font-black text-sm px-6 h-auto rounded-xl flex items-center justify-center gap-2"
              >
                <span>Acessar</span>
                <ArrowRight className="w-4 h-4" />
              </Button>
            </div>
          </form>

          {/* Grid de Mesas Disponíveis */}
          <div className="pt-2 border-t border-[#44403C]/60 space-y-2.5">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-stone-300">Mesas no Salão:</span>
              <div className="flex items-center gap-3 text-[11px]">
                <span className="flex items-center gap-1 text-emerald-400">
                  <span className="w-2 h-2 rounded-full bg-emerald-500" />
                  Livre (pode pedir)
                </span>
                <span className="flex items-center gap-1 text-stone-500">
                  <span className="w-2 h-2 rounded-full bg-stone-600" />
                  Ocupada (bloqueada)
                </span>
              </div>
            </div>

            {loadingMesas ? (
              <div className="py-8 text-center space-y-2">
                <Loader2 className="w-6 h-6 text-amber-500 animate-spin mx-auto" />
                <p className="text-xs text-stone-400">Consultando status das mesas...</p>
              </div>
            ) : sortedMesas.length === 0 ? (
              <p className="text-xs text-stone-400 text-center py-4">
                Nenhuma mesa cadastrada no sistema.
              </p>
            ) : (
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2.5 pt-1">
                {sortedMesas.map((mesa) => {
                  const isLivre = mesa.status === 'Livre'
                  const isMinhaMesa =
                    sessaoValidaNoBanco && activeSession && activeSession.mesaNumero === mesa.numero
                  const podeAcessar = isLivre || isMinhaMesa

                  return (
                    <button
                      key={mesa.id}
                      type="button"
                      disabled={!podeAcessar}
                      onClick={() => attemptSelect(mesa.numero)}
                      title={
                        isMinhaMesa
                          ? `Mesa ${mesa.numero} — Seu atendimento ativo! Clique para continuar.`
                          : isLivre
                            ? `Mesa ${mesa.numero} Livre - Clique para abrir o cardápio`
                            : `Mesa ${mesa.numero} (${mesa.status}) - Indisponível`
                      }
                      className={`p-3 rounded-xl border text-center transition-all flex flex-col items-center justify-between relative group ${
                        isMinhaMesa
                          ? 'bg-amber-500/20 hover:bg-amber-500 hover:border-amber-400 border-amber-500 text-amber-200 hover:text-stone-950 cursor-pointer shadow-md shadow-amber-950/40 ring-2 ring-amber-500/40 hover:scale-[1.03]'
                          : isLivre
                            ? 'bg-[#1C1917] hover:bg-amber-500 hover:border-amber-400 border-emerald-500/40 text-stone-100 hover:text-stone-950 cursor-pointer shadow-sm hover:shadow-md hover:scale-[1.03]'
                            : 'bg-stone-900/60 border-stone-800 text-stone-500 cursor-not-allowed opacity-60'
                      }`}
                    >
                      <span className="text-[10px] font-bold uppercase tracking-wider opacity-80">
                        Mesa
                      </span>
                      <span className="text-lg font-black tabular-nums my-0.5">{mesa.numero}</span>
                      <div className="flex items-center gap-1 text-[10px] font-semibold mt-0.5">
                        {isMinhaMesa ? (
                          <span className="text-amber-400 group-hover:text-stone-950 font-bold flex items-center gap-0.5">
                            <RotateCcw className="w-3 h-3" />
                            Minha Mesa
                          </span>
                        ) : isLivre ? (
                          <span className="text-emerald-400 group-hover:text-stone-950 flex items-center gap-0.5">
                            <CheckCircle2 className="w-3 h-3" />
                            Livre
                          </span>
                        ) : (
                          <span className="text-stone-500">{mesa.status}</span>
                        )}
                      </div>
                      <span className="text-[9px] text-stone-500 group-hover:text-stone-800 flex items-center gap-0.5 mt-0.5">
                        <Users className="w-2.5 h-2.5" />
                        {mesa.capacidade} lug.
                      </span>
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Footer simples */}
      <footer className="text-center py-4 text-xs text-stone-500 border-t border-[#44403C]/40">
        Rachide Bar & Petiscaria • Cardápio Digital com QR Code
      </footer>

      {/* Scanner Modal de Câmera */}
      {showScanner && <QRScanner onScan={handleScanResult} onClose={() => setShowScanner(false)} />}
    </div>
  )
}
