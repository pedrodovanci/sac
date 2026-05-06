import { Ticket } from "./types";

export const MOCK_TICKETS: Ticket[] = [
  {
    id: '1',
    codigo: '30-04-2026-01',
    paciente_nome: 'Maria Oliveira',
    paciente_telefone: '(11) 98888-7777',
    paciente_email: 'maria.oliveira@email.com',
    descricao: 'Problemas com o acesso à plataforma na nova atualização.',
    status: 'a_responder',
    tipo: 'Reclamação',
    setor: 'Atendimento WhatsApp',
    plataforma: 'Google',
    data_criacao: new Date().toISOString()
  },
  {
    id: '2',
    codigo: '30-04-2026-02',
    paciente_nome: 'Carlos Santos',
    paciente_email: 'carlos.santos@email.com',
    descricao: 'Dúvida sobre renovação de contrato anual.',
    status: 'a_responder',
    tipo: 'Dúvida',
    plataforma: 'Email',
    data_criacao: new Date().toISOString()
  },
  {
    id: '3',
    codigo: '30-04-2026-03',
    paciente_nome: 'João Pereira',
    paciente_telefone: '(21) 90000-1111',
    descricao: 'Ótimo atendimento da equipe de suporte ontem!',
    status: 'em_atendimento',
    tipo: 'Elogio',
    setor: 'Atendimento Consultas',
    plataforma: 'WhatsApp',
    data_criacao: new Date().toISOString()
  },
  {
    id: '4',
    codigo: '29-04-2026-01',
    paciente_nome: 'Maria Costa',
    descricao: 'Atraso na entrega dos resultados dos exames laboratoriais, paciente precisava para retorno médico.',
    status: 'finalizado',
    tipo: 'Reclamação',
    setor: 'Entrega de Exames',
    plataforma: 'WhatsApp',
    oculto_no_kanban: false,
    data_criacao: new Date(Date.now() - 1000 * 60 * 60 * 24 * 3).toISOString(),
    data_finalizacao: new Date(Date.now() - 1000 * 60 * 60 * 24 * 1).toISOString()
  }
];
