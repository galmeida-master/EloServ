# Decisões, hipóteses e divergências

Fontes da verdade, nesta ordem: `EloServ PRD MVP.md` → `EloServ Handoff.dc.html` → protótipos `EloServ*.dc.html`. Quando o PRD e o protótipo divergem, segue-se o PRD e a divergência é registrada aqui.

## 1. Insumos

- O arquivo `eloserv-data.js` (dados do protótipo) **não estava entre os artefatos**. Os dados demonstrativos foram **reconstruídos** a partir dos textos e scripts visíveis dos protótipos (`EloServ.dc.html`, `EloServ Empresas.dc.html`, `EloServ Admin.dc.html`) em `src/api/seed.js` e `src/api/seed-artigos.js`. Serviços, durações, preços, profissionais, agenda, solicitações, ordens, empresas, usuários e auditoria seguem os valores dos protótipos; descrições de serviços e artigos da base de conhecimento foram escritos para o MVP.
- O padrão `Padronização de Tabelas, Paginação, Ordenação e Pesquisa.md` (insumo do usuário) foi aplicado às tabelas: busca com debounce de 300 ms por substring em qualquer coluna e sugestões; ordenação em todas as colunas (asc → desc → original) com indicador; paginação a partir de 10 registros, 10 por página por padrão, seletor 10/15/20/25/50 no rodapé e anterior/próxima no topo; quebra de linha em vez de rolagem horizontal; colunas de ação à direita.

## 2. Hipóteses adotadas (PRD §11)

| # | Hipótese | Onde está |
|---|---|---|
| H1 | Reserva temporária padrão de 24 h, configurável por empresa (12/24/48 h) | `domain/reservas.js` (`VALIDADE_RESERVA_PADRAO_H`), Configurações da agenda |
| H2 | Preparo/deslocamento fixo por empresa (30 min na demonstração; 0/15/30/45/60) | `domain/agenda.js` (`verificarProfissional`), Configurações da agenda |
| H3 | Empresa responde reagendamento em até 48 h; sem resposta, mantém o original | `domain/reservas.js` (`prazoReagendamento`), rotina de expiração |
| H4 | Convite de profissional expira em 7 dias | `domain/reservas.js` (`VALIDADE_CONVITE_DIAS`), rotina de expiração |
| H5 | Sessão expira após 30 min sem atividade | `api/auth.js` (`LIMITE_INATIVIDADE`) |
| H6 | Níveis de administrador Principal, Operações e Suporte; sempre ao menos um Principal habilitado | `domain/permissoes.js` |
| H7 | Técnico vê apenas agenda própria e atendimentos atribuídos | `domain/permissoes.js` (`SECOES_TECNICO`, `os.atualizar`) |
| H8 | Cancelamento sem custo até 12 h antes (política demonstrativa) | `domain/reservas.js` (`avaliarCancelamento`), perfil público |

Outras regras adotadas:

- **Validade da proposta termina antes do horário proposto** (a reserva temporária acompanha a validade da proposta).
- **Reagendamento reserva o novo horário no momento do pedido** (reserva temporária com o prazo de resposta). Assim, o original nunca é liberado antes de o novo estar garantido; recusa, retirada ou vencimento liberam apenas o novo.
- **Tempo de preparo** vale entre atendimentos (sobreposição com folga); **bloqueios** usam sobreposição simples. Fim igual ao início não é sobreposição.
- **Escolha automática do profissional** na reserva: elegível e livre, preferindo o de menor carga no dia (empate: ordem de cadastro). A empresa pode reatribuir ao enviar a proposta.
- **Disponibilidade pública** em passos de 30 min; horários passados e intervalos aparecem como “Indisponível”, sem motivo.
- **Habilitar/suspender/reativar/arquivar empresa**: níveis Principal e Operações; Suporte não. Justificativa mínima de 10 caracteres em todas as ações sensíveis.
- **“Habilitada recentemente”** no catálogo: até 7 dias após a habilitação.
- **Revogação de profissional** remove seus bloqueios internos futuros; suspensão os mantém.
- **Aceite de convite** em `/convite/:id` (rota adicional, não listada no PRD §4) para cobrir o estado “convite expirado” (RF-ACS-03). Como não há e-mail real, o link do convite aparece na tela do profissional convidado.
- **Rotas extras de estado**: `/sessao-expirada` e `/acesso-negado`, como no mapa de navegação do handoff.

## 3. Divergências entre PRD e protótipo (e escolhas)

| Tema | Protótipo | Decisão (segue o PRD) |
|---|---|---|
| Suspender profissional com atendimentos futuros | Apenas sinalizava os atendimentos | PRD RF-EMP-04: suspender **e** revogar exigem tratar cada atendimento (reatribuir ou combinar novo horário) e justificativa |
| Controles de simulação | Dentro da revisão da solicitação e da confirmação | Movidos para o **painel Simulação** (nunca misturados à interface real) |
| Conflito na confirmação | Apenas simulado | Conflito **real** produzido pela camada `api` (versão do registro e revalidação do horário); o painel também pode criar uma ocupação concorrente |
| OS-2207 (Instalação, Rafael) | 10:00–13:00, sobrepondo o intervalo | 08:30–11:30, respeitando o intervalo de 12:00–13:00 |
| OS-2206 (Diagnóstico, Juliana) | 2 h | 1 h (duração do serviço de diagnóstico) |
| Folga de Rafael | Bloqueio “BLQ-07 Folga” | Modelada como **folga** da jornada (regra de domínio testada); aparece na agenda como “Folga” |
| Otávio (empresa suspensa) | Usuário suspenso | Usuário ativo, para que o estado “Empresa suspensa” seja alcançável pela persona |
| Nomes de clientes | “Paulo S.” e “Lúcia F.” | “Pedro S.” e “Luíza F.”, para não confundir com os administradores Paulo Lemos e Lúcia Prado |
| E-mail público da FrioVale | `contato@friovale.exemplo` | `contato@friovale.exemplo.invalid` (domínio reservado) |
| Datas | Fixas em 26–30/10/2026 | Relativas: a “semana de demonstração” são os **próximos cinco dias úteis** a partir da criação dos dados (os testes fixam o relógio em 24/10/2026, reproduzindo as datas do protótipo) |
| Tema claro, `--muted` | `#64748B` | `#5B6779`, para manter contraste AA sobre `--raised` (`#F1F5F9`) |
| Fonte e ícones | Google Fonts e Phosphor via CDN | Servidos localmente (sem dependência de rede em tempo de execução e sem erros de console nos testes) |
| Pedir nova proposta | Voltava para “Enviada” | Mantido: transição explícita `Expirada → Enviada`, sem horário reservado até a resposta |

## 4. O que fica para a versão com backend

A demonstração simula o servidor no navegador. A aplicação final (referência: Next.js + TypeScript, PostgreSQL/Neon, Vercel, e-mail transacional) precisa de:

- **Reservas transacionais no banco**, com restrição de exclusão de intervalos ativos por profissional (por exemplo, `EXCLUDE USING gist (profissional_id WITH =, tstzrange(inicio, fim + preparo) WITH &&) WHERE (estado IN ('temporaria','confirmada'))`), revalidação no envio e na confirmação, idempotência persistida e controle de versão por registro.
- **Autenticação real** (método pendente: senha, link mágico ou provedor), recuperação de acesso, expiração de sessão e proteção contra força bruta.
- **Autorização no servidor** por papel e vínculo em todas as rotas e consultas (isolamento entre empresas por padrão), auditoria imutável e acesso administrativo a dados operacionais com justificativa e prazo.
- **E-mail transacional desacoplado** (fila com novas tentativas e rastreio de entrega); falha de e-mail nunca desfaz reserva confirmada.
- **Expiração** de reservas, propostas, reagendamentos e convites por tarefa agendada no servidor.
- **Monitoramento e alertas** de erro, **backups e retenção** (inclusive atendimento a pedidos de exclusão), **armazenamento de imagens** (logotipo, produtos) com limites, textos legais (termos e política de privacidade).
- Planos, preços e cobrança da assinatura (fora do MVP).

## 5. Pontos a validar com usuários (PRD §12)

- Clientes entendem a diferença entre solicitação, reserva temporária e agendamento confirmado?
- Gestores preferem a grade diária por profissional ou uma visão semanal consolidada?
- O número de etapas da solicitação é adequado no celular?
- “A partir de” e “sob orçamento” são compreendidos sem gerar expectativa de preço final?
- O modo compacto é usado por quem opera a agenda?
- Há necessidade de atribuição automática de profissional (hoje a escolha automática só ocorre na reserva temporária)?
- Os prazos propostos (H1–H8) são adequados para a operação real?
