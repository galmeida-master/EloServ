# EloServ — MVP navegável

> Conecte a equipe. Organize cada serviço.

Protótipo navegável do MVP da **EloServ**, plataforma para pequenas empresas de climatização e refrigeração organizarem a jornada do primeiro contato ao próximo atendimento: catálogo público, solicitação, proposta, confirmação, agenda por profissional, ordem de serviço e histórico — com ambientes separados para **clientes** (`/clientes`), **empresas** (`/empresas`) e **administração** (`/admin`).

É uma aplicação **estática** (HTML, CSS e JavaScript em módulos ES), sem framework e sem etapa de build, publicada no GitHub Pages: **https://galmeida-master.github.io/EloServ/**

---

## ⚠️ Esta é uma demonstração

- **Não há servidor.** Todos os dados ficam salvos **somente neste navegador** (`localStorage`), por meio de uma camada `src/api/` que **simula** um servidor. A faixa “Demonstração — dados fictícios, salvos neste navegador” aparece em todas as telas.
- **Autenticação, isolamento de dados e prevenção de dupla reserva são simulados.** Não há verificação real de senha nem proteção de conta. As permissões são aplicadas pela camada que simula o servidor, dentro do próprio navegador — portanto qualquer pessoa com acesso ao navegador pode alterar os dados.
- **Todos os dados são fictícios**: empresas, pessoas, contatos (`@exemplo.invalid`), CNPJ `00.000.000/0000-00`, valores e horários. Não há parceiros, avaliações, depoimentos ou métricas reais.
- A EloServ **não** se apresenta como “100% segura” nem como “totalmente adequada à LGPD”. Veja também a página **Ajuda › Privacidade e segurança nesta demonstração**.

> A interface não garante sozinha a prevenção de dupla reserva. A aplicação final deve validar e gravar reservas de forma transacional no backend, com proteção no banco de dados para impedir sobreposição de intervalos ativos por profissional.

---

## Como rodar

Requisitos: Node.js 22.8 ou superior (apenas para o servidor local e os testes; a aplicação em si não precisa de Node).

```bash
npm start
```

Abra `http://localhost:4173/`. Qualquer servidor estático funciona (por exemplo, `npx serve .`), desde que sirva a raiz do repositório.

## Como testar

```bash
npm ci
npm run lint          # ESLint + verificação de HTML
npm run test:unit     # testes unitários com cobertura (mínimo de 90% em src/domain)
npx playwright install chromium webkit
npm run test:e2e      # Playwright em Chromium e WebKit
```

- Os testes E2E sobem o servidor estático automaticamente, fixam o relógio em **sáb, 24/10/2026, 10:00 (Cuiabá)** e **falham se houver qualquer `console.error` ou erro de página**.
- Relatório HTML: `npx playwright show-report`.
- A matriz fluxo × teste × critério de aceite está em [`docs/TESTES.md`](docs/TESTES.md).

## Personas da demonstração

Entre pela tela **Entrar** (qualquer credencial com 8 ou mais caracteres) ou troque de persona no **painel Simulação**.

| Persona | E-mail | Vínculos |
|---|---|---|
| Visitante | — | Sem conta: consulta catálogo e ajuda; preenche a solicitação e entra no envio |
| Ana Ribeiro | `ana.demo@exemplo.invalid` | Cliente |
| Marina Duarte | `marina.demo@exemplo.invalid` | Gestora da FrioVale **e** cliente (demonstra o seletor de ambiente) |
| Carlos Mendes | `carlos.demo@exemplo.invalid` | Técnico da FrioVale (só a própria agenda e os atendimentos atribuídos) |
| Paulo Lemos | `paulo.demo@exemplo.invalid` | Administração · Operações |
| Lúcia Prado | `lucia.demo@exemplo.invalid` | Administração · Principal (única principal habilitada) |

Personas extras (painel Simulação › “Outras personas de teste”): Diego (outra empresa, para isolamento), Rogério (empresa aguardando habilitação), Ivete (cadastro em preenchimento, sem serviços), Otávio (empresa suspensa) e Rafael (técnico).

## Painel de simulação

Botão **Simulação** na faixa de demonstração — controles rotulados, separados da interface real:

- Alternar persona.
- **Simular falha de conexão no próximo envio** (nada é gravado).
- **Simular reserva concorrente no horário selecionado** (cria reservas reais na camada `api`, ocupando todos os profissionais elegíveis).
- **Respostas simuladas** da outra parte: empresa envia proposta, cliente confirma, outra operação ocupa o horário durante a confirmação, empresa/cliente responde ao reagendamento.
- **Relógio da demonstração** (+1 hora, +1 dia) para demonstrar expiração de reservas, propostas e pedidos de reagendamento.
- Estados de tela: catálogo com erro de conexão, busca sem resultados, sessão expirada, página não encontrada.
- **Fila de e-mail simulada** (com falha opcional) — falhas de e-mail não alteram reservas confirmadas.
- Latência artificial (400–900 ms, rápida ou sem atraso).
- **Restaurar dados demonstrativos.**

## Arquitetura

```
index.html            shell único (tema aplicado no <head> antes da primeira renderização)
404.html              redireciona endereços sem âncora para o roteamento por âncora (GitHub Pages)
assets/css/           tokens (tema e densidade), base e componentes
assets/fonts/         Inter (servida localmente)
src/main.js           inicialização, renderização, foco e sincronização entre abas
src/router.js         rotas do PRD §4 com guardas de autenticação e permissão
src/store.js          estado da interface (somente UI)
src/domain/           funções puras: agenda, estados, permissões, fuso, validações, concorrência (100% testadas)
src/api/              “servidor simulado”: única porta de escrita (db, auth, agenda, requests, orders, companies, users, kb, audit, notifications, seed)
src/ui/               DOM declarativo com reconciliação, componentes acessíveis e ícones Phosphor (SVG local)
src/views/            telas: public/, clientes/, empresas/, admin/, painel de simulação
tests/unit/           node --test (domínio e API)
tests/e2e/            Playwright (fluxos, estados, permissões, temas, responsivo, acessibilidade)
```

**Servidor simulado (`src/api/db.js`)** — cada escrita é uma transação local que: lê o estado mais recente do armazenamento; executa a regra de negócio; verifica a versão dos registros tocados (controle otimista → `CONFLITO_ATUALIZACAO`); grava atomicamente (uma única chave) incrementando versões; e avisa as outras abas por `BroadcastChannel('eloserv')`. As escritas são serializadas entre abas com **Web Locks** (`navigator.locks`), com fallback de trava em `localStorage` com expiração. Operações de envio aceitam **chave de idempotência** (a mesma chave devolve o mesmo resultado sem duplicar). Reservas temporárias, propostas, pedidos de reagendamento e convites **expiram** ao carregar a página e a cada minuto.

As telas **nunca escrevem no armazenamento**: chamam `src/api/*`, que valida permissões e regras e devolve `{ ok, data }` ou `{ ok: false, code, message }`. O modelo de dados local é **do protótipo** e não é o esquema de produção.

**Sem dependências em tempo de execução**: apenas a fonte Inter e os ícones Phosphor, ambos servidos localmente (`assets/fonts`, `src/ui/icons-data.js`). Dependências de desenvolvimento ficam no `package.json`.

## Publicação

O workflow [`.github/workflows/ci.yml`](.github/workflows/ci.yml) roda lint, testes unitários com cobertura e Playwright (Chromium + WebKit, com relatório e traces em falha) e, na branch `main` com tudo verde, publica no GitHub Pages (`actions/upload-pages-artifact` + `actions/deploy-pages`). Todos os caminhos são relativos para funcionar sob `https://<usuario>.github.io/<repo>/`.

## Limitações conhecidas

- Sem backend, sem autenticação real e sem segurança de produção; dados apenas no navegador atual (não sincronizam entre dispositivos).
- Abas do mesmo navegador compartilham a sessão e os dados (o que permite demonstrar conflitos reais entre abas).
- E-mails, convites, exportação e exclusão de dados são apenas **registrados** (simulados).
- Pagamento, comissões, cobrança de assinatura, emissão fiscal, estoque/carrinho, chat, avaliações por estrelas, aplicativo nativo, operação offline com sincronização, IA, IoT, rotas, certificações e integração com WhatsApp estão **fora do escopo**.
- Decisões, hipóteses e o que fica para a versão com backend: [`docs/DECISOES.md`](docs/DECISOES.md).

## Referências de produto

- [`docs/EloServ PRD MVP.md`](docs/EloServ%20PRD%20MVP.md) — requisitos (fonte da verdade).
- `docs/EloServ Handoff.dc.html` e `docs/EloServ*.dc.html` — handoff e protótipos de referência visual.
- [`docs/Padrão de tabelas.md`](docs/Padr%C3%A3o%20de%20tabelas.md) — padrão aplicado às tabelas (busca, ordenação, paginação).

## Licenças de terceiros

- Inter — SIL Open Font License 1.1 (`assets/fonts/LICENSE-Inter.txt`).
- Phosphor Icons — MIT (`src/ui/icons-data.js`, gerado por `scripts/build-icons.mjs`).
