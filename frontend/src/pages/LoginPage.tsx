import { type FormEvent, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { login, saveSession } from '../services/authService';
import { toApiError } from '../lib/api';

export function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const response = await login({ email, password });
      saveSession(response.access_token);
      navigate('/', { replace: true });
    } catch (err) {
      const apiError = toApiError(err);
      setError(
        apiError.status === 401
          ? 'بيانات الدخول غير صحيحة. تحقق من البريد الإلكتروني وكلمة المرور.'
          : apiError.message,
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-10" dir="rtl" lang="ar">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-md rounded-3xl border border-sage-300/80 bg-white/90 p-8 shadow-xl backdrop-blur"
      >
        <div className="mb-8 text-center">
          <p className="text-sm text-gold-500">شجرة العائلة</p>
          <h1 className="mt-2 text-3xl font-semibold text-olive-900">تسجيل الدخول</h1>
          <p className="mt-2 text-sm text-olive-700">
            سجّل الدخول للوصول إلى سجلات العائلة وإدارة الأفراد.
          </p>
        </div>

        <div className="space-y-5">
          <div className="space-y-2">
            <label htmlFor="email" className="block text-sm font-medium text-olive-900">
              البريد الإلكتروني
            </label>
            <input
              id="email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="w-full rounded-xl border border-sage-300 px-4 py-3 outline-none ring-gold-500/30 focus:ring-2"
              dir="ltr"
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="password" className="block text-sm font-medium text-olive-900">
              كلمة المرور
            </label>
            <input
              id="password"
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="w-full rounded-xl border border-sage-300 px-4 py-3 outline-none ring-gold-500/30 focus:ring-2"
              dir="ltr"
            />
          </div>
        </div>

        {error && (
          <div className="mt-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={submitting}
          className="mt-8 w-full rounded-2xl bg-olive-900 px-6 py-4 text-base font-medium text-white transition hover:bg-olive-700 disabled:opacity-60"
        >
          {submitting ? 'جاري تسجيل الدخول...' : 'دخول'}
        </button>
      </form>
    </div>
  );
}
