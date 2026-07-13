import type { ForestFamilyStats } from './computeForestFamilyStats';
import type { FamilyMemberInput } from '../treeLayout/types';

function escapeCsvCell(value: string | number): string {
  const text = String(value);
  if (/[",\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

function downloadTextFile(filename: string, content: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export function exportForestFamilyStatsExcel(
  stats: ForestFamilyStats,
  familyName: string,
  members: FamilyMemberInput[],
): void {
  const rows: string[][] = [
    ['تقرير إحصائيات العائلة', familyName],
    [],
    ['الملخص'],
    ['إجمالي الأفراد', String(stats.total)],
    ['الذكور', String(stats.males)],
    ['الإناث', String(stats.females)],
    ['الأحياء', String(stats.living)],
    ['المتوفون', String(stats.deceased)],
    ['البيانات غير المكتملة', String(stats.incomplete)],
    [],
    ['الأجيال', 'عدد الأفراد'],
    ...stats.generations.map((generation) => [generation.label, String(generation.count)]),
    [],
    ['قائمة الأفراد'],
    ['الاسم', 'الجيل'],
    ...members.map((member) => [member.fullName, String(member.generation)]),
  ];

  const csv = `\uFEFF${rows.map((row) => row.map(escapeCsvCell).join(',')).join('\n')}`;
  const safeName = familyName.trim().replace(/[^\w\u0600-\u06FF-]+/g, '-') || 'family';
  downloadTextFile(`family-stats-${safeName}.csv`, csv, 'text/csv;charset=utf-8;');
}

export function printForestFamilyStats(
  stats: ForestFamilyStats,
  familyName: string,
  members: FamilyMemberInput[],
): void {
  const popup = window.open('', '_blank', 'noopener,noreferrer,width=900,height=720');
  if (!popup) return;

  const generationRows = stats.generations
    .map((generation) => `<tr><td>${generation.label}</td><td>${generation.count}</td></tr>`)
    .join('');
  const memberRows = members
    .map((member) => `<tr><td>${member.fullName}</td><td>${member.generation}</td></tr>`)
    .join('');

  popup.document.write(`<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="utf-8" />
  <title>إحصائيات ${familyName}</title>
  <style>
    body { font-family: Tahoma, Arial, sans-serif; color: #3b2f1f; padding: 24px; }
    h1 { font-size: 22px; margin: 0 0 8px; }
    h2 { font-size: 16px; margin: 24px 0 10px; color: #5c6b4d; }
    .summary { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }
    .card { border: 1px solid #ddd5c4; border-radius: 12px; padding: 12px; background: #faf7f0; }
    .card strong { display: block; font-size: 24px; margin-top: 4px; }
    table { width: 100%; border-collapse: collapse; margin-top: 8px; }
    th, td { border: 1px solid #e5dcc8; padding: 8px 10px; text-align: right; }
    th { background: #f3ede0; }
  </style>
</head>
<body>
  <h1>إحصائيات عائلة ${familyName}</h1>
  <div class="summary">
    <div class="card"><span>إجمالي الأفراد</span><strong>${stats.total}</strong></div>
    <div class="card"><span>الذكور</span><strong>${stats.males}</strong></div>
    <div class="card"><span>الإناث</span><strong>${stats.females}</strong></div>
    <div class="card"><span>الأحياء</span><strong>${stats.living}</strong></div>
    <div class="card"><span>المتوفون</span><strong>${stats.deceased}</strong></div>
    <div class="card"><span>بيانات غير مكتملة</span><strong>${stats.incomplete}</strong></div>
  </div>
  <h2>الأجيال</h2>
  <table><thead><tr><th>الجيل</th><th>العدد</th></tr></thead><tbody>${generationRows}</tbody></table>
  <h2>قائمة الأفراد</h2>
  <table><thead><tr><th>الاسم</th><th>الجيل</th></tr></thead><tbody>${memberRows}</tbody></table>
  <script>window.onload = () => { window.print(); };</script>
</body>
</html>`);
  popup.document.close();
}
