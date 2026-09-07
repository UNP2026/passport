import React, { useState, useMemo, useEffect } from "react";
import { createPortal } from "react-dom";
import { useAuth } from "../hooks/useAuth";
import { Navigate } from "react-router-dom";
import { fetchRealAnalyticsData, exportFullRawVisits } from "../api/analytics";
import { AnalyticsFilters } from "../components/analytics/AnalyticsFilters";
import { BrandHeatmap } from "../components/analytics/BrandHeatmap";
import { PointsDetailTable } from "../components/analytics/PointsDetailTable";
import { BrandSummary } from "../components/analytics/BrandSummary";
import { ManagerStatsTable } from "../components/analytics/ManagerStatsTable";
import { BarChart3, Map as MapIcon, Users, TrendingUp, Download, LayoutGrid, List, Store, Package, Loader2, Filter } from "lucide-react";
import * as XLSX from "xlsx";
import ExcelJS from "exceljs";
import { saveAs } from "file-saver";
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
    modelType: "all",
    datePreset: "all",
    dateFrom: "",
    dateTo: ""
  });

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isExporting, setIsExporting] = useState(false);

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      const result = await fetchRealAnalyticsData();
      setData(result);
      setLoading(false);
    }
    loadData();
  }, []);

  const displayBrandNames = useMemo(() => {
    if (!data) return [];
    if (!filters.modelType || filters.modelType === "all") {
      return data.brandNames;
    }
    return data.allBrands
      .filter(b => {
        if (filters.modelType === "highfoam") return b.is_highfoam === true;
        if (filters.modelType === "privat") return b.is_pm === true;
        return true;
      })
      .map(b => b.name);
  }, [data, filters.modelType]);

  const displayBrandsForFilter = useMemo(() => {
    if (!data) return [];
    return data.brands.filter(b => {
      const detail = data.allBrands.find(ab => ab.name === b.name);
      if (!detail) return true;
      if (filters.modelType === "highfoam") return detail.is_highfoam === true;
      if (filters.modelType === "privat") return detail.is_pm === true;
      return true;
    });
  }, [data, filters.modelType]);

  const filteredData = useMemo(() => {
    if (!data) return [];
    return data.raw.filter(d => {
      const cityMatch = filters.city === "all" || d.city === filters.city;
      const agentMatch = filters.agent === "all" || d.agent === filters.agent;
      const brandMatch = filters.brand === "all" || d.brandPresence[filters.brand];
      const pointMatch = filters.point === "all" || d.point === filters.point;
      
      let presenceMatch = true;
      if (filters.presence === "highfoam") {
        presenceMatch = d.isCooperating === true;
      } else if (filters.presence === "competitors") {
        presenceMatch = d.isCooperating === false;
      }
      
      let dateMatch = true;
      if (filters.dateFrom) {
        dateMatch = dateMatch && d.date >= filters.dateFrom;
      }
      if (filters.dateTo) {
        dateMatch = dateMatch && d.date <= filters.dateTo;
      }

      let modelTypeMatch = true;
      if (filters.modelType && filters.modelType !== "all") {
        const allowedBrands = data.allBrands.filter(b => {
          if (filters.modelType === "highfoam") return b.is_highfoam === true;
          if (filters.modelType === "privat") return b.is_pm === true;
          return true;
        }).map(b => b.name);
        
        modelTypeMatch = allowedBrands.some(bn => d.brandPresence[bn] === true);
      }

      return cityMatch && agentMatch && brandMatch && pointMatch && presenceMatch && dateMatch && modelTypeMatch;
    });
  }, [data, filters]);

  const stats = useMemo(() => {
    if (!data) return [];
    const totalVisits = filteredData.length;
    const uniqueCities = new Set(filteredData.map(d => d.city)).size;
    const uniqueTTs = new Set(filteredData.map(d => d.pointId)).size;
    
    const presentBrands = new Set();
    filteredData.forEach(d => {
      Object.entries(d.brandPresence).forEach(([brand, isPresent]) => {
        if (isPresent && displayBrandNames.includes(brand)) presentBrands.add(brand);
      });
    });
    const brandsCount = presentBrands.size;
    
    return [
      { id: 'visits', label: "Всього візитів", value: totalVisits, icon: BarChart3, color: "text-indigo-400" },
      { id: 'cities', label: "Міст охоплено", value: uniqueCities, icon: MapIcon, color: "text-emerald-400" },
      { id: 'tt', label: "Кількість ТТ", value: uniqueTTs, icon: Store, color: "text-amber-400" },
      { id: 'brands', label: "Кількість моделей", value: brandsCount, icon: Package, color: "text-cyan-400" },
    ];
  }, [filteredData, data, displayBrandNames]);

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
    XLSX.writeFile(wb, `analytics_short_${dateStr}.xlsx`);
  };

  const handleExportFull = async () => {
    setIsExporting(true);
    try {
      const { visits, brandsInfo } = await exportFullRawVisits();
      
      if (!visits || visits.length === 0) return;

      // Filter for latest visits that match the active filters on screen
      const filteredVisitIds = new Set(filteredData.map(d => d.id));
      const latestVisits = visits.filter(v => filteredVisitIds.has(v.id));

      // calculate brand presence counts across latestVisits
      const brandCounts = {};
      brandsInfo?.forEach(b => brandCounts[b.name] = 0);

      latestVisits.forEach(v => {
        v.visit_brands?.forEach(vb => {
          if (vb.brand?.name) {
             brandCounts[vb.brand.name] = (brandCounts[vb.brand.name] || 0) + 1;
          }
        });
      });

      // sort brands
      const sortedBrandNames = [...(brandsInfo || [])].sort((a, b) => {
        if (a.is_highfoam && !b.is_highfoam) return -1;
        if (!a.is_highfoam && b.is_highfoam) return 1;
        
        if (a.is_highfoam && b.is_highfoam) { 
           return (brandCounts[b.name] || 0) - (brandCounts[a.name] || 0);
        }

        if (a.is_pm && !b.is_pm) return -1;
        if (!a.is_pm && b.is_pm) return 1;

        return (brandCounts[b.name] || 0) - (brandCounts[a.name] || 0);
      }).map(b => b.name);

      const exportData = latestVisits.flatMap(v => {
        const [cityName, ...oblastParts] = (v.tt?.city || "").split(',').map(s => s.trim());
        const city = cityName || "Невідомо";
        const oblast = oblastParts.join(', ') || "";
        const address = `${v.tt?.street || ''} ${v.tt?.house || ''}`.trim();

        // Calculate category using PP (Потенціальні продажі)
        const totalPP = v.visit_manufacturers?.reduce((acc, vm) => acc + (vm.pp || 0), 0) || 0;
        const highfoamPP = v.visit_manufacturers?.find(vm => vm.manufacturer?.name === "Highfoam")?.pp || 0;
        
        let letter = "";
        if (totalPP > 29) letter = "A";
        else if (totalPP >= 20) letter = "B";
        else if (totalPP >= 10) letter = "C";
        else if (totalPP > 0) letter = "D";
        
        const sharePercent = totalPP > 0 ? (highfoamPP / totalPP) * 100 : 0;
        let number = "";
        if (sharePercent > 49) number = "1";
        else if (sharePercent >= 20) number = "2";
        else if (sharePercent > 0) number = "3";

           
        const category = `${letter}${number}`;
        const totalBrands = v.visit_brands?.filter(vb => vb.brand).length || 0;

        let mfs = v.visit_manufacturers || [];
        if (mfs.length === 0) mfs = [null]; // ensure at least one row

        const hasHighfoamMfg = mfs.some(m => m?.manufacturer?.name === "Highfoam");

        const daysPassed = v.visited_at ? Math.floor((new Date() - new Date(v.visited_at)) / (1000 * 60 * 60 * 24)) : "";

        return mfs.map((vm, index) => {
          const mName = vm?.manufacturer?.name || "";

          let nashaPrysutnist = "";
          if (v.is_cooperating) {
              if (mName === "Highfoam") {
                  nashaPrysutnist = "Так";
              } else if (!hasHighfoamMfg && index === 0) {
                  nashaPrysutnist = "Так";
              }
          } else {
              if (index === 0) nashaPrysutnist = "Ні";
          }

          const row = {
            "ID Візиту": v.id,
            "Дата та час": v.visited_at ? new Date(v.visited_at).toLocaleString('uk-UA') : "—",
            "Днів після візиту": daysPassed,
            "Менеджер": v.author?.full_name || "Невідомий",
            "Категорія точки": category,
            "Код Організації": v.tt?.orgs?.org_code || "",
            "Організація": v.tt?.orgs?.name || "Невідома",
            "Торгова точка": v.tt?.name || "Невідома ТТ",
            "Місто": city,
            "Область": oblast,
            "Адреса": address,
            "Наша присутність": nashaPrysutnist,
            "Тип точки": v.tt_type?.name || "",
            "Тип прайсу": v.price_type?.category || "",
            
            "Виробник": mName,
            "Загальний потенціал точки": totalPP,
            "Наша доля, %": Number(sharePercent.toFixed(0)),
            "Потенційні продажі": vm?.pp ?? "",
            "Кількість місць": vm?.kv ?? "",

            "Ціновий сегмент (Низький) %": v.price_seg_low ?? "",
            "Ціновий сегмент (Середній) %": v.price_seg_mid ?? "",
            "Ціновий сегмент (Високий) %": v.price_seg_high ?? "",
            "Зараз працює": v.is_working ? "Так" : "Ні",
            "Продає подушки": v.sells_pillows ? "Так" : "Ні",
            "Контактна особа": v.contact_name || "",
            "Посада": v.contact_position || "",
            "Телефон": v.contact_phone || "",
            "Опис точки": v.tt_description || "",
            "Результат візиту": v.visit_result_note || "",
            "Сума наявності на вітрині": totalBrands,
          };

          sortedBrandNames.forEach(b => {
             const isPresent = v.visit_brands?.some(vb => vb.brand?.name === b);
             row[`TM ${b}`] = isPresent ? 1 : "";
          });

          return row;
        });
      });

      let rowNum = 1;
      const finalExportData = exportData.map(r => ({ "№": rowNum++, ...r }));

      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet("Візити", {
        views: [{ showGridLines: false }]
      });

      if (finalExportData.length > 0) {
        const columns = Object.keys(finalExportData[0]).map(key => {
          let width = 18;
          if (key === "№") width = 5;
          if (key.startsWith('TM ')) width = 7;
          return { header: key, key: key, width: width };
        });
        worksheet.columns = columns;

        worksheet.addRows(finalExportData);

        // Styling the header row
        const headerRow = worksheet.getRow(1);
        headerRow.height = 80;
        
        headerRow.eachCell((cell, colNumber) => {
          const colKey = columns[colNumber - 1].key;
          
          cell.font = { bold: true };
          cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFDCE6F1' }
          };
          
          cell.alignment = {
             horizontal: 'center',
             vertical: 'middle',
             wrapText: true,
             ...(colKey.startsWith('TM ') ? { textRotation: 90 } : {})
          };
          
          cell.border = {
            top: { style: 'thin' },
            left: { style: 'thin' },
            bottom: { style: 'thin' },
            right: { style: 'thin' }
          };
        });

        // Add auto-filter
        worksheet.autoFilter = {
          from: { row: 1, column: 1 },
          to: { row: 1, column: columns.length }
        };

        // Add borders to all data cells
        worksheet.eachRow((row, rowNumber) => {
          if (rowNumber > 1) { // Skip header
            row.eachCell({ includeEmpty: true }, (cell) => {
              cell.border = {
                top: { style: 'thin' },
                left: { style: 'thin' },
                bottom: { style: 'thin' },
                right: { style: 'thin' }
              };
            });
          }
        });
      }

      // Create second sheet: "Аналіз по моделях"
      const modelWorksheet = workbook.addWorksheet("Аналіз по моделях", {
        views: [{ showGridLines: false }]
      });

      // Sort brands: Highfoam first (by count desc), then Privat (by count desc), then others (by count desc)
      const secondSheetBrands = [...(brandsInfo || [])].sort((a, b) => {
        if (a.is_highfoam && !b.is_highfoam) return -1;
        if (!a.is_highfoam && b.is_highfoam) return 1;
        
        if (a.is_highfoam && b.is_highfoam) { 
           return (brandCounts[b.name] || 0) - (brandCounts[a.name] || 0);
        }

        if (a.is_pm && !b.is_pm) return -1;
        if (!a.is_pm && b.is_pm) return 1;

        return (brandCounts[b.name] || 0) - (brandCounts[a.name] || 0);
      });

      const secondSheetData = secondSheetBrands.map(b => ({
        "Модель": b.name,
        "Кількість точок": brandCounts[b.name] || 0
      }));

      if (secondSheetData.length > 0) {
        const modelColumns = [
          { header: "Модель", key: "Модель", width: 35 },
          { header: "Кількість точок", key: "Кількість точок", width: 20 }
        ];
        modelWorksheet.columns = modelColumns;
        modelWorksheet.addRows(secondSheetData);

        // Style header row of second sheet
        const mHeaderRow = modelWorksheet.getRow(1);
        mHeaderRow.height = 30;
        mHeaderRow.eachCell((cell) => {
          cell.font = { bold: true };
          cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFDCE6F1' }
          };
          cell.alignment = {
            horizontal: 'center',
            vertical: 'middle',
            wrapText: true
          };
          cell.border = {
            top: { style: 'thin' },
            left: { style: 'thin' },
            bottom: { style: 'thin' },
            right: { style: 'thin' }
          };
        });

        // Add auto-filter to second sheet
        modelWorksheet.autoFilter = {
          from: { row: 1, column: 1 },
          to: { row: 1, column: modelColumns.length }
        };

        // Add borders to all data cells in second sheet
        modelWorksheet.eachRow((row, rowNumber) => {
          if (rowNumber > 1) { // Skip header
            row.eachCell({ includeEmpty: true }, (cell) => {
              cell.border = {
                top: { style: 'thin' },
                left: { style: 'thin' },
                bottom: { style: 'thin' },
                right: { style: 'thin' }
              };
            });
          }
        });
      }
      
      const buffer = await workbook.xlsx.writeBuffer();
      const dateStr = new Date().toISOString().split('T')[0];
      saveAs(new Blob([buffer], { type: "application/octet-stream" }), `Звіт по візитах від ${dateStr}.xlsx`);
    } catch (error) {
      console.error("Export Full failed:", error);
    } finally {
      setIsExporting(false);
    }
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
      brands={displayBrandsForFilter}
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
    <div className="flex-1 bg-[#0b1220] text-white p-4 pb-[calc(5rem+env(safe-area-inset-bottom))] md:p-8">
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
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex bg-white/5 p-1 rounded-xl border border-white/10">
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
          <div className="flex items-center gap-2">
            <button 
              onClick={handleExport}
              disabled={!filteredData.length || isExporting}
              className="flex items-center gap-2 bg-indigo-600/20 text-indigo-400 hover:bg-indigo-600 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed px-3 py-2 rounded-xl transition-all font-medium text-sm border border-indigo-500/20 whitespace-nowrap"
            >
              <Download className="h-4 w-4" />
              Коротко
            </button>
            <button 
              onClick={handleExportFull}
              disabled={isExporting}
              className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed px-3 py-2 rounded-xl transition-all font-medium text-sm text-white shadow-lg shadow-indigo-500/20 whitespace-nowrap"
            >
              {isExporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
              Загальний звіт
            </button>
          </div>
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
            brands={displayBrandNames}
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
                    brands={displayBrandNames} 
                    cities={data.cities} 
                    agents={data.agents}
                  />
                </div>
                <div>
                  <BrandSummary 
                    data={filteredData} 
                    brands={displayBrandNames} 
                  />
                </div>
              </div>
            </>
          ) : (
            <PointsDetailTable 
              data={filteredData} 
              brands={displayBrandNames} 
            />
          )}
        </div>
      </div>
    </div>
  );
}
