import { useCallback, useEffect, useMemo, useState } from 'react';

import type { FamilyTreeFlowHandle } from './FamilyTreeFlow';
import { IconClose } from './referenceTreeIcons';
import {
  buildInviteLink,
  buildShareMessage,
  copyTextToClipboard,
  exportTreeAsPdf,
  exportTreeAsPng,
  getFamilyTreeShareUrl,
  loadShareAccessMode,
  openEmailShare,
  openWhatsAppShare,
  shareViaNative,
} from '../../utils/familyTreeShare';

interface ShareFamilyTreeModalProps {
  open: boolean;
  familyId: number;
  familyName?: string | null;
  memberCount: number;
  exportTargetRef: React.RefObject<HTMLElement | null>;
  flowHandleRef: React.RefObject<FamilyTreeFlowHandle | null>;
  onClose: () => void;
  onToast: (message: string) => void;
}

type ShareAction = 'copy-link' | 'share' | 'png' | 'pdf' | 'invite' | null;

export function ShareFamilyTreeModal({
  open,
  familyId,
  familyName,
  memberCount,
  exportTargetRef,
  flowHandleRef,
  onClose,
  onToast,
}: ShareFamilyTreeModalProps) {
  const [visible, setVisible] = useState(false);
  const [copiedAction, setCopiedAction] = useState<ShareAction>(null);
  const [busyAction, setBusyAction] = useState<ShareAction>(null);
  const [showShareFallback, setShowShareFallback] = useState(false);

  const treeUrl = useMemo(() => getFamilyTreeShareUrl(), [open]);
  const inviteUrl = useMemo(
    () => buildInviteLink(familyId, loadShareAccessMode(familyId)),
    [familyId],
  );

  useEffect(() => {
    if (!open) {
      setVisible(false);
      setCopiedAction(null);
      setBusyAction(null);
      setShowShareFallback(false);
      return undefined;
    }

    const frame = requestAnimationFrame(() => {
      requestAnimationFrame(() => setVisible(true));
    });
    return () => cancelAnimationFrame(frame);
  }, [open]);

  const flashCopied = useCallback((action: ShareAction) => {
    setCopiedAction(action);
    window.setTimeout(() => setCopiedAction(null), 2200);
  }, []);

  const handleCopyLink = useCallback(async () => {
    const copied = await copyTextToClipboard(treeUrl);
    if (copied) {
      flashCopied('copy-link');
      onToast('تم نسخ رابط الشجرة');
    } else {
      onToast('تعذّر نسخ الرابط');
    }
  }, [flashCopied, onToast, treeUrl]);

  const handleCopyInvite = useCallback(async () => {
    const copied = await copyTextToClipboard(inviteUrl);
    if (copied) {
      flashCopied('invite');
      onToast('تم نسخ رابط الدعوة');
    } else {
      onToast('تعذّر نسخ رابط الدعوة');
    }
  }, [flashCopied, inviteUrl, onToast]);

  const handleShare = useCallback(async () => {
    setBusyAction('share');
    const result = await shareViaNative(familyName, treeUrl);
    setBusyAction(null);

    if (result === 'shared') {
      onToast('تمت مشاركة الشجرة');
      return;
    }
    if (result === 'cancelled') return;

    setShowShareFallback(true);
    if (result === 'unsupported') {
      onToast('اختر طريقة المشاركة');
    }
  }, [familyName, onToast, treeUrl]);

  const prepareExport = useCallback(async () => {
    flowHandleRef.current?.fitView();
    await new Promise((resolve) => window.setTimeout(resolve, 850));
  }, [flowHandleRef]);

  const handleExportPng = useCallback(async () => {
    const target = exportTargetRef.current;
    if (!target) {
      onToast('تعذّر تصدير الصورة');
      return;
    }

    setBusyAction('png');
    try {
      await prepareExport();
      await exportTreeAsPng(target, familyName);
      onToast('تم تنزيل صورة الشجرة');
    } catch {
      onToast('تعذّر تصدير الصورة');
    } finally {
      setBusyAction(null);
    }
  }, [exportTargetRef, familyName, onToast, prepareExport]);

  const handleExportPdf = useCallback(async () => {
    const target = exportTargetRef.current;
    if (!target) {
      onToast('تعذّر تصدير PDF');
      return;
    }

    setBusyAction('pdf');
    try {
      await prepareExport();
      await exportTreeAsPdf(target, familyName);
      onToast('تم تنزيل PDF للشجرة');
    } catch {
      onToast('تعذّر تصدير PDF');
    } finally {
      setBusyAction(null);
    }
  }, [exportTargetRef, familyName, onToast, prepareExport]);

  if (!open) return null;

  return (
    <div
      className={`modal-overlay share-tree-overlay${visible ? ' open' : ''}`}
      aria-hidden={!visible}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        className="share-tree-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="shareTreeTitle"
        onClick={(event) => event.stopPropagation()}
      >
        <button type="button" className="modal-close" aria-label="إغلاق" onClick={onClose}>
          <IconClose />
        </button>

        <div className="share-tree-modal__layout">
          <div className="share-tree-modal__hero">
            <div className="share-tree-modal__icon" aria-hidden>🌳</div>
            <h2 id="shareTreeTitle" className="share-tree-modal__title">
              مشاركة شجرة العائلة 🌳
            </h2>
            <p className="share-tree-modal__subtitle">
              شارك تاريخ عائلتك مع أقاربك
            </p>
            <p className="share-tree-modal__meta">
              {familyName?.trim() ? `${familyName.trim()} · ` : ''}
              {memberCount}
              {' '}
              فرد
            </p>
          </div>

          <div className="share-tree-actions">
            <button
              type="button"
              className="share-tree-action"
              onClick={() => void handleCopyLink()}
            >
              <span className="share-tree-action__icon" aria-hidden>🔗</span>
              <span className="share-tree-action__body">
                <strong>نسخ رابط الشجرة</strong>
                <small>انسخ رابط الشجرة الفريد</small>
              </span>
              {copiedAction === 'copy-link' ? (
                <span className="share-tree-action__status">تم النسخ ✓</span>
              ) : null}
            </button>

            <button
              type="button"
              className="share-tree-action"
              disabled={busyAction === 'share'}
              onClick={() => void handleShare()}
            >
              <span className="share-tree-action__icon" aria-hidden>📤</span>
              <span className="share-tree-action__body">
                <strong>مشاركة</strong>
                <small>مشاركة الجهاز أو خيارات بديلة</small>
              </span>
              {busyAction === 'share' ? <span className="share-tree-action__status">...</span> : null}
            </button>

            <button
              type="button"
              className="share-tree-action"
              disabled={busyAction === 'png'}
              onClick={() => void handleExportPng()}
            >
              <span className="share-tree-action__icon" aria-hidden>🖼️</span>
              <span className="share-tree-action__body">
                <strong>تصدير كصورة</strong>
                <small>تنزيل الشجرة بصيغة PNG</small>
              </span>
              {busyAction === 'png' ? <span className="share-tree-action__status">...</span> : null}
            </button>

            <button
              type="button"
              className="share-tree-action"
              disabled={busyAction === 'pdf'}
              onClick={() => void handleExportPdf()}
            >
              <span className="share-tree-action__icon" aria-hidden>📄</span>
              <span className="share-tree-action__body">
                <strong>تصدير PDF</strong>
                <small>إنشاء نسخة PDF من الشجرة</small>
              </span>
              {busyAction === 'pdf' ? <span className="share-tree-action__status">...</span> : null}
            </button>

            {showShareFallback ? (
              <div className="share-tree-fallback share-tree-fallback--wide">
                <button
                  type="button"
                  className="share-tree-fallback__btn"
                  onClick={() => openWhatsAppShare(familyName, treeUrl)}
                >
                  واتساب
                </button>
                <button
                  type="button"
                  className="share-tree-fallback__btn"
                  onClick={() => openEmailShare(familyName, treeUrl)}
                >
                  البريد
                </button>
                <button
                  type="button"
                  className="share-tree-fallback__btn"
                  onClick={() => void handleCopyLink()}
                >
                  نسخ الرابط
                </button>
              </div>
            ) : null}
          </div>

          <section className="share-tree-invite" aria-label="دعوة أفراد العائلة">
            <div className="share-tree-invite__intro">
              <span className="share-tree-action__icon" aria-hidden>👥</span>
              <span className="share-tree-invite__intro-text">
                <strong>دعوة أفراد العائلة</strong>
                <small>شارك رابط دعوة لانضمام الأقارب</small>
              </span>
            </div>
            <label className="share-tree-invite__field">
              <span className="sr-only">رابط الدعوة</span>
              <input
                type="text"
                readOnly
                value={inviteUrl}
                dir="ltr"
                className="share-tree-invite__input"
                onFocus={(event) => event.currentTarget.select()}
              />
            </label>
            <div className="share-tree-invite__actions">
              <button
                type="button"
                className="share-tree-invite__btn"
                onClick={() => void handleCopyInvite()}
              >
                {copiedAction === 'invite' ? 'تم النسخ ✓' : 'نسخ رابط الدعوة'}
              </button>
              <button
                type="button"
                className="share-tree-invite__btn share-tree-invite__btn--ghost"
                onClick={() => openWhatsAppShare(familyName, inviteUrl)}
              >
                إرسال عبر واتساب
              </button>
            </div>
          </section>

          <p className="share-tree-modal__footnote">
            {buildShareMessage(familyName, treeUrl).split('\n')[0]}
          </p>
        </div>
      </div>
    </div>
  );
}
