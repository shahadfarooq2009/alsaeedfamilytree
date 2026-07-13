import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { createPortal } from 'react-dom';

import type { PersonSummary } from '../../types/person';
import type { FamilyMemberInput } from '../../utils/treeLayout/types';
import { computeKinshipRelation } from '../../utils/kinship/computeKinshipRelation';
import { buildKinshipIndex } from '../../utils/kinship/kinshipIndex';
import { IconClose } from '../reference-tree/referenceTreeIcons';
import { KinshipNameField, type KinshipNameFieldHandle } from './KinshipNameField';
import './KinshipSidebar.css';

interface KinshipSidebarProps {
  open: boolean;
  members: FamilyMemberInput[];
  familyId: number;
  people?: PersonSummary[];
  onClose: () => void;
}

export function KinshipSidebar({
  open,
  members,
  familyId,
  people = [],
  onClose,
}: KinshipSidebarProps) {
  const [visible, setVisible] = useState(false);
  const [subjectName, setSubjectName] = useState('');
  const [objectName, setObjectName] = useState('');
  const [resultMessage, setResultMessage] = useState('');
  const [resultDetail, setResultDetail] = useState('');
  const [resultOk, setResultOk] = useState<boolean | null>(null);
  const [hasSearched, setHasSearched] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const subjectFieldRef = useRef<KinshipNameFieldHandle>(null);
  const objectFieldRef = useRef<KinshipNameFieldHandle>(null);
  const resultRef = useRef<HTMLDivElement>(null);

  const kinshipIndex = useMemo(
    () => (members.length > 0 ? buildKinshipIndex(members, familyId, people) : null),
    [familyId, members, people],
  );

  useEffect(() => {
    if (!open) {
      setVisible(false);
      return undefined;
    }

    const frame = window.requestAnimationFrame(() => setVisible(true));
    return () => window.cancelAnimationFrame(frame);
  }, [open]);

  useEffect(() => {
    if (open) return undefined;
    setSubjectName('');
    setObjectName('');
    setResultMessage('');
    setResultDetail('');
    setResultOk(null);
    setHasSearched(false);
    setIsSearching(false);
    return undefined;
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onClose, open]);

  const runSearch = useCallback(() => {
    subjectFieldRef.current?.closeSuggestions();
    objectFieldRef.current?.closeSuggestions();

    const subject = subjectName.trim();
    const object = objectName.trim();

    setHasSearched(true);

    if (!subject || !object) {
      setResultOk(false);
      setResultMessage('يرجى إدخال اسم الشخصين.');
      setResultDetail('اختر الاسم من القائمة المنسدلة أو اكتبه كاملاً كما في الشجرة.');
      return;
    }

    if (members.length === 0 || !kinshipIndex) {
      setResultOk(false);
      setResultMessage('بيانات العائلة غير محمّلة بعد.');
      setResultDetail('انتظر حتى تظهر الشجرة ثم حاول مرة أخرى.');
      return;
    }

    setIsSearching(true);

    try {
      const result = computeKinshipRelation({
        subjectQuery: subject,
        objectQuery: object,
        members,
        familyId,
        people,
        index: kinshipIndex,
      });

      setResultOk(result.ok);
      setResultMessage(result.message);
      setResultDetail(result.detail ?? '');
    } catch {
      setResultOk(false);
      setResultMessage('حدث خطأ أثناء تحليل صلة القرابة.');
      setResultDetail('حاول مرة أخرى أو اختر الأسماء من القائمة المنسدلة.');
    } finally {
      setIsSearching(false);
      window.requestAnimationFrame(() => {
        resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      });
    }
  }, [familyId, kinshipIndex, members, objectName, people, subjectName]);

  const handleSubmit = useCallback((event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    event.stopPropagation();
    runSearch();
  }, [runSearch]);

  if (!open || typeof document === 'undefined') return null;

  return createPortal(
    <div className={`kinship-sidebar-root${visible ? ' is-visible' : ''}`}>
      <button
        type="button"
        className="kinship-sidebar-backdrop"
        aria-label="إغلاق لوحة صلة القرابة"
        onClick={onClose}
      />

      <aside
        className={`kinship-sidebar${visible ? ' is-open' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="kinshipSidebarTitle"
        onPointerDown={(event) => event.stopPropagation()}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="kinship-sidebar__header">
          <div>
            <h2 id="kinshipSidebarTitle" className="kinship-sidebar__title">صلة القرابة</h2>
            <p className="kinship-sidebar__subtitle">
              أدخل اسمين من العائلة لمعرفة صلة القرابة بينهما
            </p>
          </div>
          <button
            type="button"
            className="kinship-sidebar__close"
            aria-label="إغلاق"
            onClick={onClose}
          >
            <IconClose />
          </button>
        </header>

        <form className="kinship-sidebar__form" onSubmit={handleSubmit}>
          <div className="kinship-sidebar__body">
            <KinshipNameField
              ref={subjectFieldRef}
              label="الشخص الأول"
              placeholder="مثال: جان محمد حاجي عبدالله"
              value={subjectName}
              members={members}
              familyId={familyId}
              onChange={setSubjectName}
              onSubmit={runSearch}
            />

            <KinshipNameField
              ref={objectFieldRef}
              label="الشخص الثاني"
              placeholder="مثال: مريم جان محمد حاجي عبدالله"
              value={objectName}
              members={members}
              familyId={familyId}
              onChange={setObjectName}
              onSubmit={runSearch}
            />

            <button
              type="submit"
              className="kinship-sidebar__submit"
              disabled={isSearching}
            >
              {isSearching ? 'جاري البحث...' : 'أوجد صلة القرابة'}
            </button>

            {hasSearched && resultMessage ? (
              <div
                ref={resultRef}
                className={[
                  'kinship-sidebar__result',
                  resultOk === true ? 'is-success' : resultOk === false ? 'is-error' : 'is-neutral',
                ].join(' ')}
                role="status"
                aria-live="polite"
              >
                <strong>{resultMessage}</strong>
                {resultDetail ? <p>{resultDetail}</p> : null}
              </div>
            ) : !hasSearched ? (
              <div className="kinship-sidebar__result is-neutral">
                <strong>اختر الاسمين من القائمة ثم اضغط الزر.</strong>
              </div>
            ) : null}
          </div>
        </form>
      </aside>
    </div>,
    document.body,
  );
}
