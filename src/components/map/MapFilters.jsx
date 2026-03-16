import React from "react";
import { Search, FilterX, Filter } from "lucide-react";

export function MapFilters({ 
  filters, 
  setFilters, 
  orgs, 
  points,
  types, 
  managers, 
  prices,
  brands
}) {
  const handleChange = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const resetFilters = () => {
    setFilters({
      search: "",
      org: "all",
      point: "all",
      type: "all",
      manager: "all",
      price: "all",
      brand: "all",
      presence: "all"
    });
  };

  const hasActiveFilters = filters.search || filters.org !== "all" || filters.point !== "all" || filters.type !== "all" || filters.manager !== "all" || filters.price !== "all" || filters.brand !== "all" || filters.presence !== "all";

  return (
    <div className="space-y-6 pb-6 px-4 animate-in fade-in slide-in-from-left-4 duration-500">
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
        {/* Search */}
        <div>
          <label className="text-xs text-muted-foreground uppercase tracking-wider block mb-2">Пошук</label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input 
              type="text"
              placeholder="Назва або адреса..."
              className="w-full bg-white/5 border border-white/10 rounded-xl pl-9 pr-3 py-2 text-sm outline-none focus:border-indigo-500 transition-colors text-white placeholder:text-muted-foreground/50"
              value={filters.search}
              onChange={(e) => handleChange("search", e.target.value)}
            />
          </div>
        </div>

        {/* Organization */}
        <div>
          <label className="text-xs text-muted-foreground uppercase tracking-wider block mb-2">Організація</label>
          <select 
            className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm outline-none focus:border-indigo-500 transition-colors [color-scheme:dark] text-white"
            value={filters.org}
            onChange={(e) => handleChange("org", e.target.value)}
          >
            <option value="all" className="bg-[#0b1220]">Всі організації</option>
            {orgs.map(o => <option key={o} value={o} className="bg-[#0b1220]">{o}</option>)}
          </select>
        </div>

        {/* Point Name */}
        <div>
          <label className="text-xs text-muted-foreground uppercase tracking-wider block mb-2">Назва ТТ</label>
          <select 
            className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm outline-none focus:border-indigo-500 transition-colors [color-scheme:dark] text-white"
            value={filters.point || "all"}
            onChange={(e) => handleChange("point", e.target.value)}
          >
            <option value="all" className="bg-[#0b1220]">Всі ТТ</option>
            {points?.map(p => <option key={p} value={p} className="bg-[#0b1220]">{p}</option>)}
          </select>
        </div>

        {/* TT Type */}
        <div>
          <label className="text-xs text-muted-foreground uppercase tracking-wider block mb-2">Тип ТТ</label>
          <select 
            className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm outline-none focus:border-indigo-500 transition-colors [color-scheme:dark] text-white"
            value={filters.type}
            onChange={(e) => handleChange("type", e.target.value)}
          >
            <option value="all" className="bg-[#0b1220]">Всі типи</option>
            {types.map(t => <option key={t} value={t} className="bg-[#0b1220]">{t}</option>)}
          </select>
        </div>

        {/* Market Presence */}
        <div>
          <label className="text-xs text-muted-foreground uppercase tracking-wider block mb-2">Присутність на ринку</label>
          <select 
            className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm outline-none focus:border-indigo-500 transition-colors [color-scheme:dark] text-white"
            value={filters.presence}
            onChange={(e) => handleChange("presence", e.target.value)}
          >
            <option value="all" className="bg-[#0b1220]">Всі</option>
            <option value="highfoam" className="bg-[#0b1220]">Присутні</option>
            <option value="competitors" className="bg-[#0b1220]">Неприсутні</option>
          </select>
        </div>

        {/* Brands */}
        <div>
          <label className="text-xs text-muted-foreground uppercase tracking-wider block mb-2">Моделі</label>
          <select 
            className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm outline-none focus:border-indigo-500 transition-colors [color-scheme:dark] text-white"
            value={filters.brand}
            onChange={(e) => handleChange("brand", e.target.value)}
          >
            <option value="all" className="bg-[#0b1220]">Всі моделі</option>
            {brands.map(b => (
              <option key={b.name} value={b.name} className="bg-[#0b1220]">
                {b.name} ({b.count})
              </option>
            ))}
          </select>
        </div>

        {/* Manager */}
        <div>
          <label className="text-xs text-muted-foreground uppercase tracking-wider block mb-2">Менеджер (ост. візит)</label>
          <select 
            className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm outline-none focus:border-indigo-500 transition-colors [color-scheme:dark] text-white"
            value={filters.manager}
            onChange={(e) => handleChange("manager", e.target.value)}
          >
            <option value="all" className="bg-[#0b1220]">Всі менеджери</option>
            {managers.map(m => <option key={m} value={m} className="bg-[#0b1220]">{m}</option>)}
          </select>
        </div>

        {/* Price */}
        <div>
          <label className="text-xs text-muted-foreground uppercase tracking-wider block mb-2">Прайс (ост. візит)</label>
          <select 
            className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm outline-none focus:border-indigo-500 transition-colors [color-scheme:dark] text-white"
            value={filters.price}
            onChange={(e) => handleChange("price", e.target.value)}
          >
            <option value="all" className="bg-[#0b1220]">Всі прайси</option>
            {prices.map(p => <option key={p} value={p} className="bg-[#0b1220]">{p}</option>)}
          </select>
        </div>
      </div>
    </div>
  );
}
