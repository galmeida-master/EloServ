// Rascunho da solicitação: guardado neste dispositivo enquanto o visitante ou cliente preenche,
// inclusive durante login, cadastro ou sessão expirada (RF-CLI-01, RF-ACS-03).
import { storage, CHAVES } from '../../api/storage.js';

export const RASCUNHO_VAZIO = {
  empresaSlug: '', servicoId: '', etapa: 0,
  equipamentoModo: 'novo', equipamentoId: '', equipTipo: '', equipCapacidade: '', equipMarca: '', equipLocal: '',
  localModo: 'novo', enderecoId: '', localRotulo: 'Casa', bairro: '', cidade: '', referencia: '',
  descricao: '', semHorario: false, inicio: '', dataEscolhida: '', chave: ''
};

export function lerRascunho(slug) {
  const r = storage.getJson(CHAVES.rascunho, null);
  if (!r || r.empresaSlug !== slug) return { ...RASCUNHO_VAZIO, empresaSlug: slug };
  return { ...RASCUNHO_VAZIO, ...r };
}

export function salvarRascunho(r) { storage.setJson(CHAVES.rascunho, r); }

export function atualizarRascunho(slug, patch) {
  const r = { ...lerRascunho(slug), ...patch, empresaSlug: slug };
  salvarRascunho(r);
  return r;
}

export function limparRascunho() { storage.remove(CHAVES.rascunho); }
