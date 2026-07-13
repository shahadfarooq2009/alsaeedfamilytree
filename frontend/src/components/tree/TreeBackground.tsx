import { botanicalTheme } from '../../theme/botanicalTree';

export function TreeBackground() {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 overflow-hidden"
      style={{
        background: `linear-gradient(180deg, ${botanicalTheme.colors.canvasBg} 0%, ${botanicalTheme.colors.canvasBgMid} 45%, ${botanicalTheme.colors.canvasBgEnd} 100%)`,
      }}
    >
      <div
        className="absolute inset-0"
        style={{
          backgroundImage:
            'radial-gradient(circle at 50% 12%, rgba(255,255,255,0.78), transparent 52%), radial-gradient(circle at 80% 22%, rgba(255,255,255,0.35), transparent 40%)',
        }}
      />

      <svg
        className="absolute bottom-0 left-0 h-[44%] w-full opacity-25"
        viewBox="0 0 1400 360"
        preserveAspectRatio="none"
      >
        <path
          d="M0 290 C200 240 320 255 500 215 C660 180 820 195 1000 168 C1140 148 1260 168 1400 142 L1400 360 L0 360 Z"
          fill={botanicalTheme.colors.mountainDeep}
        />
        <path
          d="M0 310 C260 278 420 282 600 252 C780 222 980 238 1180 212 L1400 198 L1400 360 L0 360 Z"
          fill={botanicalTheme.colors.mountain}
          opacity="0.72"
        />
      </svg>

      <div
        className="absolute inset-x-0 bottom-[18%] h-28 opacity-40"
        style={{
          background: `linear-gradient(180deg, transparent, ${botanicalTheme.colors.horizonWater})`,
        }}
      />

      <div
        className="absolute inset-x-0 top-0 h-56"
        style={{
          background: `linear-gradient(180deg, ${botanicalTheme.colors.mist}, transparent)`,
        }}
      />

      <div
        className="absolute inset-x-0 bottom-0 h-28"
        style={{
          background: 'linear-gradient(0deg, rgba(210, 204, 190, 0.28), transparent)',
        }}
      />
    </div>
  );
}
