import { Link, useNavigate } from 'react-router-dom';
import { useState } from 'react';

import { CreateFamilyForm } from '../components/families/CreateFamilyForm';
import { FamilyExcelImportModal } from '../components/families/FamilyExcelImportModal';
import { FamilySwitcher } from '../components/families/FamilySwitcher';
import { useMyFamilies } from '../hooks/useMyFamilies';
import { getAuthUser, logout } from '../services/authService';
import { getFamilyDataLabel } from '../utils/familyDataLabel';
import { isTreeAdminUser } from '../utils/treeAdmin';

export function FamilyPage() {
  const navigate = useNavigate();
  const { families, loading, error, creating, deletingFamilyId, createNewFamily, removeFamily } = useMyFamilies();
  const [loggingOut, setLoggingOut] = useState(false);
  const [importFamily, setImportFamily] = useState<{ id: number; name: string } | null>(null);
  const isAdmin = isTreeAdminUser(getAuthUser());

  async function handleDeleteFamily(family: { id: number; name: string }) {
    const confirmed = window.confirm(
      `هل تريد حذف «${family.name}»؟\nسيتم حذف جميع أفراد العائلة نهائيًا ولا يمكن التراجع.`,
    );
    if (!confirmed) return;

    try {
      await removeFamily(family.id);
    } catch {
      // Error shown via hook state.
    }
  }

  async function handleLogout() {
    setLoggingOut(true);
    try {
      await logout();
    } finally {
      navigate('/login', { replace: true });
    }
  }

  return (
    <div className="families-page" dir="rtl" lang="ar">
      <header className="families-page__header">
        <div>
          <p className="families-page__eyebrow">إدارة العائلات</p>
          <h1>عائلاتي</h1>
          <p className="families-page__subtitle">
            اختر عائلة لعرض شجرتها، أو أنشئ عائلة جديدة للبيانات الحقيقية.
          </p>
        </div>
        <button
          type="button"
          className="families-page__logout"
          onClick={() => void handleLogout()}
          disabled={loggingOut}
        >
          {loggingOut ? 'جاري الخروج...' : 'تسجيل الخروج'}
        </button>
      </header>

      {error ? (
        <div className="families-page__error" role="alert">
          {error}
        </div>
      ) : null}

      <section className="families-page__section">
        <h2>عائلاتك</h2>
        {loading ? (
          <p className="families-page__loading">جاري تحميل العائلات...</p>
        ) : (
          <ul className="families-page__cards">
            {families.map((family) => {
              const label = getFamilyDataLabel(family.name);
              return (
                <li key={family.id} className="families-page__card">
                  <div className="families-page__card-body">
                    <strong>{family.name}</strong>
                    {label ? <span className="families-page__card-tag">{label}</span> : null}
                    {family.description ? (
                      <p className="families-page__card-desc">{family.description}</p>
                    ) : null}
                  </div>
                  <div className="families-page__card-actions">
                    <Link
                      to={`/family-tree/${family.id}?view=forest`}
                      className="families-page__card-link"
                    >
                      فتح الشجرة
                    </Link>
                    {isAdmin ? (
                      <button
                        type="button"
                        className="families-page__card-import"
                        onClick={() => setImportFamily({ id: family.id, name: family.name })}
                      >
                        رفع Excel
                      </button>
                    ) : null}
                    <button
                      type="button"
                      className="families-page__card-delete"
                      disabled={deletingFamilyId === family.id}
                      onClick={() => void handleDeleteFamily(family)}
                    >
                      {deletingFamilyId === family.id ? 'جاري الحذف...' : 'حذف'}
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="families-page__section">
        <CreateFamilyForm
          creating={creating}
          onCreate={createNewFamily}
        />
      </section>

      {families.length > 0 ? (
        <section className="families-page__section families-page__section--switcher">
          <FamilySwitcher families={families} />
        </section>
      ) : null}

      <FamilyExcelImportModal
        open={importFamily != null}
        familyName={importFamily?.name ?? ''}
        onClose={() => setImportFamily(null)}
      />
    </div>
  );
}
