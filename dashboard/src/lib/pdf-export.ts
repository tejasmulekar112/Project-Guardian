import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { SOSEvent } from '@guardian/shared-schemas';

const COLORS = {
  primary: [220, 38, 38] as [number, number, number],    // red-600
  dark: [30, 41, 59] as [number, number, number],         // slate-800
  gray: [100, 116, 139] as [number, number, number],      // slate-500
  white: [255, 255, 255] as [number, number, number],
};

const STATUS_COLORS: Record<string, [number, number, number]> = {
  triggered: [239, 68, 68],    // red
  dispatched: [234, 179, 8],   // yellow
  acknowledged: [59, 130, 246], // blue
  resolved: [34, 197, 94],     // green
};

function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleString();
}

export function exportEventsToPDF(
  events: SOSEvent[],
  userEmails: Map<string, string>,
): void {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  let y = 20;

  // --- Header ---
  doc.setFillColor(...COLORS.dark);
  doc.rect(0, 0, pageWidth, 40, 'F');

  doc.setTextColor(...COLORS.white);
  doc.setFontSize(22);
  doc.setFont('helvetica', 'bold');
  doc.text('Guardian — SOS Events Report', 14, 26);

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  const reportDate = new Date().toLocaleString();
  doc.text(`Generated: ${reportDate}`, pageWidth - 14, 26, { align: 'right' });
  doc.text(`Total Events: ${events.length}`, pageWidth - 14, 33, { align: 'right' });

  y = 50;

  // --- Summary Stats ---
  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const activeCount = events.filter((e) => e.status === 'triggered' || e.status === 'dispatched').length;
  const todayCount = events.filter((e) => e.createdAt >= startOfDay).length;
  const resolvedCount = events.filter((e) => e.status === 'resolved').length;

  const stats = [
    { label: 'Total Events', value: String(events.length) },
    { label: 'Active', value: String(activeCount) },
    { label: 'Today', value: String(todayCount) },
    { label: 'Resolved', value: String(resolvedCount) },
  ];

  const statBoxWidth = (pageWidth - 28 - 18) / 4; // 14 margin each side, 6px gap * 3
  stats.forEach((stat, i) => {
    const x = 14 + i * (statBoxWidth + 6);
    doc.setFillColor(241, 245, 249); // slate-100
    doc.roundedRect(x, y, statBoxWidth, 22, 3, 3, 'F');

    doc.setTextColor(...COLORS.gray);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.text(stat.label, x + statBoxWidth / 2, y + 8, { align: 'center' });

    doc.setTextColor(...COLORS.dark);
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text(stat.value, x + statBoxWidth / 2, y + 18, { align: 'center' });
  });

  y += 30;

  // --- Trigger Type Breakdown ---
  const triggerCounts = { manual: 0, voice: 0, shake: 0 };
  events.forEach((e) => {
    if (e.triggerType in triggerCounts) {
      triggerCounts[e.triggerType as keyof typeof triggerCounts]++;
    }
  });

  doc.setTextColor(...COLORS.dark);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('Trigger Breakdown:', 14, y + 4);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(...COLORS.gray);
  doc.text(
    `Manual: ${triggerCounts.manual}  |  Voice: ${triggerCounts.voice}  |  Shake: ${triggerCounts.shake}`,
    14,
    y + 11,
  );

  y += 18;

  // --- Events Table ---
  const tableData = events.map((e) => [
    formatDate(e.createdAt),
    userEmails.get(e.userId) ?? e.userId,
    e.triggerType,
    e.status,
    `${e.location.latitude.toFixed(4)}, ${e.location.longitude.toFixed(4)}`,
    e.message?.replace(/\n/g, ' ') ?? '—',
  ]);

  autoTable(doc, {
    startY: y,
    head: [['Timestamp', 'User', 'Trigger', 'Status', 'Location', 'Message']],
    body: tableData,
    theme: 'grid',
    headStyles: {
      fillColor: COLORS.dark,
      textColor: COLORS.white,
      fontStyle: 'bold',
      fontSize: 8,
    },
    bodyStyles: {
      fontSize: 7.5,
      textColor: [51, 65, 85], // slate-700
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252], // slate-50
    },
    columnStyles: {
      0: { cellWidth: 34 },
      1: { cellWidth: 38 },
      2: { cellWidth: 18 },
      3: { cellWidth: 22 },
      4: { cellWidth: 30 },
      5: { cellWidth: 'auto' },
    },
    didParseCell(data) {
      // Color-code status column
      if (data.section === 'body' && data.column.index === 3) {
        const status = String(data.cell.raw);
        const color = STATUS_COLORS[status];
        if (color) {
          data.cell.styles.textColor = color;
          data.cell.styles.fontStyle = 'bold';
        }
      }
    },
    margin: { left: 14, right: 14 },
  });

  // --- Footer on each page ---
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    const pageHeight = doc.internal.pageSize.getHeight();
    doc.setFontSize(7);
    doc.setTextColor(...COLORS.gray);
    doc.text('Guardian — AI-Powered Safety System', 14, pageHeight - 8);
    doc.text(`Page ${i} of ${pageCount}`, pageWidth - 14, pageHeight - 8, { align: 'right' });
  }

  // --- Download ---
  const date = new Date().toISOString().slice(0, 10);
  doc.save(`sos-events-${date}.pdf`);
}
