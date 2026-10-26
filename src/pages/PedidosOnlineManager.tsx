import React, { useState } from 'react'
import {
  QrCode,
  Printer,
  Copy,
  ExternalLink,
  Check,
  Smartphone,
  Share2,
  Sparkles,
  Download,
} from 'lucide-react'
import { useBar } from '@/context/BarContext'
import { QRCodeSVG, generateQRCodeDataURL } from '@/components/QRCodeSVG'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/hooks/use-toast'

export default function PedidosOnlineManager() {
  const { mesas } = useBar()
  const { toast } = useToast()
  const [copiedMesa, setCopiedMesa] = useState<number | null>(null)

  // Base pública de produção do app (URL de preview pública especificada pelo usuário) ou fallback dinâmico para window.location.origin
  const publicBaseUrl =
    typeof window !== 'undefined' && window.location.hostname !== 'localhost'
      ? window.location.origin
      : 'https://gerenciamento-de-bar-a7f41.goskip.app'

  // Garante ordenação das mesas
  const sortedMesas = [...mesas].sort((a, b) => a.numero - b.numero)

  // Monta URL pública com query param /pedido?mesa=X
  const getTablePublicUrl = (numero: number) => {
    if (!numero || numero <= 0) {
      return `${publicBaseUrl}/pedido`
    }
    return `${publicBaseUrl}/pedido?mesa=${numero}`
  }

  const handleCopyLink = (numero: number) => {
    const url = getTablePublicUrl(numero)
    navigator.clipboard.writeText(url)
    setCopiedMesa(numero)
    toast({
      title: numero > 0 ? `Link copiado: Mesa ${numero}` : 'Link copiado: Atendimento On-line',
      description: url,
    })
    setTimeout(() => setCopiedMesa(null), 2500)
  }

  const handlePrintTableQR = async (numero: number) => {
    const url = getTablePublicUrl(numero)
    const printWindow = window.open('', '_blank')
    if (!printWindow) return

    // Gera QR Code real como Data URL base64 usando o motor interno (sem serviço externo)
    let qrDataUrl = ''
    try {
      qrDataUrl = await generateQRCodeDataURL(url, { width: 320, margin: 2 })
    } catch (err) {
      console.error('Erro ao gerar QR Code para impressão:', err)
    }

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Placa de Mesa ${numero} - Rachide Bar</title>
          <style>
            body {
              font-family: 'Segoe UI', Roboto, sans-serif;
              display: flex;
              flex-direction: column;
              align-items: center;
              justify-content: center;
              min-height: 95vh;
              margin: 0;
              background: #fff;
              color: #1c1917;
              text-align: center;
            }
            .card {
              border: 3px solid #f59e0b;
              border-radius: 24px;
              padding: 40px;
              max-width: 360px;
              box-shadow: 0 10px 25px rgba(0,0,0,0.1);
            }
            .logo {
              font-size: 28px;
              font-weight: 900;
              color: #1c1917;
              margin-bottom: 4px;
            }
            .logo span { color: #f59e0b; }
            .table-badge {
              display: inline-block;
              background: #1c1917;
              color: #f59e0b;
              font-size: 22px;
              font-weight: 900;
              padding: 8px 24px;
              border-radius: 999px;
              margin: 16px 0 24px;
            }
            .qr-box {
              padding: 16px;
              background: #fafaf9;
              border-radius: 16px;
              display: inline-block;
            }
            .desc {
              font-size: 14px;
              color: #44403c;
              margin-top: 20px;
              line-height: 1.4;
            }
            .url {
              font-size: 11px;
              color: #78716c;
              margin-top: 12px;
              word-break: break-all;
            }
            @media print {
              body { min-height: auto; }
              .card { border-width: 2px; }
            }
          </style>
        </head>
        <body>
          <div class="card">
            <div class="logo">Rachide <span>Bar</span></div>
            <div style="font-size: 12px; color: #78716c;">Cardápio Digital & Pedido Direto</div>
            <div class="table-badge">MESA ${numero}</div>
            <div class="qr-box">
              <img src="${qrDataUrl}" width="220" height="220" alt="QR Code Mesa ${numero}" />
            </div>
            <div class="desc">
              <strong>Aponte a câmera do seu celular</strong><br/>
              Consulte nosso cardápio e faça seu pedido direto para a cozinha e bar!
            </div>
            <div class="url">${url}</div>
          </div>
          <script>
            window.onload = function() { window.print(); }
          </script>
        </body>
      </html>
    `)
    printWindow.document.close()
  }

  const handlePrintAll = () => {
    window.print()
  }

  return (
    <div className="space-y-6 animate-fade-in-up">
      {/* Top Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-5 rounded-2xl bg-[#292524] border border-[#44403C]">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-black text-stone-100 flex items-center gap-2">
              <QrCode className="w-6 h-6 text-amber-500" />
              QR Codes das Mesas & Pedidos On-line
            </h2>
            <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/40 text-xs font-bold">
              {sortedMesas.length} Mesas
            </Badge>
          </div>
          <p className="text-xs text-stone-400 mt-1">
            Gere, imprima e distribua os displays de mesa para que os clientes façam pedidos direto
            do celular.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Link Genérico / Delivery */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleCopyLink(0)}
            className="bg-[#1C1917] hover:bg-[#44403C] border-[#44403C] text-stone-200 text-xs font-semibold"
          >
            <Share2 className="w-3.5 h-3.5 mr-1.5 text-amber-500" />
            Copiar Link Delivery
          </Button>

          <Button
            size="sm"
            onClick={handlePrintAll}
            className="bg-amber-500 hover:bg-amber-600 text-stone-950 font-bold text-xs shadow-md shadow-amber-950/40"
          >
            <Printer className="w-3.5 h-3.5 mr-1.5" />
            Imprimir Todas as Mesas
          </Button>
        </div>
      </div>

      {/* Grid de QR Codes por Mesa */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-5 pb-8">
        {sortedMesas.map((mesa) => {
          const mesaUrl = getTablePublicUrl(mesa.numero)
          const isCopied = copiedMesa === mesa.numero

          return (
            <div
              key={mesa.id}
              className="p-5 rounded-2xl bg-[#292524] border border-[#44403C] hover:border-amber-500/50 transition-all flex flex-col justify-between items-center text-center space-y-4 shadow-sm group"
            >
              {/* Header da mesa */}
              <div className="w-full flex items-center justify-between pb-3 border-b border-[#44403C]/60">
                <span className="font-black text-base text-stone-100 flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                  Mesa {mesa.numero}
                </span>
                <Badge
                  variant="outline"
                  className={
                    mesa.status === 'Livre'
                      ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30 text-[10px]'
                      : 'bg-amber-500/10 text-amber-400 border-amber-500/30 text-[10px]'
                  }
                >
                  {mesa.status}
                </Badge>
              </div>

              {/* QR Code Real e Escaneável */}
              <div className="p-3 bg-white rounded-2xl shadow-inner border border-stone-200 flex items-center justify-center">
                <QRCodeSVG value={mesaUrl} size={160} />
              </div>

              {/* Link e info */}
              <div className="w-full space-y-1">
                <div className="text-[11px] font-mono text-stone-400 truncate bg-[#1C1917] px-2.5 py-1.5 rounded-lg border border-[#44403C]">
                  {mesaUrl}
                </div>
                <div className="text-[10px] text-stone-500">
                  Capacidade: {mesa.capacidade} lugares
                </div>
              </div>

              {/* Ações */}
              <div className="w-full grid grid-cols-3 gap-1.5 pt-2 border-t border-[#44403C]/60">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleCopyLink(mesa.numero)}
                  className="bg-[#1C1917] hover:bg-[#44403C] border-[#44403C] text-stone-300 text-[11px] h-8 px-2 flex items-center justify-center"
                  title="Copiar URL"
                >
                  {isCopied ? (
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                </Button>

                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handlePrintTableQR(mesa.numero)}
                  className="bg-[#1C1917] hover:bg-[#44403C] border-[#44403C] text-stone-300 text-[11px] h-8 px-2 flex items-center justify-center"
                  title="Imprimir Display de Mesa"
                >
                  <Printer className="w-3.5 h-3.5" />
                </Button>

                <Button
                  size="sm"
                  asChild
                  className="bg-amber-500 hover:bg-amber-600 text-stone-950 font-bold text-[11px] h-8 px-2 flex items-center justify-center"
                  title="Abrir como cliente"
                >
                  <a href={mesaUrl} target="_blank" rel="noreferrer">
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </Button>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
