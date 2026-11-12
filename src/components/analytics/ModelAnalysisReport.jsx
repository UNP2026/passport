import React, { useMemo, useState } from "react";
import { 
  Package, 
  Store, 
  CheckCircle2, 
  XCircle, 
  Search, 
  Download, 
  ChevronDown, 
  ChevronUp, 
  ExternalLink,
  Layers,
  ArrowUpDown,
  Filter
} from "lucide-react";
import * as XLSX from "xlsx";
import { PointCardModal } from "./PointCardModal";
import { EMPTY_SALES_INDEX, formatSales, salesForExcel, salesPeriodLabel } from "../../lib/salesUtils";

export function ModelAnalysisReport({ 
  data = [],          // latestFilteredVisits (unique points matching current filter)
  allVisits = [],     // all visits across database (data?.raw)
  allBrands = [],     // full list of models from directory (regardless of visits)
  salesIndex = EMPTY_SALES_INDEX, // фактичні продажі (1С) за «Період продаж»
}) {
  const [selectedModel, setSelectedModel] = useState(null);
  const [presenceFilter, setPresenceFilter] = useState("present"); // "present" | "absent"
  const [pointSearchQuery, setPointSearchQuery] = useState("");
  const [selectedPointForModal, setSelectedPointForModal] = useState(null);

  // Sorting state for models tables
  const [hfSortField, setHfSortField] = useState("totalPoints");
  const [hfSortDirection, setHfSortDirection] = useState("desc");

  const [privatSortField, setPrivatSortField] = useState("totalPoints");
  const [privatSortDirection, setPrivatSortDirection] = useState("desc");

  // 1. Calculate unique points across ALL visits (unfiltered)
  const allUniquePoints = useMemo(() => {
    const seen = new Set();
    const result = [];
    (allVisits || []).forEach(v => {
      const key = v.ttKey || `${(v.org || "").toLowerCase()}:::${(v.point || "").toLowerCase()}:::${(v.address || "").toLowerCase()}`;
      if (!seen.has(key)) {
        seen.add(key);
        result.push(v);
      }
    });
    return result;
  }, [allVisits]);

  // 2. Filtered unique points (data passed in is already latestFilteredVisits)
  const filteredUniquePoints = useMemo(() => {
    return data || [];
  }, [data]);

  // Total UNP points in current filtered selection
  // "Загальна кількість точок ЮНП это кол-во точек где есть ЮНП и вот это поле уже будет меняться в зависимости от выбранного фильтра"
  const unpPointsInFilterCount = useMemo(() => {
    return filteredUniquePoints.filter(p => p.isCooperating === true || (p.highfoamPP || 0) > 0).length;
  }, [filteredUniquePoints]);

  // 3. Process each model from the directory
  // Calculate:
  // - totalPoints: "Загальна кількість точок де представлена модель" (unfiltered across all points)
  // - filteredPoints: "Кількість точок де представлена модель" (matching filter)
  // - unpPoints: "Загальна кількість точок ЮНП" (in current filter)
  const processedModels = useMemo(() => {
    return (allBrands || []).map(b => {
      const modelName = b.name;
      const isPm = b.is_pm === true || modelName.toLowerCase().startsWith("privat");
      const isHighfoam = !isPm;

      // Unfiltered total points where this model is present
      const totalPointsCount = allUniquePoints.filter(p => {
        if (p.brandPresence && p.brandPresence[modelName] !== undefined) {
          return p.brandPresence[modelName] === true;
        }
        return (p.visit_brands || []).some(vb => vb.brand?.name === modelName);
      }).length;

      // Filtered points where this model is present
      const filteredPointsCount = filteredUniquePoints.filter(p => {
        if (p.brandPresence && p.brandPresence[modelName] !== undefined) {
          return p.brandPresence[modelName] === true;
        }
        return (p.visit_brands || []).some(vb => vb.brand?.name === modelName);
      }).length;

      return {
        id: b.id || modelName,
        name: modelName,
        isHighfoam,
        isPm,
        totalPoints: totalPointsCount,          // Загальна кількість точок де представлена модель (незалежно від фільтрів)
        filteredPoints: filteredPointsCount,    // Кількість точок де представлена модель (за фільтром)
        unpPoints: unpPointsInFilterCount,      // Загальна кількість точок ЮНП (за фільтром)
        actualSales: salesIndex.brand(b.id),    // Фактичні продажі моделі (1С), середнє за місяць
      };
    });
  }, [allBrands, allUniquePoints, filteredUniquePoints, unpPointsInFilterCount, salesIndex]);

  // Separate Highfoam and Privat models
  const highfoamModels = useMemo(() => {
    const list = processedModels.filter(m => m.isHighfoam);
    return [...list].sort((a, b) => {
      let aVal = a[hfSortField];
      let bVal = b[hfSortField];
      if (typeof aVal === "string") {
        const cmp = aVal.localeCompare(bVal, "uk");
        return hfSortDirection === "asc" ? cmp : -cmp;
      }
      if (aVal === bVal) {
        return a.name.localeCompare(b.name, "uk");
      }
      return hfSortDirection === "asc" ? aVal - bVal : bVal - aVal;
    });
  }, [processedModels, hfSortField, hfSortDirection]);

  const privatModels = useMemo(() => {
    const list = processedModels.filter(m => m.isPm);
    return [...list].sort((a, b) => {
      let aVal = a[privatSortField];
      let bVal = b[privatSortField];
      if (typeof aVal === "string") {
        const cmp = aVal.localeCompare(bVal, "uk");
        return privatSortDirection === "asc" ? cmp : -cmp;
      }
      if (aVal === bVal) {
        return a.name.localeCompare(b.name, "uk");
      }
      return privatSortDirection === "asc" ? aVal - bVal : bVal - aVal;
    });
  }, [processedModels, privatSortField, privatSortDirection]);

  // Auto-select first model if none selected
  const activeModel = useMemo(() => {
    if (selectedModel) {
      // Find updated model data
      const found = processedModels.find(m => m.name === selectedModel.name);
      if (found) return found;
    }
    return highfoamModels[0] || privatModels[0] || null;
  }, [selectedModel, processedModels, highfoamModels, privatModels]);

  // Calculate points for the active model based on presence filter ("present" vs "absent")
  const { presentPoints, absentPoints } = useMemo(() => {
    if (!activeModel) return { presentPoints: [], absentPoints: [] };
    const mName = activeModel.name;

    const present = [];
    const absent = [];

    filteredUniquePoints.forEach(p => {
      const isPresent = p.brandPresence?.[mName] === true || 
        (p.visit_brands || []).some(vb => vb.brand?.name === mName);

      const enhancedPoint = {
        ...p,
        isModelPresent: isPresent,
        pointName: p.point || "Невідома ТТ",
        orgName: p.org || "Без організації",
        cityName: p.city || "Невідомо",
        orgTtCount: p.orgTtCount || 0,
        addressStr: p.address || "Не вказано",
        agentName: p.agent || "Невідомий",
        totalPP: p.totalPP || 0,
        highfoamPP: p.highfoamPP || 0,
        // Фактичні продажі обраної моделі (1С): менеджера ТТ по організації ТТ та всієї організації
        actualByManager: salesIndex.managerOrgBrand(p.authorUserId, p.orgCode, activeModel.id),
        actualByOrg: salesIndex.orgBrand(p.orgCode, activeModel.id),
        isCooperating: p.isCooperating === true,
        ttType: p.ttType || "—"
      };

      if (isPresent) {
        present.push(enhancedPoint);
      } else {
        absent.push(enhancedPoint);
      }
    });

    return { presentPoints: present, absentPoints: absent };
  }, [activeModel, filteredUniquePoints, salesIndex]);

  // Filter points list by search query
  const displayedPoints = useMemo(() => {
    const list = presenceFilter === "present" ? presentPoints : absentPoints;
    if (!pointSearchQuery.trim()) return list;
    const q = pointSearchQuery.toLowerCase().trim();
    return list.filter(pt => 
      (pt.pointName || "").toLowerCase().includes(q) ||
      (pt.orgName || "").toLowerCase().includes(q) ||
      (pt.cityName || "").toLowerCase().includes(q) ||
      (pt.addressStr || "").toLowerCase().includes(q) ||
      (pt.agentName || "").toLowerCase().includes(q)
    );
  }, [presenceFilter, presentPoints, absentPoints, pointSearchQuery]);

  // Sorter togglers
  const handleHfSort = (field) => {
    if (hfSortField === field) {
      setHfSortDirection(prev => prev === "asc" ? "desc" : "asc");
    } else {
      setHfSortField(field);
      setHfSortDirection(field === "name" ? "asc" : "desc");
    }
  };

  const handlePrivatSort = (field) => {
    if (privatSortField === field) {
      setPrivatSortDirection(prev => prev === "asc" ? "desc" : "asc");
    } else {
      setPrivatSortField(field);
      setPrivatSortDirection(field === "name" ? "asc" : "desc");
    }
  };

  // Export to Excel
  const handleExportModels = () => {
    const wb = XLSX.utils.book_new();

    // Highfoam sheet
    const hfRows = highfoamModels.map((m, idx) => ({
      "№": idx + 1,
      "Модель Highfoam": m.name,
      "Загальна к-ть точок де представлена модель (без фільтрів)": m.totalPoints,
      "Кількість точок де представлена модель (за фільтром)": m.filteredPoints,
      "Загальна к-ть точок ЮНП (за фільтром)": m.unpPoints,
      [`Фактичні продажі (${salesPeriodLabel(salesIndex.months)})`]: salesForExcel(m.actualSales)
    }));
    const wsHf = XLSX.utils.json_to_sheet(hfRows);
    XLSX.utils.book_append_sheet(wb, wsHf, "Моделі Highfoam");

    // Privat sheet
    const privatRows = privatModels.map((m, idx) => ({
      "№": idx + 1,
      "Модель Privat": m.name,
      "Загальна к-ть точок де представлена модель (без фільтрів)": m.totalPoints,
      "Кількість точок де представлена модель (за фільтром)": m.filteredPoints,
      "Загальна к-ть точок ЮНП (за фільтром)": m.unpPoints,
      [`Фактичні продажі (${salesPeriodLabel(salesIndex.months)})`]: salesForExcel(m.actualSales)
    }));
    const wsPrivat = XLSX.utils.json_to_sheet(privatRows);
    XLSX.utils.book_append_sheet(wb, wsPrivat, "Моделі Privat");

    // Active model points sheet
    if (activeModel) {
      const pointsRows = (presenceFilter === "present" ? presentPoints : absentPoints).map((p, idx) => ({
        "№": idx + 1,
        "Торгова точка": p.pointName,
        "Організація": p.orgName,
        "Місто": p.cityName,
        "Кіл-ть ТТ": p.orgTtCount,
        "Адреса": p.addressStr,
        "Тип ТТ": p.ttType,
        "Менеджер": p.agentName,
        "Присутність ЮНП": p.isCooperating ? "Так" : "Ні",
        "Потенціал (PP)": p.totalPP,
        "Продажі ЮНП": p.highfoamPP,
        "Фактичні продажі по менеджеру": salesForExcel(p.actualByManager),
        "Фактичні продажі по організації": salesForExcel(p.actualByOrg),
        "Статус моделі": presenceFilter === "present" ? "Присутня" : "Відсутня"
      }));
      const wsPoints = XLSX.utils.json_to_sheet(pointsRows);
      XLSX.utils.book_append_sheet(wb, wsPoints, `ТТ - ${activeModel.name.slice(0, 20)}`);
    }

    const dateStr = new Date().toISOString().split("T")[0];
    XLSX.writeFile(wb, `Аналіз_моделей_${dateStr}.xlsx`);
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-200">
      {/* Top Banner / Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 glass p-4 sm:p-5 rounded-3xl border border-white/10">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
            <Package className="h-5 w-5" />
          </div>
          <h2 className="text-lg sm:text-xl font-bold text-white tracking-tight">
            Аналіз по моделях
          </h2>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={handleExportModels}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600/20 hover:bg-indigo-600 text-indigo-300 hover:text-white border border-indigo-500/30 transition-all font-medium text-xs shadow-lg shadow-indigo-600/10"
            title="Експорт моделей та точок в Excel"
          >
            <Download className="h-3.5 w-3.5" />
            <span>Експорт в Excel</span>
          </button>
        </div>
      </div>

      {/* Two Windows Side-by-Side: Left = Highfoam, Right = Privat */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        
        {/* LEFT WINDOW: МОДЕЛІ HIGHFOAM */}
        <div className="glass rounded-3xl border border-white/10 p-5 flex flex-col justify-between overflow-hidden shadow-xl shadow-black/20">
          <div>
            {/* Header */}
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-white/10">
              <div className="flex items-center gap-2.5">
                <div className="h-3 w-3 rounded-full bg-indigo-400 shadow-[0_0_10px_rgba(129,140,248,0.8)]" />
                <h3 className="text-base font-bold text-white tracking-tight">
                  Моделі Highfoam
                </h3>
                <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 font-medium">
                  {highfoamModels.length}
                </span>
              </div>
              <div className="text-[11px] text-muted-foreground">
                Клікніть рядок для вибору моделі
              </div>
            </div>

            {/* Table */}
            <div className="overflow-x-auto max-h-[460px] custom-scrollbar rounded-2xl border border-white/5">
              <table className="w-full text-left border-collapse text-xs">
                <thead className="sticky top-0 bg-[#162032] z-10 text-[11px] uppercase tracking-wider text-muted-foreground border-b border-white/10 select-none">
                  <tr>
                    <th 
                      onClick={() => handleHfSort("name")}
                      className="p-3 font-semibold cursor-pointer hover:text-white transition-colors"
                    >
                      <div className="flex items-center gap-1.5">
                        <span>Модель</span>
                        <ArrowUpDown className="h-3 w-3 opacity-60" />
                      </div>
                    </th>
                    <th 
                      onClick={() => handleHfSort("totalPoints")}
                      className={`p-3 text-center font-semibold cursor-pointer hover:text-white transition-colors ${
                        hfSortField === "totalPoints" ? "text-indigo-400 font-bold bg-indigo-500/5" : ""
                      }`}
                      title="Загальна кількість точок де представлена модель (незалежно від фільтрів)"
                    >
                      <div className="flex items-center justify-center gap-1">
                        <span>Заг. к-ть точок</span>
                        <ArrowUpDown className="h-3 w-3 opacity-60" />
                      </div>
                    </th>
                    <th 
                      onClick={() => handleHfSort("filteredPoints")}
                      className={`p-3 text-center font-semibold cursor-pointer hover:text-white transition-colors ${
                        hfSortField === "filteredPoints" ? "text-indigo-400 font-bold bg-indigo-500/5" : ""
                      }`}
                      title="Кількість точок де представлена модель за обраними фільтрами"
                    >
                      <div className="flex items-center justify-center gap-1">
                        <span>К-ть точок (фільтр)</span>
                        <ArrowUpDown className="h-3 w-3 opacity-60" />
                      </div>
                    </th>
                    <th 
                      className="p-3 text-center font-semibold text-muted-foreground/80"
                      title="Загальна кількість точок ЮНП за обраними фільтрами"
                    >
                      <span>Заг. ЮНП</span>
                    </th>
                    <th 
                      onClick={() => handleHfSort("actualSales")}
                      className={`p-3 text-center font-semibold cursor-pointer hover:text-white transition-colors ${
                        hfSortField === "actualSales" ? "text-indigo-400 font-bold bg-indigo-500/5" : ""
                      }`}
                      title={`Фактичні продажі моделі з 1С, шт (${salesPeriodLabel(salesIndex.months)}${salesIndex.monthsCount > 1 ? `, середнє за ${salesIndex.monthsCount} міс.` : ""})`}
                    >
                      <div className="flex items-center justify-center gap-1">
                        <span>Факт. продажі</span>
                        <ArrowUpDown className="h-3 w-3 opacity-60" />
                      </div>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 font-normal">
                  {highfoamModels.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="p-8 text-center text-muted-foreground">
                        Моделей Highfoam не знайдено в довіднику
                      </td>
                    </tr>
                  ) : (
                    highfoamModels.map((m) => {
                      const isSelected = activeModel?.name === m.name;
                      return (
                        <tr
                          key={m.id}
                          onClick={() => setSelectedModel(m)}
                          className={`cursor-pointer transition-all ${
                            isSelected
                              ? "bg-indigo-600/25 border-l-4 border-l-indigo-400 text-white font-medium shadow-inner"
                              : "hover:bg-white/[0.04] text-white/90"
                          }`}
                        >
                          <td className="p-3 font-medium">
                            <div className="flex items-center gap-2">
                              {isSelected && (
                                <span className="h-2 w-2 rounded-full bg-indigo-400 animate-pulse shrink-0" />
                              )}
                              <span className="truncate max-w-[200px]" title={m.name}>
                                {m.name}
                              </span>
                            </div>
                          </td>
                          <td className="p-3 text-center font-mono font-semibold text-indigo-300">
                            {m.totalPoints}
                          </td>
                          <td className="p-3 text-center font-mono font-semibold text-emerald-400">
                            {m.filteredPoints}
                          </td>
                          <td className="p-3 text-center font-mono text-muted-foreground">
                            {m.unpPoints}
                          </td>
                          <td className={`p-3 text-center font-mono ${m.actualSales ? "text-emerald-300 font-semibold" : "text-muted-foreground/50"}`}>
                            {formatSales(m.actualSales)}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
          
          <div className="pt-3 border-t border-white/5 flex items-center justify-between text-[11px] text-muted-foreground">
            <span>Всього в списку: {highfoamModels.length} моделей</span>
            <span>Сортування: за заг. кількістю точок</span>
          </div>
        </div>

        {/* RIGHT WINDOW: МОДЕЛІ PRIVAT */}
        <div className="glass rounded-3xl border border-white/10 p-5 flex flex-col justify-between overflow-hidden shadow-xl shadow-black/20">
          <div>
            {/* Header */}
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-white/10">
              <div className="flex items-center gap-2.5">
                <div className="h-3 w-3 rounded-full bg-purple-400 shadow-[0_0_10px_rgba(192,132,252,0.8)]" />
                <h3 className="text-base font-bold text-white tracking-tight">
                  Моделі Privat (Private Label)
                </h3>
                <span className="text-xs px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30 font-medium">
                  {privatModels.length}
                </span>
              </div>
              <div className="text-[11px] text-muted-foreground">
                Клікніть рядок для вибору моделі
              </div>
            </div>

            {/* Table */}
            <div className="overflow-x-auto max-h-[460px] custom-scrollbar rounded-2xl border border-white/5">
              <table className="w-full text-left border-collapse text-xs">
                <thead className="sticky top-0 bg-[#162032] z-10 text-[11px] uppercase tracking-wider text-muted-foreground border-b border-white/10 select-none">
                  <tr>
                    <th 
                      onClick={() => handlePrivatSort("name")}
                      className="p-3 font-semibold cursor-pointer hover:text-white transition-colors"
                    >
                      <div className="flex items-center gap-1.5">
                        <span>Модель</span>
                        <ArrowUpDown className="h-3 w-3 opacity-60" />
                      </div>
                    </th>
                    <th 
                      onClick={() => handlePrivatSort("totalPoints")}
                      className={`p-3 text-center font-semibold cursor-pointer hover:text-white transition-colors ${
                        privatSortField === "totalPoints" ? "text-purple-400 font-bold bg-purple-500/5" : ""
                      }`}
                      title="Загальна кількість точок де представлена модель (незалежно від фільтрів)"
                    >
                      <div className="flex items-center justify-center gap-1">
                        <span>Заг. к-ть точок</span>
                        <ArrowUpDown className="h-3 w-3 opacity-60" />
                      </div>
                    </th>
                    <th 
                      onClick={() => handlePrivatSort("filteredPoints")}
                      className={`p-3 text-center font-semibold cursor-pointer hover:text-white transition-colors ${
                        privatSortField === "filteredPoints" ? "text-purple-400 font-bold bg-purple-500/5" : ""
                      }`}
                      title="Кількість точок де представлена модель за обраними фільтрами"
                    >
                      <div className="flex items-center justify-center gap-1">
                        <span>К-ть точок (фільтр)</span>
                        <ArrowUpDown className="h-3 w-3 opacity-60" />
                      </div>
                    </th>
                    <th 
                      className="p-3 text-center font-semibold text-muted-foreground/80"
                      title="Загальна кількість точок ЮНП за обраними фільтрами"
                    >
                      <span>Заг. ЮНП</span>
                    </th>
                    <th 
                      onClick={() => handlePrivatSort("actualSales")}
                      className={`p-3 text-center font-semibold cursor-pointer hover:text-white transition-colors ${
                        privatSortField === "actualSales" ? "text-purple-400 font-bold bg-purple-500/5" : ""
                      }`}
                      title={`Фактичні продажі моделі з 1С, шт (${salesPeriodLabel(salesIndex.months)}${salesIndex.monthsCount > 1 ? `, середнє за ${salesIndex.monthsCount} міс.` : ""})`}
                    >
                      <div className="flex items-center justify-center gap-1">
                        <span>Факт. продажі</span>
                        <ArrowUpDown className="h-3 w-3 opacity-60" />
                      </div>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 font-normal">
                  {privatModels.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="p-8 text-center text-muted-foreground">
                        Моделей Privat не знайдено в довіднику
                      </td>
                    </tr>
                  ) : (
                    privatModels.map((m) => {
                      const isSelected = activeModel?.name === m.name;
                      return (
                        <tr
                          key={m.id}
                          onClick={() => setSelectedModel(m)}
                          className={`cursor-pointer transition-all ${
                            isSelected
                              ? "bg-purple-600/25 border-l-4 border-l-purple-400 text-white font-medium shadow-inner"
                              : "hover:bg-white/[0.04] text-white/90"
                          }`}
                        >
                          <td className="p-3 font-medium">
                            <div className="flex items-center gap-2">
                              {isSelected && (
                                <span className="h-2 w-2 rounded-full bg-purple-400 animate-pulse shrink-0" />
                              )}
                              <span className="truncate max-w-[200px]" title={m.name}>
                                {m.name}
                              </span>
                            </div>
                          </td>
                          <td className="p-3 text-center font-mono font-semibold text-purple-300">
                            {m.totalPoints}
                          </td>
                          <td className="p-3 text-center font-mono font-semibold text-emerald-400">
                            {m.filteredPoints}
                          </td>
                          <td className="p-3 text-center font-mono text-muted-foreground">
                            {m.unpPoints}
                          </td>
                          <td className={`p-3 text-center font-mono ${m.actualSales ? "text-emerald-300 font-semibold" : "text-muted-foreground/50"}`}>
                            {formatSales(m.actualSales)}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
          
          <div className="pt-3 border-t border-white/5 flex items-center justify-between text-[11px] text-muted-foreground">
            <span>Всього в списку: {privatModels.length} моделей</span>
            <span>Сортування: за заг. кількістю точок</span>
          </div>
        </div>

      </div>

      {/* DEDICATED BLOCK: «ТОРГОВІ ТОЧКИ» ДЛЯ ОБРАНОЇ МОДЕЛІ */}
      {activeModel && (
        <div className="glass rounded-3xl border border-white/10 p-5 sm:p-6 shadow-2xl shadow-black/30 space-y-5 animate-in fade-in slide-in-from-bottom-2 duration-200">
          {/* Header block with Model Name and Presence / Absence Switch */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-white/10">
            <div>
              <div className="flex items-center gap-2 mb-1.5">
                <Store className="h-5 w-5 text-indigo-400" />
                <h3 className="text-xl font-bold text-white tracking-tight">
                  Торгові точки
                </h3>
                <span className="text-xs px-2.5 py-0.5 rounded-full font-semibold border bg-white/5 border-white/10 text-white/80">
                  {activeModel.isHighfoam ? "Highfoam" : "Privat"}
                </span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <span className="text-muted-foreground">Модель:</span>
                <span className="text-white font-bold text-base px-2.5 py-0.5 rounded-xl bg-indigo-500/15 border border-indigo-500/30 text-indigo-200">
                  «{activeModel.name}»
                </span>
              </div>
            </div>

            {/* Switch between: "присутня" and "відсутня" */}
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex bg-slate-100 dark:bg-black/40 p-1 rounded-2xl border border-slate-200 dark:border-white/10 shadow-inner">
                <button
                  type="button"
                  onClick={() => setPresenceFilter("present")}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
                    presenceFilter === "present"
                      ? "bg-emerald-600 text-white shadow-lg shadow-emerald-600/30 ring-1 ring-emerald-400/30"
                      : "text-slate-600 hover:text-slate-900 dark:text-muted-foreground dark:hover:text-white"
                  }`}
                >
                  <CheckCircle2 className="h-4 w-4 text-emerald-200 dark:text-emerald-300" />
                  <span>Присутня</span>
                  <span className="ml-1 px-2 py-0.5 rounded-full text-[10px] bg-black/20 dark:bg-black/30 text-white font-bold">
                    {presentPoints.length}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setPresenceFilter("absent")}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
                    presenceFilter === "absent"
                      ? "bg-rose-600 text-white shadow-lg shadow-rose-600/30 ring-1 ring-rose-400/30"
                      : "text-slate-600 hover:text-slate-900 dark:text-muted-foreground dark:hover:text-white"
                  }`}
                >
                  <XCircle className="h-4 w-4 text-rose-200 dark:text-rose-300" />
                  <span>Відсутня</span>
                  <span className="ml-1 px-2 py-0.5 rounded-full text-[10px] bg-black/20 dark:bg-black/30 text-white font-bold">
                    {absentPoints.length}
                  </span>
                </button>
              </div>

              {/* Local Search inside points */}
              <div className="relative min-w-[200px] sm:min-w-[260px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Пошук ТТ, міста, адреси..."
                  value={pointSearchQuery}
                  onChange={(e) => setPointSearchQuery(e.target.value)}
                  className="w-full bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-muted-foreground focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all shadow-sm"
                />
              </div>
            </div>
          </div>

          {/* Table of Trade Points */}
          <div className="overflow-x-auto rounded-2xl border border-white/10 max-h-[500px] custom-scrollbar shadow-inner">
            <table className="w-full text-left border-collapse text-xs">
              <thead className="sticky top-0 bg-[#162032] z-10 text-[11px] uppercase tracking-wider text-muted-foreground border-b border-white/10 select-none">
                <tr>
                  <th className="p-3 font-semibold text-white/90">Торгова точка</th>
                  <th className="p-3 font-semibold">Організація</th>
                  <th className="p-3 font-semibold">Місто</th>
                  <th className="p-3 text-center font-semibold whitespace-nowrap" title="Кількість торгових точок організації">Кіл-ть ТТ</th>
                  <th className="p-3 font-semibold">Адреса</th>
                  <th className="p-3 font-semibold">Тип ТТ</th>
                  <th className="p-3 font-semibold">Менеджер</th>
                  <th className="p-3 text-center font-semibold">Присутність ЮНП</th>
                  <th className="p-3 text-center font-semibold">Потенціал (PP)</th>
                  <th className="p-3 text-center font-semibold">Продажі ЮНП</th>
                  <th className="p-3 text-center font-semibold" title={`Фактичні продажі моделі «${activeModel.name}» менеджером ТТ по організації ТТ, шт (${salesPeriodLabel(salesIndex.months)}${salesIndex.monthsCount > 1 ? `, середнє за ${salesIndex.monthsCount} міс.` : ""})`}>Факт. продажі по менеджеру</th>
                  <th className="p-3 text-center font-semibold" title={`Фактичні продажі моделі «${activeModel.name}» по організації ТТ (усі менеджери), шт (${salesPeriodLabel(salesIndex.months)}${salesIndex.monthsCount > 1 ? `, середнє за ${salesIndex.monthsCount} міс.` : ""})`}>Факт. продажі по організації</th>
                  <th className="p-3 text-center font-semibold">Статус моделі</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {displayedPoints.length === 0 ? (
                  <tr>
                    <td colSpan={13} className="p-10 text-center text-muted-foreground">
                      {pointSearchQuery ? (
                        <span>За запитом «{pointSearchQuery}» точок не знайдено</span>
                      ) : (
                        <span>
                          {presenceFilter === "present"
                            ? `Модель «${activeModel.name}» не представлена в жодній торговій точці за поточними фільтрами`
                            : `Модель «${activeModel.name}» представлена в усіх доступних торгових точках`}
                        </span>
                      )}
                    </td>
                  </tr>
                ) : (
                  displayedPoints.map((point) => (
                    <tr
                      key={point.id || point.ttKey}
                      className="hover:bg-white/[0.04] transition-colors group cursor-pointer"
                      onClick={() => setSelectedPointForModal(point)}
                    >
                      {/* Торгова точка (clickable to open modal) */}
                      <td className="p-3 font-medium text-white">
                        <button
                          type="button"
                          className="flex items-center gap-1.5 text-left text-indigo-300 hover:text-indigo-200 group-hover:underline font-semibold"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedPointForModal(point);
                          }}
                        >
                          <span className="truncate max-w-[200px]">{point.pointName}</span>
                          <ExternalLink className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                        </button>
                      </td>

                      {/* Організація */}
                      <td className="p-3 text-white/80 max-w-[160px] truncate" title={point.orgName}>
                        {point.orgName}
                      </td>

                      {/* Місто */}
                      <td className="p-3 text-white/90 font-medium">
                        {point.cityName}
                      </td>

                      {/* Кіл-ть ТТ організації */}
                      <td className="p-3 text-center font-mono text-white/90">
                        {point.orgTtCount || "—"}
                      </td>

                      {/* Адреса */}
                      <td className="p-3 text-muted-foreground max-w-[180px] truncate" title={point.addressStr}>
                        {point.addressStr}
                      </td>

                      {/* Тип ТТ */}
                      <td className="p-3 text-muted-foreground">
                        {point.ttType}
                      </td>

                      {/* Менеджер */}
                      <td className="p-3 text-white/80 whitespace-nowrap">
                        {point.agentName}
                      </td>

                      {/* Присутність ЮНП */}
                      <td className="p-3 text-center">
                        {point.isCooperating ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/15 text-emerald-300 border border-emerald-500/25">
                            Так
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-rose-500/15 text-rose-300 border border-rose-500/25">
                            Ні
                          </span>
                        )}
                      </td>

                      {/* Потенціал */}
                      <td className="p-3 text-center font-mono font-medium text-white/90">
                        {point.totalPP}
                      </td>

                      {/* Продажі ЮНП */}
                      <td className="p-3 text-center font-mono font-medium text-indigo-300">
                        {point.highfoamPP}
                      </td>

                      {/* Фактичні продажі моделі по менеджеру (1С) */}
                      <td className={`p-3 text-center font-mono ${point.actualByManager ? "text-emerald-300 font-medium" : "text-muted-foreground/50"}`}>
                        {formatSales(point.actualByManager)}
                      </td>

                      {/* Фактичні продажі моделі по організації (1С) */}
                      <td className={`p-3 text-center font-mono ${point.actualByOrg ? "text-emerald-300 font-medium" : "text-muted-foreground/50"}`}>
                        {formatSales(point.actualByOrg)}
                      </td>

                      {/* Статус моделі */}
                      <td className="p-3 text-center">
                        {presenceFilter === "present" ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                            <CheckCircle2 className="h-3 w-3" />
                            Присутня
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-rose-500/20 text-rose-300 border border-rose-500/30">
                            <XCircle className="h-3 w-3" />
                            Відсутня
                          </span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-muted-foreground pt-2">
            <div>
              Показано <span className="font-semibold text-white">{displayedPoints.length}</span> із{" "}
              <span className="font-semibold text-white">
                {presenceFilter === "present" ? presentPoints.length : absentPoints.length}
              </span> точок
            </div>
            <div className="italic">
              * Клікніть на будь-яку торгову точку для відкриття детальної картки та історії візитів
            </div>
          </div>
        </div>
      )}

      {/* Point Card Modal */}
      {selectedPointForModal && (
        <PointCardModal
          point={selectedPointForModal}
          allVisits={allVisits}
          allBrands={allBrands}
          onClose={() => setSelectedPointForModal(null)}
        />
      )}
    </div>
  );
}
