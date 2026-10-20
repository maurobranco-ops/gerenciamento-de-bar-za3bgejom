/**
 * Geração de arquivo PDF para o Plano de Implantação do Provedor de NFC-e SEFAZ Paraíba.
 * Produz um arquivo PDF padrão válido sem dependências externas pesadas e com suporte
 * a download de arquivo nomeado 'Plano-de-Implantacao-Provedor-NFCE-SEFAZ-Paraiba.pdf',
 * além de disparar a impressão nativa com CSS otimizado para PDF formal vetorial.
 */

export interface DocumentSection {
  id: string
  number: string
  title: string
  lead: string
  paragraphs: string[]
  subsections?: {
    subtitle: string
    paragraphs: string[]
    table?: {
      headers: string[]
      rows: string[][]
    }
  }[]
  highlightBox?: {
    title: string
    text: string
  }
}

export const DOCUMENTO_PLANO_NFCE = {
  meta: {
    titulo: 'Plano de Implantação — Provedor de NFC-e SEFAZ Paraíba',
    subtitulo:
      'Arquitetura, Modelo de Negócio, Homologação e Requisitos Multi-Tenant para Plataforma Regional de Emissão Fiscal (Modelo 65)',
    versao: '1.0',
    dataEmissao: 'Março de 2025',
    autor: 'Rachide Bar & Automação Comercial PB',
    status: 'Documento Executivo & Especificação Técnica',
    classificacao: 'Uso Estratégico e de Engenharia',
  },
  secoes: [
    {
      id: 'visao-modelo',
      number: '1',
      title: 'Visão Geral & Modelo de Negócio do Provedor',
      lead: 'Posicionamento como provedor regional independente de tecnologia fiscal na Paraíba, competindo com grandes players nacionais com menor latência, suporte consultivo local e precificação agressiva orientada a volume.',
      paragraphs: [
        'O objetivo central deste plano é transformar a tecnologia fiscal desenvolvida no âmbito do Rachide Bar em um provedor de infraestrutura de NFC-e (Nota Fiscal de Consumidor Eletrônica, modelo 65) no estado da Paraíba. No mercado nacional, empresas como Focus NFe, eNotas, PlugNotas/TecnoSpeed e SpeedGov dominam o segmento de APIs fiscais para desenvolvedores de software, porém mantêm modelos de cobrança genéricos, cobrança em planos rígidos ou preços desproporcionais para comércios de pequeno e médio porte com pico de volume concentrado aos fins de semana.',
        'Como provedor paraibano, a plataforma atenderá tanto empresas de automação comercial (ISVs e software houses de PDV) quanto estabelecimentos comerciais diretos (bares, restaurantes, padarias, mercadinhos e lojas de varejo). A infraestrutura abstrai 100% da complexidade de comunicação SOAP, montagem de XML no padrão da Nota Fiscal Eletrônica, assinatura digital com certificados e-CNPJ A1, tratamento de contingência off-line e atualização perante notas técnicas do ENCAT/SEFAZ.',
        'O modelo de receita fundamenta-se estritamente na cobrança por volume de documentos transmitidos e autorizados. Adota-se uma estrutura de faixas mensais progressivas e franquias com valor unitário decrescente, além de pacotes de pré-pago ou pós-pago faturado:',
      ],
      subsections: [
        {
          subtitle: 'Tabela de Precificação Estratégica por Faixa de Volume',
          paragraphs: [
            'Diferente das APIs tradicionais que cobram taxas de adesão exorbitantes ou mensalidades mínimas pesadas, a estrutura do Provedor Paraíba é calibrada para alta conversão de software houses e pequenos comerciantes locais:',
          ],
          table: {
            headers: [
              'Faixa de Emissões / Mês',
              'Valor Base Mensal',
              'Custo Excedente por Nota',
              'Perfil Típico de Cliente',
            ],
            rows: [
              [
                'Até 500 notas',
                'R$ 39,00 / mês',
                'R$ 0,08 por NFC-e',
                'Bares pequenos, cafeterias e quiosques',
              ],
              [
                'De 501 a 2.500 notas',
                'R$ 89,00 / mês',
                'R$ 0,05 por NFC-e',
                'Rachide Bar, gastrobares, pizzarias',
              ],
              [
                'De 2.501 a 10.000 notas',
                'R$ 189,00 / mês',
                'R$ 0,03 por NFC-e',
                'Restaurantes com alto giro e mercadinhos',
              ],
              [
                'Acima de 10.000 notas',
                'R$ 320,00 + R$ 0,02/nota',
                'R$ 0,02 por NFC-e',
                'Parceiros de ERP e redes de varejo regional',
              ],
            ],
          },
        },
        {
          subtitle: 'Diferencial Competitivo e Piloto com o Rachide Bar',
          paragraphs: [
            'O Rachide Bar atua simultaneamente como demandante inicial, ambiente de testes em escala real e vitrine comercial. A validação sob carga real em noites de sexta e sábado permite comprovar a estabilidade do pipeline de envio de notas fiscais sob estresse, eliminando o risco técnico antes da oferta massiva a terceiros.',
          ],
        },
      ],
      highlightBox: {
        title: 'Tese Central de Negócio',
        text: 'Provedor de infraestrutura fiscal especializado na Paraíba: menor custo operacional, foco em um único autorizador estadual, suporte com resolução no mesmo dia e modelo comercial ganha-ganha atrelado ao sucesso de emissões do cliente.',
      },
    },
    {
      id: 'recorte-paraiba',
      number: '2',
      title: 'Vantagens Estratégicas do Recorte SEFAZ Paraíba',
      lead: 'A especialização na circunscrição fiscal da Paraíba reduz exponencialmente a complexidade técnica frente a soluções nacionais que precisam gerenciar peculiaridades dos 27 estados da federação.',
      paragraphs: [
        'Desenvolver e manter um provedor fiscal de cobertura nacional exige gerenciar 27 webservices estaduais distintos, servidores virtuais (SVAN e SVRS), regras de contingência heterogêneas (EPEC, FS-DA, contingência offline) e frequentes instabilidades assimétricas. Ao focar exclusivamente na Secretaria de Estado da Fazenda da Paraíba (SEFAZ-PB), a arquitetura ganha robustez, agilidade de resposta e custo de sustentação enxuto.',
        'A SEFAZ-PB oferece um ambiente fiscal amplamente padronizado e maduro para o documento NFC-e modelo 65, com três pilares regulatórios extremamente favoráveis:',
      ],
      subsections: [
        {
          subtitle: 'Pilares Operacionais e Regulatórios da SEFAZ-PB',
          paragraphs: [
            '1. Credenciamento Automático e Rápido: Para qualquer empresa inscrita no Cadastro de Contribuintes do ICMS da Paraíba com CNAE compatível com comércio varejista (como a divisão 56 para alimentação e bebidas), o credenciamento de emissor de NFC-e é realizado via SER Virtual (Sistema Eletrônico de Atendimento da Receita Estadual) e liberado automaticamente em até 1 dia útil, sem necessidade de homologação física ou burocracia presencial.',
            '2. Geração Online Instantânea do CSC (Código de Segurança do Contribuinte): O CSC e seu respectivo identificador (IdCSC) são gerados pelo próprio contador ou sócio administrador dentro do Portal de Serviços da Receita Estadual da Paraíba. O sistema do provedor precisa apenas armazenar com criptografia a chave alfanumérica do CSC e o IdCSC para montagem da URL de consulta e assinatura do QR Code da NFC-e.',
            '3. Contingência Exclusivamente Off-line (tpEmis=9): A legislação paraibana adota o modelo mais moderno e fluido para o varejo: a contingência off-line. Quando a conexão com a internet cair ou o webservice da SEFAZ-PB oscilar, a NFC-e é gerada e impressa localmente com motivo da contingência e transmitida para a SEFAZ em até 24 horas após o retorno da conectividade. Não há exigência de transmissão prévia de evento EPEC para consumidor final.',
            '4. Concentração em um Único Barramento Autorizador: O provedor precisa calibrar endpoints SOAP, certificados de CA raiz, timeouts e tabelas de retorno contra apenas uma autoridade fiscal. Isso reduz a zero o ruído de divergências de schema entre estados e permite monitoramento em tempo real da saúde da SEFAZ-PB.',
          ],
        },
      ],
      highlightBox: {
        title: 'Eficiência de Escopo',
        text: '1 único autorizador estadual para homologar e dominar vs. 27 autorizadores nas APIs nacionais. Menor índice de falhas, curva de suporte ágil e alta previsibilidade.',
      },
    },
    {
      id: 'arquitetura-mvp',
      number: '3',
      title: 'Arquitetura de Engenharia do MVP',
      lead: 'Plataforma multi-tenant orientada a micro-serviços com API REST pública, gerador de XML 65, assinador criptográfico A1, cliente SOAP SEFAZ, mensageria com retentativas, disparador de webhooks, renderizador DANFE e painel analítico.',
      paragraphs: [
        'A plataforma do Provedor NFC-e Paraíba é estruturada em camadas desacopladas para garantir escalabilidade horizontal, tolerância a falhas e isolamento estrito de dados entre diferentes empresas emitentes.',
        'Cada requisição de emissão segue um fluxo assíncrono idempotente, protegido por chaves de API individuais por empresa cadastrada, assegurando que gargalos pontuais na autorizadora governamental nunca travem o caixa do lojista.',
      ],
      subsections: [
        {
          subtitle: 'Componentes Centrais do Provedor de NFC-e',
          paragraphs: [
            '1. Multi-Tenant Gateway & API REST: Ponto de entrada seguro HTTPS que autentica requisições via Token Bearer/API Key corporativa. Recebe payload JSON padronizado com itens da venda, formas de pagamento, dados do consumidor (opcional) e parâmetros tributários simplificados (NCM, CFOP 5102/5405, CST/CSOSN do Simples Nacional). Valida schema JSON e gera protocolo de rastreio interno imediatamente.',
            '2. Motor de Conversão & Validador XML (Modelo 65): Transforma o payload JSON no documento XML estritamente aderente ao Manual de Orientação do Contribuinte (MOC da NFC-e v4.00). Executa pré-validação sintática de regras de negócio locais (totalizadores de ICMS, somatório de troco, alíquotas aproximadas do IBPT pela Lei da Transparência nº 12.741/2012).',
            '3. Assinador Digital Criptográfico A1: Módulo isolado com chave criptográfica em hardware/KMS (Key Management Service) que recupera o certificado digital e-CNPJ A1 (.pfx/.p12) da empresa solicitante, descriptografa a chave privada em memória efêmera e gera a assinatura digital XML-DSig (padrão RSA-SHA1 com Canonicalization C14N).',
            '4. Cliente SOAP & Conector SEFAZ-PB: Gerencia a conexão TLS 1.2 com a SEFAZ Paraíba, efetuando o envelope SOAP para os serviços NfeAutorizacao4, NfeRetAutorizacao4, NfeInutilizacao4 e NfeStatusServico4. Constrói a URL do QR Code da NFC-e aplicando o algoritmo HMAC-SHA1 concatenando a chave de acesso, versão do QR Code, ambiente e token CSC.',
            '5. Fila de Mensageria com Retentativas (Exponential Backoff): Se o serviço da SEFAZ apresentar resposta lenta (HTTP 504) ou retorno transitório (código 108/109 - serviço paralisado), a mensagem permanece em fila de retransmissão com espaçamento progressivo, evitando rejeições indevidas por sobrecarga.',
            '6. Webhooks de Notificação em Tempo Real: Assim que a resposta final da SEFAZ é processada (Autorizada [100], Rejeitada com código de erro, ou Cancelada), o provedor envia um POST HTTPS assinado com HMAC secret para a URL de webhook cadastrada pelo software de automação do cliente.',
            '7. Gerador de DANFE (Documento Auxiliar da NFC-e): Renderizador de layout térmico 80mm/58mm e formato PDF padrão A4 simplificado. Inclui todos os campos obrigatórios pelo Fisco paraibano: dados do emitente, detalhamento de itens, chave de acesso de 44 dígitos com código de barras Code 128, QR Code escaneável e mensagem legal.',
            '8. Painel de Gestão do Provedor (Dashboard Multi-Empresa): Interface web para o administrador do provedor acompanhar em tempo real o volume de notas emitidas por cliente, tempo médio de autorização da SEFAZ-PB, ranking de rejeições mais frequentes, consumo de franquia e status dos certificados cadastrados.',
            '9. Módulo de Tarifação & Cobrança por Volume: Motor que contabiliza mensalmente o volume de notas autorizadas por tenant, consolida o demonstrativo de faturamento e gera cobrança via Pix ou boleto de acordo com a tabela de preços contratada.',
          ],
        },
        {
          subtitle: 'Fluxo Ponta a Ponta de Emissão',
          paragraphs: [
            'Etapa 1: O PDV/sistema do bar finaliza uma conta e envia requisição POST /v1/nfce com JSON da venda para a API do provedor.',
            'Etapa 2: A API valida as credenciais do tenant, debita o limite de emissão e salva o evento com status "Processando".',
            'Etapa 3: O gerador monta o XML 65 com chave de acesso calculada (UF 25 - Paraíba, ano, mês, CNPJ, modelo 65, série, número, tipo de emissão e código numérico aleatório com dígito verificador módulo 11).',
            'Etapa 4: O assinador assina digitalmente a tag infNFe e anexa o QR Code gerado com o CSC do contribuinte.',
            'Etapa 5: O conector transmite o lote para a SEFAZ-PB via SOAP. Em caso de autorização imediata, recebe o protocolo de autorização de uso.',
            'Etapa 6: O provedor salva o XML protocolado e o PDF do DANFE no bucket de arquivos seguro e dispara notificação imediata via Webhook para o PDV.',
            'Etapa 7: O PDV imprime o DANFE na impressora térmica da mesa em menos de 2 segundos.',
          ],
        },
      ],
      highlightBox: {
        title: 'Arquitetura Resiliente',
        text: 'Idempotência na API evita emissão em duplicidade em quedas de rede. Certificados A1 armazenados com criptografia simétrica AES-256 e chaves transitórias em memória.',
      },
    },
    {
      id: 'homologacao-piloto',
      number: '4',
      title: 'Plano de Homologação e Piloto com o Rachide Bar',
      lead: 'Roteiro prático de testes no ambiente oficial de testes da SEFAZ-PB, integração direta com o Rachide Bar e substituição do módulo fiscal simulado por chamadas reais.',
      paragraphs: [
        'A implantação não será teórica: o Rachide Bar possui uma base de dados ativa, fluxo de vendas em salão com QR Code nas mesas e módulo de emissão fiscal simulado já em operação no sistema.',
        'A transição ocorrerá em duas fases metodológicas: primeiro, validação no ambiente de homologação da SEFAZ-PB; segundo, execução do piloto em produção com emissões válidas sob o CNPJ do Rachide Bar.',
      ],
      subsections: [
        {
          subtitle: 'Matriz de Validação em Homologação SEFAZ-PB',
          paragraphs: [
            'Serão executadas baterias completas de testes no endpoint de homologação da SEFAZ-PB (com o texto obrigatório "HOMOLOGAÇÃO - SEM VALOR FISCAL"):',
            '• Teste de Autorização Normal (tpEmis=1): Envio de venda mista com bebidas alcoólicas, porções de cozinha e taxa de serviço.',
            '• Teste de Validação de Regras do Simples Nacional: Aplicação correta de CSOSN 102 (Tributada pelo Simples Nacional sem permissão de crédito) e CSOSN 500 (ICMS cobrado anteriormente por substituição tributária - cervejas e refrigerantes).',
            '• Teste de Rejeição e Correção Automática: Simulação de CPF com dígito inválido (Rejeição 207), NCM inexistente (Rejeição 778) e somatório de itens divergente do total da nota (Rejeição 627). A API deve repassar a causa descritiva em português para o operador.',
            '• Teste de Contingência Off-line (tpEmis=9): Desconexão simulada do conector SEFAZ. O PDV emite e imprime a NFC-e off-line; ao restabelecer a comunicação, o provedor transmite o lote retroativo e obtém o protocolo definitivo dentro da janela de 24 horas.',
            '• Teste de Cancelamento de NFC-e: Cancelamento homologado em até 30 minutos após a autorização conforme legislação da Paraíba.',
          ],
        },
        {
          subtitle: 'Critérios de Aceite para Virada de Chave (Go-Live Piloto)',
          paragraphs: [
            '1. Taxa de autorização em primeira tentativa superior a 99% em condições normais de rede.',
            '2. Tempo de resposta médio da chamada da API até a disponibilização do DANFE inferior a 1,8 segundos.',
            '3. Recuperação transparente em 100% dos testes de contingência off-line com transmissão automática das notas represadas.',
            '4. Validação formal do DANFE impresso em bobina térmica de 80mm com leitura de QR Code confirmada no leitor de celular da SEFAZ-PB.',
          ],
        },
      ],
      highlightBox: {
        title: 'Piloto em Ambiente Real',
        text: 'Substituição pontual do mock de emissão no fechamento de mesa do Rachide Bar pela chamada da API oficial do Provedor. Zero atrito na rotina dos garçons e caixas.',
      },
    },
    {
      id: 'fora-escopo',
      number: '5',
      title: 'Itens Fora do Escopo & Responsabilidades Externas',
      lead: 'Demarcação clara entre o escopo da plataforma de tecnologia do provedor e as obrigações exclusivas de cada empresa emitente e sua contabilidade.',
      paragraphs: [
        'Para manter a operação ágil, juridicamente segura e focada em engenharia de software, o provedor estabelece fronteiras estritas de responsabilidade. As obrigações externas permanecem atribuídas aos respectivos responsáveis legais:',
      ],
      subsections: [
        {
          subtitle: 'Matriz de Responsabilidades do Provedor vs. Emitente',
          paragraphs: [
            'A tabela a seguir consolida as responsabilidades da plataforma e o que permanece formalmente fora de escopo:',
          ],
          table: {
            headers: ['Atribuição / Tarefa', 'Responsável', 'Detalhamento do Escopo'],
            rows: [
              [
                'Credenciamento na SEFAZ-PB & SER Virtual',
                'Cliente / Contador',
                'Habilitação da Inscrição Estadual e autorização para emissão de NFC-e no portal estadual.',
              ],
              [
                'Geração do Código de Segurança (CSC & IdCSC)',
                'Cliente / Contador',
                'Obtenção do token criptográfico no Portal de Serviços da Receita da PB e cadastro no painel.',
              ],
              [
                'Aquisição e Renovação do Certificado e-CNPJ A1',
                'Cliente Emitente',
                'Compra junto a Autoridades Certificadoras (Certisign, Serasa, Safeweb) e envio do arquivo .pfx válido.',
              ],
              [
                'Parametrização Tributária (NCM, CEST, Alíquotas)',
                'Contabilidade do Cliente',
                'Definição dos enquadramentos fiscais dos produtos no cardápio de cada estabelecimento.',
              ],
              [
                'Responsabilidade Fiscal e Jurídica da Venda',
                'Cliente Emitente',
                'A veracidade dos valores comercializados, guarda do livro fiscal e recolhimento do ICMS/DAS.',
              ],
              [
                'Customização de Sistemas de Terceiros (ERP legado)',
                'Software House Parceira',
                'O provedor fornece API REST documentada (Swagger/Postman), SDK e webhooks padronizados.',
              ],
              [
                'Disponibilidade do Barramento do Provedor & Fila',
                'Provedor Paraíba',
                'SLA garantido de 99,8% na camada de mensageria, assinatura digital e entrega de protocolos.',
              ],
            ],
          },
        },
      ],
      highlightBox: {
        title: 'Segurança Jurídica',
        text: 'O provedor atua estritamente como operador de transmissão eletrônica e intermediador tecnológico. Não presta assessoria jurídica, contábil ou fiscal substantiva.',
      },
    },
    {
      id: 'roteiro-fases',
      number: '6',
      title: 'Roteiro de Implementação em Fases (Roadmap)',
      lead: 'Cronograma estratégico dividido em três etapas claras: MVP com validação no piloto, virada para produção real e escala comercial para software houses da região.',
      paragraphs: [
        'A estratégia de entrada no mercado é estruturada para mitigar riscos técnicos e operacionais antes da abertura comercial ampla:',
      ],
      subsections: [
        {
          subtitle: 'Fase 1: Construção do MVP do Provedor (Semanas 1 a 6)',
          paragraphs: [
            '• Modelagem da base de dados multi-tenant e geração de API Keys por cliente.',
            '• Desenvolvimento da API REST de emissão (POST /v1/nfce) e consulta de status.',
            '• Implementação do motor de montagem de XML 65 e assinatura e-CNPJ A1 em Node/TypeScript.',
            '• Integração com os webservices SOAP de Homologação da SEFAZ-PB.',
            '• Implementação da mensageria de contingência off-line e fila de retentativas.',
            '• Geração do DANFE térmico 80mm e despachante de Webhooks.',
            '• Construção do Painel do Provedor com visualização de notas e volumes.',
            '• Homologação completa com cenários reais utilizando o Rachide Bar.',
          ],
        },
        {
          subtitle: 'Fase 2: Produção & Piloto Operacional com o Rachide Bar (Semanas 7 a 10)',
          paragraphs: [
            '• Instalação do certificado e-CNPJ A1 definitivo de produção do Rachide Bar.',
            '• Obtenção do CSC de produção no Portal da SEFAZ-PB.',
            '• Configuração dos endpoints de Produção da SEFAZ Paraíba.',
            '• Virada de chave no fechamento de contas do bar: toda venda passa a emitir NFC-e oficial com valor jurídico e tributário.',
            '• Acompanhamento intensivo durante duas semanas com foco nas noites de sexta, sábado e domingo.',
            '• Calibração de timeouts de rede e armazenamento permanente dos XMLs autorizados.',
          ],
        },
        {
          subtitle: 'Fase 3: Expansão Comercial e Escala Regional (Mês 3 em diante)',
          paragraphs: [
            '• Abertura do portal de cadastro self-service para software houses e empresas de automação da Grande João Pessoa e Campina Grande.',
            '• Lançamento da documentação pública interativa da API REST com SDKs e exemplos em JavaScript/Node, Python e C#.',
            '• Ativação do módulo de cobrança automática por volume de emissões via Pix/Boleto integrado à plataforma de pagamentos.',
            '• Suporte especializado por WhatsApp corporativo focado em desenvolvedores de sistemas de PDV.',
            '• Implantação de monitoramento sintético 24/7 da disponibilidade da SEFAZ-PB com alertas automáticos.',
          ],
        },
      ],
      highlightBox: {
        title: 'Marcos de Sucesso',
        text: 'Meta do MVP: 1.000 notas autorizadas em homologação sem erros. Meta do Piloto: 1 mês completo de operação fiscal 100% estável no Rachide Bar antes do primeiro cliente pagante externo.',
      },
    },
    {
      id: 'requisitos-multi-tenant',
      number: '7',
      title: 'Requisitos para Transformação do Rachide Bar em Multi-Tenant',
      lead: 'Mapeamento completo da engenharia necessária para elevar o sistema do Rachide Bar de uma aplicação mono-empresa para uma plataforma SaaS multi-estabelecimento comercializável.',
      paragraphs: [
        'Para que a plataforma do Rachide Bar possa ser comercializada para outras redes de bares, restaurantes e estabelecimentos similares, o sistema deve sofrer uma evolução estrutural em seu modelo de dados e isolamento de segurança. Esta seção detalha as especificações técnicas indispensáveis para a transformação multi-tenant:',
      ],
      subsections: [
        {
          subtitle: '1. Tabela Central de Estabelecimentos (Tenants)',
          paragraphs: [
            'Criação da tabela "estabelecimentos" no Supabase/PostgreSQL com os dados de identificação e fiscais de cada cliente da plataforma: id (UUID), razao_social, nome_fantasia, cnpj, inscricao_estadual, regime_tributario, endereco, telefone, csc_token, csc_id, certificado_a1_path, plano_ativo_id, status (ativo/suspenso) e created_at.',
          ],
        },
        {
          subtitle: '2. Chave de Particionamento em Todas as Tabelas Operacionais',
          paragraphs: [
            'Inclusão da coluna obrigatória "estabelecimento_id UUID REFERENCES estabelecimentos(id)" em todas as tabelas operacionais do ecossistema: mesas, comandas, comanda_itens, cardapio_itens, categorias_cardapio, fila_cozinha, estoque_produtos, movimentacoes_estoque, caixa_dias, movimentacoes_caixa, configuracoes_bar e documentos_fiscais. Criação de índices compostos (estabelecimento_id, created_at) para garantia de alta performance de busca.',
          ],
        },
        {
          subtitle: '3. Isolamento Estrito via Row Level Security (RLS)',
          paragraphs: [
            'Revisão profunda das políticas de RLS no PostgreSQL. Cada usuário autenticado passa a ter seu tenant identificado através de sua sessão ou metadata segura (auth.jwt() ->> "estabelecimento_id"). Todas as cláusulas SELECT, INSERT, UPDATE e DELETE passam a aplicar automaticamente: WHERE estabelecimento_id = (SELECT estabelecimento_id FROM usuario_estabelecimentos WHERE user_id = auth.uid()). É terminantemente vedado o vazamento cruzado de dados entre clientes distintos.',
          ],
        },
        {
          subtitle: '4. Vínculo de Usuários e Seleção de Estabelecimento no Login',
          paragraphs: [
            'Criação da tabela associativa "usuario_estabelecimentos" com (usuario_id, estabelecimento_id, role). Isso permite que um gerente ou investidor que possua mais de uma filial ou múltiplos estabelecimentos possa selecionar no momento do login qual bar deseja gerenciar, alternando entre unidades com um único clique sem necessidade de contas de e-mail separadas.',
          ],
        },
        {
          subtitle: '5. Configurações, Chaves Pix e Cardápio Personalizados por Tenant',
          paragraphs: [
            'Desacoplamento total dos parâmetros de operação: cada estabelecimento configura sua própria Chave Pix (CNPJ/chave própria) para geração de QR Code dinâmico BR Code nas mesas, taxa de serviço personalizada (10%, 12% ou isenta), logo do estabelecimento para o cardápio digital do cliente, nomes de impressoras térmicas e horários de funcionamento.',
          ],
        },
        {
          subtitle: '6. Mapeamento de Migração dos Dados Existentes do Rachide Bar',
          paragraphs: [
            'Script de migração em SQL transacionado: 1) Inserção do registro do Rachide Bar na tabela estabelecimentos como Tenant Inicial ID #1; 2) Execução de UPDATE em todas as tabelas pré-existentes preenchendo o estabelecimento_id com o ID do Rachide Bar; 3) Aplicação da restrição NOT NULL na coluna estabelecimento_id; 4) Habilitação das novas políticas RLS rigorosas.',
          ],
        },
      ],
      highlightBox: {
        title: 'Arquitetura SaaS Segura',
        text: 'O isolamento multi-tenant garantido nativamente no nível do banco (PostgreSQL RLS) assegura que nenhum cliente consiga visualizar dados, faturamento ou clientes de outro estabelecimento, mesmo em caso de falha na camada de frontend.',
      },
    },
    {
      id: 'riscos-mitigacao',
      number: '8',
      title: 'Análise de Riscos, Mitigações & Próximos Passos',
      lead: 'Mapeamento preventivo de vulnerabilidades operacionais do ecossistema fiscal e plano de ação imediato para início da engenharia.',
      paragraphs: [
        'A prestação de serviços de missão crítica, como emissão fiscal no ponto de venda em horários de pico, exige contingenciamento antecipado de contingências operacionais e técnicas:',
      ],
      subsections: [
        {
          subtitle: 'Matriz de Riscos & Estratégias de Mitigação',
          paragraphs: [
            '• Risco 1: Indisponibilidade temporária ou lentidão nos servidores da SEFAZ-PB durante o pico noturno (ex.: sextas-feiras às 21h). Mitigação: Chaveamento automático imediato para contingência off-line (tpEmis=9), geração e impressão do DANFE para o cliente em 1 segundo e enfileiramento das notas com retentativas controladas assim que a SEFAZ restabelecer o serviço.',
            '• Risco 2: Vencimento ou expiração do certificado digital e-CNPJ A1 do cliente emitente. Mitigação: Módulo sentinela que audita diariamente a data de validade de todos os certificados e envia notificações preventivas automáticas com 30, 15 e 7 dias de antecedência para o e-mail e WhatsApp do responsável.',
            '• Risco 3: Rejeições fiscais em cascata por cadastro incorreto de NCM ou CSOSN pelo restaurante. Mitigação: Motor de validação pré-transmissão com tabela interna dos principais NCMs do setor de alimentação da Paraíba e bloqueio preventivo de emissão com indicação exata do campo com erro antes do envio para a SEFAZ.',
            '• Risco 4: Segurança e guarda de chaves criptográficas A1. Mitigação: Armazenamento em cofre de chaves criptografado (AES-256) com senhas hash separadas e descarte estrito da chave privada de memória após a assinatura.',
          ],
        },
        {
          subtitle: 'Próximos Passos Imediatos de Execução',
          paragraphs: [
            '1. Reunião de alinhamento com a contabilidade do Rachide Bar para levantamento do CSC e IdCSC de homologação.',
            '2. Exportação e carga do certificado digital de testes e-CNPJ A1 em ambiente isolado.',
            '3. Configuração do repositório da API do Provedor com testes unitários cobrindo o schema XML v4.00 da NFC-e.',
            '4. Execução do primeiro teste de emissão em homologação SEFAZ-PB com verificação manual do QR Code.',
          ],
        },
      ],
      highlightBox: {
        title: 'Conclusão Executiva',
        text: 'O projeto apresenta viabilidade técnica comprovada, baixo custo de entrada pela especialização na SEFAZ-PB e alto potencial de monetização contínua com margem líquida elevada sobre volume de notas transmitidas.',
      },
    },
  ],
}
