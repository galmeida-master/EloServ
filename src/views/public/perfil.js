// RF-PUB-03 · Perfil público do fornecedor. A agenda pública mostra só horários passíveis de solicitação.
import { h, Botao, Campo, Dialogo, Vazio, FaixaDatas, Horarios, icone } from '../../ui/components.js';
import { estadoView, set, toast, navegar } from '../../store.js';
import { perfilPublico, consultarProduto } from '../../api/companies.js';
import { horariosPublicos, diasParaSolicitacao } from '../../api/agenda.js';
import { rotuloDia, rotuloFuso, dataBr } from '../../domain/datas.js';
import { formatarMoeda, TIPOS_PRECO } from '../../domain/dinheiro.js';
import { atualizarRascunho } from './rascunho.js';

const duracao = min => (min % 60 ? `${Math.floor(min / 60) ? Math.floor(min / 60) + 'h' : ''}${String(min % 60).padStart(2, '0')}${Math.floor(min / 60) ? '' : ' min'}` : `${min / 60}h`);
export const textoDuracao = duracao;

export function PerfilFornecedor({ params }) {
  const p = perfilPublico(params.slug);
  if (!p) {
    return h('div', { class: 'card' }, Vazio({ nivel: 'h1', icone: 'storefront', titulo: 'Fornecedor não encontrado ou indisponível',
      texto: 'O endereço pode estar incorreto, ou a empresa não está recebendo solicitações no momento.', acoes: [Botao({ texto: 'Voltar ao catálogo', href: '#/fornecedores' })] }));
  }
  const dias = diasParaSolicitacao(undefined, { fuso: p.fuso });
  const st = estadoView('perfil:' + p.slug, () => ({ servicoId: p.servicos[0] ? p.servicos[0].id : '', data: dias[0], dlg: null, produto: null, msg: '', busy: false }));
  if (!p.servicos.some(s => s.id === st.servicoId)) st.servicoId = p.servicos[0] ? p.servicos[0].id : '';
  const slots = st.servicoId ? horariosPublicos({ empresaId: p.id, servicoId: st.servicoId, data: st.data }) : [];
  const iniciar = (patch) => { atualizarRascunho(p.slug, { etapa: 0, ...patch }); navegar('/fornecedores/' + p.slug + '/solicitar'); };

  return h('div', { class: 'stack' },
    h('nav', { class: 'crumbs', 'aria-label': 'Trilha' }, h('a', { href: '#/fornecedores' }, 'Fornecedores'), h('span', { 'aria-hidden': 'true' }, '›'), h('span', { 'aria-current': 'page' }, p.nome)),
    h('section', { class: 'card stack-sm' },
      h('div', { class: 'row', style: 'align-items:flex-start;flex-wrap:nowrap' }, h('span', { class: 'avatar avatar-lg', 'aria-hidden': 'true' }, p.ini),
        h('div', { class: 'stack-xs grow' }, h('h1', null, p.nome), h('p', { class: 'text2' }, `${p.cidade} · atende ${p.area.join(', ')} · Atendimento ${p.modalidades.join(' e ').toLowerCase()}`))),
      h('p', null, p.descricao || 'Descrição ainda não informada.'),
      h('p', { class: 'xsmall muted' }, 'Empresa fictícia para demonstração.'),
      h('div', { class: 'row' }, Botao({ texto: 'Solicitar atendimento', variante: 'primary', icone: 'paper-plane-tilt', onClick: () => iniciar({ servicoId: st.servicoId }) }))),

    h('div', { class: 'grid-2', style: 'align-items:start' },
      h('div', { class: 'stack' },
        h('section', { class: 'card stack-sm', 'aria-labelledby': 'perfil-servicos' },
          h('h2', { id: 'perfil-servicos' }, 'Serviços'),
          p.servicos.length ? h('ul', { class: 'stack-sm' }, p.servicos.map(s => h('li', { class: 'stack-xs', style: 'padding-bottom:12px;border-bottom:1px solid var(--border)' },
            h('div', { class: 'row-between' }, h('h3', null, s.nome), h('span', { class: 'strong tabular' }, s.precoTexto)),
            h('p', { class: 'small text2' }, s.descricao),
            h('p', { class: 'small' }, `Duração estimada ${duracao(s.duracaoMin)} · ${s.local} · ${TIPOS_PRECO[s.tipoPreco]}`),
            s.observacao ? h('p', { class: 'small muted' }, s.observacao) : null,
            h('div', null, Botao({ texto: 'Solicitar este serviço', pequeno: true, onClick: () => iniciar({ servicoId: s.id }), rotulo: 'Solicitar este serviço: ' + s.nome }))))) : h('p', { class: 'muted' }, 'Nenhum serviço ativo no momento.')),
        h('section', { class: 'card stack-sm', 'aria-labelledby': 'perfil-produtos' },
          h('h2', { id: 'perfil-produtos' }, 'Produtos'),
          h('p', { class: 'small text2' }, 'Catálogo informativo. Disponibilidade e preços informados pela empresa; sem compra pela plataforma.'),
          p.produtos.length ? h('ul', { class: 'stack-sm' }, p.produtos.map(pr => h('li', { class: 'row', style: 'align-items:flex-start;flex-wrap:nowrap' },
            h('span', { class: 'avatar', style: 'border-radius:var(--r2)', 'aria-hidden': 'true' }, icone('package')),
            h('div', { class: 'stack-xs grow' }, h('h3', null, pr.nome), h('p', { class: 'small text2' }, pr.descricao),
              h('p', { class: 'small' }, h('span', { class: 'strong' }, pr.precoCentavos == null ? 'Sob consulta' : formatarMoeda(pr.precoCentavos)), ' · ', pr.disponibilidade),
              h('div', null, Botao({ texto: 'Consultar produto', pequeno: true, onClick: () => set(st, { dlg: 'produto', produto: pr, msg: '' }), rotulo: 'Consultar produto ' + pr.nome })))))) : h('p', { class: 'muted' }, 'Esta empresa ainda não publicou produtos.'))),

      h('div', { class: 'stack' },
        h('section', { class: 'card stack-sm', 'aria-labelledby': 'perfil-horarios' },
          h('h2', { id: 'perfil-horarios' }, 'Horários para solicitação'),
          h('p', { class: 'small text2' }, rotuloFuso(p.fuso) + ' · próximos dias'),
          p.servicos.length ? Campo({ id: 'perfil-servico', rotulo: 'Serviço', valor: st.servicoId, onChange: v => set(st, { servicoId: v }), opcoes: p.servicos.map(s => ({ v: s.id, l: s.nome })) }) : null,
          FaixaDatas({ rotulo: 'Escolha o dia', datas: dias, selecionada: st.data, onEscolher: d => set(st, { data: d }), rotuloDe: rotuloDia }),
          h('p', { class: 'strong small' }, rotuloDia(st.data).longo),
          slots.length ? Horarios({ rotulo: 'Horários em ' + dataBr(st.data), slots, selecionado: null, onEscolher: s => iniciar({ servicoId: st.servicoId, inicio: s.inicio, dataEscolhida: st.data, semHorario: false }) })
            : h('p', { class: 'muted small' }, 'Sem horários para solicitação neste dia. Você pode enviar uma solicitação sem horário definido.'),
          h('p', { class: 'alert alert-info small' }, icone('info'), h('span', null, 'Escolher um horário envia uma solicitação. O agendamento será concluído após a confirmação.'))),
        h('section', { class: 'card stack-sm', 'aria-labelledby': 'perfil-contato' },
          h('h2', { id: 'perfil-contato' }, 'Contato e funcionamento'),
          h('dl', { class: 'dl' }, h('dt', null, 'Horário de funcionamento'), h('dd', null, p.horarios),
            h('dt', null, 'Telefone e WhatsApp (contato manual)'), h('dd', { class: 'tabular' }, p.contato.telefone || '—'),
            h('dt', null, 'E-mail'), h('dd', null, p.contato.email || '—')),
          h('p', { class: 'xsmall muted' }, 'Somente contatos autorizados para publicação pela empresa.')),
        h('section', { class: 'card stack-sm', 'aria-labelledby': 'perfil-profissionais' },
          h('h2', { id: 'perfil-profissionais' }, 'Profissionais'),
          p.profissionais.length ? h('ul', { class: 'stack-sm' }, p.profissionais.map(x => h('li', { class: 'row' }, h('span', { class: 'avatar', 'aria-hidden': 'true' }, x.ini), h('div', null, h('p', { class: 'strong' }, x.nome), h('p', { class: 'small text2' }, x.descricao))))) : h('p', { class: 'muted small' }, 'Sem profissionais com dados públicos autorizados.'),
          h('p', { class: 'xsmall muted' }, 'Dados públicos autorizados por cada profissional. A empresa atribui o profissional após a solicitação.')),
        h('section', { class: 'card stack-sm', 'aria-labelledby': 'perfil-politicas' },
          h('h2', { id: 'perfil-politicas' }, 'Políticas de atendimento e cancelamento'),
          p.politicas.length ? h('ul', { class: 'stack-xs prose' }, p.politicas.map(x => h('li', null, x))) : h('p', { class: 'muted small' }, 'Políticas ainda não publicadas.')))),

    st.dlg === 'produto' ? Dialogo({ id: 'dlg-produto', titulo: 'Consultar produto', descricao: `${st.produto.nome} · A empresa responde sobre disponibilidade e preço. Não há compra pela plataforma.`, ocupado: st.busy, onFechar: () => set(st, { dlg: null }),
      rodape: [Botao({ texto: 'Cancelar', onClick: () => set(st, { dlg: null }), desabilitado: st.busy }), Botao({ texto: 'Enviar consulta', variante: 'primary', ocupado: st.busy, textoOcupado: 'Enviando…',
        onClick: async () => { set(st, { busy: true }); const r = await consultarProduto({ produtoId: st.produto.id, mensagem: st.msg }); set(st, { busy: false }); if (r.ok) { set(st, { dlg: null }); toast('Consulta registrada (demonstração). A empresa responde pelos contatos informados.'); } else toast(r.message, 'warn'); } })] },
    Campo({ id: 'produto-msg', rotulo: 'Mensagem', linhas: 4, valor: st.msg, onInput: v => { st.msg = v; }, maxlength: 600, ajuda: 'Não inclua dados pessoais sensíveis.' })) : null);
}
