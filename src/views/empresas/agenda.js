// RF-EMP-05 · Agenda: dia por profissional (colunas) e lista; consulta de disponibilidade; bloqueio com
// detecção de conflito e sugestão de períodos livres. No celular, começa em lista.
import { h, Botao, Campo, Check, Seg, Alerta, Dialogo, Vazio, FaixaDatas, Badge, icone } from '../../ui/components.js';
import { ui, estadoView, set, render, toast } from '../../store.js';
import { agendaDoDia, contagemPorDia, disponibilidadeEmpresa, criarBloqueio, removerBloqueio } from '../../api/agenda.js';
import { servicosDaEmpresa, empresaDoUsuario } from '../../api/companies.js';
import { ler } from '../../api/db.js';
import { agora } from '../../api/clock.js';
import { dataLocal, proximosDias, rotuloDia, rotuloFuso, somarDias, diaSemanaData, hmParaMin, minParaHm, minutosLocal, formatarDataHora } from '../../domain/datas.js';

const H0 = 7, H1 = 18, PX = 56;
const HORAS = []; for (let m = H0 * 60; m <= H1 * 60; m += 30) HORAS.push(minParaHm(m));

function segunda(data) { const ds = diaSemanaData(data); return somarDias(data, ds === 0 ? -6 : 1 - ds); }

const situacaoEvento = e => (e.estado === 'confirmada' ? 'Confirmada' : e.estado === 'temporaria' ? 'Reserva temporária' : e.estado === 'pendente' ? 'A reatribuir' : 'Bloqueio interno');

export function Agenda({ usuario, empresaId, vinculo }) {
  const emp = empresaDoUsuario(usuario, empresaId);
  const fuso = emp.fuso;
  const hoje = dataLocal(agora(), fuso);
  const gestor = vinculo.papel === 'gestor';
  const st = estadoView('agenda:' + empresaId, () => ({ data: proximosDias(hoje, 1)[0], visao: ui.largura < 640 ? 'lista' : 'dia', disp: false, servicoDisp: '', dlg: null, blk: null }));
  const seg = segunda(st.data);
  const semana = [0, 1, 2, 3, 4, 5].map(i => somarDias(seg, i));
  const contagem = contagemPorDia({ empresaId, datas: semana, usuario });
  const ag = agendaDoDia({ empresaId, data: st.data, usuario });
  const servicos = servicosDaEmpresa(usuario, empresaId).filter(s => s.situacao === 'ativo');
  if (!st.servicoDisp && servicos[0]) st.servicoDisp = servicos[0].id;
  const disp = gestor && st.disp && st.servicoDisp ? disponibilidadeEmpresa({ empresaId, servicoId: st.servicoDisp, data: st.data, usuario }) : null;
  const vazio = ag.colunas.every(c => !c.eventos.length);
  const abrirBloqueio = () => {
    const profs = ler().profissionais.filter(p => p.empresaId === empresaId && p.situacao === 'ativo');
    const f = estadoView('form:bloqueio', () => ({}));
    Object.assign(f, { profissionalId: profs[0] ? profs[0].id : '', data: st.data, diaInteiro: false, inicio: '13:00', fim: '15:00', motivo: '', erros: {}, conflito: null, busy: false });
    set(st, { dlg: 'bloqueio' });
  };
  const abrirEvento = e => {
    if (e.bloqueio && gestor) set(st, { dlg: 'blk-info', blk: e });
  };

  const evento = (e, comPosicao) => {
    const ini = minutosLocal(e.inicio, fuso), fim = minutosLocal(e.fim, fuso);
    const estilo = comPosicao ? `top:${((ini - H0 * 60) / 60) * PX}px;height:${Math.max(26, ((fim - ini) / 60) * PX - 2)}px` : '';
    const classe = 'ag-ev ev-' + (e.estado === 'pendente' ? 'pendente' : e.estado) + (e.href || (e.bloqueio && gestor) ? '' : ' static');
    const filhos = [h('span', { class: 'r' }, `${e.hi}–${e.hf}`, h('span', { class: 'sr-only' }, ` · ${situacaoEvento(e)} ·`)), h('span', { class: 'strong' }, ` ${e.ref}${e.titulo ? ' · ' + e.titulo : ''}`), e.quem ? h('span', { class: 'text2' }, ' ' + e.quem) : null];
    if (!comPosicao) return null;
    if (e.href) return h('a', { class: classe, style: estilo, href: e.href, key: e.id }, filhos);
    if (e.bloqueio && gestor) return h('button', { type: 'button', class: classe, style: estilo, onClick: () => abrirEvento(e), key: e.id }, filhos);
    return h('div', { class: classe, style: estilo, role: 'note', key: e.id }, filhos);
  };

  const grade = () => {
    const altura = (H1 - H0) * PX;
    const minCol = ui.largura >= 1024 ? 180 : 150;
    const cols = ag.colunas;
    return h('div', { class: 'stack-xs' },
      h('p', { class: 'agenda-hint' }, icone('arrows-left-right'), 'Em telas estreitas, role horizontalmente para ver todos os profissionais.'),
      h('div', { class: 'agenda-scroll', tabindex: '0', role: 'region', 'aria-label': 'Grade da agenda por profissional (rolagem horizontal)' },
        h('div', { class: 'agenda-grid', style: `grid-template-columns:56px repeat(${cols.length}, minmax(${minCol}px, 1fr))` },
          h('div', { class: 'ag-col-head', 'aria-hidden': 'true' }),
          cols.map(c => h('div', { class: 'ag-col-head', key: 'h-' + c.id }, c.nome, c.situacao === 'suspenso' ? Badge('registro', 'suspenso') : null, c.id === 'pendente' ? icone('warning') : null)),
          h('div', { class: 'ag-times', style: `height:${altura}px`, 'aria-hidden': 'true' }, HORAS.filter(t => t.endsWith(':00') && t !== '07:00').map(t => h('span', { class: 'ag-time', style: `top:${((hmParaMin(t) - H0 * 60) / 60) * PX}px` }, t))),
          cols.map(c => h('div', { class: 'ag-col', style: `height:${altura}px`, key: 'c-' + c.id, role: 'group', 'aria-label': 'Agenda de ' + c.nome },
            HORAS.filter(t => t.endsWith(':00')).map(t => h('div', { class: 'ag-hline', style: `top:${((hmParaMin(t) - H0 * 60) / 60) * PX}px`, 'aria-hidden': 'true' })),
            c.indisponivel ? h('div', { class: 'ag-ev ev-folga static', style: `top:4px;height:${altura - 8}px`, role: 'note' }, h('span', { class: 'strong' }, c.indisponivel), h('span', { class: 'text2' }, 'Sem atendimentos neste dia')) : null,
            c.intervalo ? h('div', { class: 'ag-ev ev-intervalo static', style: `top:${((hmParaMin(c.intervalo.inicio) - H0 * 60) / 60) * PX}px;height:${((hmParaMin(c.intervalo.fim) - hmParaMin(c.intervalo.inicio)) / 60) * PX - 2}px`, role: 'note' }, h('span', { class: 'text2' }, `Intervalo ${c.intervalo.inicio}–${c.intervalo.fim}`)) : null,
            c.eventos.map(e => evento(e, true)))))));
  };

  const lista = () => h('div', { class: 'stack-sm' }, ag.colunas.map(c => h('section', { class: 'card stack-xs', key: 'l-' + c.id, 'aria-labelledby': 'lc-' + c.id },
    h('h2', { id: 'lc-' + c.id, style: 'font-size:15px' }, c.nome, c.situacao === 'suspenso' ? h('span', null, ' ', Badge('registro', 'suspenso')) : null),
    c.indisponivel ? h('p', { class: 'small text2' }, c.indisponivel + ' — sem atendimentos neste dia.')
      : c.eventos.length ? h('ul', { class: 'list' }, c.eventos.map(e => h('li', { key: 'li-' + e.id, class: 'list-item' },
        h('span', { class: 'main' }, h('span', { class: 'strong tabular' }, `${e.hi}–${e.hf}`), h('span', { class: 'small' }, `${e.ref}${e.titulo ? ' · ' + e.titulo : ''}`), e.quem ? h('span', { class: 'small text2' }, e.quem) : null),
        h('span', { class: 'row' }, e.estado === 'pendente' ? h('span', { class: 'badge t-e' }, icone('warning'), 'A reatribuir') : Badge('ocupacao', e.estado),
          e.href ? Botao({ texto: 'Abrir', pequeno: true, href: e.href, rotulo: 'Abrir ' + e.ref }) : e.bloqueio && gestor ? Botao({ texto: 'Detalhes', pequeno: true, onClick: () => abrirEvento(e), rotulo: 'Detalhes do ' + e.ref }) : null))))
        : h('p', { class: 'small muted' }, 'Livre durante a jornada.'))));

  return h('div', { class: 'stack' },
    h('div', { class: 'page-head' },
      h('div', null, h('h1', null, gestor ? 'Agenda' : 'Minha agenda'), h('p', null, `Agenda consolidada: cada atendimento reserva um profissional. ${rotuloFuso(fuso)}.`)),
      gestor ? h('div', { class: 'row' },
        Botao({ texto: 'Consultar disponibilidade', icone: 'magnifying-glass', onClick: () => set(st, { disp: !st.disp }), expandido: st.disp, controla: 'painel-disp' }),
        Botao({ texto: 'Bloquear período', icone: 'lock-simple', variante: 'primary', onClick: abrirBloqueio, id: 'btn-bloquear' })) : null),
    h('div', { class: 'row-between' },
      h('div', { class: 'semana' },
        Botao({ icone: 'caret-left', rotulo: 'Semana anterior', onClick: () => set(st, { data: somarDias(seg, -7) }) }),
        FaixaDatas({ rotulo: 'Dia da agenda', datas: semana, selecionada: st.data, onEscolher: d => set(st, { data: d }), rotuloDe: rotuloDia, contagem }),
        Botao({ icone: 'caret-right', rotulo: 'Próxima semana', onClick: () => set(st, { data: somarDias(seg, 7) }) })),
      Seg({ rotulo: 'Modo de visualização', valor: st.visao, opcoes: [['dia', 'Dia por profissional', 'columns'], ['lista', 'Lista', 'list-bullets']], onChange: v => set(st, { visao: v }) })),
    h('div', { class: 'agenda-legend', role: 'group', 'aria-label': 'Legenda' },
      h('span', null, h('span', { class: 'legend-sw ev-confirmada', 'aria-hidden': 'true' }), 'Confirmada'),
      h('span', null, h('span', { class: 'legend-sw ev-temporaria', 'aria-hidden': 'true' }), 'Reserva temporária'),
      h('span', null, h('span', { class: 'legend-sw ev-bloqueio', 'aria-hidden': 'true' }), 'Bloqueio interno ou folga'),
      h('span', null, h('span', { class: 'legend-sw ev-intervalo', 'aria-hidden': 'true' }), 'Intervalo'),
      gestor ? h('span', null, h('span', { class: 'legend-sw ev-pendente', 'aria-hidden': 'true' }), 'A reatribuir') : null),
    disp ? h('section', { class: 'card stack-sm', id: 'painel-disp', 'aria-labelledby': 'disp-tit' },
      h('h2', { id: 'disp-tit' }, 'Disponibilidade em ' + rotuloDia(st.data).completo),
      Campo({ id: 'disp-servico', rotulo: 'Serviço', valor: st.servicoDisp, onChange: v => set(st, { servicoDisp: v }), opcoes: servicos.map(s => ({ v: s.id, l: s.nome })) }),
      h('p', { class: 'small text2' }, `Duração ${disp.duracaoMin} min + preparo/deslocamento ${disp.preparoMin} min · considera jornada, intervalo, folgas, feriados, bloqueios e atendimentos de cada profissional elegível.`),
      h('ul', { class: 'list' }, disp.linhas.map(l => h('li', { class: 'list-item', key: 'd-' + l.id },
        h('span', { class: 'main' }, h('span', { class: 'strong' }, l.nome), h('span', { class: 'small text2' }, l.estado === 'disponivel' ? `${l.horarios.length} horários` : l.estado === 'nao_executa' ? 'Não executa este serviço' : l.estado === 'sem_horarios' ? 'Sem horários livres' : 'Indisponível · ' + l.motivo)),
        l.horarios.length ? h('span', { class: 'small tabular' }, l.horarios.slice(0, 8).join(' · ') + (l.horarios.length > 8 ? ` +${l.horarios.length - 8}` : '')) : null))),
      Alerta({ tipo: 'info', titulo: 'Exibido ao cliente' }, h('p', { class: 'tabular small' }, disp.uniao.join(' · ') || 'Nenhum horário disponível'),
        h('p', { class: 'small' }, 'O cliente vê apenas horários, sem nomes, endereços ou motivos. A vaga existe se ao menos um profissional elegível estiver livre.'))) : null,
    h('h2', { class: 'sr-only' }, 'Atendimentos de ' + rotuloDia(st.data).longo),
    vazio && !ag.colunas.some(c => c.indisponivel) ? h('div', { class: 'card' }, Vazio({ icone: 'calendar-blank', titulo: 'Agenda sem atendimentos em ' + rotuloDia(st.data).completo + '.', texto: 'Os profissionais estão livres durante a jornada.' })) : null,
    st.visao === 'dia' ? grade() : lista(),
    h('p', { class: 'xsmall muted' }, 'A interface não garante sozinha a prevenção de dupla reserva. Na aplicação final, reservas são validadas e gravadas de forma transacional no servidor.'),
    st.dlg === 'bloqueio' ? DialogoBloqueio({ empresaId, fuso, hoje, st }) : null,
    st.dlg === 'blk-info' && st.blk ? Dialogo({ id: 'dlg-blk-info', titulo: `${st.blk.ref} · Bloqueio interno`, onFechar: () => set(st, { dlg: null }),
      rodape: [Botao({ texto: 'Fechar', onClick: () => set(st, { dlg: null }) }), Botao({ texto: 'Remover bloqueio', variante: 'danger', ocupado: st.busy, onClick: async () => { set(st, { busy: true }); const r = await removerBloqueio({ ocupacaoId: st.blk.id }); st.busy = false; if (r.ok) { st.dlg = null; toast('Bloqueio removido. O período voltou a ficar disponível.'); } else toast(r.message, 'warn'); render(); } })] },
    h('dl', { class: 'dl' }, h('dt', null, 'Profissional'), h('dd', null, (ag.colunas.find(c => c.id === st.blk.profissionalId) || {}).nome || '—'), h('dt', null, 'Período'), h('dd', { class: 'tabular' }, `${formatarDataHora(st.blk.inicio, fuso)}–${st.blk.hf}`), h('dt', null, 'Motivo interno'), h('dd', null, st.blk.motivo || '—'))) : null);
}

function DialogoBloqueio({ empresaId, fuso, hoje, st }) {
  const f = estadoView('form:bloqueio', () => ({}));
  const profs = ler().profissionais.filter(p => p.empresaId === empresaId && p.situacao === 'ativo');
  const datas = [hoje, ...proximosDias(hoje, 20)];
  const muda = patch => { Object.assign(f, patch, { conflito: null }); for (const k of Object.keys(patch)) delete f.erros[k]; render(); };
  const salvar = async () => {
    if (f.busy) return;
    f.busy = true; render();
    const r = await criarBloqueio({ profissionalId: f.profissionalId, data: f.data, diaInteiro: f.diaInteiro, inicio: f.inicio, fim: f.fim, motivo: f.motivo });
    f.busy = false;
    if (r.ok) {
      st.dlg = null; st.data = f.data;
      toast(`Período bloqueado (${r.data.rotulo}). A agenda pública mostra apenas “Indisponível”.`);
    } else if (r.code === 'BLOQUEIO_CONFLITANTE') f.conflito = r.details;
    else if (r.code === 'VALIDACAO') f.erros = (r.details && r.details.campos) || {};
    else f.erros = { geral: r.message };
    render();
  };
  return Dialogo({ id: 'dlg-bloqueio', titulo: 'Bloquear período', ocupado: f.busy, onFechar: () => set(st, { dlg: null }),
    rodape: [Botao({ texto: 'Cancelar', onClick: () => set(st, { dlg: null }), desabilitado: f.busy }), Botao({ texto: 'Salvar bloqueio', variante: 'primary', ocupado: f.busy, textoOcupado: 'Verificando conflitos…', onClick: salvar, id: 'blq-salvar' })] },
  h('div', { class: 'row-between' }, h('p', { class: 'small text2' }, rotuloFuso(fuso)), Botao({ texto: 'Como funciona?', icone: 'question', variante: 'ghost', pequeno: true, onClick: () => set(ui, { ajuda: 'como-bloquear-periodo' }), id: 'blq-ajuda' })),
  f.erros.geral ? Alerta({ tipo: 'err' }, h('p', null, f.erros.geral)) : null,
  h('div', { class: 'form-grid' },
    Campo({ id: 'blq-prof', rotulo: 'Profissional', valor: f.profissionalId, onChange: v => muda({ profissionalId: v }), opcoes: profs.map(p => ({ v: p.id, l: p.curto })) }),
    Campo({ id: 'blq-data', rotulo: 'Data', valor: f.data, onChange: v => muda({ data: v }), opcoes: datas.map(d => ({ v: d, l: rotuloDia(d).completo })) }),
    h('div', { class: 'full' }, Check({ id: 'blq-dia', rotulo: 'Dia inteiro (jornada completa)', marcado: f.diaInteiro, onChange: v => muda({ diaInteiro: v }) })),
    f.diaInteiro ? null : Campo({ id: 'blq-ini', rotulo: 'Início', valor: f.inicio, onChange: v => muda({ inicio: v }), opcoes: HORAS.map(t => ({ v: t, l: t })) }),
    f.diaInteiro ? null : Campo({ id: 'blq-fim', rotulo: 'Fim', valor: f.fim, onChange: v => muda({ fim: v }), opcoes: HORAS.map(t => ({ v: t, l: t })), erro: f.erros.fim }),
    Campo({ id: 'blq-motivo', rotulo: 'Motivo interno (não aparece para clientes)', obrigatorio: true, valor: f.motivo, onInput: v => { f.motivo = v; if (f.erros.motivo) { delete f.erros.motivo; render(); } }, erro: f.erros.motivo, classe: 'full', maxlength: 120, placeholder: 'Ex.: Manutenção do veículo' })),
  f.conflito ? Alerta({ tipo: 'err', titulo: 'O período conflita com atendimentos existentes', foco: true, id: 'blq-conflito' },
    h('ul', { class: 'stack-xs' }, f.conflito.afetados.map(a => h('li', null, a.href ? h('a', { href: a.href }, a.rotulo) : a.rotulo))),
    h('p', { class: 'small' }, 'O bloqueio não foi salvo. Bloqueios não cancelam atendimentos automaticamente: reatribua ou reagende-os antes, ou escolha um período livre.'),
    f.conflito.alternativas.length
      ? h('div', { class: 'stack-xs' }, h('p', { class: 'small strong' }, 'Períodos livres sugeridos'), h('div', { class: 'row' }, f.conflito.alternativas.map(a => Botao({ texto: `Usar ${a.inicio}–${a.fim}`, pequeno: true, onClick: () => muda({ diaInteiro: false, inicio: a.inicio, fim: a.fim }) }))))
      : h('p', { class: 'small' }, 'Não há períodos livres com essa duração neste dia.')) : null,
  h('p', { class: 'xsmall muted' }, 'Reservas temporárias também contam como ocupação. Clientes veem apenas “Indisponível”, sem nomes ou motivos.'));
}
