import React, { useMemo, useState } from "react";
import { Users, Download, ChevronDown, ChevronUp } from "lucide-react";
import * as XLSX from "xlsx";
import { ManagerResultsChart } from "./ManagerResultsChart";

export function ManagerResultsTable({ data = [], agents = [] }) {
  // data is latestFilteredVisits (one latest visit per unique TT)
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [sortField, setSortField] = useState("sharePct");
  const [sortDirection, setSortDirection] = useState("desc");

  // Calculate stats per manager
  const { rows, totals } = useMemo(() => {
    // Collect all manager names from visits or agents list
    const agentSet = new Set();
    data.forEach(v => {
      if (v.agent) agentSet.add(v.agent.trim());
    });
    (agents || []).forEach(a => {
      if (a) agentSet.add(a.trim());
    });

    const agentList = Array.from(agentSet);

    const rawRows = agentList.map(agentName => {
      const managerVisits = data.filter(
        v => (v.agent || "").trim().toLowerCase() === agentName.toLowerCase()
      );

      const ttCount = managerVisits.length;
      const potential = managerVisits.reduce((acc, v) => acc + (v.totalPP || 0), 0);
      const sales = managerVisits.reduce((acc, v) => acc + (v.highfoamPP || 0), 0);
      const sharePct = potential > 0 ? (sales / potential) * 100 : 0;
      const growthPotential = Math.max(0, potential - sales);
      const withoutUs = managerVisits.filter(v => !v.isCooperating).length;

      return {
        name: agentName,
        ttCount,
        potential,
        sales,
        sharePct,
        growthPotential,
        withoutUs,
      };
    });

    // Only include active managers in current filtered subset
    const activeRows = rawRows.filter(
      r => r.ttCount > 0 || r.potential > 0 || r.sales > 0 || r.withoutUs > 0
    );

    // Calculate totals
    const totalTTs = activeRows.reduce((acc, r) => acc + r.ttCount, 0);
    const totalPotential = activeRows.reduce((acc, r) => acc + r.potential, 0);
    const totalSales = activeRows.reduce((acc, r) => acc + r.sales, 0);
    const totalSharePct = totalPotential > 0 ? (totalSales / totalPotential) * 100 : 0;
    const totalGrowthPotential = Math.max(0, totalPotential - totalSales);
    const totalWithoutUs = activeRows.reduce((acc, r) => acc + r.withoutUs, 0);

    return {
      rows: activeRows,
      totals: {
        totalTTs,
        totalPotential,
        totalSales,
        totalSharePct,
        totalGrowthPotential,
        totalWithoutUs,
      },
    };
  }, [data, agents]);

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
      "Менеджер": r.name,
      "Кількість ТТ": r.ttCount,
      "Потенціал": r.potential,
      "Продажі ЮНП": r.sales,
      "Частка ЮНП": formatPct(r.sharePct),
      "Потенціал зростання": r.growthPotential,
      "Без ЮНП": r.withoutUs,
    }));

    exportData.push({
      "Менеджер": "РАЗОМ",
      "Кількість ТТ": totals.totalTTs,
      "Потенціал": totals.totalPotential,
      "Продажі ЮНП": totals.totalSales,
      "Частка ЮНП": formatPct(totals.totalSharePct),
      "Потенціал зростання": totals.totalGrowthPotential,
      "Без ЮНП": totals.totalWithoutUs,
    });

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Результати за менеджерами");
    const dateStr = new Date().toISOString().split("T")[0];
    XLSX.writeFile(wb, `Результати_за_менеджерами_${dateStr}.xlsx`);
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
      return "bg-emerald-500/15 text-emerald-400 font-bold border border-emerald-500/20";
    }
    return "bg-rose-500/10 text-rose-300 font-semibold border border-rose-500/20";
  };

  return (
    <div className="glass rounded-3xl border border-white/10 shadow-2xl overflow-hidden p-4 sm:p-5 space-y-3 transition-all duration-300">
      {/* Block Header (Title only, no subtitle, no badge) */}
      <div
        onClick={() => setIsCollapsed(prev => !prev)}
        className="flex items-center justify-between gap-3 cursor-pointer select-none group"
      >
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 group-hover:bg-indigo-500/20 transition-colors">
            <Users className="h-4 w-4" />
          </div>
          <h2 className="text-base sm:text-lg font-bold tracking-tight text-white group-hover:text-indigo-300 transition-colors">
            Результати за менеджерами
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

      {/* Block Body (Table and Graph with equal height side by side) */}
      {!isCollapsed && (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 items-stretch pt-1 animate-in fade-in duration-200">
          {/* Left Side: Table Box */}
          <div className="h-full flex flex-col justify-between overflow-hidden rounded-2xl border border-white/10 bg-[#0d1527]/70 p-3 sm:p-4 min-h-[440px]">
            <div className="overflow-x-auto flex-1">
              <table className="w-full text-xs sm:text-[13px] text-left border-collapse min-w-[620px]">
                {/* Column definitions: generous width for Manager name to avoid wrapping */}
                <colgroup>
                  <col className="w-[165px] min-w-[165px]" />
                  <col className="w-[64px]" />
                  <col className="w-[76px]" />
                  <col className="w-[76px]" />
                  <col className="w-[76px]" />
                  <col className="w-[84px]" />
                  <col className="w-[66px]" />
                </colgroup>

                {/* Table Head */}
                <thead>
                  <tr className="bg-[#15213b] text-white/90 border-b border-white/15 text-xs leading-tight">
                    <th
                      onClick={() => handleSort("name")}
                      title="Менеджер"
                      className={getHeaderClass("name", "text-left pl-3.5 whitespace-nowrap")}
                    >
                      Менеджер
                    </th>

                  <th
                    onClick={() => handleSort("ttCount")}
                    title="Кількість ТТ"
                    className={getHeaderClass("ttCount", "text-center")}
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
                    onClick={() => handleSort("withoutUs")}
                    title="Без ЮНП"
                    className={getHeaderClass("withoutUs", "text-center pr-4")}
                  >
                    Без ЮНП
                  </th>
                </tr>
              </thead>

              {/* Table Body */}
              <tbody className="divide-y divide-white/5">
                {sortedRows.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-muted-foreground text-xs">
                      Немає даних за обраними фільтрами
                    </td>
                  </tr>
                ) : (
                  sortedRows.map(row => (
                    <tr
                      key={row.name}
                      className="hover:bg-white/[0.04] transition-colors"
                    >
                      {/* Менеджер */}
                      <td className={`py-2.5 px-3 text-left pl-3.5 font-medium text-white/95 whitespace-nowrap ${sortField === "name" ? "bg-indigo-500/[0.08]" : ""}`}>
                        {row.name}
                      </td>

                      {/* Кількість ТТ */}
                      <td className={getCellClass("ttCount") + " font-mono"}>
                        {row.ttCount.toLocaleString("uk-UA")}
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

                      {/* Потенціал зростання */}
                      <td className={getCellClass("growthPotential") + " font-mono"}>
                        {row.growthPotential.toLocaleString("uk-UA")}
                      </td>

                      {/* Без ЮНП */}
                      <td className={`py-2.5 px-3 text-right pr-4 font-mono ${
                        sortField === "withoutUs" ? "bg-indigo-500/[0.08]" : ""
                      } ${row.withoutUs > 0 ? "text-white/85" : "text-muted-foreground"}`}>
                        {row.withoutUs.toLocaleString("uk-UA")}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>

              {/* Table Footer: Totals matching screenshot */}
              {sortedRows.length > 0 && (
                <tfoot>
                  <tr className="bg-[#15213b] text-white font-bold border-t-2 border-white/20 text-xs sm:text-[13px]">
                    <td className={`py-3 px-3 text-left pl-3.5 uppercase font-extrabold tracking-wide whitespace-nowrap ${sortField === "name" ? "bg-indigo-500/20 text-indigo-200" : ""}`}>
                      РАЗОМ
                    </td>
                    <td className={`py-3 px-3 text-right font-mono ${sortField === "ttCount" ? "bg-indigo-500/20 text-indigo-200" : ""}`}>
                      {totals.totalTTs.toLocaleString("uk-UA")}
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
                    <td className={`py-3 px-3 text-right font-mono ${sortField === "growthPotential" ? "bg-indigo-500/20 text-indigo-200" : ""}`}>
                      {totals.totalGrowthPotential.toLocaleString("uk-UA")}
                    </td>
                    <td className={`py-3 px-3 text-right pr-4 font-mono ${sortField === "withoutUs" ? "bg-indigo-500/20 text-indigo-200" : ""}`}>
                      {totals.totalWithoutUs.toLocaleString("uk-UA")}
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>

        {/* Right Side: Graph Box (Same height, flex-1 chart) */}
        <div className="h-full min-h-[440px]">
          <ManagerResultsChart rows={sortedRows} />
        </div>
      </div>
    )}
  </div>
  );
}
