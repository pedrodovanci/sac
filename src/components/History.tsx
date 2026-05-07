'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Filter, Printer, ChevronLeft, ChevronRight, MessageSquare, Mail, Globe, AlertCircle, Instagram, HelpCircle } from 'lucide-react';
import { Plataforma, Setor, Ticket } from '../types';
import { motion } from 'motion/react';

interface HistoryProps {
  tickets: Ticket[];
}

export default function History({ tickets }: HistoryProps) {
  const router = useRouter();
  const [printing, setPrinting] = useState(false);
  const [plataforma, setPlataforma] = useState<Plataforma | 'Todas'>('Todas');
  const [tipo, setTipo] = useState<Ticket['tipo'] | 'Todos'>('Todos');
  const [setor, setSetor] = useState<Setor | 'Todos'>('Todos');
  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState('');

  const filteredTickets = useMemo(() => {
    return tickets
      .filter(t => t.status === 'finalizado')
      .filter(t => {
        if (plataforma !== 'Todas' && t.plataforma !== plataforma) return false;
        if (tipo !== 'Todos' && t.tipo !== tipo) return false;
        if (setor !== 'Todos' && t.setor !== setor) return false;

        const fimStr = t.data_finalizacao || t.data_criacao;
        const fim = Date.parse(fimStr);
        if (Number.isNaN(fim)) return true;

        if (dataInicio) {
          const inicio = Date.parse(`${dataInicio}T00:00:00`);
          if (!Number.isNaN(inicio) && fim < inicio) return false;
        }

        if (dataFim) {
          const fimFiltro = Date.parse(`${dataFim}T23:59:59.999`);
          if (!Number.isNaN(fimFiltro) && fim > fimFiltro) return false;
        }

        return true;
      });
  }, [tickets, plataforma, tipo, setor, dataInicio, dataFim]);

  const PLATAFORMAS: Plataforma[] = ['Google', 'Reclame Aqui', 'Email', 'WhatsApp', 'Instagram', 'Outro'];
  const TIPOS: Ticket['tipo'][] = ['Elogio', 'Reclamação', 'Suporte', 'Dúvida'];
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

  const handlePrint = async () => {
    setPrinting(true);
    try {
      const escapeHtml = (value: string) =>
        value
          .replaceAll('&', '&amp;')
          .replaceAll('<', '&lt;')
          .replaceAll('>', '&gt;')
          .replaceAll('"', '&quot;')
          .replaceAll("'", '&#039;');

      const fmt = (iso: string) => {
        const dt = new Date(iso);
        if (Number.isNaN(dt.getTime())) return iso;
        return dt.toLocaleString('pt-BR');
      };

      const filtros = [
        `Tipo: ${tipo}`,
        `Setor: ${setor}`,
        `Plataforma: ${plataforma}`,
        `Período: ${dataInicio || '—'} até ${dataFim || '—'}`
      ].join(' • ');

      const resumoPorTipo = (() => {
        const acc: Record<string, number> = {};
        for (const t of filteredTickets) acc[t.tipo] = (acc[t.tipo] || 0) + 1;
        return acc;
      })();

      const linhasResumo = Object.entries(resumoPorTipo)
        .map(([t, total]) => `<li><strong>${escapeHtml(t)}</strong>: ${total}</li>`)
        .join('');

      const linhasTabela = filteredTickets
        .map((t) => {
          const data = t.data_finalizacao || t.data_criacao;
          return `<tr>
  <td>${escapeHtml(t.codigo || '')}</td>
  <td>${escapeHtml(t.paciente_nome || '')}</td>
  <td>${escapeHtml(t.tipo || '')}</td>
  <td>${escapeHtml(t.setor || '—')}</td>
  <td>${escapeHtml(t.plataforma || '')}</td>
  <td>${escapeHtml(fmt(data))}</td>
</tr>`;
        })
        .join('');

      const html = `<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Relatório - Histórico</title>
  <style>
    *{box-sizing:border-box}
    body{font-family:Arial,Helvetica,sans-serif;color:#111;margin:24px}
    h1{font-size:18px;margin:0 0 4px}
    p{margin:0 0 10px;font-size:12px}
    .muted{color:#555}
    .section{margin-top:16px}
    ul{margin:6px 0 0;padding-left:18px;font-size:12px}
    table{width:100%;border-collapse:collapse;margin-top:10px}
    th,td{border:1px solid #ddd;padding:8px;vertical-align:top;font-size:11px}
    th{background:#f4f4f4;text-align:left}
    @media print{
      body{margin:12mm}
      a{color:inherit;text-decoration:none}
    }
  </style>
</head>
<body>
  <h1>Relatório de Tickets (Histórico)</h1>
  <p class="muted">Gerado em ${escapeHtml(new Date().toLocaleString('pt-BR'))}</p>
  <p><strong>Filtros:</strong> ${escapeHtml(filtros)}</p>
  <p><strong>Total:</strong> ${filteredTickets.length}</p>
  <div class="section">
    <p><strong>Resumo por tipo</strong></p>
    <ul>${linhasResumo || '<li>Nenhum</li>'}</ul>
  </div>
  <div class="section">
    <p><strong>Tickets</strong></p>
    <table>
      <thead>
        <tr>
          <th style="width:120px">Código</th>
          <th style="width:170px">Paciente</th>
          <th style="width:110px">Tipo</th>
          <th style="width:160px">Setor</th>
          <th style="width:120px">Plataforma</th>
          <th style="width:140px">Finalizado em</th>
        </tr>
      </thead>
      <tbody>
        ${linhasTabela || '<tr><td colspan="6">Nenhum ticket encontrado para os filtros selecionados.</td></tr>'}
      </tbody>
    </table>
  </div>
  <script>window.focus(); window.print();</script>
</body>
</html>`;

      const win = window.open('', '_blank');
      if (!win) return;
      win.document.open();
      win.document.write(html);
      win.document.close();
    } finally {
      setPrinting(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-surface">
      <div className="flex flex-col mb-8">
        <h1 className="text-2xl font-bold text-on-surface tracking-tight">Histórico de Atendimentos</h1>
        <p className="text-sm text-on-surface-variant mt-1">Consulte os tickets finalizados e suas resoluções.</p>
      </div>

      <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-4 shadow-sm mb-8 flex flex-wrap items-end gap-6">
        <div className="flex flex-col gap-1.5 min-w-[200px] flex-1">
          <label className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant px-1">Tipo</label>
          <select
            value={tipo}
            onChange={(e) => setTipo(e.target.value as Ticket['tipo'] | 'Todos')}
            className="w-full bg-surface-container-low border border-outline-variant rounded-lg py-2 px-3 text-xs focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all"
          >
            <option value="Todos">Todos os tipos</option>
            {TIPOS.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1.5 min-w-[220px] flex-1">
          <label className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant px-1">Setor</label>
          <select
            value={setor}
            onChange={(e) => setSetor(e.target.value as Setor | 'Todos')}
            className="w-full bg-surface-container-low border border-outline-variant rounded-lg py-2 px-3 text-xs focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all"
          >
            <option value="Todos">Todos os setores</option>
            {SETORES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1.5 min-w-[200px] flex-1">
          <label className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant px-1">Plataforma</label>
          <select
            value={plataforma}
            onChange={(e) => setPlataforma(e.target.value as Plataforma | 'Todas')}
            className="w-full bg-surface-container-low border border-outline-variant rounded-lg py-2 px-3 text-xs focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all"
          >
            <option value="Todas">Todas as plataformas</option>
            {PLATAFORMAS.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1.5 min-w-[150px] flex-1">
          <label className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant px-1">Data Início</label>
          <input
            type="date"
            value={dataInicio}
            onChange={(e) => setDataInicio(e.target.value)}
            className="w-full bg-surface-container-low border border-outline-variant rounded-lg py-2 px-3 text-xs focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none"
          />
        </div>

        <div className="flex flex-col gap-1.5 min-w-[150px] flex-1">
          <label className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant px-1">Data Fim</label>
          <input
            type="date"
            value={dataFim}
            onChange={(e) => setDataFim(e.target.value)}
            className="w-full bg-surface-container-low border border-outline-variant rounded-lg py-2 px-3 text-xs focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none"
          />
        </div>

        <button type="button" className="flex-none bg-surface-container hover:bg-surface-container-highest border border-outline-variant text-on-surface font-bold text-xs py-2.5 px-6 rounded-lg transition-all flex items-center justify-center gap-2">
          <Filter className="h-4 w-4" />
          Filtrar
        </button>

        <button
          type="button"
          onClick={handlePrint}
          disabled={printing || filteredTickets.length === 0}
          className="flex-none bg-primary hover:bg-primary-container text-on-primary font-bold text-xs py-2.5 px-6 rounded-lg transition-all flex items-center justify-center gap-2 shadow-sm disabled:opacity-70 disabled:cursor-not-allowed"
        >
          <Printer className="h-4 w-4" />
          {printing ? 'Preparando...' : 'Imprimir relatório'}
        </button>
      </div>

      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="bg-surface-container-lowest border border-outline-variant rounded-xl shadow-sm overflow-hidden flex-1 flex flex-col"
      >
        {filteredTickets.length === 0 && (
          <p className="text-center text-gray-400 py-8">
            Nenhum ticket encontrado para os filtros selecionados.
          </p>
        )}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[800px]">
            <thead className="bg-surface-container-low border-b border-outline-variant sticky top-0 z-10">
              <tr>
                <th className="py-3 px-6 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">Paciente</th>
                <th className="py-3 px-6 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">Plataforma</th>
                <th className="py-3 px-6 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">Tipo</th>
                <th className="py-3 px-6 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">Setor</th>
                <th className="py-3 px-6 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">Descrição</th>
                <th className="py-3 px-6 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant text-right">Finalizado em</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant bg-surface-container-lowest">
              {filteredTickets.map((ticket) => (
                <tr
                  key={ticket.id}
                  onClick={() => router.push(`/tickets/${ticket.id}`)}
                  className="hover:bg-surface-container-low transition-colors group cursor-pointer"
                >
                  <td className="py-4 px-6 text-sm text-on-surface font-semibold">
                    {ticket.paciente_nome}
                  </td>
                  <td className="py-4 px-6 text-xs text-on-surface-variant">
                    <div className="flex items-center gap-2">
                      <PlatformIcon platform={ticket.plataforma} />
                      {ticket.plataforma}
                    </div>
                  </td>
                  <td className="py-4 px-6">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold ${getTypeStyle(ticket.tipo)}`}>
                      {ticket.tipo}
                    </span>
                  </td>
                  <td className="py-4 px-6 text-xs text-on-surface-variant">
                    {ticket.setor ?? '—'}
                  </td>
                  <td className="py-4 px-6 text-xs text-on-surface-variant max-w-xs">
                    <div className="truncate" title={ticket.descricao}>
                      {ticket.descricao}
                    </div>
                  </td>
                  <td className="py-4 px-6 text-xs text-on-surface-variant text-right font-medium">
                    {new Date(ticket.data_finalizacao || ticket.data_criacao).toLocaleString('pt-BR')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="border-t border-outline-variant bg-surface-container-low/50 p-4 flex items-center justify-between mt-auto">
          <span className="text-xs text-on-surface-variant font-medium">Exibindo 1 a {filteredTickets.length} de {filteredTickets.length} registros</span>
          <div className="flex items-center gap-2">
            <button className="p-1.5 border border-outline-variant rounded-lg text-outline-variant hover:bg-surface-container hover:text-on-surface transition-colors">
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button className="w-8 h-8 flex items-center justify-center rounded-lg bg-primary text-on-primary font-bold text-xs shadow-sm">1</button>
            <button className="p-1.5 border border-outline-variant rounded-lg text-outline-variant hover:bg-surface-container hover:text-on-surface transition-colors">
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

function PlatformIcon({ platform }: { platform: Plataforma }) {
  switch (platform) {
    case 'WhatsApp': return <MessageSquare className="h-3.5 w-3.5" />;
    case 'Google': return <Globe className="h-3.5 w-3.5" />;
    case 'Reclame Aqui': return <AlertCircle className="h-3.5 w-3.5" />;
    case 'Email': return <Mail className="h-3.5 w-3.5" />;
    case 'Instagram': return <Instagram className="h-3.5 w-3.5" />;
    case 'Outro': return <HelpCircle className="h-3.5 w-3.5" />;
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
