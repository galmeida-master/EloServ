// Painel “Simulação”: controles de demonstração, sempre rotulados e separados da interface real.
import { h, Botao, Check, Seg, Gaveta, Dialogo, Alerta, icone } from '../ui/components.js';
import { ui, set, render, navegar, toast, estadoView } from '../store.js';
import { PERSONAS, PERSONAS_EXTRAS } from '../api/seed.js';
import * as auth from '../api/auth.js';
import { ler, restaurarDemonstracao } from '../api/db.js';
import { lerSim, definirSim } from '../api/sim.js';
import { agora, avancar, zerarRelogio, deslocamento } from '../api/clock.js';
import { simularReservaConcorrente, simularOcupacaoSobreposta, expirarReservas } from '../api/agenda.js';
import { simularEmpresaEnviaProposta, simularClienteConfirma, simularRespostaReagendamento } from '../api/requests.js';
import { processarFilaEmail, filaEmail } from '../api/notifications.js';
import { limparRascunho } from './public/rascunho.js';
import { formatarRegistro, HORA, DIA } from '../domain/datas.js';

async function executarSim(st, rotulo, fn) {
  set(st, { busy: rotulo, resultado: null });
  const r = await fn();
  st.busy = null;
  st.resultado = r && r.ok === false ? { tipo: 'err', texto: r.message } : { tipo: 'ok', texto: rotulo + ': concluído.' };
  await expirarReservas();
  render();
}

function contextoSolicitacao() {
  const c = ui.contextoSim;
  if (!c || c.tipo !== 'solicitacao') return null;
  const s = ler().solicitacoes.find(x => x.id === c.id);
  return s ? { ...c, s } : null;
}

export function PainelSimulacao() {
  if (!ui.simAberto) return null;
  const st = estadoView('sim', () => ({ busy: null, resultado: null, dlg: null }));
  const sim = lerSim();
  const s = auth.lerSessao();
  const atual = s && !s.expirada ? s.usuarioId : 'visitante';
  const ctxH = ui.contextoSim && ui.contextoSim.tipo === 'horario' ? ui.contextoSim : null;
  const ctxS = contextoSolicitacao();
  const fechar = () => set(ui, { simAberto: false });
  const persona = p => h('li', null, h('button', { type: 'button', class: 'menu-item persona', 'aria-current': atual === p.id ? 'true' : null,
    onClick: () => {
      const amb = auth.entrarComoPersona(p.id);
      ui.simAberto = false;
      toast(p.id === 'visitante' ? 'Agora você navega como visitante.' : `Persona: ${p.nome} (${p.descricao}).`, 'info');
      navegar(p.id === 'visitante' ? '/' : auth.rotaInicial(amb));
    } }, h('span', { class: 'stack-xs' }, h('span', { class: 'strong' }, p.nome), h('span', { class: 'xsmall text2' }, p.descricao)), atual === p.id ? icone('check') : null));
  const emails = filaEmail().slice(0, 5);
  const respostas = [];
  if (ctxS) {
    const x = ctxS.s;
    if (['enviada', 'em_analise'].includes(x.estado)) respostas.push(Botao({ texto: 'Empresa envia proposta', icone: 'file-text', pequeno: true, ocupado: st.busy === 'Empresa envia proposta', onClick: () => executarSim(st, 'Empresa envia proposta', () => simularEmpresaEnviaProposta(x.id)) }));
    if (x.estado === 'proposta') {
      respostas.push(Botao({ texto: 'Cliente confirma a proposta', icone: 'check-circle', pequeno: true, ocupado: st.busy === 'Cliente confirma a proposta', onClick: () => executarSim(st, 'Cliente confirma a proposta', () => simularClienteConfirma(x.id)) }));
      if (x.ocupacaoId) respostas.push(Botao({ texto: 'Outra operação ocupa este horário', icone: 'warning', pequeno: true, onClick: () => executarSim(st, 'Ocupação concorrente criada', () => simularOcupacaoSobreposta({ ocupacaoId: x.ocupacaoId })) }));
    }
    if (x.reagendamento) {
      const quem = x.reagendamento.origem === 'cliente' ? 'Empresa' : 'Cliente';
      respostas.push(Botao({ texto: `${quem} confirma o reagendamento`, icone: 'calendar-check', pequeno: true, onClick: () => executarSim(st, `${quem} confirma o reagendamento`, () => simularRespostaReagendamento(x.id, true)) }));
      respostas.push(Botao({ texto: `${quem} recusa o reagendamento`, icone: 'x-circle', pequeno: true, onClick: () => executarSim(st, `${quem} recusa o reagendamento`, () => simularRespostaReagendamento(x.id, false)) }));
    }
  }
  return h('div', null,
    Gaveta({ id: 'painel-simulacao', titulo: 'Simulação (demonstração)', onFechar: fechar, rotuloRegiao: 'Painel de simulação' },
      h('p', { class: 'small text2' }, 'Controles para demonstrar comportamentos sem servidor real. Nada aqui faz parte da interface do produto.'),
      st.resultado ? Alerta({ tipo: st.resultado.tipo === 'err' ? 'err' : 'ok' }, h('p', { class: 'small' }, st.resultado.texto)) : null,

      h('section', { class: 'sim-section', 'aria-labelledby': 'sim-persona' },
        h('h3', { id: 'sim-persona' }, 'Persona'),
        h('ul', { class: 'stack-xs' }, PERSONAS.map(persona)),
        h('details', null, h('summary', { class: 'small' }, 'Outras personas de teste'), h('ul', { class: 'stack-xs mt-1' }, PERSONAS_EXTRAS.map(persona)))),

      h('section', { class: 'sim-section', 'aria-labelledby': 'sim-envio' },
        h('h3', { id: 'sim-envio' }, 'Envio e concorrência'),
        Check({ id: 'sim-falha-envio', rotulo: 'Simular falha de conexão no próximo envio', ajuda: 'A próxima gravação falha antes de chegar ao “servidor”: nada é gravado.', marcado: sim.falharProximoEnvio, onChange: v => { definirSim({ falharProximoEnvio: v }); render(); } }),
        Botao({ texto: ctxH ? `Simular reserva concorrente em ${ctxH.rotulo}` : 'Simular reserva concorrente no horário selecionado', icone: 'users', pequeno: true, desabilitado: !ctxH, id: 'sim-reserva-concorrente',
          onClick: () => executarSim(st, 'Reserva concorrente criada', () => simularReservaConcorrente({ empresaId: ctxH.empresaId, servicoId: ctxH.servicoId, inicio: ctxH.inicio })) }),
        ctxH ? null : h('p', { class: 'sim-note' }, 'Escolha um horário na solicitação para habilitar.')),

      h('section', { class: 'sim-section', 'aria-labelledby': 'sim-respostas' },
        h('h3', { id: 'sim-respostas' }, 'Respostas simuladas'),
        respostas.length ? h('div', { class: 'stack-xs' }, respostas) : h('p', { class: 'sim-note' }, 'Abra uma solicitação (como cliente ou empresa) para simular a resposta da outra parte.')),

      h('section', { class: 'sim-section', 'aria-labelledby': 'sim-relogio' },
        h('h3', { id: 'sim-relogio' }, 'Relógio da demonstração'),
        h('p', { class: 'small tabular' }, 'Agora: ', formatarRegistro(agora()), deslocamento() ? ' (avançado)' : ''),
        h('div', { class: 'row' },
          Botao({ texto: '+1 hora', pequeno: true, onClick: async () => { avancar(HORA); await expirarReservas(); render(); } }),
          Botao({ texto: '+1 dia', pequeno: true, onClick: async () => { avancar(DIA); await expirarReservas(); render(); } }),
          Botao({ texto: 'Horário real', pequeno: true, variante: 'ghost', onClick: () => { zerarRelogio(); render(); } })),
        h('p', { class: 'sim-note' }, 'Use para demonstrar a expiração de reservas temporárias, propostas e pedidos de reagendamento.')),

      h('section', { class: 'sim-section', 'aria-labelledby': 'sim-estados' },
        h('h3', { id: 'sim-estados' }, 'Estados de tela'),
        h('div', { class: 'stack-xs' },
          Botao({ texto: 'Catálogo com erro de conexão', pequeno: true, onClick: () => { definirSim({ falharCatalogo: true }); fechar(); navegar('/fornecedores?r=' + Date.now()); } }),
          Botao({ texto: 'Busca sem resultados (Cáceres)', pequeno: true, onClick: () => { fechar(); navegar('/fornecedores?cidade=C%C3%A1ceres'); } }),
          Botao({ texto: 'Sessão expirada', pequeno: true, onClick: () => { auth.expirarSessaoAgora(); fechar(); toast('Sessão marcada como expirada. Navegue para uma área autenticada.', 'info'); render(); } }),
          Botao({ texto: 'Convite expirado', pequeno: true, onClick: () => { fechar(); navegar('/convite/convite-expirado-demo'); } }),
          Botao({ texto: 'Página não encontrada', pequeno: true, onClick: () => { fechar(); navegar('/pagina-inexistente'); } }))),

      h('section', { class: 'sim-section', 'aria-labelledby': 'sim-email' },
        h('h3', { id: 'sim-email' }, 'Fila de e-mail (simulada)'),
        Check({ id: 'sim-falha-email', rotulo: 'Simular falha no envio de e-mail', ajuda: 'Falhas de e-mail não alteram reservas ou agendamentos confirmados.', marcado: sim.falharEmail, onChange: v => { definirSim({ falharEmail: v }); render(); } }),
        Botao({ texto: 'Processar fila de e-mail', icone: 'envelope-simple', pequeno: true, onClick: () => executarSim(st, 'Fila processada', processarFilaEmail) }),
        emails.length ? h('ul', { class: 'stack-xs small' }, emails.map(m => h('li', null, `${m.assunto} · ${m.para} · `, h('span', { class: 'badge ' + (m.situacao === 'enviado' ? 't-o' : m.situacao === 'falhou' ? 't-e' : 't-w') }, m.situacao === 'enviado' ? 'Enviado' : m.situacao === 'falhou' ? 'Falhou' : 'Pendente')))) : h('p', { class: 'sim-note' }, 'Fila vazia.')),

      h('section', { class: 'sim-section', 'aria-labelledby': 'sim-latencia' },
        h('h3', { id: 'sim-latencia' }, 'Latência artificial'),
        Seg({ rotulo: 'Latência', valor: sim.latencia, opcoes: [['padrao', '400–900 ms'], ['rapida', 'Rápida'], ['nenhuma', 'Sem atraso']], onChange: v => { definirSim({ latencia: v }); render(); } })),

      h('section', { class: 'sim-section', 'aria-labelledby': 'sim-dados' },
        h('h3', { id: 'sim-dados' }, 'Dados'),
        Botao({ texto: 'Restaurar dados demonstrativos', icone: 'arrow-clockwise', variante: 'danger', pequeno: true, onClick: () => set(st, { dlg: 'restaurar' }) }))),
    st.dlg === 'restaurar' ? Dialogo({ id: 'dlg-restaurar', titulo: 'Restaurar dados demonstrativos?', alerta: true, onFechar: () => set(st, { dlg: null }),
      rodape: [Botao({ texto: 'Cancelar', onClick: () => set(st, { dlg: null }), autofocus: true }),
        Botao({ texto: 'Restaurar', variante: 'danger', onClick: () => { restaurarDemonstracao(); limparRascunho(); zerarRelogio(); definirSim({ falharProximoEnvio: false, falharCatalogo: false, falharEmail: false }); auth.sair(); ui.views = {}; ui.simAberto = false; toast('Dados demonstrativos restaurados.', 'info'); navegar('/'); } })] },
    h('p', null, 'Todas as alterações feitas neste navegador serão substituídas pelos dados fictícios iniciais e a sessão será encerrada.')) : null);
}
