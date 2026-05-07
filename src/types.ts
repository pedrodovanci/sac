export type Status = 'a_responder' | 'em_atendimento' | 'finalizado'

export type Tipo = 'Elogio' | 'Reclamação' | 'Dúvida' | 'Suporte'

export type Setor =
  | 'Atendimento Exames'
  | 'Atendimento Consultas'
  | 'Atendimento Médico'
  | 'Atendimento WhatsApp'
  | 'Atendimento Call Center'
  | 'Agendamento de cirurgia'
  | 'Entrega de Exames'
  | 'Cantina'
  | 'Enfermagem'
  | 'Técnicos'
  | 'Outros'

export type Plataforma =
  | 'Google'
  | 'Reclame Aqui'
  | 'Email'
  | 'WhatsApp'
  | 'Instagram'
  | 'Outro'

export interface Ticket {
  id: string
  codigo: string
  paciente_nome: string
  paciente_telefone?: string
  paciente_email?: string
  plataforma: Plataforma
  tipo: Tipo
  setor?: Setor
  status: Status
  descricao: string
  observacao?: string
  oculto_no_kanban?: boolean
  data_criacao: string
  data_finalizacao?: string
  criado_por?: string
}
