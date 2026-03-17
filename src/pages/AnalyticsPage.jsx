import React, { useState, useMemo, useEffect } from "react";
import { createPortal } from "react-dom";
import { useAuth } from "../hooks/useAuth";
import { Navigate } from "react-router-dom";
import { fetchRealAnalyticsData } from "../api/analytics";
import { AnalyticsFilters } from "../components/analytics/AnalyticsFilters";
import { BrandHeatmap } from "../components/analytics/BrandHeatmap";
import { PointsDetailTable } from "../components/analytics/PointsDetailTable";
import { BrandSummary } from "../components/analytics/BrandSummary";
import { ManagerStatsTable } from "../components/analytics/ManagerStatsTable";
import { BarChart3, Map as MapIcon, Users, TrendingUp, Download, LayoutGrid, List, Store, Package, Loader2, Filter } from "lucide-react";
import * as XLSX from "xlsx";
import { useSidebar } from "../context/SidebarContext";

export function AnalyticsPage() {
  const { profile, authLoading } = useAuth();
  const { isCollapsed, setIsCollapsed, filterContainer } = useSidebar();
  const [viewMode, setViewMode] = useState("dashboard"); // dashboard or table
  const [activeStat, setActiveStat] = useState(null); // visits, cities, tt, brands
  const [filters, setFilters] = useState({
    city: "all",
    agent: "all",
    brand: "all",
    point: "all",
    presence: "all",
    datePreset: "all",
    dateFrom: "",
    dateTo: ""
  });

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      const result = await fetchRealAnalyticsData();
      setData(result);
      setLoading(false);
    }
    loadData();
  }, []);

  const filteredData = useMemo(() => {
    if (!data) return [];
    return data.raw.filter(d => {
      const cityMatch = filters.city === "all" || d.city === filters.city;
      const agentMatch = filters.agent === "all" || d.agent === filters.agent;
      const brandMatch = filters.brand === "all" || d.brandPresence[filters.brand];
      const pointMatch = filters.point === "all" || d.point === filters.point;
      
      let presenceMatch = true;
      if (filters.presence === "highfoam") {
        presenceMatch = d.hasHighfoam === true;
      } else if (filters.presence === "competitors") {
        presenceMatch = d.hasHighfoam === false;
      }
      
      let dateMatch = true;
      if (filters.dateFrom) {
        dateMatch = dateMatch && d.date >= filters.dateFrom;
      }
      if (filters.dateTo) {
        dateMatch = dateMatch && d.date <= filters.dateTo;
      }

      return cityMatch && agentMatch && brandMatch && pointMatch && presenceMatch && dateMatch;
    });
  }, [data, filters]);

  const stats = useMemo(() => {
    if (!data) return [];
    const totalVisits = filteredData.length;
    const uniqueCities = new Set(filteredData.map(d => d.city)).size;
    const uniqueTTs = new Set(filteredData.map(d => d.point)).size;
    
    const presentBrands = new Set();
    filteredData.forEach(d => {
      Object.entries(d.brandPresence).forEach(([brand, isPresent]) => {
        if (isPresent) presentBrands.add(brand);
      });
    });
    const brandsCount = presentBrands.size;
    
    return [
      { id: 'visits', label: "Всього візитів", value: totalVisits, icon: BarChart3, color: "text-indigo-400" },
      { id: 'cities', label: "Міст охоплено", value: uniqueCities, icon: MapIcon, color: "text-emerald-400" },
      { id: 'tt', label: "Кількість ТТ", value: uniqueTTs, icon: Store, color: "text-amber-400" },
      { id: 'brands', label: "Кількість моделей", value: brandsCount, icon: Package, color: "text-cyan-400" },
    ];
  }, [filteredData, data]);

  const handleStatClick = (statId) => {
    if (activeStat === statId) {
      setActiveStat(null);
    } else {
      setActiveStat(statId);
    }
  };

  const handleExport = () => {
    if (!data || !filteredData.length) return;

    const exportData = filteredData.map(d => {
      const row = {
        "Дата": d.date,
        "Місто": d.city,
        "Менеджер": d.agent,
        "Торгова точка": d.point,
      };
      data.brandNames.forEach(b => {
        row[b] = d.brandPresence[b] ? "Так" : "Ні";
      });
      return row;
    });

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Аналітика");
    
    const dateStr = new Date().toISOString().split('T')[0];
    XLSX.writeFile(wb, `analytics_${dateStr}.xlsx`);
  };

  if (authLoading || loading) return (
    <div className="flex-1 bg-[#0b1220] flex items-center justify-center">
      <div className="text-center">
        <Loader2 className="h-12 w-12 text-indigo-500 animate-spin mx-auto mb-4" />
        <div className="text-muted-foreground">Завантаження аналітики...</div>
      </div>
    </div>
  );

  const canAccess = profile?.role === "admin" || profile?.role === "head";

  if (!canAccess) {
    return <Navigate to="/app/surveys/start" replace />;
  }

  const filtersContent = (
    <AnalyticsFilters 
      filters={filters} 
      setFilters={setFilters} 
      cities={data.cities}
      agents={data.agents}
      brands={data.brands}
      points={data.points}
    />
  );

  const collapsedFiltersContent = (
    <div className="flex flex-col items-center gap-4 py-4">
      <button 
        onClick={() => setIsCollapsed(false)}
        className="p-3 rounded-xl bg-indigo-600/10 text-indigo-400 hover:bg-indigo-600 hover:text-white transition-all"
        title="Відкрити фільтри"
      >
        <Filter className="h-5 w-5" />
      </button>
    </div>
  );

  return (
    <div className="flex-1 bg-[#0b1220] text-white p-4 pb-20 md:p-8">
      {/* Portal filters to Sidebar if available */}
      {filterContainer && createPortal(
        isCollapsed ? collapsedFiltersContent : filtersContent,
        filterContainer
      )}

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Аналітичний дашборд</h1>
          <p className="text-muted-foreground">Аналіз присутності моделей та ефективності менеджерів</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex bg-white/5 p-1 rounded-xl border border-white/10 mr-2">
            <button 
              onClick={() => setViewMode("dashboard")}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs transition-all ${viewMode === 'dashboard' ? 'bg-indigo-600 text-white shadow-lg' : 'text-muted-foreground hover:text-white'}`}
            >
              <LayoutGrid className="h-3.5 w-3.5" />
              Дашборд
            </button>
            <button 
              onClick={() => setViewMode("table")}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs transition-all ${viewMode === 'table' ? 'bg-indigo-600 text-white shadow-lg' : 'text-muted-foreground hover:text-white'}`}
            >
              <List className="h-3.5 w-3.5" />
              Деталізація
            </button>
          </div>
          <button 
            onClick={handleExport}
            disabled={!filteredData.length}
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed px-4 py-2 rounded-xl transition-all font-medium text-sm"
          >
            <Download className="h-4 w-4" />
            Експорт
          </button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {stats.map((s) => (
          <button 
            key={s.id} 
            onClick={() => handleStatClick(s.id)}
            className={`glass p-6 rounded-3xl border transition-all duration-300 text-left group ${
              activeStat === s.id 
                ? "border-indigo-500 bg-indigo-500/10 ring-2 ring-indigo-500/20" 
                : "border-white/5 hover:border-white/20 hover:bg-white/5"
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <s.icon className={`h-5 w-5 transition-transform duration-300 group-hover:scale-110 ${s.color}`} />
              {activeStat === s.id && <div className="h-2 w-2 rounded-full bg-indigo-500 animate-pulse" />}
            </div>
            <div className="text-2xl font-bold">{s.value}</div>
            <div className="text-xs text-muted-foreground uppercase tracking-wider">{s.label}</div>
          </button>
        ))}
      </div>

      {/* Detailed Manager Stats (Collapsible) */}
      {activeStat && (
        <div className="mb-8">
          <ManagerStatsTable 
            data={filteredData} 
            agents={data.agents} 
            activeStat={activeStat}
            brands={data.brandNames}
          />
        </div>
      )}

      <div className="flex flex-col lg:flex-row gap-8">
        {/* Sidebar Filters - Only show here if portal is not available (e.g. mobile) */}
        {!filterContainer && (
          <div className="w-full lg:w-64 shrink-0 glass p-6 rounded-3xl">
            {filtersContent}
          </div>
        )}

        {/* Main Content Area */}
        <div className="flex-1 space-y-8">
          {viewMode === "dashboard" ? (
            <>
              <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
                <div className="xl:col-span-2">
                  <BrandHeatmap 
                    data={filteredData} 
                    brands={data.brandNames} 
                    cities={data.cities} 
                    agents={data.agents}
                  />
                </div>
                <div>
                  <BrandSummary 
                    data={filteredData} 
                    brands={data.brandNames} 
                  />
                </div>
              </div>
            </>
          ) : (
            <PointsDetailTable 
              data={filteredData} 
              brands={data.brandNames} 
            />
          )}
        </div>
      </div>
    </div>
  );
}
