import { type FormEvent, useMemo, useState } from 'react';
import type { CreatePersonPayload, Gender, ParentCandidate } from '../types/person';
import { createPerson } from '../services/personService';
import { useParentSearch } from '../hooks/useParentSearch';
import { toApiError } from '../lib/api';

interface PersonCreateFormProps {
  familyId: number;
  onSuccess?: (personId: number) => void;
}

function ParentSelector({
  label,
  placeholder,
  selected,
  onSelect,
  onClear,
  familyId,
  gender,
}: {
  label: string;
  placeholder: string;
  selected: ParentCandidate | null;
  onSelect: (candidate: ParentCandidate) => void;
  onClear: () => void;
  familyId: number;
  gender: 'male' | 'female';
}) {
  const { query, setQuery, results, loading } = useParentSearch({ familyId, gender });

  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-olive-900">{label}</label>

      {selected ? (
        <div className="flex items-center justify-between rounded-xl border border-sage-300 bg-white px-4 py-3">
          <div>
            <p className="font-medium text-olive-900">{selected.full_name}</p>
            <p className="text-xs text-olive-700">
              الجيل {selected.generation_number}
              {selected.birth_date ? ` • ${selected.birth_date.slice(0, 4)}` : ''}
            </p>
          </div>
          <button
            type="button"
            onClick={onClear}
            className="text-sm text-olive-700 hover:text-olive-900"
          >
            إزالة
          </button>
        </div>
      ) : (
        <div className="relative">
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={placeholder}
            className="w-full rounded-xl border border-sage-300 bg-white px-4 py-3 text-olive-900 outline-none ring-gold-500/30 focus:ring-2"
            dir="rtl"
          />
          {(loading || results.length > 0) && query.trim() && (
            <ul className="absolute z-20 mt-2 max-h-56 w-full overflow-auto rounded-xl border border-sage-300 bg-white shadow-lg">
              {loading && (
                <li className="px-4 py-3 text-sm text-olive-700">جاري البحث...</li>
              )}
              {!loading && results.length === 0 && (
                <li className="px-4 py-3 text-sm text-olive-700">لا توجد نتائج</li>
              )}
              {results.map((candidate) => (
                <li key={candidate.id}>
                  <button
                    type="button"
                    onClick={() => {
                      onSelect(candidate);
                      setQuery('');
                    }}
                    className="flex w-full flex-col items-start px-4 py-3 text-right hover:bg-ivory-100"
                  >
                    <span className="font-medium text-olive-900">{candidate.full_name}</span>
                    <span className="text-xs text-olive-700">
                      {candidate.father_name ? `ابن ${candidate.father_name}` : 'بدون أب مسجل'}
                      {' • '}الجيل {candidate.generation_number}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

export function PersonCreateForm({ familyId, onSuccess }: PersonCreateFormProps) {
  const [firstName, setFirstName] = useState('');
  const [middleName, setMiddleName] = useState('');
  const [lastName, setLastName] = useState('');
  const [gender, setGender] = useState<Gender>('male');
  const [birthDate, setBirthDate] = useState('');
  const [deathDate, setDeathDate] = useState('');
  const [isFamilyHead, setIsFamilyHead] = useState(false);
  const [father, setFather] = useState<ParentCandidate | null>(null);
  const [mother, setMother] = useState<ParentCandidate | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});

  const previewName = useMemo(
    () => [firstName, middleName, lastName].filter(Boolean).join(' '),
    [firstName, middleName, lastName],
  );

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    setFieldErrors({});

    const payload: CreatePersonPayload = {
      first_name: firstName.trim(),
      middle_name: middleName.trim() || null,
      last_name: lastName.trim() || null,
      gender,
      birth_date: birthDate || null,
      death_date: deathDate || null,
      is_family_head: isFamilyHead,
      father_id: father?.id ?? null,
      mother_id: mother?.id ?? null,
    };

    try {
      const response = await createPerson(familyId, payload);
      onSuccess?.(response.data.id);
      setFirstName('');
      setMiddleName('');
      setLastName('');
      setBirthDate('');
      setDeathDate('');
      setFather(null);
      setMother(null);
      setIsFamilyHead(false);
    } catch (err) {
      const apiError = toApiError(err);
      setError(apiError.message);
      setFieldErrors(apiError.errors ?? {});
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="mx-auto max-w-2xl rounded-3xl border border-sage-300/80 bg-white/90 p-8 shadow-xl backdrop-blur"
      dir="rtl"
    >
      <div className="mb-8 text-center">
        <p className="text-sm text-gold-500">المرحلة الأولى</p>
        <h1 className="mt-2 text-3xl font-semibold text-olive-900">إضافة فرد إلى الشجرة</h1>
        <p className="mt-2 text-sm text-olive-700">
          يتم ربط الأب والأم من السجلات الموجودة فقط — لا يتم استنتاج العلاقات من الأسماء.
        </p>
      </div>

      <div className="grid gap-5 md:grid-cols-3">
        <div className="space-y-2">
          <label className="block text-sm font-medium text-olive-900">الاسم الأول</label>
          <input
            required
            value={firstName}
            onChange={(event) => setFirstName(event.target.value)}
            className="w-full rounded-xl border border-sage-300 px-4 py-3 outline-none ring-gold-500/30 focus:ring-2"
          />
        </div>
        <div className="space-y-2">
          <label className="block text-sm font-medium text-olive-900">اسم الأب</label>
          <input
            value={middleName}
            onChange={(event) => setMiddleName(event.target.value)}
            className="w-full rounded-xl border border-sage-300 px-4 py-3 outline-none ring-gold-500/30 focus:ring-2"
          />
        </div>
        <div className="space-y-2">
          <label className="block text-sm font-medium text-olive-900">اسم العائلة</label>
          <input
            value={lastName}
            onChange={(event) => setLastName(event.target.value)}
            className="w-full rounded-xl border border-sage-300 px-4 py-3 outline-none ring-gold-500/30 focus:ring-2"
          />
        </div>
      </div>

      {previewName && (
        <p className="mt-4 rounded-xl bg-ivory-100 px-4 py-3 text-sm text-olive-700">
          الاسم الكامل: <span className="font-medium text-olive-900">{previewName}</span>
        </p>
      )}

      <div className="mt-5 grid gap-5 md:grid-cols-2">
        <div className="space-y-2">
          <label className="block text-sm font-medium text-olive-900">الجنس</label>
          <select
            value={gender}
            onChange={(event) => setGender(event.target.value as Gender)}
            className="w-full rounded-xl border border-sage-300 px-4 py-3 outline-none ring-gold-500/30 focus:ring-2"
          >
            <option value="male">ذكر</option>
            <option value="female">أنثى</option>
            <option value="other">آخر</option>
          </select>
        </div>
        <label className="flex items-center gap-3 rounded-xl border border-gold-300/60 bg-gold-300/10 px-4 py-3 text-sm text-olive-900">
          <input
            type="checkbox"
            checked={isFamilyHead}
            onChange={(event) => setIsFamilyHead(event.target.checked)}
            className="size-4 accent-gold-500"
          />
          مؤسس العائلة (الجذر)
        </label>
      </div>

      <div className="mt-5 grid gap-5 md:grid-cols-2">
        <div className="space-y-2">
          <label className="block text-sm font-medium text-olive-900">تاريخ الميلاد</label>
          <input
            type="date"
            value={birthDate}
            onChange={(event) => setBirthDate(event.target.value)}
            className="w-full rounded-xl border border-sage-300 px-4 py-3 outline-none ring-gold-500/30 focus:ring-2"
          />
        </div>
        <div className="space-y-2">
          <label className="block text-sm font-medium text-olive-900">تاريخ الوفاة</label>
          <input
            type="date"
            value={deathDate}
            onChange={(event) => setDeathDate(event.target.value)}
            className="w-full rounded-xl border border-sage-300 px-4 py-3 outline-none ring-gold-500/30 focus:ring-2"
          />
        </div>
      </div>

      <div className="mt-6 grid gap-5 md:grid-cols-2">
        <ParentSelector
          label="الأب (من السجلات)"
          placeholder="ابحث باسم الأب..."
          selected={father}
          onSelect={setFather}
          onClear={() => setFather(null)}
          familyId={familyId}
          gender="male"
        />
        <ParentSelector
          label="الأم (من السجلات)"
          placeholder="ابحث باسم الأم..."
          selected={mother}
          onSelect={setMother}
          onClear={() => setMother(null)}
          familyId={familyId}
          gender="female"
        />
      </div>

      {(fieldErrors.father_id || fieldErrors.mother_id) && (
        <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {fieldErrors.father_id?.[0] ?? fieldErrors.mother_id?.[0]}
        </div>
      )}

      {error && (
        <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={submitting}
        className="mt-8 w-full rounded-2xl bg-olive-900 px-6 py-4 text-base font-medium text-white transition hover:bg-olive-700 disabled:opacity-60"
      >
        {submitting ? 'جاري الحفظ...' : 'حفظ الفرد'}
      </button>
    </form>
  );
}
