// Notificações na aplicação e fila de e-mail simulada (desacoplada: falhas de e-mail não alteram reservas).
import { ok, ler, transacao } from './db.js';
import { executar } from './comum.js';
import { lerSim } from './sim.js';

export function minhasNotificacoes(usuario) {
  if (!usuario) return [];
  return ler().notificacoes.filter(n => n.usuarioId === usuario.id).sort((a, b) => b.criadaEm.localeCompare(a.criadaEm)).slice(0, 30);
}

export const naoLidas = usuario => minhasNotificacoes(usuario).filter(n => !n.lida).length;

export function marcarTodasLidas(opcoes = {}) {
  return executar('marcarTodasLidas', tx => {
    const ator = tx.exigirAtor();
    for (const n of tx.estado.notificacoes) if (n.usuarioId === ator.id && !n.lida) tx.alterar('notificacoes', n, { lida: true });
    return ok();
  }, { semAtraso: true, falhavel: false, ...opcoes });
}

export function marcarLida(id, opcoes = {}) {
  return executar('marcarLida', tx => {
    const ator = tx.exigirAtor();
    const n = tx.get('notificacoes', id);
    if (n && n.usuarioId === ator.id && !n.lida) tx.alterar('notificacoes', n, { lida: true });
    return ok();
  }, { semAtraso: true, falhavel: false, ...opcoes });
}

export const filaEmail = () => ler().emails.slice().sort((a, b) => b.criadoEm.localeCompare(a.criadoEm));

/** Processa a fila simulada. Com “falha de e-mail” ativa, as mensagens falham — nenhuma reserva é alterada. */
export function processarFilaEmail() {
  const falhar = lerSim().falharEmail;
  return transacao('processarFilaEmail', tx => {
    let n = 0;
    for (const m of tx.estado.emails) {
      if (m.situacao === 'enviado') continue;
      tx.alterar('emails', m, { situacao: falhar ? 'falhou' : 'enviado', tentativas: m.tentativas + 1 });
      n += 1;
    }
    return ok({ processados: n, falhou: falhar });
  }, { falhavel: false, semAtraso: true });
}
