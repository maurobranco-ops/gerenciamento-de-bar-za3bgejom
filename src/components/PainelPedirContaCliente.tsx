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
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { DetalhesContaMesa, PaymentMethod, StatusContaCliente } from '@/types/bar'

interface PainelPedirContaClienteProps {
  mesaNumero: number
  detalhesConta: DetalhesContaMesa | null
  loadingDetalhes: boolean
  submittingConta: boolean
  onPedirConta: (forma: PaymentMethod) => Promise<void>
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
  const [formaSelecionada, setFormaSelecionada] = useState<PaymentMethod>('Pix')

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

  const handleConfirmarPedidoConta = async () => {
    await onPedirConta(formaSelecionada)
    setModalOpen(false)
  }

  // Se a comanda estiver fechada (e a mesa NÃO estiver ocupada em novo atendimento)
  if (statusConta === 'fechada') {
    return (
      <div className="p-4 sm:p-5 rounded-2xl bg-[#1C1917] border border-emerald-500/40 shadow-xl space-y-3">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0 border border-emerald-500/30">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-black text-emerald-300">Mesa {mesaNumero} Fechada!</h3>
              <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/40 text-[10px] font-bold">
                Concluído
              </Badge>
            </div>
            <p className="text-xs text-stone-300 mt-1">
              O pagamento foi confirmado e a conta encerrada pelo Caixa. Agradecemos a visita ao
              Rachide Bar! Volte sempre.
            </p>
          </div>
        </div>
      </div>
    )
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

    return (
      <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-br from-[#292524] to-[#1C1917] border border-amber-500/40 shadow-xl space-y-4">
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
                Voltar
              </Button>
              <Button
                type="button"
                onClick={handleConfirmarPedidoConta}
                disabled={submittingConta}
                className="flex-1 bg-amber-500 hover:bg-amber-600 text-stone-950 font-black text-xs h-10 shadow-md shadow-amber-950/40 flex items-center justify-center gap-1.5"
              >
                {submittingConta ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Enviando...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Confirmar Pedido</span>
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
