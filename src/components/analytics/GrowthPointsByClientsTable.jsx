import React, { useMemo, useState } from "react";
import { TrendingUp, Download, ChevronDown, ChevronUp } from "lucide-react";
import * as XLSX from "xlsx";

export function GrowthPointsByClientsTable({ data = [] }) {
  // data is latestFilteredVisits (one latest visit per unique TT)
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [sortField, setSortField] = useState("growthPotential");
  const [sortDirection, setSortDirection] = useState("desc");
  // Мінімальний потенціал зростання (за замовчуванням ≥ 20), налаштовується в шапці
  const [thresholdInput, setThresholdInput] = useState("20");
  const minGrowthThreshold = Math.max(0, Number(thresholdInput) || 0);

  // Group visits by City (and Oblast to avoid ambiguity)
  const { rows, totals, maxGrowth } = useMemo(() => {
    // Map key: "city:::oblast"
    const cityMap = new Map();

    data.forEach(v => {
      const cityName = (v.city || "Невідомо").trim();
      const oblastName = (v.oblast || "Не вказано").trim();
      const key = `${cityName.toLowerCase()}:::${oblastName.toLowerCase()}`;

      if (!cityMap.has(key)) {
        cityMap.set(key, {
          city: cityName,
          oblast: oblastName,
          visits: [],
        });
      }
      cityMap.get(key).visits.push(v);
    });

    const calculatedRows = [];

    cityMap.forEach(({ city, oblast, visits }) => {
      const potential = visits.reduce((acc, v) => acc + (v.totalPP || 0), 0);
      const sales = visits.reduce((acc, v) => acc + (v.highfoamPP || 0), 0);
      const growthPotential = Math.max(0, potential - sales);

      // Condition from user: Only include where growthPotential >= 20
      if (growthPotential < minGrowthThreshold) {
        return;
      }

      // Unique managers in this city
      const managers = Array.from(
        new Set(visits.map(v => (v.agent || "").trim()).filter(Boolean))
      );
      const managerDisplay = managers.length > 0 ? managers.join(", ") : "—";

      // Other suppliers (excluding Highfoam), sorted by presence/potential in this city
      const otherMfMap = new Map();
      visits.forEach(v => {
        (v.visitManufacturers || []).forEach(vm => {
          const mfName = (vm.name || "").trim();
          if (mfName && mfName.toLowerCase() !== "highfoam" && mfName.toLowerCase() !== "юнп") {
            otherMfMap.set(mfName, (otherMfMap.get(mfName) || 0) + (vm.pp || 1));
          }
        });
        (v.manufacturers || []).forEach(m => {
          const mfName = (m || "").trim();
          if (mfName && mfName.toLowerCase() !== "highfoam" && mfName.toLowerCase() !== "юнп") {
            if (!otherMfMap.has(mfName)) {
              otherMfMap.set(mfName, 1);
            }
          }
        });
      });

      // Sort other suppliers by volume
      const otherSuppliersList = Array.from(otherMfMap.entries())
        .sort((a, b) => b[1] - a[1])
        .map(entry => entry[0]);

      const otherSuppliersDisplay = otherSuppliersList.length > 0 
        ? otherSuppliersList.join(", ") 
        : "—";

      const sharePct = potential > 0 ? (sales / potential) * 100 : 0;
      const ttCount = new Set(visits.map(v => v.ttKey || `${v.org}:::${v.point}`)).size || visits.length;

      // City display with "м. " prefix if not already present
      let formattedCity = city;
      if (
        !formattedCity.startsWith("м.") && 
        !formattedCity.startsWith("с.") && 
        !formattedCity.startsWith("смт.") &&
        formattedCity !== "Невідомо"
      ) {
        formattedCity = `м. ${formattedCity}`;
      }

      calculatedRows.push({
        id: `${city}_${oblast}`,
        city: formattedCity,
        rawCity: city,
        oblast: oblast !== "Не вказано" ? oblast : "—",
        manager: managerDisplay,
        ttCount,
        potential,
        sales,
        sharePct,
        growthPotential,
        otherSuppliers: otherSuppliersDisplay,
      });
    });

    // Calculate max growth potential for proportional data bar width
    let currentMaxGrowth = 1;
    calculatedRows.forEach(r => {
      if (r.growthPotential > currentMaxGrowth) {
        currentMaxGrowth = r.growthPotential;
      }
    });

    // Calculate totals for matching rows
    const totalTtCount = calculatedRows.reduce((acc, r) => acc + (r.ttCount || 0), 0);
    const totalPotential = calculatedRows.reduce((acc, r) => acc + r.potential, 0);
    const totalSales = calculatedRows.reduce((acc, r) => acc + r.sales, 0);
    const totalSharePct = totalPotential > 0 ? (totalSales / totalPotential) * 100 : 0;
    const totalGrowthPotential = calculatedRows.reduce((acc, r) => acc + r.growthPotential, 0);

    return {
      rows: calculatedRows,
      maxGrowth: currentMaxGrowth,
      totals: {
        totalTtCount,
        totalPotential,
        totalSales,
        totalSharePct,
        totalGrowthPotential,
        count: calculatedRows.length,
      },
    };
  }, [data, minGrowthThreshold]);

  // Sorting
  const sortedRows = useMemo(() => {
    return [...rows].sort((a, b) => {
      let aVal = a[sortField];
      let bVal = b[sortField];

      if (typeof aVal === "string") {
        const cmp = aVal.localeCompare(bVal, "uk");
        return sortDirection === "asc" ? cmp : -cmp;
      }

      aVal = aVal || 0;
      bVal = bVal || 0;
      return sortDirection === "asc" ? aVal - bVal : bVal - aVal;
    });
  }, [rows, sortField, sortDirection]);

  const handleSort = (field) => {
    if (sortField === field) {
      setSortDirection(prev => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDirection("desc");
    }
  };

  const formatPct = (val) => `${val.toFixed(1).replace(".", ",")}%`;

  const handleExportExcel = (e) => {
    if (e) e.stopPropagation();
    if (!sortedRows.length) return;

    const exportData = sortedRows.map(r => ({
      "Місто": r.city,
      "Область": r.oblast,
      "Менеджер": r.manager,
      "Кількість ТТ": r.ttCount,
      "Потенціал": r.potential,
      "Продажі ЮНП": r.sales,
      "Частка ЮНП": formatPct(r.sharePct),
      "Потенціал зростання": r.growthPotential,
      "Інші постачальники": r.otherSuppliers,
    }));

    exportData.push({
      "Місто": "РАЗОМ",
      "Область": "",
      "Менеджер": "",
      "Кількість ТТ": totals.totalTtCount,
      "Потенціал": totals.totalPotential,
      "Продажі ЮНП": totals.totalSales,
      "Частка ЮНП": formatPct(totals.totalSharePct),
      "Потенціал зростання": totals.totalGrowthPotential,
      "Інші постачальники": "",
    });

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Найбільші точки зростання");
    const dateStr = new Date().toISOString().split("T")[0];
    XLSX.writeFile(wb, `Найбільші_точки_зростання_${dateStr}.xlsx`);
  };

  // Helper for column header styling with active sort highlight
  const getHeaderClass = (field, align = "text-center") => {
    const isSorted = sortField === field;
    return `py-2.5 px-3 ${align} font-bold cursor-pointer select-none transition-colors ${
      isSorted
        ? "bg-indigo-500/25 text-indigo-200 border-b-2 border-indigo-400"
        : "text-white/90 hover:bg-white/5"
    }`;
  };

  // Helper for cell styling with active sort column highlight
  const getCellClass = (field, align = "text-right") => {
    const isSorted = sortField === field;
    return `py-2.5 px-3 ${align} ${
      isSorted ? "bg-indigo-500/[0.08] text-white font-medium" : "text-white/85"
    }`;
  };

  // Conditional formatting for share percentage matching screenshot colors
  const getShareBadgeClass = (share) => {
    if (share >= 50) {
      return "bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/30";
    }
    return "bg-amber-500/15 text-amber-300 font-semibold border border-amber-500/25";
  };

  const renderThreshold = (visibility) => (
      <label
        onClick={(e) => e.stopPropagation()}
        className={`${visibility} items-center gap-1.5 text-[11px] text-muted-foreground cursor-default`}
        title="Мінімальний потенціал зростання для міста"
      >
        <span>потенціал зростання ≥</span>
        <input
          type="number"
          min={0}
          step={5}
          value={thresholdInput}
          onChange={(e) => setThresholdInput(e.target.value)}
          className="w-16 bg-[#15213b]/80 border border-white/10 rounded-lg px-2 py-1 text-xs text-white font-mono focus:outline-none focus:border-indigo-500/50"
        />
        <span>шт</span>
      </label>
  );

  return (
    <div className="glass rounded-3xl border border-white/10 shadow-2xl overflow-hidden p-4 sm:p-5 space-y-3 transition-all duration-300">
      {/* Block Header */}
      <div
        onClick={() => setIsCollapsed(prev => !prev)}
        className="flex items-center justify-between gap-3 cursor-pointer select-none group"
      >
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 group-hover:bg-indigo-500/20 transition-colors">
            <TrendingUp className="h-4 w-4" />
          </div>
          <div className="flex items-center gap-2.5">
            <h2 className="text-base sm:text-lg font-bold tracking-tight text-white group-hover:text-indigo-300 transition-colors">
              Найбільші точки зростання за клієнтами
            </h2>
            {renderThreshold("hidden sm:flex")}
          </div>
        </div>

        <div className="flex items-center gap-2">
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

      {/* Поріг на мобільному */}
      {!isCollapsed && renderThreshold("flex sm:hidden")}

      {/* Block Body */}
      {!isCollapsed && (
        <div className="overflow-hidden rounded-2xl border border-white/10 bg-[#0d1527]/70 p-3 sm:p-4 animate-in fade-in duration-200">
          <div className="overflow-x-auto">
            <table className="w-full text-xs sm:text-[13px] text-left border-collapse min-w-[1040px]">
              {/* Column definitions */}
              <colgroup>
                <col className="w-[125px] min-w-[125px]" />
                <col className="w-[145px] min-w-[145px]" />
                <col className="w-[170px] min-w-[170px]" />
                <col className="w-[95px] min-w-[95px]" />
                <col className="w-[85px]" />
                <col className="w-[85px]" />
                <col className="w-[90px]" />
                <col className="w-[130px] min-w-[130px]" />
                <col className="min-w-[260px]" />
              </colgroup>

              {/* Table Head */}
              <thead>
                <tr className="bg-[#15213b] text-white/90 border-b border-white/15 text-xs leading-tight">
                  <th
                    onClick={() => handleSort("city")}
                    title="Місто"
                    className={getHeaderClass("city", "text-left pl-3.5 whitespace-nowrap")}
                  >
                    Місто
                  </th>

                  <th
                    onClick={() => handleSort("oblast")}
                    title="Область"
                    className={getHeaderClass("oblast", "text-left pl-3.5 whitespace-nowrap")}
                  >
                    Область
                  </th>

                  <th
                    onClick={() => handleSort("manager")}
                    title="Менеджер"
                    className={getHeaderClass("manager", "text-left pl-3.5 whitespace-nowrap")}
                  >
                    Менеджер
                  </th>

                  <th
                    onClick={() => handleSort("ttCount")}
                    title="Кількість ТТ"
                    className={getHeaderClass("ttCount", "text-center whitespace-nowrap")}
                  >
                    Кількість ТТ
                  </th>

                  <th
                    onClick={() => handleSort("potential")}
                    title="Потенціал"
                    className={getHeaderClass("potential", "text-center")}
                  >
                    Потенціал
                  </th>

                  <th
                    onClick={() => handleSort("sales")}
                    title="Продажі ЮНП"
                    className={getHeaderClass("sales", "text-center")}
                  >
                    Продажі ЮНП
                  </th>

                  <th
                    onClick={() => handleSort("sharePct")}
                    title="Частка ЮНП"
                    className={getHeaderClass("sharePct", "text-center")}
                  >
                    Частка ЮНП
                  </th>

                  <th
                    onClick={() => handleSort("growthPotential")}
                    title="Потенціал зростання"
                    className={getHeaderClass("growthPotential", "text-center")}
                  >
                    Потенціал зростання
                  </th>

                  <th
                    onClick={() => handleSort("otherSuppliers")}
                    title="Інші постачальники"
                    className={getHeaderClass("otherSuppliers", "text-left pl-3.5")}
                  >
                    Інші постачальники
                  </th>
                </tr>
              </thead>

              {/* Table Body */}
              <tbody className="divide-y divide-white/5">
                {sortedRows.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-8 text-center text-muted-foreground text-xs">
                      Немає точок зростання з потенціалом ≥ {minGrowthThreshold} за обраними фільтрами
                    </td>
                  </tr>
                ) : (
                  sortedRows.map(row => {
                    const barWidthPct = Math.min(100, Math.max(8, (row.growthPotential / maxGrowth) * 100));

                    return (
                      <tr
                        key={row.id}
                        className="hover:bg-white/[0.04] transition-colors"
                      >
                        {/* Місто */}
                        <td className={`py-2.5 px-3 text-left pl-3.5 font-medium text-white/95 whitespace-nowrap ${
                          sortField === "city" ? "bg-indigo-500/[0.08]" : ""
                        }`}>
                          {row.city}
                        </td>

                        {/* Область */}
                        <td className={`py-2.5 px-3 text-left pl-3.5 text-white/80 whitespace-nowrap ${
                          sortField === "oblast" ? "bg-indigo-500/[0.08]" : ""
                        }`}>
                          {row.oblast}
                        </td>

                        {/* Менеджер */}
                        <td className={`py-2.5 px-3 text-left pl-3.5 text-white/85 text-xs ${
                          sortField === "manager" ? "bg-indigo-500/[0.08]" : ""
                        }`}>
                          <span className="line-clamp-1" title={row.manager}>
                            {row.manager}
                          </span>
                        </td>

                        {/* Кількість ТТ */}
                        <td className={getCellClass("ttCount", "text-center font-mono font-medium")}>
                          {row.ttCount}
                        </td>

                        {/* Потенціал */}
                        <td className={getCellClass("potential") + " font-mono"}>
                          {row.potential.toLocaleString("uk-UA")}
                        </td>

                        {/* Продажі ЮНП */}
                        <td className={getCellClass("sales") + " font-mono"}>
                          {row.sales.toLocaleString("uk-UA")}
                        </td>

                        {/* Частка ЮНП */}
                        <td className={`py-2 px-3 text-center ${sortField === "sharePct" ? "bg-indigo-500/[0.08]" : ""}`}>
                          <span className={`inline-block px-2.5 py-0.5 rounded-lg text-xs font-mono ${getShareBadgeClass(row.sharePct)}`}>
                            {formatPct(row.sharePct)}
                          </span>
                        </td>

                        {/* Потенціал зростання with Data Bar Indicator */}
                        <td className={`py-2 px-3 text-right font-mono relative overflow-hidden ${
                          sortField === "growthPotential" ? "bg-indigo-500/[0.08]" : ""
                        }`}>
                          <div className="relative z-10 font-bold text-white pr-1">
                            {row.growthPotential.toLocaleString("uk-UA")}
                          </div>
                          {/* Data bar fill matching screenshot gold/amber bar */}
                          <div
                            className="absolute top-1 bottom-1 right-0 rounded bg-gradient-to-l from-amber-500/30 to-amber-500/10 pointer-events-none border-r-2 border-amber-400/80"
                            style={{ width: `${barWidthPct}%` }}
                          />
                        </td>

                        {/* Інші постачальники */}
                        <td className={`py-2.5 px-3 text-left pl-3.5 text-xs text-white/70 ${
                          sortField === "otherSuppliers" ? "bg-indigo-500/[0.08]" : ""
                        }`}>
                          <span className="line-clamp-2" title={row.otherSuppliers}>
                            {row.otherSuppliers}
                          </span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>

              {/* Table Footer */}
              {sortedRows.length > 0 && (
                <tfoot>
                  <tr className="bg-[#15213b] text-white font-bold border-t-2 border-white/20 text-xs sm:text-[13px]">
                    <td className={`py-3 px-3 text-left pl-3.5 uppercase font-extrabold tracking-wide whitespace-nowrap ${
                      sortField === "city" ? "bg-indigo-500/20 text-indigo-200" : ""
                    }`}>
                      РАЗОМ
                    </td>
                    <td className={`py-3 px-3 text-muted-foreground ${sortField === "oblast" ? "bg-indigo-500/20" : ""}`}>
                      —
                    </td>
                    <td className={`py-3 px-3 text-muted-foreground ${sortField === "manager" ? "bg-indigo-500/20" : ""}`}>
                      —
                    </td>
                    <td className={`py-3 px-3 text-center font-mono font-bold ${sortField === "ttCount" ? "bg-indigo-500/20 text-indigo-200" : ""}`}>
                      {totals.totalTtCount}
                    </td>
                    <td className={`py-3 px-3 text-right font-mono ${sortField === "potential" ? "bg-indigo-500/20 text-indigo-200" : ""}`}>
                      {totals.totalPotential.toLocaleString("uk-UA")}
                    </td>
                    <td className={`py-3 px-3 text-right font-mono ${sortField === "sales" ? "bg-indigo-500/20 text-indigo-200" : ""}`}>
                      {totals.totalSales.toLocaleString("uk-UA")}
                    </td>
                    <td className={`py-3 px-3 text-center ${sortField === "sharePct" ? "bg-indigo-500/20" : ""}`}>
                      <span className="inline-block px-2.5 py-0.5 rounded-lg text-xs font-mono font-bold bg-white/10 text-white border border-white/15">
                        {formatPct(totals.totalSharePct)}
                      </span>
                    </td>
                    <td className={`py-3 px-3 text-right font-mono text-amber-300 ${sortField === "growthPotential" ? "bg-indigo-500/20" : ""}`}>
                      {totals.totalGrowthPotential.toLocaleString("uk-UA")}
                    </td>
                    <td className={`py-3 px-3 text-left pl-3.5 text-xs text-muted-foreground ${sortField === "otherSuppliers" ? "bg-indigo-500/20" : ""}`}>
                      ({totals.count} міст)
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
