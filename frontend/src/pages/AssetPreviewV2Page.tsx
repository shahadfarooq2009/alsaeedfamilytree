import { useMemo } from 'react';

const V2_FILES = [
  'member-leaf-gen-3.png.png',
  'member-leaf-selected.png.png',
  'foliage-clusters.png.png',
] as const;

const rawModules = import.meta.glob(
  '../assets/family-tree/raw/*.png',
  { eager: true, import: 'default' },
) as Record<string, string>;

const v1Modules = import.meta.glob(
  '../assets/family-tree/processed/*.png',
  { eager: true, import: 'default' },
) as Record<string, string>;

const v2Modules = import.meta.glob(
  '../assets/family-tree/processed-v2/*.png',
  { eager: true, import: 'default' },
) as Record<string, string>;

function fileName(path: string): string {
  return path.split('/').pop() ?? path;
}

function CheckerPanel({
  src,
  label,
  background,
}: {
  src: string;
  label: string;
  background: string;
}) {
  return (
    <div className="space-y-2">
      <p className="text-xs font-medium text-[#5c6652]">{label}</p>
      <div
        className="flex min-h-[160px] items-center justify-center rounded-xl border border-[#d8d2c6] p-3"
        style={{ background }}
      >
        <img src={src} alt={label} className="max-h-56 max-w-full object-contain" />
      </div>
    </div>
  );
}

export function AssetPreviewV2Page() {
  const assets = useMemo(() => {
    const rawByName = new Map<string, string>();
    const v1ByName = new Map<string, string>();
    const v2ByName = new Map<string, string>();

    Object.entries(rawModules).forEach(([path, url]) => rawByName.set(fileName(path), url));
    Object.entries(v1Modules).forEach(([path, url]) => v1ByName.set(fileName(path), url));
    Object.entries(v2Modules).forEach(([path, url]) => v2ByName.set(fileName(path), url));

    return V2_FILES.map((name) => ({
      name,
      raw: rawByName.get(name) ?? null,
      v1: v1ByName.get(name) ?? null,
      v2: v2ByName.get(name) ?? null,
    }));
  }, []);

  return (
    <div className="min-h-screen bg-[#f3efe6] px-4 py-8 text-[#2f3628]" dir="rtl">
      <div className="mx-auto max-w-7xl space-y-8">
        <header className="space-y-2">
          <h1 className="text-2xl font-bold">معاينة المعالجة الثانية (v2)</h1>
          <p className="text-sm text-[#5c6652]">
            مقارنة الأصل، النسخة الأولى (processed)، والنسخة المحسّنة (processed-v2)
          </p>
        </header>

        {assets.map((asset) => (
          <section
            key={asset.name}
            className="space-y-4 rounded-2xl border border-[#e2dbd0] bg-white/80 p-5 shadow-sm"
          >
            <h2 className="text-lg font-semibold">{asset.name}</h2>

            <div className="grid gap-4 md:grid-cols-3">
              <CheckerPanel
                src={asset.raw ?? ''}
                label="Original (checkerboard)"
                background="#ffffff"
              />
              <CheckerPanel src={asset.v1 ?? ''} label="Pass 1 (processed)" background="#ffffff" />
              <CheckerPanel src={asset.v2 ?? ''} label="Pass 2 (processed-v2)" background="#ffffff" />
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <CheckerPanel
                src={asset.v2 ?? ''}
                label="v2 on white"
                background="#ffffff"
              />
              <CheckerPanel
                src={asset.v2 ?? ''}
                label="v2 on dark"
                background="#2f3628"
              />
              <CheckerPanel
                src={asset.v2 ?? ''}
                label="v2 on green"
                background="#6f8a57"
              />
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
