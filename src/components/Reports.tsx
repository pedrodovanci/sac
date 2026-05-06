'use client';

import { Download, Calendar, Loader2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { motion } from 'motion/react';
import { useDashboardState } from '@/app/(dashboard)/DashboardState';
import type { Ticket } from '@/src/types';

async function getUserFacingError(res: Response) {
  const retryAfter = Number(res.headers.get('Retry-After') || '');
  let code: string | undefined;
  try {
    const json = (await res.json()) as { error?: unknown };
    if (typeof json?.error === 'string') code = json.error;
  } catch {
    code = undefined;
  }

  if (res.status === 401 || code === 'unauthorized') {
    return { message: 'Sua sessão expirou. Faça login novamente.', redirectToLogin: true };
  }

  if (res.status === 429 || code === 'rate_limited') {
    const wait = Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter : undefined;
    return { message: `Muitas tentativas. Aguarde${wait ? ` ${wait}s` : ''} e tente novamente.`, redirectToLogin: false };
  }

  return { message: 'Não foi possível carregar os tickets do servidor. O relatório pode ficar incompleto.', redirectToLogin: false };
}

export default function Reports() {
  const [generating, setGenerating] = useState(false);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const { tickets } = useDashboardState();

  const filtrarFinalizadosPorPeriodo = (items: Ticket[]) => {
    const inicio = startDate ? Date.parse(`${startDate}T00:00:00`) : Number.NEGATIVE_INFINITY;
    const fim = endDate ? Date.parse(`${endDate}T23:59:59.999`) : Number.POSITIVE_INFINITY;

    return items.filter((t) => {
      if (t.status !== 'finalizado') return false;
      const base = t.data_finalizacao || t.data_criacao;
      const ts = Date.parse(base);
      if (Number.isNaN(ts)) return true;
      return ts >= inicio && ts <= fim;
    });
  };

  const ticketsFiltrados = useMemo(() => {
    return filtrarFinalizadosPorPeriodo(tickets);
  }, [tickets, startDate, endDate]);

  const resumoPorTipo = useMemo(() => {
    const acc: Record<string, number> = {};
    for (const t of ticketsFiltrados) acc[t.tipo] = (acc[t.tipo] || 0) + 1;
    return acc;
  }, [ticketsFiltrados]);

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      let ticketsServidor: Ticket[] | null = null;
      try {
        const res = await fetch('/api/tickets?status=finalizado', { credentials: 'include' });
        if (!res.ok) {
          const { message, redirectToLogin } = await getUserFacingError(res);
          window.alert(message);
          if (redirectToLogin) {
            window.location.href = '/login';
            return;
          }
        } else {
          const json = (await res.json()) as { tickets?: Ticket[] };
          if (Array.isArray(json.tickets)) ticketsServidor = json.tickets;
        }
      } catch {
        ticketsServidor = null;
      }

      const merged = new Map<string, Ticket>();
      for (const t of ticketsServidor ?? []) merged.set(t.id, t);
      for (const t of tickets) merged.set(t.id, t);
      const ticketsParaPdf = filtrarFinalizadosPorPeriodo(Array.from(merged.values()));

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

      const resumo = (() => {
        const acc: Record<string, number> = {};
        for (const t of ticketsParaPdf) acc[t.tipo] = (acc[t.tipo] || 0) + 1;
        return acc;
      })();

      const linhasResumo = Object.entries(resumo)
        .map(([tipo, total]) => `<li><strong>${escapeHtml(tipo)}</strong>: ${total}</li>`)
        .join('');

      const linhasTabela = ticketsParaPdf
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

      const periodo =
        startDate || endDate
          ? `<p><strong>Período:</strong> ${escapeHtml(startDate || '—')} até ${escapeHtml(endDate || '—')}</p>`
          : `<p><strong>Período:</strong> todos</p>`;

      const html = `<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Relatório SAC</title>
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
  <h1>Relatório de Tickets Finalizados</h1>
  <p class="muted">Gerado em ${escapeHtml(new Date().toLocaleString('pt-BR'))}</p>
  ${periodo}
  <p><strong>Total:</strong> ${ticketsParaPdf.length}</p>
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
        ${linhasTabela || '<tr><td colspan="6">Nenhum ticket encontrado no período selecionado.</td></tr>'}
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
      setGenerating(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col items-center justify-center">
      <div className="w-full max-w-lg">
        <div className="mb-8 text-center px-4">
          <h2 className="text-2xl font-bold text-on-surface mb-2">Gerar Relatório para Diretoria</h2>
          <p className="text-sm text-on-surface-variant">Configure os parâmetros abaixo para extrair a consolidação de dados.</p>
        </div>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-surface-container-lowest border border-outline-variant shadow-lg rounded-xl p-8 flex flex-col gap-6"
        >
          <div className="flex flex-col gap-5">
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <label className="text-sm font-semibold text-on-surface" htmlFor="startDate">Data Inicial</label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant h-4 w-4" />
                  <input 
                    className="w-full bg-surface border border-outline-variant rounded-lg py-2.5 pl-10 pr-3 text-sm focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all" 
                    id="startDate" 
                    type="date" 
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                  />
                </div>
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-sm font-semibold text-on-surface" htmlFor="endDate">Data Final</label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant h-4 w-4" />
                  <input 
                    className="w-full bg-surface border border-outline-variant rounded-lg py-2.5 pl-10 pr-3 text-sm focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all" 
                    id="endDate" 
                    type="date" 
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="pt-6 mt-2 border-t border-surface-container-highest">
            <button 
              onClick={handleGenerate}
              disabled={generating}
              className={`w-full bg-primary text-on-primary font-bold rounded-lg py-4 px-6 flex items-center justify-center gap-3 shadow-md transition-all active:scale-95 ${generating ? 'cursor-wait opacity-80' : 'hover:bg-primary-container'}`}
            >
              {generating ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" />
                  Gerando Relatório...
                </>
              ) : (
                <>
                  <Download className="h-5 w-5" />
                  Exportar PDF
                </>
              )}
            </button>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
