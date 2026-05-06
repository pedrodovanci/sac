'use client';

import { useMemo, useState } from 'react';
import { MoveRight, MoveLeft, MessageSquare, Mail, Globe, Search, AlertCircle, Instagram, HelpCircle } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { Plataforma, Status, Ticket } from '../types';
import { motion, AnimatePresence } from 'motion/react';

interface KanbanProps {
  tickets: Ticket[];
  onAvancar: (id: string) => void;
  onVoltar: (id: string) => void;
  onSetOcultoNoKanban: (id: string, oculto_no_kanban: boolean) => void;
}

export default function Kanban({ tickets, onAvancar, onVoltar, onSetOcultoNoKanban }: KanbanProps) {
  const router = useRouter();
  const [showAllFinalizados, setShowAllFinalizados] = useState(false);
  const [showArchivedFinalizados, setShowArchivedFinalizados] = useState(false);
  const columns: Status[] = ['a_responder', 'em_atendimento', 'finalizado'];
  const FINALIZADOS_LIMITE = 12;
  const archivedFinalizadosCount = useMemo(
    () => tickets.filter((t) => t.status === 'finalizado' && t.oculto_no_kanban).length,
    [tickets]
  );

  const getStatusLabel = (status: Status) => {
    switch (status) {
      case 'a_responder': return 'A Responder';
      case 'em_atendimento': return 'Em Atendimento';
      case 'finalizado': return 'Finalizados';
      default: return status;
    }
  };

  const getStatusColor = (status: Status) => {
    switch (status) {
      case 'a_responder': return 'bg-error';
      case 'em_atendimento': return 'bg-orange-400';
      case 'finalizado': return 'bg-secondary';
      default: return 'bg-outline';
    }
  };

  const ticketsPorStatus = useMemo(() => {
    const byStatus: Record<Status, Ticket[]> = {
      a_responder: [],
      em_atendimento: [],
      finalizado: []
    };

    for (const t of tickets) {
      if (t.status === 'finalizado' && t.oculto_no_kanban && !showArchivedFinalizados) continue
      byStatus[t.status].push(t)
    }

    const sortByDateDesc = (a: Ticket, b: Ticket) => {
      const aBase = a.status === 'finalizado' ? a.data_finalizacao || a.data_criacao : a.data_criacao;
      const bBase = b.status === 'finalizado' ? b.data_finalizacao || b.data_criacao : b.data_criacao;
      const ta = Date.parse(aBase);
      const tb = Date.parse(bBase);
      if (Number.isNaN(ta) || Number.isNaN(tb)) return 0;
      return tb - ta;
    };

    byStatus.a_responder.sort(sortByDateDesc);
    byStatus.em_atendimento.sort(sortByDateDesc);
    byStatus.finalizado.sort(sortByDateDesc);
    return byStatus;
  }, [tickets, showArchivedFinalizados]);

  return (
    <div className="flex flex-col h-full">
      <div className="flex lg:grid lg:grid-cols-3 gap-6 flex-1 overflow-x-auto lg:overflow-x-hidden pb-4 items-start scrollbar-hide">
        {columns.map(column => {
          const allTickets = ticketsPorStatus[column];
          const isFinalizados = column === 'finalizado';
          const displayedTickets =
            isFinalizados && !showAllFinalizados ? allTickets.slice(0, FINALIZADOS_LIMITE) : allTickets;

          return (
          <div key={column} className="flex-shrink-0 w-80 lg:w-auto bg-surface-container-low rounded-xl flex flex-col h-full max-h-full border border-outline-variant shadow-sm">
            <div className="p-4 border-b border-outline-variant flex justify-between items-center bg-surface-container-highest rounded-t-xl shrink-0">
              <div className="flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full ${getStatusColor(column)}`} />
                <h3 className="text-xs font-bold uppercase tracking-widest text-on-surface">{getStatusLabel(column)}</h3>
              </div>
              <span className="bg-surface-container-lowest text-on-surface-variant text-[11px] font-bold px-2 py-0.5 rounded-md shadow-sm border border-outline-variant">
                {allTickets.length}
              </span>
            </div>

            <div className="p-3 flex-1 overflow-y-auto custom-scrollbar">
              <AnimatePresence mode="popLayout">
                {allTickets.length > 0 ? (
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                    {isFinalizados && (archivedFinalizadosCount > 0 || allTickets.length > FINALIZADOS_LIMITE) && (
                      <div className="lg:col-span-2 flex items-center justify-between rounded-lg border border-outline-variant bg-surface-container-lowest px-3 py-2">
                        <span className="text-[11px] text-on-surface-variant font-medium">
                          Mostrando {displayedTickets.length} de {allTickets.length}
                        </span>
                        <div className="flex items-center gap-4">
                          {archivedFinalizadosCount > 0 && (
                            <button
                              type="button"
                              onClick={() => setShowArchivedFinalizados((v) => !v)}
                              className="text-[11px] font-bold text-primary hover:text-primary-container transition-colors"
                            >
                              {showArchivedFinalizados ? 'Ocultar arquivados' : 'Mostrar arquivados'}
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => setShowAllFinalizados((v) => !v)}
                            className="text-[11px] font-bold text-primary hover:text-primary-container transition-colors"
                          >
                            {showAllFinalizados ? 'Mostrar menos' : 'Mostrar mais'}
                          </button>
                        </div>
                      </div>
                    )}

                    {displayedTickets.map((ticket, index) => (
                      <motion.div 
                        key={ticket.id}
                        layout
                        onClick={() => router.push(`/tickets/${ticket.id}`)}
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.9 }}
                        transition={{ delay: index * 0.05 }}
                        className="bg-surface-container-lowest rounded-lg p-4 border border-outline-variant shadow-sm hover:shadow-md transition-all cursor-pointer relative overflow-hidden group"
                      >
                        <div className={`absolute left-0 top-0 bottom-0 w-1 ${getStatusColor(column)}`} />
                        <div className="flex justify-between items-start mb-3">
                          <div className="flex flex-col gap-0.5">
                            <span className="text-sm font-bold text-on-surface">{ticket.paciente_nome}</span>
                            <span className="text-xs text-on-surface-variant font-medium">{ticket.codigo}</span>
                          </div>
                          <PlatformIcon platform={ticket.plataforma} />
                        </div>
                        <div className="mb-4">
                          <p className="text-xs text-on-surface-variant line-clamp-2 leading-relaxed">{ticket.descricao}</p>
                        </div>
                        <div className="flex justify-between items-center mt-auto pt-3 border-t border-surface-container-highest">
                          <span className={`inline-flex items-center px-2 py-1 rounded text-[10px] font-bold ${getTypeStyle(ticket.tipo)}`}>
                            {ticket.tipo}
                          </span>
                          <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            {column === 'finalizado' && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onSetOcultoNoKanban(ticket.id, !ticket.oculto_no_kanban);
                                }}
                                className="text-on-surface-variant hover:text-primary p-1 bg-surface-container-low rounded-md"
                              >
                                <span className="text-[10px] font-bold px-1">
                                  {ticket.oculto_no_kanban ? 'Reexibir' : 'Arquivar'}
                                </span>
                              </button>
                            )}
                            {ticket.status !== 'a_responder' && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onVoltar(ticket.id);
                                }}
                                className="text-on-surface-variant hover:text-primary p-1 bg-surface-container-low rounded-md"
                              >
                                <MoveLeft className="h-3.5 w-3.5" />
                              </button>
                            )}
                            {ticket.status !== 'finalizado' && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onAvancar(ticket.id);
                                }}
                                className="text-on-surface-variant hover:text-primary p-1 bg-surface-container-low rounded-md"
                              >
                                <MoveRight className="h-3.5 w-3.5" />
                              </button>
                            )}
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-10 text-on-surface-variant opacity-40">
                    <Search className="h-8 w-8 mb-2" />
                    <p className="text-xs font-medium">Nenhum ticket aqui</p>
                  </div>
                )}
              </AnimatePresence>
            </div>
          </div>
        )})}
      </div>
    </div>
  );
}

function PlatformIcon({ platform }: { platform: Plataforma }) {
  switch (platform) {
    case 'WhatsApp': return <MessageSquare className="h-4 w-4 text-green-500" />;
    case 'Email': return <Mail className="h-4 w-4 text-blue-500" />;
    case 'Reclame Aqui': return <AlertCircle className="h-4 w-4 text-orange-500" />;
    case 'Instagram': return <Instagram className="h-4 w-4 text-pink-500" />;
    case 'Google': return <Globe className="h-4 w-4 text-red-500" />;
    case 'Outro': return <HelpCircle className="h-4 w-4 text-slate-400" />;
    default: return null;
  }
}

function getTypeStyle(type: Ticket['tipo']) {
  switch (type) {
    case 'Reclamação': return 'bg-error/10 text-error';
    case 'Dúvida': return 'bg-on-surface-variant/10 text-on-surface-variant';
    case 'Elogio': return 'bg-primary/10 text-primary';
    case 'Suporte': return 'bg-orange-500/10 text-orange-600';
    default: return '';
  }
}
