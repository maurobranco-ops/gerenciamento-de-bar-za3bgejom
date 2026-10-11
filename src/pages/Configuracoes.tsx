import React, { useState, useEffect } from 'react'
import {
  Settings,
  Percent,
  Truck,
  Building,
  Printer,
  Save,
  RotateCcw,
  ShieldCheck,
  CheckCircle2,
  FileText,
  Phone,
  MapPin,
  HelpCircle,
} from 'lucide-react'
import { useBar } from '../context/BarContext'
import { BarSettings } from '../types/bar'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Label } from '../components/ui/label'
import { Switch } from '../components/ui/switch'
import { Badge } from '../components/ui/badge'

export default function Configuracoes() {
  const { settings, updateSettings, checkRoleAccess } = useBar()
  const [formData, setFormData] = useState<BarSettings>(settings)
  const [isSaving, setIsSaving] = useState(false)
  const [savedSuccess, setSavedSuccess] = useState(false)

  // Sincroniza estado local quando as configurações carregam do banco
  useEffect(() => {
    if (settings) {
      setFormData(settings)
    }
  }, [settings])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!checkRoleAccess(['Gerente'], 'alterar configurações gerais do bar')) return

    setIsSaving(true)
    setSavedSuccess(false)
    try {
      const ok = await updateSettings(formData)
      if (ok) {
        setSavedSuccess(true)
        setTimeout(() => setSavedSuccess(false), 3000)
      }
    } finally {
      setIsSaving(false)
    }
  }

  const handleResetToCurrent = () => {
    setFormData(settings)
  }

  return (
    <div className="space-y-6 animate-fade-in-up max-w-5xl">
      {/* Header */}
      <div className="p-5 rounded-2xl bg-[#292524] border border-[#44403C] flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-500">
              <Settings className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-black text-stone-100 flex items-center gap-2">
                Configurações Gerais do Rachide Bar
                <Badge className="bg-amber-500/15 text-amber-400 border-amber-500/40 text-xs font-bold">
                  Exclusivo Gerente
                </Badge>
              </h2>
              <p className="text-xs text-stone-400 mt-1">
                Ajuste de taxas de serviço e delivery, dados cadastrais do emitente fiscal e
                impressoras.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Badge
            variant="outline"
            className="bg-[#1C1917] text-emerald-400 border-emerald-500/30 text-xs py-1.5 px-3 flex items-center gap-1.5"
          >
            <ShieldCheck className="w-4 h-4 text-emerald-500" />
            Persistido em configuracoes_bar (Supabase)
          </Badge>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Bloco 1: Taxas do Bar e Delivery */}
        <div className="p-5 rounded-2xl bg-[#292524] border border-[#44403C] space-y-4 shadow-sm">
          <div className="flex items-center gap-2 border-b border-[#44403C] pb-3">
            <Percent className="w-5 h-5 text-amber-500" />
            <h3 className="font-bold text-base text-stone-100">Taxas e Serviços Operacionais</h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div className="space-y-1.5">
              <Label className="text-xs text-stone-300 font-semibold flex items-center gap-1.5">
                <span>Taxa de Serviço Padrão das Comandas (%)</span>
              </Label>
              <div className="relative">
                <Input
                  type="number"
                  step="0.5"
                  min="0"
                  max="30"
                  value={formData.taxaServicoPadrao}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      taxaServicoPadrao: parseFloat(e.target.value) || 0,
                    }))
                  }
                  className="bg-[#1C1917] border-[#44403C] text-stone-100 text-sm font-bold tabular-nums pr-8"
                  required
                />
                <span className="absolute right-3 top-2.5 text-stone-400 font-bold">%</span>
              </div>
              <p className="text-[11px] text-stone-400">
                Aplicada automaticamente quando a comanda estiver com a opção &quot;Incluir Taxa de
                Serviço&quot; marcada. Padrão sugerido: 10%.
              </p>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs text-stone-300 font-semibold flex items-center gap-1.5">
                <Truck className="w-4 h-4 text-amber-500" />
                <span>Taxa de Entrega Padrão (Delivery On-line) (R$)</span>
              </Label>
              <div className="relative">
                <Input
                  type="number"
                  step="0.50"
                  min="0"
                  value={formData.taxaEntregaDelivery}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      taxaEntregaDelivery: parseFloat(e.target.value) || 0,
                    }))
                  }
                  className="bg-[#1C1917] border-[#44403C] text-stone-100 text-sm font-bold tabular-nums pl-9"
                  required
                />
                <span className="absolute left-3 top-2.5 text-stone-400 font-bold">R$</span>
              </div>
              <p className="text-[11px] text-stone-400">
                Valor padrão para pedidos solicitados via QR Code / Web App no modo Delivery /
                Retirada.
              </p>
            </div>
          </div>
        </div>

        {/* Bloco 2: Dados do Emitente Fiscal (Simulador SEFAZ) */}
        <div className="p-5 rounded-2xl bg-[#292524] border border-[#44403C] space-y-4 shadow-sm">
          <div className="flex items-center justify-between border-b border-[#44403C] pb-3">
            <div className="flex items-center gap-2">
              <Building className="w-5 h-5 text-amber-500" />
              <h3 className="font-bold text-base text-stone-100">
                Dados do Emitente Fiscal (DANFE & SEFAZ)
              </h3>
            </div>
            <span className="text-[11px] text-stone-400">
              Utilizados na impressão e nos documentos fiscais NFC-e/NF-e
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div className="space-y-1.5">
              <Label className="text-xs text-stone-300 font-semibold">Nome Fantasia</Label>
              <Input
                value={formData.nomeFantasia}
                onChange={(e) => setFormData((prev) => ({ ...prev, nomeFantasia: e.target.value }))}
                className="bg-[#1C1917] border-[#44403C] text-stone-100 text-xs"
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs text-stone-300 font-semibold">Razão Social Completa</Label>
              <Input
                value={formData.razaoSocial}
                onChange={(e) => setFormData((prev) => ({ ...prev, razaoSocial: e.target.value }))}
                className="bg-[#1C1917] border-[#44403C] text-stone-100 text-xs"
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs text-stone-300 font-semibold">CNPJ do Emitente</Label>
              <Input
                value={formData.cnpj}
                onChange={(e) => setFormData((prev) => ({ ...prev, cnpj: e.target.value }))}
                className="bg-[#1C1917] border-[#44403C] text-stone-100 text-xs font-mono"
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs text-stone-300 font-semibold">
                Inscrição Estadual (IE)
              </Label>
              <Input
                value={formData.inscricaoEstadual}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, inscricaoEstadual: e.target.value }))
                }
                className="bg-[#1C1917] border-[#44403C] text-stone-100 text-xs font-mono"
              />
            </div>

            <div className="space-y-1.5 md:col-span-2">
              <Label className="text-xs text-stone-300 font-semibold flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-stone-400" />
                <span>Endereço Comercial Completo</span>
              </Label>
              <Input
                value={formData.enderecoCompleto}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, enderecoCompleto: e.target.value }))
                }
                className="bg-[#1C1917] border-[#44403C] text-stone-100 text-xs"
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs text-stone-300 font-semibold flex items-center gap-1.5">
                <Phone className="w-3.5 h-3.5 text-stone-400" />
                <span>Telefone de Contato do Estabelecimento</span>
              </Label>
              <Input
                value={formData.telefone}
                onChange={(e) => setFormData((prev) => ({ ...prev, telefone: e.target.value }))}
                className="bg-[#1C1917] border-[#44403C] text-stone-100 text-xs"
              />
            </div>
          </div>
        </div>

        {/* Bloco 3: Hardware e Impressoras Térmicas */}
        <div className="p-5 rounded-2xl bg-[#292524] border border-[#44403C] space-y-4 shadow-sm">
          <div className="flex items-center gap-2 border-b border-[#44403C] pb-3">
            <Printer className="w-5 h-5 text-amber-500" />
            <h3 className="font-bold text-base text-stone-100">
              Impressoras Térmicas & Spoolers de Produção (80mm)
            </h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            {/* Impressora Cozinha / Bar */}
            <div className="p-4 rounded-xl bg-[#1C1917] border border-[#44403C] space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-bold text-stone-200">Impressora de Cozinha / Bar (KDS)</span>
                <div className="flex items-center gap-2">
                  <Switch
                    checked={formData.impressoraCozinhaAtiva}
                    onCheckedChange={(val) =>
                      setFormData((prev) => ({ ...prev, impressoraCozinhaAtiva: val }))
                    }
                    className="data-[state=checked]:bg-emerald-500"
                  />
                  <span className="text-[11px] text-stone-400">
                    {formData.impressoraCozinhaAtiva ? 'Ativa' : 'Inativa'}
                  </span>
                </div>
              </div>
              <div>
                <Label className="text-[11px] text-stone-400">Modelo / Nome da Impressora</Label>
                <Input
                  value={formData.impressoraCozinhaNome}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, impressoraCozinhaNome: e.target.value }))
                  }
                  className="mt-1 bg-[#292524] border-[#44403C] text-stone-100 text-xs"
                  placeholder="Ex: Bematech MP-4200 TH"
                />
              </div>
              <p className="text-[10px] text-stone-400">
                Dispara impressão de tickets das comandas para a praça de preparo selecionada.
              </p>
            </div>

            {/* Impressora Fiscal / Caixa */}
            <div className="p-4 rounded-xl bg-[#1C1917] border border-[#44403C] space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-bold text-stone-200">Impressora de Caixa / Cupom Fiscal</span>
                <div className="flex items-center gap-2">
                  <Switch
                    checked={formData.impressoraFiscalAtiva}
                    onCheckedChange={(val) =>
                      setFormData((prev) => ({ ...prev, impressoraFiscalAtiva: val }))
                    }
                    className="data-[state=checked]:bg-emerald-500"
                  />
                  <span className="text-[11px] text-stone-400">
                    {formData.impressoraFiscalAtiva ? 'Ativa' : 'Inativa'}
                  </span>
                </div>
              </div>
              <div>
                <Label className="text-[11px] text-stone-400">Modelo / Nome da Impressora</Label>
                <Input
                  value={formData.impressoraFiscalNome}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, impressoraFiscalNome: e.target.value }))
                  }
                  className="mt-1 bg-[#292524] border-[#44403C] text-stone-100 text-xs"
                  placeholder="Ex: Epson TM-T20X"
                />
              </div>
              <p className="text-[10px] text-stone-400">
                Utilizada para conferência de conta na mesa e emissão de DANFE NFC-e.
              </p>
            </div>
          </div>
        </div>

        {/* Rodapé com botões de ação */}
        <div className="p-4 rounded-2xl bg-[#292524] border border-[#44403C] flex items-center justify-between">
          <div className="text-xs text-stone-400 flex items-center gap-2">
            <HelpCircle className="w-4 h-4 text-amber-500" />
            <span>As alterações são aplicadas imediatamente a novos fechamentos de comanda.</span>
          </div>

          <div className="flex items-center gap-3">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleResetToCurrent}
              className="bg-[#1C1917] border-[#44403C] text-stone-300 hover:text-white text-xs"
            >
              <RotateCcw className="w-3.5 h-3.5 mr-1.5" />
              Descartar Alterações
            </Button>

            <Button
              type="submit"
              disabled={isSaving}
              className="bg-amber-500 hover:bg-amber-600 text-stone-950 font-black text-xs px-6 shadow-md shadow-amber-950/40 flex items-center gap-2"
            >
              {savedSuccess ? (
                <>
                  <CheckCircle2 className="w-4 h-4 text-stone-950" />
                  Salvo com Sucesso!
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  Salvar Configurações
                </>
              )}
            </Button>
          </div>
        </div>
      </form>
    </div>
  )
}
