import React from "react";
import { Filter, FilterX, Calendar } from "lucide-react";

export function AnalyticsFilters({ filters, setFilters, cities, agents, brands, points }) {
  const handlePresetChange = (preset) => {
    const today = new Date();
    const formatDate = (d) => {
      const offset = d.getTimezoneOffset() * 60000;
      return new Date(d - offset).toISOString().split('T')[0];
    };

    let from = "";
    let to = "";

    if (preset === "today") {
      from = formatDate(today);
      to = formatDate(today);
    } else if (preset === "week") {
      const d = new Date(today);
      const day = d.getDay();
      const diff = d.getDate() - day + (day === 0 ? -6 : 1);
      const startOfWeek = new Date(d.setDate(diff));
      from = formatDate(startOfWeek);
      to = formatDate(today);
    } else if (preset === "month") {
      const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
      from = formatDate(startOfMonth);
      to = formatDate(today);
    } else if (preset === "custom") {
      from = filters.dateFrom;
      to = filters.dateTo;
    }

    setFilters({ ...filters, datePreset: preset, dateFrom: from, dateTo: to });
  };

  const handleCustomDateChange = (field, value) => {
    setFilters({ ...filters, datePreset: "custom", [field]: value });
  };

  const resetFilters = () => {
    setFilters({ city: "all", agent: "all", brand: "all", point: "all", presence: "all", datePreset: "all", dateFrom: "", dateTo: "" });
  };

  const hasActiveFilters = filters.city !== "all" || filters.agent !== "all" || filters.brand !== "all" || filters.point !== "all" || filters.presence !== "all" || filters.datePreset !== "all" || filters.dateFrom || filters.dateTo;

  return (
    <div className="space-y-6 pb-6 px-4">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3 text-indigo-400">
          <Filter className="h-5 w-5 shrink-0" />
          <h2 className="font-bold">Фільтри</h2>
        </div>
        {hasActiveFilters && (
          <button 
            onClick={resetFilters}
            className="text-xs text-rose-400 hover:text-rose-300 flex items-center gap-1 transition-colors"
          >
            <FilterX className="h-3 w-3" />
            Скинути
          </button>
        )}
      </div>

      <div className="space-y-4">
        <div>
          <label className="text-xs text-muted-foreground uppercase tracking-wider block mb-2">Період</label>
          <select 
            className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm outline-none focus:border-indigo-500 transition-colors [color-scheme:dark]"
            value={filters.datePreset || "all"}
            onChange={(e) => handlePresetChange(e.target.value)}
          >
            <option value="all" className="bg-[#0b1220] text-white">Всі</option>
            <option value="today" className="bg-[#0b1220] text-white">Сьогодні</option>
            <option value="week" className="bg-[#0b1220] text-white">Тиждень</option>
            <option value="month" className="bg-[#0b1220] text-white">Місяць</option>
            <option value="custom" className="bg-[#0b1220] text-white">Вручну</option>
          </select>
        </div>

        {filters.datePreset === "custom" && (
          <div className="grid grid-cols-2 gap-2 animate-in fade-in slide-in-from-top-2">
            <div>
              <label className="text-[10px] text-muted-foreground uppercase tracking-wider block mb-1">З</label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input 
                  type="date"
                  className="w-full bg-white/5 border border-white/10 rounded-xl pl-9 pr-2 py-2 text-sm outline-none focus:border-indigo-500 transition-colors text-white [color-scheme:dark]"
                  value={filters.dateFrom || ""}
                  onChange={(e) => handleCustomDateChange("dateFrom", e.target.value)}
                />
              </div>
            </div>
            <div>
              <label className="text-[10px] text-muted-foreground uppercase tracking-wider block mb-1">По</label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input 
                  type="date"
                  className="w-full bg-white/5 border border-white/10 rounded-xl pl-9 pr-2 py-2 text-sm outline-none focus:border-indigo-500 transition-colors text-white [color-scheme:dark]"
                  value={filters.dateTo || ""}
                  onChange={(e) => handleCustomDateChange("dateTo", e.target.value)}
                />
              </div>
            </div>
          </div>
        )}

        <div>
          <label className="text-xs text-muted-foreground uppercase tracking-wider block mb-2">Місто</label>
          <select 
            className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm outline-none focus:border-indigo-500 transition-colors [color-scheme:dark]"
            value={filters.city}
            onChange={(e) => setFilters({ ...filters, city: e.target.value })}
          >
            <option value="all" className="bg-[#0b1220] text-white">Всі міста</option>
            {cities.map(c => <option key={c} value={c} className="bg-[#0b1220] text-white">{c}</option>)}
          </select>
        </div>

        <div>
          <label className="text-xs text-muted-foreground uppercase tracking-wider block mb-2">Менеджер</label>
          <select 
            className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm outline-none focus:border-indigo-500 transition-colors [color-scheme:dark]"
            value={filters.agent}
            onChange={(e) => setFilters({ ...filters, agent: e.target.value })}
          >
            <option value="all" className="bg-[#0b1220] text-white">Всі менеджери</option>
            {agents.map(a => <option key={a} value={a} className="bg-[#0b1220] text-white">{a}</option>)}
          </select>
        </div>

        <div>
          <label className="text-xs text-muted-foreground uppercase tracking-wider block mb-2">Назва ТТ</label>
          <select 
            className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm outline-none focus:border-indigo-500 transition-colors [color-scheme:dark]"
            value={filters.point || "all"}
            onChange={(e) => setFilters({ ...filters, point: e.target.value })}
          >
            <option value="all" className="bg-[#0b1220] text-white">Всі ТТ</option>
            {points?.map(p => <option key={p} value={p} className="bg-[#0b1220] text-white">{p}</option>)}
          </select>
        </div>

        <div>
          <label className="text-xs text-muted-foreground uppercase tracking-wider block mb-2">Присутність на ринку</label>
          <select 
            className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm outline-none focus:border-indigo-500 transition-colors [color-scheme:dark]"
            value={filters.presence || "all"}
            onChange={(e) => setFilters({ ...filters, presence: e.target.value })}
          >
            <option value="all" className="bg-[#0b1220] text-white">Всі</option>
            <option value="highfoam" className="bg-[#0b1220] text-white">Highfoam</option>
            <option value="competitors" className="bg-[#0b1220] text-white">Конкуренти</option>
          </select>
        </div>

        <div>
          <label className="text-xs text-muted-foreground uppercase tracking-wider block mb-2">Модель</label>
          <select 
            className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm outline-none focus:border-indigo-500 transition-colors [color-scheme:dark]"
            value={filters.brand}
            onChange={(e) => setFilters({ ...filters, brand: e.target.value })}
          >
            <option value="all" className="bg-[#0b1220] text-white">Всі моделі</option>
            {brands.map(b => (
              <option key={b.name} value={b.name} className="bg-[#0b1220] text-white">
                {b.name} ({b.count})
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
}
