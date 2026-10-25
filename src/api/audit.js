// Auditoria: quem, quando, entidade, tipo de alteração e justificativa — sem segredos ou dados pessoais desnecessários.
// O registro acontece dentro das transações (tx.auditar); aqui ficam as consultas.
import { ler } from './db.js';
import { pode } from '../domain/permissoes.js';

export const TIPOS_AUDITORIA = [
  ['habilitacao', 'Habilitação'], ['suspensao', 'Suspensão'], ['reativacao', 'Reativação'], ['arquivamento', 'Arquivamento'],
  ['revogacao', 'Revogação'], ['papel', 'Alteração de papel'], ['convite', 'Convites'], ['artigo', 'Base de conhecimento'],
  ['reserva', 'Reservas (criação, confirmação, liberação e conflitos)'], ['agenda', 'Bloqueios de agenda'], ['moderacao', 'Moderação de conteúdo'],
  ['categoria', 'Categorias'], ['acesso_detalhe', 'Acesso a detalhes operacionais'], ['privacidade', 'Privacidade']
];

export function listarAuditoria(usuario, { tipo = '', empresaId = '' } = {}) {
  if (!pode(usuario, 'auditoria.consultar')) return [];
  return ler().auditoria
    .filter(a => (!tipo || a.tipo === tipo) && (!empresaId || a.empresaId === empresaId))
    .sort((a, b) => b.quando.localeCompare(a.quando));
}
