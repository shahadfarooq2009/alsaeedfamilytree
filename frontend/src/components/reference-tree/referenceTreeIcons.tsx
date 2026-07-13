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
