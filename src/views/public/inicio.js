// RF-PUB-01 · Página inicial. Sem métricas inventadas, logotipos de parceiros, depoimentos ou selos.
import { h, Botao, Badge, icone } from '../../ui/components.js';

const SERVICOS_RECORTE = ['Instalação de ar-condicionado split', 'Higienização', 'Manutenção preventiva', 'Diagnóstico técnico', 'Refrigeração comercial'];

export function Inicio() {
  return h('div', { class: 'stack', style: 'gap:48px' },
    h('section', { class: 'hero', 'aria-labelledby': 'hero-titulo' },
      h('div', { class: 'stack' },
        h('h1', { class: 'display', id: 'hero-titulo' }, 'Organize seus serviços. Facilite o próximo atendimento.'),
        h('p', { class: 'slogan' }, 'Conecte a equipe. Organize cada serviço.'),
        h('p', { class: 'lead' }, 'Catálogo, disponibilidade, solicitação, confirmação e histórico em um só lugar — para quem contrata e para pequenas empresas de climatização e refrigeração.'),
        h('div', { class: 'row' },
          Botao({ texto: 'Encontrar um fornecedor', icone: 'magnifying-glass', variante: 'primary', href: '#/fornecedores' }),
          Botao({ texto: 'Cadastrar minha empresa', icone: 'buildings', href: '#/cadastro?tipo=empresa' })),
        h('p', { class: 'small muted' }, 'Recorte inicial: Mato Grosso, com possibilidade de expansão para o Centro-Oeste.')),
      h('div', { class: 'card stack-sm', role: 'group', 'aria-label': 'Exemplo demonstrativo de acompanhamento' },
        h('p', { class: 'xsmall muted' }, 'SOL-0000 · exemplo demonstrativo'),
        h('h2', null, 'Higienização de split'),
        h('dl', { class: 'dl' },
          h('dt', null, 'Solicitação'), h('dd', null, Badge('solicitacao', 'proposta'), ' ', h('span', { class: 'small text2' }, 'aguardando você')),
          h('dt', null, 'Agenda'), h('dd', null, Badge('ocupacao', 'temporaria'), ' ', h('span', { class: 'small text2' }, 'com prazo informado')),
          h('dt', null, 'Execução'), h('dd', null, Badge('execucao', 'aguardando'))),
        h('p', { class: 'small text2' }, 'Escolher um horário envia uma solicitação. O agendamento só é concluído depois que você confirma a proposta da empresa.'))),

    h('section', { class: 'stack', 'aria-labelledby': 'como-contratar' },
      h('h2', { id: 'como-contratar' }, 'Como contratar um serviço'),
      h('ol', { class: 'steps-4' }, [
        ['01', 'Encontre uma empresa', 'Filtre por cidade, categoria, serviço e atendimento residencial ou comercial.'],
        ['02', 'Envie uma solicitação', 'Informe equipamento, local, necessidade e, se quiser, um horário disponível.'],
        ['03', 'Analise a proposta', 'A empresa responde com valores, condições, validade e horário proposto.'],
        ['04', 'Confirme e acompanhe', 'Ao confirmar, o horário é revalidado e o atendimento passa a ser acompanhado até a conclusão.']
      ].map(([n, t, d]) => h('li', { class: 'card stack-xs' }, h('span', { class: 'step-num', 'aria-hidden': 'true' }, n), h('h3', null, t), h('p', { class: 'text2 small' }, d))))),

    h('section', { class: 'stack', 'aria-labelledby': 'para-equipes' },
      h('div', { class: 'row-between' },
        h('div', { class: 'stack-xs' }, h('h2', { id: 'para-equipes' }, 'Como a EloServ ajuda pequenas equipes'),
          h('p', { class: 'text2' }, 'Para proprietários e gestores que organizam técnicos, agenda e clientes sem uma equipe administrativa dedicada.')),
        Botao({ texto: 'Cadastrar minha empresa', href: '#/cadastro?tipo=empresa' })),
      h('ul', { class: 'grid-3' }, [
        ['calendar-blank', 'Agenda consolidada', 'Disponibilidade calculada pelos profissionais, jornadas e bloqueios.'],
        ['clipboard-text', 'Solicitações e propostas', 'Responda pedidos com itens, condições e validade.'],
        ['file-text', 'Ordens de serviço', 'Execução, observações, conclusão e resumo imprimível.'],
        ['users', 'Equipe com acesso limitado', 'Técnicos veem apenas os atendimentos atribuídos.'],
        ['address-book', 'Clientes e equipamentos', 'Histórico por equipamento e próximos retornos.'],
        ['storefront', 'Perfil público', 'Serviços, produtos informativos, horários e políticas.']
      ].map(([ic, t, d]) => h('li', { class: 'card row', style: 'align-items:flex-start;flex-wrap:nowrap' }, icone(ic, { classe: 'ic-lg' }), h('div', { class: 'stack-xs' }, h('h3', null, t), h('p', { class: 'small text2' }, d)))))),

    h('section', { class: 'stack-sm', 'aria-labelledby': 'servicos-recorte' },
      h('h2', { id: 'servicos-recorte' }, 'Serviços atendidos no recorte inicial'),
      h('ul', { class: 'chips' }, SERVICOS_RECORTE.map(s => h('li', null, h('a', { class: 'chip', style: 'padding-right:12px;text-decoration:none', href: '#/fornecedores?servico=' + encodeURIComponent(s === 'Higienização' ? 'Higienização de split' : s === 'Instalação de ar-condicionado split' ? 'Instalação de split' : s === 'Refrigeração comercial' ? 'Manutenção de câmara fria' : s) }, s))))),

    h('section', { class: 'stack', 'aria-labelledby': 'tres-situacoes' },
      h('div', { class: 'stack-xs' }, h('h2', { id: 'tres-situacoes' }, 'Solicitação, agenda e execução são acompanhadas separadamente'),
        h('p', { class: 'text2' }, 'Cada pedido tem três situações independentes. Assim fica claro quando existe apenas uma solicitação e quando o atendimento está confirmado.')),
      h('div', { class: 'tracks' },
        h('div', { class: 'track' }, h('h3', { class: 'k' }, 'Solicitação'), h('p', { class: 'small' }, 'Enviada → Em análise → Proposta enviada → Aceita. Também pode terminar como Recusada, Cancelada ou Expirada.')),
        h('div', { class: 'track' }, h('h3', { class: 'k' }, 'Ocupação da agenda'), h('p', { class: 'small' }, 'Reserva temporária com prazo explícito → Confirmada após você aceitar e o horário ser revalidado. Recusa, cancelamento ou expiração liberam o horário.')),
        h('div', { class: 'track' }, h('h3', { class: 'k' }, 'Execução'), h('p', { class: 'small' }, 'Agendada → Em execução → Concluída, com profissional atribuído e próximo retorno quando informado.')))),

    h('section', { class: 'stack-sm', 'aria-labelledby': 'faq' },
      h('h2', { id: 'faq' }, 'Dúvidas frequentes'),
      h('div', null, [
        ['Escolher um horário já garante o atendimento?', 'Não. O horário fica em reserva temporária com prazo informado. O agendamento é concluído quando você confirma a proposta e o sistema revalida o horário.'],
        ['Posso pagar pela EloServ?', 'Não nesta versão. Valores e forma de pagamento são combinados diretamente com a empresa.'],
        ['As empresas são certificadas pela EloServ?', 'Não. A habilitação na EloServ é uma verificação cadastral e não representa certificação técnica.'],
        ['Qual fuso horário é usado?', 'O fuso configurado pela empresa, exibido na revisão e na confirmação. Datas no padrão brasileiro e relógio de 24 horas.'],
        ['Meus dados estão seguros nesta demonstração?', 'Esta é uma demonstração com dados fictícios, salvos apenas neste navegador. Autenticação e prevenção de dupla reserva são simuladas.']
      ].map(([q, r]) => h('details', { class: 'faq' }, h('summary', null, q), h('p', null, r)))),
      h('p', null, Botao({ texto: 'Ver central de ajuda', icone: 'question', href: '#/ajuda' }))));
}
