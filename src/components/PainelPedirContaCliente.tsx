import React, { useState } from 'react'
import {
  Receipt,
  QrCode,
  CreditCard,
  Banknote,
  Clock,
  CheckCircle2,
  AlertCircle,
  XCircle,
  Loader2,
  Sparkles,
  ChevronRight,
  ShieldCheck,
  RefreshCw,
  Info,
  Copy,
  AlertTriangle,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { QRCodeSVG } from '@/components/QRCodeSVG'
import { generatePixBRCode, isPixConfigured } from '@/lib/pix'
import { useToast } from '@/hooks/use-toast'
import { DetalhesContaMesa, PaymentMethod, StatusContaCliente } from '@/types/bar'

interface PainelPedirContaClienteProps {
  mesaNumero: number
  detalhesConta: DetalhesContaMesa | null
  loadingDetalhes: boolean
  submittingConta: boolean
  onPedirConta: (forma: PaymentMethod, desejaNfce: boolean) => Promise<void>
  onRefresh: () => void
}

const FORMAS_PAGAMENTO: Array<{
  id: PaymentMethod
  nome: string
  subtitulo: string
  icone: React.ElementType
  corBadge: string
  destaque?: boolean
}> = [
  {
    id: 'Pix',
    nome: 'Pix Instantâneo',
    subtitulo: 'QR Code dinâmico na tela do caixa com valor exato',
    icone: QrCode,
    corBadge: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30',
    destaque: true,
  },
  {
    id: 'Cartão Crédito',
    nome: 'Cartão de Crédito',
    subtitulo: 'Maquininha na mesa ou no balcão',
    icone: CreditCard,
    corBadge: 'text-blue-400 bg-blue-500/10 border-blue-500/30',
  },
  {
    id: 'Cartão Débito',
    nome: 'Cartão de Débito',
    subtitulo: 'Maquininha na mesa ou no balcão',
    icone: CreditCard,
    corBadge: 'text-cyan-400 bg-cyan-500/10 border-cyan-500/30',
  },
  {
    id: 'Dinheiro',
    nome: 'Dinheiro',
    subtitulo: 'Pagamento físico no caixa',
    icone: Banknote,
    corBadge: 'text-amber-400 bg-amber-500/10 border-amber-500/30',
  },
]

export const PainelPedirContaCliente: React.FC<PainelPedirContaClienteProps> = ({
  mesaNumero,
  detalhesConta,
  loadingDetalhes,
  submittingConta,
  onPedirConta,
  onRefresh,
}) => {
  const [modalOpen, setModalOpen] = useState(false)
  const [modalConfirmacaoFinalOpen, setModalConfirmacaoFinalOpen] = useState(false)
  const [formaSelecionada, setFormaSelecionada] = useState<PaymentMethod>('Pix')
  const [desejaNfce, setDesejaNfce] = useState(false)
  const [copiedPixCode, setCopiedPixCode] = useState(false)
  const { toast } = useToast()

  const rawStatusConta: StatusContaCliente = detalhesConta?.statusConta || 'nenhum'
  const isMesaOcupada = detalhesConta?.statusMesa === 'Ocupada'
  // Salvaguarda: se a mesa está Ocupada (ou há itens de consumo em aberto),
  // um status residual 'fechada' nunca deve esconder a interface ou o botão de pedir conta
  const statusConta: StatusContaCliente =
    isMesaOcupada && rawStatusConta === 'fechada' ? 'nenhum' : rawStatusConta

  const isContaAtiva =
    statusConta === 'solicitada' ||
    statusConta === 'autorizada' ||
    statusConta === 'em_processamento_pix'
  const hasItens = detalhesConta?.itens && detalhesConta.itens.length > 0
  const total = detalhesConta?.total || 0
  const subtotal = detalhesConta?.subtotal || 0
  const taxaServico = detalhesConta?.taxaServico || 0

  // Passo 1: O cliente seleciona a forma de pagamento e clica em avançar para conferir e confirmar
  const handleAvancarParaConfirmacao = () => {
    setModalOpen(false)
    setModalConfirmacaoFinalOpen(true)
  }

  // Passo 2: O cliente confirma no modal de salvaguarda anti-toque acidental
  const handleConfirmarPedidoContaDefinitivo = async () => {
    try {
      await onPedirConta(formaSelecionada, desejaNfce)
      setModalConfirmacaoFinalOpen(false)
    } catch {
      // Se falhar, mantém aberto para tentar novamente
    }
  }

  const formaObj = FORMAS_PAGAMENTO.find((f) => f.id === formaSelecionada)
  const FormaIcon = formaObj?.icone || Receipt

  const handleCopyPix = async (payload: string) => {
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(payload)
      } else {
        const textarea = document.createElement('textarea')
        textarea.value = payload
        textarea.style.position = 'fixed'
        textarea.style.opacity = '0'
        document.body.appendChild(textarea)
        textarea.select()
        document.execCommand('copy')
        document.body.removeChild(textarea)
      }
      setCopiedPixCode(true)
      toast({
        title: 'Código Pix Copiado!',
        description: 'Cole no aplicativo do seu banco para efetuar o pagamento.',
      })
      setTimeout(() => setCopiedPixCode(false), 3000)
    } catch {
      toast({
        variant: 'destructive',
        title: 'Falha ao copiar',
        description: 'Selecione e copie o código manualmente.',
      })
    }
  }

  // Se a comanda estiver fechada, a renderização completa é delegada à tela de agradecimento exclusiva
  if (statusConta === 'fechada') {
    return null
  }

  // Se a solicitação foi recusada/adiada pelo caixa
  if (statusConta === 'recusada') {
    return (
      <div className="p-4 sm:p-5 rounded-2xl bg-amber-950/30 border border-amber-500/50 shadow-xl space-y-3 animate-fade-in-up">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center shrink-0 border border-amber-500/30">
            <Info className="w-5 h-5" />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-black text-amber-300">Fechamento Adiado pelo Caixa</h3>
              <Badge
                variant="outline"
                className="border-amber-500/40 text-amber-400 text-[10px] font-bold"
              >
                Mesa em Aberto
              </Badge>
            </div>
            <p className="text-xs text-stone-300 mt-1">
              {detalhesConta?.motivoRecusaConta ? (
                <>
                  <span className="font-semibold text-amber-200">Motivo informado: </span>"
                  {detalhesConta.motivoRecusaConta}"
                </>
              ) : (
                'O caixa adiou o fechamento da conta para a mesa continuar consumindo.'
              )}
            </p>
            <div className="pt-2 flex flex-wrap items-center gap-2">
              <Button
                size="sm"
                onClick={() => setModalOpen(true)}
                className="bg-amber-500 hover:bg-amber-600 text-stone-950 font-bold text-xs h-8 px-3"
              >
                <Receipt className="w-3.5 h-3.5 mr-1.5" />
                Pedir a conta novamente
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={onRefresh}
                className="text-stone-400 hover:text-stone-200 text-xs h-8 px-2"
              >
                <RefreshCw className="w-3 h-3 mr-1" />
                Atualizar
              </Button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Se a conta já estiver solicitada (status em tempo real)
  if (isContaAtiva) {
    const statusLabels: Record<
      string,
      { titulo: string; desc: string; badge: string; badgeCls: string; icon: React.ElementType }
    > = {
      solicitada: {
        titulo: 'Conta solicitada — aguardando o caixa',
        desc: 'O caixa do Rachide Bar já recebeu o chamado e está conferindo a comanda da sua mesa.',
        badge: 'Aguardando Caixa',
        badgeCls: 'bg-amber-500/20 text-amber-400 border-amber-500/40',
        icon: Clock,
      },
      autorizada: {
        titulo: 'Conta autorizada pelo Caixa',
        desc: 'Sua conta foi conferida! O caixa está pronto para registrar o pagamento.',
        badge: 'Autorizada',
        badgeCls: 'bg-blue-500/20 text-blue-400 border-blue-500/40',
        icon: ShieldCheck,
      },
      em_processamento_pix: {
        titulo: 'Pagamento em processamento (Pix)',
        desc: 'O Caixa gerou o QR Code Pix da sua comanda e está aguardando a compensação.',
        badge: 'Processando Pix',
        badgeCls: 'bg-purple-500/20 text-purple-300 border-purple-500/40',
        icon: QrCode,
      },
    }

    const currentConfig = statusLabels[statusConta] || statusLabels.solicitada
    const CurrentIcon = currentConfig.icon

    // Geração do QR Pix real no estado em_processamento_pix
    const isProcessandoPix = statusConta === 'em_processamento_pix'
    const pixValido = isPixConfigured({
      pixChave: detalhesConta?.pixChave,
      pixBeneficiarioNome: detalhesConta?.pixBeneficiarioNome,
      pixCidade: detalhesConta?.pixCidade,
    })

    let pixPayload = ''
    let pixError = ''
    if (isProcessandoPix) {
      if (pixValido && total > 0) {
        try {
          pixPayload = generatePixBRCode({
            pixKey: detalhesConta!.pixChave!,
            merchantName: detalhesConta!.pixBeneficiarioNome!,
            merchantCity: detalhesConta!.pixCidade!,
            amount: total,
            txid: `MESA${mesaNumero}`,
            description: `Mesa ${mesaNumero}`,
          })
        } catch (err: any) {
          pixError = err.message || 'Erro ao gerar QR Code Pix'
        }
      }
    }

    return (
      <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-br from-[#292524] to-[#1C1917] border border-amber-500/40 shadow-xl space-y-4 animate-fade-in-up">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center shrink-0 border border-amber-500/30 animate-pulse">
              <CurrentIcon className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-sm font-black text-stone-100">{currentConfig.titulo}</h3>
                <Badge className={`${currentConfig.badgeCls} text-[10px] font-bold`}>
                  {currentConfig.badge}
                </Badge>
              </div>
              <p className="text-xs text-stone-300 mt-0.5">{currentConfig.desc}</p>
            </div>
          </div>

          <Button
            size="sm"
            variant="ghost"
            onClick={onRefresh}
            className="text-stone-400 hover:text-stone-200 h-8 w-8 p-0 shrink-0"
            title="Atualizar status"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </Button>
        </div>

        {/* QR Code Pix Real do Banco Central e Copia e Cola para o Cliente */}
        {isProcessandoPix && (
          <div className="p-4 rounded-xl bg-[#201D1B] border border-purple-500/40 space-y-3.5 shadow-inner">
            <div className="flex items-center justify-between border-b border-[#342D26] pb-2">
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
                    Aponte o app do seu banco ou copie o código abaixo
                  </p>
                </div>
              </div>

              <div className="text-right">
                <span className="text-[10px] text-stone-400 uppercase tracking-wider block">
                  Valor Exato
                </span>
                <span className="text-base font-black text-amber-400 tabular-nums">
                  R$ {total.toFixed(2)}
                </span>
              </div>
            </div>

            {pixValido && !pixError && pixPayload ? (
              <>
                {/* QR Code centralizado */}
                <div className="flex flex-col sm:flex-row items-center gap-4 bg-[#181614] p-3.5 rounded-xl border border-[#383330]">
                  <div className="bg-white p-2.5 rounded-xl shadow-lg shrink-0">
                    <QRCodeSVG value={pixPayload} size={150} margin={1} />
                  </div>

                  <div className="space-y-1.5 text-xs flex-1 w-full text-center sm:text-left">
                    <div className="text-[11px] text-stone-400">
                      Recebedor:{' '}
                      <span className="font-semibold text-stone-200">
                        {detalhesConta?.pixBeneficiarioNome || 'Rachide Bar'}
                      </span>
                    </div>
                    <div className="text-[11px] text-stone-400">
                      Chave Pix:{' '}
                      <span className="font-mono text-stone-200">{detalhesConta?.pixChave}</span>
                    </div>
                    <div className="text-[11px] text-stone-400">
                      Cidade:{' '}
                      <span className="font-medium text-stone-200">
                        {detalhesConta?.pixCidade || 'SAO PAULO'}
                      </span>
                    </div>
                    <div className="text-[11px] text-emerald-400 font-medium flex items-center justify-center sm:justify-start gap-1 pt-1">
                      <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                      <span>QR Code estático oficial com valor exato da comanda</span>
                    </div>
                  </div>
                </div>

                {/* Copia e Cola */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-stone-200">Pix Copia e Cola</span>
                    <span className="text-[10px] text-stone-400">
                      Pague no app do banco no celular
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Input
                      readOnly
                      value={pixPayload}
                      onFocus={(e) => e.target.select()}
                      className="bg-[#11100f] border-[#44403C] text-stone-200 text-xs font-mono select-all h-9 truncate"
                    />
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => handleCopyPix(pixPayload)}
                      className="bg-amber-500 hover:bg-amber-600 text-stone-950 font-bold text-xs h-9 px-3 shrink-0 flex items-center gap-1.5 shadow-md shadow-amber-950/30"
                    >
                      {copiedPixCode ? (
                        <>
                          <CheckCircle2 className="w-3.5 h-3.5 text-stone-950" />
                          <span>Copiado!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" />
                          <span>Copiar código Pix</span>
                        </>
                      )}
                    </Button>
                  </div>
                </div>

                {/* Aviso de conferência manual pelo caixa */}
                <div className="p-2.5 rounded-lg bg-stone-900/80 border border-stone-800 text-[11px] text-stone-400 flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                  <span>
                    Após concluir o pagamento, o Caixa confere o recebimento e faz a liberação da
                    mesa.
                  </span>
                </div>
              </>
            ) : (
              <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-xs text-amber-300">
                {pixError
                  ? `Não foi possível gerar o QR Pix: ${pixError}`
                  : 'A chave Pix do bar ainda não foi configurada pelo Gerente. Apresente-se ao caixa para concluir o pagamento.'}
              </div>
            )}
          </div>
        )}

        {/* Resumo financeiro da comanda */}
        <div className="p-3.5 rounded-xl bg-[#1C1917] border border-[#44403C] space-y-2 text-xs">
          <div className="flex items-center justify-between text-stone-300">
            <span>Forma escolhida:</span>
            <span className="font-bold text-amber-400">
              {detalhesConta?.formaPagamentoSolicitada || 'Não especificada'}
            </span>
          </div>
          <div className="flex items-center justify-between text-stone-400">
            <span>Consumo ({detalhesConta?.itens?.length || 0} itens):</span>
            <span className="font-semibold text-stone-200 tabular-nums">
              R$ {subtotal.toFixed(2)}
            </span>
          </div>
          {taxaServico > 0 && (
            <div className="flex items-center justify-between text-stone-400">
              <span>Taxa de serviço ({detalhesConta?.taxaPercentual || 10}%):</span>
              <span className="font-semibold text-stone-200 tabular-nums">
                R$ {taxaServico.toFixed(2)}
              </span>
            </div>
          )}
          <div className="flex items-center justify-between pt-2 border-t border-[#44403C] font-black text-sm text-stone-100">
            <span>Total a Pagar:</span>
            <span className="text-base text-amber-400 tabular-nums">R$ {total.toFixed(2)}</span>
          </div>
        </div>

        <div className="flex items-center justify-between text-[11px] text-stone-400 pt-1">
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping inline-block" />
            Atualização em tempo real com o Caixa
          </span>
          <span className="text-[10px] text-stone-500">Mesa {mesaNumero}</span>
        </div>
      </div>
    )
  }

  // Estado padrão: Mesa aberta com itens, cliente pode pedir a conta
  return (
    <>
      <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-br from-[#292524] via-[#342D26] to-[#1C1917] border border-amber-500/40 shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-amber-500 to-amber-700 text-stone-950 flex items-center justify-center shrink-0 shadow-md shadow-amber-950/40">
            <Receipt className="w-6 h-6 stroke-[2.2]" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-black text-sm sm:text-base text-stone-100">
                Encerrar Atendimento
              </h3>
              <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/40 text-[10px] font-bold">
                Mesa {mesaNumero}
              </Badge>
            </div>
            <p className="text-xs text-stone-300 mt-1 max-w-md">
              Pronto para ir embora? Peça a conta direto pelo celular: escolha Pix, cartão ou
              dinheiro e o Caixa já prepara o fechamento da sua mesa.
            </p>
          </div>
        </div>

        <Button
          onClick={() => setModalOpen(true)}
          disabled={loadingDetalhes || submittingConta || !hasItens}
          className="bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-stone-950 font-black text-xs sm:text-sm h-11 px-5 rounded-xl shadow-lg shadow-amber-950/50 flex items-center justify-center gap-2 whitespace-nowrap border border-amber-400/40 transition-transform active:scale-95"
        >
          {loadingDetalhes ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Verificando...</span>
            </>
          ) : (
            <>
              <Receipt className="w-4 h-4" />
              <span>Pedir a Conta</span>
              <ChevronRight className="w-4 h-4 ml-0.5" />
            </>
          )}
        </Button>
      </div>

      {/* Modal de Confirmação + Seleção de Pagamento */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="w-[calc(100%-1rem)] sm:max-w-md bg-[#292524] border-[#44403C] text-stone-100 p-5 sm:p-6 max-h-[92dvh] overflow-y-auto">
          <DialogHeader>
            <div className="w-12 h-12 rounded-2xl bg-amber-500/20 text-amber-400 flex items-center justify-center mx-auto mb-2 border border-amber-500/40">
              <Receipt className="w-6 h-6" />
            </div>
            <DialogTitle className="text-center text-lg font-black text-stone-100">
              Pedir a Conta — Mesa {mesaNumero}
            </DialogTitle>
            <DialogDescription className="text-center text-xs text-stone-300">
              Confira o valor do consumo e escolha como prefere realizar o pagamento para o Caixa
              agilizar o atendimento.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 pt-2">
            {/* Resumo da Comanda */}
            <div className="p-3.5 rounded-xl bg-[#1C1917] border border-[#44403C] space-y-2 text-xs">
              <div className="flex items-center justify-between text-stone-400">
                <span>Consumo da Mesa:</span>
                <span className="font-semibold text-stone-200 tabular-nums">
                  R$ {subtotal.toFixed(2)}
                </span>
              </div>
              {taxaServico > 0 && (
                <div className="flex items-center justify-between text-stone-400">
                  <span>Taxa de Serviço ({detalhesConta?.taxaPercentual || 10}%):</span>
                  <span className="font-semibold text-stone-200 tabular-nums">
                    + R$ {taxaServico.toFixed(2)}
                  </span>
                </div>
              )}
              <div className="flex items-center justify-between pt-2 border-t border-[#44403C] font-black text-base text-stone-100">
                <span>Total a Pagar:</span>
                <span className="text-xl text-amber-400 tabular-nums">R$ {total.toFixed(2)}</span>
              </div>
            </div>

            {/* Seleção da Forma de Pagamento */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-stone-200 block">
                Escolha a forma de pagamento:
              </label>

              <div className="grid grid-cols-1 gap-2">
                {FORMAS_PAGAMENTO.map((forma) => {
                  const Icon = forma.icone
                  const isSelected = formaSelecionada === forma.id

                  return (
                    <button
                      key={forma.id}
                      type="button"
                      onClick={() => setFormaSelecionada(forma.id)}
                      className={`w-full p-3 rounded-xl border text-left transition-all flex items-center justify-between ${
                        isSelected
                          ? 'bg-amber-500/15 border-amber-500 text-stone-100 shadow-sm'
                          : 'bg-[#1C1917] border-[#44403C] text-stone-300 hover:border-stone-500'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
                            isSelected
                              ? 'bg-amber-500 text-stone-950 font-bold'
                              : 'bg-stone-800 text-stone-300'
                          }`}
                        >
                          <Icon className="w-5 h-5" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-extrabold text-stone-100">
                              {forma.nome}
                            </span>
                            {forma.destaque && (
                              <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/40 text-[9px] font-bold py-0 h-4">
                                Rápido & Seguro
                              </Badge>
                            )}
                          </div>
                          <p className="text-[11px] text-stone-400 line-clamp-1">
                            {forma.subtitulo}
                          </p>
                        </div>
                      </div>

                      <div
                        className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 ml-2 ${
                          isSelected ? 'border-amber-500 bg-amber-500' : 'border-stone-500'
                        }`}
                      >
                        {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-stone-950" />}
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Aviso de Prevenção de Duplicação */}
            <div className="p-2.5 rounded-lg bg-stone-900/60 border border-stone-800 text-[11px] text-stone-400 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>
                Ao confirmar, o Caixa recebe o aviso imediatamente com o valor da sua mesa.
              </span>
            </div>

            {/* Botões de Ação */}
            <div className="flex gap-2 pt-2 border-t border-[#44403C]">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setModalOpen(false)}
                disabled={submittingConta}
                className="flex-1 text-stone-400 hover:text-stone-200 text-xs"
              >
                Cancelar
              </Button>
              <Button
                type="button"
                onClick={handleAvancarParaConfirmacao}
                disabled={submittingConta}
                className="flex-1 bg-amber-500 hover:bg-amber-600 text-stone-950 font-black text-xs h-10 shadow-md shadow-amber-950/40 flex items-center justify-center gap-1.5"
              >
                <span>Avançar para confirmação</span>
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal de Confirmação Explícita de Fechamento (Etapa de Salvaguarda Anti-Toque Acidental) */}
      <Dialog open={modalConfirmacaoFinalOpen} onOpenChange={setModalConfirmacaoFinalOpen}>
        <DialogContent className="w-[calc(100%-1rem)] sm:max-w-md bg-[#292524] border-2 border-amber-500/60 text-stone-100 p-5 sm:p-6">
          <DialogHeader>
            <div className="w-14 h-14 rounded-2xl bg-amber-500/20 text-amber-400 flex items-center justify-center mx-auto mb-2 border border-amber-500/50">
              <ShieldCheck className="w-7 h-7" />
            </div>
            <DialogTitle className="text-center text-lg font-black text-stone-100">
              Confirmar Pedido de Fechamento?
            </DialogTitle>
            <DialogDescription className="text-center text-xs text-stone-300">
              Ao confirmar, a equipe do Caixa receberá o aviso imediato para fechar a{' '}
              <strong className="text-amber-400">Mesa {mesaNumero}</strong>.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 pt-1">
            {/* Resumo visual compacto dos valores e da forma de pagamento */}
            <div className="p-4 rounded-xl bg-[#1C1917] border border-[#44403C] space-y-2.5 text-xs">
              <div className="flex items-center justify-between text-stone-400">
                <span>Subtotal ({detalhesConta?.itens?.length || 0} itens consumidos):</span>
                <span className="font-semibold text-stone-200 tabular-nums">
                  R$ {subtotal.toFixed(2)}
                </span>
              </div>

              {taxaServico > 0 && (
                <div className="flex items-center justify-between text-stone-400">
                  <span>Taxa de serviço ({detalhesConta?.taxaPercentual || 10}%):</span>
                  <span className="font-semibold text-stone-200 tabular-nums">
                    + R$ {taxaServico.toFixed(2)}
                  </span>
                </div>
              )}

              <div className="flex items-center justify-between pt-2 border-t border-[#44403C]">
                <span className="font-bold text-stone-200">Forma de pagamento escolhida:</span>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-amber-500/15 border border-amber-500/40 text-amber-400 font-extrabold">
                  <FormaIcon className="w-3.5 h-3.5" />
                  {formaObj?.nome || formaSelecionada}
                </span>
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-[#44403C] font-black text-base">
                <span className="text-stone-100">Total Final da Conta:</span>
                <span className="text-xl text-amber-400 tabular-nums">R$ {total.toFixed(2)}</span>
              </div>
            </div>

            {/* Caixa de Seleção NFC-e (Item 1 do Requisito) */}
            <div className="p-3.5 rounded-xl bg-[#1C1917] border border-[#44403C] hover:border-amber-500/50 transition-colors">
              <label
                htmlFor="checkbox-deseja-nfce"
                className="flex items-start gap-3 cursor-pointer select-none"
              >
                <input
                  id="checkbox-deseja-nfce"
                  type="checkbox"
                  checked={desejaNfce}
                  onChange={(e) => setDesejaNfce(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-[#44403C] bg-stone-900 text-amber-500 focus:ring-amber-500 focus:ring-offset-0 cursor-pointer accent-amber-500"
                />
                <div className="flex-1 text-xs">
                  <span className="font-bold text-stone-100 block">
                    Desejo receber a nota fiscal (NFC-e) do consumo
                  </span>
                  <p className="text-[11px] text-stone-400 mt-0.5">
                    Após o fechamento pelo Caixa, você poderá visualizar e baixar o documento fiscal
                    diretamente nesta tela.
                  </p>
                </div>
              </label>
            </div>

            <div className="p-3 rounded-xl bg-amber-950/30 border border-amber-500/30 text-[11px] text-amber-200 leading-relaxed flex items-start gap-2">
              <Info className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <span>
                Certifique-se de que ninguém da mesa irá pedir novos itens antes de fechar a conta.
              </span>
            </div>

            {/* Ações de Confirmação Explícita */}
            <div className="flex gap-2.5 pt-2 border-t border-[#44403C]">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setModalConfirmacaoFinalOpen(false)
                  setModalOpen(true)
                }}
                disabled={submittingConta}
                className="flex-1 bg-[#1C1917] hover:bg-[#342D26] border-[#44403C] text-stone-300 text-xs h-11"
              >
                Voltar e alterar
              </Button>
              <Button
                type="button"
                onClick={handleConfirmarPedidoContaDefinitivo}
                disabled={submittingConta}
                className="flex-1 bg-amber-500 hover:bg-amber-600 text-stone-950 font-black text-xs h-11 shadow-lg shadow-amber-950/50 flex items-center justify-center gap-1.5 transition-transform active:scale-[0.98]"
              >
                {submittingConta ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Avisando o Caixa...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Confirmar pedido da conta</span>
                  </>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
