import React, { useState } from 'react'
import {
  Download,
  Printer,
  FileText,
  ShieldCheck,
  CheckCircle,
  Building2,
  Server,
  Code2,
  Layers,
  ArrowRight,
  Sparkles,
  Info,
} from 'lucide-react'
import { DOCUMENTO_PLANO_NFCE } from '../lib/planoNfceData'
import { downloadPdfFile, printDocumentView, PDF_FILENAME } from '../lib/pdfGenerator'
import { Button } from '../components/ui/button'
import { Badge } from '../components/ui/badge'
import { useToast } from '../hooks/use-toast'

export default function PlanoNFCe() {
  const { toast } = useToast()
  const doc = DOCUMENTO_PLANO_NFCE
  const [downloading, setDownloading] = useState(false)

  const handleDownload = () => {
    setDownloading(true)
    try {
      downloadPdfFile()
      toast({
        title: 'Arquivo PDF gerado!',
        description: `Download de "${PDF_FILENAME}" iniciado com sucesso.`,
      })
    } catch {
      toast({
        variant: 'destructive',
        title: 'Erro na geração',
        description: 'Não foi possível baixar o arquivo diretamente. Tentando abrir impressão...',
      })
      window.print()
    } finally {
      setTimeout(() => setDownloading(false), 800)
    }
  }

  const handlePrint = () => {
    toast({
      title: 'Abrindo visualizador de impressão',
      description:
        'Dica: Selecione "Salvar como PDF" no destino para gerar uma cópia vetorial perfeita.',
    })
    printDocumentView()
  }

  return (
    <div className="space-y-8 animate-fade-in-up pb-16">
      {/* Barra de Ações do Documento (oculta na impressão) */}
      <div className="print:hidden p-5 rounded-2xl bg-[#292524] border border-[#44403C] shadow-lg flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30 text-xs font-semibold px-2.5 py-0.5">
              Documento Oficial • v{doc.meta.versao}
            </Badge>
            <span className="text-xs text-stone-400 flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              Provedor Fiscal Homologado
            </span>
          </div>
          <h2 className="text-xl font-black text-stone-100 mt-1">
            Plano de Implantação — Provedor de NFC-e SEFAZ Paraíba
          </h2>
          <p className="text-xs text-stone-400 mt-0.5">
            Documento técnico e comercial completo para implantação da plataforma multi-empresa e
            arquitetura do Rachide Bar como piloto.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto">
          <Button
            onClick={handlePrint}
            variant="outline"
            size="sm"
            className="bg-[#1C1917] border-[#44403C] hover:bg-[#44403C] text-stone-200 text-xs font-semibold flex items-center gap-2 h-9 flex-1 sm:flex-initial"
            title="Imprimir ou Salvar via Navegador em Alta Resolução"
          >
            <Printer className="w-4 h-4 text-amber-500" />
            <span>Imprimir / Visualizar A4</span>
          </Button>

          <Button
            onClick={handleDownload}
            disabled={downloading}
            size="sm"
            className="bg-amber-500 hover:bg-amber-600 text-stone-950 font-black text-xs flex items-center gap-2 h-9 shadow-md shadow-amber-950/30 flex-1 sm:flex-initial"
            title={`Baixar ${PDF_FILENAME}`}
          >
            <Download className="w-4 h-4" />
            <span>{downloading ? 'Gerando PDF...' : 'Baixar PDF'}</span>
          </Button>
        </div>
      </div>

      {/* Dica de exportação de documento */}
      <div className="print:hidden p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-start gap-3 text-xs text-amber-200/90">
        <Info className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
        <div>
          <span className="font-bold text-amber-300">Como obter o PDF no seu dispositivo:</span>{' '}
          Você pode clicar em <strong>&quot;Baixar PDF&quot;</strong> para salvar o arquivo real{' '}
          <code className="text-amber-200 bg-black/40 px-1 py-0.5 rounded text-[11px]">
            {PDF_FILENAME}
          </code>{' '}
          diretamente, ou em <strong>&quot;Imprimir / Visualizar A4&quot;</strong> e selecionar a
          opção <em>&quot;Salvar como PDF&quot;</em> do navegador para gerar um documento gráfico
          completo com paginação e cabeçalho corporativo.
        </div>
      </div>

      {/* ÁREA FORMAL DO DOCUMENTO (renderizada na tela e formatada para A4 no print) */}
      <div className="documento-pdf-container bg-white text-neutral-900 rounded-2xl shadow-2xl p-6 sm:p-10 lg:p-14 border border-stone-300 print:border-none print:shadow-none print:p-0 print:rounded-none">
        {/* CAPA FORMAL DO DOCUMENTO */}
        <section className="capa-documento border-b-2 border-neutral-900 pb-10 mb-10 print:min-h-[85vh] print:flex print:flex-col print:justify-between print:border-b-4 print:pb-16 print:mb-0 print:page-break-after-always">
          <div>
            <div className="flex items-center justify-between text-xs tracking-wider uppercase text-neutral-500 font-semibold border-b border-neutral-200 pb-4 mb-8">
              <span>{doc.meta.classificacao}</span>
              <span>{doc.meta.dataEmissao}</span>
            </div>

            <div className="inline-block px-3 py-1 bg-amber-500/20 text-amber-800 text-xs font-bold rounded-md uppercase tracking-wider mb-4 border border-amber-400">
              Provedor Regional Paraíba (NFC-e Mod. 65)
            </div>

            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black text-neutral-950 tracking-tight leading-tight">
              {doc.meta.titulo}
            </h1>

            <p className="text-base sm:text-lg text-neutral-600 mt-4 leading-relaxed font-medium max-w-3xl">
              {doc.meta.subtitulo}
            </p>
          </div>

          <div className="mt-10 pt-6 border-t border-neutral-200 grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
            <div>
              <span className="text-neutral-600 block uppercase font-bold text-[10px]">Versão</span>
              <span className="font-bold text-neutral-900">{doc.meta.versao}</span>
            </div>
            <div>
              <span className="text-neutral-600 block uppercase font-bold text-[10px]">
                Autor & Arquitetura
              </span>
              <span className="font-bold text-neutral-900">{doc.meta.autor}</span>
            </div>
            <div>
              <span className="text-neutral-600 block uppercase font-bold text-[10px]">
                Jurisdição Fiscal
              </span>
              <span className="font-bold text-neutral-900">SEFAZ Paraíba (PB)</span>
            </div>
            <div>
              <span className="text-neutral-600 block uppercase font-bold text-[10px]">
                Cliente Piloto
              </span>
              <span className="font-bold text-neutral-900">Rachide Bar & Restaurante</span>
            </div>
          </div>
        </section>

        {/* SUMÁRIO EXECUTIVO */}
        <section className="mb-10 pb-8 border-b border-neutral-200 print:mb-12 print:page-break-after-always">
          <div className="flex items-center gap-2 mb-4">
            <FileText className="w-5 h-5 text-amber-600" />
            <h2 className="text-lg font-black text-neutral-900 uppercase tracking-wide">
              Sumário do Documento
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 text-xs text-neutral-700 font-medium">
            {doc.secoes.map((sec) => (
              <a
                key={sec.id}
                href={`#${sec.id}`}
                className="p-2.5 rounded-lg border border-neutral-200 hover:border-amber-500 hover:bg-amber-50/50 flex items-center justify-between transition-colors print:border-none print:p-1"
              >
                <span className="flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-neutral-900 text-white font-bold flex items-center justify-center text-[10px]">
                    {sec.number}
                  </span>
                  <span className="font-semibold text-neutral-900 truncate max-w-[280px]">
                    {sec.title}
                  </span>
                </span>
                <ArrowRight className="w-3.5 h-3.5 text-neutral-400 print:hidden" />
              </a>
            ))}
          </div>
        </section>

        {/* SEÇÕES DETALHADAS DO DOCUMENTO */}
        <div className="space-y-12">
          {doc.secoes.map((sec) => (
            <article
              key={sec.id}
              id={sec.id}
              className="secao-documento print:page-break-inside-avoid print:pt-6 pt-2"
            >
              {/* Cabeçalho da Seção */}
              <div className="border-b-2 border-neutral-900 pb-2 mb-4 flex items-baseline gap-3">
                <span className="text-2xl sm:text-3xl font-black text-amber-600">
                  {sec.number}.
                </span>
                <h3 className="text-xl sm:text-2xl font-black text-neutral-900 tracking-tight">
                  {sec.title}
                </h3>
              </div>

              {/* Lead / Resumo em destaque */}
              <div className="p-3.5 rounded-xl bg-neutral-100 border-l-4 border-amber-500 text-xs sm:text-sm text-neutral-800 font-semibold mb-5 leading-relaxed">
                {sec.lead}
              </div>

              {/* Parágrafos da Seção */}
              <div className="space-y-3.5 text-xs sm:text-sm text-neutral-700 leading-relaxed text-justify">
                {sec.paragraphs.map((p, idx) => (
                  <p key={idx}>{p}</p>
                ))}
              </div>

              {/* Subseções com tabelas ou listas */}
              {sec.subsections && sec.subsections.length > 0 && (
                <div className="mt-6 space-y-6">
                  {sec.subsections.map((sub, sIdx) => (
                    <div
                      key={sIdx}
                      className="p-4 rounded-xl bg-neutral-50 border border-neutral-200"
                    >
                      <h4 className="text-sm font-bold text-neutral-900 mb-2 flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-amber-500" />
                        {sub.subtitle}
                      </h4>

                      <div className="space-y-2 text-xs sm:text-sm text-neutral-700 leading-relaxed mb-3">
                        {sub.paragraphs.map((sp, pIdx) => (
                          <p key={pIdx}>{sp}</p>
                        ))}
                      </div>

                      {/* Tabela, se houver */}
                      {sub.table && (
                        <div className="overflow-x-auto mt-3 border border-neutral-300 rounded-lg">
                          <table className="w-full text-left text-xs">
                            <thead className="bg-neutral-900 text-white uppercase text-[10px] tracking-wider">
                              <tr>
                                {sub.table.headers.map((h, hIdx) => (
                                  <th key={hIdx} className="py-2.5 px-3 font-bold">
                                    {h}
                                  </th>
                                ))}
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-neutral-200 bg-white">
                              {sub.table.rows.map((row, rIdx) => (
                                <tr
                                  key={rIdx}
                                  className={rIdx % 2 === 0 ? 'bg-white' : 'bg-neutral-50'}
                                >
                                  {row.map((cell, cIdx) => (
                                    <td
                                      key={cIdx}
                                      className={`py-2 px-3 text-neutral-800 ${
                                        cIdx === 1 || cIdx === 2
                                          ? 'font-semibold text-neutral-900'
                                          : ''
                                      }`}
                                    >
                                      {cell}
                                    </td>
                                  ))}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Highlight Box */}
              {sec.highlightBox && (
                <div className="mt-5 p-3.5 rounded-xl bg-amber-50 border border-amber-300 flex items-start gap-3">
                  <Sparkles className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                  <div className="text-xs">
                    <span className="font-bold text-amber-900 block mb-0.5">
                      {sec.highlightBox.title}
                    </span>
                    <p className="text-amber-800 leading-relaxed">{sec.highlightBox.text}</p>
                  </div>
                </div>
              )}
            </article>
          ))}
        </div>

        {/* ASSINATURA / ENCERRAMENTO FORMAL */}
        <footer className="mt-16 pt-8 border-t-2 border-neutral-900 text-xs text-neutral-500 flex flex-col sm:flex-row items-center justify-between gap-4 print:page-break-inside-avoid">
          <div>
            <div className="font-bold text-neutral-900">
              Plano de Implantação — Provedor de NFC-e SEFAZ Paraíba
            </div>
            <div>Documento Técnico e Executivo v1.0 • Registro de Propriedade do Rachide Bar</div>
          </div>
          <div className="text-right">
            <div>João Pessoa / PB • Brasil</div>
            <div className="font-semibold text-neutral-700">Validação Técnica SEFAZ-PB</div>
          </div>
        </footer>
      </div>

      {/* Estilos dedicados para impressão em PDF formal */}
      <style>{`
        @media print {
          @page {
            size: A4 portrait;
            margin: 15mm 12mm 15mm 12mm;
          }
          body {
            background-color: #ffffff !important;
            color: #171717 !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          header, aside, nav, footer, .print\\:hidden {
            display: none !important;
          }
          main {
            margin: 0 !important;
            padding: 0 !important;
            max-width: 100% !important;
          }
          .documento-pdf-container {
            box-shadow: none !important;
            border: none !important;
            padding: 0 !important;
            margin: 0 !important;
            background: #ffffff !important;
          }
          .capa-documento {
            page-break-after: always;
          }
          .secao-documento {
            page-break-inside: avoid;
            margin-top: 1.5rem;
          }
          h1, h2, h3, h4 {
            page-break-after: avoid;
          }
        }
      `}</style>
    </div>
  )
}
