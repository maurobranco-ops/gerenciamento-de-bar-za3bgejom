import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Users,
  Plus,
  Minus,
  Search,
  Printer,
  Bell,
  CreditCard,
  Banknote,
  QrCode,
  Smartphone,
  CheckCircle2,
  Loader2,
  MessageSquare,
  Sparkles,
  Percent,
  Clock,
  ArrowRight,
  Copy,
  AlertTriangle,
  Ban,
  Settings as SettingsIcon,
  ArrowRightLeft,
} from 'lucide-react'
import { useBar } from '../context/BarContext'
import { TableStatus, Comanda, MenuItem, PaymentMethod } from '../types/bar'
import { Button } from '../components/ui/button'
import { Badge } from '../components/ui/badge'
import { Input } from '../components/ui/input'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../components/ui/dialog'
import { Label } from '../components/ui/label'
import { Switch } from '../components/ui/switch'
import { useToast } from '../hooks/use-toast'
import { printComandaAccount } from '../lib/thermalPrinter'
import { QRCodeSVG } from '../components/QRCodeSVG'
import { generatePixBRCode, isPixConfigured } from '../lib/pix'
import { FilaComandasAguardandoPagamento } from '../components/FilaComandasAguardandoPagamento'
import { ModalRecusarAdiarConta } from '../components/ModalRecusarAdiarConta'
import { SoundEffects } from '../lib/soundEffects'

export default function Comandas() {
  const {
    role,
    comandas,
    menuItems,
    openComanda,
    addItemToComanda,
    updateComandaItemQuantity,
    toggleServiceFee,
    closeAndPayComanda,
    caixaAutorizarFecharConta,
    caixaRecusarAdiarConta,
    transferirMesa,
    fecharMesaSemConsumo,
    settings,
  } = useBar()

  const { toast } = useToast()
  const navigate = useNavigate()

  // Selected table for Comanda detail modal
  const [selectedTable, setSelectedTable] = useState<Comanda | null>(null)

  // New Comanda Modal
  const [newComandaOpen, setNewComandaOpen] = useState(false)
  const [newTableNum, setNewTableNum] = useState<number>(1)
  const [newGuestCount, setNewGuestCount] = useState<number>(2)
  const [newClientName, setNewClientName] = useState<string>('')

  // Add Item to Comanda within detail modal
  const [searchItemQuery, setSearchItemQuery] = useState('')

  // Payment Flow States
  const [paymentModalOpen, setPaymentModalOpen] = useState(false)
  const [activePayingComanda, setActivePayingComanda] = useState<Comanda | null>(null)
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<PaymentMethod>('Pix')
  const [cashAmountPaid, setCashAmountPaid] = useState<string>('')
  const [splitBillEnabled, setSplitBillEnabled] = useState(false)
  const [splitGuests, setSplitGuests] = useState<number>(2)
  const [copiedPixCode, setCopiedPixCode] = useState(false)
  const [isFinishingManual, setIsFinishingManual] = useState(false)

  // Simulation steps for non-Pix methods (TEP flow): idle -> sending_tep -> whatsapp_chat -> success
  const [paymentPhase, setPaymentPhase] = useState<
    'idle' | 'sending_tep' | 'whatsapp_chat' | 'success'
  >('idle')
  const [chatStep, setChatStep] = useState<number>(0)

  // Modal de Recusa / Adiamento com motivo
  const [comandaParaRecusar, setComandaParaRecusar] = useState<Comanda | null>(null)
  const [modalRecusarOpen, setModalRecusarOpen] = useState(false)

  // Modal de Transferência de Mesa (Garçom, Caixa e Gerente)
  const [comandaParaTransferir, setComandaParaTransferir] = useState<Comanda | null>(null)
  const [mesaDestinoSelecionada, setMesaDestinoSelecionada] = useState<number | null>(null)
  const [modalTransferirOpen, setModalTransferirOpen] = useState(false)
  const [isTransferindo, setIsTransferindo] = useState(false)
  const [isLiberandoSemConsumo, setIsLiberandoSemConsumo] = useState(false)

  // Keep selectedTable updated with context changes
  const currentComanda = selectedTable
    ? comandas.find((c) => c.tableNumber === selectedTable.tableNumber) || null
    : null

  // Filter tables visible to role (Fechada is visible mainly to Caixa/Gerente)
  // Ensure tables are ordered by tableNumber
  const visibleTables = [...comandas]
    .sort((a, b) => a.tableNumber - b.tableNumber)
    .filter((c) => {
      if (role === 'Garçom' && c.status === 'Fechada') return false
      return true
    })

  // Table status colors & labels
  const getStatusBadge = (status: TableStatus) => {
    switch (status) {
      case 'Livre':
        return (
          <Badge className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 text-xs">
            Livre
          </Badge>
        )
      case 'Ocupada':
        return (
          <Badge className="bg-amber-500/20 text-amber-400 border border-amber-500/40 text-xs">
            Ocupada
          </Badge>
        )
      case 'Aguardando Pagamento':
        return (
          <Badge className="bg-purple-500/20 text-purple-400 border border-purple-500/40 text-xs">
            Aguardando Pagamento
          </Badge>
        )
      case 'Fechada':
        return (
          <Badge className="bg-red-500/20 text-red-400 border border-red-500/40 text-xs">
            Fechada
          </Badge>
        )
    }
  }

  const getTableCircleClass = (status: TableStatus) => {
    switch (status) {
      case 'Livre':
        return 'border-emerald-500/60 bg-emerald-950/20 text-emerald-400 hover:border-emerald-400 hover:scale-105'
      case 'Ocupada':
        return 'border-amber-500/80 bg-amber-950/25 text-amber-400 hover:border-amber-400 hover:scale-105 shadow-md shadow-amber-950/30'
      case 'Aguardando Pagamento':
        return 'border-purple-500/80 bg-purple-950/25 text-purple-400 hover:border-purple-400 hover:scale-105 shadow-md shadow-purple-950/30'
      case 'Fechada':
        return 'border-red-500/80 bg-red-950/25 text-red-400 hover:border-red-400'
    }
  }

  const handleTableClick = (comanda: Comanda) => {
    if (comanda.status === 'Livre') {
      setNewTableNum(comanda.tableNumber)
      setNewGuestCount(2)
      setNewClientName('')
      setNewComandaOpen(true)
    } else {
      setSelectedTable(comanda)
    }
  }

  const handleConfirmNewComanda = (e: React.FormEvent) => {
    e.preventDefault()
    openComanda(newTableNum, newGuestCount, newClientName)
    setNewComandaOpen(false)
    const opened = comandas.find((c) => c.tableNumber === newTableNum)
    if (opened) {
      setSelectedTable(opened)
    }
  }

  // Calculate Comanda totals usando taxa de serviço dinâmica configurada no banco (settings)
  const taxaPercentual = settings?.taxaServicoPadrao ?? 10

  const computeSubtotal = (cmd: Comanda | null) => {
    if (!cmd) return 0
    return cmd.items.reduce((sum, item) => sum + item.price * item.quantity, 0)
  }

  const computeServiceFee = (cmd: Comanda | null) => {
    if (!cmd || !cmd.includeServiceFee) return 0
    return computeSubtotal(cmd) * (taxaPercentual / 100)
  }

  const computeTotal = (cmd: Comanda | null) => {
    if (!cmd) return 0
    return computeSubtotal(cmd) + computeServiceFee(cmd)
  }

  // Filter items in modal search
  const filteredMenuItems = searchItemQuery.trim()
    ? menuItems.filter(
        (i) =>
          i.name.toLowerCase().includes(searchItemQuery.toLowerCase()) ||
          i.category.toLowerCase().includes(searchItemQuery.toLowerCase()),
      )
    : menuItems.slice(0, 6)

  // Start Payment Flow
  const handleOpenPaymentFlow = () => {
    if (!currentComanda || currentComanda.items.length === 0) {
      toast({
        variant: 'destructive',
        title: 'Comanda vazia',
        description: 'Adicione pelo menos um item antes de enviar para pagamento.',
      })
      return
    }
    setActivePayingComanda(currentComanda)
    setSelectedTable(null)
    setPaymentPhase('idle')
    setChatStep(0)
    setSplitBillEnabled(false)
    setSplitGuests(currentComanda.guestCount > 1 ? currentComanda.guestCount : 2)
    setCopiedPixCode(false)
    setIsFinishingManual(false)
    const total = computeTotal(currentComanda)
    setCashAmountPaid(Math.ceil(total).toFixed(2))
    setPaymentModalOpen(true)
  }

  // Copiar código Pix Copia e Cola
  const handleCopyPixCode = async (pixCode: string) => {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(pixCode)
      } else {
        const textArea = document.createElement('textarea')
        textArea.value = pixCode
        textArea.style.position = 'fixed'
        textArea.style.opacity = '0'
        document.body.appendChild(textArea)
        textArea.focus()
        textArea.select()
        document.execCommand('copy')
        document.body.removeChild(textArea)
      }
      setCopiedPixCode(true)
      toast({
        title: 'Código Pix copiado!',
        description: 'Cole no aplicativo do seu banco para pagar.',
      })
      setTimeout(() => setCopiedPixCode(false), 2500)
    } catch (err) {
      console.error('Erro ao copiar código Pix:', err)
      toast({
        variant: 'destructive',
        title: 'Não foi possível copiar',
        description: 'Selecione o texto manualmente para copiar.',
      })
    }
  }

  // Mesas aguardando pagamento com solicitação ativa do cliente
  const comandasAguardandoPagamento = visibleTables.filter(
    (c) => c.status === 'Aguardando Pagamento' || c.contaSolicitada,
  )

  // Abrir modal de pagamento direto com a forma pré-selecionada pelo cliente
  const handleAtenderComandaAguardando = (cmd: Comanda) => {
    setActivePayingComanda(cmd)
    setSelectedTable(null)
    setPaymentPhase('idle')
    setChatStep(0)
    setSplitBillEnabled(false)
    setSplitGuests(cmd.guestCount > 1 ? cmd.guestCount : 2)
    setCopiedPixCode(false)
    setIsFinishingManual(false)
    const forma = cmd.formaPagamentoSolicitada || 'Pix'
    setSelectedPaymentMethod(forma)
    const total = computeTotal(cmd)
    setCashAmountPaid(Math.ceil(total).toFixed(2))

    // Se for Pix, já avisa o cliente que está em processamento Pix
    if (forma === 'Pix') {
      caixaAutorizarFecharConta({
        mesaNumero: cmd.tableNumber,
        formaPagamento: 'Pix',
        valorPago: total,
        marcarEmProcessamentoPix: true,
      }).catch(() => {})
    }

    setPaymentModalOpen(true)
  }

  const handleAbrirRecusa = (cmd: Comanda) => {
    setComandaParaRecusar(cmd)
    setModalRecusarOpen(true)
  }

  // Abrir modal de transferência de mesa
  // Fechar mesa aberta sem consumo (Garçom, Caixa e Gerente)
  const handleFecharMesaSemConsumo = async (cmd: Comanda) => {
    if (!cmd) return

    if (cmd.items && cmd.items.length > 0) {
      toast({
        variant: 'destructive',
        title: 'Mesa possui consumo lançado',
        description: `Esta mesa possui ${cmd.items.length} produto(s). Use o fluxo de pagamento para encerrar.`,
      })
      return
    }

    const confirmou = window.confirm(
      `Deseja realmente fechar e liberar a Mesa ${cmd.tableNumber} sem consumo? A mesa voltará ao status Livre.`,
    )
    if (!confirmou) return

    setIsLiberandoSemConsumo(true)
    try {
      const ok = await fecharMesaSemConsumo(cmd.tableNumber)
      if (ok) {
        setSelectedTable(null)
      }
    } finally {
      setIsLiberandoSemConsumo(false)
    }
  }

  // Abrir modal de transferência de mesa
  const handleAbrirTransferencia = (cmd: Comanda) => {
    setComandaParaTransferir(cmd)
    // Procurar primeira mesa livre disponível para pré-seleção
    const primeiraLivre = comandas.find(
      (c) => c.status === 'Livre' && c.tableNumber !== cmd.tableNumber,
    )
    setMesaDestinoSelecionada(primeiraLivre ? primeiraLivre.tableNumber : null)
    setModalTransferirOpen(true)
  }

  const handleConfirmarTransferencia = async () => {
    if (!comandaParaTransferir || !mesaDestinoSelecionada) return

    setIsTransferindo(true)
    try {
      const ok = await transferirMesa(comandaParaTransferir.tableNumber, mesaDestinoSelecionada)
      if (ok) {
        setModalTransferirOpen(false)
        setComandaParaTransferir(null)
        setMesaDestinoSelecionada(null)
        setSelectedTable(null)
      }
    } finally {
      setIsTransferindo(false)
    }
  }

  // Confirmação manual de pagamento (Caixa/Gerente confere recebimento na conta do bar)
  const handleManualConfirmPix = async () => {
    if (!activePayingComanda) return
    const total = computeTotal(activePayingComanda)

    setIsFinishingManual(true)
    try {
      const ok = await caixaAutorizarFecharConta({
        mesaNumero: activePayingComanda.tableNumber,
        formaPagamento: 'Pix',
        valorPago: total,
      })

      if (ok) {
        setPaymentModalOpen(false)
        setActivePayingComanda(null)
        navigate('/fluxo-caixa')
      }
    } finally {
      setIsFinishingManual(false)
    }
  }

  // Execute Simulated Payment for TEP/Cartão
  const handleConfirmPayment = async () => {
    if (!activePayingComanda) return

    // Dinheiro finaliza imediatamente sem simulação de maquininha
    if (selectedPaymentMethod === 'Dinheiro') {
      const total = computeTotal(activePayingComanda)
      const ok = await caixaAutorizarFecharConta({
        mesaNumero: activePayingComanda.tableNumber,
        formaPagamento: 'Dinheiro',
        valorPago: total,
      })
      if (ok) {
        setPaymentModalOpen(false)
        setActivePayingComanda(null)
        navigate('/fluxo-caixa')
      }
      return
    }

    // Trigger step 1: sending_tep
    setPaymentPhase('sending_tep')

    // After 2 seconds, transition to whatsapp_chat
    setTimeout(() => {
      setPaymentPhase('whatsapp_chat')
      setChatStep(1) // first bubble: Rachide Bar sent payment request

      // After 2 more seconds, show approved bubble
      setTimeout(() => {
        setChatStep(2) // second bubble: approved!
      }, 2000)
    }, 2000)
  }

  const handleFinishPaymentSuccess = async () => {
    if (!activePayingComanda) return
    const total = computeTotal(activePayingComanda)

    const ok = await caixaAutorizarFecharConta({
      mesaNumero: activePayingComanda.tableNumber,
      formaPagamento: selectedPaymentMethod,
      valorPago: total,
    })

    if (ok) {
      setPaymentModalOpen(false)
      setPaymentPhase('idle')
      setActivePayingComanda(null)
      navigate('/fluxo-caixa')
    }
  }

  return (
    <div className="space-y-6 animate-fade-in-up">
      {/* Fila de Comandas Aguardando Pagamento (Solicitações do On-line com som e notificação) */}
      {(role === 'Caixa' || role === 'Gerente') && (
        <FilaComandasAguardandoPagamento
          comandasAguardando={comandasAguardandoPagamento}
          onAtender={handleAtenderComandaAguardando}
          onRecusarAdiar={handleAbrirRecusa}
        />
      )}

      {/* Top Bar with Filter & Status Legend */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-5 rounded-2xl bg-[#292524] border border-[#44403C]">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-black text-stone-100 flex items-center gap-2">
              Salão & Comandas
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-stone-800 text-stone-300 font-semibold border border-stone-700">
                {visibleTables.length} Mesas no Salão
              </span>
            </h2>
            {role === 'Gerente' && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => navigate('/mesas-config')}
                className="bg-[#1C1917] hover:bg-[#44403C] border-[#44403C] text-amber-400 text-xs font-semibold h-7"
              >
                Configurar Mesas
              </Button>
            )}
            <Button
              size="sm"
              variant="outline"
              onClick={() => navigate('/fila-cozinha')}
              className="bg-[#1C1917] hover:bg-[#44403C] border-[#44403C] text-stone-200 text-xs font-semibold h-7"
            >
              Fila de Cozinha
            </Button>
          </div>
          <p className="text-xs text-stone-400 mt-1">
            Clique em uma mesa livre para abrir uma comanda ou em uma ocupada para lançar pedidos e
            fechar conta.
          </p>
        </div>
        {/* Legend */}
        <div className="flex flex-wrap items-center gap-3 text-xs">
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-emerald-500" />
            <span className="text-stone-300">Livre</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-amber-500" />
            <span className="text-stone-300">Ocupada</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-purple-500" />
            <span className="text-stone-300">Aguardando Pagamento</span>
          </div>
          {role !== 'Garçom' && (
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full bg-red-500" />
              <span className="text-stone-300">Fechada</span>
            </div>
          )}
        </div>
      </div>

      {/* Modal para Recusar / Adiar Fechamento */}
      <ModalRecusarAdiarConta
        comanda={comandaParaRecusar}
        open={modalRecusarOpen}
        onClose={() => {
          setModalRecusarOpen(false)
          setComandaParaRecusar(null)
        }}
        onConfirm={async (mesaNumero, motivo) => {
          return await caixaRecusarAdiarConta(mesaNumero, motivo)
        }}
      />

      {/* Modal para Transferência de Mesa (Garçom, Caixa e Gerente) */}
      <Dialog
        open={modalTransferirOpen}
        onOpenChange={(open) => {
          if (!open) {
            setModalTransferirOpen(false)
            setComandaParaTransferir(null)
            setMesaDestinoSelecionada(null)
          }
        }}
      >
        <DialogContent className="w-[calc(100%-1rem)] sm:max-w-md bg-[#292524] border-[#44403C] text-stone-100 p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle className="text-base sm:text-lg font-black text-stone-100 flex items-center gap-2">
              <ArrowRightLeft className="w-5 h-5 text-amber-400" />
              <span>Transferir Atendimento de Mesa</span>
            </DialogTitle>
          </DialogHeader>

          {comandaParaTransferir && (
            <div className="space-y-4 pt-2 text-xs sm:text-sm">
              <div className="p-3.5 rounded-xl bg-[#1C1917] border border-[#44403C] space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-stone-400">Mesa Atual (Origem):</span>
                  <span className="font-extrabold text-amber-400 text-sm">
                    Mesa {comandaParaTransferir.tableNumber}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-stone-400">Cliente / Comanda:</span>
                  <span className="font-semibold text-stone-200">
                    {comandaParaTransferir.clientName || 'Cliente'} (
                    {comandaParaTransferir.items.length} itens)
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-stone-400">Total Acumulado:</span>
                  <span className="font-bold text-amber-400">
                    R$ {computeTotal(comandaParaTransferir).toFixed(2)}
                  </span>
                </div>
                {comandaParaTransferir.contaSolicitada && (
                  <div className="pt-1 text-[11px] text-purple-300 font-semibold flex items-center gap-1">
                    <Clock className="w-3 h-3 text-purple-400" />
                    Conta solicitada via {comandaParaTransferir.formaPagamentoSolicitada ||
                      'Pix'}{' '}
                    (o status acompanhará a nova mesa)
                  </div>
                )}
              </div>

              <div>
                <Label className="text-xs text-stone-300 font-semibold mb-2 block">
                  Selecione a Nova Mesa de Destino (Livre):
                </Label>
                {comandas.filter(
                  (c) =>
                    c.status === 'Livre' && c.tableNumber !== comandaParaTransferir.tableNumber,
                ).length === 0 ? (
                  <div className="p-4 rounded-xl bg-red-950/30 border border-red-500/40 text-red-300 text-xs text-center">
                    Não há mesas Livres disponíveis no momento para receber a transferência. Libere
                    uma mesa antes.
                  </div>
                ) : (
                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 max-h-48 overflow-y-auto p-1">
                    {comandas
                      .filter(
                        (c) =>
                          c.status === 'Livre' &&
                          c.tableNumber !== comandaParaTransferir.tableNumber,
                      )
                      .sort((a, b) => a.tableNumber - b.tableNumber)
                      .map((c) => {
                        const isSelected = mesaDestinoSelecionada === c.tableNumber
                        return (
                          <button
                            key={c.tableNumber}
                            type="button"
                            onClick={() => setMesaDestinoSelecionada(c.tableNumber)}
                            className={`p-3 rounded-xl border flex flex-col items-center justify-center transition-all ${
                              isSelected
                                ? 'bg-amber-500/20 border-amber-500 text-amber-300 font-black shadow-md ring-1 ring-amber-500'
                                : 'bg-[#1C1917] border-[#44403C] text-stone-300 hover:border-stone-500'
                            }`}
                          >
                            <span className="text-xs font-bold">Mesa</span>
                            <span className="text-base font-black">{c.tableNumber}</span>
                          </button>
                        )
                      })}
                  </div>
                )}
              </div>

              <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-[11px] text-amber-200/90 space-y-1">
                <p className="font-bold flex items-center gap-1.5 text-amber-400">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Regras da Transferência
                </p>
                <p>
                  • A comanda com todos os itens, valores e fila de fechamento é movida
                  integralmente para a nova mesa.
                </p>
                <p>
                  • A Mesa {comandaParaTransferir.tableNumber} é desvinculada, limpa e fica
                  imediatamente Livre no salão.
                </p>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#44403C]">
                <Button
                  type="button"
                  variant="ghost"
                  disabled={isTransferindo}
                  onClick={() => {
                    setModalTransferirOpen(false)
                    setComandaParaTransferir(null)
                    setMesaDestinoSelecionada(null)
                  }}
                  className="text-stone-400 hover:text-stone-200 text-xs"
                >
                  Cancelar
                </Button>
                <Button
                  type="button"
                  disabled={!mesaDestinoSelecionada || isTransferindo}
                  onClick={handleConfirmarTransferencia}
                  className="bg-amber-500 hover:bg-amber-600 text-stone-950 font-bold text-xs h-9 px-4"
                >
                  {isTransferindo
                    ? 'Transferindo...'
                    : `Confirmar Transferência para Mesa ${mesaDestinoSelecionada || ''}`}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Visual Table Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 sm:gap-5 pb-6">
        {visibleTables.map((cmd) => {
          const totalWithService = computeTotal(cmd)

          return (
            <div
              key={cmd.tableNumber}
              onClick={() => handleTableClick(cmd)}
              className={`p-3.5 sm:p-5 rounded-2xl border-2 cursor-pointer transition-all duration-200 flex flex-col items-center justify-between text-center min-h-[170px] sm:min-h-[190px] select-none ${getTableCircleClass(
                cmd.status,
              )}`}
            >
              {/* Circle table representation */}
              <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-full border-2 border-current flex items-center justify-center font-black text-xl sm:text-2xl shadow-inner mb-1.5 sm:mb-2 bg-[#1C1917]/50">
                {cmd.tableNumber}
              </div>
              <div className="w-full px-1">
                <div className="font-extrabold text-xs sm:text-sm text-amber-400 truncate w-full">
                  Mesa {cmd.tableNumber}
                </div>
                {cmd.status !== 'Livre' ? (
                  <div className="space-y-0.5 mt-0.5">
                    <div
                      className="font-semibold text-xs text-stone-100 truncate w-full"
                      title={cmd.clientName || 'Consumidor'}
                    >
                      {cmd.clientName || 'Consumidor'}
                    </div>
                    <div className="flex items-center justify-center gap-1 text-[10px] sm:text-[11px] text-stone-400">
                      <Users className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                      <span>{cmd.guestCount} pess.</span>
                    </div>
                  </div>
                ) : (
                  cmd.capacity && (
                    <div className="flex items-center justify-center gap-1 text-[10px] sm:text-[11px] text-stone-500 mt-0.5">
                      <Users className="w-3 h-3" />
                      <span>{cmd.capacity} lug.</span>
                    </div>
                  )
                )}
              </div>{' '}
              <div className="mt-1.5 sm:mt-2 w-full pt-1.5 sm:pt-2 border-t border-current/20">
                {cmd.status === 'Livre' ? (
                  <span className="text-xs font-semibold text-emerald-400 flex items-center justify-center gap-1">
                    <Plus className="w-3.5 h-3.5" /> Abrir Mesa
                  </span>
                ) : (
                  <div className="text-xs font-extrabold tabular-nums text-stone-100">
                    R$ {totalWithService.toFixed(2)}
                    <span className="block text-[10px] text-stone-400 font-normal">
                      {cmd.items.reduce((acc, i) => acc + i.quantity, 0)} itens
                    </span>
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Modal: Nova Comanda */}
      <Dialog open={newComandaOpen} onOpenChange={setNewComandaOpen}>
        <DialogContent className="max-w-md bg-[#292524] border-[#44403C] text-stone-100">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-stone-100 flex items-center gap-2">
              <Plus className="w-5 h-5 text-amber-500" />
              Abrir Comanda — Mesa {newTableNum}
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleConfirmNewComanda} className="space-y-4 pt-2">
            <div>
              <Label className="text-xs text-stone-400">
                Nome do Cliente / Identificação (Opcional)
              </Label>
              <Input
                value={newClientName}
                onChange={(e) => setNewClientName(e.target.value)}
                placeholder="Ex: Aniversário da Fernanda, Mesa 4..."
                className="mt-1 bg-[#1C1917] border-[#44403C] text-stone-100 text-sm"
              />
            </div>

            <div>
              <Label className="text-xs text-stone-400">Número de Pessoas</Label>
              <div className="flex items-center gap-3 mt-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setNewGuestCount(Math.max(1, newGuestCount - 1))}
                  className="bg-[#1C1917] border-[#44403C] text-stone-200 h-9 w-9 p-0"
                >
                  -
                </Button>
                <span className="font-extrabold text-xl tabular-nums w-12 text-center text-stone-100">
                  {newGuestCount}
                </span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setNewGuestCount(newGuestCount + 1)}
                  className="bg-[#1C1917] border-[#44403C] text-stone-200 h-9 w-9 p-0"
                >
                  +
                </Button>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setNewComandaOpen(false)}
                className="text-stone-400 text-xs"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                className="bg-amber-500 hover:bg-amber-600 text-stone-950 font-bold text-xs"
              >
                Confirmar Abertura
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Modal: Detalhes da Comanda Aberta */}
      {currentComanda && (
        <Dialog open={!!selectedTable} onOpenChange={(open) => !open && setSelectedTable(null)}>
          <DialogContent className="w-[calc(100%-1rem)] sm:max-w-2xl bg-[#292524] border-[#44403C] text-stone-100 p-4 sm:p-6 max-h-[92dvh] overflow-y-auto pb-24 sm:pb-8">
            <DialogHeader className="border-b border-[#44403C] pb-3 sm:pb-4 pr-6 sm:pr-0">
              <div className="flex items-center justify-between">
                <div>
                  <DialogTitle className="text-lg sm:text-xl font-black text-stone-100 flex items-center gap-2 flex-wrap">
                    <span>Mesa {currentComanda.tableNumber}</span>
                    {getStatusBadge(currentComanda.status)}
                    {currentComanda.contaSolicitada && (
                      <Badge className="bg-purple-500 text-stone-950 font-black text-xs">
                        Conta Solicitada ({currentComanda.formaPagamentoSolicitada || 'Pix'})
                      </Badge>
                    )}
                  </DialogTitle>
                  <p className="text-xs text-stone-400 mt-1 flex flex-wrap items-center gap-1.5 sm:gap-2">
                    <span className="font-medium text-stone-300">
                      Cliente: {currentComanda.clientName || 'Consumidor'}
                    </span>
                    <span>•</span>
                    <span className="flex items-center gap-1">
                      <Users className="w-3.5 h-3.5" />
                      {currentComanda.guestCount} pessoas
                    </span>
                    {currentComanda.openedAt && (
                      <>
                        <span>•</span>
                        <span className="flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5" />
                          Aberta às {currentComanda.openedAt.substring(11, 16)}
                        </span>
                      </>
                    )}
                  </p>
                </div>
              </div>
            </DialogHeader>

            {/* Items List in Comanda */}
            <div className="space-y-4 my-2 sm:my-3">
              <div className="flex items-center justify-between text-xs font-semibold text-stone-400 uppercase tracking-wider">
                <span>Itens Consumidos</span>
                <span className="text-amber-400 font-bold">
                  {currentComanda.items.length} produto(s)
                </span>
              </div>

              {currentComanda.items.length === 0 ? (
                <div className="py-8 text-center text-stone-400 text-xs border border-dashed border-[#44403C] rounded-xl">
                  Nenhum item lançado ainda. Busque e adicione produtos abaixo.
                </div>
              ) : (
                <div className="space-y-2.5">
                  {currentComanda.items.map((item) => (
                    <div
                      key={item.id}
                      className="p-3 sm:p-3.5 rounded-xl bg-[#1C1917] border border-[#44403C] flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 hover:border-amber-500/30 transition-colors"
                    >
                      {/* Linha superior (ou coluna esquerda): nome, badges, preço unitário e obs */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-bold text-sm text-stone-100 break-words leading-tight">
                            {item.name}
                          </span>
                          {item.origemOnline && (
                            <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/40 text-[10px] font-bold">
                              Pedido On-line
                            </Badge>
                          )}
                        </div>
                        <div className="text-xs text-stone-400 tabular-nums mt-0.5">
                          R$ {item.price.toFixed(2)} cada
                        </div>
                        {item.observations && (
                          <div className="text-[11px] text-amber-400/90 italic mt-1 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20 inline-block">
                            Obs: {item.observations}
                          </div>
                        )}
                      </div>

                      {/* Linha inferior no mobile: Stepper de quantidade e subtotal do produto */}
                      <div className="flex items-center justify-between sm:justify-end gap-3 pt-2 sm:pt-0 border-t sm:border-t-0 border-[#292524]">
                        {/* Stepper +/- */}
                        <div className="flex items-center gap-1.5 bg-[#292524] p-0.5 rounded-lg border border-[#44403C]">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() =>
                              updateComandaItemQuantity(currentComanda.tableNumber, item.id, -1)
                            }
                            className="h-8 w-8 p-0 text-stone-300 hover:text-white hover:bg-[#44403C]"
                            aria-label={`Diminuir quantidade de ${item.name}`}
                          >
                            <Minus className="w-3.5 h-3.5" />
                          </Button>
                          <span className="font-extrabold text-sm tabular-nums min-w-[24px] text-center text-stone-100">
                            {item.quantity}
                          </span>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() =>
                              updateComandaItemQuantity(currentComanda.tableNumber, item.id, 1)
                            }
                            className="h-8 w-8 p-0 text-stone-300 hover:text-white hover:bg-[#44403C]"
                            aria-label={`Aumentar quantidade de ${item.name}`}
                          >
                            <Plus className="w-3.5 h-3.5" />
                          </Button>
                        </div>

                        {/* Valor total do item */}
                        <div className="text-right font-black text-amber-400 tabular-nums text-sm sm:w-24">
                          R$ {(item.price * item.quantity).toFixed(2)}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Add Item Quick Search */}
              <div className="p-3 sm:p-4 rounded-xl bg-[#1C1917]/70 border border-[#44403C] space-y-2.5">
                <div className="text-xs font-semibold text-stone-300 flex items-center gap-1.5">
                  <Search className="w-3.5 h-3.5 text-amber-500" />
                  <span>Adicionar Item do Cardápio à Mesa</span>
                </div>
                <Input
                  value={searchItemQuery}
                  onChange={(e) => setSearchItemQuery(e.target.value)}
                  placeholder="Pesquisar por Heineken, bolinho, gin..."
                  className="bg-[#292524] border-[#44403C] text-xs text-stone-100 h-9"
                />

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 pt-1 max-h-48 overflow-y-auto">
                  {filteredMenuItems.map((prod) => (
                    <button
                      key={prod.id}
                      type="button"
                      disabled={prod.stock <= 0}
                      onClick={() => addItemToComanda(currentComanda.tableNumber, prod, 1)}
                      className="p-2.5 rounded-lg bg-[#292524] hover:bg-[#44403C] border border-[#44403C] hover:border-amber-500/50 text-left transition-colors flex flex-col justify-between disabled:opacity-40 disabled:cursor-not-allowed group"
                    >
                      <span className="font-semibold text-xs text-stone-200 line-clamp-1 group-hover:text-amber-400">
                        {prod.name}
                      </span>
                      <div className="flex items-center justify-between mt-1.5 text-[11px]">
                        <span className="text-amber-500 font-bold tabular-nums">
                          R$ {prod.price.toFixed(2)}
                        </span>
                        <span className="text-[10px] text-stone-400 font-medium">
                          {prod.stock} {prod.unit}
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Banner de Solicitação de Conta On-line se ativo nesta comanda */}
              {currentComanda.contaSolicitada && (
                <div className="p-3.5 rounded-xl bg-purple-950/40 border border-purple-500/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-purple-500/20 text-purple-300 flex items-center justify-center shrink-0">
                      <Clock className="w-4 h-4" />
                    </div>
                    <div>
                      <span className="font-extrabold text-stone-100">
                        Cliente solicitou a conta pelo celular
                      </span>
                      <p className="text-[11px] text-stone-300">
                        Forma escolhida:{' '}
                        <strong className="text-purple-300">
                          {currentComanda.formaPagamentoSolicitada || 'Pix'}
                        </strong>
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setSelectedTable(null)
                        handleAbrirRecusa(currentComanda)
                      }}
                      className="bg-[#1C1917] border-[#44403C] hover:border-red-500/40 text-stone-300 hover:text-red-400 text-xs h-8"
                    >
                      Adiar / Recusar
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => {
                        setSelectedTable(null)
                        handleAtenderComandaAguardando(currentComanda)
                      }}
                      className="bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs h-8"
                    >
                      Atender Agora
                    </Button>
                  </div>
                </div>
              )}

              {/* Subtotal & 10% Toggle */}
              <div className="p-3.5 sm:p-4 rounded-xl bg-[#1C1917] border border-[#44403C] space-y-2.5">
                <div className="flex items-center justify-between text-xs text-stone-300">
                  <span>Subtotal do Consumo:</span>
                  <span className="font-bold tabular-nums text-sm text-stone-200">
                    R$ {computeSubtotal(currentComanda).toFixed(2)}
                  </span>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-[#44403C]/70">
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={!!currentComanda.includeServiceFee}
                      onCheckedChange={() => toggleServiceFee(currentComanda.tableNumber)}
                      className="data-[state=checked]:bg-emerald-500"
                    />
                    <Label className="text-xs text-stone-300 cursor-pointer">
                      Incluir {taxaPercentual}% de Serviço (Garçom)
                    </Label>
                  </div>
                  <span className="font-bold tabular-nums text-xs text-emerald-400">
                    + R$ {computeServiceFee(currentComanda).toFixed(2)}
                  </span>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-[#44403C] text-sm sm:text-base font-black">
                  <span className="text-stone-100">Total da Comanda:</span>
                  <span className="text-amber-400 tabular-nums text-lg sm:text-xl font-black">
                    R$ {computeTotal(currentComanda).toFixed(2)}
                  </span>
                </div>
              </div>

              {/* Action Buttons - Otimizado para telas estreitas com espaço de respiro inferior contra floating bars */}
              <div className="pt-2 border-t border-[#44403C]/60 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
                <div className="grid grid-cols-2 sm:flex sm:items-center gap-2">
                  {/* Botão de Fechar Mesa Sem Consumo quando itens = 0 */}
                  {currentComanda.items.length === 0 && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={isLiberandoSemConsumo}
                      onClick={() => handleFecharMesaSemConsumo(currentComanda)}
                      className="bg-red-950/30 border-red-500/40 hover:bg-red-950/60 hover:border-red-500 text-red-300 hover:text-red-100 text-xs h-10 sm:h-9 flex items-center justify-center col-span-2 sm:col-auto"
                      title="Encerra e libera a mesa de volta para status Livre sem cobrar nada"
                    >
                      {isLiberandoSemConsumo ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin flex-shrink-0" />
                          <span>Liberando...</span>
                        </>
                      ) : (
                        <>
                          <Ban className="w-3.5 h-3.5 mr-1.5 text-red-400 flex-shrink-0" />
                          <span>Fechar mesa sem consumo</span>
                        </>
                      )}
                    </Button>
                  )}

                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const sub = computeSubtotal(currentComanda)
                      const fee = computeServiceFee(currentComanda)
                      const tot = computeTotal(currentComanda)
                      const ok = printComandaAccount({
                        comanda: currentComanda,
                        settings,
                        subtotal: sub,
                        taxaServico: fee,
                        taxaPercentual,
                        total: tot,
                      })
                      if (ok) {
                        toast({
                          title: `Conta da Mesa ${currentComanda.tableNumber} Impressa`,
                          description: `Comprovante 80mm enviado para a impressora térmica.`,
                        })
                      } else {
                        toast({
                          variant: 'destructive',
                          title: 'Popup bloqueado',
                          description: 'Permita popups para visualizar a impressão da conta.',
                        })
                      }
                    }}
                    className="bg-[#1C1917] border-[#44403C] text-stone-200 hover:text-white text-xs h-10 sm:h-9 flex items-center justify-center"
                  >
                    <Printer className="w-3.5 h-3.5 mr-1.5 text-amber-500 flex-shrink-0" />
                    <span>Imprimir Conta</span>
                  </Button>

                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => handleAbrirTransferencia(currentComanda)}
                    className="bg-[#1C1917] border-[#44403C] hover:border-amber-500/50 text-stone-200 hover:text-amber-400 text-xs h-10 sm:h-9 flex items-center justify-center"
                  >
                    <ArrowRightLeft className="w-3.5 h-3.5 mr-1.5 text-amber-500 flex-shrink-0" />
                    <span>Transferir Mesa</span>
                  </Button>
                </div>

                <Button
                  type="button"
                  onClick={handleOpenPaymentFlow}
                  className="bg-amber-500 hover:bg-amber-600 text-stone-950 font-black text-xs sm:text-sm h-11 sm:h-9 px-5 shadow-lg shadow-amber-950/40 w-full sm:w-auto flex items-center justify-center"
                >
                  <CreditCard className="w-4 h-4 mr-2 flex-shrink-0" />
                  <span>Enviar para Pagamento</span>
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* PAYMENT MODAL (Simulated TEP / WhatsApp flow) */}
      <Dialog open={paymentModalOpen} onOpenChange={setPaymentModalOpen}>
        <DialogContent className="w-[calc(100%-1rem)] sm:max-w-xl bg-[#292524] border-[#44403C] text-stone-100 p-4 sm:p-6 pb-20 sm:pb-6">
          <DialogHeader className="pr-6 sm:pr-0">
            <DialogTitle className="text-base sm:text-lg font-black text-stone-100 flex items-center justify-between flex-wrap gap-1">
              <span>Fechamento — Mesa {activePayingComanda?.tableNumber}</span>
              <Badge className="bg-amber-500/15 text-amber-400 border-amber-500/40 text-[10px] sm:text-xs font-bold">
                TEP Integrado
              </Badge>
            </DialogTitle>
          </DialogHeader>

          {activePayingComanda && (
            <div className="space-y-4 pt-2">
              {/* Summary of comanda */}
              <div className="p-4 rounded-xl bg-[#1C1917] border border-[#44403C] flex items-center justify-between">
                <div>
                  <div className="text-xs text-stone-400">Total a Pagar</div>
                  <div className="text-2xl font-black text-amber-400 tabular-nums">
                    R$ {computeTotal(activePayingComanda).toFixed(2)}
                  </div>
                  <div className="text-[11px] text-stone-400">
                    {activePayingComanda.items.length} itens consumidos
                  </div>
                </div>

                <div className="text-right">
                  <div className="flex items-center gap-2 justify-end">
                    <Switch
                      checked={!!activePayingComanda.includeServiceFee}
                      onCheckedChange={() => toggleServiceFee(activePayingComanda.tableNumber)}
                      className="data-[state=checked]:bg-emerald-500"
                    />
                    <span className="text-xs text-stone-300">{taxaPercentual}% Serviço</span>
                  </div>
                  <div className="text-[11px] text-emerald-400 tabular-nums mt-1 font-semibold">
                    {activePayingComanda.includeServiceFee
                      ? `+ R$ ${computeServiceFee(activePayingComanda).toFixed(2)} incluso`
                      : 'Não incluído'}
                  </div>
                </div>
              </div>

              {/* Split bill toggle */}
              <div className="p-3 rounded-xl bg-[#1C1917]/70 border border-[#44403C] flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Switch
                    checked={splitBillEnabled}
                    onCheckedChange={setSplitBillEnabled}
                    className="data-[state=checked]:bg-amber-500"
                  />
                  <div>
                    <span className="text-xs font-semibold text-stone-200">Dividir Conta</span>
                    <p className="text-[10px] text-stone-400">Ratear entre os clientes da mesa</p>
                  </div>
                </div>

                {splitBillEnabled && (
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setSplitGuests(Math.max(2, splitGuests - 1))}
                      className="h-7 w-7 p-0 bg-[#292524] border-[#44403C] text-xs"
                    >
                      -
                    </Button>
                    <span className="text-xs font-bold tabular-nums text-stone-100">
                      {splitGuests} pess.
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setSplitGuests(splitGuests + 1)}
                      className="h-7 w-7 p-0 bg-[#292524] border-[#44403C] text-xs"
                    >
                      +
                    </Button>
                    <span className="text-xs font-extrabold text-amber-400 tabular-nums ml-2">
                      R$ {(computeTotal(activePayingComanda) / splitGuests).toFixed(2)} / cada
                    </span>
                  </div>
                )}
              </div>

              {/* Payment Method 4 large cards */}
              <div>
                <Label className="text-xs text-stone-400 font-semibold mb-2 block">
                  Selecione a Forma de Pagamento
                </Label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  {(
                    [
                      { id: 'Dinheiro', icon: Banknote, label: 'Dinheiro' },
                      { id: 'Cartão Crédito', icon: CreditCard, label: 'Cartão' },
                      { id: 'Pix', icon: QrCode, label: 'Pix' },
                      { id: 'TEP', icon: Smartphone, label: 'TEP' },
                    ] as const
                  ).map((method) => {
                    const Icon = method.icon
                    const isSelected = selectedPaymentMethod === method.id

                    return (
                      <button
                        key={method.id}
                        type="button"
                        onClick={() => setSelectedPaymentMethod(method.id as PaymentMethod)}
                        className={`p-3.5 rounded-xl border flex flex-col items-center justify-center gap-1.5 transition-all text-center ${
                          isSelected
                            ? 'border-amber-500 bg-amber-500/15 text-amber-400 shadow-md shadow-amber-950/20 font-bold'
                            : 'border-[#44403C] bg-[#1C1917] text-stone-300 hover:border-stone-500'
                        }`}
                      >
                        <Icon className="w-5 h-5 text-amber-500" />
                        <span className="text-xs">{method.label}</span>
                        {isSelected && (
                          <CheckCircle2 className="w-3.5 h-3.5 text-amber-400 absolute top-2 right-2" />
                        )}
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Pagamento Pix Real (Padrão BR Code Banco Central) */}
              {selectedPaymentMethod === 'Pix' &&
                (() => {
                  const totalComanda = computeTotal(activePayingComanda)
                  const pixValido = isPixConfigured(settings)

                  let pixPayload = ''
                  let pixError = ''

                  if (pixValido) {
                    try {
                      pixPayload = generatePixBRCode({
                        pixKey: settings.pixChave,
                        merchantName: settings.pixBeneficiarioNome,
                        merchantCity: settings.pixCidade,
                        amount: totalComanda,
                        txid: `MESA${activePayingComanda.tableNumber}`,
                        description: `Mesa ${activePayingComanda.tableNumber}`,
                      })
                    } catch (err: any) {
                      pixError = err.message || 'Erro ao montar código BR Code'
                    }
                  }

                  if (!pixValido) {
                    return (
                      <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/40 text-amber-200 text-xs space-y-2">
                        <div className="flex items-center gap-2 font-bold text-amber-400">
                          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                          <span>Configuração da Chave Pix pendente</span>
                        </div>
                        <p className="text-stone-300">
                          Para gerar o QR Code Pix real do Banco Central, o Gerente precisa
                          cadastrar a Chave Pix (CNPJ), Nome e Cidade do recebedor nas
                          Configurações.
                        </p>
                        {role === 'Gerente' && (
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setPaymentModalOpen(false)
                              navigate('/configuracoes')
                            }}
                            className="bg-amber-500 text-stone-950 font-bold border-amber-600 hover:bg-amber-400 text-xs mt-1"
                          >
                            <SettingsIcon className="w-3.5 h-3.5 mr-1.5" />
                            Ir para Configurações
                          </Button>
                        )}
                      </div>
                    )
                  }

                  if (pixError) {
                    return (
                      <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/40 text-red-300 text-xs">
                        <div className="flex items-center gap-2 font-bold">
                          <AlertTriangle className="w-4 h-4 text-red-400" />
                          <span>Não foi possível gerar o código Pix: {pixError}</span>
                        </div>
                      </div>
                    )
                  }

                  return (
                    <div className="p-4 rounded-2xl bg-[#1C1917] border border-[#44403C] space-y-4 animate-fade-in-up">
                      <div className="flex items-center justify-between border-b border-[#292524] pb-2">
                        <div className="flex items-center gap-2">
                          <div className="p-1.5 rounded-lg bg-teal-500/15 text-teal-400">
                            <QrCode className="w-4 h-4 text-teal-400" />
                          </div>
                          <div>
                            <div className="text-xs font-bold text-stone-100 flex items-center gap-1.5">
                              <span>QR Code Pix do Banco Central</span>
                              <Badge className="bg-teal-500/20 text-teal-300 border-teal-500/30 text-[9px] font-semibold">
                                BR Code Oficial
                              </Badge>
                            </div>
                            <p className="text-[10px] text-stone-400">
                              Aponte a câmera do aplicativo do seu banco para pagar
                            </p>
                          </div>
                        </div>

                        <div className="text-right">
                          <span className="text-[10px] text-stone-400 uppercase tracking-wider block">
                            Valor da Comanda
                          </span>
                          <span className="text-base font-black text-amber-400 tabular-nums">
                            R$ {totalComanda.toFixed(2)}
                          </span>
                        </div>
                      </div>

                      {/* QR Code Real centralizado com dados do recebedor */}
                      <div className="flex flex-col sm:flex-row items-center gap-4 bg-[#24201e] p-3.5 rounded-xl border border-[#383330]">
                        <div className="bg-white p-2 rounded-xl shadow-lg flex-shrink-0">
                          <QRCodeSVG value={pixPayload} size={150} margin={1} />
                        </div>

                        <div className="space-y-1.5 text-xs flex-1 w-full text-center sm:text-left">
                          <div className="text-[11px] text-stone-400">
                            Beneficiário:{' '}
                            <span className="font-semibold text-stone-200">
                              {settings.pixBeneficiarioNome || 'Rachide Bar'}
                            </span>
                          </div>
                          <div className="text-[11px] text-stone-400">
                            Chave Pix (CNPJ):{' '}
                            <span className="font-mono text-stone-200">{settings.pixChave}</span>
                          </div>
                          <div className="text-[11px] text-stone-400">
                            Cidade:{' '}
                            <span className="font-medium text-stone-200">
                              {settings.pixCidade || 'SAO PAULO'}
                            </span>
                          </div>
                          <div className="text-[11px] text-emerald-400 font-medium flex items-center justify-center sm:justify-start gap-1 pt-1">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>QR Code estático com valor exato pré-definido</span>
                          </div>
                        </div>
                      </div>

                      {/* Pix Copia e Cola */}
                      <div className="space-y-1.5">
                        <Label className="text-[11px] text-stone-300 font-semibold flex items-center justify-between">
                          <span>Código Pix Copia e Cola</span>
                          <span className="text-[10px] text-stone-400 font-normal">
                            Para clientes que pagam no mesmo celular
                          </span>
                        </Label>
                        <div className="flex items-center gap-2">
                          <Input
                            readOnly
                            value={pixPayload}
                            onFocus={(e) => e.target.select()}
                            className="bg-[#11100f] border-[#44403C] text-stone-200 text-xs font-mono select-all h-9 truncate"
                          />
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => handleCopyPixCode(pixPayload)}
                            className="bg-[#292524] border-[#44403C] hover:border-amber-500 text-stone-200 hover:text-white text-xs h-9 px-3 flex-shrink-0 flex items-center gap-1.5"
                          >
                            {copiedPixCode ? (
                              <>
                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                                <span className="text-emerald-400 font-bold">Copiado!</span>
                              </>
                            ) : (
                              <>
                                <Copy className="w-3.5 h-3.5 text-amber-500" />
                                <span>Copiar Código</span>
                              </>
                            )}
                          </Button>
                        </div>
                      </div>

                      {/* Aviso de conferência manual */}
                      <div className="p-2.5 rounded-lg bg-stone-900/80 border border-stone-800 text-[11px] text-stone-400 flex items-start gap-2">
                        <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
                        <span>
                          <strong className="text-stone-300">Conferência manual:</strong> Aguarde o
                          cliente apresentar o comprovante ou consulte o extrato da conta bancária
                          antes de confirmar a liberação da mesa.
                        </span>
                      </div>

                      {/* Botão de confirmação manual pelo Caixa */}
                      <div className="pt-2 border-t border-[#292524] flex items-center justify-end gap-2">
                        <Button
                          type="button"
                          variant="ghost"
                          onClick={() => setPaymentModalOpen(false)}
                          className="text-stone-400 text-xs"
                        >
                          Cancelar
                        </Button>
                        <Button
                          type="button"
                          disabled={isFinishingManual}
                          onClick={handleManualConfirmPix}
                          className="bg-emerald-500 hover:bg-emerald-600 text-stone-950 font-black text-xs px-5 h-9 shadow-md shadow-emerald-950/30 flex items-center gap-1.5"
                        >
                          {isFinishingManual ? (
                            <>
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              <span>Confirmando...</span>
                            </>
                          ) : (
                            <>
                              <CheckCircle2 className="w-4 h-4" />
                              <span>
                                Confirmar Pagamento Pix Recebido (R$ {totalComanda.toFixed(2)})
                              </span>
                            </>
                          )}
                        </Button>
                      </div>
                    </div>
                  )
                })()}

              {/* Cash change calculator */}
              {selectedPaymentMethod === 'Dinheiro' && (
                <div className="p-3 rounded-xl bg-[#1C1917] border border-[#44403C] grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <Label className="text-[11px] text-stone-400">
                      Valor Entregue pelo Cliente (R$)
                    </Label>
                    <Input
                      type="number"
                      step="0.50"
                      value={cashAmountPaid}
                      onChange={(e) => setCashAmountPaid(e.target.value)}
                      className="mt-1 bg-[#292524] border-[#44403C] text-stone-100 text-xs tabular-nums"
                    />
                  </div>
                  <div className="flex flex-col justify-end">
                    <span className="text-[11px] text-stone-400">Troco a Devolver:</span>
                    <span className="text-base font-black text-emerald-400 tabular-nums">
                      R${' '}
                      {Math.max(
                        0,
                        (parseFloat(cashAmountPaid) || 0) - computeTotal(activePayingComanda),
                      ).toFixed(2)}
                    </span>
                  </div>
                </div>
              )}

              {/* Simulation Flow Visualizer for TEP / Cartão */}
              {selectedPaymentMethod !== 'Pix' && paymentPhase === 'sending_tep' && (
                <div className="p-6 rounded-2xl bg-[#1C1917] border border-amber-500/50 flex flex-col items-center justify-center text-center space-y-3 animate-fade-in-up">
                  <Loader2 className="w-8 h-8 text-amber-500 animate-spin" />
                  <div>
                    <div className="font-bold text-sm text-stone-100">
                      Enviando para TEP / Maquininha Integrada...
                    </div>
                    <p className="text-xs text-stone-400 mt-0.5">
                      Aguardando aprovação na maquininha sem fio da mesa.
                    </p>
                  </div>
                </div>
              )}

              {selectedPaymentMethod !== 'Pix' && paymentPhase === 'whatsapp_chat' && (
                <div className="p-4 rounded-2xl bg-[#111B21] border border-[#2A3942] text-xs space-y-3 animate-fade-in-up shadow-xl">
                  {/* WhatsApp Header */}
                  <div className="flex items-center gap-2 pb-2 border-b border-[#2A3942]">
                    <div className="w-8 h-8 rounded-full bg-emerald-600 flex items-center justify-center text-white font-bold text-xs">
                      RB
                    </div>
                    <div>
                      <div className="font-bold text-stone-100 text-xs">
                        Rachide Bar & Petiscaria
                      </div>
                      <div className="text-[10px] text-emerald-400">Online • TEP Integrado</div>
                    </div>
                  </div>

                  {/* Chat bubbles */}
                  <div className="space-y-2 py-1">
                    {chatStep >= 1 && (
                      <div className="p-2.5 rounded-lg bg-[#202C33] text-stone-200 max-w-[85%] border-l-4 border-amber-500 shadow animate-fade-in-up">
                        <p className="font-semibold text-amber-400 text-[11px]">
                          Solicitação de Pagamento Gerada
                        </p>
                        <p className="mt-0.5">
                          Você recebeu uma solicitação de pagamento da{' '}
                          <strong>Mesa {activePayingComanda.tableNumber}</strong> no valor de{' '}
                          <strong className="text-stone-100 tabular-nums">
                            R$ {computeTotal(activePayingComanda).toFixed(2)}
                          </strong>
                          .
                        </p>
                        <span className="text-[9px] text-stone-400 block text-right mt-1">
                          19:42
                        </span>
                      </div>
                    )}

                    {chatStep >= 2 && (
                      <div className="p-2.5 rounded-lg bg-[#005C4B] text-white max-w-[85%] ml-auto border-r-4 border-emerald-400 shadow animate-fade-in-up">
                        <div className="flex items-center gap-1.5 font-bold text-emerald-200 text-[11px]">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          Pagamento Aprovado com Sucesso!
                        </div>
                        <p className="mt-0.5 text-stone-100">
                          R$ {computeTotal(activePayingComanda).toFixed(2)} recebido via{' '}
                          {selectedPaymentMethod}.
                        </p>
                        <span className="text-[9px] text-emerald-200 block text-right mt-1">
                          19:42 • TEP Protocol #84920
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Confirm / Finish Buttons for non-Pix methods */}
              {selectedPaymentMethod !== 'Pix' && (
                <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#44403C]">
                  {paymentPhase === 'idle' ? (
                    <>
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={() => setPaymentModalOpen(false)}
                        className="text-stone-400 text-xs"
                      >
                        Cancelar
                      </Button>
                      <Button
                        type="button"
                        onClick={handleConfirmPayment}
                        className="bg-amber-500 hover:bg-amber-600 text-stone-950 font-black text-xs px-6"
                      >
                        Confirmar Pagamento (R$ {computeTotal(activePayingComanda).toFixed(2)})
                      </Button>
                    </>
                  ) : chatStep >= 2 ? (
                    <Button
                      type="button"
                      onClick={handleFinishPaymentSuccess}
                      className="w-full bg-emerald-500 hover:bg-emerald-600 text-stone-950 font-black text-xs h-10 shadow-lg shadow-emerald-950/40 flex items-center justify-center gap-2"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      Concluir e Registrar no Caixa
                    </Button>
                  ) : (
                    <div className="text-xs text-stone-400 flex items-center gap-2">
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-500" />
                      Processando fluxo simulado...
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
