import { getGenerationPalette } from '../../theme/botanicalTree';
import { botanicalTheme } from '../../theme/botanicalTree';

const LEGEND_ITEMS = [
  { generation: 0, label: 'المؤسس' },
  { generation: 1, label: 'الجيل 1' },
  { generation: 2, label: 'الجيل 2' },
  { generation: 3, label: 'الجيل 3' },
  { generation: 4, label: 'الأجيال التالية' },
];

export function GenerationLegend() {
  return (
    <div
      className="pointer-events-none absolute bottom-4 right-4 z-20 hidden rounded-2xl border px-4 py-3 backdrop-blur-md md:block"
      style={{
        background: botanicalTheme.colors.glass,
        borderColor: botanicalTheme.colors.glassBorder,
      }}
    >
      <p className="mb-2 text-xs font-semibold text-[#9a8450]">دليل الأجيال</p>
      <ul className="space-y-1.5">
        {LEGEND_ITEMS.map((item) => {
          const palette = getGenerationPalette(item.generation);
          return (
            <li key={item.generation} className="flex items-center gap-2 text-xs text-[#2f3628]">
              <span
                className="inline-block h-3 w-5 rounded-full border"
                style={{ background: palette.fill, borderColor: palette.stroke }}
              />
              {item.label}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
