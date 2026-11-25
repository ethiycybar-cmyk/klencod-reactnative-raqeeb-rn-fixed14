import { listBatches } from '../data/repositories/batchesRepo';
import { CRITICAL_DAYS, EXCELLENT_FROM_DAYS } from '../domain/expiry';
import { DEVELOPER_CREDIT } from '../config/credit';
import { todayISO } from '../utils/dates';
import type { BatchWithProduct } from '../types/models';

export type ReportItem = {
  name: string;
  batchNumber: string;
  daysLeft: number;
  quantity: number;
};

export type ExpiryReport = {
  total: number;
  expired: ReportItem[];
  critical: ReportItem[];
  good: ReportItem[]; // جيد: بين الحرج والممتاز
  excellent: ReportItem[]; // ممتاز: 3 أشهر فأكثر
};

const toItem = (b: BatchWithProduct): ReportItem => ({
  name: b.productName,
  batchNumber: b.batchNumber,
  daysLeft: b.daysLeft,
  quantity: b.quantity,
});

/** تقرير بحالة كل التشغيلات الفعّالة (الكمية > 0 وغير المباعة)، الأقرب للانتهاء أولاً. */
export function buildExpiryReport(): ExpiryReport {
  const batches = listBatches('', 'all').filter((b) => b.quantity > 0 && b.isSold === 0);
  const report: ExpiryReport = { total: batches.length, expired: [], critical: [], good: [], excellent: [] };
  for (const b of batches) {
    if (b.daysLeft < 0) report.expired.push(toItem(b));
    else if (b.daysLeft <= CRITICAL_DAYS) report.critical.push(toItem(b));
    else if (b.daysLeft < EXCELLENT_FROM_DAYS) report.good.push(toItem(b));
    else report.excellent.push(toItem(b));
  }
  return report;
}

const WA_MAX_LISTED = 10;

function waSection(title: string, items: ReportItem[], daysText: (d: number) => string, listItems = true): string[] {
  const lines = [`${title}: ${items.length}`];
  if (listItems) {
    items.slice(0, WA_MAX_LISTED).forEach((i) => lines.push(`• ${i.name} (${i.batchNumber}) — ${daysText(i.daysLeft)}`));
    if (items.length > WA_MAX_LISTED) lines.push(`… و${items.length - WA_MAX_LISTED} أخرى`);
  }
  return lines;
}

/** نص التقرير لإرساله عبر واتساب. */
export function formatReportForWhatsapp(report: ExpiryReport): string {
  const lines: string[] = [
    '*تقرير حالة المنتجات — رقيب*',
    `التاريخ: ${todayISO()}`,
    `إجمالي التشغيلات الفعّالة: ${report.total}`,
    '',
    ...waSection('⛔ *منتهية الصلاحية*', report.expired, (d) => `منذ ${Math.abs(d)} يوم`),
    '',
    ...waSection(`🔴 *حرجة (${CRITICAL_DAYS} أيام أو أقل)*`, report.critical, (d) => `${d} يوم`),
    '',
    ...waSection(`🟡 *جيدة (${CRITICAL_DAYS + 1}–${EXCELLENT_FROM_DAYS - 1} يوماً)*`, report.good, (d) => `${d} يوم`),
    '',
    ...waSection(`🟢 *ممتازة (${EXCELLENT_FROM_DAYS} يوماً فأكثر)*`, report.excellent, (d) => `${d} يوم`, false),
    '',
    `— ${DEVELOPER_CREDIT}`,
  ];
  return lines.join('\n');
}
