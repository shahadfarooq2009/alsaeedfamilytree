import { resolveMemberPhotoUrl } from '../../assets/avatars/catalog';

interface MemberAvatarBadgeProps {
  photoUrl?: string | null;
  initial: string;
  className?: string;
  size?: 'regular' | 'founder';
  sizePx?: number;
  onClick?: (event: React.MouseEvent<HTMLSpanElement>) => void;
}

export function MemberAvatarBadge({
  photoUrl,
  initial,
  className = '',
  size = 'regular',
  sizePx,
  onClick,
}: MemberAvatarBadgeProps) {
  const src = resolveMemberPhotoUrl(photoUrl ?? null);
  const interactive = Boolean(onClick);
  const sizeStyle = sizePx
    ? {
        width: `${sizePx}px`,
        height: `${sizePx}px`,
        top: `${-Math.round(sizePx / 2)}px`,
        fontSize: `${Math.max(7, Math.round(sizePx * 0.46))}px`,
      }
    : undefined;

  if (src) {
    return (
      <span
        className={`badge badge--photo badge--${size}${interactive ? ' badge--interactive' : ''} ${className}`.trim()}
        style={sizeStyle}
        onClick={onClick}
        onKeyDown={interactive ? (event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            onClick?.(event as unknown as React.MouseEvent<HTMLSpanElement>);
          }
        } : undefined}
        role={interactive ? 'button' : undefined}
        tabIndex={interactive ? 0 : undefined}
        aria-label={interactive ? 'تغيير الصورة الشخصية' : undefined}
      >
        <img src={src} alt="" />
      </span>
    );
  }

  return (
    <span
      className={`badge badge--${size}${interactive ? ' badge--interactive' : ''} ${className}`.trim()}
      style={sizeStyle}
      onClick={onClick}
      onKeyDown={interactive ? (event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onClick?.(event as unknown as React.MouseEvent<HTMLSpanElement>);
        }
      } : undefined}
      role={interactive ? 'button' : undefined}
      tabIndex={interactive ? 0 : undefined}
      aria-label={interactive ? 'اختيار صورة شخصية' : undefined}
    >
      {initial}
    </span>
  );
}
