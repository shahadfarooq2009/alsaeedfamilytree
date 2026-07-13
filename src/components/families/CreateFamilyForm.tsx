import { type FormEvent, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { REAL_FAMILY_DEFAULT_NAME } from '../../hooks/useMyFamilies';

interface CreateFamilyFormProps {
  creating: boolean;
  onCreate: (name: string, description?: string | null) => Promise<{ id: number }>;
}

export function CreateFamilyForm({ creating, onCreate }: CreateFamilyFormProps) {
  const navigate = useNavigate();
  const [name, setName] = useState(REAL_FAMILY_DEFAULT_NAME);
  const [description, setDescription] = useState('');

  async function submit(openTree: boolean) {
    const trimmedName = name.trim();
    if (!trimmedName) return;

    const family = await onCreate(trimmedName, description.trim() || null);
    if (openTree) {
      navigate(`/family-tree/${family.id}?view=forest`);
    }
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    void submit(false);
  }

  return (
    <form className="create-family-form" onSubmit={handleSubmit}>
      <h2 className="create-family-form__title">إنشاء عائلة جديدة</h2>
      <p className="create-family-form__hint">
        كل عائلة لها بياناتها المنفصلة — لن تختلط مع العائلة التجريبية.
      </p>

      <label className="create-family-form__field">
        <span>اسم العائلة *</span>
        <input
          type="text"
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder={REAL_FAMILY_DEFAULT_NAME}
          required
        />
      </label>

      <label className="create-family-form__field">
        <span>وصف (اختياري)</span>
        <input
          type="text"
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          placeholder="مثال: بيانات العائلة الحقيقية"
        />
      </label>

      <div className="create-family-form__actions">
        <button type="submit" className="create-family-form__submit" disabled={creating}>
          {creating ? 'جاري الإنشاء...' : 'إنشاء العائلة'}
        </button>
        <button
          type="button"
          className="create-family-form__open"
          disabled={creating || !name.trim()}
          onClick={() => void submit(true)}
        >
          إنشاء وفتح الشجرة
        </button>
      </div>
    </form>
  );
}
