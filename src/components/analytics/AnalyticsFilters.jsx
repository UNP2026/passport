import React, { useState, useRef, useEffect, useMemo } from "react";
import { 
  Filter, 
  FilterX, 
  Search, 
  Check, 
  ChevronDown, 
  X, 
  User, 
  Building2, 
  Store, 
  MapPin, 
  Globe, 
  Factory, 
  Tag, 
  Layers,
  Calendar,
  Package,
  Boxes
} from "lucide-react";
import { PeriodFilterDropdown } from "./PeriodFilterDropdown";
import { MainOrgsFilterDropdown } from "./MainOrgsFilterDropdown";
import { SalesPeriodDropdown } from "./SalesPeriodDropdown";
import { Receipt } from "lucide-react";
import { salesPeriodLabel, defaultSalesMonths, isDefaultSalesMonths } from "../../lib/salesUtils";
import { ALL_MAIN_ORG_CODES } from "../../lib/mainOrgs";

/**
 * Reusable compact multiselect dropdown with internal search
 */
function MultiSelectDropdown({ 
  label, 
  icon: Icon,
  selected = [], 
  onChange, 
  options = [], 
  counts = {},
  placeholder = "Усі"
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const dropdownRef = useRef(null);
  const inputRef = useRef(null);

  // Close on outside click
  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
        setSearchQuery("");
      }
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  // Focus search input when opening
  useEffect(() => {
    if (isOpen) {
      const timer = setTimeout(() => inputRef.current?.focus(), 50);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  const handleToggle = () => {
    if (isOpen) {
      setIsOpen(false);
      setSearchQuery("");
    } else {
      setIsOpen(true);
      setSearchQuery("");
    }
  };

  const toggleOption = (val) => {
    if (selected.includes(val)) {
      onChange(selected.filter(item => item !== val));
    } else {
      onChange([...selected, val]);
    }
  };

  const clearSelection = () => {
    onChange([]);
  };

  // Filter and sort options by search query and selection status
  const q = searchQuery.toLowerCase().trim();
  const rawList = (options || [])
    .map(opt => {
      const val = typeof opt === "string" ? opt : opt.value;
      const lbl = typeof opt === "string" ? opt : opt.label;
      const cnt = counts[val] ?? 0;
      return { value: val, label: lbl, count: cnt };
    })
    .filter(item => item.count > 0 || selected.includes(item.value));

  const filteredOptions = q
    ? rawList
        .filter(item => item.label.toLowerCase().includes(q))
        .sort((a, b) => a.label.localeCompare(b.label, 'uk'))
    : [...rawList].sort((a, b) => {
        const aSel = selected.includes(a.value);
        const bSel = selected.includes(b.value);
        if (aSel && !bSel) return -1;
        if (!aSel && bSel) return 1;
        return a.label.localeCompare(b.label, 'uk');
      });

  const selectAllVisible = () => {
    const visibleVals = filteredOptions.map(o => o.value);
    const newSelected = Array.from(new Set([...selected, ...visibleVals]));
    onChange(newSelected);
  };

  const hasSelected = selected.length > 0;

  return (
    <div className={`relative inline-block text-left ${isOpen ? 'z-[60]' : 'z-10'}`} ref={dropdownRef}>
      {/* Trigger button */}
      <button
        type="button"
        onClick={handleToggle}
        className={`flex items-center gap-1.5 h-9 px-3 rounded-xl text-xs font-medium border transition-all duration-200 select-none ${
          hasSelected
            ? "bg-indigo-600/15 border-indigo-500/40 text-indigo-300 shadow-[0_0_12px_rgba(99,102,241,0.15)]"
            : "bg-white/[0.04] hover:bg-white/[0.08] border-white/10 text-white/80 hover:text-white"
        }`}
        title={hasSelected ? `${label}: ${selected.join(", ")}` : label}
      >
        {Icon && <Icon className={`h-3.5 w-3.5 shrink-0 ${hasSelected ? "text-indigo-400" : "text-muted-foreground"}`} />}
        <span className="truncate max-w-[120px] sm:max-w-[140px]">{label}</span>
        
        {hasSelected ? (
          <span className="ml-1 inline-flex items-center justify-center px-1.5 py-0.2 text-[10px] font-bold rounded-full bg-indigo-500 text-white leading-none">
            {selected.length}
          </span>
        ) : (
          <span className="text-[11px] text-muted-foreground font-normal">
            {placeholder}
          </span>
        )}
        <ChevronDown className={`h-3 w-3 shrink-0 ml-0.5 text-muted-foreground transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`} />
      </button>

      {/* Dropdown panel */}
      {isOpen && (
        <div className="absolute left-0 mt-2 w-72 sm:w-80 rounded-2xl bg-[#0f172a] border border-white/20 shadow-[0_25px_60px_rgba(0,0,0,0.9)] z-[70] overflow-hidden animate-in fade-in zoom-in-95 duration-150">
          {/* Search Header */}
          <div className="p-2.5 border-b border-white/10 bg-white/[0.02]">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <input
                ref={inputRef}
                type="text"
                placeholder={`Пошук ${label.toLowerCase()}...`}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-xl pl-8 pr-7 py-1.5 text-xs text-white placeholder:text-muted-foreground outline-none focus:border-indigo-500 transition-colors"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-white"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>

            {/* Quick Actions */}
            <div className="flex items-center justify-between mt-2 px-1 text-[11px]">
              <button
                type="button"
                onClick={selectAllVisible}
                className="text-indigo-400 hover:text-indigo-300 font-medium transition-colors"
              >
                Вибрати всі ({filteredOptions.length})
              </button>
              {hasSelected && (
                <button
                  type="button"
                  onClick={clearSelection}
                  className="text-rose-400 hover:text-rose-300 transition-colors"
                >
                  Очистити
                </button>
              )}
            </div>
          </div>

          {/* Options List */}
          <div className="max-h-60 overflow-y-auto p-1.5 space-y-0.5 custom-scrollbar">
            {filteredOptions.length === 0 ? (
              <div className="py-6 text-center text-xs text-muted-foreground">
                Нічого не знайдено
              </div>
            ) : (
              filteredOptions.map((opt) => {
                const isChecked = selected.includes(opt.value);
                const isZero = opt.count === 0 && !isChecked;

                return (
                  <div
                    key={opt.value}
                    onClick={() => toggleOption(opt.value)}
                    className={`flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs cursor-pointer transition-colors ${
                      isChecked
                        ? "bg-indigo-600/20 text-white font-medium"
                        : isZero
                        ? "text-muted-foreground/60 hover:bg-white/5 hover:text-white/80"
                        : "text-white/80 hover:bg-white/5 hover:text-white"
                    }`}
                  >
                    <div className="flex items-center gap-2 truncate pr-2">
                      <div className={`h-4 w-4 shrink-0 rounded border flex items-center justify-center transition-colors ${
                        isChecked
                          ? "bg-indigo-600 border-indigo-500 text-white"
                          : "border-white/20 bg-white/5"
                      }`}>
                        {isChecked && <Check className="h-3 w-3 stroke-[3]" />}
                      </div>
                      <span className="truncate" title={opt.label}>
                        {opt.label}
                      </span>
                    </div>

                    <span className={`text-[10px] px-1.5 py-0.5 rounded shrink-0 ${
                      isChecked
                        ? "bg-indigo-500/30 text-indigo-200"
                        : opt.count > 0
                        ? "bg-white/5 text-muted-foreground"
                        : "bg-white/[0.02] text-white/30"
                    }`}>
                      {opt.count}
                    </span>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}

const chipCls = "inline-flex items-center gap-1 text-[11px] bg-indigo-500/15 border border-indigo-500/30 text-indigo-200 px-2 py-0.5 rounded-lg shrink-0";

const fmtDate = (s) => (s ? s.split("-").reverse().join(".") : "");
const periodLabel = (p) =>
  p.preset === "today" ? "Сьогодні"
  : p.preset === "week" ? "Тиждень"
  : p.preset === "month" ? "Місяць"
  : `${fmtDate(p.startDate)} — ${fmtDate(p.endDate)}`;

const isHighfoamName = (m) => (m || "").trim().toLowerCase() === "highfoam";

// Мультиселект-фільтри: ключ у filters, підпис, підпис у чіпі, іконка
const MULTI_FILTERS = [
  { key: "managers", label: "Менеджер", chip: "Менеджер", icon: User, adminOnly: true },
  { key: "orgs", label: "Організація", chip: "Орг", icon: Building2 },
  { key: "points", label: "Торгова точка", chip: "ТТ", icon: Store },
  { key: "oblasts", label: "Область", chip: "Обл", icon: Globe },
  { key: "cities", label: "Місто", chip: "Місто", icon: MapPin },
  { key: "manufacturers", label: "Виробник", chip: "Виробник", icon: Factory },
  { key: "categories", label: "Категорія", chip: "Категорія", icon: Tag },
  { key: "ttTypes", label: "Тип точки", chip: "Тип", icon: Layers },
  { key: "hfModels", label: "Моделі Highfoam", chip: "Highfoam", icon: Package },
  { key: "pmModels", label: "Моделі Privat", chip: "Privat", icon: Boxes },
];

/**
 * Спільні дії з фільтрами та список чіпів «Обрано» (для повної панелі та компактної смуги)
 */
function useFilterActions({ filters, setFilters, isSales, salesMonthsAvailable = [] }) {
  const updatePeriod = (period) => setFilters(prev => ({ ...prev, period }));
  const updateSalesMonths = (salesMonths) => setFilters(prev => ({ ...prev, salesMonths }));
  const updateMainOrgs = (mainOrgs) => setFilters(prev => ({ ...prev, mainOrgs }));

  const updateFilterArray = (key, values) => {
    setFilters(prev => {
      let presence = prev.presence;
      // «Highfoam» у виробниках і «ЮНП: Ні» взаємовиключні
      if (key === "manufacturers" && values.some(isHighfoamName) && prev.presence === "no") presence = "all";
      return { ...prev, [key]: values, presence };
    });
  };

  const updatePresence = (val) => {
    setFilters(prev => ({
      ...prev,
      presence: val,
      manufacturers: val === "no" ? (prev.manufacturers || []).filter(m => !isHighfoamName(m)) : prev.manufacturers,
    }));
  };

  const visibleFilters = MULTI_FILTERS.filter(f => !(f.adminOnly && isSales));

  const chips = [];
  if (filters.period?.startDate || filters.period?.endDate) {
    chips.push({
      id: "period", icon: Calendar, label: "Період", value: periodLabel(filters.period),
      onRemove: () => updatePeriod({ preset: null, startDate: null, endDate: null }),
    });
  }
  const salesMonths = filters.salesMonths || [];
  if (salesMonthsAvailable.length && salesMonths.length && !isDefaultSalesMonths(salesMonths, salesMonthsAvailable)) {
    chips.push({
      id: "salesMonths", icon: Receipt, label: "Період продаж",
      value: salesPeriodLabel(salesMonths) + (salesMonths.length > 1 ? ` (сер. ${salesMonths.length} міс.)` : ""),
      onRemove: () => updateSalesMonths(defaultSalesMonths(salesMonthsAvailable)),
    });
  }
  if (filters.mainOrgs && filters.mainOrgs.length < ALL_MAIN_ORG_CODES.length) {
    chips.push({
      id: "mainOrgs", icon: Building2, label: "Основні орг",
      value: `${filters.mainOrgs.length} з ${ALL_MAIN_ORG_CODES.length}`,
      onRemove: () => updateMainOrgs([...ALL_MAIN_ORG_CODES]),
    });
  }
  visibleFilters.forEach(f => (filters[f.key] || []).forEach(v => chips.push({
    id: `${f.key}-${v}`, label: f.chip, value: v,
    onRemove: () => updateFilterArray(f.key, (filters[f.key] || []).filter(x => x !== v)),
  })));
  if (filters.presence && filters.presence !== "all") {
    chips.push({
      id: "presence", label: "ЮНП", value: filters.presence === "yes" ? "Так" : "Ні",
      onRemove: () => updatePresence("all"),
    });
  }

  return { updatePeriod, updateSalesMonths, updateMainOrgs, updateFilterArray, updatePresence, visibleFilters, chips };
}

function FilterChip({ chip }) {
  const Icon = chip.icon;
  return (
    <span className={chipCls}>
      {Icon && <Icon className="h-3 w-3 text-indigo-400" />}
      <span className="text-muted-foreground">{chip.label}:</span>
      <span className="truncate max-w-[160px]" title={chip.value}>{chip.value}</span>
      <button type="button" onClick={chip.onRemove} className="hover:text-white transition-colors ml-0.5" title="Прибрати">
        <X className="h-3 w-3" />
      </button>
    </span>
  );
}

export function AnalyticsFilters({
  filters,
  setFilters,
  optionsData = {},
  countsData = {},
  visitsCountByDate = {},
  onReset,
  isSales = false,
  managerName = "",
  salesMonthsAvailable = [],
  className = "mb-6",
}) {
  const { updatePeriod, updateSalesMonths, updateMainOrgs, updateFilterArray, updatePresence, visibleFilters, chips } =
    useFilterActions({ filters, setFilters, isSales, salesMonthsAvailable });
  const isHighfoamSelected = (filters.manufacturers || []).some(isHighfoamName);
  const activeCount = chips.length;
  const hasActiveFilters = activeCount > 0;

  // Category labels mapping (e.g. A -> Категорія A)
  const categoryOptions = useMemo(() => {
    return (optionsData.categories || ["A", "B", "C", "D"]).map(cat => ({
      value: cat,
      label: `Категорія ${cat}`
    }));
  }, [optionsData.categories]);

  return (
    <div className={`relative z-40 glass-soft rounded-2xl p-3.5 border border-white/10 shadow-xl space-y-3 ${className}`}>
      {/* Top Header of Filters Bar */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-indigo-400">
          <Filter className="h-4 w-4 shrink-0" />
          <span className="text-xs font-bold uppercase tracking-wider text-white/90">
            Фільтри
          </span>
          {hasActiveFilters && (
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
              Активних: {activeCount}
            </span>
          )}
        </div>

        {hasActiveFilters && (
          <button
            type="button"
            onClick={onReset}
            className="flex items-center gap-1.5 text-xs text-rose-400 hover:text-rose-300 px-2 py-1 rounded-lg hover:bg-rose-500/10 transition-colors font-medium"
          >
            <FilterX className="h-3.5 w-3.5" />
            <span>Скинути всі</span>
          </button>
        )}
      </div>

      {/* Row of Compact Multiselects */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Період (Сьогодні / Тиждень / Місяць / Календар з кружечками візитів) */}
        <PeriodFilterDropdown
          period={filters.period || { preset: null, startDate: null, endDate: null }}
          onChange={updatePeriod}
          visitsCountByDate={visitsCountByDate}
        />

        {/* Період фактичних продаж (з IT-Enterprise): один місяць або діапазон → середнє за місяць */}
        <SalesPeriodDropdown
          available={salesMonthsAvailable}
          selected={filters.salesMonths || []}
          onChange={updateSalesMonths}
        />

        {/* Основні організації (543, 24169, 31460, 29213, 156735) */}
        <MainOrgsFilterDropdown
          selected={filters.mainOrgs || ALL_MAIN_ORG_CODES}
          onChange={updateMainOrgs}
          counts={countsData.mainOrgs || {}}
        />

        {/* Менеджер для ролі sales — лише підпис */}
        {isSales && (
          <div
            className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-indigo-500/10 border border-indigo-500/25 text-xs text-indigo-200 select-none cursor-default shadow-sm"
            title="Відображаються лише ваші показники"
          >
            <User className="h-3.5 w-3.5 text-indigo-400 shrink-0" />
            <span className="text-white/60">Менеджер:</span>
            <span className="font-semibold text-white truncate max-w-[160px]">{managerName || "Ваші показники"}</span>
          </div>
        )}

        {/* Мультиселекти: менеджер, організація, ТТ, область, місто, виробник, категорія, тип, моделі */}
        {visibleFilters.map(f => (
          <MultiSelectDropdown
            key={f.key}
            label={f.label}
            icon={f.icon}
            selected={filters[f.key] || []}
            onChange={(vals) => updateFilterArray(f.key, vals)}
            options={f.key === "categories" ? categoryOptions : (optionsData[f.key] || [])}
            counts={countsData[f.key] || {}}
          />
        ))}

        {/* Присутність ЮНП (Segmented control: Усі / Так / Ні) */}
        <div className="inline-flex items-center bg-white/[0.04] p-0.5 rounded-xl border border-white/10 h-9 shrink-0">
          <span className="text-[11px] text-muted-foreground px-2 font-medium hidden sm:inline">
            ЮНП:
          </span>
          <button
            type="button"
            onClick={() => updatePresence("all")}
            className={`px-2.5 py-1 text-xs font-medium rounded-lg transition-all ${
              filters.presence === "all" || !filters.presence
                ? "bg-indigo-600 text-white shadow"
                : "text-muted-foreground hover:text-white"
            }`}
          >
            Усі
          </button>
          <button
            type="button"
            onClick={() => updatePresence("yes")}
            className={`px-2.5 py-1 text-xs font-medium rounded-lg transition-all ${
              filters.presence === "yes"
                ? "bg-emerald-600 text-white shadow"
                : "text-muted-foreground hover:text-white"
            }`}
          >
            Так{countsData.presence?.yes !== undefined ? ` (${countsData.presence.yes})` : ""}
          </button>
          <button
            type="button"
            disabled={isHighfoamSelected}
            onClick={() => !isHighfoamSelected && updatePresence("no")}
            title={isHighfoamSelected ? "Недоступно при обраному виробнику Highfoam" : ""}
            className={`px-2.5 py-1 text-xs font-medium rounded-lg transition-all ${
              isHighfoamSelected
                ? "opacity-30 cursor-not-allowed text-muted-foreground/60 select-none"
                : filters.presence === "no"
                ? "bg-rose-600 text-white shadow"
                : "text-muted-foreground hover:text-white"
            }`}
          >
            Ні{!isHighfoamSelected && countsData.presence?.no !== undefined ? ` (${countsData.presence.no})` : ""}
          </button>
        </div>
      </div>

      {/* Active Selected Chips Bar */}
      {hasActiveFilters && (
        <div className="pt-2 border-t border-white/5 flex flex-wrap items-center gap-1.5">
          <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider mr-1">
            Обрано:
          </span>
          {chips.map(c => <FilterChip key={c.id} chip={c} />)}
        </div>
      )}
    </div>
  );
}

const MAX_BAR_CHIPS = 5;

/**
 * Компактна смуга фільтрів (як у CRM ACAT): з'являється зверху, коли повна панель
 * прокручена за край екрана. Кнопка «Фільтри» розкриває повну панель поверх звітів.
 * children — довільні елементи праворуч (перемикач вкладок).
 */
export function CompactFilterBar({ visible, filters, setFilters, isSales, onReset, panelProps, children }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const { chips } = useFilterActions({
    filters, setFilters, isSales, salesMonthsAvailable: panelProps?.salesMonthsAvailable || [],
  });

  // Закриваємо розкриту панель при поверненні вгору, кліку поза нею та Esc
  useEffect(() => { if (!visible) setOpen(false); }, [visible]);
  useEffect(() => {
    if (!open) return;
    const onDown = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    const onKey = (e) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const shown = chips.slice(0, MAX_BAR_CHIPS);
  const rest = chips.length - shown.length;

  return (
    <div className="sticky top-0 z-50 h-0 -mx-4 md:-mx-8">
      <div
        ref={ref}
        className={`absolute inset-x-0 top-0 px-4 md:px-8 pt-2 transition-all duration-200 ${
          visible ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-3 pointer-events-none"
        }`}
      >
        <div className="flex items-center gap-2 h-12 px-3 rounded-2xl bg-[#0f172a] border border-white/10 shadow-[0_10px_30px_rgba(0,0,0,0.45)]">
          <button
            type="button"
            onClick={() => setOpen(o => !o)}
            className={`flex items-center gap-1.5 h-8 px-3 rounded-xl text-xs font-semibold border transition-all shrink-0 ${
              open ? "bg-indigo-600 text-white border-indigo-500" : "bg-white/5 border-white/10 text-white/90 hover:bg-white/10"
            }`}
            title={open ? "Згорнути фільтри" : "Розгорнути всі фільтри"}
          >
            <Filter className="h-3.5 w-3.5" />
            <span>Фільтри</span>
            {chips.length > 0 && (
              <span className="inline-flex items-center justify-center px-1.5 text-[10px] font-bold rounded-full bg-indigo-500 text-white leading-4">
                {chips.length}
              </span>
            )}
            <ChevronDown className={`h-3 w-3 transition-transform ${open ? "rotate-180" : ""}`} />
          </button>

          <div className="flex-1 min-w-0 flex items-center gap-1.5 overflow-hidden">
            {chips.length === 0 ? (
              <span className="text-[11px] text-muted-foreground truncate">Фільтри не обрано — показано всі дані</span>
            ) : (
              <>
                {shown.map(c => <FilterChip key={c.id} chip={c} />)}
                {rest > 0 && (
                  <button type="button" onClick={() => setOpen(true)} className="text-[11px] font-semibold text-indigo-300 hover:text-indigo-200 px-1 shrink-0">
                    +{rest}
                  </button>
                )}
              </>
            )}
          </div>

          {chips.length > 0 && (
            <button
              type="button"
              onClick={onReset}
              className="flex items-center gap-1 text-xs text-rose-400 hover:text-rose-300 px-2 py-1 rounded-lg hover:bg-rose-500/10 transition-colors font-medium shrink-0"
            >
              <FilterX className="h-3.5 w-3.5" />
              <span className="hidden lg:inline">Скинути всі</span>
            </button>
          )}

          {children && <div className="shrink-0 pl-2 border-l border-white/10">{children}</div>}
        </div>

        {open && (
          <div className="mt-2">
            <AnalyticsFilters
              {...panelProps}
              filters={filters}
              setFilters={setFilters}
              isSales={isSales}
              onReset={onReset}
              className="bg-[#0f172a] shadow-[0_20px_50px_rgba(0,0,0,0.6)]"
            />
          </div>
        )}
      </div>
    </div>
  );
}
