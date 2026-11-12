import React, { useMemo, useEffect } from "react";
import { 
  X, 
  Store, 
  Building2, 
  MapPin, 
  User, 
  Phone, 
  Mail, 
  Calendar, 
  Layers, 
  TrendingUp, 
  BedDouble, 
  MessageSquareText, 
  CheckCircle2, 
  FileText,
  PieChart,
  Package
} from "lucide-react";
import { EMPTY_SALES_INDEX, formatSales, salesPeriodLabel } from "../../lib/salesUtils";

// Плитки моделей у карточці: статус → порядок сортування і кольори
const TILE_STATUS = {
  sold:    { order: 0, label: "Є на точці, є продажі",
             cls: "bg-emerald-100 text-emerald-900 border-emerald-300 dark:bg-emerald-500/30 dark:text-emerald-50 dark:border-emerald-400/50" },
  present: { order: 1, label: "Є на точці, продажів немає",
             cls: "bg-emerald-50/60 text-emerald-700 border-emerald-200 dark:bg-emerald-500/[0.08] dark:text-emerald-300/80 dark:border-emerald-500/20" },
  missing: { order: 2, label: "Продажі організації, на точці немає",
             cls: "bg-amber-100 text-amber-900 border-amber-300 dark:bg-amber-500/25 dark:text-amber-50 dark:border-amber-400/50" },
  notcrm:  { order: 3, label: "Продажі організації, моделі немає в CRM",
             cls: "bg-rose-100 text-rose-900 border-rose-300 dark:bg-rose-500/25 dark:text-rose-50 dark:border-rose-400/50" },
};
const sortTiles = (a, b) =>
  TILE_STATUS[a.status].order - TILE_STATUS[b.status].order || (b.qty || 0) - (a.qty || 0) || a.name.localeCompare(b.name, "uk");

/**
 * Compact SVG Donut / Ring chart for Price Segments (Низький, Середній, Високий)
 */
function PriceSegmentsDonut({ low = 0, mid = 0, high = 0 }) {
  const numLow = Number(low) || 0;
  const numMid = Number(mid) || 0;
  const numHigh = Number(high) || 0;
  const total = numLow + numMid + numHigh;

  const l = total > 0 ? (numLow / total) * 100 : 0;
  const m = total > 0 ? (numMid / total) * 100 : 0;
  const h = total > 0 ? (numHigh / total) * 100 : 0;

  // With radius r = 15.915494309189533, circumference 2 * PI * r = exactly 100
  const r = 15.915494309189533;
  const circ = 100;

  return (
    <div className="flex items-center gap-2 pt-0.5">
      <div className="relative w-8 h-8 shrink-0">
        <svg viewBox="0 0 36 36" className="w-full h-full -rotate-90">
          <circle
            cx="18"
            cy="18"
            r={r}
            fill="none"
            stroke="currentColor"
            strokeWidth="4"
            className="text-slate-200 dark:text-white/10"
          />
          {total > 0 ? (
            <>
              {l > 0 && (
                <circle
                  cx="18"
                  cy="18"
                  r={r}
                  fill="none"
                  stroke="#10b981"
                  strokeWidth="4"
                  strokeDasharray={`${l} ${circ - l}`}
                  strokeDashoffset="0"
                />
              )}
              {m > 0 && (
                <circle
                  cx="18"
                  cy="18"
                  r={r}
                  fill="none"
                  stroke="#0ea5e9"
                  strokeWidth="4"
                  strokeDasharray={`${m} ${circ - m}`}
                  strokeDashoffset={-l}
                />
              )}
              {h > 0 && (
                <circle
                  cx="18"
                  cy="18"
                  r={r}
                  fill="none"
                  stroke="#f59e0b"
                  strokeWidth="4"
                  strokeDasharray={`${h} ${circ - h}`}
                  strokeDashoffset={-(l + m)}
                />
              )}
            </>
          ) : null}
        </svg>
      </div>

      <div className="text-[10px] font-mono leading-tight space-y-0.5 min-w-0">
        <div className="flex items-center gap-1 text-emerald-700 dark:text-emerald-400">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
          <span>Н: <strong className="font-bold">{numLow}%</strong></span>
        </div>
        <div className="flex items-center gap-1 text-sky-700 dark:text-sky-400">
          <span className="w-1.5 h-1.5 rounded-full bg-sky-500 shrink-0" />
          <span>С: <strong className="font-bold">{numMid}%</strong></span>
        </div>
        <div className="flex items-center gap-1 text-amber-700 dark:text-amber-400">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" />
          <span>В: <strong className="font-bold">{numHigh}%</strong></span>
        </div>
      </div>
    </div>
  );
}

export function PointCardModal({ point, allVisits = [], allBrands = [], salesIndex = EMPTY_SALES_INDEX, onClose }) {
  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        onClose?.();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  // Extract all presented models on this point (from point.brandPresence or point.rawVisit?.visit_brands or point.visit_brands)
  const presentedModels = useMemo(() => {
    if (!point) return [];
    const modelsMap = new Map();

    const brandCatalogMap = new Map();
    (allBrands || []).forEach(b => {
      if (b && b.name) brandCatalogMap.set(b.name.toLowerCase().trim(), b);
    });

    // 1. From rawVisit.visit_brands or point.visit_brands
    const visitBrands = point.rawVisit?.visit_brands || point.visit_brands || [];
    visitBrands.forEach(vb => {
      const b = vb.brand;
      if (b && b.name) {
        const key = b.name.toLowerCase().trim();
        const catalogBrand = brandCatalogMap.get(key);
        const isPm = catalogBrand 
          ? (catalogBrand.is_pm === true || catalogBrand.name.toLowerCase().startsWith("privat"))
          : (b.is_pm === true || b.name.toLowerCase().startsWith("privat"));
        
        modelsMap.set(key, {
          id: b.id || key,
          name: catalogBrand?.name || b.name,
          isHighfoam: !isPm,
          isPm: isPm
        });
      }
    });

    // 2. From point.brandPresence (keys where value === true)
    if (point.brandPresence) {
      Object.entries(point.brandPresence).forEach(([name, isPresent]) => {
        if (isPresent) {
          const key = name.toLowerCase().trim();
          if (!modelsMap.has(key)) {
            const catalogBrand = brandCatalogMap.get(key);
            const isPm = catalogBrand 
              ? (catalogBrand.is_pm === true || catalogBrand.name.toLowerCase().startsWith("privat"))
              : key.startsWith("privat");
            
            modelsMap.set(key, {
              id: catalogBrand?.id || key,
              name: catalogBrand?.name || name,
              isHighfoam: !isPm,
              isPm: isPm
            });
          }
        }
      });
    }

    return Array.from(modelsMap.values()).sort((a, b) => a.name.localeCompare(b.name, "uk"));
  }, [point, allBrands]);

  const highfoamPresented = useMemo(() => presentedModels.filter(m => m.isHighfoam), [presentedModels]);
  const privatPresented = useMemo(() => presentedModels.filter(m => m.isPm), [presentedModels]);

  // Плитки моделей з фактичними продажами організації ТТ за «Період продаж»:
  //  зелена — є на точці і є продажі; блідо-зелена — є на точці, продажів немає;
  //  жовта — продажі організації по моделі з CRM, якої немає на точці; червона — моделі немає в CRM.
  const hasSalesPeriod = (salesIndex.monthsCount || 0) > 0;
  const { hfTiles, pmTiles } = useMemo(() => {
    const orgSales = point?.orgCode ? salesIndex.orgModels(point.orgCode) : [];
    const byId = new Map(orgSales.filter(s => s.brandId).map(s => [s.brandId, s]));
    const byName = new Map(orgSales.filter(s => s.inCrm).map(s => [s.name.toLowerCase().trim(), s]));
    const used = new Set();

    const tiles = presentedModels.map(m => {
      const sale = byId.get(m.id) || byName.get(m.name.toLowerCase().trim());
      if (sale) used.add(sale.key);
      const qty = sale?.avg || 0;
      return { key: `p:${m.id}`, name: m.name, isPm: m.isPm, qty, status: qty > 0 ? "sold" : "present" };
    });

    orgSales.forEach(sale => {
      if (used.has(sale.key) || !(sale.avg > 0)) return;
      // Модель, якої немає в CRM, поки що завжди в Highfoam
      // (пізніше ознака Highfoam / Privat з'явиться в таблиці продажів)
      const isPm = sale.inCrm ? sale.isPm : false;
      tiles.push({
        key: `s:${sale.key}`,
        name: sale.name,
        skm: sale.skm,
        isPm,
        qty: sale.avg,
        status: sale.inCrm ? "missing" : "notcrm",
      });
    });

    return {
      hfTiles: tiles.filter(t => !t.isPm).sort(sortTiles),
      pmTiles: tiles.filter(t => t.isPm).sort(sortTiles),
    };
  }, [point, presentedModels, salesIndex]);

  const tileCounts = useMemo(() => {
    const c = { sold: 0, present: 0, missing: 0, notcrm: 0 };
    [...hfTiles, ...pmTiles].forEach(t => { c[t.status] += 1; });
    return c;
  }, [hfTiles, pmTiles]);

  // Filter and sort all history visits for this point (by visitedAt descending)
  const historyVisits = useMemo(() => {
    if (!point) return [];
    return (allVisits || [])
      .filter(v => {
        if (point.pointId && v.pointId && v.pointId === point.pointId) return true;
        if (point.ttKey && v.ttKey && v.ttKey === point.ttKey) return true;
        const vKey = `${(v.org || "").toLowerCase()}:::${(v.point || "").toLowerCase()}`;
        const pKey = `${(point.org || point.orgName || "").toLowerCase()}:::${(point.point || point.pointName || "").toLowerCase()}`;
        return vKey === pKey;
      })
      .sort((a, b) => {
        const dateB = new Date(b.visitedAt || b.visited_at || b.date || 0);
        const dateA = new Date(a.visitedAt || a.visited_at || a.date || 0);
        return dateB - dateA;
      });
  }, [allVisits, point]);

  if (!point) return null;

  // If no history found from allVisits, fallback to point itself
  const displayHistory = historyVisits.length > 0 ? historyVisits : [point];

  const formatDate = (dateStr) => {
    if (!dateStr || dateStr === "—") return "—";
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      const day = String(d.getDate()).padStart(2, '0');
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const year = d.getFullYear();
      return `${day}.${month}.${year}`;
    } catch {
      return dateStr;
    }
  };

  const getDaysAgo = (dateStr) => {
    if (!dateStr || dateStr === "—") return null;
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return null;
      const now = new Date();
      const diffTime = now.getTime() - d.getTime();
      const days = Math.floor(diffTime / (1000 * 60 * 60 * 24));
      return days >= 0 ? days : 0;
    } catch {
      return null;
    }
  };

  const daysAgo = getDaysAgo(point.visitedAt || point.date);
  const sharePct = point.totalPP > 0 ? ((point.highfoamPP / point.totalPP) * 100).toFixed(1).replace('.', ',') : "0,0";

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 md:p-6 bg-black/80 backdrop-blur-md overflow-hidden animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div 
        className="relative w-full max-w-6xl xl:max-w-7xl bg-white dark:bg-[#0d1527] border border-slate-200 dark:border-white/20 rounded-3xl shadow-[0_25px_70px_rgba(0,0,0,0.8)] overflow-hidden flex flex-col h-[88vh] max-h-[88vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* =========================================================================
            MODAL TOP HEADER (Sticky / Fixed)
           ========================================================================= */}
        <div className="flex items-start justify-between gap-3 p-3.5 sm:p-4 px-4 sm:px-6 border-b border-slate-200 dark:border-white/10 bg-slate-50/90 dark:bg-[#15213b]/90 shrink-0">
          <div className="flex items-start gap-3 min-w-0">
            <div className="p-2 sm:p-2.5 rounded-xl bg-indigo-500/15 border border-indigo-500/30 text-indigo-600 dark:text-indigo-400 shrink-0 mt-0.5">
              <Store className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <h2 className="text-base sm:text-lg md:text-xl font-bold tracking-tight text-slate-900 dark:text-white truncate" title={point.point || point.pointName}>
                {point.point || point.pointName || "Невідома точка"}
              </h2>

              <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-white/70 mt-0.5 flex-wrap">
                <span className="flex items-center gap-1 font-semibold text-slate-900 dark:text-white/95">
                  <Building2 className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400 shrink-0" />
                  {point.org || point.orgName || "Без організації"}
                  {point.orgCode ? ` (${point.orgCode})` : ""}
                </span>
                <span>•</span>
                <span className="flex items-center gap-1">
                  <MapPin className="h-3.5 w-3.5 text-amber-500 dark:text-amber-400 shrink-0" />
                  {point.city || point.cityName || "Невідомо"}, {point.oblast || "Не вказано"}
                  {point.street ? `, ${point.street} ${point.house || ""}` : point.address ? `, ${point.address}` : ""}
                </span>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl bg-slate-200/80 hover:bg-slate-300 dark:bg-white/5 dark:hover:bg-white/10 border border-slate-300 dark:border-white/10 text-slate-700 dark:text-white/70 hover:text-slate-900 dark:hover:text-white transition-all shrink-0"
            title="Закрити (Esc)"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* =========================================================================
            SPLIT BODY: LEFT SIDE = COMPACT KEY INFO, RIGHT SIDE = VISIT HISTORY SCROLL
           ========================================================================= */}
        <div className="flex-1 overflow-hidden grid grid-cols-1 lg:grid-cols-12 min-h-0">
          
          {/* =======================================================================
              LEFT COLUMN: KEY POINT INFORMATION (Compact layout)
             ======================================================================= */}
          <div className="lg:col-span-7 xl:col-span-7 overflow-y-auto p-3.5 sm:p-4 space-y-3 lg:flex lg:flex-col border-b lg:border-b-0 lg:border-r border-slate-200 dark:border-white/10 custom-scrollbar">
            
            {/* 1. Quick Metrics Grid (5 Tiles, including Price Segments Donut) */}
            <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-5 gap-2">
              
              {/* Tile 1: General Potential */}
              <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-white/[0.03] border border-slate-200 dark:border-white/10 flex flex-col justify-between">
                <div className="text-[11px] text-slate-500 dark:text-muted-foreground font-medium flex items-center gap-1">
                  <TrendingUp className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400 shrink-0" />
                  <span className="truncate">Заг. потенціал</span>
                </div>
                <div className="my-0.5">
                  <div className="text-base sm:text-lg font-bold text-slate-900 dark:text-white font-mono leading-none">
                    {point.totalPP || 0} <span className="text-[10px] text-slate-500 dark:text-muted-foreground font-normal">шт/міс</span>
                  </div>
                </div>
                <div className="text-[10px] text-slate-500 dark:text-white/50 truncate">
                  Кат: <strong className="text-slate-800 dark:text-white/90">{point.category || "—"}</strong>
                </div>
              </div>

              {/* Tile 2: Sales Highfoam */}
              <div className="p-2.5 rounded-xl bg-emerald-50/60 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-500/20 flex flex-col justify-between">
                <div className="text-[11px] text-emerald-700 dark:text-emerald-400 font-medium flex items-center gap-1">
                  <TrendingUp className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                  <span className="truncate">Продажі ЮНП</span>
                </div>
                <div className="my-0.5">
                  <div className="text-base sm:text-lg font-bold text-emerald-700 dark:text-emerald-400 font-mono leading-none">
                    {point.highfoamPP || 0} <span className="text-[10px] font-normal opacity-75">шт/міс</span>
                  </div>
                </div>
                <div className="text-[10px] text-emerald-700 dark:text-emerald-400/90 font-medium truncate">
                  Частка: <strong>{sharePct}%</strong>
                </div>
              </div>

              {/* Tile 3: Sleeping Places */}
              <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-white/[0.03] border border-slate-200 dark:border-white/10 flex flex-col justify-between">
                <div className="text-[11px] text-slate-500 dark:text-muted-foreground font-medium flex items-center gap-1">
                  <BedDouble className="h-3.5 w-3.5 text-amber-500 dark:text-amber-400 shrink-0" />
                  <span className="truncate">Спальні місця</span>
                </div>
                <div className="my-0.5">
                  <div className="text-base sm:text-lg font-bold text-slate-900 dark:text-white font-mono leading-none">
                    {point.totalKV || 0} <span className="text-[10px] text-slate-500 dark:text-muted-foreground font-normal">місць</span>
                  </div>
                </div>
                <div className="text-[10px] text-amber-600 dark:text-amber-400/90 truncate">
                  ЮНП: <strong className="text-slate-900 dark:text-white">{point.highfoamKV || 0}</strong> місць
                </div>
              </div>

              {/* Tile 4: Price Segments Donut Chart (Перенесено в плитку з кільцевою діаграмою) */}
              <div 
                className="p-2.5 rounded-xl bg-slate-50 dark:bg-white/[0.03] border border-slate-200 dark:border-white/10 flex flex-col justify-between"
                title={`Цінові сегменти: Низький: ${point.priceSegLow || 0}%, Середній: ${point.priceSegMid || 0}%, Високий: ${point.priceSegHigh || 0}%`}
              >
                <div className="text-[11px] text-sky-700 dark:text-sky-400 font-medium flex items-center gap-1">
                  <PieChart className="h-3.5 w-3.5 text-sky-600 dark:text-sky-400 shrink-0" />
                  <span className="truncate">Цінові сегменти</span>
                </div>
                <PriceSegmentsDonut 
                  low={point.priceSegLow || 0} 
                  mid={point.priceSegMid || 0} 
                  high={point.priceSegHigh || 0} 
                />
              </div>

              {/* Tile 5: Last Visit */}
              <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-white/[0.03] border border-slate-200 dark:border-white/10 flex flex-col justify-between col-span-2 sm:col-span-1">
                <div className="text-[11px] text-slate-500 dark:text-muted-foreground font-medium flex items-center gap-1">
                  <Calendar className="h-3.5 w-3.5 text-sky-600 dark:text-sky-400 shrink-0" />
                  <span className="truncate">Останній візит</span>
                </div>
                <div className="my-0.5">
                  <div className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white font-mono leading-tight truncate">
                    {formatDate(point.visitedAt || point.date)}
                  </div>
                </div>
                <div className="text-[10px] text-slate-500 dark:text-white/50 truncate">
                  {daysAgo !== null ? `${daysAgo} дн. тому` : "—"}
                </div>
              </div>

            </div>

            {/* 2. Contacts, Manager and Commercial Parameters (Растянуто на всю ширину) */}
            <div className="p-3 sm:p-3.5 rounded-2xl bg-slate-50/80 dark:bg-white/[0.02] border border-slate-200 dark:border-white/10 space-y-2">
              <div className="flex items-center justify-between border-b border-slate-200/80 dark:border-white/10 pb-2 flex-wrap gap-2">
                <h3 className="text-xs font-bold uppercase tracking-wider text-indigo-700 dark:text-indigo-300 flex items-center gap-1.5">
                  <User className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400" />
                  Контакти та параметри торгової точки
                </h3>
                <div className="flex items-center gap-1.5 flex-wrap">
                  {point.ttType && (
                    <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-slate-200/70 dark:bg-white/5 text-slate-700 dark:text-white/80 border border-slate-300/60 dark:border-white/10">
                      {point.ttType}
                    </span>
                  )}
                  <span className={`px-2 py-0.5 rounded text-[10px] font-semibold border ${
                    point.isCooperating 
                      ? "bg-emerald-100 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/20" 
                      : "bg-rose-100 dark:bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-200 dark:border-rose-500/20"
                  }`}>
                    {point.isCooperating ? "Співпрацюємо з ЮНП" : "Без співпраці"}
                  </span>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-semibold border ${
                    point.sellsPillows 
                      ? "bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/20" 
                      : "bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-muted-foreground border-slate-200 dark:border-white/10"
                  }`}>
                    Подушки: {point.sellsPillows ? "Так" : "Ні"}
                  </span>
                </div>
              </div>

              {/* 3-column / 2-column compact details grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-x-4 gap-y-1.5 text-xs">
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className="text-slate-500 dark:text-muted-foreground text-[11px] shrink-0">Менеджер:</span>
                  <span className="font-bold text-slate-900 dark:text-white truncate" title={point.agent || point.agentName}>
                    {point.agent || point.agentName || "Не призначено"}
                  </span>
                </div>

                <div className="flex items-center gap-1.5 min-w-0">
                  <span className="text-slate-500 dark:text-muted-foreground text-[11px] shrink-0">Контакт:</span>
                  <span className="font-medium text-slate-800 dark:text-white/95 truncate">
                    {point.contactName || "—"}
                    {point.contactPosition ? <span className="text-slate-500 dark:text-white/60 ml-1 text-[11px]">({point.contactPosition})</span> : ""}
                  </span>
                </div>

                <div className="flex items-center gap-1.5 min-w-0">
                  <span className="text-slate-500 dark:text-muted-foreground text-[11px] shrink-0">Телефон:</span>
                  {point.contactPhone ? (
                    <a href={`tel:${point.contactPhone}`} className="text-indigo-600 dark:text-indigo-400 hover:underline font-mono font-medium truncate flex items-center gap-1">
                      <Phone className="h-3 w-3 shrink-0" />
                      {point.contactPhone}
                    </a>
                  ) : (
                    <span className="text-slate-400">—</span>
                  )}
                </div>

                {point.contactEmail && (
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="text-slate-500 dark:text-muted-foreground text-[11px] shrink-0">Email:</span>
                    <a href={`mailto:${point.contactEmail}`} className="text-indigo-600 dark:text-indigo-400 hover:underline truncate flex items-center gap-1">
                      <Mail className="h-3 w-3 shrink-0" />
                      {point.contactEmail}
                    </a>
                  </div>
                )}
              </div>

              {/* Description if present */}
              {point.ttDescription && (
                <div className="pt-1.5 border-t border-slate-200/60 dark:border-white/5 text-[11px] flex items-start gap-1.5 text-slate-600 dark:text-white/75">
                  <span className="font-semibold text-slate-500 dark:text-muted-foreground shrink-0">Опис ТТ:</span>
                  <span className="italic line-clamp-2">{point.ttDescription}</span>
                </div>
              )}
            </div>

            {/* 3. Manufacturers on Point (Компактна сітка) */}
            {point.visitManufacturers && point.visitManufacturers.length > 0 && (
              <div className="p-3 rounded-2xl bg-slate-50/80 dark:bg-white/[0.02] border border-slate-200 dark:border-white/10 space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-sky-700 dark:text-sky-300 flex items-center gap-1.5">
                    <Layers className="h-3.5 w-3.5 text-sky-600 dark:text-sky-400" />
                    Виробники та викладка на точці
                  </h3>
                  <span className="text-[10px] text-slate-500 dark:text-muted-foreground font-mono">
                    {point.visitManufacturers.length} виробн.
                  </span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-1.5">
                  {point.visitManufacturers.map((vm, idx) => {
                    const isHighfoam = (vm.name || "").toLowerCase().includes("highfoam") || (vm.name || "").toLowerCase().includes("юнп");
                    return (
                      <div 
                        key={idx} 
                        className={`p-1.5 px-2.5 rounded-xl text-xs flex flex-col justify-between border ${
                          isHighfoam 
                            ? "bg-indigo-100/80 dark:bg-indigo-500/15 border-indigo-300 dark:border-indigo-500/30 text-indigo-900 dark:text-white" 
                            : "bg-white dark:bg-white/[0.03] border-slate-200 dark:border-white/10 text-slate-800 dark:text-white/80"
                        }`}
                      >
                        <div className="font-bold text-[11px] truncate" title={vm.name}>{vm.name || "—"}</div>
                        <div className="text-[10px] text-slate-500 dark:text-muted-foreground flex items-center justify-between mt-0.5">
                          <span>ПП: <strong className="text-slate-900 dark:text-white">{vm.pp || 0}</strong></span>
                          <span>КВ: <strong className="text-slate-900 dark:text-white">{vm.kv || 0}</strong></span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* 4. Presented Models on Point (Highfoam & Privat) — розтягується на всю вільну висоту колонки */}
            <div className="p-3 rounded-2xl bg-slate-50/80 dark:bg-white/[0.02] border border-slate-200 dark:border-white/10 space-y-2 lg:flex-1 lg:min-h-[14rem] lg:flex lg:flex-col">
              <div className="flex items-center justify-between border-b border-slate-200/80 dark:border-white/10 pb-1.5 flex-wrap gap-2">
                <div className="flex items-center gap-1.5">
                  <Package className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400" />
                  <h3 className="text-xs font-bold uppercase tracking-wider text-indigo-700 dark:text-indigo-300">
                    Представлені моделі на точці
                  </h3>
                </div>
                <div className="flex items-center gap-1.5 text-xs">
                  <span className="px-1.5 py-0.5 rounded bg-indigo-100 dark:bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-500/25 font-semibold text-[10px]">
                    Highfoam: {highfoamPresented.length}
                  </span>
                  <span className="px-1.5 py-0.5 rounded bg-purple-100 dark:bg-purple-500/15 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-500/25 font-semibold text-[10px]">
                    Privat: {privatPresented.length}
                  </span>
                </div>
              </div>

              {/* Легенда кольорів і період фактичних продаж */}
              {hasSalesPeriod && (
                <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[10px] text-slate-500 dark:text-muted-foreground">
                  <span className="font-semibold">Продажі: {salesPeriodLabel(salesIndex.months)}{salesIndex.monthsCount > 1 ? `, сер./міс.` : ""}</span>
                  {Object.entries(TILE_STATUS).map(([id, st]) => (
                    <span key={id} className="inline-flex items-center gap-1" title={st.label}>
                      <span className={`h-2.5 w-2.5 rounded-sm border ${st.cls}`} />
                      {st.label}{tileCounts[id] ? ` (${tileCounts[id]})` : ""}
                    </span>
                  ))}
                </div>
              )}

              {hfTiles.length === 0 && pmTiles.length === 0 ? (
                <div className="text-xs text-slate-500 dark:text-muted-foreground italic py-2 text-center bg-white/50 dark:bg-white/[0.01] rounded-xl border border-dashed border-slate-300 dark:border-white/10">
                  На цій торговій точці немає зафіксованих представлених моделей
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 lg:flex-1 lg:min-h-0">
                  {[
                    { id: "hf", title: "Highfoam", tiles: hfTiles, presented: highfoamPresented.length,
                      box: "bg-white dark:bg-indigo-950/20 border-indigo-200 dark:border-indigo-500/20",
                      head: "text-indigo-700 dark:text-indigo-300", dot: "bg-indigo-500" },
                    { id: "pm", title: "Privat", tiles: pmTiles, presented: privatPresented.length,
                      box: "bg-white dark:bg-purple-950/20 border-purple-200 dark:border-purple-500/20",
                      head: "text-purple-700 dark:text-purple-300", dot: "bg-purple-500" },
                  ].map(col => (
                    <div key={col.id} className={`p-2.5 rounded-xl border space-y-1.5 flex flex-col min-h-0 ${col.box}`}>
                      <div className={`text-[11px] font-semibold flex items-center justify-between ${col.head}`}>
                        <span className="flex items-center gap-1">
                          <span className={`h-1.5 w-1.5 rounded-full ${col.dot}`} />
                          {col.title} ({col.presented})
                        </span>
                        {col.tiles.length > col.presented && (
                          <span className="text-[10px] font-normal text-slate-500 dark:text-muted-foreground" title="Моделі з продажів організації, яких немає на точці">
                            +{col.tiles.length - col.presented} з продажів
                          </span>
                        )}
                      </div>
                      {col.tiles.length === 0 ? (
                        <div className="text-[10px] text-slate-400 dark:text-muted-foreground/60 italic">
                          Не представлені
                        </div>
                      ) : (
                        <div className="flex flex-wrap content-start gap-1 max-h-60 lg:max-h-none lg:flex-1 lg:min-h-0 overflow-y-auto custom-scrollbar pr-0.5">
                          {col.tiles.map(t => (
                            <span
                              key={t.key}
                              title={`${TILE_STATUS[t.status].label}${t.skm ? ` · skm ${t.skm}` : ""}${t.qty ? ` · ${formatSales(t.qty)} шт` : ""}`}
                              className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium border ${TILE_STATUS[t.status].cls}`}
                            >
                              {t.name}
                              {t.qty > 0 && (
                                <span className="font-mono font-bold px-1 rounded bg-black/10 dark:bg-white/15">
                                  {formatSales(t.qty)}
                                </span>
                              )}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

          </div>

          {/* =======================================================================
              RIGHT COLUMN: VISIT HISTORY WITH DEDICATED SCROLL (Права частина з прокруткою)
             ======================================================================= */}
          <div className="lg:col-span-5 xl:col-span-5 flex flex-col min-h-0 bg-slate-100/60 dark:bg-black/25">
            
            {/* Sticky Header of Visit History Panel */}
            <div className="p-3.5 sm:p-4 border-b border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-[#121c33]/90 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-indigo-600 dark:text-indigo-400">
                  <MessageSquareText className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="text-xs sm:text-sm font-extrabold text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
                    Історія результатів візитів
                  </h3>
                  <p className="text-[10px] text-slate-500 dark:text-muted-foreground">
                    Хронологія візитів та звіти менеджерів
                  </p>
                </div>
              </div>

              <div className="px-2 py-0.5 rounded-lg bg-indigo-100 dark:bg-indigo-500/15 border border-indigo-200 dark:border-indigo-500/30 text-indigo-700 dark:text-indigo-300 font-mono text-xs font-bold">
                {displayHistory.length} {displayHistory.length === 1 ? "візит" : displayHistory.length < 5 ? "візити" : "візитів"}
              </div>
            </div>

            {/* Scrollable Container with History Records */}
            <div className="flex-1 overflow-y-auto p-3.5 sm:p-4 space-y-2.5 custom-scrollbar">
              {displayHistory.length === 0 ? (
                <div className="p-6 text-center text-slate-400 dark:text-muted-foreground text-xs italic bg-white/40 dark:bg-white/[0.02] rounded-2xl border border-dashed border-slate-300 dark:border-white/10">
                  Історія візитів відсутня
                </div>
              ) : (
                displayHistory.map((visitItem, vIdx) => {
                  const visitDate = visitItem.visitedAt || visitItem.visited_at || visitItem.date;
                  const visitDays = getDaysAgo(visitDate);
                  const resultText = visitItem.visitResultNote || visitItem.rawVisit?.visit_result_note || "";
                  const agentName = visitItem.agent || visitItem.author?.full_name || "Невідомий";
                  const isLatest = vIdx === 0;

                  return (
                    <div 
                      key={visitItem.id || vIdx}
                      className={`rounded-2xl border transition-all p-3 space-y-2 shadow-sm ${
                        isLatest
                          ? "bg-white dark:bg-[#131f38] border-indigo-300 dark:border-indigo-500/40 shadow-indigo-500/5 ring-1 ring-indigo-500/20"
                          : "bg-white dark:bg-[#101a2f] border-slate-200 dark:border-white/10 hover:border-slate-300 dark:hover:border-white/20"
                      }`}
                    >
                      {/* Top bar of visit item */}
                      <div className="flex items-center justify-between gap-2 border-b border-slate-100 dark:border-white/10 pb-1.5 flex-wrap">
                        <div className="flex items-center gap-1.5">
                          <div className={`p-1 rounded-md border ${
                            isLatest 
                              ? "bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 border-indigo-500/30" 
                              : "bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-white/60 border-slate-200 dark:border-white/10"
                          }`}>
                            <Calendar className="h-3 w-3" />
                          </div>
                          <div>
                            <div className="font-bold text-slate-900 dark:text-white text-xs font-mono flex items-center gap-1.5">
                              {formatDate(visitDate)}
                              {isLatest && (
                                <span className="text-[9px] font-sans font-bold text-indigo-700 dark:text-indigo-300 bg-indigo-100 dark:bg-indigo-500/20 px-1 py-0.2 rounded">
                                  Останній
                                </span>
                              )}
                              {visitDays !== null && (
                                <span className="text-[10px] font-sans font-normal text-slate-500 dark:text-muted-foreground">
                                  ({visitDays === 0 ? "сьогодні" : `${visitDays} дн. тому`})
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Mini metrics of that visit */}
                        <div className="flex items-center gap-1.5 text-[10px] font-mono">
                          <span className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-700 dark:text-white/80" title="Загальний потенціал">
                            ПП: <strong>{visitItem.totalPP || 0}</strong>
                          </span>
                          <span className="px-1.5 py-0.5 rounded bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 text-emerald-700 dark:text-emerald-400 font-semibold" title="Продажі ЮНП">
                            ЮНП: <strong>{visitItem.highfoamPP || 0}</strong>
                          </span>
                        </div>
                      </div>

                      {/* Manager info */}
                      <div className="flex items-center justify-between text-[11px] text-slate-600 dark:text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <User className="h-3 w-3 text-indigo-500" />
                          <span>Менеджер: <strong className="text-slate-800 dark:text-white/90">{agentName}</strong></span>
                        </div>
                        {visitItem.isCooperating !== undefined && (
                          <span className={`text-[10px] font-medium ${visitItem.isCooperating ? "text-emerald-600 dark:text-emerald-400" : "text-rose-500"}`}>
                            {visitItem.isCooperating ? "Співпраця: Так" : "Співпраця: Ні"}
                          </span>
                        )}
                      </div>

                      {/* Prominent Visit Result Note */}
                      <div className="space-y-1">
                        <div className="text-[10px] font-bold uppercase tracking-wider text-indigo-700 dark:text-indigo-300 flex items-center gap-1">
                          <FileText className="h-3 w-3 text-indigo-500" />
                          Результат візиту:
                        </div>
                        {resultText ? (
                          <div className="text-xs text-slate-800 dark:text-white/95 leading-relaxed bg-indigo-50/70 dark:bg-indigo-950/30 border border-indigo-200/80 dark:border-indigo-500/20 p-2.5 rounded-xl whitespace-pre-wrap font-sans break-words selection:bg-indigo-200">
                            {resultText}
                          </div>
                        ) : (
                          <div className="text-[10px] text-slate-400 dark:text-muted-foreground/70 italic bg-slate-50 dark:bg-white/[0.02] border border-slate-200 dark:border-white/5 p-2 rounded-xl">
                            Коментар або результат візиту не заповнено
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

        </div>

      </div>
    </div>
  );
}
