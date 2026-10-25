// Área do cliente: visão geral, agendamentos, equipamentos, histórico, perfil e preferências.
import { h, Botao, Campo, Check, Alerta, Vazio, Dialogo, Badge, icone } from '../../ui/components.js';
import { estadoView, set, render, toast, marcarSujo, limparSujo } from '../../store.js';
import * as req from '../../api/requests.js';
import { equipamentosDe, enderecosDe, salvarEquipamento, salvarEndereco, salvarPerfil, pedirPrivacidade } from '../../api/users.js';
import { formatarDataHora, formatarIntervalo, rotuloFuso, rotuloMes } from '../../domain/datas.js';
import { ControlesAparencia } from '../shell.js';
import { GRUPOS, itemSolicitacao } from './solicitacoes.js';
import { textoDuracao } from '../public/perfil.js';

export { Solicitacoes, Solicitacao } from './solicitacoes.js';

export function Visao({ usuario }) {
  const todas = req.minhasSolicitacoes(usuario);
  const aguardando = todas.filter(GRUPOS.voce);
  const confirmados = todas.filter(s => s.estado === 'aceita' && ['agendada', 'execucao'].includes(s.estadoExecucao)).sort((a, b) => a.inicio.localeCompare(b.inicio));
  const andamento = todas.filter(GRUPOS.andamento).filter(s => !GRUPOS.voce(s) && s.estado !== 'aceita');
  const prox = confirmados[0];
  return h('div', { class: 'stack' },
    h('div', { class: 'page-head' }, h('div', null, h('h1', null, `Olá, ${usuario.nome.split(' ')[0]}`), h('p', null, 'Acompanhe suas solicitações, propostas e agendamentos. Conta demonstrativa.')),
      Botao({ texto: 'Nova solicitação', icone: 'plus', variante: 'primary', href: '#/fornecedores' })),
    h('div', { class: 'grid-2', style: 'align-items:start' },
      h('section', { class: 'card stack-sm', 'aria-labelledby': 'cv-aguardando' }, h('h2', { id: 'cv-aguardando' }, 'Aguardando sua decisão'),
        aguardando.length ? h('ul', { class: 'list' }, aguardando.map(itemSolicitacao)) : h('p', { class: 'muted' }, 'Nenhuma proposta aguardando você.')),
      h('section', { class: 'card stack-sm', 'aria-labelledby': 'cv-proximo' }, h('h2', { id: 'cv-proximo' }, 'Próximo atendimento confirmado'),
        prox ? h('a', { class: 'list-item', href: '#/clientes/solicitacoes/' + prox.id },
          h('span', { class: 'main' }, h('span', { class: 'strong' }, prox.servicoNome), h('span', { class: 'small' }, `${formatarDataHora(prox.inicio, prox.fuso)} · ${rotuloFuso(prox.fuso, prox.inicio)}`), h('span', { class: 'small text2' }, `${prox.empresaNome} · ${prox.id}`)),
          Badge('execucao', prox.estadoExecucao)) : h('p', { class: 'muted' }, 'Nenhum atendimento confirmado.'))),
    h('section', { class: 'card stack-sm', 'aria-labelledby': 'cv-andamento' }, h('h2', { id: 'cv-andamento' }, 'Solicitações em andamento'),
      andamento.length ? h('ul', { class: 'list' }, andamento.map(itemSolicitacao)) : h('p', { class: 'muted' }, 'Nenhuma solicitação em andamento.'),
      h('div', null, Botao({ texto: 'Ver todas as solicitações', variante: 'ghost', href: '#/clientes/solicitacoes' }))));
}

export function Agendamentos({ usuario }) {
  const lista = req.minhasSolicitacoes(usuario).filter(s => s.estado === 'aceita' && ['agendada', 'execucao'].includes(s.estadoExecucao)).sort((a, b) => a.inicio.localeCompare(b.inicio));
  return h('div', { class: 'stack' },
    h('div', { class: 'page-head' }, h('div', null, h('h1', null, 'Agendamentos'), h('p', null, 'Somente atendimentos confirmados. Solicitações e reservas temporárias ficam em Solicitações e orçamentos.'))),
    lista.length ? h('ul', { class: 'stack-sm' }, lista.map(s => h('li', { class: 'card row-between', key: s.id },
      h('div', { class: 'stack-xs' }, h('p', { class: 'strong tabular' }, formatarIntervalo(s.inicio, s.fim, s.fuso)), h('p', { class: 'xsmall muted' }, rotuloFuso(s.fuso, s.inicio)),
        h('p', null, h('span', { class: 'strong' }, s.servicoNome), ` · ${s.empresaNome} · ${s.profissionalAtual || 'Profissional a definir'} · ${textoDuracao(s.duracaoMin)}`),
        h('p', { class: 'small text2' }, s.local ? `${s.local.rotulo} · ${s.local.bairro}, ${s.local.cidade}` : ''), s.reagendamento ? h('p', null, Badge('ocupacao', 'temporaria', 'Reagendamento pendente')) : null),
      h('div', { class: 'row' }, Badge('execucao', s.estadoExecucao), Botao({ texto: 'Detalhes', href: '#/clientes/solicitacoes/' + s.id, rotulo: 'Detalhes de ' + s.id })))))
      : h('div', { class: 'card' }, Vazio({ icone: 'calendar-blank', titulo: 'Nenhum agendamento confirmado.', texto: 'Quando você confirmar uma proposta e o horário for revalidado, o atendimento aparece aqui.', acoes: [Botao({ texto: 'Ver solicitações', href: '#/clientes/solicitacoes' })] })));
}

export function Equipamentos({ usuario }) {
  const st = estadoView('cli-eq', () => ({ dlg: null, f: {}, erros: {}, busy: false }));
  const lista = equipamentosDe(usuario);
  const historico = req.minhasSolicitacoes(usuario).filter(s => s.estadoExecucao === 'concluida');
  const abrir = e => set(st, { dlg: 'eq', f: e ? { ...e } : { tipo: '', capacidade: '', marca: '', local: '' }, erros: {} });
  const salvar = async () => {
    set(st, { busy: true });
    const r = await salvarEquipamento({ ...st.f, versao: st.f.v });
    st.busy = false;
    if (r.ok) { st.dlg = null; toast(st.f.id ? 'Equipamento atualizado.' : 'Equipamento adicionado.'); } else st.erros = (r.details && r.details.campos) || { tipo: r.message };
    render();
  };
  return h('div', { class: 'stack' },
    h('div', { class: 'page-head' }, h('div', null, h('h1', null, 'Meus equipamentos'), h('p', null, 'Tipo, marca e modelo (opcionais), identificação, local de instalação e histórico.')),
      Botao({ texto: 'Adicionar equipamento', icone: 'plus', variante: 'primary', onClick: () => abrir(null) })),
    lista.length ? h('ul', { class: 'grid-auto' }, lista.map(e => {
      const servicos = historico.filter(s => s.equipamento.includes(e.capacidade) && s.equipamento.includes(e.local));
      return h('li', { class: 'card stack-xs', key: e.id },
        h('h2', { style: 'font-size:16px' }, `${e.tipo} ${e.capacidade}`.trim()),
        h('p', { class: 'small text2' }, `${e.id} · ${e.local || 'Local não informado'} · Marca/modelo: ${e.marca || 'Não informado'}`),
        h('p', { class: 'small' }, servicos.length ? `${servicos.length} atendimento(s) concluído(s)` : 'Sem serviços concluídos'),
        h('div', null, Botao({ texto: 'Editar', pequeno: true, onClick: () => abrir(e), rotulo: 'Editar ' + e.id })));
    })) : h('div', { class: 'card' }, Vazio({ icone: 'thermometer', titulo: 'Nenhum equipamento cadastrado', texto: 'Cadastre seus aparelhos para agilizar as próximas solicitações.' })),
    h('p', { class: 'small muted' }, 'Empresas que atendem você podem manter cadastros operacionais próprios destes equipamentos; elas não editam sua conta pessoal.'),
    st.dlg === 'eq' ? Dialogo({ id: 'dlg-eq', titulo: st.f.id ? 'Editar equipamento' : 'Adicionar equipamento', ocupado: st.busy, onFechar: () => set(st, { dlg: null }),
      rodape: [Botao({ texto: 'Cancelar', onClick: () => set(st, { dlg: null }), desabilitado: st.busy }), Botao({ texto: st.f.id ? 'Salvar' : 'Adicionar', variante: 'primary', ocupado: st.busy, textoOcupado: 'Salvando…', onClick: salvar })] },
    h('div', { class: 'form-grid' },
      Campo({ id: 'eq-tipo', rotulo: 'Tipo', obrigatorio: true, valor: st.f.tipo, onInput: v => { st.f.tipo = v; }, erro: st.erros.tipo, placeholder: 'Ex.: Split hi-wall', maxlength: 60 }),
      Campo({ id: 'eq-cap', rotulo: 'Capacidade', valor: st.f.capacidade, onInput: v => { st.f.capacidade = v; }, placeholder: 'Ex.: 12.000 BTUs', maxlength: 40 }),
      Campo({ id: 'eq-marca', rotulo: 'Marca e modelo (opcional)', valor: st.f.marca, onInput: v => { st.f.marca = v; }, maxlength: 80 }),
      Campo({ id: 'eq-local', rotulo: 'Local de instalação', valor: st.f.local, onInput: v => { st.f.local = v; }, maxlength: 60 }))) : null);
}

export function Historico({ usuario }) {
  const lista = req.minhasSolicitacoes(usuario).filter(s => s.estadoExecucao === 'concluida');
  return h('div', { class: 'stack' },
    h('div', { class: 'page-head' }, h('div', null, h('h1', null, 'Histórico'), h('p', null, 'Atendimentos concluídos, com o trabalho realizado e o próximo retorno sugerido.'))),
    lista.length ? h('ul', { class: 'card list' }, lista.map(s => h('li', { key: s.id }, h('a', { class: 'list-item', href: '#/clientes/solicitacoes/' + s.id },
      h('span', { class: 'main' }, h('span', { class: 'strong' }, s.servicoNome), h('span', { class: 'small text2' }, `${s.id} · ${formatarDataHora(s.inicio, s.fuso)} · ${s.empresaNome}`),
        s.ordem && s.ordem.trabalho ? h('span', { class: 'small' }, 'Trabalho realizado: ' + s.ordem.trabalho) : null),
      h('span', { class: 'small' }, s.ordem && s.ordem.proximoRetorno ? 'Próximo retorno: ' + rotuloMes(s.ordem.proximoRetorno) : 'Sem retorno previsto')))))
      : h('div', { class: 'card' }, Vazio({ icone: 'clock-counter-clockwise', titulo: 'Você ainda não tem atendimentos concluídos', texto: 'Quando um atendimento for concluído, ele aparece aqui com o trabalho realizado e o próximo retorno sugerido.', acoes: [Botao({ texto: 'Ver solicitações em andamento', href: '#/clientes/solicitacoes' })] })));
}

export function Perfil({ usuario }) {
  const base = () => ({ nome: usuario.nome, telefone: usuario.telefone, emailAtendimentos: usuario.preferencias.emailAtendimentos !== false, marketing: Boolean(usuario.preferencias.marketing) });
  const st = estadoView('form:cli-perfil', () => ({ f: base(), versao: usuario.v, erros: {}, busy: false, dlg: null, end: {}, conf: '', endErros: {} }));
  if (!st.f) { st.f = base(); st.versao = usuario.v; }
  const sujo = JSON.stringify(st.f) !== JSON.stringify(base());
  if (sujo) marcarSujo('Você alterou seus dados pessoais e não salvou.'); else limparSujo();
  const muda = (k, v) => { st.f[k] = v; delete st.erros[k]; render(); };
  const salvar = async () => {
    set(st, { busy: true });
    const r = await salvarPerfil({ ...st.f, versao: st.versao });
    st.busy = false;
    if (r.ok) { st.f = null; st.erros = {}; limparSujo(); toast('Perfil atualizado.'); }
    else if (r.code === 'CONFLITO_ATUALIZACAO') st.erros = { nome: r.message };
    else st.erros = (r.details && r.details.campos) || {};
    render();
  };
  const descartar = () => { st.f = base(); st.erros = {}; limparSujo(); render(); };
  const ends = enderecosDe(usuario);
  const salvarEnd = async () => {
    set(st, { busy: true });
    const r = await salvarEndereco(st.end);
    st.busy = false;
    if (r.ok) { st.dlg = null; toast('Endereço salvo.'); } else st.endErros = (r.details && r.details.campos) || {};
    render();
  };
  const privacidade = async tipo => {
    set(st, { busy: true });
    const r = await pedirPrivacidade({ tipo, confirmacao: st.conf });
    st.busy = false;
    if (r.ok) { st.dlg = null; toast(tipo === 'exclusao' ? 'Pedido de exclusão registrado para análise conforme a política aplicável.' : 'Pedido de exportação registrado. Prazo de atendimento conforme a política aplicável.', 'info'); }
    else st.endErros = { conf: r.message };
    render();
  };
  return h('div', { class: 'stack content-narrow' },
    h('div', { class: 'page-head' }, h('div', null, h('h1', null, 'Perfil e endereços'), h('p', null, 'Dados de contato, endereços e preferências de comunicação.'))),
    sujo ? Alerta({ tipo: 'warn', titulo: 'Você tem alterações não salvas.', acoes: [Botao({ texto: 'Descartar', onClick: descartar }), Botao({ texto: 'Salvar', variante: 'primary', ocupado: st.busy, onClick: salvar })] }) : null,
    h('section', { class: 'card stack', 'aria-labelledby': 'pf-dados' }, h('h2', { id: 'pf-dados' }, 'Dados pessoais'),
      h('div', { class: 'form-grid' },
        Campo({ id: 'pf-nome', rotulo: 'Nome', obrigatorio: true, valor: st.f.nome, onInput: v => muda('nome', v), erro: st.erros.nome, autocomplete: 'name', maxlength: 120 }),
        Campo({ id: 'pf-email', rotulo: 'E-mail', valor: usuario.email, somenteLeitura: true, ajuda: 'O e-mail identifica a conta e não é alterado por esta tela.' }),
        Campo({ id: 'pf-tel', rotulo: 'Telefone', obrigatorio: true, tipo: 'tel', valor: st.f.telefone, onInput: v => muda('telefone', v), erro: st.erros.telefone, autocomplete: 'tel' })),
      h('p', { class: 'small text2' }, 'CPF não é solicitado neste cadastro.')),
    h('section', { class: 'card stack-sm', 'aria-labelledby': 'pf-end' }, h('div', { class: 'card-head' }, h('h2', { id: 'pf-end' }, 'Endereços'), Botao({ texto: 'Adicionar endereço', icone: 'plus', pequeno: true, onClick: () => set(st, { dlg: 'end', end: { rotulo: '', bairro: '', cidade: '', referencia: '' }, endErros: {} }) })),
      ends.length ? h('ul', { class: 'list' }, ends.map(e => h('li', { class: 'list-item', key: e.id }, h('span', { class: 'main' }, h('span', { class: 'strong' }, e.rotulo), h('span', { class: 'small text2' }, `${e.bairro}, ${e.cidade} · demonstrativo`)),
        Botao({ texto: 'Editar', pequeno: true, rotulo: 'Editar endereço ' + e.rotulo, onClick: () => set(st, { dlg: 'end', end: { ...e }, endErros: {} }) })))) : h('p', { class: 'muted' }, 'Nenhum endereço salvo.')),
    h('section', { class: 'card stack-sm', 'aria-labelledby': 'pf-com' }, h('h2', { id: 'pf-com' }, 'Comunicação e privacidade'),
      Check({ id: 'pf-email-at', rotulo: 'E-mails sobre minhas solicitações e agendamentos', ajuda: 'Avisos dentro da aplicação continuam ativos.', marcado: st.f.emailAtendimentos, onChange: v => muda('emailAtendimentos', v) }),
      Check({ id: 'pf-mkt', rotulo: 'Novidades e comunicações de marketing', ajuda: 'Consentimento opcional, separado dos termos de uso.', marcado: st.f.marketing, onChange: v => muda('marketing', v) }),
      h('div', { class: 'row mt-1' }, Botao({ texto: 'Solicitar exportação dos dados', icone: 'arrow-square-out', onClick: () => set(st, { dlg: 'exportar' }) }), Botao({ texto: 'Solicitar exclusão da conta', icone: 'trash', variante: 'danger', onClick: () => set(st, { dlg: 'excluir', conf: '', endErros: {} }) }))),
    h('div', { class: 'row' }, Botao({ texto: 'Salvar alterações', variante: 'primary', ocupado: st.busy, textoOcupado: 'Salvando…', onClick: salvar, desabilitado: !sujo, id: 'pf-salvar' })),
    st.dlg === 'end' ? Dialogo({ id: 'dlg-end', titulo: st.end.id ? 'Editar endereço' : 'Adicionar endereço', ocupado: st.busy, onFechar: () => set(st, { dlg: null }),
      rodape: [Botao({ texto: 'Cancelar', onClick: () => set(st, { dlg: null }) }), Botao({ texto: 'Salvar endereço', variante: 'primary', ocupado: st.busy, onClick: salvarEnd })] },
    h('div', { class: 'form-grid' },
      Campo({ id: 'end-rotulo', rotulo: 'Identificação', obrigatorio: true, valor: st.end.rotulo, onInput: v => { st.end.rotulo = v; }, erro: st.endErros.rotulo, placeholder: 'Casa, Trabalho…' }),
      Campo({ id: 'end-bairro', rotulo: 'Bairro ou região', obrigatorio: true, valor: st.end.bairro, onInput: v => { st.end.bairro = v; }, erro: st.endErros.bairro }),
      Campo({ id: 'end-cidade', rotulo: 'Cidade', obrigatorio: true, valor: st.end.cidade, onInput: v => { st.end.cidade = v; }, erro: st.endErros.cidade }),
      Campo({ id: 'end-ref', rotulo: 'Ponto de referência', valor: st.end.referencia, onInput: v => { st.end.referencia = v; } }))) : null,
    st.dlg === 'exportar' ? Dialogo({ id: 'dlg-exportar', titulo: 'Solicitar exportação dos dados', ocupado: st.busy, onFechar: () => set(st, { dlg: null }),
      rodape: [Botao({ texto: 'Cancelar', onClick: () => set(st, { dlg: null }) }), Botao({ texto: 'Solicitar', variante: 'primary', ocupado: st.busy, onClick: () => privacidade('exportacao') })] },
    h('p', null, 'Você receberá um arquivo com seus dados de conta, solicitações e equipamentos. O prazo e o formato seguem a política de privacidade aplicável.')) : null,
    st.dlg === 'excluir' ? Dialogo({ id: 'dlg-excluir', titulo: 'Solicitar exclusão da conta', alerta: true, ocupado: st.busy, onFechar: () => set(st, { dlg: null }),
      rodape: [Botao({ texto: 'Cancelar', onClick: () => set(st, { dlg: null }) }), Botao({ texto: 'Solicitar exclusão', variante: 'danger', ocupado: st.busy, desabilitado: st.conf !== 'EXCLUIR', onClick: () => privacidade('exclusao') })] },
    h('p', null, 'O pedido é analisado conforme a política aplicável. Registros de atendimentos mantidos pelas empresas podem ser preservados quando houver obrigação ou interesse legítimo.'),
    Campo({ id: 'excluir-conf', rotulo: 'Digite EXCLUIR para confirmar', valor: st.conf, onInput: v => set(st, { conf: v }), erro: st.endErros.conf })) : null);
}

export function Preferencias() {
  return h('div', { class: 'stack content-narrow' },
    h('div', { class: 'page-head' }, h('div', null, h('h1', null, 'Preferências'), h('p', null, 'Tema e densidade ficam salvos neste navegador e valem para todos os ambientes.'))),
    h('section', { class: 'card stack' }, ControlesAparencia('pref'),
      h('p', { class: 'small text2' }, 'Compacto mostra mais registros por tela. Em telas de toque, as áreas de toque de 44 px são mantidas.')),
    h('p', { class: 'small' }, icone('info'), ' Notificações por e-mail são configuradas em ', h('a', { href: '#/clientes/perfil' }, 'Perfil e endereços'), '.'));
}
