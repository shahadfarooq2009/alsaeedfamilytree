import { useRef, useState } from 'react';

import {
  downloadExcelImportTemplate,
  FAMILY_EXCEL_ACCEPT,
  FAMILY_EXCEL_IMPORT_COLUMNS,
} from '../../utils/familyExcelImport';
import { IconClose } from '../reference-tree/referenceTreeIcons';

interface FamilyExcelImportModalProps {
  open: boolean;
  familyName: string;
  onClose: () => void;
}

export function FamilyExcelImportModal({
  open,
  familyName,
  onClose,
}: FamilyExcelImportModalProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  function handleClose() {
    setSelectedFile(null);
    if (inputRef.current) {
      inputRef.current.value = '';
    }
    onClose();
  }

  function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;
    setSelectedFile(file);
  }

  if (!open) return null;

  return (
    <div
      className="modal-overlay excel-import-overlay open"
      aria-hidden={!open}
      onClick={(event) => {
        if (event.target === event.currentTarget) handleClose();
      }}
    >
      <div
        className="excel-import-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="excelImportTitle"
        onClick={(event) => event.stopPropagation()}
      >
        <button
          type="button"
          className="excel-import-modal__close"
          aria-label="إغلاق"
          onClick={handleClose}
        >
          <IconClose />
        </button>

        <p className="excel-import-modal__eyebrow">استيراد أفراد العائلة</p>
        <h2 id="excelImportTitle" className="excel-import-modal__title">
          رفع ملف Excel
        </h2>
        <p className="excel-import-modal__subtitle">
          العائلة: <strong>{familyName}</strong>
        </p>

        <div className="excel-import-modal__actions">
          <button
            type="button"
            className="excel-import-modal__template-btn"
            onClick={() => downloadExcelImportTemplate()}
          >
            تحميل نموذج Excel (CSV)
          </button>

          <label className="excel-import-modal__upload-btn">
            <input
              ref={inputRef}
              type="file"
              accept={FAMILY_EXCEL_ACCEPT}
              className="excel-import-modal__file-input"
              onChange={handleFileChange}
            />
            اختيار ملف Excel
          </label>
        </div>

        {selectedFile ? (
          <p className="excel-import-modal__file-name">
            الملف المختار: <strong>{selectedFile.name}</strong>
          </p>
        ) : null}

        <p className="excel-import-modal__note">
          رتّب الصفوف من الأقدم للأحدث (المؤسس ثم أبناؤه ثم أحفاده). الصف الأول في الملف
          يجب أن يحتوي على نفس العناوين أدناه.
        </p>

        <div className="excel-import-header-preview" dir="rtl" aria-label="عناوين أعمدة Excel">
          {FAMILY_EXCEL_IMPORT_COLUMNS.map((column) => (
            <div
              key={column.key}
              className="excel-import-header-preview__cell"
              style={{ backgroundColor: column.headerColor }}
            >
              {column.headerHint ? (
                <span className="excel-import-header-preview__hint">{column.headerHint}</span>
              ) : null}
              <span className="excel-import-header-preview__label">{column.label}</span>
            </div>
          ))}
        </div>

        <div className="excel-import-modal__table-wrap">
          <table className="excel-import-modal__table">
            <thead>
              <tr>
                <th>العمود</th>
                <th>مطلوب؟</th>
                <th>مثال</th>
                <th>ملاحظات</th>
              </tr>
            </thead>
            <tbody>
              {FAMILY_EXCEL_IMPORT_COLUMNS.map((column) => (
                <tr key={column.key}>
                  <td>
                    <span
                      className="excel-import-modal__swatch"
                      style={{ backgroundColor: column.headerColor }}
                      aria-hidden
                    />
                    <strong>{column.label}</strong>
                    <code>{column.key}</code>
                  </td>
                  <td>{column.required ? 'نعم' : 'لا'}</td>
                  <td>{column.example}</td>
                  <td>{column.notes}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
