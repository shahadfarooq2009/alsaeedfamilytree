import type { SVGProps } from 'react';

type IconProps = SVGProps<SVGSVGElement>;

export function IconUsers(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className="ico" aria-hidden {...props}>
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

export function IconGenerations(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className="ico stat-ico" aria-hidden {...props}>
      <rect x="5" y="3" width="14" height="18" rx="2" />
      <path d="M9 7h6M9 11h6M9 15h4" />
    </svg>
  );
}

export function IconPerson(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className="ico stat-ico" aria-hidden {...props}>
      <circle cx="12" cy="8" r="4" />
      <path d="M6 21v-1a6 6 0 0 1 12 0v1" />
    </svg>
  );
}

export function IconGrandchildren(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className="ico stat-ico" aria-hidden {...props}>
      <circle cx="9" cy="9" r="3" />
      <circle cx="17" cy="11" r="2.4" />
      <path d="M3 20v-1a5 5 0 0 1 10 0v1M14 20v-.5a4 4 0 0 1 7 0v.5" />
    </svg>
  );
}

export function IconSearch(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className="ico" aria-hidden {...props}>
      <circle cx="11" cy="11" r="7" />
      <path d="M21 21l-4.3-4.3" />
    </svg>
  );
}

export function IconCalendar(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className="ico field-ico" aria-hidden {...props}>
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M3 10h18M8 3v4M16 3v4" />
    </svg>
  );
}

export function IconPhone(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className="ico field-ico" aria-hidden {...props}>
      <path d="M6.5 4h3l2 5-2.5 1.5a11 11 0 0 0 5 5L13.5 13 19 15v3a2 2 0 0 1-2 2A15 15 0 0 1 4 6.5 2 2 0 0 1 6.5 4z" />
    </svg>
  );
}

export function IconHeartPulse(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className="ico field-ico" aria-hidden {...props}>
      <path d="M12 21s-6-4.35-6-9a4 4 0 0 1 7-2.35A4 4 0 0 1 20 12c0 4.65-6 9-6 9z" fill="none" />
    </svg>
  );
}

export function IconMemorial(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className="ico field-ico" aria-hidden {...props}>
      <path d="M12 3v15" />
      <path d="M8 7h8" />
      <path d="M9 21h6" />
    </svg>
  );
}

export function IconChevron(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className="ico chev" aria-hidden {...props}>
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}

export function IconClose(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className="ico" aria-hidden {...props}>
      <path d="M18 6L6 18M6 6l12 12" />
    </svg>
  );
}

export function IconFullscreen(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className="ico" aria-hidden {...props}>
      <path d="M4 9V5a1 1 0 0 1 1-1h4M20 9V5a1 1 0 0 0-1-1h-4M4 15v4a1 1 0 0 0 1 1h4M20 15v4a1 1 0 0 1-1 1h-4" />
    </svg>
  );
}

export function IconZoomIn(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className="ico" aria-hidden {...props}>
      <circle cx="11" cy="11" r="7" />
      <path d="M21 21l-4.3-4.3M11 8v6M8 11h6" />
    </svg>
  );
}

export function IconZoomOut(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className="ico" aria-hidden {...props}>
      <circle cx="11" cy="11" r="7" />
      <path d="M21 21l-4.3-4.3M8 11h6" />
    </svg>
  );
}

export function IconRecenter(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className="ico" aria-hidden {...props}>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
    </svg>
  );
}

export function IconMoveMap(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className="ico" aria-hidden {...props}>
      <path d="M12 2v20M2 12h20" />
      <path d="M8 6l4-4 4 4M8 18l4 4 4-4M6 8l-4 4 4 4M18 8l4 4-4 4" />
    </svg>
  );
}

export function IconLockPosition(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className="ico" aria-hidden {...props}>
      <rect x="5" y="11" width="14" height="10" rx="2" />
      <path d="M8 11V8a4 4 0 0 1 8 0v3" />
    </svg>
  );
}

export function IconShare(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className="ico" aria-hidden {...props}>
      <circle cx="18" cy="5" r="3" />
      <circle cx="6" cy="12" r="3" />
      <circle cx="18" cy="19" r="3" />
      <path d="M8.6 13.5l6.8 4M15.4 6.5l-6.8 4" />
    </svg>
  );
}

export function IconDownload(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className="ico" aria-hidden {...props}>
      <path d="M12 4v11" />
      <path d="M8.5 11.5L12 15l3.5-3.5" />
      <path d="M5 19h14" />
    </svg>
  );
}

export function IconPrint(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className="ico" aria-hidden {...props}>
      <path d="M7 9V3h10v6" />
      <rect x="5" y="9" width="14" height="8" rx="2" />
      <path d="M7 14h10v7H7z" />
      <path d="M9 17h6" />
    </svg>
  );
}

export function IconAddPerson(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className="ico" aria-hidden {...props}>
      <circle cx="12" cy="8" r="4" />
      <path d="M6 21v-1a6 6 0 0 1 11.5-2.5" />
      <path d="M19 8v6M16 11h6" />
    </svg>
  );
}

export function IconSaveTree(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className="ico" aria-hidden {...props}>
      <path d="M12 22V12M12 12C9 10 5 11 5 15c0 4 3.5 6 7 7 3.5-1 7-3 7-7 0-4-4-5-7-3z" />
    </svg>
  );
}

export function IconChild(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className="ico stat-ico" aria-hidden {...props}>
      <circle cx="12" cy="7.5" r="3.2" />
      <path d="M8 20v-1.2a4 4 0 0 1 8 0V20" />
    </svg>
  );
}

export function IconGenderMale(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className="gender-ico" aria-hidden {...props}>
      <circle cx="10" cy="14" r="5" />
      <path d="M16 8h5v5M19 8l-5 5" />
    </svg>
  );
}

export function IconGenderFemale(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className="gender-ico" aria-hidden {...props}>
      <circle cx="12" cy="9" r="5" />
      <path d="M12 14v7M9 18h6" />
    </svg>
  );
}

export function IconCamera(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className="ico add-member-camera-ico" aria-hidden {...props}>
      <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
      <circle cx="12" cy="13" r="4" />
    </svg>
  );
}

export function IconEdit(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className="ico" aria-hidden {...props}>
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z" />
    </svg>
  );
}

export function IconTrash(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className="ico" aria-hidden {...props}>
      <path d="M3 6h18" />
      <path d="M8 6V4h8v2" />
      <path d="M19 6l-1 14H6L5 6" />
      <path d="M10 11v6M14 11v6" />
    </svg>
  );
}
