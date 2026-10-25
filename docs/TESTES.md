# Testes

## Como rodar

```bash
npm run lint        # ESLint + html-validate
npm run test:unit   # node --test com cobertura; falha abaixo de 90% (linhas e funções) e 85% (ramos) em src/domain
npm run test:e2e    # Playwright: Chromium + WebKit
```

- **Unitários** (`tests/unit`): 132 testes. Cobertura de `src/domain`: 100% das linhas e funções, cerca de 97% dos ramos.
- **E2E** (`tests/e2e`): relógio fixo em sáb, 24/10/2026, 10:00 (Cuiabá), latência curta, e **falha automática em qualquer `console.error` ou erro de página** (`tests/e2e/fixtures.js`). Cada teste roda em contexto isolado (armazenamento próprio).

## Matriz fluxo × teste × critério de aceite (PRD §14)

| Fluxo / tema | Arquivo de teste | O que verifica | Critérios §14 |
|---|---|---|---|
| A · Cliente contrata | `e2e/fluxo-a.spec.js` | Catálogo → perfil → solicitação como visitante → login no meio sem perder dados → revisão com fuso → envio (“ainda não é um agendamento”) → três situações → proposta simulada → confirmação → Agendamentos; falha de e-mail não desfaz a confirmação | 1, 3, 4, 10 |
| A · conflito no envio | `e2e/fluxo-a-conflito-envio.spec.js` | Reserva concorrente real na camada `api` → `HORARIO_INDISPONIVEL` → nada gravado, dados preservados, conflito auditado → alternativa → sucesso | 4, 6 |
| A · conflito na confirmação | `e2e/fluxo-a-conflito-confirmacao.spec.js` | Duas abas (`context.newPage()`): a aba 2 confirma primeiro; a aba 1 recebe `CONFLITO_ATUALIZACAO` da `api`; uma única OS | 4 |
| A · duplo clique | `e2e/fluxo-a-duplo-clique.spec.js` | Botão com `aria-busy` e desabilitado + idempotência: uma única solicitação e uma única reserva | 4 |
| A · falha de rede | `e2e/fluxo-a-falha-rede.spec.js` | Falha simulada → revisão do banco inalterada → nova tentativa envia | 4, 13 |
| B · Empresa atende | `e2e/fluxo-b.spec.js` | Atribuição com elegibilidade/disponibilidade → proposta com fuso → confirmação do cliente → OS-2210 → execução → conclusão exige trabalho realizado → retorno → resumo imprimível → Histórico e retornos | 2, 4 |
| C · Agenda | `e2e/fluxo-c.spec.js` | Jornadas e regras (preparo, duração) → consulta de disponibilidade → bloqueio conflitante não salvo com afetados e orientação → janela alternativa → bloqueio salvo → agenda pública só com horários e “Indisponível”, sem nomes, ordens ou motivos | 4, 5, 6 |
| D · Habilitação | `e2e/fluxo-d.spec.js` | Análise cadastral → habilitar exige justificativa → auditoria registrada → empresa no catálogo com “Habilitada recentemente” | 11 |
| E · Revogação | `e2e/fluxo-e.spec.js` | Botão bloqueado até tratar os 3 atendimentos (opções indisponíveis desabilitadas com motivo) → reatribuição/combinar → revogação → histórico preservado → técnico perde acesso → auditoria | 11 |
| F · Ajuda contextual | `e2e/fluxo-f.spec.js` | Bloqueio preenchido → “Como funciona?” → painel do artigo → voltar → campos intactos e foco devolvido | 10 |
| Reagendamento | `e2e/reagendamento.spec.js` | Pedido → original continua ocupado na agenda da empresa e o novo reservado → confirmação → original liberado → linha do tempo | 7 |
| Permissões | `e2e/permissoes.spec.js` | Visitante → entrar; técnico só agenda/atendimentos/ajuda (“permissão insuficiente”), sem admin/cliente; cliente em URLs de empresa/admin → acesso negado; empresa A não vê dados da B; seletor de ambiente; último principal e autoelevação | 1, 2, 11 |
| Estados obrigatórios | `e2e/estados.spec.js` | Todos os itens do PRD §8.5 (empresa sem serviços, aguardando, suspensa; cliente sem histórico; agenda sem atendimentos; busca sem resultados; profissional indisponível; serviço desativado; proposta expirada; horário ocupado na confirmação; erro de conexão; falha no envio; sessão expirada; permissão insuficiente; texto longo; paginação; mudanças não salvas; sucesso após criar/atualizar) | 13 |
| Temas e densidade | `e2e/temas.spec.js` | Primeira visita em Escuro; persistência após recarregar; independência entre tema e densidade e entre ambientes; “Sistema” segue `prefers-color-scheme` emulado; sem flash (tema aplicado com o JavaScript da aplicação bloqueado) | 8 |
| Responsivo | `e2e/responsivo.spec.js` | 390, 768 e 1440 px sem rolagem horizontal em todas as rotas principais; menu lateral (≥1024), menu recolhível (tablet), barra inferior do cliente (<640); agenda em lista no celular; alvos ≥ 44 px no toque, também no compacto | 9 |
| Acessibilidade | `e2e/acessibilidade.spec.js` | `@axe-core/playwright` sem violações *serious*/*critical* em 24 rotas e com diálogos/painéis abertos, nos dois temas; teclado nos fluxos A e C; foco preso, Escape e retorno do foco | 8, 9 |
| Fumaça | `e2e/fumaca.spec.js` | Página inicial, faixa de demonstração, rotas dos três ambientes, 404 | 1, 2, 12 |

Critérios do PRD §14:

1. Os três ambientes estão diferenciados e as rotas principais existem.
2. Catálogo público e ambiente privado da empresa não se confundem.
3. O cliente sabe quando existe apenas uma solicitação e quando há confirmação.
4. Agenda consolidada e disponibilidade por profissional coerentes, com proteção contra dupla reserva (simulada no navegador; ver `DECISOES.md` §4).
5. Horários ocupados não revelam dados de outros clientes.
6. Bloqueios e conflitos têm tratamento visual e alternativas.
7. O reagendamento nunca libera o horário anterior antes de confirmar o novo.
8. Temas e densidades consistentes em todas as telas.
9. Celular, tablet e computador com adaptações reais.
10. Base de conhecimento integrada (pública e contextual).
11. Permissões e ações sensíveis compreensíveis, justificadas e auditadas.
12. Sem métricas, parceiros ou resultados inventados (dados fictícios identificados; indicadores derivados dos dados).
13. Estados obrigatórios (§8.5) implementados.

## Testes unitários

| Arquivo | Cobertura funcional |
|---|---|
| `unit/agenda.test.js` | Sobreposição (bordas fim = início, preparo), temporária vs. confirmada, liberada e temporária vencida não ocupam; jornada, intervalo, folga, feriado fechado/parcial, bloqueio, elegibilidade por serviço, situação do profissional, horário passado, virada de dia; profissionais em paralelo, ausência de vaga, escolha do profissional, disponibilidade por profissional e união exibida ao cliente; janelas livres, conflitos de bloqueio e sugestões; alternativas de horário |
| `unit/estados.test.js` | Todas as transições válidas e rejeição de todas as inválidas nas três máquinas; estados iniciais; relações entre dimensões (aceita ⇔ confirmada + execução; encerradas ⇒ liberada; sem execução antes da aceitação; bloqueio sem solicitação); rótulos com texto + ícone |
| `unit/reservas.test.js` | Expiração de reserva temporária e de proposta; reagendamento vencido mantém o original; convites; prazos; regras de reagendamento (original preservado até a confirmação; recusa/expiração mantêm o original); política de cancelamento |
| `unit/permissoes.test.js` | Matriz do PRD §7 completa, isolamento entre empresas, técnico sem acesso, vínculos suspensos, acesso a rotas, seletor de ambiente, último administrador principal e autoelevação |
| `unit/datas.test.js` | UTC ↔ `America/Cuiaba` e `America/Sao_Paulo`, deslocamentos, rótulos de fuso, formatação pt-BR (dd/mm/aaaa, 24 h), aritmética de calendário |
| `unit/validacao.test.js` | Validação por etapa da solicitação e resumo de erros; cadastro, bloqueio, proposta, artigo, justificativa; minimização de dados; valores e preços; versão de registro e idempotência |
| `unit/api.test.js` | Camada `api` com armazenamento em memória: reserva na solicitação, idempotência concorrente, conflito real com alternativas e auditoria, falha de conexão, conflito de versão entre confirmações paralelas, revalidação na confirmação, proposta/ajuste/recusa, reagendamento, bloqueios, expiração, execução da OS, revogação com tratamento, habilitação, proteções administrativas, sessão e e-mail desacoplado |
