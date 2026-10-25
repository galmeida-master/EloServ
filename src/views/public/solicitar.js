// RF-CLI-01 · Solicitação de atendimento em etapas: serviço → equipamento → local → necessidade → horário → revisão.
// Sucesso só é exibido após a confirmação do servidor (api) e informa que ainda não é um agendamento.
import { h, Botao, Campo, Seg, Check, Alerta, Vazio, Passos, DL, FaixaDatas, Horarios, icone } from '../../ui/components.js';
import { ui, estadoView, render, navegar, novaChave } from '../../store.js';
import { perfilPublico } from '../../api/companies.js';
import { horariosPublicos, diasParaSolicitacao, horarioLivre } from '../../api/agenda.js';
import { criarSolicitacao } from '../../api/requests.js';
import { equipamentosDe, enderecosDe } from '../../api/users.js';
import { validarEtapaSolicitacao, validarSolicitacao, ETAPAS_SOLICITACAO } from '../../domain/validacao.js';
import { rotuloDia, rotuloFuso, formatarDataHora, formatarPrazo, dataLocal, dataBr } from '../../domain/datas.js';
import { explicacaoPreco } from '../../domain/dinheiro.js';
import { vinculoCliente } from '../../domain/permissoes.js';
import { lerRascunho, salvarRascunho, limparRascunho } from './rascunho.js';
import { textoDuracao } from './perfil.js';

const TIPOS = ['Split hi-wall', 'Split piso-teto', 'Split cassete', 'Ar-condicionado de janela', 'Balcão refrigerado', 'Câmara fria', 'Outro'];
const CAPACIDADES = ['', '7.000 BTUs', '9.000 BTUs', '12.000 BTUs', '18.000 BTUs', '24.000 BTUs', '30.000 BTUs ou mais', 'Não sei informar'];
const CAMPO_ETAPA = { servicoId: 0, equipamentoId: 1, equipTipo: 1, enderecoId: 2, bairro: 2, cidade: 2, descricao: 3, inicio: 4 };
const ROTULO_CAMPO = { servicoId: 'Serviço', equipamentoId: 'Equipamento', equipTipo: 'Tipo de equipamento', enderecoId: 'Endereço', bairro: 'Bairro ou região', cidade: 'Cidade', descricao: 'Necessidade', inicio: 'Horário' };

export function Solicitar({ params, usuario }) {
  const p = perfilPublico(params.slug);
  if (!p) return h('div', { class: 'card' }, Vazio({ nivel: 'h1', icone: 'storefront', titulo: 'Fornecedor indisponível', texto: 'Esta empresa não está recebendo novas solicitações no momento.', acoes: [Botao({ texto: 'Voltar ao catálogo', href: '#/fornecedores' })] }));
  const st = estadoView('solicitar:' + p.slug, () => ({ erros: {}, resultado: null, enviando: false, sucesso: null, gate: false, resumo: false }));
  const r = lerRascunho(p.slug);
  if (!r.servicoId || !p.servicos.some(s => s.id === r.servicoId)) r.servicoId = p.servicos[0] ? p.servicos[0].id : '';
  const cliente = usuario && vinculoCliente(usuario) ? usuario : null;
  const eqs = equipamentosDe(cliente);
  const ends = enderecosDe(cliente);
  if (!cliente) { r.equipamentoModo = 'novo'; r.localModo = 'novo'; }
  const servico = p.servicos.find(s => s.id === r.servicoId);
  const dias = diasParaSolicitacao(undefined, { fuso: p.fuso });
  if (!r.dataEscolhida || !dias.includes(r.dataEscolhida)) r.dataEscolhida = r.inicio ? dataLocal(r.inicio, p.fuso) : dias[0];
  const etapa = Math.min(5, Math.max(0, r.etapa || 0));
  const fuso = rotuloFuso(p.fuso);
  const salvar = patch => {
    Object.assign(r, patch);
    salvarRascunho(r);
    for (const k of Object.keys(patch)) delete st.erros[k];
    render();
  };
  const ctxValid = { horarioLivre: inicio => horarioLivre({ empresaId: p.id, servicoId: r.servicoId, inicio }) };
  const irPara = n => {
    if (n > etapa) {
      for (let i = etapa; i < n; i++) {
        const e = validarEtapaSolicitacao(i, r, ctxValid);
        if (Object.keys(e).length) { r.etapa = i; salvarRascunho(r); st.erros = e; render(); focarPrimeiroErro(); return; }
      }
    }
    st.erros = {}; st.gate = false; st.resumo = false;
    r.etapa = n; salvarRascunho(r);
    render();
    queueMicrotask(() => { const t = document.getElementById('titulo-etapa'); if (t) t.focus(); });
  };
  if (r.inicio && !r.semHorario) ui.contextoSim = { tipo: 'horario', empresaId: p.id, servicoId: r.servicoId, inicio: r.inicio, rotulo: formatarDataHora(r.inicio, p.fuso) };

  if (st.sucesso) {
    const s = st.sucesso;
    return h('div', { class: 'stack content-narrow', style: 'margin:0 auto' },
      h('div', { class: 'card stack' },
        h('div', { class: 'row' }, h('span', { class: 'badge t-o' }, icone('check-circle'), 'Solicitação enviada'), h('span', { class: 'small text2 tabular' }, `${s.id} · ${p.nome}`)),
        h('h1', { tabindex: '-1' }, 'Solicitação enviada'),
        Alerta({ tipo: 'warn', titulo: 'Isto ainda não é um agendamento.' },
          h('p', null, s.inicio ? `Reserva temporária do horário ${formatarDataHora(s.inicio, p.fuso)} até ${formatarPrazo(s.expiraEm, p.fuso)} (${fuso}). A empresa vai analisar e enviar uma proposta; o agendamento só é concluído quando você confirmar.` : 'Nenhum horário foi reservado. A empresa vai propor um horário na proposta.')),
        DL([['Serviço', s.servico], ['Data e hora', s.inicio ? `${formatarDataHora(s.inicio, p.fuso)} · ${fuso}` : 'Sem horário definido'], ['Preço', s.preco]]),
        h('div', { class: 'row' }, Botao({ texto: 'Acompanhar solicitação', variante: 'primary', href: '#/clientes/solicitacoes/' + s.id }), Botao({ texto: 'Voltar ao catálogo', href: '#/fornecedores' }))));
  }

  const err = st.erros;
  const corpo = [];
  if (etapa === 0) {
    corpo.push(h('fieldset', { class: 'fieldset' }, h('legend', null, 'Qual serviço você precisa?'),
      h('div', { class: 'stack-sm', role: 'radiogroup', 'aria-label': 'Serviço' }, p.servicos.map(s => h('button', { type: 'button', role: 'radio', class: 'option-card', 'aria-checked': String(s.id === r.servicoId), onClick: () => salvar({ servicoId: s.id, inicio: '' }) },
        h('span', { class: 'radio-dot', 'aria-hidden': 'true' }),
        h('span', { class: 'stack-xs grow' }, h('span', { class: 'row-between' }, h('span', { class: 'strong' }, s.nome), h('span', { class: 'tabular' }, s.precoTexto)),
          h('span', { class: 'small text2' }, s.descricao), h('span', { class: 'small' }, `Duração estimada ${textoDuracao(s.duracaoMin)} · ${s.local}`), s.observacao ? h('span', { class: 'small muted' }, s.observacao) : null))))));
  }
  if (etapa === 1) {
    corpo.push(h('fieldset', { class: 'fieldset stack' }, h('legend', null, 'Equipamento'),
      cliente && eqs.length ? Seg({ rotulo: 'Origem do equipamento', valor: r.equipamentoModo, opcoes: [['salvo', 'Equipamento cadastrado'], ['novo', 'Informar agora']], onChange: v => salvar({ equipamentoModo: v }) }) : null,
      r.equipamentoModo === 'salvo' && cliente
        ? Campo({ id: 'sol-equipamento', rotulo: 'Equipamento cadastrado', obrigatorio: true, valor: r.equipamentoId, onChange: v => salvar({ equipamentoId: v }), erro: err.equipamentoId, opcoes: [{ v: '', l: 'Escolha…' }, ...eqs.map(e => ({ v: e.id, l: `${e.tipo} ${e.capacidade} · ${e.local}`.trim() }))] })
        : h('div', { class: 'form-grid' },
          h('p', { class: 'hint full' }, 'Informe o mínimo necessário. Marca e modelo são opcionais.'),
          Campo({ id: 'sol-equip-tipo', rotulo: 'Tipo de equipamento', obrigatorio: true, valor: r.equipTipo, onChange: v => salvar({ equipTipo: v }), erro: err.equipTipo, opcoes: [{ v: '', l: 'Escolha…' }, ...TIPOS.map(t => ({ v: t, l: t }))] }),
          Campo({ id: 'sol-equip-cap', rotulo: 'Capacidade', valor: r.equipCapacidade, onChange: v => salvar({ equipCapacidade: v }), opcoes: CAPACIDADES.map(c => ({ v: c, l: c || 'Não informada' })) }),
          Campo({ id: 'sol-equip-marca', rotulo: 'Marca e modelo (opcional)', valor: r.equipMarca, onInput: v => salvar({ equipMarca: v }), maxlength: 80 }),
          Campo({ id: 'sol-equip-local', rotulo: 'Local de instalação (opcional)', valor: r.equipLocal, onInput: v => salvar({ equipLocal: v }), maxlength: 60, placeholder: 'Ex.: Sala, Quarto' }))));
  }
  if (etapa === 2) {
    corpo.push(h('fieldset', { class: 'fieldset stack' }, h('legend', null, 'Local de atendimento'),
      cliente && ends.length ? Seg({ rotulo: 'Origem do endereço', valor: r.localModo, opcoes: [['salvo', 'Endereço salvo'], ['novo', 'Outro local']], onChange: v => salvar({ localModo: v }) }) : null,
      r.localModo === 'salvo' && cliente
        ? Campo({ id: 'sol-endereco', rotulo: 'Endereço salvo', obrigatorio: true, valor: r.enderecoId, onChange: v => salvar({ enderecoId: v }), erro: err.enderecoId, opcoes: [{ v: '', l: 'Escolha…' }, ...ends.map(e => ({ v: e.id, l: `${e.rotulo} · ${e.bairro}, ${e.cidade}` }))] })
        : h('div', { class: 'form-grid' },
          h('div', { class: 'full' }, Seg({ rotulo: 'Identificação do local', rotuloVisivel: true, id: 'sol-local-rotulo', valor: r.localRotulo, opcoes: [['Casa', 'Casa'], ['Trabalho', 'Trabalho'], ['Comércio', 'Comércio']], onChange: v => salvar({ localRotulo: v }) })),
          Campo({ id: 'sol-bairro', rotulo: 'Bairro ou região', obrigatorio: true, valor: r.bairro, onInput: v => salvar({ bairro: v }), erro: err.bairro, maxlength: 80, autocomplete: 'address-level3' }),
          Campo({ id: 'sol-cidade', rotulo: 'Cidade', obrigatorio: true, valor: r.cidade, onInput: v => salvar({ cidade: v }), erro: err.cidade, maxlength: 80, autocomplete: 'address-level2' }),
          Campo({ id: 'sol-referencia', rotulo: 'Ponto de referência (opcional)', valor: r.referencia, onInput: v => salvar({ referencia: v }), maxlength: 120, classe: 'full' })),
      h('p', { class: 'hint' }, 'O endereço completo só é compartilhado com a empresa após o envio.')));
  }
  if (etapa === 3) {
    corpo.push(Campo({ id: 'sol-descricao', rotulo: 'Descreva a necessidade', obrigatorio: true, linhas: 6, maxlength: 600, contador: true, valor: r.descricao, onInput: v => salvar({ descricao: v }), erro: err.descricao,
      ajuda: 'Sintomas, há quanto tempo acontece e informações de acesso ao equipamento. Não inclua dados pessoais sensíveis.' }));
  }
  if (etapa === 4) {
    const slots = servico ? horariosPublicos({ empresaId: p.id, servicoId: servico.id, data: r.dataEscolhida }) : [];
    corpo.push(h('fieldset', { class: 'fieldset stack-sm' }, h('legend', null, 'Horário desejado'),
      h('p', { class: 'small text2' }, `${fuso} · a duração estimada (${servico ? textoDuracao(servico.duracaoMin) : '—'}) já é considerada na disponibilidade.`),
      FaixaDatas({ rotulo: 'Escolha o dia', datas: dias, selecionada: r.semHorario ? null : r.dataEscolhida, onEscolher: d => salvar({ dataEscolhida: d, semHorario: false }), rotuloDe: rotuloDia }),
      h('p', { class: 'strong small' }, rotuloDia(r.dataEscolhida).longo),
      slots.length ? Horarios({ rotulo: 'Horários em ' + dataBr(r.dataEscolhida), slots, selecionado: r.semHorario ? null : r.inicio, onEscolher: s => salvar({ inicio: s.inicio, semHorario: false }) }) : h('p', { class: 'muted small' }, 'Sem horários para solicitação neste dia.'),
      Check({ id: 'sol-sem-horario', rotulo: 'Enviar sem horário definido — a empresa proporá um horário', marcado: r.semHorario, onChange: v => salvar({ semHorario: v, ...(v ? { inicio: '' } : {}) }) }),
      err.inicio ? h('p', { class: 'err-msg', id: 'sol-horario-erro' }, icone('warning-circle'), err.inicio) : null,
      Alerta({ tipo: 'info' }, h('p', { class: 'small' }, 'Selecionar um horário não bloqueia a agenda. Ao enviar, o sistema tenta criar uma reserva temporária; ela só existe depois da confirmação do servidor.'))));
  }
  if (etapa === 5) {
    const todos = validarSolicitacao(r, ctxValid);
    const lista = st.resumo ? Object.entries(todos.erros) : [];
    const res = st.resultado;
    corpo.push(
      lista.length ? Alerta({ tipo: 'err', titulo: 'Corrija os itens abaixo antes de enviar', foco: true },
        h('ul', { class: 'stack-xs' }, lista.map(([k, m]) => h('li', null, h('button', { type: 'button', class: 'link-btn', onClick: () => irPara(CAMPO_ETAPA[k]) }, `${ROTULO_CAMPO[k]} (etapa ${CAMPO_ETAPA[k] + 1})`), ': ' + m)))) : null,
      res && res.code === 'HORARIO_INDISPONIVEL' ? Alerta({ tipo: 'err', titulo: 'O horário escolhido deixou de estar disponível', foco: true, id: 'alerta-conflito' },
        h('p', null, 'Outra solicitação reservou esse horário enquanto você preenchia. Nada foi enviado e seus dados foram mantidos. Escolha outra opção:'),
        (res.details && res.details.alternativas || []).length
          ? h('div', { class: 'row' }, res.details.alternativas.map(a => Botao({ texto: a.rotulo, pequeno: true, onClick: () => { st.resultado = null; salvar({ inicio: a.inicio, dataEscolhida: dataLocal(a.inicio, p.fuso), semHorario: false }); } })))
          : h('p', null, 'Não há horários livres próximos. Você pode enviar sem horário definido.'),
        h('div', null, Botao({ texto: 'Enviar sem horário definido', variante: 'ghost', pequeno: true, onClick: () => { st.resultado = null; salvar({ semHorario: true, inicio: '' }); } }))) : null,
      res && res.code === 'FALHA_CONEXAO' ? Alerta({ tipo: 'err', titulo: 'Não foi possível enviar a solicitação', foco: true, id: 'alerta-falha', acoes: [Botao({ texto: 'Tentar novamente', icone: 'arrow-clockwise', onClick: () => enviar() })] },
        h('p', null, 'Falha de conexão. Nenhuma reserva foi criada e seus dados foram mantidos.')) : null,
      res && !['HORARIO_INDISPONIVEL', 'FALHA_CONEXAO'].includes(res.code) ? Alerta({ tipo: 'err', titulo: 'Não foi possível enviar', foco: true }, h('p', null, res.message)) : null,
      h('h3', null, 'Revise sua solicitação'),
      DL([
        ['Serviço', servico ? servico.nome : '—'], ['Fornecedor', p.nome],
        ['Equipamento', r.equipamentoModo === 'salvo' && cliente ? (eqs.find(e => e.id === r.equipamentoId) ? `${eqs.find(e => e.id === r.equipamentoId).tipo} ${eqs.find(e => e.id === r.equipamentoId).capacidade}` : '—') : [r.equipTipo, r.equipCapacidade, r.equipMarca, r.equipLocal].filter(Boolean).join(' · ') || '—'],
        ['Local', r.localModo === 'salvo' && cliente ? (ends.find(e => e.id === r.enderecoId) ? `${ends.find(e => e.id === r.enderecoId).rotulo} · ${ends.find(e => e.id === r.enderecoId).bairro}, ${ends.find(e => e.id === r.enderecoId).cidade} (endereço salvo)` : '—') : [r.localRotulo, r.bairro, r.cidade].filter(Boolean).join(' · ') || '—'],
        ['Data e hora', r.semHorario || !r.inicio ? 'Sem horário definido — a empresa proporá um horário' : `${formatarDataHora(r.inicio, p.fuso)} · ${fuso}`],
        ['Duração estimada', servico ? `${textoDuracao(servico.duracaoMin)} · pode mudar após avaliação` : '—'],
        ['Preço', servico ? h('span', null, explicacaoPreco(servico), servico.observacao ? h('span', { class: 'small muted', style: 'display:block' }, servico.observacao) : null) : '—'],
        ['Necessidade', r.descricao || '—']
      ]),
      h('div', { class: 'card stack-xs', style: 'background:var(--raised)' }, h('h3', { class: 'strong' }, 'Próximos passos'),
        h('ol', { class: 'prose small stack-xs' },
          h('li', null, r.semHorario ? 'Sem horário escolhido: nenhuma reserva é criada.' : `O sistema tenta reservar temporariamente o horário por até ${(p.validadeReservaH || 24)} horas.`),
          h('li', null, 'A empresa analisa e envia uma proposta com valores e validade.'),
          h('li', null, 'Você confirma a proposta. Só então o agendamento é concluído.'))),
      st.gate && !cliente ? Alerta({ tipo: 'info', titulo: usuario ? 'Entre com uma conta de cliente para enviar' : 'Entre ou crie uma conta para enviar', foco: true,
        acoes: [Botao({ texto: 'Entrar', variante: 'primary', href: '#/entrar?volta=' + encodeURIComponent('/fornecedores/' + p.slug + '/solicitar') }), Botao({ texto: 'Criar conta', href: '#/cadastro?volta=' + encodeURIComponent('/fornecedores/' + p.slug + '/solicitar') })] },
      h('p', null, 'Os dados preenchidos ficam guardados neste dispositivo e você volta para esta revisão.')) : null);
  }

  async function enviar() {
    if (st.enviando) return;
    const v = validarSolicitacao(r, ctxValid);
    if (!v.ok && !(Object.keys(v.erros).length === 1 && v.erros.inicio && /não está mais disponível/.test(v.erros.inicio))) { st.resumo = true; st.erros = v.erros; render(); return; }
    if (!cliente) { st.gate = true; render(); return; }
    if (!r.chave) { r.chave = novaChave(); salvarRascunho(r); }
    st.enviando = true; st.resultado = null; render();
    const res = await criarSolicitacao({ ...r }, { idempotencyKey: r.chave });
    st.enviando = false;
    if (res.ok) {
      st.sucesso = { ...res.data, servico: servico.nome, preco: explicacaoPreco(servico) };
      limparRascunho();
      ui.contextoSim = null;
      render();
      queueMicrotask(() => { const t = document.querySelector('main h1'); if (t) t.focus(); });
      return;
    }
    if (res.code === 'SESSAO_EXPIRADA') { navegar('/sessao-expirada?volta=' + encodeURIComponent('/fornecedores/' + p.slug + '/solicitar')); return; }
    st.resultado = res;
    render();
  }

  return h('div', { class: 'stack content-narrow', style: 'margin:0 auto;width:100%' },
    h('nav', { class: 'crumbs', 'aria-label': 'Trilha' }, h('a', { href: '#/fornecedores' }, 'Fornecedores'), h('span', { 'aria-hidden': 'true' }, '›'), h('a', { href: '#/fornecedores/' + p.slug }, p.nome), h('span', { 'aria-hidden': 'true' }, '›'), h('span', { 'aria-current': 'page' }, 'Solicitar')),
    h('div', { class: 'stack-xs' }, h('h1', null, 'Solicitar atendimento'), h('p', { class: 'text2' }, `Fornecedor: ${p.nome} · Seus dados ficam guardados neste dispositivo enquanto você preenche.`)),
    Passos({ rotulo: 'Etapas da solicitação', passos: ETAPAS_SOLICITACAO, atual: etapa, onIr: irPara }),
    h('p', { class: 'small text2', 'aria-live': 'polite' }, `Etapa ${etapa + 1} de 6 · ${ETAPAS_SOLICITACAO[etapa]}`),
    h('section', { class: 'card stack', 'aria-labelledby': 'titulo-etapa' },
      h('h2', { id: 'titulo-etapa', tabindex: '-1', class: 'sr-only' }, ETAPAS_SOLICITACAO[etapa]),
      ...corpo,
      h('div', { class: 'row-between mt-2' },
        etapa > 0 ? Botao({ texto: 'Voltar', icone: 'arrow-left', onClick: () => irPara(etapa - 1), desabilitado: st.enviando }) : h('span'),
        etapa < 5 ? Botao({ texto: 'Continuar', variante: 'primary', icone: 'arrow-right', onClick: () => irPara(etapa + 1), id: 'sol-continuar' })
          : Botao({ texto: 'Enviar solicitação', variante: 'primary', icone: 'paper-plane-tilt', ocupado: st.enviando, textoOcupado: 'Enviando e verificando horário…', onClick: enviar, id: 'sol-enviar' }))));
}

function focarPrimeiroErro() {
  queueMicrotask(() => { const el = document.querySelector('[aria-invalid="true"]') || document.getElementById('sol-horario-erro'); if (el) el.focus(); });
}
