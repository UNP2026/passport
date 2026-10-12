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
  Calendar
} from "lucide-react";
import { PeriodFilterDropdown } from "./PeriodFilterDropdown";
import { MainOrgsFilterDropdown } from "./MainOrgsFilterDropdown";
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

export function AnalyticsFilters({ 
  filters, 
  setFilters, 
  optionsData = {}, 
  countsData = {},
  visitsCountByDate = {},
  onReset 
}) {
  const isHighfoamSelected = useMemo(() => {
    return (filters.manufacturers || []).some(
      m => m.trim().toLowerCase() === "highfoam"
    );
  }, [filters.manufacturers]);

  const updatePeriod = (newPeriod) => {
    setFilters(prev => ({
      ...prev,
      period: newPeriod
    }));
  };

  const updateMainOrgs = (newMainOrgs) => {
    setFilters(prev => ({
      ...prev,
      mainOrgs: newMainOrgs
    }));
  };

  const updateFilterArray = (key, newValues) => {
    setFilters(prev => {
      let nextPresence = prev.presence;
      if (key === "manufacturers") {
        const hasHf = newValues.some(m => m.trim().toLowerCase() === "highfoam");
        if (hasHf && prev.presence === "no") {
          nextPresence = "all";
        }
      }
      return {
        ...prev,
        [key]: newValues,
        presence: nextPresence
      };
    });
  };

  const updatePresence = (val) => {
    setFilters(prev => {
      let nextManufacturers = prev.manufacturers || [];
      if (val === "no") {
        nextManufacturers = nextManufacturers.filter(m => m.trim().toLowerCase() !== "highfoam");
      }
      return {
        ...prev,
        presence: val,
        manufacturers: nextManufacturers
      };
    });
  };

  const activeCount = useMemo(() => {
    let count = 0;
    if (filters.period?.startDate || filters.period?.endDate) count += 1;
    if (filters.mainOrgs && filters.mainOrgs.length < ALL_MAIN_ORG_CODES.length) {
      count += (ALL_MAIN_ORG_CODES.length - filters.mainOrgs.length);
    }
    if (filters.managers?.length) count += filters.managers.length;
    if (filters.orgs?.length) count += filters.orgs.length;
    if (filters.points?.length) count += filters.points.length;
    if (filters.oblasts?.length) count += filters.oblasts.length;
    if (filters.cities?.length) count += filters.cities.length;
    if (filters.manufacturers?.length) count += filters.manufacturers.length;
    if (filters.categories?.length) count += filters.categories.length;
    if (filters.ttTypes?.length) count += filters.ttTypes.length;
    if (filters.presence && filters.presence !== "all") count += 1;
    return count;
  }, [filters]);

  const hasActiveFilters = activeCount > 0;

  // Category labels mapping (e.g. A -> Категорія A)
  const categoryOptions = useMemo(() => {
    return (optionsData.categories || ["A", "B", "C", "D"]).map(cat => ({
      value: cat,
      label: `Категорія ${cat}`
    }));
  }, [optionsData.categories]);

  return (
    <div className="relative z-40 glass-soft rounded-2xl p-3.5 border border-white/10 shadow-xl space-y-3 mb-6">
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
        {/* ФІЛЬТР 1: Період (Сьогодні / Тиждень / Місяць / Календар з кружечками візитів) */}
        <PeriodFilterDropdown
          period={filters.period || { preset: null, startDate: null, endDate: null }}
          onChange={updatePeriod}
          visitsCountByDate={visitsCountByDate}
        />

        {/* ФІЛЬТР 2: Основні організації (543, 24169, 31460, 29213, 156735) */}
        <MainOrgsFilterDropdown
          selected={filters.mainOrgs || ALL_MAIN_ORG_CODES}
          onChange={updateMainOrgs}
          counts={countsData.mainOrgs || {}}
        />

        {/* 1. Менеджер */}
        <MultiSelectDropdown
          label="Менеджер"
          icon={User}
          selected={filters.managers || []}
          onChange={(vals) => updateFilterArray("managers", vals)}
          options={optionsData.managers || []}
          counts={countsData.managers || {}}
        />

        {/* 2. Організація */}
        <MultiSelectDropdown
          label="Організація"
          icon={Building2}
          selected={filters.orgs || []}
          onChange={(vals) => updateFilterArray("orgs", vals)}
          options={optionsData.orgs || []}
          counts={countsData.orgs || {}}
        />

        {/* 3. Торгова точка */}
        <MultiSelectDropdown
          label="Торгова точка"
          icon={Store}
          selected={filters.points || []}
          onChange={(vals) => updateFilterArray("points", vals)}
          options={optionsData.points || []}
          counts={countsData.points || {}}
        />

        {/* 4. Область */}
        <MultiSelectDropdown
          label="Область"
          icon={Globe}
          selected={filters.oblasts || []}
          onChange={(vals) => updateFilterArray("oblasts", vals)}
          options={optionsData.oblasts || []}
          counts={countsData.oblasts || {}}
        />

        {/* 5. Місто */}
        <MultiSelectDropdown
          label="Місто"
          icon={MapPin}
          selected={filters.cities || []}
          onChange={(vals) => updateFilterArray("cities", vals)}
          options={optionsData.cities || []}
          counts={countsData.cities || {}}
        />

        {/* 6. Виробник */}
        <MultiSelectDropdown
          label="Виробник"
          icon={Factory}
          selected={filters.manufacturers || []}
          onChange={(vals) => updateFilterArray("manufacturers", vals)}
          options={optionsData.manufacturers || []}
          counts={countsData.manufacturers || {}}
        />

        {/* 7. Категорія */}
        <MultiSelectDropdown
          label="Категорія"
          icon={Tag}
          selected={filters.categories || []}
          onChange={(vals) => updateFilterArray("categories", vals)}
          options={categoryOptions}
          counts={countsData.categories || {}}
        />

        {/* 8. Тип точки */}
        <MultiSelectDropdown
          label="Тип точки"
          icon={Layers}
          selected={filters.ttTypes || []}
          onChange={(vals) => updateFilterArray("ttTypes", vals)}
          options={optionsData.ttTypes || []}
          counts={countsData.ttTypes || {}}
        />

        {/* 9. Присутність ЮНП (Segmented control: Усі / Так / Ні) */}
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

          {/* Period chip */}
          {(filters.period?.startDate || filters.period?.endDate) && (
            <span className="inline-flex items-center gap-1 text-[11px] bg-indigo-500/15 border border-indigo-500/30 text-indigo-200 px-2 py-0.5 rounded-lg">
              <Calendar className="h-3 w-3 text-indigo-400" />
              <span className="text-muted-foreground">Період:</span>{" "}
              {filters.period.preset === "today"
                ? "Сьогодні"
                : filters.period.preset === "week"
                ? "Тиждень"
                : filters.period.preset === "month"
                ? "Місяць"
                : `${filters.period.startDate ? filters.period.startDate.split('-').reverse().join('.') : ""} — ${filters.period.endDate ? filters.period.endDate.split('-').reverse().join('.') : ""}`}
              <button
                type="button"
                onClick={() => updatePeriod({ preset: null, startDate: null, endDate: null })}
                className="hover:text-white transition-colors ml-0.5"
                title="Скинути період"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          )}

          {/* Main Orgs chip (shown when some are disabled) */}
          {filters.mainOrgs && filters.mainOrgs.length < ALL_MAIN_ORG_CODES.length && (
            <span className="inline-flex items-center gap-1 text-[11px] bg-indigo-500/15 border border-indigo-500/30 text-indigo-200 px-2 py-0.5 rounded-lg">
              <Building2 className="h-3 w-3 text-indigo-400" />
              <span className="text-muted-foreground">Основні орг:</span> {filters.mainOrgs.length} з {ALL_MAIN_ORG_CODES.length}
              <button
                type="button"
                onClick={() => updateMainOrgs([...ALL_MAIN_ORG_CODES])}
                className="hover:text-white transition-colors ml-0.5"
                title="Увімкнути всі основні організації"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          )}

          {/* Manager chips */}
          {filters.managers?.map(m => (
            <span
              key={`mgr-${m}`}
              className="inline-flex items-center gap-1 text-[11px] bg-indigo-500/15 border border-indigo-500/30 text-indigo-200 px-2 py-0.5 rounded-lg"
            >
              <span className="text-muted-foreground">Менеджер:</span> {m}
              <button
                type="button"
                onClick={() => updateFilterArray("managers", filters.managers.filter(x => x !== m))}
                className="hover:text-white transition-colors ml-0.5"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}

          {/* Org chips */}
          {filters.orgs?.map(o => (
            <span
              key={`org-${o}`}
              className="inline-flex items-center gap-1 text-[11px] bg-indigo-500/15 border border-indigo-500/30 text-indigo-200 px-2 py-0.5 rounded-lg"
            >
              <span className="text-muted-foreground">Орг:</span> {o}
              <button
                type="button"
                onClick={() => updateFilterArray("orgs", filters.orgs.filter(x => x !== o))}
                className="hover:text-white transition-colors ml-0.5"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}

          {/* Point chips */}
          {filters.points?.map(p => (
            <span
              key={`pt-${p}`}
              className="inline-flex items-center gap-1 text-[11px] bg-indigo-500/15 border border-indigo-500/30 text-indigo-200 px-2 py-0.5 rounded-lg"
            >
              <span className="text-muted-foreground">ТТ:</span> {p}
              <button
                type="button"
                onClick={() => updateFilterArray("points", filters.points.filter(x => x !== p))}
                className="hover:text-white transition-colors ml-0.5"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}

          {/* Oblast chips */}
          {filters.oblasts?.map(ob => (
            <span
              key={`obl-${ob}`}
              className="inline-flex items-center gap-1 text-[11px] bg-indigo-500/15 border border-indigo-500/30 text-indigo-200 px-2 py-0.5 rounded-lg"
            >
              <span className="text-muted-foreground">Обл:</span> {ob}
              <button
                type="button"
                onClick={() => updateFilterArray("oblasts", filters.oblasts.filter(x => x !== ob))}
                className="hover:text-white transition-colors ml-0.5"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}

          {/* City chips */}
          {filters.cities?.map(c => (
            <span
              key={`cty-${c}`}
              className="inline-flex items-center gap-1 text-[11px] bg-indigo-500/15 border border-indigo-500/30 text-indigo-200 px-2 py-0.5 rounded-lg"
            >
              <span className="text-muted-foreground">Місто:</span> {c}
              <button
                type="button"
                onClick={() => updateFilterArray("cities", filters.cities.filter(x => x !== c))}
                className="hover:text-white transition-colors ml-0.5"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}

          {/* Manufacturer chips */}
          {filters.manufacturers?.map(mf => (
            <span
              key={`mf-${mf}`}
              className="inline-flex items-center gap-1 text-[11px] bg-indigo-500/15 border border-indigo-500/30 text-indigo-200 px-2 py-0.5 rounded-lg"
            >
              <span className="text-muted-foreground">Виробник:</span> {mf}
              <button
                type="button"
                onClick={() => updateFilterArray("manufacturers", filters.manufacturers.filter(x => x !== mf))}
                className="hover:text-white transition-colors ml-0.5"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}

          {/* Category chips */}
          {filters.categories?.map(cat => (
            <span
              key={`cat-${cat}`}
              className="inline-flex items-center gap-1 text-[11px] bg-indigo-500/15 border border-indigo-500/30 text-indigo-200 px-2 py-0.5 rounded-lg"
            >
              <span className="text-muted-foreground">Категорія:</span> {cat}
              <button
                type="button"
                onClick={() => updateFilterArray("categories", filters.categories.filter(x => x !== cat))}
                className="hover:text-white transition-colors ml-0.5"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}

          {/* TT type chips */}
          {filters.ttTypes?.map(tt => (
            <span
              key={`tt-${tt}`}
              className="inline-flex items-center gap-1 text-[11px] bg-indigo-500/15 border border-indigo-500/30 text-indigo-200 px-2 py-0.5 rounded-lg"
            >
              <span className="text-muted-foreground">Тип:</span> {tt}
              <button
                type="button"
                onClick={() => updateFilterArray("ttTypes", filters.ttTypes.filter(x => x !== tt))}
                className="hover:text-white transition-colors ml-0.5"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}

          {/* Presence chip */}
          {filters.presence && filters.presence !== "all" && (
            <span className="inline-flex items-center gap-1 text-[11px] bg-indigo-500/15 border border-indigo-500/30 text-indigo-200 px-2 py-0.5 rounded-lg">
              <span className="text-muted-foreground">ЮНП:</span> {filters.presence === "yes" ? "Так" : "Ні"}
              <button
                type="button"
                onClick={() => updatePresence("all")}
                className="hover:text-white transition-colors ml-0.5"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          )}
        </div>
      )}
    </div>
  );
}
