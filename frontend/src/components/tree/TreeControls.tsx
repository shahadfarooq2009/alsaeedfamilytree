interface TreeControlsProps {
  onZoomIn: () => void;
  onZoomOut: () => void;
  onFit: () => void;
  onReset: () => void;
}

export function TreeControls({
  onZoomIn,
  onZoomOut,
  onFit,
  onReset,
}: TreeControlsProps) {
  return (
    <div className="flex flex-wrap gap-2">
      <button
        type="button"
        onClick={onZoomIn}
        className="rounded-xl border border-sage-300 bg-white px-4 py-2 text-sm text-olive-900 hover:bg-ivory-100"
      >
        تكبير
      </button>
      <button
        type="button"
        onClick={onZoomOut}
        className="rounded-xl border border-sage-300 bg-white px-4 py-2 text-sm text-olive-900 hover:bg-ivory-100"
      >
        تصغير
      </button>
      <button
        type="button"
        onClick={onFit}
        className="rounded-xl border border-sage-300 bg-white px-4 py-2 text-sm text-olive-900 hover:bg-ivory-100"
      >
        ملاءمة الشاشة
      </button>
      <button
        type="button"
        onClick={onReset}
        className="rounded-xl border border-sage-300 bg-white px-4 py-2 text-sm text-olive-900 hover:bg-ivory-100"
      >
        إعادة العرض
      </button>
    </div>
  );
}
