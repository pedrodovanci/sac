'use client';

import { X, Calendar, User, Phone, Mail, Globe, Tag, Info } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Plataforma, Setor, Status, Ticket, Tipo } from '../types';

interface NewTicketModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (ticket: Partial<Ticket>) => void;
}

const SETORES: Setor[] = [
  'Atendimento Exames',
  'Atendimento Consultas',
  'Atendimento Médico',
  'Atendimento WhatsApp',
  'Atendimento Call Center',
  'Agendamento de cirurgia',
  'Entrega de Exames',
  'Cantina',
  'Enfermagem',
  'Técnicos',
  'Outros'
];

export default function NewTicketModal({ isOpen, onClose, onSubmit }: NewTicketModalProps) {
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const formData = new FormData(e.target as HTMLFormElement);
    const selectedDate = (formData.get('ticket-date') as string) || new Date().toISOString().split('T')[0];
    const now = new Date();
    const [year, month, day] = selectedDate.split('-').map(Number);
    const dataCriacao = new Date(year, month - 1, day, now.getHours(), now.getMinutes(), now.getSeconds(), now.getMilliseconds()).toISOString();
    const setorValue = String(formData.get('setor') || '');
    const ticket: Partial<Ticket> = {
      paciente_nome: formData.get('patient-name') as string,
      paciente_telefone: (formData.get('patient-phone') as string) || undefined,
      paciente_email: (formData.get('patient-email') as string) || undefined,
      descricao: formData.get('description') as string,
      plataforma: formData.get('platform') as Plataforma,
      tipo: formData.get('ticket-type') as Tipo,
      setor: setorValue ? (setorValue as Setor) : undefined,
      status: formData.get('status') as Status,
      data_criacao: dataCriacao
    };
    onSubmit(ticket);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-on-background/40 backdrop-blur-sm"
          />
          
          <motion.div 
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="bg-surface-container-lowest w-full max-w-2xl rounded-xl shadow-2xl flex flex-col overflow-hidden relative z-10"
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-outline-variant bg-surface-container-lowest">
              <h2 className="text-xl font-bold text-on-surface">Novo Ticket</h2>
              <button 
                onClick={onClose}
                className="text-on-surface-variant hover:text-on-surface transition-colors p-1 rounded-full hover:bg-surface-variant flex items-center justify-center"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto max-h-[80vh]">
              <form id="new-ticket-form" onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-5">
                <div className="col-span-1">
                  <label className="block text-xs font-bold text-on-surface-variant mb-1.5 uppercase tracking-wider" htmlFor="ticket-date">Data</label>
                  <div className="relative">
                    <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant h-4 w-4" />
                    <input 
                      className="w-full bg-surface-container-low border border-outline-variant rounded-lg pl-10 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary transition-all appearance-none" 
                      id="ticket-date" 
                      name="ticket-date" 
                      type="date"
                      defaultValue={new Date().toISOString().split('T')[0]}
                    />
                  </div>
                </div>

                <div className="col-span-1">
                  <label className="block text-xs font-bold text-on-surface-variant mb-1.5 uppercase tracking-wider" htmlFor="patient-name">Nome do Paciente</label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant h-4 w-4" />
                    <input 
                      className="w-full bg-surface-container-low border border-outline-variant rounded-lg pl-10 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary transition-all placeholder:text-outline" 
                      id="patient-name" 
                      name="patient-name" 
                      placeholder="Ex: Maria Silva" 
                      type="text" 
                      required
                    />
                  </div>
                </div>

                <div className="col-span-1">
                  <label className="block text-xs font-bold text-on-surface-variant mb-1.5 uppercase tracking-wider" htmlFor="patient-phone">Telefone</label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant h-4 w-4" />
                    <input 
                      className="w-full bg-surface-container-low border border-outline-variant rounded-lg pl-10 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary transition-all placeholder:text-outline" 
                      id="patient-phone" 
                      name="patient-phone" 
                      placeholder="(00) 00000-0000" 
                      type="tel" 
                    />
                  </div>
                </div>

                <div className="col-span-1">
                  <label className="block text-xs font-bold text-on-surface-variant mb-1.5 uppercase tracking-wider" htmlFor="patient-email">E-mail</label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant h-4 w-4" />
                    <input 
                      className="w-full bg-surface-container-low border border-outline-variant rounded-lg pl-10 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary transition-all placeholder:text-outline" 
                      id="patient-email" 
                      name="patient-email" 
                      placeholder="exemplo@email.com" 
                      type="email" 
                    />
                  </div>
                </div>

                <div className="col-span-1">
                  <label className="block text-xs font-bold text-on-surface-variant mb-1.5 uppercase tracking-wider" htmlFor="platform">Plataforma</label>
                  <div className="relative">
                    <Globe className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant h-4 w-4" />
                    <select 
                      className="w-full bg-surface-container-low border border-outline-variant rounded-lg pl-10 pr-10 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary transition-all appearance-none" 
                      id="platform" 
                      name="platform"
                      required
                    >
                      <option value="">Selecione a origem</option>
                      <option value="Google">Google</option>
                      <option value="Reclame Aqui">Reclame Aqui</option>
                      <option value="Email">Email</option>
                      <option value="WhatsApp">WhatsApp</option>
                      <option value="Instagram">Instagram</option>
                      <option value="Outro">Outro</option>
                    </select>
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-on-surface-variant">
                      <svg className="w-4 h-4 fill-current" viewBox="0 0 20 20"><path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" /></svg>
                    </div>
                  </div>
                </div>

                <div className="col-span-1">
                  <label className="block text-xs font-bold text-on-surface-variant mb-1.5 uppercase tracking-wider" htmlFor="ticket-type">Tipo</label>
                  <div className="relative">
                    <Tag className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant h-4 w-4" />
                    <select 
                      className="w-full bg-surface-container-low border border-outline-variant rounded-lg pl-10 pr-10 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary transition-all appearance-none" 
                      id="ticket-type" 
                      name="ticket-type"
                      required
                    >
                      <option value="">Classifique o contato</option>
                      <option value="Elogio">Elogio</option>
                      <option value="Reclamação">Reclamação</option>
                      <option value="Dúvida">Dúvida</option>
                      <option value="Suporte">Suporte</option>
                    </select>
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-on-surface-variant">
                      <svg className="w-4 h-4 fill-current" viewBox="0 0 20 20"><path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" /></svg>
                    </div>
                  </div>
                </div>

                <div className="col-span-1">
                  <label className="block text-xs font-bold text-on-surface-variant mb-1.5 uppercase tracking-wider" htmlFor="setor">
                    Setor
                  </label>
                  <select
                    className="w-full bg-surface-container-low border border-outline-variant rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary transition-all"
                    id="setor"
                    name="setor"
                    defaultValue=""
                  >
                    <option value="">Selecione o setor</option>
                    {SETORES.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="col-span-1">
                  <label className="block text-xs font-bold text-on-surface-variant mb-1.5 uppercase tracking-wider" htmlFor="status">Status</label>
                  <div className="relative">
                    <Info className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant h-4 w-4" />
                    <select 
                      className="w-full bg-surface-container-low border border-outline-variant rounded-lg pl-10 pr-10 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary transition-all appearance-none" 
                      id="status" 
                      name="status"
                      defaultValue="a_responder"
                    >
                      <option value="a_responder">A Responder</option>
                      <option value="em_atendimento">Em Atendimento</option>
                      <option value="finalizado">Finalizado</option>
                    </select>
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-on-surface-variant">
                      <svg className="w-4 h-4 fill-current" viewBox="0 0 20 20"><path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" /></svg>
                    </div>
                  </div>
                </div>

                <div className="col-span-1 md:col-span-2 mt-2">
                  <label className="block text-xs font-bold text-on-surface-variant mb-1.5 uppercase tracking-wider" htmlFor="description">Descrição</label>
                  <textarea 
                    className="w-full bg-surface-container-low border border-outline-variant rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary transition-all resize-none placeholder:text-outline min-h-[220px]" 
                    id="description" 
                    name="description" 
                    placeholder="Descreva os detalhes do atendimento..." 
                    required
                  />
                </div>
              </form>
            </div>

            <div className="px-6 py-4 bg-surface-container-low border-t border-outline-variant flex items-center justify-end gap-3 rounded-b-xl">
              <button 
                type="button"
                onClick={onClose}
                className="px-5 py-2 rounded-lg text-sm font-bold text-primary hover:bg-surface-variant transition-colors border border-transparent active:scale-95"
              >
                Cancelar
              </button>
              <button 
                type="submit"
                form="new-ticket-form"
                className="px-6 py-2 rounded-lg text-sm font-bold bg-primary text-on-primary shadow-lg hover:bg-primary-container transition-all active:scale-95"
              >
                Salvar Ticket
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
