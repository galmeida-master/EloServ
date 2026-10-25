// RF-EMP-01 · Visão geral acionável (indicadores derivados dos dados; sem percentuais de crescimento).
import { h, Kpis, Alerta, Badge, icone } from '../../ui/components.js';
import { visaoGeralEmpresa } from '../../api/companies.js';
import { agora } from '../../api/clock.js';
import { formatarDataHora, rotuloFuso, formatarData } from '../../domain/datas.js';

export function avisoSituacao(emp) {
  if (emp.situacao === 'ativa') return null;
  const t = {
    preenchimento: ['info', 'Cadastro em preenchimento', 'Complete os dados obrigatórios e envie para habilitação. O perfil público ainda não está visível.'],
    aguardando: ['warn', 'Aguardando habilitação', 'A administração está analisando o cadastro. Você pode configurar serviços e equipe; o perfil público fica oculto até a habilitação.'],
    suspensa: ['err', 'Empresa suspensa', 'Perfil público oculto e novas solicitações bloqueadas. Atendimentos já confirmados continuam visíveis para tratamento.' + (emp.justificativa ? ' Motivo informado pela administração: ' + emp.justificativa : '')],
    arquivada: ['info', 'Empresa arquivada', 'Empresa encerrada na plataforma. Histórico preservado em modo de leitura.']
  }[emp.situacao];
  return Alerta({ tipo: t[0], titulo: t[1] }, h('p', null, t[2]), h('p', { class: 'small' }, h('a', { href: '#/empresas/perfil' }, 'Ver situação e impactos no perfil da empresa')));
}

export function Visao({ usuario, empresaId }) {
  const v = visaoGeralEmpresa(usuario, empresaId);
  const emp = v.empresa;
  return h('div', { class: 'stack' },
    h('div', { class: 'page-head' }, h('div', null, h('h1', null, 'Visão geral'), h('p', null, `Hoje: ${formatarData(agora(), emp.fuso)} · ${rotuloFuso(emp.fuso)}`)),
      h('a', { class: 'btn btn-secondary', href: '#/empresas/agenda' }, icone('calendar-blank'), v.gestor ? 'Abrir agenda' : 'Abrir minha agenda')),
    avisoSituacao(emp),
    Kpis(v.kpis),
    v.gestor ? h('section', { class: 'card stack-sm', 'aria-labelledby': 'ev-acao' }, h('h2', { id: 'ev-acao' }, 'Precisa da sua ação'),
      v.acoes.length ? h('ul', { class: 'list' }, v.acoes.map((a, i) => h('li', { key: 'a' + i }, h('a', { class: 'list-item', href: a.href },
        h('span', { class: 'row', style: 'flex-wrap:nowrap' }, h('span', { class: 'badge t-' + a.tom, 'aria-hidden': 'true' }, icone(a.icone)), h('span', { class: 'main' }, h('span', { class: 'strong' }, a.titulo), h('span', { class: 'small text2' }, a.texto))),
        icone('caret-right'))))) : h('p', { class: 'muted' }, 'Nada pendente no momento.')) : null,
    h('div', { class: 'grid-2', style: 'align-items:start' },
      h('section', { class: 'card stack-sm', 'aria-labelledby': 'ev-hoje' }, h('h2', { id: 'ev-hoje' }, 'Atendimentos de hoje'),
        v.hoje.length ? h('ul', { class: 'list' }, v.hoje.map(o => h('li', null, h('a', { class: 'list-item', href: '#/empresas/ordens/' + o.id }, h('span', { class: 'main' }, h('span', { class: 'strong tabular' }, formatarDataHora(o.inicio, emp.fuso)), h('span', { class: 'small text2' }, `${o.id} · ${o.servico}`))))))
          : h('p', { class: 'muted' }, 'Nenhum atendimento hoje.')),
      h('section', { class: 'card stack-sm', 'aria-labelledby': 'ev-prox' }, h('h2', { id: 'ev-prox' }, 'Próximos dias'),
        v.proximos.length ? h('ul', { class: 'list' }, v.proximos.map(o => h('li', null, h('a', { class: 'list-item', href: '#/empresas/ordens/' + o.id },
          h('span', { class: 'main' }, h('span', { class: 'strong tabular' }, formatarDataHora(o.inicio, emp.fuso)), h('span', { class: 'small text2' }, `${o.id} · ${o.servico}`)), h('span', { class: 'small' }, o.profissional)))))
          : h('p', { class: 'muted' }, 'Nenhum atendimento agendado.'))),
    h('p', { class: 'xsmall muted' }, 'Empresa e dados fictícios para demonstração. ', Badge('empresa', emp.situacao)));
}
