// RF-EMP-02/03/08/09/10 · Perfil da empresa e situações, serviços, produtos, clientes e equipamentos,
// histórico e retornos, ajuda em painel lateral e configurações da agenda.
import { h, Botao, Campo, Check, Seg, Alerta, Vazio, Dialogo, Badge, Tabela } from '../../ui/components.js';
import { ui, estadoView, set, render, toast, marcarSujo, limparSujo } from '../../store.js';
import * as comp from '../../api/companies.js';
import { retornosPrevistos } from '../../api/orders.js';
import { listarArtigos } from '../../api/kb.js';
import { agora } from '../../api/clock.js';
import { formatarData, rotuloMes, rotuloDia, rotuloFuso, dataBr, proximosDias, dataLocal, FUSOS_DISPONIVEIS, minParaHm } from '../../domain/datas.js';
import { formatarMoeda, centavosParaCampo, TIPOS_PRECO } from '../../domain/dinheiro.js';
import { textoJornada } from './equipe.js';
import { textoDuracao } from '../public/perfil.js';
import { avisoSituacao } from './visao.js';

const SITUACOES = [['preenchimento', 'Cadastro em preenchimento', 'Complete os dados obrigatórios e envie para habilitação. O perfil público ainda não está visível.'],
  ['aguardando', 'Aguardando habilitação', 'A administração analisa o cadastro. Você pode configurar serviços e equipe; o perfil público fica oculto até a habilitação.'],
  ['ativa', 'Ativa', 'Perfil público visível e recebendo solicitações. Habilitação cadastral não representa certificação técnica.'],
  ['suspensa', 'Suspensa', 'Perfil público oculto e novas solicitações bloqueadas. Atendimentos já confirmados continuam visíveis para tratamento.'],
  ['arquivada', 'Arquivada', 'Empresa encerrada na plataforma. Histórico preservado em modo de leitura.']];

export function Perfil({ usuario, empresaId }) {
  const emp = comp.empresaDoUsuario(usuario, empresaId);
  const base = () => ({ nome: emp.nome, razaoSocial: emp.razaoSocial, descricao: emp.descricao, horarios: emp.horarios, telefonePublico: emp.contatoPublico.telefone, emailPublico: emp.contatoPublico.email, area: emp.area.join(', '), politicas: emp.politicas.join('\n'), modalidades: [...emp.modalidades] });
  const st = estadoView('form:emp-perfil:' + empresaId, () => ({ f: base(), versao: emp.v, erros: {}, busy: false }));
  const sujo = JSON.stringify(st.f) !== JSON.stringify(base());
  if (sujo) marcarSujo('Você alterou o perfil da empresa e não salvou.'); else limparSujo();
  const muda = (k, v) => { st.f[k] = v; delete st.erros[k]; render(); };
  const salvar = async () => {
    set(st, { busy: true });
    const r = await comp.salvarPerfilEmpresa({ empresaId, ...st.f, versao: st.versao });
    st.busy = false;
    if (r.ok) { limparSujo(); st.erros = {}; toast('Perfil atualizado.'); delete ui.views['form:emp-perfil:' + empresaId]; }
    else st.erros = (r.details && r.details.campos) || { geral: r.message };
    render();
  };
  return h('div', { class: 'stack' },
    h('div', { class: 'page-head' }, h('div', null, h('h1', null, 'Perfil da empresa'), h('p', null, 'Dados exibidos no perfil público e dados internos, separados.'))),
    h('section', { class: 'card stack-sm', 'aria-labelledby': 'tit-situacao' }, h('div', { class: 'card-head' }, h('h2', { id: 'tit-situacao' }, 'Situação na plataforma'), Badge('empresa', emp.situacao)),
      avisoSituacao(emp) || Alerta({ tipo: 'ok' }, h('p', null, SITUACOES[2][2])),
      h('details', null, h('summary', { class: 'small strong' }, 'O que significa cada situação'),
        h('dl', { class: 'dl mt-1' }, SITUACOES.flatMap(([k, l, t]) => [h('dt', null, Badge('empresa', k, l)), h('dd', { class: 'small' }, t)])))),
    sujo ? Alerta({ tipo: 'warn', titulo: 'Você tem alterações não salvas.', acoes: [Botao({ texto: 'Descartar', onClick: () => { st.f = base(); limparSujo(); render(); } }), Botao({ texto: 'Salvar', variante: 'primary', ocupado: st.busy, onClick: salvar })] }) : null,
    st.erros.geral ? Alerta({ tipo: 'err' }, h('p', null, st.erros.geral)) : null,
    h('section', { class: 'card stack', 'aria-labelledby': 'tit-ident' }, h('h2', { id: 'tit-ident' }, 'Identificação'),
      h('div', { class: 'form-grid' },
        Campo({ id: 'emp-nome', rotulo: 'Nome da empresa', obrigatorio: true, valor: st.f.nome, onInput: v => muda('nome', v), erro: st.erros.nome, maxlength: 120 }),
        Campo({ id: 'emp-razao', rotulo: 'Razão social (quando aplicável)', valor: st.f.razaoSocial, onInput: v => muda('razaoSocial', v), maxlength: 160 }),
        Campo({ id: 'emp-cnpj', rotulo: 'CNPJ', valor: emp.cnpj, somenteLeitura: true, ajuda: 'Valor fictício. Alteração exige nova análise cadastral.' }),
        Campo({ id: 'emp-desc', rotulo: 'Descrição pública', linhas: 3, valor: st.f.descricao, onInput: v => muda('descricao', v), classe: 'full', maxlength: 600 }))),
    h('section', { class: 'card stack', 'aria-labelledby': 'tit-contatos' }, h('h2', { id: 'tit-contatos' }, 'Contatos'),
      h('div', { class: 'form-grid' },
        Campo({ id: 'emp-tel', rotulo: 'Telefone e WhatsApp (público, contato manual)', tipo: 'tel', valor: st.f.telefonePublico, onInput: v => muda('telefonePublico', v), erro: st.erros.telefonePublico }),
        Campo({ id: 'emp-email', rotulo: 'E-mail público', tipo: 'email', valor: st.f.emailPublico, onInput: v => muda('emailPublico', v), erro: st.erros.emailPublico })),
      h('p', { class: 'small text2' }, `Privados · apenas EloServ e equipe: Responsável ${emp.contatoPrivado.responsavel || '—'} · ${emp.contatoPrivado.email || '—'}`)),
    h('section', { class: 'card stack', 'aria-labelledby': 'tit-atend' }, h('h2', { id: 'tit-atend' }, 'Atendimento'),
      h('div', { class: 'form-grid' },
        Campo({ id: 'emp-cidade', rotulo: 'Cidade', valor: emp.cidade, somenteLeitura: true }),
        Campo({ id: 'emp-area', rotulo: 'Área atendida (separe por vírgulas)', valor: st.f.area, onInput: v => muda('area', v) }),
        Campo({ id: 'emp-horarios', rotulo: 'Horário de funcionamento', valor: st.f.horarios, onInput: v => muda('horarios', v), classe: 'full', maxlength: 160 }),
        h('fieldset', { class: 'fieldset full' }, h('legend', null, 'Modalidades'), h('div', { class: 'row' }, ['Residencial', 'Comercial'].map(m => Check({ id: 'emp-mod-' + m, rotulo: m, marcado: st.f.modalidades.includes(m), onChange: v => muda('modalidades', v ? [...st.f.modalidades, m] : st.f.modalidades.filter(x => x !== m)) })))),
        Campo({ id: 'emp-politicas', rotulo: 'Políticas de atendimento e cancelamento (uma por linha)', linhas: 4, valor: st.f.politicas, onInput: v => muda('politicas', v), classe: 'full' }))),
    h('div', { class: 'row' }, Botao({ texto: 'Salvar perfil', variante: 'primary', ocupado: st.busy, desabilitado: !sujo, onClick: salvar })),
    h('p', { class: 'xsmall muted' }, 'Habilitação na EloServ não representa certificação técnica. Não publique selos ou promessas sem evidência.'));
}

export function Servicos({ usuario, empresaId }) {
  const st = estadoView('emp-servicos:' + empresaId, () => ({ dlg: null, f: {}, erros: {}, busy: false, filtro: '' }));
  const todos = comp.servicosDaEmpresa(usuario, empresaId);
  const lista = todos.filter(s => !st.filtro || s.situacao === st.filtro);
  const abrir = s => set(st, { dlg: 'servico', erros: {}, f: s ? { ...s, preco: centavosParaCampo(s.precoCentavos) } : { nome: '', descricao: '', duracaoMin: 90, local: 'No endereço do cliente', tipoPreco: 'fixo', preco: '', observacao: '' } });
  const salvar = async () => {
    set(st, { busy: true });
    const r = await comp.salvarServico({ empresaId, ...st.f, versao: st.f.v });
    st.busy = false;
    if (r.ok) { st.dlg = null; toast(st.f.id ? 'Serviço atualizado.' : 'Serviço cadastrado e ativo no perfil público.'); } else st.erros = (r.details && r.details.campos) || { nome: r.message };
    render();
  };
  const situacao = async (s, nova) => {
    const r = await comp.alterarSituacaoServico({ servicoId: s.id, situacao: nova, versao: s.v });
    if (r.ok) toast(nova === 'inativo' ? 'Serviço desativado. Deixa de aparecer no perfil público.' : nova === 'arquivado' ? 'Serviço arquivado. O histórico foi preservado.' : (r.data && r.data.aviso) || 'Serviço ativado.', nova === 'ativo' && r.data && r.data.aviso ? 'warn' : 'ok');
    else toast(r.message, 'warn');
    render();
  };
  return h('div', { class: 'stack' },
    h('div', { class: 'page-head' }, h('div', null, h('h1', null, 'Serviços'), h('p', null, 'Serviços ativos aparecem no perfil público com duração e forma de preço.')),
      todos.length ? Botao({ texto: 'Cadastrar serviço', icone: 'plus', variante: 'primary', onClick: () => abrir(null) }) : null),
    todos.length ? h('div', { class: 'stack' },
      Seg({ rotulo: 'Filtrar por situação', valor: st.filtro, opcoes: [['', 'Todos'], ['ativo', 'Ativos'], ['inativo', 'Inativos'], ['arquivado', 'Arquivados']], onChange: v => set(st, { filtro: v }) }),
      Tabela({ id: 'tab-servicos', rotulo: 'Serviços da empresa', estado: st, linhas: lista, colunas: [
        { id: 'nome', titulo: 'Serviço', valor: s => s.nome, render: s => h('div', null, h('span', { class: 'cell-main' }, s.nome), h('div', { class: 'cell-sub' }, `${s.usos} atendimentos no histórico`), s.moderacao && s.moderacao.situacao === 'ajuste_solicitado' ? h('div', { class: 'cell-sub', style: 'color:var(--warn)' }, 'Ajuste solicitado pela administração: ' + s.moderacao.motivo) : null) },
        { id: 'dur', titulo: 'Duração', valor: s => String(s.duracaoMin).padStart(4, '0'), render: s => textoDuracao(s.duracaoMin) },
        { id: 'preco', titulo: 'Preço', valor: s => s.precoTexto, render: s => h('span', null, TIPOS_PRECO[s.tipoPreco], s.tipoPreco === 'orcamento' ? '' : ' · ' + formatarMoeda(s.precoCentavos)) },
        { id: 'sit', titulo: 'Situação', valor: s => s.situacao, render: s => h('div', { class: 'stack-xs' }, Badge('registro', s.situacao), s.situacao === 'inativo' ? h('span', { class: 'cell-sub' }, 'Não aparece no perfil público.') : s.situacao === 'arquivado' ? h('span', { class: 'cell-sub' }, 'Mantido por estar vinculado ao histórico.') : null) },
        { id: 'acoes', titulo: 'Ações', acoes: true, render: s => s.situacao === 'arquivado' ? h('span', { class: 'small muted' }, 'Somente leitura') : h('div', { class: 'row', style: 'justify-content:flex-end' },
          Botao({ texto: 'Editar', pequeno: true, onClick: () => abrir(s), rotulo: 'Editar ' + s.nome }),
          Botao({ texto: s.situacao === 'ativo' ? 'Desativar' : 'Ativar', pequeno: true, onClick: () => situacao(s, s.situacao === 'ativo' ? 'inativo' : 'ativo'), rotulo: (s.situacao === 'ativo' ? 'Desativar ' : 'Ativar ') + s.nome }),
          Botao({ texto: 'Arquivar', pequeno: true, variante: 'ghost', onClick: () => situacao(s, 'arquivado'), rotulo: 'Arquivar ' + s.nome })) }
      ] })) : h('div', { class: 'card' }, Vazio({ icone: 'wrench', titulo: 'Sua empresa ainda não tem serviços', texto: 'Cadastre ao menos um serviço com duração e forma de preço para receber solicitações no perfil público.', acoes: [Botao({ texto: 'Cadastrar primeiro serviço', icone: 'plus', variante: 'primary', onClick: () => abrir(null) })] })),
    st.dlg === 'servico' ? Dialogo({ id: 'dlg-servico', titulo: st.f.id ? 'Editar serviço' : 'Cadastrar serviço', largo: true, ocupado: st.busy, onFechar: () => set(st, { dlg: null }),
      rodape: [Botao({ texto: 'Cancelar', onClick: () => set(st, { dlg: null }) }), Botao({ texto: 'Salvar serviço', variante: 'primary', ocupado: st.busy, onClick: salvar })] },
    h('div', { class: 'form-grid' },
      Campo({ id: 'sv-nome', rotulo: 'Nome', obrigatorio: true, valor: st.f.nome, onInput: v => { st.f.nome = v; }, erro: st.erros.nome, classe: 'full', maxlength: 100 }),
      Campo({ id: 'sv-desc', rotulo: 'Descrição', linhas: 3, valor: st.f.descricao, onInput: v => { st.f.descricao = v; }, classe: 'full', maxlength: 400 }),
      Campo({ id: 'sv-dur', rotulo: 'Duração estimada (minutos)', tipo: 'number', valor: String(st.f.duracaoMin), onInput: v => { st.f.duracaoMin = v; }, erro: st.erros.duracaoMin, min: '15', max: '600', inputmode: 'numeric' }),
      Campo({ id: 'sv-local', rotulo: 'Local de atendimento', valor: st.f.local, onInput: v => { st.f.local = v; } }),
      Campo({ id: 'sv-tipo', rotulo: 'Tipo de preço', valor: st.f.tipoPreco, onChange: v => { st.f.tipoPreco = v; render(); }, opcoes: Object.entries(TIPOS_PRECO).map(([v, l]) => ({ v, l })), erro: st.erros.tipoPreco }),
      st.f.tipoPreco === 'orcamento' ? h('p', { class: 'hint' }, 'O valor é definido na proposta.') : Campo({ id: 'sv-preco', rotulo: st.f.tipoPreco === 'a_partir' ? 'Valor inicial (R$)' : 'Valor (R$)', valor: st.f.preco, onInput: v => { st.f.preco = v; }, erro: st.erros.preco, inputmode: 'decimal', placeholder: '0,00' }),
      Campo({ id: 'sv-obs', rotulo: 'Observações (ex.: valor depende de avaliação, cobrança de visita)', linhas: 2, valor: st.f.observacao, onInput: v => { st.f.observacao = v; }, classe: 'full', maxlength: 300 }))) : null);
}

export function Produtos({ usuario, empresaId }) {
  const st = estadoView('emp-produtos:' + empresaId, () => ({ dlg: null, f: {}, erros: {}, busy: false }));
  const lista = comp.produtosDaEmpresa(usuario, empresaId).filter(p => p.situacao !== 'arquivado');
  const abrir = p => set(st, { dlg: 'produto', erros: {}, f: p ? { ...p, preco: centavosParaCampo(p.precoCentavos) } : { nome: '', descricao: '', preco: '', disponibilidade: 'Disponível' } });
  const salvar = async () => {
    set(st, { busy: true });
    const r = await comp.salvarProduto({ empresaId, ...st.f, versao: st.f.v });
    st.busy = false;
    if (r.ok) { st.dlg = null; toast('Produto salvo.'); } else st.erros = (r.details && r.details.campos) || { nome: r.message };
    render();
  };
  return h('div', { class: 'stack' },
    h('div', { class: 'page-head' }, h('div', null, h('h1', null, 'Produtos'), h('p', null, 'Catálogo informativo. Sem carrinho, estoque integrado ou entrega nesta versão.')), Botao({ texto: 'Cadastrar produto', icone: 'plus', variante: 'primary', onClick: () => abrir(null) })),
    lista.length ? h('ul', { class: 'grid-auto' }, lista.map(p => h('li', { class: 'card stack-xs', key: p.id },
      h('div', { class: 'row-between' }, h('h2', { style: 'font-size:16px' }, p.nome), Badge('registro', p.situacao)),
      h('p', { class: 'small text2' }, p.descricao), h('p', { class: 'small' }, h('span', { class: 'strong' }, p.precoCentavos == null ? 'Sob consulta' : formatarMoeda(p.precoCentavos)), ' · ', p.disponibilidade),
      h('div', { class: 'row' }, Botao({ texto: 'Editar', pequeno: true, onClick: () => abrir(p), rotulo: 'Editar ' + p.nome }),
        Botao({ texto: p.situacao === 'ativo' ? 'Desativar' : 'Ativar', pequeno: true, onClick: async () => { const r = await comp.alterarSituacaoProduto({ produtoId: p.id, situacao: p.situacao === 'ativo' ? 'inativo' : 'ativo' }); toast(r.ok ? 'Situação do produto atualizada.' : r.message, r.ok ? 'ok' : 'warn'); render(); }, rotulo: (p.situacao === 'ativo' ? 'Desativar ' : 'Ativar ') + p.nome }),
        Botao({ texto: 'Arquivar', pequeno: true, variante: 'ghost', onClick: async () => { await comp.alterarSituacaoProduto({ produtoId: p.id, situacao: 'arquivado' }); toast('Produto arquivado.', 'info'); render(); }, rotulo: 'Arquivar ' + p.nome }))))) : h('div', { class: 'card' }, Vazio({ icone: 'package', titulo: 'Nenhum produto publicado', texto: 'Produtos são opcionais e aparecem como catálogo informativo no perfil público.' })),
    st.dlg === 'produto' ? Dialogo({ id: 'dlg-produto-emp', titulo: st.f.id ? 'Editar produto' : 'Cadastrar produto', ocupado: st.busy, onFechar: () => set(st, { dlg: null }),
      rodape: [Botao({ texto: 'Cancelar', onClick: () => set(st, { dlg: null }) }), Botao({ texto: 'Salvar produto', variante: 'primary', ocupado: st.busy, onClick: salvar })] },
    Campo({ id: 'pr-nome', rotulo: 'Nome', obrigatorio: true, valor: st.f.nome, onInput: v => { st.f.nome = v; }, erro: st.erros.nome, maxlength: 100 }),
    Campo({ id: 'pr-desc', rotulo: 'Descrição', linhas: 3, valor: st.f.descricao, onInput: v => { st.f.descricao = v; }, maxlength: 300 }),
    Campo({ id: 'pr-preco', rotulo: 'Preço (opcional)', valor: st.f.preco, onInput: v => { st.f.preco = v; }, erro: st.erros.preco, ajuda: 'Deixe em branco para “sob consulta”.', inputmode: 'decimal' }),
    Campo({ id: 'pr-disp', rotulo: 'Disponibilidade informada', valor: st.f.disponibilidade, onChange: v => { st.f.disponibilidade = v; }, opcoes: ['Disponível', 'Sob encomenda', 'Indisponível no momento'].map(x => ({ v: x, l: x })) })) : null);
}

export function Clientes({ usuario, empresaId }) {
  const st = estadoView('emp-clientes:' + empresaId, () => ({ dlg: null, f: {}, erros: {}, busy: false }));
  const lista = comp.clientesDaEmpresa(usuario, empresaId);
  const emp = comp.empresaDoUsuario(usuario, empresaId);
  const salvar = async () => {
    set(st, { busy: true });
    const r = await comp.salvarClienteOperacional({ empresaId, ...st.f });
    st.busy = false;
    if (r.ok) { st.dlg = null; toast(r.data.convite ? 'Cliente cadastrado. O convite só vale após a confirmação do cliente.' : 'Cliente cadastrado no registro operacional. Nenhuma conta foi criada.'); } else st.erros = (r.details && r.details.campos) || {};
    render();
  };
  return h('div', { class: 'stack' },
    h('div', { class: 'page-head' }, h('div', null, h('h1', null, 'Clientes e equipamentos'), h('p', null, 'Cadastro operacional da empresa. Dados de conta pessoal dos clientes não são editáveis aqui.')),
      Botao({ texto: 'Cliente atendido fora do catálogo', icone: 'user-plus', variante: 'primary', onClick: () => set(st, { dlg: 'cliente', f: { nome: '', telefone: '', cidade: emp.cidade, convidar: false }, erros: {} }) })),
    Tabela({ id: 'tab-clientes', rotulo: 'Clientes da empresa', estado: st, linhas: lista, placeholder: 'Pesquisar cliente, cidade ou origem...', colunas: [
      { id: 'nome', titulo: 'Cliente', valor: c => c.nome, classe: 'wrap-anywhere' },
      { id: 'cidade', titulo: 'Cidade', valor: c => c.cidade },
      { id: 'eq', titulo: 'Equip.', valor: c => String(c.equipamentos) },
      { id: 'ultimo', titulo: 'Último atendimento', valor: c => c.ultimo || '', render: c => (c.ultimo ? formatarData(c.ultimo, emp.fuso) : '—') },
      { id: 'origem', titulo: 'Origem', valor: c => c.origem }
    ] }),
    st.dlg === 'cliente' ? Dialogo({ id: 'dlg-cliente-op', titulo: 'Cliente atendido fora do catálogo', descricao: 'Cria apenas um registro operacional da empresa. Nenhuma conta é criada; um convite só vale se o cliente confirmar.', ocupado: st.busy, onFechar: () => set(st, { dlg: null }),
      rodape: [Botao({ texto: 'Cancelar', onClick: () => set(st, { dlg: null }) }), Botao({ texto: 'Cadastrar', variante: 'primary', ocupado: st.busy, onClick: salvar })] },
    Campo({ id: 'cli-nome', rotulo: 'Nome', obrigatorio: true, valor: st.f.nome, onInput: v => { st.f.nome = v; }, erro: st.erros.nome, maxlength: 160 }),
    Campo({ id: 'cli-tel', rotulo: 'Telefone', tipo: 'tel', valor: st.f.telefone, onInput: v => { st.f.telefone = v; }, erro: st.erros.telefone }),
    Campo({ id: 'cli-cidade', rotulo: 'Cidade', valor: st.f.cidade, onInput: v => { st.f.cidade = v; } }),
    Check({ id: 'cli-convidar', rotulo: 'Enviar convite para o cliente acompanhar pela EloServ', ajuda: 'Simulado. O cliente decide se aceita.', marcado: st.f.convidar, onChange: v => { st.f.convidar = v; render(); } })) : null);
}

export function Historico({ usuario, empresaId }) {
  const lista = retornosPrevistos(usuario, empresaId);
  return h('div', { class: 'stack' },
    h('div', { class: 'page-head' }, h('div', null, h('h1', null, 'Histórico e retornos'), h('p', null, 'Retornos sugeridos ao concluir ordens de serviço. O contato com o cliente é manual nesta versão.'))),
    lista.length ? h('ul', { class: 'card list' }, lista.map(o => h('li', { key: o.id }, h('a', { class: 'list-item', href: '#/empresas/ordens/' + o.id },
      h('span', { class: 'main' }, h('span', { class: 'strong' }, o.clienteNome), h('span', { class: 'small text2' }, `${o.servicoNome} · ${o.id}`)), h('span', { class: 'small' }, 'Retorno: ' + rotuloMes(o.proximoRetorno))))))
      : h('div', { class: 'card' }, Vazio({ icone: 'clock-counter-clockwise', titulo: 'Nenhum retorno previsto', texto: 'Ao concluir uma ordem, sugira o próximo retorno para ele aparecer aqui.' })));
}

export function Ajuda() {
  const lista = listarArtigos({ publico: 'Empresas' });
  return h('div', { class: 'stack' },
    h('div', { class: 'page-head' }, h('div', null, h('h1', null, 'Ajuda'), h('p', null, 'Os artigos abrem em painel lateral, sem sair da tela atual. ', h('a', { href: '#/ajuda' }, 'Central completa')))),
    h('ul', { class: 'stack-sm' }, lista.map(a => h('li', { key: a.slug }, h('button', { type: 'button', class: 'card stack-xs', style: 'width:100%;text-align:left;color:var(--text)', onClick: () => set(ui, { ajuda: a.slug }) },
      h('span', { class: 'strong', style: 'color:var(--accent-text)' }, a.titulo), h('span', { class: 'small text2' }, `${a.resumo} · Para: ${a.publico}`))))));
}

export function Configuracoes({ usuario, empresaId }) {
  const emp = comp.empresaDoUsuario(usuario, empresaId);
  const pros = comp.profissionaisDaEmpresa(usuario, empresaId).filter(p => ['ativo', 'suspenso'].includes(p.situacao));
  const servicos = comp.servicosDaEmpresa(usuario, empresaId).filter(s => s.situacao !== 'arquivado');
  const base = () => ({ preparoMin: String(emp.preparoMin), validadeReservaH: String(emp.validadeReservaH), fuso: emp.fuso, feriados: emp.feriados.map(f => ({ ...f })), duracoes: Object.fromEntries(servicos.map(s => [s.id, String(s.duracaoMin)])) });
  const st = estadoView('form:emp-config:' + empresaId, () => ({ f: base(), versao: emp.v, busy: false, res: null, novo: { data: '', tipo: 'fechado', ate: '12:00', descricao: '' } }));
  const sujo = JSON.stringify(st.f) !== JSON.stringify(base());
  if (sujo) marcarSujo('Você alterou as configurações da agenda e não salvou.'); else limparSujo();
  const salvar = async () => {
    set(st, { busy: true, res: null });
    const r = await comp.salvarConfiguracoes({ empresaId, ...st.f, versao: st.versao });
    st.busy = false;
    if (r.ok) { limparSujo(); toast('Configurações salvas. Novas disponibilidades já consideram as regras.'); delete ui.views['form:emp-config:' + empresaId]; } else st.res = r;
    render();
  };
  const hoje = dataLocal(agora(), emp.fuso);
  return h('div', { class: 'stack content-narrow' },
    h('div', { class: 'page-head' }, h('div', null, h('h1', null, 'Configurações da agenda'), h('p', null, 'Horário de funcionamento, jornadas, duração por serviço, preparo, validade da reserva, fuso, feriados e exceções.'))),
    st.res ? Alerta({ tipo: 'err', foco: true, titulo: st.res.code === 'CONFLITO_ATUALIZACAO' ? 'As configurações foram alteradas em outra aba' : 'Não foi possível salvar',
      acoes: st.res.code === 'CONFLITO_ATUALIZACAO' ? [Botao({ texto: 'Recarregar configurações', onClick: () => { delete ui.views['form:emp-config:' + empresaId]; limparSujo(); render(); } })] : null }, h('p', null, st.res.message)) : null,
    h('section', { class: 'card stack-sm', 'aria-labelledby': 'cfg-jornadas' }, h('h2', { id: 'cfg-jornadas' }, 'Jornada individual e intervalos'),
      h('p', { class: 'small text2' }, `Funcionamento: ${emp.horarios}`),
      h('ul', { class: 'list' }, pros.map(p => h('li', { class: 'list-item', key: p.id }, h('span', { class: 'main' }, h('span', { class: 'strong' }, p.curto), h('span', { class: 'small text2' }, textoJornada(p.jornada) + ((p.folgas || []).length ? ' · folgas: ' + p.folgas.map(dataBr).join(', ') : ''))),
        h('span', { class: 'row' }, Badge('registro', p.situacao), Botao({ texto: 'Editar jornada', pequeno: true, href: '#/empresas/profissionais/' + p.id, rotulo: 'Editar jornada de ' + p.curto })))))),
    h('section', { class: 'card stack-sm', 'aria-labelledby': 'cfg-dur' }, h('h2', { id: 'cfg-dur' }, 'Duração estimada por serviço'),
      h('div', { class: 'form-grid' }, servicos.map(s => Campo({ id: 'dur-' + s.id, rotulo: `${s.nome} (min)`, tipo: 'number', valor: st.f.duracoes[s.id], onInput: v => { st.f.duracoes[s.id] = v; render(); }, min: '15', max: '600', inputmode: 'numeric' })))),
    h('section', { class: 'card stack-sm', 'aria-labelledby': 'cfg-regras' }, h('h2', { id: 'cfg-regras' }, 'Regras de reserva'),
      h('div', { class: 'form-grid' },
        Campo({ id: 'cfg-preparo', rotulo: 'Preparo/deslocamento entre atendimentos', valor: st.f.preparoMin, onChange: v => { st.f.preparoMin = v; render(); }, opcoes: ['0', '15', '30', '45', '60'].map(v => ({ v, l: v === '0' ? 'Sem intervalo' : v + ' min' })), ajuda: 'Valor fixo informado pela empresa. Não há cálculo automático de rotas.' }),
        Campo({ id: 'cfg-validade', rotulo: 'Validade da reserva temporária', valor: st.f.validadeReservaH, onChange: v => { st.f.validadeReservaH = v; render(); }, opcoes: ['12', '24', '48'].map(v => ({ v, l: v + ' horas' })), ajuda: 'Após o prazo sem resposta, a solicitação expira e libera o horário.' }),
        Campo({ id: 'cfg-fuso', rotulo: 'Fuso horário da empresa', valor: st.f.fuso, onChange: v => { st.f.fuso = v; render(); }, opcoes: FUSOS_DISPONIVEIS.map(([v, l]) => ({ v, l: `${l} · ${rotuloFuso(v).replace(/^Horário de [^(]+/, '')}` })), classe: 'full',
          ajuda: 'Exibido na disponibilidade, revisão, proposta e confirmação. Instantes são armazenados em UTC e convertidos na apresentação. Não assuma que todo Mato Grosso usa o horário de Brasília.' }))),
    h('section', { class: 'card stack-sm', 'aria-labelledby': 'cfg-feriados' }, h('h2', { id: 'cfg-feriados' }, 'Feriados e exceções'),
      st.f.feriados.length ? h('ul', { class: 'list' }, st.f.feriados.map((f, i) => h('li', { class: 'list-item', key: 'fer-' + f.data + i }, h('span', { class: 'main' }, h('span', { class: 'strong' }, `${rotuloDia(f.data).completo} · ${f.descricao || (f.tipo === 'fechado' ? 'Feriado' : 'Exceção manual')}`), h('span', { class: 'small text2' }, f.tipo === 'fechado' ? 'Fechado' : `Atendimento até ${f.ate}`)),
        Botao({ texto: 'Remover', pequeno: true, variante: 'ghost', rotulo: 'Remover ' + dataBr(f.data), onClick: () => { st.f.feriados.splice(i, 1); render(); } })))) : h('p', { class: 'muted small' }, 'Nenhum feriado ou exceção cadastrado.'),
      h('div', { class: 'form-grid' },
        Campo({ id: 'fer-data', rotulo: 'Data', valor: st.novo.data, onChange: v => { st.novo.data = v; render(); }, opcoes: [{ v: '', l: 'Escolher data…' }, ...proximosDias(hoje, 90, { pularDomingo: false }).map(d => ({ v: d, l: rotuloDia(d).completo }))] }),
        Campo({ id: 'fer-tipo', rotulo: 'Tipo', valor: st.novo.tipo, onChange: v => { st.novo.tipo = v; render(); }, opcoes: [{ v: 'fechado', l: 'Fechado (feriado)' }, { v: 'parcial', l: 'Exceção: atendimento até um horário' }] }),
        st.novo.tipo === 'parcial' ? Campo({ id: 'fer-ate', rotulo: 'Atendimento até', valor: st.novo.ate, onChange: v => { st.novo.ate = v; }, opcoes: Array.from({ length: 21 }, (_, i) => minParaHm(8 * 60 + i * 30)).map(t => ({ v: t, l: t })) }) : null,
        Campo({ id: 'fer-desc', rotulo: 'Descrição', valor: st.novo.descricao, onInput: v => { st.novo.descricao = v; }, maxlength: 80 })),
      h('div', null, Botao({ texto: 'Adicionar à lista', icone: 'plus', pequeno: true, desabilitado: !st.novo.data, onClick: () => { st.f.feriados.push({ data: st.novo.data, tipo: st.novo.tipo, ...(st.novo.tipo === 'parcial' ? { ate: st.novo.ate } : {}), descricao: st.novo.descricao.trim() }); st.f.feriados.sort((a, b) => a.data.localeCompare(b.data)); st.novo = { data: '', tipo: 'fechado', ate: '12:00', descricao: '' }; render(); } })),
      h('p', { class: 'xsmall muted' }, 'Feriados são cadastrados manualmente pela empresa nesta versão. Bloqueios e feriados não cancelam atendimentos já confirmados.')),
    h('div', { class: 'row' }, Botao({ texto: 'Salvar configurações', variante: 'primary', ocupado: st.busy, desabilitado: !sujo, onClick: salvar, id: 'cfg-salvar' })));
}
