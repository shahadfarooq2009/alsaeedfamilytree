import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { PersonCreateForm } from '../components/PersonCreateForm';
import { logout } from '../services/authService';
import { getFamily } from '../services/personService';
import { resolveAccessibleFamilyId } from '../utils/resolveAccessibleFamilyId';
import { toApiError } from '../lib/api';

export function FamilyPage() {
  const navigate = useNavigate();
  const [familyId, setFamilyId] = useState<number | null>(null);
  const [familyName, setFamilyName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loggingOut, setLoggingOut] = useState(false);

  useEffect(() => {
    let active = true;

    async function loadFamily() {
      try {
        const resolvedFamilyId = await resolveAccessibleFamilyId();
        const response = await getFamily(resolvedFamilyId);
        if (active) {
          setFamilyId(resolvedFamilyId);
          setFamilyName(response.data.name);
        }
      } catch (err) {
        if (active) {
          setError(toApiError(err).message);
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void loadFamily();

    return () => {
      active = false;
    };
  }, []);

  async function handleLogout() {
    setLoggingOut(true);
    try {
      await logout();
    } finally {
      navigate('/login', { replace: true });
    }
  }

  return (
    <div className="min-h-screen px-4 py-10" dir="rtl" lang="ar">
      <header className="mx-auto mb-8 flex max-w-2xl items-center justify-between gap-4">
        <div>
          <p className="text-sm text-gold-500">الصفحة الرئيسية</p>
          <h1 className="text-2xl font-semibold text-olive-900">
            {loading ? 'جاري التحميل...' : familyName ?? 'شجرة العائلة'}
          </h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            to="/family-tree"
            className="rounded-xl border border-gold-300/70 bg-gold-300/15 px-4 py-2 text-sm text-olive-900 transition hover:bg-gold-300/25"
          >
            عرض الشجرة
          </Link>
          <button
            type="button"
          onClick={() => void handleLogout()}
          disabled={loggingOut}
          className="rounded-xl border border-sage-300 px-4 py-2 text-sm text-olive-900 transition hover:bg-ivory-100 disabled:opacity-60"
        >
          {loggingOut ? 'جاري الخروج...' : 'تسجيل الخروج'}
          </button>
        </div>
      </header>

      {error && (
        <div className="mx-auto mb-6 max-w-2xl rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {familyId != null ? (
        <PersonCreateForm
          familyId={familyId}
          onSuccess={(personId) => {
            console.info('تم إنشاء الشخص رقم', personId);
          }}
        />
      ) : null}
    </div>
  );
}
