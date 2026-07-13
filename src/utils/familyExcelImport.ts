export interface ExcelImportColumn {
  key: string;
  label: string;
  headerColor: string;
  headerHint?: string;
  required: boolean;
  example: string;
  notes: string;
}

/** Column headers for Excel/CSV — visual order RTL (right → left) like the reference row. */
export const FAMILY_EXCEL_IMPORT_COLUMNS: ExcelImportColumn[] = [
  {
    key: 'اسم_الزوج',
    label: 'اسم الزوج',
    headerColor: '#ddb8c8',
    required: false,
    example: 'جان محمد حاجي عبدالله',
    notes: 'مطلوب إذا كانت الحالة الاجتماعية «متزوج»',
  },
  {
    key: 'الحالة_الاجتماعية',
    label: 'الحالة الاجتماعية',
    headerColor: '#b8a8c8',
    headerHint: 'متزوج / غير متزوج',
    required: false,
    example: 'متزوج',
    notes: 'متزوج أو غير متزوج',
  },
  {
    key: 'تاريخ_الوفاة',
    label: 'تاريخ الوفاة',
    headerColor: '#9ec8e0',
    required: false,
    example: '2020-05-15',
    notes: 'مطلوب إذا كانت الحالة «ميت» — بصيغة YYYY-MM-DD',
  },
  {
    key: 'الحالة',
    label: 'حي / ميت',
    headerColor: '#7a9fc8',
    required: true,
    example: 'حي',
    notes: 'حي أو ميت',
  },
  {
    key: 'الجنس',
    label: 'الجنس',
    headerColor: '#8aab9f',
    required: true,
    example: 'ذكر',
    notes: 'ذكر أو أنثى',
  },
  {
    key: 'اسم_الأب',
    label: 'أسم الأب',
    headerColor: '#b8c8a8',
    required: true,
    example: 'عبدالعزيز',
    notes: 'اتركه فارغاً لصف مؤسس العائلة فقط',
  },
  {
    key: 'الاسم_الاول',
    label: 'الأسم الأول',
    headerColor: '#e8a090',
    required: true,
    example: 'فاروق',
    notes: 'الاسم الأول فقط',
  },
];

export const FAMILY_EXCEL_ACCEPT = '.xlsx,.xls,.csv';

/** CSV column order (left → right in the spreadsheet file). */
function columnsForCsvExport(): ExcelImportColumn[] {
  return [...FAMILY_EXCEL_IMPORT_COLUMNS].reverse();
}

export function buildExcelImportTemplateCsv(): string {
  const columns = columnsForCsvExport();
  const headers = columns.map((column) => column.key);
  const founderRow = columns.map((column) => {
    if (column.key === 'الاسم_الاول') return 'محمد';
    if (column.key === 'الجنس') return 'ذكر';
    if (column.key === 'الحالة') return 'حي';
    if (column.key === 'الحالة_الاجتماعية') return 'غير متزوج';
    return '';
  });
  const exampleRow = columns.map((column) => column.example);

  const escape = (value: string) => `"${value.replace(/"/g, '""')}"`;

  return [
    headers.map(escape).join(','),
    founderRow.map(escape).join(','),
    exampleRow.map(escape).join(','),
  ].join('\n');
}

export function downloadExcelImportTemplate(filename = 'family-import-template.csv'): void {
  const csv = `\uFEFF${buildExcelImportTemplateCsv()}`;
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
