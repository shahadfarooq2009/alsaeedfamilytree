import { Link } from 'react-router-dom';
import type { ReactNode } from 'react';
import { botanicalTheme } from '../../theme/botanicalTree';

interface TreeToolbarProps {
  familyName?: string | null;
  searchSlot: ReactNode;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onFit: () => void;
  onReset?: () => void;
  onFullscreen: () => void;
  isFullscreen: boolean;
}

export function TreeToolbar({
  familyName,
  searchSlot,
  onZoomIn,
  onZoomOut,
  onFit,
  onFullscreen,
  isFullscreen,
}: TreeToolbarProps) {
  return (
    <>
      {/* Top-left family identity */}
      <div className="pointer-events-none absolute left-4 top-4 z-30 md:left-6 md:top-5">
        <div
          className="pointer-events-auto flex items-center gap-3 rounded-2xl border px-3 py-2.5 backdrop-blur-xl"
          style={{
            background: botanicalTheme.colors.glass,
            borderColor: botanicalTheme.colors.glassBorder,
            boxShadow: '0 10px 32px rgba(47, 54, 40, 0.08)',
          }}
        >
          <div
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border"
            style={{
              borderColor: botanicalTheme.colors.gold,
              background: 'linear-gradient(145deg, #faf7ef, #efe6cf)',
            }}
            aria-hidden
          >
            <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none">
              <path
                d="M12 20V10M12 10C12 10 8 8 6 4M12 10C12 10 16 8 18 4M8 14C8 14 5 12 4 9M16 14C16 14 19 12 20 9"
                stroke={botanicalTheme.colors.gold}
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </svg>
          </div>
          <div className="min-w-0 text-right">
            <h1 className="truncate text-sm font-semibold text-[#2f3628] md:text-base">
              {familyName ?? 'الشجرة التفاعلية'}
            </h1>
            <p className="text-[10px] tracking-[0.18em] text-[#9a8450]">FAMILY TREE</p>
          </div>
        </div>
      </div>

      {/* Top-center floating search */}
      <div className="pointer-events-none absolute left-1/2 top-4 z-30 w-[min(92vw,520px)] -translate-x-1/2 md:top-5">
        <div
          className="pointer-events-auto rounded-full border px-4 py-1 backdrop-blur-xl"
          style={{
            background: botanicalTheme.colors.glass,
            borderColor: botanicalTheme.colors.glassBorder,
            boxShadow: '0 10px 32px rgba(47, 54, 40, 0.08)',
          }}
        >
          {searchSlot}
        </div>
      </div>

      {/* Top-right actions */}
      <div className="pointer-events-none absolute right-4 top-4 z-30 flex gap-2 md:right-6 md:top-5">
        <Link
          to="/"
          className="pointer-events-auto flex items-center gap-2 rounded-full border px-4 py-2.5 text-xs font-medium text-[#2f3628] backdrop-blur-xl transition hover:bg-white/85 md:text-sm"
          style={{
            background: botanicalTheme.colors.glass,
            borderColor: botanicalTheme.colors.glassBorder,
            boxShadow: '0 10px 32px rgba(47, 54, 40, 0.08)',
          }}
          title="إضافة فرد"
        >
          <span className="text-base leading-none">+</span>
          <span>إضافة فرد</span>
        </Link>
        <button
          type="button"
          title={isFullscreen ? 'الخروج من ملء الشاشة' : 'القائمة'}
          onClick={onFullscreen}
          className="pointer-events-auto flex h-11 w-11 items-center justify-center rounded-full border text-lg text-[#2f3628] backdrop-blur-xl transition hover:bg-white/85"
          style={{
            background: botanicalTheme.colors.glass,
            borderColor: botanicalTheme.colors.glassBorder,
            boxShadow: '0 10px 32px rgba(47, 54, 40, 0.08)',
          }}
        >
          ☰
        </button>
      </div>

      {/* Left vertical controls */}
      <div className="pointer-events-none absolute left-4 top-1/2 z-30 -translate-y-1/2 md:left-5">
        <div
          className="pointer-events-auto flex flex-col gap-2 rounded-2xl border p-2 backdrop-blur-xl"
          style={{
            background: botanicalTheme.colors.glass,
            borderColor: botanicalTheme.colors.glassBorder,
            boxShadow: '0 10px 32px rgba(47, 54, 40, 0.08)',
          }}
        >
          <Link
            to="/family-tree"
            className="flex h-10 w-10 items-center justify-center rounded-full border text-[#2f3628] transition hover:bg-white/80"
            style={{ borderColor: botanicalTheme.colors.glassBorder }}
            title="الرئيسية"
          >
            <svg viewBox="0 0 24 24" className="h-4.5 w-4.5" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-5v-6H10v6H5a1 1 0 0 1-1-1v-9.5Z" strokeLinejoin="round" />
            </svg>
          </Link>
          <IconButton title="ملاءمة الشاشة" onClick={onFit} label="◎" />
          <IconButton title="تكبير" onClick={onZoomIn} label="+" />
          <IconButton title="تصغير" onClick={onZoomOut} label="−" />
          <IconButton
            title={isFullscreen ? 'الخروج من ملء الشاشة' : 'ملء الشاشة'}
            onClick={onFullscreen}
            label="⛶"
          />
        </div>
      </div>
    </>
  );
}

function IconButton({
  title,
  onClick,
  label,
}: {
  title: string;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className="flex h-10 w-10 items-center justify-center rounded-full border text-base text-[#2f3628] transition hover:bg-white/80"
      style={{ borderColor: botanicalTheme.colors.glassBorder }}
    >
      {label}
    </button>
  );
}
