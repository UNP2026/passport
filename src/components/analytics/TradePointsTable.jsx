import React, { useMemo, useState } from "react";
import { Store, Download, ChevronDown, ChevronUp, Search, ExternalLink } from "lucide-react";
import * as XLSX from "xlsx";
import { PointCardModal } from "./PointCardModal";
import { EMPTY_SALES_INDEX, formatSales, salesForExcel, salesPeriodLabel } from "../../lib/salesUtils";

export function TradePointsTable({ data = [], allVisits = [], allBrands = [], salesIndex = EMPTY_SALES_INDEX }) {
  // data is latestFilteredVisits (one latest visit per unique TT)
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [sortField, setSortField] = useState("visitedAt");
  const [sortDirection, setSortDirection] = useState("desc");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedPoint, setSelectedPoint] = useState(null);

  // Map total visits count per TT from allVisits (unfiltered database history)
  const totalVisitsCountMap = useMemo(() => {
    const map = new Map();
    (allVisits || []).forEach(v => {
      const key = v.ttKey || `${(v.org || "").toLowerCase()}:::${(v.point || "").toLowerCase()}:::${(v.address || "").toLowerCase()}`;
      map.set(key, (map.get(key) || 0) + 1);
      if (v.pointId) {
        map.set(`point_${v.pointId}`, (map.get(`point_${v.pointId}`) || 0) + 1);
      }
    });
    return map;
  }, [allVisits]);

  // Helper date formatting
  const formatDateUA = (dateStr) => {
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

  // Helper days calculation
  const getDaysAfter = (visitedAt) => {
    if (!visitedAt || visitedAt === "—") return 0;
    try {
      const d = new Date(visitedAt);
      if (isNaN(d.getTime())) return 0;
      const now = new Date();
      const diffTime = now.getTime() - d.getTime();
      const days = Math.floor(diffTime / (1000 * 60 * 60 * 24));
      return days >= 0 ? days : 0;
    } catch {
      return 0;
    }
  };

  // Prepare table rows
  const rows = useMemo(() => {
    return (data || []).map(v => {
      const totalVisits = (v.pointId && totalVisitsCountMap.get(`point_${v.pointId}`)) 
        || totalVisitsCountMap.get(v.ttKey) 
        || 1;

      const daysAfter = getDaysAfter(v.visitedAt);
      const formattedDate = formatDateUA(v.visitedAt || v.date);

      // City with "м. " prefix if needed
      let formattedCity = v.city || "—";
      if (
        formattedCity !== "—" &&
        !formattedCity.startsWith("м.") && 
        !formattedCity.startsWith("с.") && 
        !formattedCity.startsWith("смт.")
      ) {
        formattedCity = `м. ${formattedCity}`;
      }

      // Calculate price segments: high = 100 - low - mid if high is 0
      let low = v.priceSegLow ?? 0;
      let mid = v.priceSegMid ?? 0;
      let high = v.priceSegHigh ?? 0;
      if (high === 0 && (low > 0 || mid > 0) && low + mid <= 100) {
        high = Math.max(0, 100 - low - mid);
      }

      return {
        id: v.id,
        point: v.point || "Невідома ТТ",
        org: v.org || "Без організації",
        city: formattedCity,
        rawCity: v.city,
        oblast: v.oblast || "—",
        orgTtCount: v.orgTtCount || 0,
        totalPP: v.totalPP || 0,
        highfoamPP: v.highfoamPP || 0,
        // Фактичні продажі (IT-Enterprise) за «Період продаж»: менеджера ТТ по організації ТТ та всієї організації
        actualByManager: salesIndex.managerOrg(v.authorUserId, v.orgCode),
        actualByOrg: salesIndex.org(v.orgCode),
        totalKV: v.totalKV || 0,
        highfoamKV: v.highfoamKV || 0,
        priceSegLow: low,
        priceSegMid: mid,
        priceSegHigh: high,
        sellsPillows: v.sellsPillows ? "Так" : "Ні",
        sellsPillowsBool: v.sellsPillows,
        agent: v.agent || "Невідомий",
        visitedAt: v.visitedAt || v.date,
        formattedDate,
        daysAfter,
        totalVisits,
        rawVisit: v,
      };
    });
  }, [data, totalVisitsCountMap, salesIndex]);

  // Search filter
  const filteredRows = useMemo(() => {
    if (!searchQuery.trim()) return rows;
    const q = searchQuery.toLowerCase().trim();
    return rows.filter(r => 
      r.point.toLowerCase().includes(q) ||
      r.org.toLowerCase().includes(q) ||
      r.city.toLowerCase().includes(q) ||
      r.agent.toLowerCase().includes(q)
    );
  }, [rows, searchQuery]);

  // Sorting
  const sortedRows = useMemo(() => {
    return [...filteredRows].sort((a, b) => {
      let aVal = a[sortField];
      let bVal = b[sortField];

      if (sortField === "visitedAt") {
        const timeA = new Date(aVal || 0).getTime() || 0;
        const timeB = new Date(bVal || 0).getTime() || 0;
        return sortDirection === "asc" ? timeA - timeB : timeB - timeA;
      }

      if (typeof aVal === "string") {
        const cmp = aVal.localeCompare(bVal, "uk");
        return sortDirection === "asc" ? cmp : -cmp;
      }

      aVal = aVal || 0;
      bVal = bVal || 0;
      return sortDirection === "asc" ? aVal - bVal : bVal - aVal;
    });
  }, [filteredRows, sortField, sortDirection]);

  const handleSort = (field) => {
    if (sortField === field) {
      setSortDirection(prev => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDirection("desc");
    }
  };

  const handleExportExcel = (e) => {
    if (e) e.stopPropagation();
    if (!sortedRows.length) return;

    const exportData = sortedRows.map(r => ({
      "Торгова точка": r.point,
      "Організація": r.org,
      "Місто": r.city,
      "Кіл-ть ТТ": r.orgTtCount,
      "Загальний потенціал точки": r.totalPP,
      "Продажі ЮНП": r.highfoamPP,
      [`Фактичні продажі по менеджеру (${salesPeriodLabel(salesIndex.months)})`]: salesForExcel(r.actualByManager),
      [`Фактичні продажі по організації (${salesPeriodLabel(salesIndex.months)})`]: salesForExcel(r.actualByOrg),
      "Кількість спальних місць": r.totalKV,
      "Кількість спальних місць ЮНП": r.highfoamKV,
      "Продає подушки": r.sellsPillows,
      "Менеджер": r.agent,
      "Дата останнього візиту": r.formattedDate,
      "Днів після візиту": r.daysAfter,
      "Загальна кількість візитів": r.totalVisits,
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Торгові точки");
    const dateStr = new Date().toISOString().split("T")[0];
    XLSX.writeFile(wb, `Торгові_точки_${dateStr}.xlsx`);
  };

  // Column header styling helper
  const getHeaderClass = (field, align = "text-center") => {
    const isSorted = sortField === field;
    return `py-2.5 px-2.5 ${align} font-bold cursor-pointer select-none transition-colors ${
      isSorted
        ? "bg-indigo-500/25 text-indigo-200 border-b-2 border-indigo-400"
        : "text-white/90 hover:bg-white/5"
    }`;
  };

  // Cell styling helper
  const getCellClass = (field, align = "text-right") => {
    const isSorted = sortField === field;
    return `py-2.5 px-2.5 ${align} ${
      isSorted ? "bg-indigo-500/[0.08] text-white font-medium" : "text-white/85"
    }`;
  };

  return (
    <>
      <div className="glass rounded-3xl border border-white/10 shadow-2xl overflow-hidden p-4 sm:p-5 space-y-3 transition-all duration-300">
        {/* Block Header */}
        <div
          onClick={() => setIsCollapsed(prev => !prev)}
          className="flex items-center justify-between gap-3 cursor-pointer select-none group"
        >
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 group-hover:bg-indigo-500/20 transition-colors">
              <Store className="h-4 w-4" />
            </div>
            <div className="flex items-center gap-2.5">
              <h2 className="text-base sm:text-lg font-bold tracking-tight text-white group-hover:text-indigo-300 transition-colors">
                Торгові точки
              </h2>
              <span className="hidden sm:inline-flex items-center px-2 py-0.5 rounded-md text-xs font-mono bg-white/5 border border-white/10 text-muted-foreground">
                {sortedRows.length} ТТ
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Quick Search */}
            <div 
              onClick={(e) => e.stopPropagation()} 
              className="relative hidden sm:block w-48 lg:w-64"
            >
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Пошук ТТ, міста, організації..."
                className="w-full bg-[#15213b]/80 border border-white/10 rounded-xl pl-8 pr-3 py-1 text-xs text-white placeholder:text-muted-foreground focus:outline-none focus:border-indigo-500/50"
              />
            </div>

            <button
              type="button"
              onClick={handleExportExcel}
              disabled={!sortedRows.length}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-medium text-white/90 hover:text-white transition-all disabled:opacity-50"
              title="Експорт таблиці в Excel"
            >
              <Download className="h-3.5 w-3.5 text-indigo-400" />
              <span className="hidden sm:inline">Excel</span>
            </button>

            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setIsCollapsed(prev => !prev);
              }}
              className="p-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white/70 hover:text-white transition-all"
              title={isCollapsed ? "Розгорнути блок" : "Згорнути блок"}
            >
              {isCollapsed ? (
                <ChevronDown className="h-4 w-4 text-indigo-400" />
              ) : (
                <ChevronUp className="h-4 w-4 text-muted-foreground" />
              )}
            </button>
          </div>
        </div>

        {/* Mobile Search input when open */}
        {!isCollapsed && (
          <div className="sm:hidden pt-1">
            <div className="relative w-full">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Пошук ТТ, міста, організації..."
                className="w-full bg-[#15213b]/80 border border-white/10 rounded-xl pl-8 pr-3 py-1.5 text-xs text-white placeholder:text-muted-foreground focus:outline-none focus:border-indigo-500/50"
              />
            </div>
          </div>
        )}

        {/* Block Body */}
        {!isCollapsed && (
          <div className="overflow-hidden rounded-2xl border border-white/10 bg-[#0d1527]/70 p-3 sm:p-4 animate-in fade-in duration-200">
            <div className="overflow-x-auto">
              <table className="w-full text-xs sm:text-[13px] text-left border-collapse min-w-[1445px]">
                {/* Column definitions */}
                <colgroup>
                  <col className="w-[180px] min-w-[180px]" />
                  <col className="w-[180px] min-w-[180px]" />
                  <col className="w-[125px] min-w-[125px]" />
                  <col className="w-[75px]" />
                  <col className="w-[85px]" />
                  <col className="w-[80px]" />
                  <col className="w-[95px]" />
                  <col className="w-[95px]" />
                  <col className="w-[85px]" />
                  <col className="w-[85px]" />
                  <col className="w-[80px]" />
                  <col className="w-[155px] min-w-[155px]" />
                  <col className="w-[95px]" />
                  <col className="w-[85px]" />
                  <col className="w-[90px]" />
                </colgroup>

                {/* Table Head */}
                <thead>
                  <tr className="bg-[#15213b] text-white/90 border-b border-white/15 text-xs leading-tight">
                    <th
                      onClick={() => handleSort("point")}
                      title="Торгова точка"
                      className={getHeaderClass("point", "text-left pl-3.5 whitespace-nowrap")}
                    >
                      Торгова точка
                    </th>

                    <th
                      onClick={() => handleSort("org")}
                      title="Організація"
                      className={getHeaderClass("org", "text-left pl-3.5 whitespace-nowrap")}
                    >
                      Організація
                    </th>

                    <th
                      onClick={() => handleSort("city")}
                      title="Місто"
                      className={getHeaderClass("city", "text-left pl-3.5 whitespace-nowrap")}
                    >
                      Місто
                    </th>

                    <th
                      onClick={() => handleSort("orgTtCount")}
                      title="Кількість торгових точок організації"
                      className={getHeaderClass("orgTtCount", "text-center")}
                    >
                      Кіл-ть ТТ
                    </th>

                    <th
                      onClick={() => handleSort("totalPP")}
                      title="Загальний потенціал точки"
                      className={getHeaderClass("totalPP", "text-center")}
                    >
                      Загальний потенціал точки
                    </th>

                    <th
                      onClick={() => handleSort("highfoamPP")}
                      title="Продажі ЮНП"
                      className={getHeaderClass("highfoamPP", "text-center")}
                    >
                      Продажі ЮНП
                    </th>

                    <th
                      onClick={() => handleSort("actualByManager")}
                      title={`Фактичні продажі менеджера ТТ по організації ТТ, шт (${salesPeriodLabel(salesIndex.months)}${salesIndex.monthsCount > 1 ? `, середнє за ${salesIndex.monthsCount} міс.` : ""})`}
                      className={getHeaderClass("actualByManager", "text-center")}
                    >
                      Фактичні продажі по менеджеру
                    </th>

                    <th
                      onClick={() => handleSort("actualByOrg")}
                      title={`Фактичні продажі організації ТТ (усі менеджери), шт (${salesPeriodLabel(salesIndex.months)}${salesIndex.monthsCount > 1 ? `, середнє за ${salesIndex.monthsCount} міс.` : ""})`}
                      className={getHeaderClass("actualByOrg", "text-center")}
                    >
                      Фактичні продажі по організації
                    </th>

                    <th
                      onClick={() => handleSort("totalKV")}
                      title="Кількість спальних місць"
                      className={getHeaderClass("totalKV", "text-center")}
                    >
                      Кількість спальних місць
                    </th>

                    <th
                      onClick={() => handleSort("highfoamKV")}
                      title="Кількість спальних місць ЮНП"
                      className={getHeaderClass("highfoamKV", "text-center")}
                    >
                      Кількість спальних місць ЮНП
                    </th>

                    <th
                      onClick={() => handleSort("sellsPillows")}
                      title="Продає подушки"
                      className={getHeaderClass("sellsPillows", "text-center")}
                    >
                      Продає подушки
                    </th>

                    <th
                      onClick={() => handleSort("agent")}
                      title="Менеджер"
                      className={getHeaderClass("agent", "text-left pl-3.5 whitespace-nowrap")}
                    >
                      Менеджер
                    </th>

                    <th
                      onClick={() => handleSort("visitedAt")}
                      title="Дата останнього візиту"
                      className={getHeaderClass("visitedAt", "text-center")}
                    >
                      Дата останнього візиту
                    </th>

                    <th
                      onClick={() => handleSort("daysAfter")}
                      title="Днів після візиту"
                      className={getHeaderClass("daysAfter", "text-center")}
                    >
                      Днів після візиту
                    </th>

                    <th
                      onClick={() => handleSort("totalVisits")}
                      title="Загальна кількість візитів"
                      className={getHeaderClass("totalVisits", "text-center pr-3.5")}
                    >
                      Загальна кількість візитів
                    </th>
                  </tr>
                </thead>

                {/* Table Body */}
                <tbody className="divide-y divide-white/5">
                  {sortedRows.length === 0 ? (
                    <tr>
                      <td colSpan={15} className="py-8 text-center text-muted-foreground text-xs">
                        Немає даних за обраними фільтрами
                      </td>
                    </tr>
                  ) : (
                    sortedRows.map(row => (
                      <tr
                        key={row.id}
                        className="hover:bg-white/[0.05] transition-colors cursor-pointer group/row"
                        onClick={() => setSelectedPoint(row.rawVisit)}
                      >
                        {/* Торгова точка (Clickable link with hover style) */}
                        <td className={`py-2.5 px-3 text-left pl-3.5 font-medium whitespace-nowrap ${
                          sortField === "point" ? "bg-indigo-500/[0.08]" : ""
                        }`}>
                          <div className="flex items-center gap-1.5 text-indigo-300 group-hover/row:text-indigo-200 group-hover/row:underline">
                            <span className="truncate max-w-[170px]" title={row.point}>
                              {row.point}
                            </span>
                            <ExternalLink className="h-3 w-3 opacity-0 group-hover/row:opacity-100 transition-opacity shrink-0 text-indigo-400" />
                          </div>
                        </td>

                        {/* Організація */}
                        <td className={`py-2.5 px-3 text-left pl-3.5 text-white/85 whitespace-nowrap ${
                          sortField === "org" ? "bg-indigo-500/[0.08]" : ""
                        }`}>
                          <span className="truncate max-w-[170px] inline-block" title={row.org}>
                            {row.org}
                          </span>
                        </td>

                        {/* Місто */}
                        <td className={`py-2.5 px-3 text-left pl-3.5 text-white/80 whitespace-nowrap ${
                          sortField === "city" ? "bg-indigo-500/[0.08]" : ""
                        }`}>
                          {row.city}
                        </td>

                        {/* Кіл-ть ТТ організації */}
                        <td className={getCellClass("orgTtCount", "text-center font-mono")}>
                          {row.orgTtCount || "—"}
                        </td>

                        {/* Загальний потенціал точки */}
                        <td className={getCellClass("totalPP") + " font-mono"}>
                          {row.totalPP.toLocaleString("uk-UA")}
                        </td>

                        {/* Продажі ЮНП */}
                        <td className={getCellClass("highfoamPP") + " font-mono"}>
                          {row.highfoamPP.toLocaleString("uk-UA")}
                        </td>

                        {/* Фактичні продажі по менеджеру (IT-Enterprise) */}
                        <td className={getCellClass("actualByManager") + " font-mono"}>
                          <span className={row.actualByManager ? "text-emerald-300" : "text-muted-foreground"}>
                            {formatSales(row.actualByManager)}
                          </span>
                        </td>

                        {/* Фактичні продажі по організації (IT-Enterprise) */}
                        <td className={getCellClass("actualByOrg") + " font-mono"}>
                          <span className={row.actualByOrg ? "text-emerald-300" : "text-muted-foreground"}>
                            {formatSales(row.actualByOrg)}
                          </span>
                        </td>

                        {/* Кількість спальних місць */}
                        <td className={getCellClass("totalKV") + " font-mono"}>
                          {row.totalKV.toLocaleString("uk-UA")}
                        </td>

                        {/* Кількість спальних місць ЮНП */}
                        <td className={getCellClass("highfoamKV") + " font-mono"}>
                          {row.highfoamKV.toLocaleString("uk-UA")}
                        </td>

                        {/* Продає подушки */}
                        <td className={`py-2.5 px-2.5 text-center ${sortField === "sellsPillows" ? "bg-indigo-500/[0.08]" : ""}`}>
                          <span className={`inline-block px-2 py-0.5 rounded text-[11px] font-semibold ${
                            row.sellsPillowsBool 
                              ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" 
                              : "bg-white/5 text-muted-foreground"
                          }`}>
                            {row.sellsPillows}
                          </span>
                        </td>

                        {/* Менеджер */}
                        <td className={`py-2.5 px-3 text-left pl-3.5 text-white/90 whitespace-nowrap ${
                          sortField === "agent" ? "bg-indigo-500/[0.08]" : ""
                        }`}>
                          {row.agent}
                        </td>

                        {/* Дата останнього візиту */}
                        <td className={getCellClass("visitedAt", "text-center font-mono")}>
                          {row.formattedDate}
                        </td>

                        {/* Днів після візиту */}
                        <td className={getCellClass("daysAfter") + " font-mono"}>
                          {row.daysAfter}
                        </td>

                        {/* Загальна кількість візитів */}
                        <td className={getCellClass("totalVisits", "text-center pr-3.5 font-mono font-bold text-white")}>
                          {row.totalVisits}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Point Details Modal / "Карточка торгової точки" */}
      {selectedPoint && (
        <PointCardModal 
          point={selectedPoint} 
          allVisits={allVisits} 
          allBrands={allBrands}
          onClose={() => setSelectedPoint(null)} 
        />
      )}
    </>
  );
}
