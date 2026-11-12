import React, { useEffect, useMemo, useRef, useState } from "react";
import { Receipt, ChevronDown, Check } from "lucide-react";
import { monthFull, monthRange, salesPeriodLabel, defaultSalesMonths } from "../../lib/salesUtils";

const MONTH_LABELS = ["Січ", "Лют", "Бер", "Кві", "Тра", "Чер", "Лип", "Сер", "Вер", "Жов", "Лис", "Гру"];

/**
 * Фільтр «Період продаж»: місяці, за які є фактичні продажі.
 * Перший клік — один місяць, другий клік — кінець діапазону (наприклад, січень–березень).
 * Кілька місяців → у таблицях середні продажі за місяць.
 */
export function SalesPeriodDropdown({ available = [], selected = [], onChange }) {
  const [isOpen, setIsOpen] = useState(false);
  const [rangeStart, setRangeStart] = useState(null);
  const ref = useRef(null);

  useEffect(() => {
    if (!isOpen) { setRangeStart(null); return; }
    const onDown = (e) => { if (ref.current && !ref.current.contains(e.target)) setIsOpen(false); };
    const onKey = (e) => e.key === "Escape" && setIsOpen(false);
    document.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [isOpen]);

  const years = useMemo(() => [...new Set(available.map(m => m.slice(0, 4)))].sort().reverse(), [available]);
  const availableSet = useMemo(() => new Set(available), [available]);
  const selectedSet = useMemo(() => new Set(selected), [selected]);

  const pickMonth = (m) => {
    if (!rangeStart) {
      setRangeStart(m);
      onChange([m]);
    } else {
      onChange(monthRange(available, rangeStart, m));
      setRangeStart(null);
    }
  };

  const last = available[available.length - 1];
  const lastYear = last ? last.slice(0, 4) : null;
  const presets = [
    { id: "last", label: "Останній місяць", months: defaultSalesMonths(available) },
    { id: "last3", label: "Останні 3 міс.", months: available.slice(-3) },
    { id: "ytd", label: `З початку ${lastYear || ""} р.`, months: available.filter(m => m.startsWith(lastYear || "")) },
    { id: "all", label: "Весь період", months: available },
  ];
  const isSame = (a, b) => a.length === b.length && a.every((m, i) => m === b[i]);

  const hasData = available.length > 0;
  const isMulti = selected.length > 1;

  return (
    <div className={`relative inline-block text-left ${isOpen ? "z-[60]" : "z-10"}`} ref={ref}>
      <button
        type="button"
        onClick={() => hasData && setIsOpen(o => !o)}
        disabled={!hasData}
        className="flex items-center gap-1.5 h-9 px-3 rounded-xl text-xs font-medium border transition-all duration-200 select-none bg-emerald-600/10 border-emerald-500/30 text-emerald-200 hover:bg-emerald-600/15 disabled:opacity-50 disabled:cursor-not-allowed"
        title={hasData ? "Період фактичних продажів (з 1С)" : "Фактичних продажів ще немає"}
      >
        <Receipt className="h-3.5 w-3.5 shrink-0 text-emerald-400" />
        <span className="text-white/70">Період продаж:</span>
        <span className="font-semibold text-white truncate max-w-[180px]">
          {hasData ? salesPeriodLabel(selected) : "немає даних"}
        </span>
        {isMulti && (
          <span className="inline-flex items-center px-1.5 rounded-full bg-emerald-500/25 text-emerald-200 text-[10px] font-bold leading-4">
            сер. {selected.length} міс.
          </span>
        )}
        <ChevronDown className={`h-3 w-3 shrink-0 ml-0.5 text-muted-foreground transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`} />
      </button>

      {isOpen && (
        <div className="absolute left-0 mt-2 w-[300px] rounded-2xl bg-[#0f172a] border border-white/20 shadow-[0_25px_60px_rgba(0,0,0,0.9)] z-[70] overflow-hidden animate-in fade-in zoom-in-95 duration-150">
          <div className="p-2.5 border-b border-white/10 bg-white/[0.02] space-y-2">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-white/90">
              <Receipt className="h-3.5 w-3.5 text-emerald-400" />
              Період фактичних продаж
            </div>
            <div className="flex flex-wrap gap-1">
              {presets.map(p => (
                <button
                  key={p.id}
                  type="button"
                  disabled={!p.months.length}
                  onClick={() => { onChange(p.months); setRangeStart(null); }}
                  className={`px-2 py-1 rounded-lg text-[11px] font-medium border transition-colors ${
                    isSame(p.months, selected)
                      ? "bg-emerald-600 border-emerald-500 text-white"
                      : "bg-white/5 border-white/10 text-white/80 hover:bg-white/10 hover:text-white"
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          <div className="p-2.5 space-y-3 max-h-[320px] overflow-y-auto custom-scrollbar">
            {years.map(y => (
              <div key={y}>
                <div className="text-[11px] font-bold text-muted-foreground mb-1.5">{y}</div>
                <div className="grid grid-cols-4 gap-1">
                  {MONTH_LABELS.map((label, i) => {
                    const m = `${y}-${String(i + 1).padStart(2, "0")}`;
                    const enabled = availableSet.has(m);
                    const isSel = selectedSet.has(m);
                    const isStart = rangeStart === m;
                    return (
                      <button
                        key={m}
                        type="button"
                        disabled={!enabled}
                        onClick={() => pickMonth(m)}
                        title={enabled ? monthFull(m) : "Немає продажів"}
                        className={`relative h-8 rounded-lg text-xs font-medium transition-colors ${
                          !enabled
                            ? "text-white/20 cursor-not-allowed"
                            : isSel
                            ? "bg-emerald-600 text-white"
                            : "bg-white/5 text-white/85 hover:bg-white/10"
                        } ${isStart ? "ring-2 ring-emerald-300" : ""}`}
                      >
                        {label}
                        {isSel && selected.length === 1 && (
                          <Check className="absolute top-0.5 right-0.5 h-2.5 w-2.5" />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          <div className="p-2 border-t border-white/10 bg-white/[0.01] text-[10px] text-muted-foreground leading-snug">
            {rangeStart
              ? "Оберіть кінцевий місяць діапазону або закрийте — залишиться один місяць."
              : "Клік — один місяць, другий клік — кінець діапазону. Для кількох місяців показуються середні продажі за місяць."}
          </div>
        </div>
      )}
    </div>
  );
}
