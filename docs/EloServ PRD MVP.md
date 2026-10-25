# EloServ — PRD do MVP

> Conecte a equipe. Organize cada serviço.

| Campo | Valor |
|---|---|
| Documento | Product Requirements Document — MVP (primeira versão) |
| Versão | 0.1 · rascunho para validação |
| Data | 24/10/2026 |
| Referências | Protótipo navegável (`EloServ.dc.html`, `EloServ Empresas.dc.html`, `EloServ Admin.dc.html`) e handoff de design (`EloServ Handoff.dc.html`) |
| Situação | Requisitos de produto. Esquema de dados, contratos de API e infraestrutura serão definidos na implementação. |

Convenções usadas neste documento:

- **[Confirmado]** — definido no briefing do produto.
- **[Hipótese]** — regra proposta pelo design, a validar com usuários e negócio.
- **[Pendente]** — decisão ainda não tomada.

---

## 1. Visão geral

### 1.1 Problema
Pequenas empresas de climatização e refrigeração organizam solicitações, agenda de técnicos, propostas e histórico de atendimentos de forma dispersa. Quem contrata não tem clareza sobre quando um pedido é só uma solicitação e quando o atendimento está de fato confirmado.

### 1.2 Proposta de valor
Organizar a jornada do primeiro contato ao próximo atendimento, conectando catálogo de serviços, disponibilidade, solicitação, confirmação, execução e histórico.

### 1.3 Produto
Plataforma SaaS web responsiva com:
- Área pública: catálogo de fornecedores, perfis e ajuda.
- Três ambientes autenticados: administração da plataforma (`/admin`), empresas fornecedoras (`/empresas`) e clientes (`/clientes`).

### 1.4 Recorte inicial [Confirmado]
- Segmento: climatização e refrigeração (residencial e comercial).
- Região: Mato Grosso, com possibilidade de expansão para o Centro-Oeste.
- Monetização: assinatura SaaS por empresa. Planos, preços e cobrança automatizada **não definidos** e fora do MVP.

---

## 2. Objetivos e não objetivos

### 2.1 Objetivos do MVP
1. Permitir que um cliente encontre um fornecedor, solicite um serviço e confirme uma proposta sabendo, a cada etapa, qual é a situação do pedido.
2. Permitir que a empresa responda solicitações, atribua profissionais, envie propostas e conduza a ordem de serviço até a conclusão.
3. Manter uma agenda consolidada por profissional que impeça dupla reserva.
4. Permitir que a administração habilite, suspenda e acompanhe empresas e acessos, com auditoria.
5. Oferecer base de conhecimento pública e contextual.

### 2.2 Não objetivos (fora do MVP) [Confirmado]
- Pagamento online, comissões por transação e cobrança automatizada da assinatura.
- Emissão fiscal, laudos regulatórios ou certificação técnica.
- Estoque, carrinho, checkout ou logística de produtos.
- Chat em tempo real, chatbot ou IA generativa.
- Avaliações por estrelas.
- Aplicativo nativo e operação offline com sincronização.
- IoT e cálculo automático de rotas.
- Integração automática com WhatsApp (apenas contato manual).

### 2.3 Indicadores de sucesso [Pendente]
Não há métricas de base. Antes do lançamento, definir com o negócio indicadores e metas, por exemplo:
- Percentual de solicitações respondidas antes de a reserva temporária expirar.
- Taxa de conversão de proposta em agendamento confirmado.
- Ocorrências de conflito de reserva por semana (esperado: tratadas sem perda de dados).
- Tempo até a primeira solicitação recebida após a habilitação da empresa.

Nenhuma meta numérica deve ser apresentada como resultado comprovado.

---

## 3. Usuários e papéis

| Papel | Quem é | Objetivo principal |
|---|---|---|
| Visitante | Pessoa sem conta | Consultar fornecedores e ajuda; iniciar solicitação |
| Cliente | Pessoa ou pequeno comércio contratante | Solicitar, decidir propostas e acompanhar atendimentos |
| Proprietário/gestor | Comprador do SaaS | Operar empresa, agenda, equipe e propostas |
| Profissional/técnico | Vinculado a uma empresa | Executar atendimentos atribuídos |
| Administrador da plataforma | Equipe EloServ | Habilitar empresas, gerir acessos, moderar conteúdo, suporte |

Uma mesma pessoa pode ter mais de um vínculo (ex.: gestora de uma empresa e cliente em conta pessoal). Nesse caso o produto oferece um **seletor de ambiente explícito**. Alterar a URL nunca concede autorização.

Níveis de administrador [Hipótese]: Principal, Operações e Suporte. Deve existir sempre ao menos um Principal habilitado.

---

## 4. Arquitetura de informação

### 4.1 Área pública
| Rota | Conteúdo |
|---|---|
| `/` | Apresentação do produto para os dois lados |
| `/fornecedores` | Busca e catálogo |
| `/fornecedores/:slug` | Perfil público da empresa |
| `/fornecedores/:slug/solicitar` | Solicitação de atendimento |
| `/ajuda`, `/ajuda/:slug` | Base de conhecimento |
| `/entrar`, `/cadastro`, `/recuperar-acesso` | Acesso |

### 4.2 `/clientes`
Visão geral · Buscar fornecedores (→ catálogo) · Solicitações e orçamentos (`/:id`) · Agendamentos · Meus equipamentos · Histórico · Perfil e endereços · Ajuda · Preferências.

### 4.3 `/empresas`
Visão geral · Perfil da empresa · Serviços · Produtos · Profissionais (`/:id`) · Agenda · Solicitações e orçamentos (`/:id`) · Ordens de serviço (`/:id`) · Clientes e equipamentos · Histórico e retornos · Ajuda · Configurações.

### 4.4 `/admin`
Visão geral · Empresas (`/:id`) · Usuários e acessos · Serviços e produtos publicados · Categorias · Agendamentos · Base de conhecimento (`/:slug`) · Solicitações de suporte · Auditoria · Configurações.

> `/fornecedores` é o catálogo público; `/empresas` é o ambiente privado do fornecedor. Não confundir.

---

## 5. Requisitos funcionais

Prioridade: **P0** obrigatório para o lançamento · **P1** desejável no MVP · **P2** pode seguir logo após.

### 5.1 Área pública

**RF-PUB-01 · Página inicial (P0)**
- Headline “Organize seus serviços. Facilite o próximo atendimento.” e slogan em posição secundária.
- CTAs “Encontrar um fornecedor” e “Cadastrar minha empresa”.
- Seções: como contratar, como a EloServ ajuda pequenas equipes, serviços do recorte inicial, funcionamento de solicitação e confirmação, dúvidas frequentes, rodapé com navegação e privacidade.
- Proibido: métricas inventadas, logotipos de parceiros, depoimentos, selos sem evidência, promessa de disponibilidade imediata.

**RF-PUB-02 · Catálogo (P0)**
- Filtros combináveis: nome, cidade, categoria, serviço, atendimento residencial/comercial.
- Resultado mostra nome, cidade e área atendida, serviços principais, modalidade, “Ver perfil” e “Solicitar atendimento”.
- “Usar minha localização” é opcional, pede consentimento e mantém a escolha manual.
- Sem avaliação por estrelas.
- Sem resultados: explicar o motivo, permitir limpar filtros e sugerir outra cidade ou categoria.
- Estados de carregamento (skeleton) e erro de conexão com nova tentativa.

**RF-PUB-03 · Perfil do fornecedor (P0)**
- Nome, identidade visual opcional, descrição, cidade e área, contatos autorizados, horário de funcionamento, políticas de atendimento e cancelamento.
- Serviços com nome, descrição, duração estimada, local de atendimento, tipo de preço (fixo, “a partir de”, “sob orçamento”) e observações. Deixar explícito quando o valor depende de avaliação, a duração pode mudar ou há cobrança de visita.
- Produtos como catálogo informativo (nome, descrição, imagem opcional, preço opcional ou “sob consulta”, disponibilidade informada) com ação “Consultar produto”.
- Profissionais apenas com dados públicos autorizados.
- Agenda pública com horários passíveis de solicitação. Nunca mostrar nomes de clientes, endereços, detalhes de ordens ou motivos de bloqueio.
- Texto fixo: “Escolher um horário envia uma solicitação. O agendamento será concluído após a confirmação.”

**RF-PUB-04 · Base de conhecimento (P0)**
- Busca, filtros por categoria e público, data de atualização, artigos relacionados, “Este artigo ajudou?” e canal de suporte.
- Estrutura do artigo: título, resumo, público, passos, observações, relacionados.
- Categorias: Primeiros passos, Conta e acesso, Cadastro de empresa, Serviços e produtos, Equipe e permissões, Agenda e bloqueios, Solicitações e propostas, Ordens de serviço, Privacidade e segurança.
- Artigos de lançamento: como solicitar um atendimento; como confirmar um horário; como bloquear um período na agenda; como convidar um profissional; como reagendar sem perder o horário atual.
- Sem chatbot e sem promessa de atendimento 24 horas.

### 5.2 Conta e acesso

**RF-ACS-01 · Cadastro (P0)**
- Escolha entre cliente e empresa.
- Cliente: nome, e-mail, telefone, credencial e aceite dos termos. Sem CPF no primeiro cadastro.
- Empresa: nome, CNPJ, cidade e dados do responsável. Após o envio, a situação é “Aguardando habilitação”.
- Aceite contratual separado do consentimento opcional de marketing.

**RF-ACS-02 · Entrar e recuperar acesso (P0)**
- A recuperação não revela se o e-mail existe.
- Método de autenticação [Pendente].

**RF-ACS-03 · Estados de sessão (P0)**
- Sessão expirada (com retorno após entrar e preservação de rascunhos), acesso negado e convite expirado.
- Expiração por inatividade de 30 min [Hipótese].

**RF-ACS-04 · Seletor de ambiente (P1)**
- Visível no menu do usuário quando há mais de um vínculo.

**RF-ACS-05 · Preferências (P0)**
- Tema (Sistema, Claro, Escuro) e densidade (Conforto, Compacto), independentes e persistidos. Ver §8.

### 5.3 Cliente

**RF-CLI-01 · Solicitação de atendimento (P0)**
Etapas: serviço → equipamento (cadastrado ou mínimo necessário) → local → descrição da necessidade → horário desejado ou “sem horário definido” → revisão → envio.
- Validação por etapa, com erro próximo ao campo e resumo de erros na revisão.
- A revisão mostra serviço, fornecedor, local, data e hora com fuso, duração estimada, situação do preço e próximos passos.
- Visitante pode preencher tudo; no envio, entra ou cria conta **sem perder os dados**.
- Sucesso só é exibido após confirmação do servidor e informa que **ainda não é um agendamento**, com o prazo da reserva temporária.
- Falha de envio ou horário indisponível: dados preservados, nada reservado, alternativas oferecidas.

**RF-CLI-02 · Solicitações e orçamentos (P0)**
- Lista com filtros: todas, aguardando você, em andamento, encerradas.
- Detalhe com três situações independentes (solicitação, ocupação da agenda, execução), dados do pedido, proposta e linha do tempo.
- Acompanhamento disponível mesmo sem horário confirmado.

**RF-CLI-03 · Proposta (P0)**
- Exibe descrição, itens e valores quando informados, condições, validade, data e horário propostos com fuso, profissional e observações.
- Ações:
  - **Confirmar**: revalida o horário e registra a intenção de contratação. Não é assinatura digital e não envolve pagamento.
  - **Recusar**: motivo opcional; libera o horário.
  - **Pedir ajuste**: texto obrigatório; mantém a reserva até a validade.
- Proposta expirada não pode ser confirmada; o cliente pode pedir nova proposta.
- Conflito na confirmação: mensagem clara, dados preservados e pedido de outro horário.

**RF-CLI-04 · Reagendamento e cancelamento (P0)**
- O cliente escolhe novo horário. O original **permanece reservado** até a empresa confirmar a troca.
- Pedido com prazo de resposta; se recusado ou vencido, o original é mantido.
- Histórico registra cada alteração.
- Solicitação de cancelamento segue a política da empresa.

**RF-CLI-05 · Agendamentos, equipamentos e histórico (P0)**
- Agendamentos mostram apenas confirmados.
- Equipamentos: tipo, marca/modelo opcionais, identificação, local de instalação, histórico.
- Histórico com estado vazio explicativo.

**RF-CLI-06 · Perfil e privacidade (P0)**
- Dados de contato, endereços adicionais e preferências de comunicação.
- Pedidos de exportação e de exclusão da conta, sujeitos à política aplicável.
- Aviso de mudanças não salvas ao sair da tela.

### 5.4 Empresa

**RF-EMP-01 · Visão geral (P0)**
- Priorizar o que pede ação: solicitações aguardando resposta, atendimentos de hoje, propostas aguardando cliente, ordens em execução, retornos previstos, bloqueios e conflitos a revisar.
- Indicadores derivados de dados reais; sem percentuais de crescimento.

**RF-EMP-02 · Cadastro empresarial (P0)**
- Nome, razão social quando aplicável, CNPJ, descrição, contatos públicos e privados separados, cidade e área atendida, horários, identidade visual opcional e políticas.
- Situações: Cadastro em preenchimento · Aguardando habilitação · Ativa · Suspensa · Arquivada, cada uma com explicação do impacto.
- Habilitação na EloServ não representa certificação técnica.

**RF-EMP-03 · Serviços e produtos (P0 serviços / P1 produtos)**
- Criar, editar, visualizar, ativar/desativar, arquivar, buscar e filtrar.
- Registros com vínculo operacional não são excluídos; são arquivados.
- Serviço desativado sai do perfil público.
- Estado vazio orientando o cadastro do primeiro serviço.

**RF-EMP-04 · Profissionais (P0)**
- Convidar, definir função, serviços que executa, jornada e intervalos, editar, suspender, revogar acesso e desvincular sem apagar histórico.
- Ao suspender ou revogar com atendimentos futuros: mostrar o impacto, exigir o tratamento de cada atendimento (reatribuir a profissional disponível ou combinar novo horário com o cliente) e justificativa. Nada é cancelado silenciosamente.
- Convite expira em 7 dias e pode ser reenviado ou revogado [Hipótese].

**RF-EMP-05 · Agenda (P0)** — ver §6.
- Visão do dia por profissional (colunas) e visão em lista. No celular, começa em lista.
- Consulta de disponibilidade por serviço, mostrando o que o cliente verá.
- Bloqueio de período ou dia inteiro, com motivo interno, detecção de conflito e sugestão de alternativas.

**RF-EMP-06 · Solicitações e propostas (P0)**
- Lista com situação e prazo da reserva temporária.
- Análise: pedido do cliente, atribuição de profissional (com disponibilidade e elegibilidade por serviço) e proposta (itens e valores, total estimado, condições, validade, observações, data proposta com fuso).
- Recusar com motivo opcional, liberando o horário.

**RF-EMP-07 · Ordens de serviço (P0)**
- Campos: cliente, equipamento, serviço, agendamento, profissional, relato inicial, observações, trabalho realizado, histórico de alterações e próximo retorno.
- Estados: Agendada · Em execução · Concluída · Cancelada. Concluir exige “trabalho realizado”.
- Resumo imprimível. Não é documento fiscal, laudo ou certificação.

**RF-EMP-08 · Clientes e equipamentos (P1)**
- Cadastro operacional separado da conta pessoal do cliente; a empresa não edita credenciais nem dados globais da conta.
- Clientes atendidos fora do catálogo podem ser cadastrados sem criar conta. Convite só com confirmação do cliente.
- Lista com busca e paginação.

**RF-EMP-09 · Histórico e retornos (P1)**
- Retornos sugeridos ao concluir ordens; contato manual.

**RF-EMP-10 · Configurações da agenda (P0)**
- Horário de funcionamento, jornadas individuais, intervalos, folgas, feriados e exceções manuais.
- Duração por serviço, tempo de preparo/deslocamento, validade da reserva temporária e fuso horário da empresa.

**RF-EMP-11 · Visão do técnico (P0)**
- Acesso apenas à própria agenda, aos atendimentos atribuídos, ao registro de execução e à ajuda.
- Demais áreas exibem “permissão insuficiente”.

### 5.5 Administração

**RF-ADM-01 · Visão geral (P0)**
- Empresas por situação, cadastros aguardando habilitação, usuários ativos e suspensos, suporte em aberto e atividades administrativas recentes. Sem métricas de vaidade.

**RF-ADM-02 · Empresas (P0)**
- Lista com busca e filtros (situação, cidade, data de cadastro).
- Detalhe com cadastro, responsáveis (dados pessoais parcialmente ocultos), situação, histórico, conteúdo público e justificativas.
- Habilitar (após análise cadastral), suspender, reativar e arquivar, sempre com justificativa e registro em auditoria.
- Suspender mostra o impacto: perfil oculto, novas solicitações bloqueadas e atendimentos confirmados mantidos para tratamento.

**RF-ADM-03 · Usuários e acessos (P0)**
- Criar e revogar convites, consultar vínculos, editar papel permitido, suspender, reativar e revogar acesso, acompanhar alterações.
- Proteções: não remover o último administrador principal habilitado, não permitir autoelevação de privilégio, nunca exibir senhas e não oferecer exclusão destrutiva de histórico.

**RF-ADM-04 · Moderação e categorias (P1)**
- Revisar serviços e produtos publicados e solicitar ajustes à empresa com justificativa.
- Gerenciar categorias.

**RF-ADM-05 · Agendamentos (P1)**
- Visão agregada por empresa, sem dados de clientes.
- Acesso a detalhes operacionais apenas com justificativa, temporário e auditado.

**RF-ADM-06 · Base de conhecimento (P0)**
- Criar e editar, salvar rascunho, pré-visualizar, publicar (com validação de campos obrigatórios), arquivar e categorizar.

**RF-ADM-07 · Suporte (P1)**
- Lista de solicitações com situação.

**RF-ADM-08 · Auditoria (P0)**
- Quem, quando, entidade afetada, tipo de alteração e justificativa, com filtro por tipo.
- Sem segredos ou dados pessoais desnecessários.

### 5.6 Notificações (P0 na aplicação / P1 e-mail)
- Central de notificações dentro da aplicação.
- Eventos: convite para equipe, nova solicitação, proposta recebida, confirmação, recusa, cancelamento, reagendamento, expiração e alteração de acesso.
- E-mails transacionais na implementação.
- Notificação enviada, e-mail entregue e agendamento confirmado são conceitos distintos. **Falha no e-mail não pode desfazer reserva confirmada.**
- Conteúdo sem dados pessoais sensíveis. WhatsApp apenas como contato manual.

---

## 6. Regras de agenda e reserva

### 6.1 Modelo [Confirmado]
- A empresa possui uma agenda consolidada; a capacidade é dada pelos profissionais disponíveis.
- Cada atendimento reserva **um** profissional.
- Um profissional não pode ter atendimentos sobrepostos; profissionais diferentes podem atender em paralelo.
- Existe vaga somente se ao menos um profissional **elegível** (que executa o serviço) estiver livre, considerando jornada, intervalos, folgas, feriados, bloqueios, duração do serviço e tempo de preparo/deslocamento.
- O cliente não escolhe o profissional; a empresa atribui.
- Sem serviços com vários profissionais no MVP. Sem cálculo automático de rotas.

### 6.2 Fluxo de reserva [Confirmado]
1. O cliente consulta a disponibilidade (somente leitura).
2. Selecionar um horário na interface não bloqueia a agenda.
3. Ao enviar, o servidor tenta criar uma **reserva temporária**.
4. A reserva só existe após a confirmação do servidor.
5. A empresa analisa e envia a proposta.
6. O cliente aceita dentro da validade.
7. O servidor revalida o horário e **confirma** o agendamento.
8. Recusa, cancelamento ou expiração **liberam** o recurso.

Reserva temporária:
- Validade configurável pela empresa; padrão de 24 h [Hipótese].
- Prazo sempre exibido.
- Não prende a capacidade indefinidamente; solicitações expiradas são tratáveis.

### 6.3 Estados independentes [Confirmado]

| Dimensão | Estados |
|---|---|
| Solicitação | Enviada · Em análise · Proposta enviada · Aceita · Recusada · Cancelada · Expirada |
| Ocupação da agenda | Reserva temporária · Confirmada · Bloqueio interno · Liberada |
| Execução | Agendada · Em execução · Concluída · Cancelada |

Relações:
- “Aceita” ocorre junto com a ocupação “Confirmada” e cria a execução “Agendada” (ordem de serviço).
- “Recusada”, “Cancelada” ou “Expirada” implicam ocupação “Liberada”.
- Não existe execução antes da aceitação.
- “Bloqueio interno” é ocupação sem solicitação.

### 6.4 Reagendamento [Confirmado]
- O cliente solicita nova data ou a empresa propõe uma.
- O horário original permanece reservado até a troca ser confirmada; nunca liberar o original antes de garantir o novo.
- O pedido de alteração tem validade exibida; a empresa responde em até 48 h [Hipótese]. Sem resposta, mantém-se o original.
- O histórico é mantido.

### 6.5 Bloqueios
- Por período ou dia inteiro, por profissional, com motivo interno.
- Um bloqueio sobreposto a atendimento existente **não é salvo**: o sistema mostra os atendimentos afetados e sugere períodos livres.
- Bloqueios não cancelam atendimentos automaticamente.

### 6.6 Fuso horário e formatos [Confirmado]
- Exibir o fuso configurado pela empresa na disponibilidade, revisão, proposta e confirmação.
- Não assumir que todo Mato Grosso usa o horário de Brasília. Empresas que atendem cidades de outro estado exibem o fuso da empresa.
- Datas no padrão brasileiro (dd/mm/aaaa) e relógio de 24 horas.

### 6.7 Concorrência — requisito técnico obrigatório
> A interface não garante sozinha a prevenção de dupla reserva. A aplicação final deve validar e gravar reservas de forma transacional no backend, com proteção no banco de dados para impedir sobreposição de intervalos ativos por profissional.

Além disso:
- Revalidar no envio da solicitação e na confirmação da proposta.
- Proteger contra duplo clique e requisições repetidas (idempotência).
- Tratar atualização concorrente de registros com mensagem de conflito acionável.
- Mensagem de conflito: informar o que ocorreu, que nada foi gravado, preservar os dados e oferecer alternativas.
- Auditar criação, confirmação, liberação e conflitos de reserva.
- Armazenar instantes de forma consistente e converter para o fuso de exibição.

---

## 7. Permissões (resumo)

✓ permitido · ◐ restrito ao próprio escopo · — não permitido

| Ação | Admin | Gestor | Técnico | Cliente | Visitante |
|---|---|---|---|---|---|
| Consultar catálogo e ajuda | ✓ | ✓ | ✓ | ✓ | ✓ |
| Iniciar solicitação | — | — | — | ✓ | ✓ (envia após entrar) |
| Confirmar/recusar proposta | — | — | — | ◐ próprias | — |
| Reagendar/cancelar | — | ◐ empresa | — | ◐ próprios | — |
| Emitir proposta | — | ◐ empresa | — | — | — |
| Configurar horários e bloqueios | — | ◐ empresa | — | — | — |
| Consultar agenda | ◐ agregada | ◐ empresa | ◐ própria | ◐ próprios | ◐ só horários |
| Atualizar execução e concluir OS | — | ◐ empresa | ◐ atribuídas | — | — |
| Gerenciar serviços, produtos e equipe | — | ◐ empresa | — | — | — |
| Ver dados de clientes | ◐ com justificativa | ◐ da operação | ◐ do atendimento | ◐ próprios | — |
| Habilitar/suspender/arquivar empresa | ✓ com justificativa | — | — | — | — |
| Gerenciar usuários e papéis | ◐ conforme nível | ◐ equipe | — | — | — |
| Publicar artigos de ajuda | ✓ | — | — | — | — |
| Consultar auditoria | ✓ | — | — | — | — |

Regras:
- Autorização aplicada no servidor por papel **e** vínculo.
- Isolamento entre empresas: nenhum usuário de empresa acessa dados de outra.
- Acesso administrativo a dados operacionais privados não é irrestrito por padrão.
- Ações sensíveis exigem justificativa e geram auditoria.

---

## 8. Requisitos de experiência

### 8.1 Temas e densidade
- Temas Sistema, Claro e Escuro; primeira utilização em Escuro; “Sistema” acompanha o dispositivo.
- Tema aplicado antes da renderização (sem flash) em páginas públicas, áreas autenticadas, tabelas, agenda, modais e mensagens.
- Densidades Conforto (padrão) e Compacto: reduz espaçamentos e altura de controles sem reduzir excessivamente a tipografia nem esconder informação.
- Em telas de toque, áreas de interação de 44 px também no modo compacto.
- Tema e densidade são independentes, persistidos e alteráveis antes do login.

### 8.2 Responsividade
- Referências de 390, 768 e 1440 px, funcionando em larguras intermediárias.
- Computador: menu lateral e barra superior com contexto, notificações, ajuda e usuário.
- Tablet: menu recolhível; filtros e formulários reorganizados.
- Celular: navegação enxuta, ações principais alcançáveis, formulários em uma coluna, agenda iniciando em lista.
- Sem dependência de hover e sem rolagem horizontal da página (permitida apenas em componentes como a grade da agenda, com indicação).

### 8.3 Acessibilidade (alvo WCAG 2.2 AA)
- Contraste adequado e foco visível.
- Navegação por teclado; rótulos associados; erros próximos aos campos e resumo em formulários extensos.
- Diálogos com foco gerenciado e fechamento por Escape quando seguro.
- Alternativa por botões para arrastar e soltar; respeito a redução de movimento.
- Informação nunca transmitida apenas por cor: status sempre com texto e, quando necessário, ícone.
- Confirmação antes de perder dados não salvos.

### 8.4 Linguagem e conteúdo
- Português do Brasil em todas as telas. Sem emojis na interface.
- Erros que exigem ação permanecem visíveis no contexto; toasts apenas para confirmações.
- Não apresentar a plataforma como “100% segura” ou “totalmente adequada à LGPD”.

### 8.5 Estados obrigatórios
- Empresa: sem serviços, aguardando habilitação, suspensa.
- Cliente sem histórico; agenda sem atendimentos; busca sem resultados.
- Profissional indisponível; serviço desativado; proposta expirada; horário ocupado durante a confirmação.
- Erro de conexão; falha no envio; sessão expirada; permissão insuficiente.
- Texto longo; lista extensa com paginação; mudanças não salvas; sucesso após criação e atualização.

---

## 9. Requisitos não funcionais

| Tema | Requisito |
|---|---|
| Segurança | Autorização no servidor; isolamento por empresa; senhas nunca expostas; auditoria de ações sensíveis |
| Privacidade | Minimização de dados nas listagens e notificações; consentimento de marketing separado; pedidos de exportação e exclusão conforme política |
| Integridade | Reservas transacionais com proteção contra sobreposição (§6.7); arquivamento em vez de exclusão para registros com histórico |
| Confiabilidade | Envio de e-mail desacoplado da confirmação de reserva |
| Tempo | Instantes armazenados de forma consistente; exibição no fuso da empresa |
| Plataforma | Web responsiva, mobile-first; React/Next.js com TypeScript (preferência de referência) |

Contexto tecnológico de referência para a implementação (não configurado nesta etapa): GitHub, Vercel, Neon/PostgreSQL, Resend e Claude Code como apoio ao desenvolvimento.

---

## 10. Dados demonstrativos
- Empresas, pessoas, contatos, valores e horários do protótipo são fictícios e identificados como tais.
- Não usar contatos reais, endereços completos de pessoas, CPF/CNPJ aparentemente válidos, marcas de terceiros como parceiros nem avaliações ou depoimentos fabricados.
- Valores e durações são demonstrativos e não constituem pesquisa de mercado.

---

## 11. Hipóteses a validar

| # | Hipótese | Onde impacta |
|---|---|---|
| H1 | Reserva temporária padrão de 24 h, configurável por empresa | Solicitação, agenda |
| H2 | Preparo/deslocamento fixo por empresa (ex.: 30 min) | Disponibilidade |
| H3 | Empresa responde reagendamento em até 48 h; sem resposta, mantém o original | Reagendamento |
| H4 | Convite de profissional expira em 7 dias | Equipe |
| H5 | Sessão expira após 30 min sem atividade | Acesso |
| H6 | Níveis de administrador Principal, Operações e Suporte | Admin |
| H7 | Técnico vê apenas agenda própria e atendimentos atribuídos | Permissões |
| H8 | Cancelamento sem custo até 12 h antes (exemplo de política de empresa) | Perfil público |

## 12. Questões para pesquisa com usuários
- Clientes entendem a diferença entre solicitação, reserva temporária e agendamento confirmado?
- Gestores preferem a grade diária por profissional ou uma visão semanal consolidada?
- O número de etapas da solicitação é adequado no celular?
- “A partir de” e “sob orçamento” são compreendidos sem gerar expectativa de preço final?
- O modo compacto é usado por quem opera a agenda?
- Há necessidade de atribuição automática de profissional?

## 13. Decisões pendentes
- Método de autenticação, recuperação de acesso e política de sessão.
- Monitoramento e alertas de erro.
- Backups e retenção de dados (inclui atendimento a pedidos de exclusão).
- Armazenamento de imagens (logotipo, produtos) e limites.
- Entrega e rastreio de e-mails transacionais.
- Planos, preços e cobrança da assinatura (fora do MVP).
- Textos legais: termos de uso e política de privacidade.

---

## 14. Critérios de aceite do MVP
- [ ] Os três ambientes estão diferenciados e as rotas principais existem.
- [ ] Catálogo público e ambiente privado da empresa não se confundem.
- [ ] O cliente sabe quando existe apenas uma solicitação e quando há confirmação.
- [ ] Agenda consolidada e disponibilidade por profissional são coerentes, com proteção real contra dupla reserva no servidor.
- [ ] Horários ocupados não revelam dados de outros clientes.
- [ ] Bloqueios e conflitos têm tratamento visual e alternativas.
- [ ] O reagendamento nunca libera o horário anterior antes de confirmar o novo.
- [ ] Temas e densidades funcionam de forma consistente em todas as telas.
- [ ] Celular, tablet e computador têm adaptações reais.
- [ ] A base de conhecimento está integrada (pública e contextual).
- [ ] Permissões e ações sensíveis são compreensíveis, justificadas e auditadas.
- [ ] Não há métricas, parceiros ou resultados inventados.
- [ ] Estados obrigatórios (§8.5) estão implementados.

---

## 15. Fluxos de referência (protótipo)

| Fluxo | Caminho |
|---|---|
| A · Cliente contrata | Catálogo → fornecedor → serviço → solicitação → revisão → envio → proposta → aceitação → confirmação → acompanhamento |
| B · Empresa atende | Nova solicitação → análise → atribuição → proposta → confirmação do cliente → OS → execução → conclusão → próximo retorno |
| C · Empresa organiza a agenda | Jornada → duração → bloqueio → disponibilidade → tentativa de conflito → orientação → alternativa |
| D · Admin habilita empresa | Empresa pendente → análise cadastral → habilitação → auditoria → perfil público disponível |
| E · Revogação de acesso | Profissional → atendimentos futuros → reatribuição → revogação → histórico preservado |
| F · Ajuda contextual | Dúvida na agenda → ajuda → artigo → retorno ao fluxo sem perder dados |

O passo a passo de cada fluxo no protótipo está na seção 4 de `EloServ Handoff.dc.html`.
