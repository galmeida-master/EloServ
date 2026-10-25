// Dados demonstrativos (fictícios). Reconstruídos a partir dos textos dos protótipos em docs/.
// Datas são relativas ao dia em que os dados são criados: a “semana de demonstração” são os
// próximos cinco dias úteis. Modelo local do protótipo — não é o esquema de produção.

import { FUSO_PADRAO, HORA, DIA, dataLocal, paraUtc, proximosDiasUteis, somarDias, somarMeses, diaSemanaData } from '../domain/datas.js';
import { ARTIGOS } from './seed-artigos.js';

export const VERSAO_DADOS = 4;

export const PERSONAS = [
  { id: 'visitante', nome: 'Visitante', descricao: 'Sem conta' },
  { id: 'u-ana', nome: 'Ana Ribeiro', descricao: 'Cliente' },
  { id: 'u-marina', nome: 'Marina Duarte', descricao: 'Gestora da FrioVale e cliente' },
  { id: 'u-carlos', nome: 'Carlos Mendes', descricao: 'Técnico da FrioVale' },
  { id: 'u-paulo', nome: 'Paulo Lemos', descricao: 'Admin · Operações' },
  { id: 'u-lucia', nome: 'Lúcia Prado', descricao: 'Admin · Principal' }
];
export const PERSONAS_EXTRAS = [
  { id: 'u-diego', nome: 'Diego Souza', descricao: 'Gestor da Polar Norte (outra empresa)' },
  { id: 'u-rogerio', nome: 'Rogério Nunes', descricao: 'Gestor da Gelo Fino (aguardando habilitação)' },
  { id: 'u-ivete', nome: 'Ivete Costa', descricao: 'Gestora da Clima Norte (cadastro em preenchimento, sem serviços)' },
  { id: 'u-otavio', nome: 'Otávio Ramos', descricao: 'Gestor da Refrigeração Pantanal (empresa suspensa)' },
  { id: 'u-rafael', nome: 'Rafael Teixeira', descricao: 'Técnico da FrioVale' }
];

const J_PADRAO = { dias: [1, 2, 3, 4, 5], inicio: '07:30', fim: '17:30', intervalo: { inicio: '12:00', fim: '13:00' } };
const J_RAFAEL = { dias: [1, 2, 3, 4, 5], inicio: '08:00', fim: '17:00', intervalo: { inicio: '12:00', fim: '13:00' } };

const FERIADOS_FIXOS = [['01-01', 'Confraternização Universal'], ['04-21', 'Tiradentes'], ['05-01', 'Dia do Trabalho'], ['09-07', 'Independência do Brasil'],
  ['10-12', 'Nossa Senhora Aparecida'], ['11-02', 'Finados'], ['11-15', 'Proclamação da República'], ['11-20', 'Dia Nacional de Zumbi e da Consciência Negra'], ['12-25', 'Natal']];

function feriadosProximos(hoje) {
  const ano = Number(hoje.slice(0, 4));
  const lista = [];
  for (const a of [ano, ano + 1]) for (const [md, descricao] of FERIADOS_FIXOS) {
    const data = `${a}-${md}`;
    if (data > hoje && data <= somarDias(hoje, 120)) lista.push({ data, tipo: 'fechado', descricao });
  }
  // Exceção manual demonstrativa: uma sexta-feira com atendimento só pela manhã.
  let d = somarDias(hoje, 21);
  while (diaSemanaData(d) !== 5 || lista.some(f => f.data === d)) d = somarDias(d, 1);
  lista.push({ data: d, tipo: 'parcial', ate: '12:00', descricao: 'Exceção manual — atendimento até 12:00' });
  return lista.sort((a, b) => a.data.localeCompare(b.data));
}

export function criarDadosDemonstrativos(agora) {
  const F = FUSO_PADRAO;
  const hoje = dataLocal(agora, F);
  const feriados = feriadosProximos(hoje);
  const dias = proximosDiasUteis(hoje, 5, feriados.filter(f => f.tipo === 'fechado').map(f => f.data));
  const iso = ms => new Date(ms).toISOString();
  const em = (i, hm) => iso(paraUtc(dias[i], hm, F));
  const noDia = (n, hm) => iso(paraUtc(somarDias(hoje, n), hm, F));
  const antes = h => iso(agora - h * HORA);
  const min = (...xs) => iso(Math.min(...xs.map(x => Date.parse(x))));
  const tl = (quando, texto) => ({ quando, texto });
  const v = 1;
  const r = obj => ({ ...obj, v });
  let tel = 0;

  // ---------- Usuários ----------
  const usuario = (id, nome, email, vinculos, rotuloPapel, extra = {}) => r({ id, nome, email, telefone: '(65) 90000-' + String(1000 + (++tel)).slice(-4), situacao: 'ativo', vinculos, rotuloPapel, criadoEm: antes(24 * 60), preferencias: { emailAtendimentos: true, marketing: false }, ...extra });
  const usuarios = [
    usuario('u-ana', 'Ana Ribeiro', 'ana.demo@exemplo.invalid', [{ tipo: 'cliente' }], 'cliente'),
    usuario('u-marina', 'Marina Duarte', 'marina.demo@exemplo.invalid', [{ tipo: 'empresa', empresaId: 'friovale', papel: 'gestor', situacao: 'ativo' }, { tipo: 'cliente' }], 'gestora, FrioVale'),
    usuario('u-carlos', 'Carlos Mendes', 'carlos.demo@exemplo.invalid', [{ tipo: 'empresa', empresaId: 'friovale', papel: 'tecnico', profissionalId: 'p-carlos', situacao: 'ativo' }], 'técnico, FrioVale'),
    usuario('u-juliana', 'Juliana Rocha', 'juliana.demo@exemplo.invalid', [{ tipo: 'empresa', empresaId: 'friovale', papel: 'tecnico', profissionalId: 'p-juliana', situacao: 'ativo' }], 'técnica, FrioVale'),
    usuario('u-rafael', 'Rafael Teixeira', 'rafael.demo@exemplo.invalid', [{ tipo: 'empresa', empresaId: 'friovale', papel: 'tecnico', profissionalId: 'p-rafael', situacao: 'ativo' }], 'técnico, FrioVale'),
    usuario('u-paulo', 'Paulo Lemos', 'paulo.demo@exemplo.invalid', [{ tipo: 'admin', nivel: 'operacoes' }], 'admin operações'),
    usuario('u-lucia', 'Lúcia Prado', 'lucia.demo@exemplo.invalid', [{ tipo: 'admin', nivel: 'principal' }], 'admin principal'),
    usuario('u-convite-suporte', 'Convite de suporte', 'suporte.demo@exemplo.invalid', [{ tipo: 'admin', nivel: 'suporte' }], 'admin suporte', { situacao: 'convite', conviteExpiraEm: noDia(5, '18:00') }),
    usuario('u-diego', 'Diego Souza', 'diego.demo@exemplo.invalid', [{ tipo: 'empresa', empresaId: 'polar-norte', papel: 'gestor', situacao: 'ativo' }], 'gestor, Polar Norte'),
    usuario('u-clara', 'Clara Borges', 'clara.demo@exemplo.invalid', [{ tipo: 'empresa', empresaId: 'brisa-serrana', papel: 'gestor', situacao: 'ativo' }], 'gestora, Brisa Serrana'),
    usuario('u-marcos', 'Marcos Alves', 'marcos.demo@exemplo.invalid', [{ tipo: 'empresa', empresaId: 'termo-leste', papel: 'gestor', situacao: 'ativo' }], 'gestor, Termo Leste'),
    usuario('u-rogerio', 'Rogério Nunes', 'rogerio.demo@exemplo.invalid', [{ tipo: 'empresa', empresaId: 'gelo-fino', papel: 'gestor', situacao: 'ativo' }], 'gestor, Gelo Fino'),
    usuario('u-ivete', 'Ivete Costa', 'ivete.demo@exemplo.invalid', [{ tipo: 'empresa', empresaId: 'clima-norte', papel: 'gestor', situacao: 'ativo' }], 'gestora, Clima Norte'),
    usuario('u-otavio', 'Otávio Ramos', 'otavio.demo@exemplo.invalid', [{ tipo: 'empresa', empresaId: 'pantanal', papel: 'gestor', situacao: 'ativo' }], 'gestor, Refrigeração Pantanal'),
    usuario('u-roberto', 'Roberto Campos', 'roberto.demo@exemplo.invalid', [{ tipo: 'cliente' }], 'cliente'),
    usuario('u-brasa', 'Hamburgueria Brasa (fictícia)', 'brasa.demo@exemplo.invalid', [{ tipo: 'cliente' }], 'cliente'),
    usuario('u-denise', 'Denise Vieira', 'denise.demo@exemplo.invalid', [{ tipo: 'cliente' }], 'cliente')
  ];

  // ---------- Empresas ----------
  const analiseOk = { cnpj: true, resp: true, svc: true, pol: true, pub: true };
  const POLITICAS = ['Cancelamento sem custo até 12 horas antes do horário confirmado.', 'Após esse prazo, a empresa pode cobrar a visita conforme informado na proposta.', 'Valores “a partir de” e “sob orçamento” são definidos na proposta.'];
  const empresa = (id, nome, cidade, area, categorias, modalidades, situacao, extra = {}) => r({
    id, slug: id, nome, razaoSocial: nome + ' Ltda. (fictícia)', cnpj: '00.000.000/0000-00', cidade, area, categorias, modalidades, situacao,
    descricao: '', horarios: 'Seg a sex 07:30–17:30', contatoPublico: { telefone: '(65) 0000-0000', email: `contato@${id}.exemplo.invalid` },
    contatoPrivado: { responsavel: '', email: '' }, fuso: F, preparoMin: 30, validadeReservaH: 24, jornadaPadrao: J_PADRAO, feriados: [],
    politicas: POLITICAS, dataCadastro: antes(24 * 40), dataHabilitacao: antes(24 * 38), analise: analiseOk, justificativa: '', ...extra
  });
  const empresas = [
    empresa('friovale', 'FrioVale Climatização', 'Cuiabá', ['Cuiabá', 'Várzea Grande'], ['Climatização residencial', 'Refrigeração comercial'], ['Residencial', 'Comercial'], 'ativa', {
      descricao: 'Equipe de três técnicos dedicada a instalação, higienização e manutenção de ar-condicionado split em residências e pequenos comércios.',
      horarios: 'Seg a sex 07:30–17:30 · Sáb 08:00–12:00 (somente atendimento por telefone)',
      contatoPublico: { telefone: '(65) 0000-0001', email: 'contato@friovale.exemplo.invalid' },
      contatoPrivado: { responsavel: 'Marina Duarte', email: 'marina.demo@exemplo.invalid' },
      feriados, dataCadastro: antes(24 * 52), dataHabilitacao: antes(24 * 52)
    }),
    empresa('polar-norte', 'Polar Norte Refrigeração', 'Sinop', ['Sinop', 'Sorriso', 'Lucas do Rio Verde'], ['Refrigeração comercial'], ['Comercial'], 'ativa', {
      descricao: 'Manutenção de balcões refrigerados e câmaras frias para mercados, padarias e restaurantes.', contatoPublico: { telefone: '(66) 0000-0002', email: 'contato@polar-norte.exemplo.invalid' },
      contatoPrivado: { responsavel: 'Diego Souza', email: 'diego.demo@exemplo.invalid' }, dataCadastro: antes(24 * 44), dataHabilitacao: antes(24 * 43)
    }),
    empresa('brisa-serrana', 'Brisa Serrana Ar-Condicionado', 'Rondonópolis', ['Rondonópolis'], ['Climatização residencial'], ['Residencial'], 'ativa', {
      descricao: 'Instalação e higienização de ar-condicionado em residências.', contatoPublico: { telefone: '(66) 0000-0003', email: 'contato@brisa-serrana.exemplo.invalid' },
      contatoPrivado: { responsavel: 'Clara Borges', email: 'clara.demo@exemplo.invalid' }, dataCadastro: antes(24 * 36), dataHabilitacao: antes(24 * 35)
    }),
    empresa('termo-leste', 'Termo Leste Climatização e Refrigeração Residencial e Comercial', 'Barra do Garças', ['Barra do Garças', 'Aragarças (GO)'], ['Climatização residencial', 'Refrigeração comercial'], ['Residencial', 'Comercial'], 'ativa', {
      descricao: 'Atende Barra do Garças e Aragarças (GO). Os horários exibidos seguem o fuso da empresa (Cuiabá), inclusive para atendimentos em Goiás.',
      contatoPublico: { telefone: '(66) 0000-0004', email: 'contato@termo-leste.exemplo.invalid' }, contatoPrivado: { responsavel: 'Marcos Alves', email: 'marcos.demo@exemplo.invalid' },
      dataCadastro: antes(24 * 29), dataHabilitacao: antes(24 * 29)
    }),
    empresa('gelo-fino', 'Gelo Fino Refrigeração', 'Tangará da Serra', ['Tangará da Serra'], ['Refrigeração comercial', 'Climatização residencial'], ['Residencial', 'Comercial'], 'aguardando', {
      descricao: 'Higienização e manutenção preventiva de equipamentos residenciais e comerciais.', contatoPublico: { telefone: '(65) 0000-0005', email: 'contato@gelo-fino.exemplo.invalid' },
      contatoPrivado: { responsavel: 'Rogério Nunes', email: 'rogerio.demo@exemplo.invalid' }, dataCadastro: antes(24 * 3), dataHabilitacao: null,
      analise: { cnpj: false, resp: false, svc: false, pol: false, pub: false }
    }),
    empresa('clima-norte', 'Clima Norte Serviços', 'Sorriso', ['Sorriso'], ['Climatização residencial'], ['Residencial'], 'preenchimento', {
      contatoPrivado: { responsavel: 'Ivete Costa', email: 'ivete.demo@exemplo.invalid' }, dataCadastro: antes(24 + 3), dataHabilitacao: null, analise: { cnpj: false, resp: false, svc: false, pol: false, pub: false }, politicas: []
    }),
    empresa('pantanal', 'Refrigeração Pantanal', 'Cáceres', ['Cáceres'], ['Refrigeração comercial'], ['Comercial'], 'suspensa', {
      descricao: 'Manutenção de refrigeração comercial.', contatoPrivado: { responsavel: 'Otávio Ramos', email: 'otavio.demo@exemplo.invalid' },
      dataCadastro: antes(24 * 80), dataHabilitacao: antes(24 * 78), justificativa: 'Dados cadastrais divergentes; aguardando correção pelo responsável.'
    }),
    empresa('ar-leve', 'Ar Leve Climatização', 'Primavera do Leste', ['Primavera do Leste'], ['Climatização residencial'], ['Residencial'], 'arquivada', {
      contatoPrivado: { responsavel: 'Sem responsável ativo', email: '' }, dataCadastro: antes(24 * 104), dataHabilitacao: antes(24 * 100)
    })
  ];

  // ---------- Serviços ----------
  const servico = (id, empresaId, nome, duracaoMin, tipoPreco, precoCentavos, descricao, observacao, extra = {}) => r({ id, empresaId, nome, duracaoMin, tipoPreco, precoCentavos, descricao, observacao, local: 'No endereço do cliente', situacao: 'ativo', usos: 0, moderacao: null, ...extra });
  const OBS = {
    hig: 'Valor para equipamentos de até 12.000 BTUs. Capacidades maiores são orçadas na proposta.',
    prev: 'Inclui avaliação; substituição de peças, se necessária, é orçada à parte.',
    inst: 'O valor final depende da infraestrutura do local e é definido após avaliação. A duração pode mudar.',
    diag: 'Há cobrança de visita técnica de R$ 90,00, descontada se o reparo for contratado.'
  };
  const DESC = {
    hig: 'Limpeza de filtros, serpentina e bandeja, com aplicação de produto bactericida.',
    prev: 'Verificação elétrica, limpeza técnica, dreno e medição de funcionamento.',
    inst: 'Instalação de split hi-wall com até 3 m de tubulação.',
    diag: 'Avaliação do problema e orientação sobre o reparo.'
  };
  const servicos = [
    servico('sv-fv-hig', 'friovale', 'Higienização de split', 90, 'fixo', 18000, DESC.hig, OBS.hig, { usos: 14 }),
    servico('sv-fv-prev', 'friovale', 'Manutenção preventiva', 120, 'fixo', 22000, DESC.prev, OBS.prev, { usos: 11 }),
    servico('sv-fv-inst', 'friovale', 'Instalação de split', 180, 'a_partir', 45000, DESC.inst, OBS.inst, { usos: 6 }),
    servico('sv-fv-diag', 'friovale', 'Diagnóstico técnico', 60, 'orcamento', null, DESC.diag, OBS.diag, { usos: 4, visitaCentavos: 9000 }),
    servico('sv-fv-camara', 'friovale', 'Manutenção de câmara fria', 120, 'orcamento', null, 'Manutenção preventiva de câmaras frias de pequeno porte.', 'Disponibilidade sujeita à avaliação técnica.', { situacao: 'inativo', usos: 2 }),
    servico('sv-fv-gas', 'friovale', 'Recarga de gás (serviço antigo)', 60, 'orcamento', null, 'Serviço substituído pela manutenção preventiva.', '', { situacao: 'arquivado', usos: 9 }),
    servico('sv-pn-balcao', 'polar-norte', 'Manutenção de balcão refrigerado', 120, 'a_partir', 28000, 'Limpeza do condensador, verificação de vedação e temperatura.', 'O valor final depende do tamanho do equipamento.'),
    servico('sv-pn-camara', 'polar-norte', 'Manutenção de câmara fria', 180, 'orcamento', null, 'Inspeção e manutenção preventiva de câmaras frias.', 'Visita de avaliação combinada na proposta.'),
    servico('sv-pn-diag', 'polar-norte', 'Diagnóstico técnico', 60, 'orcamento', null, DESC.diag, 'Visita técnica cobrada conforme a proposta.'),
    servico('sv-bs-hig', 'brisa-serrana', 'Higienização “com certificado de qualidade”', 90, 'fixo', 17000, DESC.hig, '', { moderacao: { situacao: 'revisar', motivo: 'Menciona certificação não comprovada.' } }),
    servico('sv-bs-inst', 'brisa-serrana', 'Instalação de split', 180, 'a_partir', 42000, DESC.inst, OBS.inst),
    servico('sv-tl-hig', 'termo-leste', 'Higienização de split', 90, 'fixo', 17500, DESC.hig, OBS.hig),
    servico('sv-tl-prev', 'termo-leste', 'Manutenção preventiva', 120, 'fixo', 21000, DESC.prev, OBS.prev),
    servico('sv-tl-diag', 'termo-leste', 'Diagnóstico técnico', 60, 'orcamento', null, DESC.diag, 'Visita técnica cobrada conforme a proposta.'),
    servico('sv-gf-hig', 'gelo-fino', 'Higienização de split', 90, 'fixo', 16000, DESC.hig, OBS.hig),
    servico('sv-gf-prev', 'gelo-fino', 'Manutenção preventiva', 120, 'a_partir', 20000, DESC.prev, OBS.prev),
    servico('sv-pt-balcao', 'pantanal', 'Manutenção de balcão refrigerado', 120, 'a_partir', 26000, 'Manutenção preventiva de balcões.', ''),
    servico('sv-pt-camara', 'pantanal', 'Manutenção de câmara fria', 180, 'orcamento', null, 'Manutenção de câmaras frias.', ''),
    servico('sv-pt-diag', 'pantanal', 'Diagnóstico técnico', 60, 'orcamento', null, DESC.diag, '')
  ];

  const produtos = [
    r({ id: 'pr-fv-1', empresaId: 'friovale', nome: 'Controle remoto universal para split', descricao: 'Compatível com a maioria dos modelos hi-wall. Configuração no atendimento.', precoCentavos: 8990, disponibilidade: 'Disponível', situacao: 'ativo' }),
    r({ id: 'pr-fv-2', empresaId: 'friovale', nome: 'Suporte para condensadora 400 mm', descricao: 'Par de suportes em aço com tratamento contra corrosão.', precoCentavos: null, disponibilidade: 'Disponível', situacao: 'ativo' }),
    r({ id: 'pr-fv-3', empresaId: 'friovale', nome: 'Filtro de ar para split 12.000 BTUs', descricao: 'Filtro de reposição. Confirme o modelo antes da compra.', precoCentavos: 3500, disponibilidade: 'Indisponível no momento', situacao: 'ativo' })
  ];

  // ---------- Profissionais ----------
  const pro = (id, empresaId, nome, curto, funcao, servicosIds, extra = {}) => r({ id, empresaId, nome, curto, funcao, servicos: servicosIds, situacao: 'ativo', jornada: J_PADRAO, folgas: [], usuarioId: null, email: '', publico: null, historico: [], ...extra });
  const profissionais = [
    pro('p-carlos', 'friovale', 'Carlos Mendes', 'Carlos M.', 'Técnico', ['sv-fv-hig', 'sv-fv-prev', 'sv-fv-inst', 'sv-fv-diag'], { usuarioId: 'u-carlos', email: 'carlos.demo@exemplo.invalid', publico: 'Técnico em climatização', historico: [tl(antes(24 * 50), 'Vinculado à FrioVale como técnico.')] }),
    pro('p-juliana', 'friovale', 'Juliana Rocha', 'Juliana R.', 'Técnica', ['sv-fv-hig', 'sv-fv-prev', 'sv-fv-diag'], { usuarioId: 'u-juliana', email: 'juliana.demo@exemplo.invalid', publico: 'Técnica em refrigeração', historico: [tl(antes(24 * 48), 'Vinculada à FrioVale como técnica.')] }),
    pro('p-rafael', 'friovale', 'Rafael Teixeira', 'Rafael T.', 'Técnico', ['sv-fv-inst', 'sv-fv-hig', 'sv-fv-prev'], { usuarioId: 'u-rafael', email: 'rafael.demo@exemplo.invalid', jornada: J_RAFAEL, folgas: [dias[1]], historico: [tl(antes(24 * 4), 'Jornada atualizada por Marina D.'), tl(antes(24 * 45), 'Vinculado à FrioVale como técnico.')] }),
    pro('p-bruno', 'friovale', 'Bruno Lima', 'Bruno L.', 'Técnico', ['sv-fv-hig'], { situacao: 'convite', email: 'bruno.demo@exemplo.invalid', jornada: null, conviteEm: antes(24 * 4), conviteExpiraEm: iso(agora - 4 * DIA + 7 * DIA) }),
    pro('p-sergio', 'polar-norte', 'Sérgio Pires', 'Sérgio P.', 'Técnico', ['sv-pn-balcao', 'sv-pn-camara', 'sv-pn-diag'], { publico: 'Técnico em refrigeração comercial' }),
    pro('p-helena', 'brisa-serrana', 'Helena Martins', 'Helena M.', 'Técnica', ['sv-bs-hig', 'sv-bs-inst'], { publico: 'Técnica em climatização' }),
    pro('p-vitor', 'termo-leste', 'Vítor Santos', 'Vítor S.', 'Técnico', ['sv-tl-hig', 'sv-tl-prev', 'sv-tl-diag'], { publico: 'Técnico em climatização' }),
    pro('p-igor', 'gelo-fino', 'Igor Tavares', 'Igor T.', 'Técnico', ['sv-gf-hig', 'sv-gf-prev']),
    pro('p-sonia', 'pantanal', 'Sônia Lopes', 'Sônia L.', 'Técnica', ['sv-pt-balcao', 'sv-pt-camara', 'sv-pt-diag'])
  ];

  // ---------- Ocupações, ordens e solicitações ----------
  const ocupacoes = [];
  const ordens = [];
  const oc = (id, profissionalId, inicio, fim, estado, extra = {}) => { const o = r({ id, empresaId: 'friovale', profissionalId, inicio, fim, estado, expiraEm: null, solicitacaoId: null, ordemId: null, motivo: '', rotulo: '', pendente: false, ...extra }); ocupacoes.push(o); return o; };
  const os = (id, ocupacaoId, profissionalId, servicoId, clienteNome, equipamento, relato, extra = {}) => {
    const o = ocupacoes.find(x => x.id === ocupacaoId);
    const reg = r({ id, empresaId: 'friovale', ocupacaoId, profissionalId, servicoId, clienteNome, clienteId: null, solicitacaoId: null, equipamento, relato, observacoes: '', trabalho: '', proximoRetorno: '', estado: 'agendada', inicio: o ? o.inicio : null, fim: o ? o.fim : null, historico: [tl(antes(24 * 3), 'Agendamento confirmado pelo cliente.')], ...extra });
    if (o) o.ordemId = id;
    ordens.push(reg);
    return reg;
  };
  oc('oc-2201', 'p-carlos', em(0, '08:00'), em(0, '09:30'), 'confirmada');
  oc('oc-2202', 'p-juliana', em(0, '10:00'), em(0, '12:00'), 'confirmada');
  oc('oc-2203', 'p-rafael', em(0, '13:30'), em(0, '16:30'), 'confirmada');
  oc('oc-1040', 'p-carlos', em(0, '13:30'), em(0, '15:30'), 'temporaria', { solicitacaoId: 'SOL-1040', expiraEm: min(noDia(1, '18:00'), iso(Date.parse(em(0, '13:30')) - 2 * HORA)) });
  oc('oc-2204', 'p-carlos', em(1, '08:00'), em(1, '10:00'), 'confirmada');
  oc('oc-2206', 'p-juliana', em(1, '13:30'), em(1, '14:30'), 'confirmada');
  const validade1038 = min(noDia(3, '18:00'), iso(Date.parse(em(2, '13:30')) - 18 * HORA));
  oc('oc-1038', 'p-carlos', em(2, '13:30'), em(2, '15:30'), 'temporaria', { solicitacaoId: 'SOL-1038', expiraEm: validade1038 });
  oc('oc-2209', 'p-juliana', em(2, '08:00'), em(2, '09:30'), 'confirmada');
  oc('oc-2207', 'p-rafael', em(2, '08:30'), em(2, '11:30'), 'confirmada');
  oc('oc-2205', 'p-carlos', em(3, '08:00'), em(3, '09:30'), 'confirmada', { solicitacaoId: 'SOL-1027' });
  oc('oc-2208', 'p-rafael', em(3, '13:30'), em(3, '15:00'), 'confirmada');
  oc('oc-blq-08', 'p-juliana', em(4, '07:30'), em(4, '17:30'), 'bloqueio', { rotulo: 'BLQ-08', motivo: 'Treinamento interno' });
  // Passado
  oc('oc-2190', 'p-juliana', noDia(-9, '08:00'), noDia(-9, '10:00'), 'confirmada');
  oc('oc-2188', 'p-carlos', noDia(-11, '14:00'), noDia(-11, '15:00'), 'liberada');
  oc('oc-2172', 'p-carlos', noDia(-30, '08:00'), noDia(-30, '09:30'), 'confirmada');
  oc('oc-2165', 'p-juliana', noDia(-34, '10:00'), noDia(-34, '12:00'), 'confirmada');
  oc('oc-1033', 'p-juliana', noDia(-4, '08:00'), noDia(-4, '09:30'), 'liberada', { solicitacaoId: 'SOL-1033' });
  oc('oc-1031', 'p-juliana', noDia(-5, '10:00'), noDia(-5, '11:00'), 'liberada', { solicitacaoId: 'SOL-1031' });
  // Empresa suspensa: atendimento confirmado mantido para tratamento
  ocupacoes.push(r({ id: 'oc-2150', empresaId: 'pantanal', profissionalId: 'p-sonia', inicio: em(1, '09:00'), fim: em(1, '11:00'), estado: 'confirmada', expiraEm: null, solicitacaoId: null, ordemId: 'OS-2150', motivo: '', rotulo: '', pendente: false }));

  os('OS-2201', 'oc-2201', 'p-carlos', 'sv-fv-hig', 'Pedro S.', 'Split 9.000 BTUs · Quarto', 'Higienização semestral.');
  os('OS-2202', 'oc-2202', 'p-juliana', 'sv-fv-prev', 'Mercado Bom Preço (fictício)', 'Split piso-teto 24.000 BTUs · Salão', 'Manutenção preventiva trimestral.');
  os('OS-2203', 'oc-2203', 'p-rafael', 'sv-fv-inst', 'Luíza F.', 'Split 12.000 BTUs · Quarto (novo)', 'Instalação com infraestrutura pronta.');
  os('OS-2204', 'oc-2204', 'p-carlos', 'sv-fv-prev', 'Restaurante Sabor (fictício)', 'Split 18.000 BTUs · Salão', 'Aparelho perdendo rendimento nos horários de pico.');
  os('OS-2206', 'oc-2206', 'p-juliana', 'sv-fv-diag', 'Marcos P.', 'Split 9.000 BTUs · Escritório', 'Aparelho liga e desliga sozinho.');
  os('OS-2209', 'oc-2209', 'p-juliana', 'sv-fv-hig', 'Teresa A.', 'Split 12.000 BTUs · Quarto', 'Higienização semestral.');
  os('OS-2207', 'oc-2207', 'p-rafael', 'sv-fv-inst', 'Clínica Vida (fictícia)', 'Split 24.000 BTUs · Recepção (novo)', 'Instalação em parede de alvenaria.');
  os('OS-2205', 'oc-2205', 'p-carlos', 'sv-fv-hig', 'Ana R.', 'Split 12.000 BTUs · Sala', 'Higienização semestral.', { clienteId: 'u-ana', solicitacaoId: 'SOL-1027', historico: [tl(antes(24 * 11), 'Criada a partir de SOL-1027 após confirmação do cliente.')] });
  os('OS-2208', 'oc-2208', 'p-rafael', 'sv-fv-hig', 'Jorge M.', 'Split 9.000 BTUs · Sala', 'Higienização anual.');
  os('OS-2190', 'oc-2190', 'p-juliana', 'sv-fv-prev', 'Teresa A.', 'Split 12.000 BTUs · Quarto', 'Manutenção semestral.', {
    estado: 'concluida', trabalho: 'Limpeza técnica, verificação de pressão e dreno. Funcionamento normal.', observacoes: 'Cliente pediu aviso por telefone antes do próximo retorno.', proximoRetorno: somarMeses(hoje, 6),
    historico: [tl(noDia(-9, '07:55'), 'Execução iniciada por Juliana R.'), tl(noDia(-9, '10:05'), 'Concluída por Juliana R. Próximo retorno sugerido.')]
  });
  os('OS-2188', 'oc-2188', 'p-carlos', 'sv-fv-diag', 'Pedro S.', 'Split 9.000 BTUs', '', { estado: 'cancelada', observacoes: 'Cancelada pelo cliente com 24 h de antecedência.', historico: [tl(noDia(-12, '13:00'), 'Cancelada a pedido do cliente. Horário liberado.')] });
  os('OS-2172', 'oc-2172', 'p-carlos', 'sv-fv-hig', 'Pedro S.', 'Split 9.000 BTUs · Sala', 'Higienização.', { estado: 'concluida', trabalho: 'Higienização completa.', proximoRetorno: somarMeses(hoje, 1), historico: [tl(noDia(-30, '09:35'), 'Concluída por Carlos M.')] });
  os('OS-2165', 'oc-2165', 'p-juliana', 'sv-fv-prev', 'Mercado Bom Preço (fictício)', 'Balcão refrigerado', 'Preventiva.', { estado: 'concluida', trabalho: 'Preventiva realizada.', proximoRetorno: somarMeses(hoje, 1), historico: [tl(noDia(-34, '12:05'), 'Concluída por Juliana R.')] });
  ordens.push(r({ id: 'OS-2150', empresaId: 'pantanal', ocupacaoId: 'oc-2150', profissionalId: 'p-sonia', servicoId: 'sv-pt-balcao', clienteNome: 'Padaria Central (fictícia)', clienteId: null, solicitacaoId: null, equipamento: 'Balcão refrigerado', relato: 'Preventiva.', observacoes: '', trabalho: '', proximoRetorno: '', estado: 'agendada', inicio: em(1, '09:00'), fim: em(1, '11:00'), historico: [tl(antes(24 * 20), 'Agendamento confirmado pelo cliente.')] }));

  const local = (rotulo, bairro, cidade) => ({ rotulo, bairro, cidade, referencia: '' });
  const solicitacao = (id, extra) => r({ empresaId: 'friovale', id, clienteId: null, clienteNome: '', servicoId: '', equipamento: '', local: null, descricao: '', inicioDesejado: null, estado: 'enviada', ocupacaoId: null, ordemId: null, proposta: null, reagendamento: null, ajuste: '', motivoEncerramento: '', criadaEm: antes(1), linhaDoTempo: [], ...extra });
  const solicitacoes = [
    solicitacao('SOL-1040', {
      clienteId: 'u-roberto', clienteNome: 'Roberto C.', servicoId: 'sv-fv-prev', equipamento: 'Split 18.000 BTUs · Escritório', local: local('Escritório', 'Centro-Sul', 'Cuiabá'),
      descricao: 'Aparelho do escritório desliga sozinho depois de uns 30 minutos ligado. Já trocamos as pilhas do controle.', inicioDesejado: em(0, '13:30'), estado: 'em_analise', ocupacaoId: 'oc-1040', criadaEm: antes(2),
      linhaDoTempo: [tl(antes(2), 'Solicitação recebida. Reserva temporária criada.'), tl(antes(1), 'Marina D. iniciou a análise.')]
    }),
    solicitacao('SOL-1038', {
      clienteId: 'u-ana', clienteNome: 'Ana R.', servicoId: 'sv-fv-prev', equipamento: 'Split 12.000 BTUs · Sala', local: local('Casa', 'Jardim Itália', 'Cuiabá'),
      descricao: 'Aparelho da sala está fazendo barulho e pingando água na parede.', inicioDesejado: em(2, '13:30'), estado: 'proposta', ocupacaoId: 'oc-1038', criadaEm: antes(49),
      proposta: {
        profissionalId: 'p-carlos', inicio: em(2, '13:30'), fim: em(2, '15:30'), validadeEm: validade1038, enviadaEm: antes(26),
        itens: [{ descricao: 'Manutenção preventiva — split 12.000 BTUs', valorCentavos: 22000 }, { descricao: 'Substituição de filtro, somente se necessária após avaliação', valorCentavos: 3500, opcional: true }],
        condicoes: 'Pagamento combinado diretamente com a empresa após o atendimento. A EloServ não processa pagamentos.', observacoes: 'Deixar acesso livre à condensadora na área externa.'
      },
      linhaDoTempo: [tl(antes(49), 'Solicitação enviada. Reserva temporária criada.'), tl(antes(44), 'Empresa iniciou a análise.'), tl(antes(26), 'Proposta enviada com Carlos M.')]
    }),
    solicitacao('SOL-1035', {
      clienteId: 'u-brasa', clienteNome: 'Hamburgueria Brasa (fictícia)', servicoId: 'sv-fv-diag', equipamento: 'Split piso-teto 36.000 BTUs', local: local('Loja', 'Porto', 'Cuiabá'),
      descricao: 'Equipamento de 36.000 BTUs não gela desde a semana passada.', estado: 'recusada', criadaEm: antes(24 * 5), motivoEncerramento: 'Equipamento fora da capacidade atendida pela equipe.',
      linhaDoTempo: [tl(antes(24 * 5), 'Solicitação recebida sem horário definido.'), tl(antes(24 * 4), 'Recusada: equipamento fora da capacidade atendida pela equipe.')]
    }),
    solicitacao('SOL-1033', {
      clienteId: 'u-denise', clienteNome: 'Denise V.', servicoId: 'sv-fv-hig', equipamento: 'Split 9.000 BTUs', local: local('Casa', 'Cristo Rei', 'Várzea Grande'),
      descricao: 'Higienização anual do aparelho do quarto.', inicioDesejado: noDia(-4, '08:00'), estado: 'expirada', ocupacaoId: 'oc-1033', criadaEm: antes(24 * 8),
      linhaDoTempo: [tl(antes(24 * 8), 'Solicitação recebida.'), tl(antes(24 * 7), 'Reserva temporária expirou sem proposta. Horário liberado.')]
    }),
    solicitacao('SOL-1031', {
      clienteId: 'u-ana', clienteNome: 'Ana R.', servicoId: 'sv-fv-diag', equipamento: 'Split 9.000 BTUs · Quarto', local: local('Casa', 'Jardim Itália', 'Cuiabá'),
      descricao: 'Aparelho liga, mas não gela.', inicioDesejado: noDia(-5, '10:00'), estado: 'expirada', ocupacaoId: 'oc-1031', criadaEm: antes(24 * 10),
      proposta: { profissionalId: 'p-juliana', inicio: noDia(-5, '10:00'), fim: noDia(-5, '11:00'), validadeEm: noDia(-8, '18:00'), enviadaEm: antes(24 * 9), itens: [{ descricao: 'Visita técnica e diagnóstico', valorCentavos: 9000 }], condicoes: 'Valor descontado se o reparo for contratado.', observacoes: '' },
      linhaDoTempo: [tl(antes(24 * 10), 'Solicitação enviada.'), tl(antes(24 * 9), 'Proposta recebida.'), tl(noDia(-8, '18:00'), 'Proposta expirou sem resposta. Horário liberado.')]
    }),
    solicitacao('SOL-1027', {
      clienteId: 'u-ana', clienteNome: 'Ana R.', servicoId: 'sv-fv-hig', equipamento: 'Split 12.000 BTUs · Sala', local: local('Casa', 'Jardim Itália', 'Cuiabá'),
      descricao: 'Higienização semestral do aparelho da sala.', inicioDesejado: em(3, '08:00'), estado: 'aceita', ocupacaoId: 'oc-2205', ordemId: 'OS-2205', criadaEm: antes(24 * 12),
      proposta: { profissionalId: 'p-carlos', inicio: em(3, '08:00'), fim: em(3, '09:30'), validadeEm: antes(24 * 9), enviadaEm: antes(24 * 11), itens: [{ descricao: 'Higienização de split 12.000 BTUs', valorCentavos: 18000 }], condicoes: 'Pagamento combinado diretamente com a empresa.', observacoes: '' },
      linhaDoTempo: [tl(antes(24 * 12), 'Solicitação enviada.'), tl(antes(24 * 11), 'Proposta recebida.'), tl(antes(24 * 11 - 7), 'Proposta confirmada. Horário revalidado e agendamento confirmado.')]
    })
  ];

  // ---------- Cliente: equipamentos e endereços ----------
  const equipamentos = [
    r({ id: 'EQ-01', clienteId: 'u-ana', tipo: 'Split hi-wall', capacidade: '12.000 BTUs', marca: '', local: 'Sala' }),
    r({ id: 'EQ-02', clienteId: 'u-ana', tipo: 'Split hi-wall', capacidade: '9.000 BTUs', marca: '', local: 'Quarto' }),
    r({ id: 'EQ-03', clienteId: 'u-marina', tipo: 'Split hi-wall', capacidade: '12.000 BTUs', marca: '', local: 'Escritório de casa' })
  ];
  const enderecos = [
    r({ id: 'END-01', clienteId: 'u-ana', rotulo: 'Casa principal', bairro: 'Jardim Itália', cidade: 'Cuiabá', referencia: '' }),
    r({ id: 'END-02', clienteId: 'u-marina', rotulo: 'Casa', bairro: 'Boa Esperança', cidade: 'Cuiabá', referencia: '' })
  ];

  // ---------- Clientes operacionais da FrioVale (23 registros, com um texto longo) ----------
  const nomes = ['Ana', 'Pedro', 'Luíza', 'Roberto', 'Teresa', 'Jorge', 'Denise', 'Marcos', 'Helena', 'Igor', 'Sônia', 'Vítor'];
  const sobren = ['R.', 'S.', 'F.', 'C.', 'A.', 'M.', 'V.', 'P.'];
  const clientesOp = Array.from({ length: 23 }, (_, i) => r({
    id: 'CLI-' + String(i + 1).padStart(3, '0'), empresaId: 'friovale',
    nome: i === 3 ? 'Condomínio Residencial Parque das Águas — Bloco B, administração e áreas comuns (cadastro fictício para demonstração de texto longo)' : `${nomes[i % 12]} ${sobren[(i * 3) % 8]}`,
    cidade: i % 2 ? 'Várzea Grande' : 'Cuiabá', telefone: '', equipamentos: 1 + (i % 3), ultimo: noDia(-(3 + i * 4), '09:00'), origem: i % 4 === 1 ? 'Cadastro da empresa' : 'Conta EloServ', conviteEnviado: false
  }));

  // ---------- Notificações ----------
  let nid = 0;
  const notif = (usuarioId, titulo, texto, href, icone, horas, lida = false) => r({ id: 'NOT-' + (++nid), usuarioId, titulo, texto, href, icone, lida, criadaEm: antes(horas) });
  const notificacoes = [
    notif('u-ana', 'Proposta recebida', 'SOL-1038 · FrioVale Climatização', '#/clientes/solicitacoes/SOL-1038', 'file-text', 26),
    notif('u-ana', 'Proposta expirada', 'SOL-1031 · horário liberado', '#/clientes/solicitacoes/SOL-1031', 'hourglass', 24 * 8),
    notif('u-ana', 'Agendamento confirmado', 'SOL-1027 · Higienização de split', '#/clientes/solicitacoes/SOL-1027', 'calendar-check', 24 * 11),
    notif('u-marina', 'Nova solicitação', 'SOL-1040 · Manutenção preventiva', '#/empresas/solicitacoes/SOL-1040', 'paper-plane-tilt', 2),
    notif('u-marina', 'Convite pendente', 'Bruno L. ainda não aceitou o convite', '#/empresas/profissionais/p-bruno', 'envelope-simple', 24 * 4),
    notif('u-carlos', 'Atendimento atribuído', 'OS-2201 · Higienização de split', '#/empresas/ordens/OS-2201', 'calendar-check', 24 * 3),
    notif('u-paulo', 'Cadastro aguardando habilitação', 'Gelo Fino Refrigeração', '#/admin/empresas/gelo-fino', 'buildings', 24 * 3),
    notif('u-lucia', 'Cadastro aguardando habilitação', 'Gelo Fino Refrigeração', '#/admin/empresas/gelo-fino', 'buildings', 24 * 3)
  ];

  // ---------- Auditoria ----------
  let aid = 0;
  const aud = (quem, horas, entidade, acao, tipo, justificativa = '', empresaId = null) => r({ id: 'AUD-' + (++aid), quem, quando: antes(horas), entidade, acao, tipo, justificativa, empresaId });
  const auditoria = [
    aud('Lúcia Prado (admin principal)', 24 * 4 + 6, 'Empresa Refrigeração Pantanal', 'Empresa suspensa', 'suspensao', 'Dados cadastrais divergentes; aguardando correção pelo responsável.', 'pantanal'),
    aud('Paulo Lemos (admin operações)', 24 * 6, 'Artigo “Como bloquear um período na agenda”', 'Artigo publicado', 'artigo'),
    aud('Paulo Lemos (admin operações)', 24 * 29, 'Empresa Termo Leste Climatização e Refrigeração Residencial e Comercial', 'Empresa habilitada', 'habilitacao', 'Análise cadastral concluída.', 'termo-leste'),
    aud('Lúcia Prado (admin principal)', 24 * 42, 'Usuário Convite de suporte', 'Convite criado', 'convite')
  ];

  const suporte = [
    r({ id: 'SUP-118', assunto: 'Não consigo convidar um técnico', origem: 'Empresa · FrioVale', situacao: 'aberta', criadoEm: antes(3) }),
    r({ id: 'SUP-117', assunto: 'Proposta expirou antes de eu ver', origem: 'Cliente', situacao: 'aberta', criadoEm: antes(30) }),
    r({ id: 'SUP-114', assunto: 'Como alterar o fuso da empresa', origem: 'Empresa · Termo Leste', situacao: 'resolvida', criadoEm: antes(24 * 4) })
  ];

  const artigos = ARTIGOS.map((a, i) => r({ id: a.slug, ...a, atualizadoEm: antes(24 * (2 + i * 3)) }));
  const categorias = [r({ id: 'cat-res', nome: 'Climatização residencial' }), r({ id: 'cat-com', nome: 'Refrigeração comercial' })];

  return {
    meta: { versao: VERSAO_DADOS, rev: 0, criadoEm: iso(agora), hoje, diasDemo: dias, seq: { sol: 1041, os: 2209, blq: 8 } },
    empresas, servicos, produtos, profissionais, usuarios, ocupacoes, solicitacoes, ordens, equipamentos, enderecos, clientesOp,
    notificacoes, emails: [], auditoria, artigos, categorias, suporte, pedidosPrivacidade: [], acessosTemporarios: [], consultas: [], idem: {}
  };
}
