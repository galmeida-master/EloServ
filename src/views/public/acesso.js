// RF-ACS-01/02/03 · Entrar, cadastro, recuperação de acesso, sessão expirada, acesso negado e permissão insuficiente.
// A autenticação desta demonstração é simulada: nenhuma senha é verificada de verdade.
import { h, Botao, Campo, Check, Alerta, Vazio, icone } from '../../ui/components.js';
import { estadoView, set, render, navegar, toast } from '../../store.js';
import * as auth from '../../api/auth.js';
import { lerConvite, aceitarConvite } from '../../api/companies.js';
import { formatarPrazo } from '../../domain/datas.js';

const ambienteDaRota = r => (r && r.startsWith('/clientes') ? 'clientes' : r && r.startsWith('/empresas') ? 'empresas' : r && r.startsWith('/admin') ? 'admin' : r && r.includes('/solicitar') ? 'clientes' : null);
const destino = (volta, ambiente) => (volta && volta.startsWith('/') && !volta.startsWith('//') ? volta : auth.rotaInicial(ambiente));

export const CONTAS_DEMO = [['ana.demo@exemplo.invalid', 'Ana — cliente'], ['marina.demo@exemplo.invalid', 'Marina — gestora da FrioVale e cliente'], ['carlos.demo@exemplo.invalid', 'Carlos — técnico'],
  ['paulo.demo@exemplo.invalid', 'Paulo — admin operações'], ['lucia.demo@exemplo.invalid', 'Lúcia — admin principal']];

export function Entrar({ query }) {
  const st = estadoView('form:entrar', () => ({ email: 'ana.demo@exemplo.invalid', senha: 'demonstracao', busy: false, erro: null }));
  const volta = query.volta || '';
  const enviar = async e => {
    e.preventDefault();
    if (st.busy) return;
    set(st, { busy: true, erro: null });
    const r = await auth.entrar({ email: st.email, senha: st.senha, ambientePreferido: ambienteDaRota(volta) });
    st.busy = false;
    if (!r.ok) { st.erro = r.message; render(); return; }
    toast('Sessão iniciada (demonstração).', 'info');
    navegar(destino(volta, r.data.ambiente));
  };
  return h('div', { class: 'content-narrow stack', style: 'margin:0 auto;max-width:480px;width:100%' },
    h('div', { class: 'card stack' },
      h('h1', null, 'Entrar'),
      h('p', { class: 'text2' }, 'Acesse sua conta de cliente, empresa ou administração.'),
      volta.includes('/solicitar') ? Alerta({ tipo: 'info' }, h('p', null, 'Depois de entrar, você volta para a revisão da solicitação com os dados preservados.')) : null,
      st.erro ? Alerta({ tipo: 'err', foco: true }, h('p', null, st.erro)) : null,
      h('form', { class: 'stack', onSubmit: enviar, novalidate: true },
        Campo({ id: 'login-email', rotulo: 'E-mail', tipo: 'email', valor: st.email, onInput: v => { st.email = v; }, autocomplete: 'username', obrigatorio: true }),
        Campo({ id: 'login-senha', rotulo: 'Senha', tipo: 'password', valor: st.senha, onInput: v => { st.senha = v; }, autocomplete: 'current-password', obrigatorio: true, ajuda: 'Demonstração: qualquer credencial com 8 ou mais caracteres é aceita.' }),
        Botao({ texto: 'Entrar', variante: 'primary', tipo: 'submit', ocupado: st.busy, textoOcupado: 'Entrando…', bloco: true, id: 'login-enviar' })),
      h('div', { class: 'row-between small' }, h('a', { href: '#/recuperar-acesso' }, 'Recuperar acesso'), h('a', { href: '#/cadastro' + (volta ? '?volta=' + encodeURIComponent(volta) : '') }, 'Criar conta')),
      Alerta({ tipo: 'warn', titulo: 'Contas de demonstração' },
        h('p', { class: 'small' }, 'Os campos já vêm preenchidos e a autenticação não é real. O método definitivo (senha, link por e-mail ou provedor externo) é uma decisão pendente.'),
        h('ul', { class: 'stack-xs small' }, CONTAS_DEMO.map(([e, d]) => h('li', null, h('button', { type: 'button', class: 'link-btn', onClick: () => set(st, { email: e }) }, e), ' — ', d))))));
}

export function Cadastro({ query }) {
  const st = estadoView('form:cadastro', () => ({ tipo: query.tipo === 'empresa' ? 'empresa' : 'cliente', empresaNome: '', cnpj: '', cidade: '', nome: '', email: '', telefone: '', senha: '', termos: false, marketing: false, erros: {}, busy: false, enviado: null }));
  const volta = query.volta || '';
  const campo = (id, rotulo, extra = {}) => Campo({ id: 'cad-' + id, rotulo, valor: st[id], onInput: v => { st[id] = v; if (st.erros[id]) { delete st.erros[id]; render(); } }, erro: st.erros[id], obrigatorio: true, ...extra });
  const enviar = async e => {
    e.preventDefault();
    if (st.busy) return;
    set(st, { busy: true });
    const r = await auth.cadastrar({ ...st });
    st.busy = false;
    if (!r.ok) { st.erros = (r.details && (r.details.campos || r.details)) || {}; st.erroGeral = r.message; render(); queueMicrotask(() => { const el = document.querySelector('[aria-invalid="true"]'); if (el) el.focus(); }); return; }
    if (st.tipo === 'empresa') { st.enviado = r.data; render(); return; }
    toast('Conta criada (demonstração).');
    navegar(destino(volta, 'clientes'));
  };
  if (st.enviado) {
    return h('div', { class: 'content-narrow', style: 'margin:0 auto;max-width:560px;width:100%' }, h('div', { class: 'card stack' },
      h('span', { class: 'badge t-w' }, icone('hourglass'), 'Aguardando habilitação'),
      h('h1', null, 'Cadastro enviado'),
      h('p', null, 'Você poderá completar o perfil, os serviços e a equipe enquanto a análise cadastral acontece. O perfil público só fica visível após a habilitação.'),
      h('p', { class: 'small text2' }, 'Habilitação na EloServ é uma verificação cadastral e não representa certificação técnica.'),
      h('div', { class: 'row' }, Botao({ texto: 'Ir para o ambiente da empresa', variante: 'primary', href: '#/empresas' }))));
  }
  const ehEmpresa = st.tipo === 'empresa';
  return h('div', { class: 'content-narrow', style: 'margin:0 auto;max-width:640px;width:100%' }, h('div', { class: 'card stack' },
    h('h1', null, 'Criar conta'),
    h('div', { class: 'grid-2', role: 'radiogroup', 'aria-label': 'Tipo de conta' },
      [['cliente', 'Quero contratar serviços', 'Conta pessoal para solicitar e acompanhar atendimentos.', 'user'], ['empresa', 'Quero cadastrar minha empresa', 'Para proprietários e gestores de empresas fornecedoras.', 'buildings']].map(([v, t, d, ic]) =>
        h('button', { type: 'button', role: 'radio', class: 'option-card', 'aria-checked': String(st.tipo === v), onClick: () => set(st, { tipo: v, erros: {} }) }, icone(ic, { classe: 'ic-lg' }), h('span', { class: 'stack-xs' }, h('span', { class: 'strong' }, t), h('span', { class: 'small text2' }, d))))),
    st.erroGeral && Object.keys(st.erros).length ? Alerta({ tipo: 'err' }, h('p', null, st.erroGeral)) : null,
    h('form', { class: 'stack', onSubmit: enviar, novalidate: true },
      ehEmpresa ? h('div', { class: 'form-grid' },
        campo('empresaNome', 'Nome da empresa', { classe: 'full', maxlength: 120 }),
        campo('cnpj', 'CNPJ', { placeholder: '00.000.000/0000-00', inputmode: 'numeric', ajuda: 'Use dados fictícios nesta demonstração (ex.: 00.000.000/0000-00).' }),
        campo('cidade', 'Cidade', { maxlength: 80 })) : null,
      h('div', { class: 'form-grid' },
        campo('nome', ehEmpresa ? 'Nome do responsável' : 'Nome', { classe: 'full', autocomplete: 'name', maxlength: 120 }),
        campo('email', 'E-mail', { tipo: 'email', autocomplete: 'email', ajuda: 'Nesta demonstração, use um e-mail fictício terminado em @exemplo.invalid.' }),
        campo('telefone', 'Telefone', { tipo: 'tel', autocomplete: 'tel', placeholder: '(65) 90000-0000', inputmode: 'tel' }),
        campo('senha', 'Senha', { tipo: 'password', autocomplete: 'new-password', classe: 'full', ajuda: 'Mínimo de 8 caracteres. A credencial definitiva depende da solução de autenticação a ser definida.' })),
      ehEmpresa ? null : h('p', { class: 'small text2' }, 'CPF não é solicitado neste cadastro.'),
      Check({ id: 'cad-termos', rotulo: 'Li e aceito os termos de uso e a política de privacidade.', obrigatorio: true, marcado: st.termos, onChange: v => { st.termos = v; delete st.erros.termos; render(); }, erro: st.erros.termos }),
      Check({ id: 'cad-marketing', rotulo: 'Quero receber novidades da EloServ por e-mail.', ajuda: 'Opcional, separado dos termos. Pode ser alterado depois.', marcado: st.marketing, onChange: v => set(st, { marketing: v }) }),
      ehEmpresa ? Alerta({ tipo: 'info' }, h('p', { class: 'small' }, 'Após o cadastro, a empresa fica “Aguardando habilitação” até a análise cadastral. Habilitação não é certificação técnica.')) : null,
      Botao({ texto: 'Criar conta', variante: 'primary', tipo: 'submit', ocupado: st.busy, textoOcupado: 'Criando conta…', bloco: true, id: 'cad-enviar' })),
    h('p', { class: 'small' }, 'Já tem conta? ', h('a', { href: '#/entrar' + (volta ? '?volta=' + encodeURIComponent(volta) : '') }, 'Entrar'))));
}

export function Recuperar() {
  const st = estadoView('form:recuperar', () => ({ email: '', busy: false, msg: null, erro: null }));
  const enviar = async e => {
    e.preventDefault();
    if (st.busy) return;
    set(st, { busy: true, erro: null });
    const r = await auth.recuperarAcesso(st.email);
    st.busy = false;
    if (r.ok) st.msg = r.data.mensagem; else st.erro = r.message;
    render();
  };
  return h('div', { style: 'margin:0 auto;max-width:480px;width:100%' }, h('div', { class: 'card stack' },
    h('h1', null, 'Recuperar acesso'),
    h('p', { class: 'text2' }, 'Informe o e-mail da conta. Enviaremos instruções para criar uma nova credencial.'),
    st.msg ? Alerta({ tipo: 'ok', foco: true }, h('p', null, st.msg)) : h('form', { class: 'stack', onSubmit: enviar, novalidate: true },
      Campo({ id: 'rec-email', rotulo: 'E-mail', tipo: 'email', valor: st.email, onInput: v => { st.email = v; }, erro: st.erro, autocomplete: 'email', obrigatorio: true }),
      Botao({ texto: 'Enviar instruções', variante: 'primary', tipo: 'submit', ocupado: st.busy, textoOcupado: 'Enviando…' })),
    h('a', { href: '#/entrar' }, 'Voltar para entrar')));
}

export function SessaoExpirada({ query }) {
  const volta = query.volta || '';
  return h('div', { style: 'margin:0 auto;max-width:560px;width:100%' }, h('div', { class: 'card' }, Vazio({ nivel: 'h1', icone: 'timer', titulo: 'Sua sessão expirou',
    texto: 'Por segurança, encerramos a sessão após 30 minutos sem atividade. Rascunhos salvos neste dispositivo continuam disponíveis após entrar novamente.',
    acoes: [Botao({ texto: 'Entrar novamente', variante: 'primary', href: '#/entrar' + (volta ? '?volta=' + encodeURIComponent(volta) : ''), onClick: () => auth.sair() })] })));
}

export function AcessoNegadoConteudo({ usuario, motivo }) {
  const s = auth.lerSessao();
  const texto = motivo === 'vinculo_suspenso' ? 'Seu acesso a esta empresa está suspenso ou foi revogado. O histórico de atendimentos continua preservado.'
    : motivo === 'conta_suspensa' ? 'Esta conta está suspensa pela administração da plataforma.'
      : 'O acesso depende dos vínculos e papéis da sua conta. Alterar o endereço da página não concede autorização. Se você precisa deste acesso, peça ao responsável pela empresa ou à administração.';
  return h('div', { style: 'margin:0 auto;max-width:640px;width:100%' }, h('div', { class: 'card' }, Vazio({ nivel: 'h1', icone: 'lock-simple', titulo: 'Você não tem permissão para acessar esta área', texto,
    acoes: [usuario && s ? Botao({ texto: 'Ir para minha área', variante: 'primary', href: '#' + auth.rotaInicial(s.ambiente) }) : Botao({ texto: 'Entrar', variante: 'primary', href: '#/entrar' }),
      Botao({ texto: 'Ajuda sobre permissões', href: '#/ajuda/permissoes-e-acessos' })] })));
}
export const AcessoNegado = ctx => AcessoNegadoConteudo(ctx);

export function PermissaoInsuficiente() {
  return h('div', { class: 'card' }, Vazio({ nivel: 'h1', icone: 'lock-simple', titulo: 'Seu papel não permite acessar esta área',
    texto: 'Permissão insuficiente. Técnicos consultam a própria agenda e os atendimentos atribuídos. Configurações comerciais, equipe e base de clientes são geridas pela gestão da empresa.',
    acoes: [Botao({ texto: 'Ir para minha agenda', variante: 'primary', href: '#/empresas/agenda' }), Botao({ texto: 'Ajuda sobre permissões', href: '#/ajuda/permissoes-e-acessos' })] }));
}

export function NaoEncontrada() {
  return h('div', { class: 'card' }, Vazio({ nivel: 'h1', icone: 'question', titulo: 'Página não encontrada', texto: 'O endereço pode ter mudado ou não existir.', acoes: [Botao({ texto: 'Voltar ao início', href: '#/' })] }));
}

/** Aceite de convite para a equipe (RF-ACS-03: estado “convite expirado”). */
export function Convite({ params }) {
  const c = lerConvite(params.id);
  const st = estadoView('form:convite:' + params.id, () => ({ senha: '', termos: false, erros: {}, busy: false, erro: null }));
  if (c.situacao !== 'valido') {
    return h('div', { style: 'margin:0 auto;max-width:560px;width:100%' }, h('div', { class: 'card' }, Vazio({ nivel: 'h1', icone: 'envelope-simple',
      titulo: c.situacao === 'expirado' ? 'Convite expirado' : 'Convite inválido ou expirado',
      texto: c.situacao === 'expirado' ? `O convite para ${c.empresaNome} expirou. Peça ao responsável pela empresa que reenvie o convite.` : 'Este convite expirou, foi revogado ou não existe. Peça ao responsável pela empresa um novo convite.',
      acoes: [Botao({ texto: 'Ir para o início', href: '#/' })] })));
  }
  const aceitar = async e => {
    e.preventDefault();
    if (st.busy) return;
    set(st, { busy: true, erro: null, erros: {} });
    const r = await aceitarConvite({ profissionalId: params.id, senha: st.senha, termos: st.termos }, { ator: null });
    st.busy = false;
    if (!r.ok) { if (r.code === 'VALIDACAO') st.erros = r.details.campos; else st.erro = r.message; render(); return; }
    auth.entrarComoPersona(r.data.usuarioId);
    toast('Convite aceito. Boas-vindas à equipe.');
    navegar('/empresas/agenda');
  };
  return h('div', { style: 'margin:0 auto;max-width:560px;width:100%' }, h('div', { class: 'card stack' },
    h('h1', null, 'Convite para a equipe'),
    h('p', null, `${c.nome}, você recebeu um convite para a equipe de ${c.empresaNome} como técnico(a).`),
    h('p', { class: 'small text2' }, `O convite vale até ${formatarPrazo(c.expiraEm, c.fuso)}. Técnicos acessam apenas a própria agenda, os atendimentos atribuídos, o registro de execução e a ajuda.`),
    st.erro ? Alerta({ tipo: 'err', foco: true }, h('p', null, st.erro)) : null,
    h('form', { class: 'stack', onSubmit: aceitar, novalidate: true },
      Campo({ id: 'conv-senha', rotulo: 'Crie uma credencial', tipo: 'password', obrigatorio: true, valor: st.senha, onInput: v => { st.senha = v; }, erro: st.erros.senha, autocomplete: 'new-password', ajuda: 'Demonstração: mínimo de 8 caracteres; não há verificação real.' }),
      Check({ id: 'conv-termos', rotulo: 'Li e aceito os termos de uso e a política de privacidade.', obrigatorio: true, marcado: st.termos, onChange: v => set(st, { termos: v }), erro: st.erros.termos }),
      Botao({ texto: 'Aceitar convite', variante: 'primary', tipo: 'submit', ocupado: st.busy, textoOcupado: 'Ativando acesso…' }))));
}
