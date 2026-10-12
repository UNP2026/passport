import React, { useMemo, useState } from "react";
import { Building2, Download, ChevronDown, ChevronUp } from "lucide-react";
import * as XLSX from "xlsx";
import { MarketStructureChart } from "./MarketStructureChart";

export function MarketStructureByManufacturers({ data = [], allManufacturers = [] }) {
  // data is latestFilteredVisits (one latest visit per unique TT)
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [sortField, setSortField] = useState("sales");
  const [sortDirection, setSortDirection] = useState("desc");

  // Calculate table data
  const { rows, totals } = useMemo(() => {
    const totalUniqueTTs = data.length;
    const totalMarketPotential = data.reduce((acc, v) => acc + (v.totalPP || 0), 0);
    const totalMarketKV = data.reduce((acc, v) => acc + (v.totalKV || 0), 0);

    // Collect all manufacturer names present in visits or from database
    const mfgSet = new Set();
    data.forEach(v => {
      (v.visitManufacturers || []).forEach(vm => {
        if (vm.name) mfgSet.add(vm.name.trim());
      });
      (v.manufacturers || []).forEach(m => {
        if (m) mfgSet.add(m.trim());
      });
    });
    (allManufacturers || []).forEach(m => {
      if (m) mfgSet.add(m.trim());
    });

    const mfgList = Array.from(mfgSet);

    // Build stats for each manufacturer
    const rawRows = mfgList.map(mName => {
      // Find all unique TTs where this manufacturer is present
      const matchingVisits = data.filter(v => {
        const vMfs = v.visitManufacturers || [];
        return vMfs.some(vm => (vm.name || "").trim().toLowerCase() === mName.toLowerCase());
      });

      const ttCount = matchingVisits.length;

      // Sum of PP (продажі, шт/міс) for this manufacturer
      const sales = matchingVisits.reduce((acc, v) => {
        const vm = (v.visitManufacturers || []).find(
          m => (m.name || "").trim().toLowerCase() === mName.toLowerCase()
        );
        return acc + (vm?.pp || 0);
      }, 0);

      // Sum of KV (спальні місця) for this manufacturer
      const places = matchingVisits.reduce((acc, v) => {
        const vm = (v.visitManufacturers || []).find(
          m => (m.name || "").trim().toLowerCase() === mName.toLowerCase()
        );
        return acc + (vm?.kv || 0);
      }, 0);

      // Total market potential of points where this manufacturer is present
      const pointsTotalPotential = matchingVisits.reduce(
        (acc, v) => acc + (v.totalPP || 0),
        0
      );

      // Shares
      const salesSharePct = totalMarketPotential > 0 ? (sales / totalMarketPotential) * 100 : 0;
      const ttSharePct = totalUniqueTTs > 0 ? (ttCount / totalUniqueTTs) * 100 : 0;
      const potentialSharePct = totalMarketPotential > 0 ? (pointsTotalPotential / totalMarketPotential) * 100 : 0;
      const placesSharePct = totalMarketKV > 0 ? (places / totalMarketKV) * 100 : 0;

      const isHighfoam = mName.toLowerCase() === "highfoam";

      return {
        name: mName,
        isHighfoam,
        ttCount,
        sales,
        places,
        pointsTotalPotential,
        salesSharePct,
        ttSharePct,
        potentialSharePct,
        placesSharePct,
      };
    });

    // Filter out manufacturers with 0 presence in the filtered set
    const activeRows = rawRows.filter(r => r.ttCount > 0 || r.sales > 0 || r.places > 0);

    // Totals
    const totalSales = activeRows.reduce((acc, r) => acc + r.sales, 0);
    const totalPlaces = activeRows.reduce((acc, r) => acc + r.places, 0);

    return {
      rows: activeRows,
      totals: {
        totalUniqueTTs,
        totalSales: totalSales > 0 ? totalSales : totalMarketPotential,
        totalPlaces: totalPlaces > 0 ? totalPlaces : totalMarketKV,
        totalMarketPotential,
      }
    };
  }, [data, allManufacturers]);

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
      setSortDirection(prev => prev === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("desc");
    }
  };

  const handleExportExcel = (e) => {
    if (e) e.stopPropagation();
    if (!sortedRows.length) return;

    const exportData = sortedRows.map(r => ({
      "Постачальник": r.name,
      "Кількість ТТ": r.ttCount,
      "Продажі, шт/міс": r.sales,
      "Кількість спальних місць": r.places,
      "Потенціал точок де є виробник, шт/міс": r.pointsTotalPotential,
      "Продажи доля від заг ринку": `${Math.round(r.salesSharePct)}%`,
      "Кількість ТТ, % відносно до занесених торгових точок": `${Math.round(r.ttSharePct)}%`,
      "Загальний потенціал клієнтів де є присутній виробник %": `${Math.round(r.potentialSharePct)}%`,
      "Кількість спальних місць, %": `${Math.round(r.placesSharePct)}%`,
    }));

    // Add total row
    exportData.push({
      "Постачальник": "Разом",
      "Кількість ТТ": totals.totalUniqueTTs,
      "Продажі, шт/міс": totals.totalSales,
      "Кількість спальних місць": totals.totalPlaces,
      "Потенціал точок де є виробник, шт/міс": totals.totalMarketPotential,
      "Продажи доля від заг ринку": "100%",
      "Кількість ТТ, % відносно до занесених торгових точок": "100%",
      "Загальний потенціал клієнтів де є присутній виробник %": "100%",
      "Кількість спальних місць, %": "100%",
    });

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Структура ринку");
    const dateStr = new Date().toISOString().split("T")[0];
    XLSX.writeFile(wb, `Структура_ринку_за_виробниками_${dateStr}.xlsx`);
  };

  // Helper for column header styling with subtle active sort highlight
  const getHeaderClass = (field) => {
    const isSorted = sortField === field;
    return `py-2 px-1 text-center font-bold cursor-pointer select-none transition-colors ${
      isSorted 
        ? "bg-indigo-500/25 text-indigo-200 border-b-2 border-indigo-400" 
        : "text-white/90 hover:bg-white/5"
    }`;
  };

  // Helper for cell styling with subtle active sort column highlight
  const getCellClass = (field, isHighfoam = false) => {
    const isSorted = sortField === field;
    if (isSorted) {
      return isHighfoam 
        ? "bg-indigo-600/25 text-white font-medium" 
        : "bg-indigo-500/[0.08] text-white font-medium";
    }
    return isHighfoam ? "text-white" : "text-white/85";
  };

  return (
    <div className="glass rounded-3xl border border-white/10 shadow-2xl overflow-hidden p-4 sm:p-5 space-y-3 transition-all duration-300">
      {/* Block Header (Clean: Title only, no subtitle, no count badge) */}
      <div 
        onClick={() => setIsCollapsed(prev => !prev)}
        className="flex items-center justify-between gap-3 cursor-pointer select-none group"
      >
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 group-hover:bg-indigo-500/20 transition-colors">
            <Building2 className="h-4 w-4" />
          </div>
          <h2 className="text-base sm:text-lg font-bold tracking-tight text-white group-hover:text-indigo-300 transition-colors">
            Структура ринку за виробниками
          </h2>
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

      {/* Block Body (Table and Graph with equal height) */}
      {!isCollapsed && (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 items-stretch pt-1 animate-in fade-in duration-200">
          {/* Left Side: Table Box */}
          <div className="h-full flex flex-col justify-between overflow-hidden rounded-2xl border border-white/10 bg-[#0d1527]/70 p-3 sm:p-4 min-h-[440px]">
            <div className="overflow-x-auto flex-1">
              <table className="table-fixed w-full min-w-[590px] text-xs sm:text-[13px] text-left border-collapse">
                {/* Fixed Column Width Definitions */}
                <colgroup>
                  <col className="w-[96px]" />
                  <col className="w-[54px]" />
                  <col className="w-[72px]" />
                  <col className="w-[64px]" />
                  <col className="w-[78px]" />
                  <col className="w-[62px]" />
                  <col className="w-[58px]" />
                  <col className="w-[64px]" />
                  <col className="w-[60px]" />
                </colgroup>

                {/* Table Head: Centered, no arrows, subtle sort highlight */}
                <thead>
                  <tr className="bg-[#15213b] text-white/90 border-b border-white/15 text-xs leading-tight">
                    {/* 1. Постачальник */}
                    <th
                      onClick={() => handleSort("name")}
                      title="Постачальник"
                      className={getHeaderClass("name")}
                    >
                      Постачальник
                    </th>

                    {/* 2. Кількість ТТ */}
                    <th
                      onClick={() => handleSort("ttCount")}
                      title="Кількість ТТ"
                      className={getHeaderClass("ttCount")}
                    >
                      К-сть ТТ
                    </th>

                    {/* 3. Продажі, шт/міс */}
                    <th
                      onClick={() => handleSort("sales")}
                      title="Продажі, шт/міс"
                      className={getHeaderClass("sales")}
                    >
                      Продажі, шт
                    </th>

                    {/* 4. Кількість спальних місць */}
                    <th
                      onClick={() => handleSort("places")}
                      title="Кількість спальних місць"
                      className={getHeaderClass("places")}
                    >
                      Сп. місця
                    </th>

                    {/* 5. Потенціал точок де є виробник, шт/міс */}
                    <th
                      onClick={() => handleSort("pointsTotalPotential")}
                      title="Потенціал точок де є виробник, шт/міс"
                      className={getHeaderClass("pointsTotalPotential")}
                    >
                      Потенціал, шт
                    </th>

                    {/* 6. Продажи доля від заг ринку */}
                    <th
                      onClick={() => handleSort("salesSharePct")}
                      title="Продажі: доля від загального ринку %"
                      className={getHeaderClass("salesSharePct")}
                    >
                      Доля прод,%
                    </th>

                    {/* 7. Кількість ТТ, % відносно до занесених торгових точок */}
                    <th
                      onClick={() => handleSort("ttSharePct")}
                      title="Кількість ТТ, % відносно до занесених торгових точок"
                      className={getHeaderClass("ttSharePct")}
                    >
                      Доля ТТ,%
                    </th>

                    {/* 8. Загальний потенціал клієнтів де є присутній виробник % */}
                    <th
                      onClick={() => handleSort("potentialSharePct")}
                      title="Загальний потенціал клієнтів де є присутній виробник %"
                      className={getHeaderClass("potentialSharePct")}
                    >
                      Доля пот,%
                    </th>

                    {/* 9. Кількість спальних місць, % */}
                    <th
                      onClick={() => handleSort("placesSharePct")}
                      title="Кількість спальних місць, %"
                      className={getHeaderClass("placesSharePct")}
                    >
                      Доля місць,%
                    </th>
                  </tr>
                </thead>

                {/* Table Body */}
                <tbody className="divide-y divide-white/5">
                  {sortedRows.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="py-8 text-center text-muted-foreground text-xs">
                        Немає даних за обраними фільтрами
                      </td>
                    </tr>
                  ) : (
                    sortedRows.map(row => {
                      const isHf = row.isHighfoam;
                      return (
                        <tr
                          key={row.name}
                          className={`transition-colors ${
                            isHf
                              ? "bg-indigo-600/15 hover:bg-indigo-600/25 font-semibold text-white border-l-2 border-l-indigo-400"
                              : "hover:bg-white/[0.04]"
                          }`}
                        >
                          {/* 1. Постачальник (без ЮНП, чистий текст) */}
                          <td 
                            className={`py-2 px-2 text-left truncate ${getCellClass("name", isHf)}`}
                            title={row.name}
                          >
                            <span className={isHf ? "text-indigo-300 font-bold" : ""}>
                              {row.name}
                            </span>
                          </td>

                          {/* 2. Кількість ТТ */}
                          <td className={`py-2 px-2 text-right font-mono ${getCellClass("ttCount", isHf)}`}>
                            {row.ttCount.toLocaleString("uk-UA")}
                          </td>

                          {/* 3. Продажі, шт/міс */}
                          <td className={`py-2 px-2 text-right font-mono ${getCellClass("sales", isHf)}`}>
                            {row.sales.toLocaleString("uk-UA")}
                          </td>

                          {/* 4. Кількість спальних місць */}
                          <td className={`py-2 px-2 text-right font-mono ${getCellClass("places", isHf)}`}>
                            {row.places.toLocaleString("uk-UA")}
                          </td>

                          {/* 5. Потенціал точок де є виробник, шт/міс */}
                          <td className={`py-2 px-2 text-right font-mono ${getCellClass("pointsTotalPotential", isHf)}`}>
                            {row.pointsTotalPotential.toLocaleString("uk-UA")}
                          </td>

                          {/* 6. Продажи доля від заг ринку */}
                          <td className={`py-2 px-2 text-right font-mono ${getCellClass("salesSharePct", isHf)}`}>
                            {Math.round(row.salesSharePct)}%
                          </td>

                          {/* 7. Кількість ТТ, % відносно до занесених торгових точок */}
                          <td className={`py-2 px-2 text-right font-mono ${getCellClass("ttSharePct", isHf)}`}>
                            {Math.round(row.ttSharePct)}%
                          </td>

                          {/* 8. Загальний потенціал клієнтів де є присутній виробник % */}
                          <td className={`py-2 px-2 text-right font-mono ${getCellClass("potentialSharePct", isHf)}`}>
                            {Math.round(row.potentialSharePct)}%
                          </td>

                          {/* 9. Кількість спальних місць, % */}
                          <td className={`py-2 px-2 text-right font-mono ${getCellClass("placesSharePct", isHf)}`}>
                            {Math.round(row.placesSharePct)}%
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>

                {/* Table Footer: Totals */}
                {sortedRows.length > 0 && (
                  <tfoot>
                    <tr className="bg-[#15213b] text-white font-bold border-t-2 border-white/20 text-xs">
                      <td className={`py-2.5 px-2 text-left truncate ${sortField === 'name' ? 'bg-indigo-500/20 text-indigo-200' : ''}`}>
                        Разом
                      </td>
                      <td className={`py-2.5 px-2 text-right font-mono ${sortField === 'ttCount' ? 'bg-indigo-500/20 text-indigo-200' : ''}`}>
                        {totals.totalUniqueTTs.toLocaleString("uk-UA")}
                      </td>
                      <td className={`py-2.5 px-2 text-right font-mono ${sortField === 'sales' ? 'bg-indigo-500/20 text-indigo-200' : ''}`}>
                        {totals.totalSales.toLocaleString("uk-UA")}
                      </td>
                      <td className={`py-2.5 px-2 text-right font-mono ${sortField === 'places' ? 'bg-indigo-500/20 text-indigo-200' : ''}`}>
                        {totals.totalPlaces.toLocaleString("uk-UA")}
                      </td>
                      <td className={`py-2.5 px-2 text-right font-mono ${sortField === 'pointsTotalPotential' ? 'bg-indigo-500/20 text-indigo-200' : ''}`}>
                        {totals.totalMarketPotential.toLocaleString("uk-UA")}
                      </td>
                      <td className={`py-2.5 px-2 text-right font-mono ${sortField === 'salesSharePct' ? 'bg-indigo-500/20 text-indigo-200' : ''}`}>
                        100%
                      </td>
                      <td className={`py-2.5 px-2 text-right font-mono ${sortField === 'ttSharePct' ? 'bg-indigo-500/20 text-indigo-200' : ''}`}>
                        100%
                      </td>
                      <td className={`py-2.5 px-2 text-right font-mono ${sortField === 'potentialSharePct' ? 'bg-indigo-500/20 text-indigo-200' : ''}`}>
                        100%
                      </td>
                      <td className={`py-2.5 px-2 text-right font-mono ${sortField === 'placesSharePct' ? 'bg-indigo-500/20 text-indigo-200' : ''}`}>
                        100%
                      </td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </div>

          {/* Right Side: Graph Box (strictly matches height of table box) */}
          <div className="h-full min-h-[440px]">
            <MarketStructureChart rows={sortedRows} />
          </div>
        </div>
      )}
    </div>
  );
}
