import React, { useState } from 'react'
import {
  Beer,
  Heart,
  Download,
  Printer,
  FileCheck2,
  Receipt,
  Sparkles,
  CheckCircle2,
  Calendar,
  CreditCard,
  Building,
  Loader2,
  ArrowRight,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { FiscalDocument, DetalhesContaMesa } from '@/types/bar'
import { useToast } from '@/hooks/use-toast'
import { BarService } from '@/services/barService'

interface TelaAgradecimentoMesaFechadaProps {
  mesaNumero: number
  clienteNome?: string
  detalhesConta: DetalhesContaMesa | null
  onNovoAtendimento?: () => void
}

export const TelaAgradecimentoMesaFechada: React.FC<TelaAgradecimentoMesaFechadaProps> = ({
  mesaNumero,
  clienteNome,
  detalhesConta,
  onNovoAtendimento,
}) => {
  const { toast } = useToast()
  const [baixando, setBaixando] = useState(false)

  const solicitouNfce = Boolean(detalhesConta?.nfceSolicitada)
  const nfceDoc = detalhesConta?.nfceDocumento
  const barInfo = detalhesConta?.barInfo
  const totalPago = detalhesConta?.total || 0
  const formaPagamento = detalhesConta?.formaPagamentoSolicitada || 'Confirmada no Caixa'
  const nomeExibicao = clienteNome || detalhesConta?.clienteNome || 'Cliente'

  const gerarHtmlDanfe = (doc: FiscalDocument) => {
    const nomeBar = barInfo?.nomeFantasia || 'Rachide Bar'
    const razaoSocial = barInfo?.razaoSocial || 'Rachide Bar & Petiscaria EIRELI'
    const cnpj = barInfo?.cnpj || '14.293.842/0001-84'
    const ie = barInfo?.inscricaoEstadual || '114.293.842.110'
    const endereco =
      barInfo?.enderecoCompleto || 'Rua dos Boêmios, 142 - Vila Madalena, São Paulo - SP'
    const impressora = barInfo?.impressoraFiscalNome || 'Epson TM-T20X (Térmica 80mm)'
    const dataEmissaoFormatada = (doc.issuedAt || new Date().toISOString())
      .replace('T', ' ')
      .substring(0, 16)

    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>DANFE NFC-e - ${doc.number}</title>
  <style>
    @page { size: 80mm auto; margin: 3mm; }
    body {
      font-family: 'Courier New', Courier, monospace;
      font-size: 11px;
      width: 74mm;
      margin: 0 auto;
      line-height: 1.3;
      color: #000;
      background: #fff;
    }
    .center { text-align: center; }
    .right { text-align: right; }
    .bold { font-weight: bold; }
    .hr { border-top: 1px dashed #000; margin: 6px 0; }
    .double-hr { border-top: 2px solid #000; margin: 6px 0; }
    .title { font-size: 14px; font-weight: bold; }
    .subtitle { font-size: 9px; }
    .flex-row { display: flex; justify-content: space-between; }
    .access-key { font-size: 8px; word-break: break-all; text-align: center; margin-top: 4px; }
    @media print {
      body { width: 100%; }
      .no-print { display: none; }
    }
  </style>
</head>
<body>
  <div class="center title">${nomeBar.toUpperCase()}</div>
  <div class="center subtitle">${razaoSocial}</div>
  <div class="center subtitle">CNPJ: ${cnpj} • IE: ${ie}</div>
  <div class="center subtitle">${endereco}</div>
  <div class="double-hr"></div>

  <div class="center bold" style="font-size: 12px;">DANFE NFC-e</div>
  <div class="center subtitle">Documento Auxiliar da Nota Fiscal de Consumidor Eletrônica</div>
  <div class="center subtitle" style="font-weight: bold; margin-top: 2px;">Não permite aproveitamento de crédito de ICMS</div>
  <div class="hr"></div>

  <div class="flex-row">
    <span><strong>Mesa:</strong> ${mesaNumero}</span>
    <span><strong>Série:</strong> ${doc.serie || '001'}</span>
  </div>
  <div class="flex-row">
    <span><strong>Doc:</strong> ${doc.number}</span>
    <span><strong>Tipo:</strong> ${doc.type || 'NFC-e'}</span>
  </div>
  <div><strong>Emissão:</strong> ${dataEmissaoFormatada}</div>
  <div><strong>Consumidor:</strong> ${doc.clientName || nomeExibicao}</div>
  ${doc.docNumber ? `<div><strong>CPF/CNPJ:</strong> ${doc.docNumber}</div>` : ''}
  <div class="hr"></div>

  <div class="center bold" style="margin-bottom: 4px;">RESUMO DO CONSUMO</div>
  <div class="flex-row bold" style="font-size: 13px;">
    <span>VALOR TOTAL PAGO:</span>
    <span>R$ ${Number(doc.value || totalPago).toFixed(2)}</span>
  </div>
  <div class="flex-row subtitle" style="margin-top: 2px;">
    <span>Forma de Pagamento:</span>
    <span>${formaPagamento}</span>
  </div>
  <div class="hr"></div>

  <div class="center subtitle">
    <strong>EMISSÃO EM AMBIENTE DE HOMOLOGAÇÃO</strong><br />
    (Demonstração / Fiscal Rachide Bar)
  </div>
  <div class="access-key">
    <strong>Chave de Acesso:</strong><br />
    ${doc.accessKey || '35250314293842000184650010000001098472810'}
  </div>

  <div class="double-hr"></div>
  <div class="center subtitle">
    <div>Protocolo SEFAZ Virtual: 135250009482012</div>
    <div>Emissão: Normal • Impressora: ${impressora}</div>
    <div style="margin-top: 4px; font-weight: bold;">Obrigado pela preferência e volte sempre!</div>
  </div>
</body>
</html>`
  }

  const obterOuBuscarDoc = async (): Promise<FiscalDocument | null> => {
    if (nfceDoc) return nfceDoc

    try {
      const res = await BarService.obterNfceComandaMesa(mesaNumero)
      if (res.sucesso && res.documento) {
        return res.documento
      }
    } catch (err) {
      console.warn('Erro ao buscar documento fiscal da mesa:', err)
    }

    // Fallback gerado a partir dos dados do consumo da comanda caso ainda não persistido
    const seq = Math.floor(100 + Math.random() * 900)
    return {
      id: `fisc-fallback-${Date.now()}`,
      number: `NFC-e 000.${seq}`,
      serie: '001',
      type: 'NFC-e',
      issuedAt: detalhesConta?.fechadaEm || new Date().toISOString(),
      value: totalPago > 0 ? totalPago : 0,
      status: 'Autorizada',
      clientName: nomeExibicao,
      accessKey: `3525031429384200018465001000000${seq}1098472810`,
    }
  }

  // Ação de download da NFC-e em arquivo HTML (80mm) ou acionamento de impressão/PDF
  const handleBaixarNfce = async () => {
    setBaixando(true)
    try {
      const doc = await obterOuBuscarDoc()
      if (!doc) {
        toast({
          variant: 'destructive',
          title: 'Documento não localizado',
          description: 'Aguarde um instante ou solicite a segunda via ao Caixa.',
        })
        return
      }

      const htmlContent = gerarHtmlDanfe(doc)
      const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      const sanitizedName = (doc.number || 'NFCE').replace(/[^a-zA-Z0-9_-]/g, '_')
      link.href = url
      link.download = `DANFE_${sanitizedName}_Mesa_${mesaNumero}.html`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)

      toast({
        title: 'NFC-e baixada com sucesso!',
        description: `Arquivo ${link.download} gerado no padrão térmico 80mm.`,
      })
    } catch (err: any) {
      console.error('Falha ao baixar NFC-e:', err)
      toast({
        variant: 'destructive',
        title: 'Erro ao gerar NFC-e',
        description: err.message || 'Tente novamente em instantes.',
      })
    } finally {
      setBaixando(false)
    }
  }

  // Visualizar / Imprimir em pop-up estilo DANFE 80mm
  const handleVisualizarNfce = async () => {
    setBaixando(true)
    try {
      const doc = await obterOuBuscarDoc()
      if (!doc) {
        toast({
          variant: 'destructive',
          title: 'Documento não localizado',
          description: 'Não foi possível carregar a NFC-e no momento.',
        })
        return
      }

      const htmlContent = gerarHtmlDanfe(doc)
      const printWindow = window.open('', '_blank', 'width=420,height=650')
      if (printWindow) {
        printWindow.document.open()
        printWindow.document.write(htmlContent)
        printWindow.document.close()
        // Adiciona script para sugerir impressão ao abrir
        setTimeout(() => {
          try {
            printWindow.focus()
            printWindow.print()
          } catch {
            /* popup bloqueado ou fechado */
          }
        }, 500)
      } else {
        // Se popup bloqueado, fallback direto para download do arquivo
        handleBaixarNfce()
      }
    } finally {
      setBaixando(false)
    }
  }

  return (
    <div className="w-full max-w-2xl mx-auto py-6 sm:py-10 space-y-6 animate-fade-in-up">
      {/* Card Principal de Agradecimento */}
      <div className="p-6 sm:p-8 rounded-3xl bg-gradient-to-br from-[#292524] via-[#241F1C] to-[#1C1917] border-2 border-emerald-500/50 shadow-2xl text-center space-y-6 relative overflow-hidden">
        {/* Glow decorativo de fundo */}
        <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-72 h-72 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

        {/* Ícone com animação de celebração */}
        <div className="relative mx-auto w-20 h-20 rounded-3xl bg-gradient-to-br from-emerald-500 to-emerald-700 text-stone-950 flex items-center justify-center shadow-xl shadow-emerald-950/60 border border-emerald-400/40">
          <Heart className="w-10 h-10 fill-current animate-pulse" />
          <span className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-[#1C1917] border-2 border-emerald-500 flex items-center justify-center text-emerald-400">
            <CheckCircle2 className="w-4 h-4 fill-emerald-500 text-stone-950" />
          </span>
        </div>

        {/* Mensagem acolhedora do bar */}
        <div className="space-y-2">
          <Badge className="bg-emerald-500/15 text-emerald-300 border-emerald-500/40 text-xs font-bold px-3 py-1">
            Mesa {mesaNumero} Fechada com Sucesso
          </Badge>
          <h1 className="text-2xl sm:text-3xl font-black text-stone-100 tracking-tight">
            Muito obrigado pela sua visita, <span className="text-amber-400">{nomeExibicao}</span>!
          </h1>
          <p className="text-xs sm:text-sm text-stone-300 leading-relaxed max-w-lg mx-auto">
            Foi um imenso prazer receber você no <strong>Rachide Bar</strong>. Seu atendimento e
            consumo foram totalmente encerrados com sucesso pela nossa equipe do Caixa.
          </p>
        </div>

        {/* Resumo do Fechamento Concluído */}
        <div className="p-4 rounded-2xl bg-[#181614] border border-[#383330] text-left text-xs space-y-2.5 max-w-md mx-auto">
          <div className="flex items-center justify-between text-stone-400">
            <span>Mesa de atendimento:</span>
            <span className="font-bold text-amber-400">Mesa {mesaNumero}</span>
          </div>
          <div className="flex items-center justify-between text-stone-400">
            <span>Status da conta:</span>
            <span className="text-emerald-400 font-bold flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5" />
              Fechada e Paga
            </span>
          </div>
          {totalPago > 0 && (
            <div className="flex items-center justify-between text-stone-400">
              <span>Valor total liquidado:</span>
              <span className="text-base font-black text-emerald-400 tabular-nums">
                R$ {totalPago.toFixed(2)}
              </span>
            </div>
          )}
          <div className="flex items-center justify-between text-stone-400 pt-2 border-t border-[#292524]">
            <span>Forma de liquidação:</span>
            <span className="font-semibold text-stone-200">{formaPagamento}</span>
          </div>
        </div>

        {/* BLOCO DA NFC-e: Exibido APENAS se o cliente marcou a opção no fechamento */}
        {solicitouNfce ? (
          <div className="p-5 rounded-2xl bg-gradient-to-br from-[#201D1A] to-[#161413] border-2 border-amber-500/50 shadow-inner space-y-4 max-w-md mx-auto text-left">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center shrink-0 border border-amber-500/40">
                <FileCheck2 className="w-5 h-5" />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-black text-stone-100">
                    Sua Nota Fiscal (NFC-e) está Pronta!
                  </h3>
                  <Badge className="bg-amber-500/20 text-amber-300 border-amber-500/40 text-[9px] font-bold">
                    Autorizada
                  </Badge>
                </div>
                <p className="text-[11px] text-stone-300 mt-0.5 leading-relaxed">
                  Conforme solicitado no pedido de fechamento, o documento auxiliar eletrônico
                  (DANFE 80mm) já está disponível para download e impressão.
                </p>
              </div>
            </div>

            {/* Informações fiscais resumidas */}
            <div className="p-3 rounded-xl bg-[#12100F] border border-[#2A2624] text-[11px] space-y-1.5 font-mono">
              <div className="flex justify-between text-stone-400">
                <span>Documento:</span>
                <span className="text-stone-200 font-bold">
                  {nfceDoc?.number || 'NFC-e Consumo'}
                </span>
              </div>
              <div className="flex justify-between text-stone-400">
                <span>Ambiente:</span>
                <span className="text-amber-400 font-medium">Demonstração SEFAZ Virtual</span>
              </div>
              {nfceDoc?.accessKey && (
                <div className="pt-1 border-t border-[#24201E] text-[10px] text-stone-500 break-all">
                  Chave: {nfceDoc.accessKey}
                </div>
              )}
            </div>

            {/* Botões de Ação para a NFC-e */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
              <Button
                type="button"
                onClick={handleBaixarNfce}
                disabled={baixando}
                className="w-full bg-amber-500 hover:bg-amber-600 text-stone-950 font-black text-xs h-10 shadow-md shadow-amber-950/40 flex items-center justify-center gap-2 transition-transform active:scale-[0.98]"
              >
                {baixando ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Gerando...</span>
                  </>
                ) : (
                  <>
                    <Download className="w-4 h-4" />
                    <span>Baixar NFC-e (HTML)</span>
                  </>
                )}
              </Button>

              <Button
                type="button"
                variant="outline"
                onClick={handleVisualizarNfce}
                disabled={baixando}
                className="w-full bg-[#1C1917] hover:bg-[#292524] border-[#44403C] hover:border-amber-500/40 text-stone-200 text-xs h-10 flex items-center justify-center gap-2"
              >
                <Printer className="w-4 h-4 text-amber-400" />
                <span>Imprimir / PDF</span>
              </Button>
            </div>
          </div>
        ) : (
          <div className="p-3.5 rounded-xl bg-stone-900/60 border border-stone-800 text-xs text-stone-400 max-w-md mx-auto flex items-center justify-center gap-2">
            <Receipt className="w-4 h-4 text-stone-500" />
            <span>Nota fiscal (NFC-e) não solicitada para este atendimento.</span>
          </div>
        )}

        {/* Rodapé do Bar com Botão para Iniciar Novo Atendimento */}
        <div className="pt-4 border-t border-[#383330] flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-stone-400">
          <div className="flex items-center gap-2 text-[11px]">
            <Beer className="w-4 h-4 text-amber-500 shrink-0" />
            <span>Rachide Bar & Petiscaria • Esperamos você em breve!</span>
          </div>

          {onNovoAtendimento && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onNovoAtendimento}
              className="bg-[#1C1917] hover:bg-[#2A2624] border-[#44403C] text-stone-200 hover:text-white text-xs h-9 px-4 shrink-0 flex items-center gap-1.5"
            >
              <span>Novo atendimento</span>
              <ArrowRight className="w-3.5 h-3.5 text-amber-400" />
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
