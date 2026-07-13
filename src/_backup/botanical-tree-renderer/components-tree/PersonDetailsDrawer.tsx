import { useEffect, useState, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import type { PersonDetail } from '../../types/person';
import { getPerson } from '../../services/personService';
import { toApiError } from '../../lib/api';
import { botanicalTheme } from '../../theme/botanicalTree';
import { getPersonInitials } from '../../utils/personInitials';

interface PersonDetailsDrawerProps {
  familyId: number;
  personId: number | null;
  onClose: () => void;
}

export function PersonDetailsDrawer({
  familyId,
  personId,
  onClose,
}: PersonDetailsDrawerProps) {
  const [person, setPerson] = useState<PersonDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!personId) {
      setPerson(null);
      return;
    }

    let active = true;
    setLoading(true);
    setError(null);

    void getPerson(familyId, personId)
      .then((response) => {
        if (active) setPerson(response.data);
      })
      .catch((err) => {
        if (active) setError(toApiError(err).message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [familyId, personId]);

  return (
    <AnimatePresence>
      {personId && (
        <>
          <motion.button
            type="button"
            aria-label="إغلاق اللوحة"
            className="fixed inset-0 z-40 bg-[#2f3628]/20 backdrop-blur-[2px] md:bg-transparent md:backdrop-blur-0"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />

          <motion.aside
            className="fixed bottom-0 left-0 right-0 z-50 flex max-h-[78vh] w-full flex-col overflow-hidden rounded-t-[28px] border md:bottom-0 md:left-auto md:right-0 md:top-0 md:h-full md:max-h-none md:w-[min(100%,24rem)] md:rounded-none md:rounded-l-[28px] lg:w-[28rem]"
            style={{
              background: botanicalTheme.colors.drawerBg,
              borderColor: botanicalTheme.colors.drawerBorder,
              boxShadow: botanicalTheme.shadows.drawer,
            }}
            initial={{ y: '100%', x: 0, opacity: 0.9 }}
            animate={{ y: 0, x: 0, opacity: 1 }}
            exit={{ y: '100%', opacity: 0 }}
            transition={{ duration: botanicalTheme.motion.duration, ease: botanicalTheme.motion.ease }}
          >
            <div className="mx-auto mt-3 h-1.5 w-12 rounded-full bg-[#d8cdb2] md:hidden" />

            <div className="flex items-center justify-between border-b px-5 py-4" style={{ borderColor: botanicalTheme.colors.drawerBorder }}>
              <h2 className="text-lg font-semibold text-[#2f3628]">تفاصيل الفرد</h2>
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg px-3 py-1.5 text-sm text-[#5c6652] transition hover:bg-white/60"
              >
                إغلاق
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-5">
              {loading && <p className="text-sm text-[#5c6652]">جاري التحميل...</p>}
              {error && (
                <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {error}
                </p>
              )}

              {person && !loading && (
                <div className="space-y-6">
                  <div className="text-center">
                    {person.photo_url ? (
                      <img
                        src={person.photo_url}
                        alt={person.full_name}
                        className="mx-auto h-24 w-24 rounded-full border-2 object-cover"
                        style={{ borderColor: botanicalTheme.colors.goldSoft }}
                      />
                    ) : (
                      <div
                        className="mx-auto flex h-24 w-24 items-center justify-center rounded-full border-2 text-2xl font-semibold"
                        style={{
                          borderColor: botanicalTheme.colors.goldSoft,
                          background: '#f3ead7',
                          color: '#4a3f1f',
                        }}
                      >
                        {getPersonInitials(person.full_name)}
                      </div>
                    )}

                    <h3 className="mt-4 text-xl font-semibold text-[#2f3628]">{person.full_name}</h3>
                    <span
                      className="mt-2 inline-flex rounded-full px-3 py-1 text-xs font-medium"
                      style={{
                        background: 'rgba(201, 162, 39, 0.14)',
                        color: '#7a6528',
                      }}
                    >
                      الجيل {person.generation_number}
                    </span>
                  </div>

                  <DetailSection title="الوالدان">
                    <DetailRow label="الأب" value={person.father?.full_name} />
                    <DetailRow label="الأم" value={person.mother?.full_name} />
                  </DetailSection>

                  <DetailSection title="الزوج / الزوجة">
                    {person.spouses && person.spouses.length > 0 ? (
                      <ul className="space-y-2">
                        {person.spouses.map((spouse) => (
                          <li
                            key={spouse.id}
                            className="rounded-xl px-3 py-2 text-sm"
                            style={{ background: 'rgba(255,255,255,0.55)' }}
                          >
                            {spouse.full_name}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-sm text-[#5c6652]">لا يوجد زوج مسجل</p>
                    )}
                  </DetailSection>

                  <DetailSection title="الأبناء">
                    {person.children && person.children.length > 0 ? (
                      <ul className="space-y-2">
                        {person.children.map((child) => (
                          <li
                            key={child.id}
                            className="rounded-xl px-3 py-2 text-sm text-[#2f3628]"
                            style={{ background: 'rgba(255,255,255,0.55)' }}
                          >
                            {child.full_name}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-sm text-[#5c6652]">لا يوجد أبناء مسجلون</p>
                    )}
                  </DetailSection>

                  <DetailSection title="معلومات أساسية">
                    <DetailRow label="تاريخ الميلاد" value={person.birth_date} />
                    <DetailRow label="تاريخ الوفاة" value={person.death_date} />
                    <DetailRow label="الهاتف" value={person.phone} />
                    <DetailRow label="المهنة" value={person.occupation} />
                    <DetailRow label="التعليم" value={person.education} />
                    <DetailRow label="الموقع" value={person.location} />
                  </DetailSection>

                  {person.biography && (
                    <DetailSection title="السيرة">
                      <p className="text-sm leading-8 text-[#2f3628]">{person.biography}</p>
                    </DetailSection>
                  )}
                </div>
              )}
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}

function DetailSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h4 className="mb-2 text-sm font-semibold text-[#9a8450]">{title}</h4>
      {children}
    </section>
  );
}

function DetailRow({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b py-2 text-sm last:border-b-0" style={{ borderColor: 'rgba(201,162,39,0.12)' }}>
      <span className="text-[#5c6652]">{label}</span>
      <span className="max-w-[58%] text-left font-medium text-[#2f3628]">{value || '—'}</span>
    </div>
  );
}
