import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ReceiptText,
  AlertTriangle,
  FileCheck2,
  Printer,
  XCircle,
  Loader2,
  CheckCircle2,
  ShieldAlert,
  Send,
  Building,
  User,
  Info,
} from 'lucide-react'
import { useBar } from '../context/BarContext'
import { FiscalDocType, FiscalDocument } from '../types/bar'
import { Button } from '../components/ui/button'
import { Badge } from '../components/ui/badge'
import { Input } from '../components/ui/input'
import { Label } from '../components/ui/label'
import { Progress } from '../components/ui/progress'
import { useToast } from '../hooks/use-toast'

export default function Fiscal() {
  const navigate = useNavigate()
  const { fiscalDocs, issueFiscalDoc, cancelFiscalDoc, comandas, settings } = useBar()
  const { toast } = useToast()

  // Form states
  const [docType, setDocType] = useState<FiscalDocType>('NFC-e')
  const [selectedComandaId, setSelectedComandaId] = useState<string>('')
  const [clientName, setClientName] = useState<string>('Consumidor Final')
  const [docNumber, setDocNumber] = useState<string>('')
  const [docValue, setDocValue] = useState<string>('95.00')
  const [isEmitting, setIsEmitting] = useState(false)

  // Calculations for Totais do Período
  const totalDocs = fiscalDocs.length
  const totalValue = fiscalDocs
    .filter((d) => d.status === 'Autorizada')
    .reduce((sum, d) => sum + d.value, 0)
  const canceledCount = fiscalDocs.filter((d) => d.status === 'Cancelada').length
  const authorizedCount = fiscalDocs.filter((d) => d.status === 'Autorizada').length
  const authorizationRate = totalDocs > 0 ? (authorizedCount / totalDocs) * 100 : 100

  // Handle comanda autofill
  const handleComandaSelect = (cmdId: string) => {
    setSelectedComandaId(cmdId)
    const cmd = comandas.find((c) => c.id === cmdId)
    if (cmd) {
      const subtotal = cmd.items.reduce((s, i) => s + i.price * i.quantity, 0)
      const service = cmd.includeServiceFee ? subtotal * 0.1 : 0
      setDocValue((subtotal + service).toFixed(2))
      if (cmd.clientName) {
        setClientName(cmd.clientName)
      }
    }
  }

  const handleEmitDocument = async (e: React.FormEvent) => {
    e.preventDefault()
    const val = parseFloat(docValue)
    if (isNaN(val) || val <= 0) {
      toast({
        variant: 'destructive',
        title: 'Valor inválido',
        description: 'Informe um valor válido para o documento fiscal.',
      })
      return
    }

    setIsEmitting(true)
    try {
      await issueFiscalDoc({
        type: docType,
        comandaId: selectedComandaId || undefined,
        clientName: clientName.trim() || 'Consumidor Final',
        docNumber: docNumber.trim() || undefined,
        value: val,
      })
      // Reset form
      setDocNumber('')
    } finally {
      setIsEmitting(false)
    }
  }

  const handlePrintDoc = (doc: FiscalDocument) => {
    // Layout térmico simulado DANFE
    const printWindow = window.open('', '_blank', 'width=380,height=600')
    if (printWindow) {
      printWindow.document.open()
      printWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>DANFE - ${doc.number}</title>
          <style>
            @page { size: 80mm auto; margin: 3mm; }
            body { font-family: 'Courier New', monospace; font-size: 11px; width: 74mm; margin: 0 auto; line-height: 1.3; }
            .center { text-align: center; }
            .bold { font-weight: bold; }
            .hr { border-top: 1px dashed #000; margin: 5px 0; }
            .double-hr { border-top: 2px solid #000; margin: 5px 0; }
          </style>
        </head>
        <body>
          <div class="center bold" style="font-size: 14px;">${settings?.nomeFantasia || 'RACHIDE BAR'}</div>
          <div class="center" style="font-size: 9px;">${settings?.razaoSocial || 'Rachide Bar & Petiscaria EIRELI'}</div>
          <div class="center" style="font-size: 9px;">CNPJ: ${settings?.cnpj || '14.293.842/0001-84'} • IE: ${settings?.inscricaoEstadual || '114.293.842.110'}</div>
          <div class="center" style="font-size: 9px;">${settings?.enderecoCompleto || 'Rua dos Boêmios, 142 - SP'}</div>
          <div class="double-hr"></div>
          <div class="center bold">DANFE ${doc.type} - DOCUMENTO AUXILIAR</div>
          <div class="center" style="font-size: 9px;">(Ambiente de Homologação / Simulado)</div>
          <div class="hr"></div>
          <div><strong>Doc:</strong> ${doc.number} &bull; <strong>Série:</strong> ${doc.serie}</div>
          <div><strong>Emissão:</strong> ${doc.issuedAt.replace('T', ' ').substring(0, 16)}</div>
          <div><strong>Destinatário:</strong> ${doc.clientName || 'Consumidor Final'}</div>
          ${doc.docNumber ? `<div><strong>CPF/CNPJ:</strong> ${doc.docNumber}</div>` : ''}
          <div class="hr"></div>
          <div style="display:flex; justify-content:space-between; font-size:14px; font-weight:bold;">
            <span>VALOR TOTAL:</span>
            <span>R$ ${doc.value.toFixed(2)}</span>
          </div>
          <div class="hr"></div>
          <div style="font-size: 8px; word-break: break-all;">
            <strong>Chave de Acesso:</strong><br/>
            ${doc.accessKey || '35250314293842000184650010000000000000000000'}
          </div>
          <div class="center" style="margin-top: 10px; font-size: 9px;">
            <div>Protocolo SEFAZ: 135250009482012</div>
            <div>Impressora: ${settings?.impressoraFiscalNome || 'Epson TM-T20X'}</div>
          </div>
          <script>window.onload = function() { window.print(); setTimeout(function() { window.close(); }, 600); };</script>
        </body>
        </html>
      `)
      printWindow.document.close()
    }

    toast({
      title: `Documento ${doc.number} Enviado para Impressão`,
      description: `DANFE 80mm gerado com dados cadastrais de ${settings?.nomeFantasia || 'Rachide Bar'}.`,
    })
  }

  const handleCancelDoc = (doc: FiscalDocument) => {
    cancelFiscalDoc(doc.id)
  }

  return (
    <div className="space-y-6 animate-fade-in-up">
      {/* Mandatory Amber Simulation Warning Banner */}
      <div className="p-4 rounded-2xl bg-amber-500/15 border-2 border-amber-500/50 flex items-start gap-3 text-amber-300">
        <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
        <div className="text-xs">
          <span className="font-extrabold text-amber-400 block text-sm">
            Módulo Fiscal em Modo Simulado — Nenhum documento real foi emitido.
          </span>
          <p className="mt-0.5 text-amber-200/90 leading-relaxed">
            As emissões de NFC-e (modelo 65) e NF-e (modelo 55), numerações, protocolos e chaves de
            acesso de 44 dígitos operam em ambiente fictício de homologação.
          </p>
        </div>
      </div>

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-5 rounded-2xl bg-[#292524] border border-[#44403C]">
        <div>
          <h2 className="text-xl font-black text-stone-100 flex items-center gap-2">
            Emissão Fiscal & Documentos Eletrônicos
          </h2>
          <p className="text-xs text-stone-400 mt-1">
            Geração de NFC-e e NF-e com DANFE, cancelamento e monitoramento de autorizações SEFAZ.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate('/plano-nfce')}
            className="bg-[#1C1917] border-amber-500/50 hover:bg-amber-500/10 text-amber-400 text-xs font-semibold flex items-center gap-1.5 h-8"
          >
            <ReceiptText className="w-3.5 h-3.5" />
            <span>Ver Plano Provedor SEFAZ-PB</span>
          </Button>
          <Badge className="bg-stone-800 text-stone-300 border-stone-700 text-xs px-3 py-1">
            Série 001 • {settings?.nomeFantasia || 'Rachide Bar'}
          </Badge>
        </div>
      </div>

      {/* Issuance Card + Totals Card Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Emitir Documento Fiscal Form (Spans 2 columns) */}
        <div className="lg:col-span-2 p-5 rounded-2xl bg-[#292524] border border-[#44403C] shadow-md">
          <div className="flex items-center justify-between mb-4 border-b border-[#44403C] pb-3">
            <h3 className="font-bold text-base text-stone-100 flex items-center gap-2">
              <ReceiptText className="w-5 h-5 text-amber-500" />
              Emitir Documento Fiscal
            </h3>
            <span className="text-xs text-stone-400">Tempo de resposta estimado: ~2s</span>
          </div>

          <form onSubmit={handleEmitDocument} className="space-y-4 text-xs">
            {/* Toggle NFC-e / NF-e */}
            <div>
              <Label className="text-xs text-stone-400 font-semibold">
                Tipo de Documento Fiscal
              </Label>
              <div className="grid grid-cols-2 gap-3 mt-1.5">
                <button
                  type="button"
                  onClick={() => setDocType('NFC-e')}
                  className={`p-3 rounded-xl border font-bold transition-all flex items-center justify-center gap-2 ${
                    docType === 'NFC-e'
                      ? 'bg-amber-500 text-stone-950 border-amber-500 shadow-md shadow-amber-950/20'
                      : 'bg-[#1C1917] text-stone-400 border-[#44403C] hover:border-stone-500'
                  }`}
                >
                  <ReceiptText className="w-4 h-4" />
                  NFC-e (Consumidor Final)
                </button>

                <button
                  type="button"
                  onClick={() => setDocType('NF-e')}
                  className={`p-3 rounded-xl border font-bold transition-all flex items-center justify-center gap-2 ${
                    docType === 'NF-e'
                      ? 'bg-amber-500 text-stone-950 border-amber-500 shadow-md shadow-amber-950/20'
                      : 'bg-[#1C1917] text-stone-400 border-[#44403C] hover:border-stone-500'
                  }`}
                >
                  <Building className="w-4 h-4" />
                  NF-e (Nota Fiscal Eletrônica)
                </button>
              </div>
            </div>

            {/* Comanda ID & Value */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label className="text-xs text-stone-400">Vincular a Comanda (Opcional)</Label>
                <select
                  value={selectedComandaId}
                  onChange={(e) => handleComandaSelect(e.target.value)}
                  className="w-full mt-1 bg-[#1C1917] border border-[#44403C] rounded-lg px-3 py-2 text-xs text-stone-100 focus:outline-none focus:border-amber-500"
                >
                  <option value="">Nenhuma (Venda Avulsa / Balcão)</option>
                  {comandas.map((c) => (
                    <option key={c.id} value={c.id}>
                      Mesa {c.tableNumber} {c.clientName ? `- ${c.clientName}` : ''} ({c.status})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <Label className="text-xs text-stone-400">Valor Total do Documento (R$)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={docValue}
                  onChange={(e) => setDocValue(e.target.value)}
                  className="mt-1 bg-[#1C1917] border-[#44403C] text-stone-100 text-xs tabular-nums"
                  required
                />
              </div>
            </div>

            {/* Customer Name */}
            <div>
              <Label className="text-xs text-stone-400">Nome do Destinatário</Label>
              <Input
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                placeholder="Consumidor Final ou Razão Social..."
                className="mt-1 bg-[#1C1917] border-[#44403C] text-stone-100 text-xs"
              />
            </div>

            {/* CPF / CNPJ for NF-e or optional NFC-e */}
            {docType === 'NF-e' ? (
              <div className="p-3 rounded-xl bg-[#1C1917] border border-amber-500/40 space-y-1">
                <Label className="text-xs text-amber-400 font-semibold">
                  CPF ou CNPJ do Cliente (Obrigatório para NF-e)
                </Label>
                <Input
                  value={docNumber}
                  onChange={(e) => setDocNumber(e.target.value)}
                  placeholder="00.000.000/0000-00 ou 000.000.000-00"
                  className="mt-1 bg-[#292524] border-[#44403C] text-stone-100 text-xs"
                  required
                />
              </div>
            ) : (
              <div>
                <Label className="text-xs text-stone-400">CPF na Nota (Opcional para NFC-e)</Label>
                <Input
                  value={docNumber}
                  onChange={(e) => setDocNumber(e.target.value)}
                  placeholder="000.000.000-00 (Opcional)"
                  className="mt-1 bg-[#1C1917] border-[#44403C] text-stone-100 text-xs"
                />
              </div>
            )}

            {/* Submit Button with Loading Spinner */}
            <div className="pt-2">
              <Button
                type="submit"
                disabled={isEmitting}
                className="w-full bg-amber-500 hover:bg-amber-600 text-stone-950 font-black text-xs h-10 shadow-md shadow-amber-950/30 flex items-center justify-center gap-2 disabled:opacity-75"
              >
                {isEmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Comunicando com SEFAZ Virtual... (~2s)</span>
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    <span>Transmitir e Emitir Documento Fiscal</span>
                  </>
                )}
              </Button>
            </div>
          </form>
        </div>

        {/* Totais do Período Summary Card */}
        <div className="p-5 rounded-2xl bg-[#292524] border border-[#44403C] shadow-md flex flex-col justify-between">
          <div>
            <h3 className="font-bold text-base text-stone-100 mb-4 border-b border-[#44403C] pb-3">
              Totais do Período
            </h3>

            <div className="space-y-4 text-xs">
              <div>
                <span className="text-stone-400 block">Total de Documentos:</span>
                <span className="text-2xl font-black text-stone-100 tabular-nums">{totalDocs}</span>
              </div>

              <div>
                <span className="text-stone-400 block">Valor Total Emitido:</span>
                <span className="text-2xl font-black text-emerald-400 tabular-nums">
                  R$ {totalValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </span>
              </div>

              <div className="flex items-center justify-between text-stone-300 pt-2 border-t border-[#44403C]">
                <span>Documentos Cancelados:</span>
                <span className="font-bold text-red-400 tabular-nums">{canceledCount}</span>
              </div>

              {/* Authorization Rate with Progress Bar */}
              <div className="space-y-1.5 pt-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-stone-400">Taxa de Autorização SEFAZ:</span>
                  <span className="font-bold text-emerald-400 tabular-nums">
                    {authorizationRate.toFixed(1)}%
                  </span>
                </div>
                <div className="w-full bg-[#1C1917] h-2.5 rounded-full overflow-hidden border border-stone-800">
                  <div
                    className="bg-emerald-500 h-full rounded-full transition-all duration-500"
                    style={{ width: `${authorizationRate}%` }}
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="p-3 rounded-xl bg-[#1C1917] border border-[#44403C] text-[11px] text-stone-400 mt-6 flex items-start gap-2">
            <Info className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
            <span>
              Certificado Digital modelo A1 instalado ficticiamente com validade até 31/12/2025.
            </span>
          </div>
        </div>
      </div>

      {/* Issued Documents Table */}
      <div className="rounded-2xl bg-[#292524] border border-[#44403C] overflow-hidden shadow-md">
        <div className="p-4 bg-[#1C1917]/70 border-b border-[#44403C] flex items-center justify-between">
          <h3 className="font-bold text-sm text-stone-100 flex items-center gap-2">
            <FileCheck2 className="w-4 h-4 text-amber-500" />
            Documentos Fiscais Emitidos
          </h3>
          <span className="text-xs text-stone-400">{fiscalDocs.length} Registros</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-[#44403C] text-stone-400 uppercase tracking-wider text-[11px]">
                <th className="py-3 px-4 font-semibold">Número</th>
                <th className="py-3 px-4 font-semibold">Série</th>
                <th className="py-3 px-4 font-semibold">Tipo</th>
                <th className="py-3 px-4 font-semibold">Data de Emissão</th>
                <th className="py-3 px-4 font-semibold">Cliente</th>
                <th className="py-3 px-4 font-semibold">Valor</th>
                <th className="py-3 px-4 font-semibold">Status</th>
                <th className="py-3 px-4 font-semibold text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#44403C]/40">
              {fiscalDocs.map((doc) => (
                <tr key={doc.id} className="hover:bg-[#44403C]/30 transition-colors">
                  <td className="py-3.5 px-4 font-bold text-stone-100 font-mono">{doc.number}</td>
                  <td className="py-3.5 px-4 text-stone-400 font-mono">{doc.serie}</td>
                  <td className="py-3.5 px-4">
                    <Badge
                      variant="outline"
                      className="bg-[#1C1917] text-stone-300 border-stone-700 text-[10px]"
                    >
                      {doc.type}
                    </Badge>
                  </td>
                  <td className="py-3.5 px-4 text-stone-400 tabular-nums">
                    {doc.issuedAt.replace('T', ' ').substring(0, 16)}
                  </td>
                  <td className="py-3.5 px-4 text-stone-200">
                    <span className="font-semibold block truncate max-w-[140px]">
                      {doc.clientName || 'Consumidor Final'}
                    </span>
                    {doc.docNumber && (
                      <span className="text-[10px] text-stone-400 font-mono block">
                        {doc.docNumber}
                      </span>
                    )}
                  </td>
                  <td className="py-3.5 px-4 font-extrabold text-stone-100 tabular-nums">
                    R$ {doc.value.toFixed(2)}
                  </td>
                  <td className="py-3.5 px-4">
                    <Badge
                      className={
                        doc.status === 'Autorizada'
                          ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 text-[10px]'
                          : 'bg-red-500/20 text-red-400 border border-red-500/40 text-[10px]'
                      }
                    >
                      {doc.status}
                    </Badge>
                  </td>
                  <td className="py-3.5 px-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handlePrintDoc(doc)}
                        className="bg-[#1C1917] hover:bg-[#44403C] border-[#44403C] text-stone-300 text-xs h-7 px-2.5"
                        title="Imprimir DANFE"
                      >
                        <Printer className="w-3.5 h-3.5 mr-1 text-amber-500" />
                        Imprimir
                      </Button>

                      {doc.status === 'Autorizada' && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleCancelDoc(doc)}
                          className="bg-[#1C1917] hover:bg-red-500/20 border-[#44403C] hover:border-red-500/40 text-red-400 text-xs h-7 px-2.5"
                          title="Cancelar Documento"
                        >
                          <XCircle className="w-3.5 h-3.5 mr-1" />
                          Cancelar
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
