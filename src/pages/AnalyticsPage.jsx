import React, { useState, useMemo, useEffect } from "react";
import { useAuth } from "../hooks/useAuth";
import { Navigate } from "react-router-dom";
import { fetchRealAnalyticsData, exportFullRawVisits } from "../api/analytics";
import { fetchSales } from "../api/sales";
import { buildSalesIndex, defaultSalesMonths } from "../lib/salesUtils";
import { SalesDiscrepancyReport } from "../components/analytics/SalesDiscrepancyReport";
import { AnalyticsFilters, CompactFilterBar } from "../components/analytics/AnalyticsFilters";
import { MarketStructureByManufacturers } from "../components/analytics/MarketStructureByManufacturers";
import { ManagerResultsTable } from "../components/analytics/ManagerResultsTable";
import { RegionPotentialTable } from "../components/analytics/RegionPotentialTable";
import { GrowthPointsByClientsTable } from "../components/analytics/GrowthPointsByClientsTable";
import { TradePointsTable } from "../components/analytics/TradePointsTable";
import { PointsDetailTable } from "../components/analytics/PointsDetailTable";
import { BrandSummary } from "../components/analytics/BrandSummary";
import { ModelAnalysisReport } from "../components/analytics/ModelAnalysisReport";
import { ManagerStatsTable } from "../components/analytics/ManagerStatsTable";
import { ALL_MAIN_ORG_CODES, getRowMainOrgCode } from "../lib/mainOrgs";
import { exportShortReport } from "../lib/exportShortReport";
import { 
  BarChart3, 
  MapPin, 
  Store, 
  Package, 
  Loader2, 
  Download, 
  FilterX, 
  TrendingUp,
  CalendarCheck,
  BedDouble,
  Receipt
} from "lucide-react";
import * as XLSX from "xlsx";
import ExcelJS from "exceljs";
import { saveAs } from "file-saver";

export function AnalyticsPage() {
  const { user, profile, authLoading } = useAuth();
  
  const isAdminOrHead = profile?.role === "admin" || profile?.role === "head";
  const isSales = profile?.role === "sales" || profile?.role === "agent" || (!isAdminOrHead && !!profile);
  const canAccess = isAdminOrHead || profile?.role === "sales" || profile?.role === "agent";
  const currentUserId = profile?.user_id || user?.id;

  // Switch: "analytics" (Ключова аналітика) | "models" (Аналіз по моделях) | "sales" (Аналіз фактичних продаж)
  const [viewMode, setViewMode] = useState("analytics");
  const [activeStat, setActiveStat] = useState(null); // visits, cities, tt, presence

  // Universal Multiselect Filters
  const [filters, setFilters] = useState({
    period: { preset: null, startDate: null, endDate: null },
    mainOrgs: ALL_MAIN_ORG_CODES,
    managers: [],
    orgs: [],
    points: [],
    oblasts: [],
    cities: [],
    manufacturers: [],
    categories: [],
    ttTypes: [],
    hfModels: [],
    pmModels: [],
    presence: "all", // "all" | "yes" | "no"
    salesMonths: [], // Період продаж: ["2026-10"] або діапазон місяців (→ середнє за місяць)
  });

  const [data, setData] = useState(null);
  // Фактичні продажі з IT-Enterprise (sales_v)
  const [sales, setSales] = useState({ rows: [], months: [] });
  const [loading, setLoading] = useState(true);
  const [isExporting, setIsExporting] = useState(false);
  const [isExportingShort, setIsExportingShort] = useState(false);

  // Компактна смуга фільтрів: показуємо, коли повна панель пішла за верхній край екрана
  const [filtersPanelEl, setFiltersPanelEl] = useState(null);
  const [showCompactBar, setShowCompactBar] = useState(false);
  useEffect(() => {
    if (!filtersPanelEl) return;
    const obs = new IntersectionObserver(
      ([entry]) => setShowCompactBar(!entry.isIntersecting && entry.boundingClientRect.top < 0),
      { threshold: 0 }
    );
    obs.observe(filtersPanelEl);
    return () => obs.disconnect();
  }, [filtersPanelEl]);

  useEffect(() => {
    async function loadData() {
      if (!profile && authLoading) return;
      setLoading(true);
      const isSalesOnly = !isAdminOrHead;
      const result = await fetchRealAnalyticsData({
        userId: currentUserId,
        isSalesOnly,
      });
      setData(result);
      setLoading(false);
    }
    async function loadSales() {
      const res = await fetchSales();
      setSales({ rows: res.rows, months: res.months });
      // За замовчуванням — останній місяць, за який є продажі
      setFilters(prev => (prev.salesMonths?.length ? prev : { ...prev, salesMonths: defaultSalesMonths(res.months) }));
    }
    if (!authLoading) {
      loadData();
      loadSales();
    }
  }, [currentUserId, profile, authLoading, isAdminOrHead]);

  const handleResetFilters = () => {
    setFilters({
      period: { preset: null, startDate: null, endDate: null },
      mainOrgs: ALL_MAIN_ORG_CODES,
      managers: [],
      orgs: [],
      points: [],
      oblasts: [],
      cities: [],
      manufacturers: [],
      categories: [],
      ttTypes: [],
      hfModels: [],
      pmModels: [],
      presence: "all",
      salesMonths: defaultSalesMonths(sales.months),
    });
  };

  // Фактичні продажі з урахуванням фільтрів, що до них застосовні:
  // Менеджер, Організація, Торгова точка (→ організація ТТ), Основні організації, Моделі Highfoam / Privat.
  // (Область, місто, тип, категорія, присутність — це дані візитів, у продажах IT-Enterprise їх немає.)
  const salesFilterLabels = useMemo(() => {
    const l = [];
    if (filters.managers?.length) l.push("Менеджер");
    if (filters.orgs?.length) l.push("Організація");
    if (filters.points?.length) l.push("Торгова точка (організація ТТ)");
    if (filters.mainOrgs && filters.mainOrgs.length < ALL_MAIN_ORG_CODES.length) l.push("Основні організації");
    if (filters.hfModels?.length) l.push("Моделі Highfoam");
    if (filters.pmModels?.length) l.push("Моделі Privat");
    return l;
  }, [filters.managers, filters.orgs, filters.points, filters.mainOrgs, filters.hfModels, filters.pmModels]);

  // Фільтр «Торгова точка» → продажі організацій, за якими закріплені обрані ТТ
  const pointOrgCodes = useMemo(() => {
    if (!filters.points?.length) return null;
    const pts = new Set(filters.points);
    return new Set((data?.raw || []).filter(d => pts.has(d.point) && d.orgCode).map(d => d.orgCode));
  }, [filters.points, data?.raw]);

  const filteredSalesRows = useMemo(() => {
    const norm = (x) => (x || "").trim().toLowerCase();
    const mgr = new Set((filters.managers || []).map(norm));
    const orgs = new Set(filters.orgs || []);
    const models = new Set([...(filters.hfModels || []), ...(filters.pmModels || [])]);
    const mainOrgsActive = filters.mainOrgs && filters.mainOrgs.length < ALL_MAIN_ORG_CODES.length;
    return sales.rows.filter(r => {
      if (mgr.size && !mgr.has(norm(r.manager_name))) return false;
      if (orgs.size && !(r.org_in_crm && orgs.has(r.org_name))) return false;
      if (pointOrgCodes && !pointOrgCodes.has(r.org_code)) return false;
      if (mainOrgsActive) {
        const code = getRowMainOrgCode({ orgCode: r.org_code, org: r.org_name });
        if (code && !filters.mainOrgs.includes(code)) return false;
      }
      if (models.size && !(r.model_in_crm && models.has(r.brand_name))) return false;
      return true;
    });
  }, [sales.rows, filters.managers, filters.orgs, pointOrgCodes, filters.mainOrgs, filters.hfModels, filters.pmModels]);

  // Індекс фактичних продажів за обраний період (середнє за місяць)
  const salesIndex = useMemo(
    () => buildSalesIndex(filteredSalesRows, filters.salesMonths || []),
    [filteredSalesRows, filters.salesMonths]
  );

  // Automatically prune orgs or points that belong to a disabled main organization so they don't conflict
  useEffect(() => {
    if (!data?.raw) return;
    setFilters(prev => {
      if (!prev.mainOrgs || prev.mainOrgs.length === ALL_MAIN_ORG_CODES.length) return prev;
      let changed = false;
      const newOrgs = (prev.orgs || []).filter(o => {
        const rows = data.raw.filter(d => d.org === o);
        if (rows.length > 0 && rows.every(d => {
          const code = getRowMainOrgCode(d);
          return code && !prev.mainOrgs.includes(code);
        })) {
          changed = true;
          return false;
        }
        return true;
      });

      const newPoints = (prev.points || []).filter(p => {
        const rows = data.raw.filter(d => d.point === p);
        if (rows.length > 0 && rows.every(d => {
          const code = getRowMainOrgCode(d);
          return code && !prev.mainOrgs.includes(code);
        })) {
          changed = true;
          return false;
        }
        return true;
      });

      if (!changed) return prev;
      return { ...prev, orgs: newOrgs, points: newPoints };
    });
  }, [filters.mainOrgs, data?.raw]);

  // Faceted filtering logic: calculate filteredData, countsData, optionsData, and visitsCountByDate
  const { filteredData, countsData, optionsData, visitsCountByDate } = useMemo(() => {
    if (!data?.raw) {
      return {
        filteredData: [],
        countsData: {
          mainOrgs: {},
          managers: {},
          orgs: {},
          points: {},
          oblasts: {},
          cities: {},
          manufacturers: {},
          categories: {},
          ttTypes: {},
          hfModels: {},
          pmModels: {},
          presence: { all: 0, yes: 0, no: 0 }
        },
        optionsData: {
          managers: [],
          orgs: [],
          points: [],
          oblasts: [],
          cities: [],
          manufacturers: [],
          categories: ["A", "B", "C", "D"],
          ttTypes: [],
          hfModels: [],
          pmModels: [],
        },
        visitsCountByDate: {}
      };
    }

    const list = data.raw;

    // Map of latest visit for each unique trade point (list is already sorted by visited_at DESC)
    const latestVisitsByTt = new Map();
    list.forEach(d => {
      const ttKey = d.ttKey || `${d.org}:::${d.point}:::${d.address}`;
      if (!latestVisitsByTt.has(ttKey)) {
        latestVisitsByTt.set(ttKey, d);
      }
    });

    // Predicates for each individual filter
    const testMainOrg = (d) => {
      if (!filters.mainOrgs || filters.mainOrgs.length === ALL_MAIN_ORG_CODES.length) return true;
      const code = getRowMainOrgCode(d);
      if (!code) return true; // independent organization, not excluded
      return filters.mainOrgs.includes(code);
    };

    const testDate = (d) => {
      if (!filters.period?.startDate && !filters.period?.endDate) return true;
      const rowDate = d.date && d.date !== "—" 
        ? d.date 
        : (d.visitedAt ? new Date(d.visitedAt).toISOString().split('T')[0] : null);
      if (!rowDate) return true;
      if (filters.period.startDate && rowDate < filters.period.startDate) return false;
      if (filters.period.endDate && rowDate > filters.period.endDate) return false;
      return true;
    };

    const testMgr = (d) => {
      if (isSales) {
        if (currentUserId && d.authorUserId) {
          return d.authorUserId === currentUserId;
        }
        if (profile?.full_name) {
          return (d.agent || "").trim().toLowerCase() === profile.full_name.trim().toLowerCase();
        }
        return true;
      }
      return filters.managers.length === 0 || filters.managers.includes(d.agent);
    };
    const testOrg = (d) => filters.orgs.length === 0 || filters.orgs.includes(d.org);
    const testPt = (d) => filters.points.length === 0 || filters.points.includes(d.point);
    const testObl = (d) => filters.oblasts.length === 0 || filters.oblasts.includes(d.oblast);
    const testCity = (d) => filters.cities.length === 0 || filters.cities.includes(d.city);
    const testMf = (d) => filters.manufacturers.length === 0 || (d.manufacturers || []).some(m => filters.manufacturers.includes(m));
    const testCat = (d) => filters.categories.length === 0 || filters.categories.includes(d.category);
    const testType = (d) => filters.ttTypes.length === 0 || filters.ttTypes.includes(d.ttType);
    const hfSel = filters.hfModels || [];
    const pmSel = filters.pmModels || [];
    const testHf = (d) => hfSel.length === 0 || (d.hfModels || []).some(m => hfSel.includes(m));
    const testPm = (d) => pmSel.length === 0 || (d.pmModels || []).some(m => pmSel.includes(m));
    const testPres = (d) => {
      const ttKey = d.ttKey || `${d.org}:::${d.point}:::${d.address}`;
      const latest = latestVisitsByTt.get(ttKey);
      const isCoop = latest ? latest.isCooperating === true : d.isCooperating === true;
      if (filters.presence === "yes") return isCoop === true;
      if (filters.presence === "no") return isCoop === false;
      return true;
    };

    // 1. Calculate final filteredData (matches ALL filters including period and mainOrgs)
    const filtered = list.filter(d => 
      testDate(d) &&
      testMainOrg(d) &&
      testMgr(d) && testOrg(d) && testPt(d) && testObl(d) && testCity(d) && 
      testMf(d) && testCat(d) && testType(d) && testHf(d) && testPm(d) && testPres(d)
    );

    // 2. Faceted counts for each directory (matches all OTHER filters)
    // Rule: For all filters, count the number of UNIQUE visits (unique trade points: ttKey).
    // EXCEPT for Торгова точка (points), where count is the TOTAL number of visits to that TT.
    const managerSets = {};
    const orgSets = {};
    const pointVisitsCount = {}; // ОБЩЕЕ количество визитов для каждой ТТ
    const oblastSets = {};
    const citySets = {};
    const manufacturerSets = {};
    const categorySets = {};
    const ttTypeSets = {};
    const presenceSets = { all: new Set(), yes: new Set(), no: new Set() };
    const mainOrgSets = {};
    ALL_MAIN_ORG_CODES.forEach(code => {
      mainOrgSets[code] = new Set();
    });

    // Count of visits on each date matching other filters (for calendar badges)
    const visitsCountByDate = {};

    list.forEach(d => {
      const passPres = testPres(d);
      const ttKey = d.ttKey || `${d.org}:::${d.point}:::${d.address}`;
      const passDate = testDate(d);
      const passMain = testMainOrg(d);
      const passCommon = passDate && passMain && passPres;

      // Calendar dates: visits count matching all filters EXCEPT the date filter
      const rowDate = d.date && d.date !== "—" 
        ? d.date 
        : (d.visitedAt ? new Date(d.visitedAt).toISOString().split('T')[0] : null);
      if (rowDate) {
        if (passMain && testMgr(d) && testOrg(d) && testPt(d) && testObl(d) && testCity(d) && testMf(d) && testCat(d) && testType(d) && testHf(d) && testPm(d) && passPres) {
          visitsCountByDate[rowDate] = (visitsCountByDate[rowDate] || 0) + 1;
        }
      }

      // Main Organizations: all except mainOrg filter -> UNIQUE visits (TTs)
      const rowMainCode = getRowMainOrgCode(d);
      if (rowMainCode && mainOrgSets[rowMainCode]) {
        if (passDate && testMgr(d) && testOrg(d) && testPt(d) && testObl(d) && testCity(d) && testMf(d) && testCat(d) && testType(d) && testHf(d) && testPm(d) && passPres) {
          mainOrgSets[rowMainCode].add(ttKey);
        }
      }

      // Managers: all except manager filter -> UNIQUE visits (TTs)
      if (passCommon && testOrg(d) && testPt(d) && testObl(d) && testCity(d) && testMf(d) && testCat(d) && testType(d) && testHf(d) && testPm(d)) {
        if (d.agent) {
          if (!managerSets[d.agent]) managerSets[d.agent] = new Set();
          managerSets[d.agent].add(ttKey);
        }
      }

      // Orgs: all except org filter -> UNIQUE visits (TTs)
      if (passCommon && testMgr(d) && testPt(d) && testObl(d) && testCity(d) && testMf(d) && testCat(d) && testType(d) && testHf(d) && testPm(d)) {
        if (d.org) {
          if (!orgSets[d.org]) orgSets[d.org] = new Set();
          orgSets[d.org].add(ttKey);
        }
      }

      // Points: all except point filter -> ОБЩЕЕ кол-во визитов в эту ТТ
      if (passCommon && testMgr(d) && testOrg(d) && testObl(d) && testCity(d) && testMf(d) && testCat(d) && testType(d) && testHf(d) && testPm(d)) {
        if (d.point) {
          pointVisitsCount[d.point] = (pointVisitsCount[d.point] || 0) + 1;
        }
      }

      // Oblasts: all except oblast filter -> UNIQUE visits (TTs)
      if (passCommon && testMgr(d) && testOrg(d) && testPt(d) && testCity(d) && testMf(d) && testCat(d) && testType(d) && testHf(d) && testPm(d)) {
        if (d.oblast) {
          if (!oblastSets[d.oblast]) oblastSets[d.oblast] = new Set();
          oblastSets[d.oblast].add(ttKey);
        }
      }

      // Cities: all except city filter -> UNIQUE visits (TTs)
      if (passCommon && testMgr(d) && testOrg(d) && testPt(d) && testObl(d) && testMf(d) && testCat(d) && testType(d) && testHf(d) && testPm(d)) {
        if (d.city) {
          if (!citySets[d.city]) citySets[d.city] = new Set();
          citySets[d.city].add(ttKey);
        }
      }

      // Manufacturers: all except manufacturer filter -> UNIQUE visits (TTs)
      if (passCommon && testMgr(d) && testOrg(d) && testPt(d) && testObl(d) && testCity(d) && testCat(d) && testType(d) && testHf(d) && testPm(d)) {
        (d.manufacturers || []).forEach(m => {
          if (!manufacturerSets[m]) manufacturerSets[m] = new Set();
          manufacturerSets[m].add(ttKey);
        });
      }

      // Categories: all except category filter -> UNIQUE visits (TTs)
      if (passCommon && testMgr(d) && testOrg(d) && testPt(d) && testObl(d) && testCity(d) && testMf(d) && testType(d) && testHf(d) && testPm(d)) {
        if (d.category) {
          if (!categorySets[d.category]) categorySets[d.category] = new Set();
          categorySets[d.category].add(ttKey);
        }
      }

      // TT Types: all except ttType filter -> UNIQUE visits (TTs)
      if (passCommon && testMgr(d) && testOrg(d) && testPt(d) && testObl(d) && testCity(d) && testMf(d) && testCat(d) && testHf(d) && testPm(d)) {
        if (d.ttType) {
          if (!ttTypeSets[d.ttType]) ttTypeSets[d.ttType] = new Set();
          ttTypeSets[d.ttType].add(ttKey);
        }
      }
    });

    // Моделі Highfoam / Privat: усі фільтри, крім власного -> УНІКАЛЬНІ ТТ
    const hfModelSets = {};
    const pmModelSets = {};
    list.forEach(d => {
      const ttKey = d.ttKey || `${d.org}:::${d.point}:::${d.address}`;
      const base = testDate(d) && testMainOrg(d) && testPres(d) && testMgr(d) && testOrg(d) && testPt(d) &&
        testObl(d) && testCity(d) && testMf(d) && testCat(d) && testType(d);
      if (!base) return;
      if (testPm(d)) {
        (d.hfModels || []).forEach(m => {
          if (!hfModelSets[m]) hfModelSets[m] = new Set();
          hfModelSets[m].add(ttKey);
        });
      }
      if (testHf(d)) {
        (d.pmModels || []).forEach(m => {
          if (!pmModelSets[m]) pmModelSets[m] = new Set();
          pmModelSets[m].add(ttKey);
        });
      }
    });

    // Presence counts: calculated by LATEST visit of each unique TT (matches all other filters)
    latestVisitsByTt.forEach((latestD, ttKey) => {
      if (testDate(latestD) && testMainOrg(latestD) && testMgr(latestD) && testOrg(latestD) && testPt(latestD) && testObl(latestD) && testCity(latestD) && testMf(latestD) && testCat(latestD) && testType(latestD) && testHf(latestD) && testPm(latestD)) {
        presenceSets.all.add(ttKey);
        if (latestD.isCooperating === true) presenceSets.yes.add(ttKey);
        if (latestD.isCooperating === false) presenceSets.no.add(ttKey);
      }
    });

    const setCounts = (mapOfSets) => {
      const res = {};
      Object.keys(mapOfSets).forEach(k => {
        res[k] = mapOfSets[k].size;
      });
      return res;
    };

    const mainOrgsCounts = {};
    ALL_MAIN_ORG_CODES.forEach(code => {
      mainOrgsCounts[code] = mainOrgSets[code]?.size || 0;
    });

    const counts = {
      mainOrgs: mainOrgsCounts,
      managers: setCounts(managerSets),
      orgs: setCounts(orgSets),
      points: pointVisitsCount,
      oblasts: setCounts(oblastSets),
      cities: setCounts(citySets),
      manufacturers: setCounts(manufacturerSets),
      categories: setCounts(categorySets),
      ttTypes: setCounts(ttTypeSets),
      hfModels: setCounts(hfModelSets),
      pmModels: setCounts(pmModelSets),
      presence: {
        all: presenceSets.all.size,
        yes: presenceSets.yes.size,
        no: presenceSets.no.size
      }
    };

    // Explicit mutual exclusion between Highfoam and Presence "no":
    const isHfSelected = (filters.manufacturers || []).some(
      m => m.trim().toLowerCase() === "highfoam"
    );
    if (isHfSelected) {
      counts.presence.no = 0;
    }
    if (filters.presence === "no") {
      Object.keys(counts.manufacturers).forEach(m => {
        if (m.trim().toLowerCase() === "highfoam") {
          delete counts.manufacturers[m];
        }
      });
    }

    // Helper to extract mutually exclusive options:
    const buildOptions = (fullList, countsMap, selectedList) => {
      const availableSet = new Set(
        Object.keys(countsMap).filter(k => countsMap[k] > 0)
      );
      (selectedList || []).forEach(val => availableSet.add(val));
      return (fullList || []).filter(item => {
        const val = typeof item === "string" ? item : item.value;
        return availableSet.has(val);
      });
    };

    // Check if an organization or point belongs to a disabled main organization
    const isMainOrgDisabledForRow = (d) => {
      const code = getRowMainOrgCode(d);
      if (!code) return false;
      return !filters.mainOrgs.includes(code);
    };

    // Filter orgs options so that disabled main orgs never appear
    const rawOrgOptions = buildOptions(data.orgs || [], counts.orgs, filters.orgs);
    const filteredOrgOptions = rawOrgOptions.filter(orgItem => {
      const orgVal = typeof orgItem === "string" ? orgItem : orgItem.value;
      const rows = list.filter(d => d.org === orgVal);
      if (rows.length > 0 && rows.every(isMainOrgDisabledForRow)) {
        return false;
      }
      return true;
    });

    // Filter points options so that disabled main orgs' points never appear
    const rawPointOptions = buildOptions(data.points || [], counts.points, filters.points);
    const filteredPointOptions = rawPointOptions.filter(ptItem => {
      const ptVal = typeof ptItem === "string" ? ptItem : ptItem.value;
      const rows = list.filter(d => d.point === ptVal);
      if (rows.length > 0 && rows.every(isMainOrgDisabledForRow)) {
        return false;
      }
      return true;
    });

    const options = {
      managers: buildOptions(data.agents || [], counts.managers, filters.managers),
      orgs: filteredOrgOptions,
      points: filteredPointOptions,
      oblasts: buildOptions(data.oblasts || [], counts.oblasts, filters.oblasts),
      cities: buildOptions(data.cities || [], counts.cities, filters.cities),
      manufacturers: buildOptions(data.manufacturers || [], counts.manufacturers, filters.manufacturers).filter(m => {
        if (filters.presence === "no") {
          const val = typeof m === "string" ? m : m.value;
          return val.trim().toLowerCase() !== "highfoam";
        }
        return true;
      }),
      categories: buildOptions(data.categories || ["A", "B", "C", "D"], counts.categories, filters.categories),
      ttTypes: buildOptions(data.ttTypes || [], counts.ttTypes, filters.ttTypes),
      hfModels: buildOptions(data.hfModels || [], counts.hfModels, hfSel),
      pmModels: buildOptions(data.pmModels || [], counts.pmModels, pmSel),
    };

    return { 
      filteredData: filtered, 
      countsData: counts, 
      optionsData: options,
      visitsCountByDate 
    };
  }, [data, filters, isSales, currentUserId, profile?.full_name]);

  // Brand names
  const displayBrandNames = useMemo(() => {
    return data?.brandNames || [];
  }, [data]);

  // Extract the latest visit for each unique trade point (uniqueness by Org + Point + Address)
  const latestFilteredVisits = useMemo(() => {
    const seenTtKeys = new Set();
    const result = [];
    // filteredData preserves descending order of visited_at
    for (const v of filteredData) {
      const key = v.ttKey || `${v.org}:::${v.point}:::${v.address}`;
      if (!seenTtKeys.has(key)) {
        seenTtKeys.add(key);
        result.push(v);
      }
    }
    return result;
  }, [filteredData]);

  // 5 KPI Statistics Cards
  const keyStats = useMemo(() => {
    if (!data) return [];

    // 1. ВІЗИТИ: загальна к-ть та к-ть унікальних візитів (унікальних ТТ)
    const totalVisits = filteredData.length;
    const uniqueVisits = latestFilteredVisits.length;

    // 2. ТОРГОВІ ТОЧКИ: загальна к-ть унікальних точок, к-ть де нас немає та частка присутності в %
    const totalPoints = latestFilteredVisits.length;
    const pointsWithUs = latestFilteredVisits.filter(d => d.isCooperating).length;
    const pointsWithoutUs = latestFilteredVisits.filter(d => !d.isCooperating).length;
    const presenceSharePct = totalPoints > 0 ? Math.round((pointsWithUs / totalPoints) * 100) : 0;

    // 3. ОХВАТ: к-ть унікальних областей та міст
    const uniqueOblasts = new Set(filteredData.map(d => d.oblast).filter(Boolean)).size;
    const uniqueCities = new Set(filteredData.map(d => d.city).filter(Boolean)).size;

    // 4. ПРОДАЖІ (тільки з останніх візитів):
    // загальний потенціал ринку, наші продажі (Highfoam), частка в %, потенціал росту
    const marketPotential = latestFilteredVisits.reduce((acc, d) => acc + (d.totalPP || 0), 0);
    const ourSales = latestFilteredVisits.reduce((acc, d) => acc + (d.highfoamPP || 0), 0);
    const salesSharePct = marketPotential > 0 ? ((ourSales / marketPotential) * 100).toFixed(1) : "0";
    const growthPotential = Math.max(0, marketPotential - ourSales);

    // 5. К-ТЬ СПАЛЬНИХ МІСЦЬ (тільки з останніх візитів):
    // загальна к-ть, зайнято нами (Highfoam), частка в %
    const totalSleepingPlaces = latestFilteredVisits.reduce((acc, d) => acc + (d.totalKV || 0), 0);
    const ourSleepingPlaces = latestFilteredVisits.reduce((acc, d) => acc + (d.highfoamKV || 0), 0);
    const placesSharePct = totalSleepingPlaces > 0 ? ((ourSleepingPlaces / totalSleepingPlaces) * 100).toFixed(1) : "0";

    return [
      {
        id: 'visits',
        title: "Візити",
        icon: CalendarCheck,
        color: "text-indigo-400 bg-indigo-500/10 border-indigo-500/20",
        mainValue: totalVisits.toLocaleString('uk-UA'),
        mainLabel: "Всього візитів",
        metrics: [
          { label: "Унікальних візитів", value: `${uniqueVisits.toLocaleString('uk-UA')}` }
        ]
      },
      {
        id: 'points',
        title: "Торгові точки",
        icon: Store,
        color: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
        mainValue: `${presenceSharePct}%`,
        mainLabel: "Частка присутності ЮНП",
        metrics: [
          { label: "Всього торгових точок", value: `${totalPoints.toLocaleString('uk-UA')}` },
          { label: "Без присутності ЮНП", value: `${pointsWithoutUs.toLocaleString('uk-UA')}`, alert: pointsWithoutUs > 0 }
        ]
      },
      {
        id: 'coverage',
        title: "Охоплення території",
        icon: MapPin,
        color: "text-cyan-400 bg-cyan-500/10 border-cyan-500/20",
        mainValue: `${uniqueCities.toLocaleString('uk-UA')} міст`,
        mainLabel: "Охоплено міст",
        metrics: [
          { label: "Охоплено областей", value: `${uniqueOblasts.toLocaleString('uk-UA')} обл.` }
        ]
      },
      {
        id: 'sales',
        title: "Потенціал та продажі",
        icon: TrendingUp,
        color: "text-amber-400 bg-amber-500/10 border-amber-500/20",
        mainValue: `${ourSales.toLocaleString('uk-UA')} шт`,
        mainLabel: `Продажі ЮНП (${salesSharePct}%)`,
        metrics: [
          { label: "Потенціал ринку", value: `${marketPotential.toLocaleString('uk-UA')} шт` },
          { label: "Потенціал росту", value: `+${growthPotential.toLocaleString('uk-UA')} шт`, highlight: true }
        ]
      },
      {
        id: 'places',
        title: "Спальні місця",
        icon: BedDouble,
        color: "text-violet-400 bg-violet-500/10 border-violet-500/20",
        mainValue: `${ourSleepingPlaces.toLocaleString('uk-UA')} шт`,
        mainLabel: `Зайнято ЮНП`,
        metrics: [
          { label: "Всього зайнятих місць", value: `${totalSleepingPlaces.toLocaleString('uk-UA')} шт` },
          { label: "Частка ЮНП", value: `${placesSharePct}%` }
        ]
      }
    ];
  }, [filteredData, latestFilteredVisits, data]);

  const handleStatClick = (statId) => {
    if (activeStat === statId) {
      setActiveStat(null);
    } else {
      setActiveStat(statId);
    }
  };

  const handleExport = async () => {
    if (!data || !filteredData.length || isExportingShort) return;
    setIsExportingShort(true);
    try {
      await exportShortReport({
        data,
        latestFilteredVisits,
        keyStats,
        filters,
        isSales,
        currentUserName: profile?.full_name,
      });
    } catch (err) {
      console.error("Export short report failed:", err);
    } finally {
      setIsExportingShort(false);
    }
  };

  const handleExportFull = async () => {
    setIsExporting(true);
    try {
      const { visits, brandsInfo } = await exportFullRawVisits({
        userId: currentUserId,
        isSalesOnly: isSales,
      });
      
      if (!visits || visits.length === 0) return;

      // Filter for latest visits that match the active filters on screen
      const filteredVisitIds = new Set(filteredData.map(d => d.id));
      const latestVisits = visits.filter(v => filteredVisitIds.has(v.id));

      // Filter for all visits that match active filters on screen (without 1-per-TT constraint)
      const allFilteredVisits = visits.filter(v => {
        const [cityName, ...oblastParts] = (v.tt?.city || "").split(',').map(s => s.trim());
        const city = cityName || "Невідомо";
        const oblast = oblastParts.join(', ') || "Не вказано";
        const org = v.tt?.orgs?.name || "Без організації";
        const point = v.tt?.name || "Невідома ТТ";
        const agent = v.author?.full_name || "Невідомий";
        const ttType = v.tt_type?.name || "Не вказано";

        const totalPP = v.visit_manufacturers?.reduce((acc, vm) => acc + (vm.pp || 0), 0) || 0;
        let category = "—";
        if (totalPP > 29) category = "A";
        else if (totalPP >= 20) category = "B";
        else if (totalPP >= 10) category = "C";
        else if (totalPP > 0) category = "D";

        const mfs = (v.visit_manufacturers || []).map(vm => vm.manufacturer?.name).filter(Boolean);

        if (filters.managers?.length && !filters.managers.includes(agent)) return false;
        if (filters.orgs?.length && !filters.orgs.includes(org)) return false;
        if (filters.points?.length && !filters.points.includes(point)) return false;
        if (filters.oblasts?.length && !filters.oblasts.includes(oblast)) return false;
        if (filters.cities?.length && !filters.cities.includes(city)) return false;
        if (filters.manufacturers?.length && !mfs.some(m => filters.manufacturers.includes(m))) return false;
        if (filters.categories?.length && !filters.categories.includes(category)) return false;
        if (filters.ttTypes?.length && !filters.ttTypes.includes(ttType)) return false;
        const visitBrandNames = (v.visit_brands || []).map(vb => vb.brand?.name).filter(Boolean);
        if (filters.hfModels?.length && !visitBrandNames.some(b => filters.hfModels.includes(b))) return false;
        if (filters.pmModels?.length && !visitBrandNames.some(b => filters.pmModels.includes(b))) return false;
        if (filters.presence === "yes" && !v.is_cooperating) return false;
        if (filters.presence === "no" && v.is_cooperating) return false;

        return true;
      });

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

      const cleanBrandNames = sortedBrandNames.map(b => b.replace(/^ТМ\s+/i, '').trim());
      const brandNameSet = new Set(cleanBrandNames);

      const formatOnlyDate = (d) => {
        if (!d) return "—";
        try {
          const dt = new Date(d);
          if (isNaN(dt.getTime())) return d;
          return dt.toLocaleDateString('uk-UA');
        } catch {
          return d;
        }
      };

      const workbook = new ExcelJS.Workbook();

      const addVisitsWorksheet = (sheetTitle, visitItems) => {
        const worksheet = workbook.addWorksheet(sheetTitle, {
          views: [{ showGridLines: false }]
        });

        const exportData = visitItems.flatMap(v => {
          const [cityName, ...oblastParts] = (v.tt?.city || "").split(',').map(s => s.trim());
          const city = cityName || "Невідомо";
          const oblast = oblastParts.join(', ') || "";
          const address = `${v.tt?.street || ''} ${v.tt?.house || ''}`.trim();

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
              "Дата": formatOnlyDate(v.visited_at),
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
              "Фактичні продажі по організації": "",
              "Фактичні продажі по менеджеру": "",
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
               const cleanHeader = b.replace(/^ТМ\s+/i, '').trim();
               row[cleanHeader] = isPresent ? 1 : "";
            });

            return row;
          });
        });

        let rowNum = 1;
        const finalExportData = exportData.map(r => ({ "№": rowNum++, ...r }));

        if (finalExportData.length > 0) {
          const columns = Object.keys(finalExportData[0]).map(key => {
            let width = 18;
            if (key === "№") width = 5;
            if (brandNameSet.has(key)) width = 7;
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
               ...(brandNameSet.has(colKey) ? { textRotation: 90 } : {})
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
            if (rowNumber > 1) {
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
      };

      // 1. Sheet "Останні візити"
      addVisitsWorksheet("Останні візити", latestVisits);

      // 2. Sheet "Всі візити"
      addVisitsWorksheet("Всі візити", allFilteredVisits);
      
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

  if (!canAccess) {
    return <Navigate to="/app/surveys/start" replace />;
  }

  return (
    <div className="flex-1 bg-[#0b1220] text-white p-4 pb-[calc(5rem+env(safe-area-inset-bottom))] md:p-8">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Аналітика ринку</h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
            {isSales 
              ? "Аналіз ваших торгових точок, візитів та присутності продукції" 
              : "Аналіз присутності продукції та показників торгових точок"}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Main Switcher: Ключова аналітика / Аналіз по моделях */}
          <div className="flex bg-slate-200/70 dark:bg-white/5 p-1 rounded-xl border border-slate-300 dark:border-white/10 shadow-inner">
            <button 
              type="button"
              onClick={() => setViewMode("analytics")}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                viewMode === 'analytics' 
                  ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30' 
                  : 'text-slate-600 hover:text-slate-900 dark:text-muted-foreground dark:hover:text-white'
              }`}
            >
              <BarChart3 className="h-3.5 w-3.5" />
              <span>Ключова аналітика</span>
            </button>
            <button 
              type="button"
              onClick={() => setViewMode("models")}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                viewMode === 'models' 
                  ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30' 
                  : 'text-slate-600 hover:text-slate-900 dark:text-muted-foreground dark:hover:text-white'
              }`}
            >
              <Package className="h-3.5 w-3.5" />
              <span>Аналіз по моделях</span>
            </button>
            <button 
              type="button"
              onClick={() => setViewMode("sales")}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                viewMode === 'sales' 
                  ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30' 
                  : 'text-slate-600 hover:text-slate-900 dark:text-muted-foreground dark:hover:text-white'
              }`}
            >
              <Receipt className="h-3.5 w-3.5" />
              <span>Аналіз фактичних продаж</span>
            </button>
          </div>

          {/* Export buttons */}
          <div className="flex items-center gap-2">
            <button 
              type="button"
              onClick={handleExport}
              disabled={!filteredData.length || isExporting || isExportingShort}
              className="flex items-center gap-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 dark:bg-indigo-600/20 dark:text-indigo-400 dark:hover:bg-indigo-600 dark:hover:text-white disabled:opacity-50 disabled:cursor-not-allowed px-3 py-2 rounded-xl transition-all font-medium text-xs border border-indigo-200 dark:border-indigo-500/20 whitespace-nowrap shadow-sm"
            >
              {isExportingShort ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
              <span>Коротко</span>
            </button>
            <button 
              type="button"
              onClick={handleExportFull}
              disabled={isExporting || isExportingShort}
              className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed px-3 py-2 rounded-xl transition-all font-medium text-xs text-white shadow-lg shadow-indigo-500/20 whitespace-nowrap"
            >
              {isExporting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
              <span>Загальний звіт</span>
            </button>
          </div>
        </div>
      </div>

      {/* Компактна смуга фільтрів при прокрутці */}
      <CompactFilterBar
        visible={showCompactBar}
        filters={filters}
        setFilters={setFilters}
        isSales={isSales}
        onReset={handleResetFilters}
        panelProps={{ optionsData, countsData, visitsCountByDate, managerName: profile?.full_name, salesMonthsAvailable: sales.months }}
      >
        <div className="flex bg-white/5 p-0.5 rounded-xl border border-white/10">
          {[
            { id: "analytics", icon: BarChart3, label: "Ключова аналітика" },
            { id: "models", icon: Package, label: "Аналіз по моделях" },
            { id: "sales", icon: Receipt, label: "Аналіз фактичних продаж" },
          ].map(t => (
            <button
              key={t.id}
              type="button"
              onClick={() => setViewMode(t.id)}
              title={t.label}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
                viewMode === t.id ? "bg-indigo-600 text-white shadow" : "text-muted-foreground hover:text-white"
              }`}
            >
              <t.icon className="h-3.5 w-3.5" />
              <span className="hidden xl:inline">{t.label}</span>
            </button>
          ))}
        </div>
      </CompactFilterBar>

      {/* TOP FILTERS BAR (Positioned compactly at the top of the analytics section) */}
      <div className="relative z-40 mb-6" ref={setFiltersPanelEl}>
        <AnalyticsFilters 
          filters={filters} 
          setFilters={setFilters} 
          optionsData={optionsData}
          countsData={countsData}
          visitsCountByDate={visitsCountByDate}
          onReset={handleResetFilters}
          isSales={isSales}
          managerName={profile?.full_name}
          salesMonthsAvailable={sales.months}
        />
      </div>

      {/* EMPTY STATE IF NO DATA MATCHES COMBINATION (FOR ANALYTICS VIEW) */}
      {filteredData.length === 0 && viewMode === "analytics" ? (
        <div className="relative z-10 glass p-12 rounded-3xl border border-white/10 text-center space-y-4 max-w-lg mx-auto my-12 animate-in fade-in zoom-in-95 duration-200">
          <div className="h-16 w-16 mx-auto rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 shadow-[0_0_20px_rgba(99,102,241,0.15)]">
            <FilterX className="h-8 w-8" />
          </div>
          <div className="space-y-1.5">
            <h3 className="text-lg sm:text-xl font-bold text-white">
              Даних за обраними фільтрами не знайдено
            </h3>
            <p className="text-xs sm:text-sm text-muted-foreground">
              Жоден візит не відповідає поточній комбінації фільтрів. Спробуйте послабити обмеження або скинути фільтри.
            </p>
          </div>
          <div className="pt-2">
            <button
              type="button"
              onClick={handleResetFilters}
              className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-xs transition-all shadow-lg shadow-indigo-500/20 inline-flex items-center gap-2"
            >
              <FilterX className="h-4 w-4" />
              <span>Скинути всі фільтри</span>
            </button>
          </div>
        </div>
      ) : (
        <>
          {/* TAB 1: КЛЮЧОВА АНАЛІТИКА */}
          {viewMode === "analytics" && (
            <div className="relative z-10 space-y-8 animate-in fade-in duration-200">
              {/* 5 KPI Stats Cards Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
                {keyStats.map((s) => {
                  const isSelected = activeStat === s.id;
                  return (
                    <button 
                      key={s.id} 
                      type="button"
                      onClick={() => handleStatClick(s.id)}
                      className={`glass p-4 sm:p-5 rounded-3xl border transition-all duration-300 text-left flex flex-col justify-between group ${
                        isSelected 
                          ? "border-indigo-500 bg-indigo-500/10 ring-2 ring-indigo-500/25 shadow-xl shadow-indigo-500/15" 
                          : "border-white/10 hover:border-white/25 hover:bg-white/[0.06]"
                      }`}
                    >
                      <div>
                        {/* Top: Icon + Title + active indicator */}
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-2">
                            <div className={`p-2 rounded-xl border ${s.color} transition-transform duration-300 group-hover:scale-110`}>
                              <s.icon className="h-4 w-4" />
                            </div>
                            <span className="text-xs font-bold uppercase tracking-wider text-white/90">
                              {s.title}
                            </span>
                          </div>
                          {isSelected && (
                            <span className="h-2 w-2 rounded-full bg-indigo-400 animate-pulse" />
                          )}
                        </div>

                        {/* Middle: Main Large Metric */}
                        <div className="space-y-0.5 mb-3">
                          <div className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
                            {s.mainValue}
                          </div>
                          <div className="text-[11px] text-muted-foreground font-medium">
                            {s.mainLabel}
                          </div>
                        </div>
                      </div>

                      {/* Bottom: Detailed Sub-metrics */}
                      <div className="pt-3 border-t border-white/5 space-y-1.5 w-full">
                        {s.metrics.map((m, idx) => (
                          <div key={idx} className="flex items-center justify-between gap-2">
                            <span className="text-[11px] text-muted-foreground truncate">
                              {m.label}:
                            </span>
                            <span className={`text-[11px] font-semibold shrink-0 ${
                              m.highlight 
                                ? "text-emerald-400" 
                                : m.alert 
                                ? "text-rose-400" 
                                : "text-white/90"
                            }`}>
                              {m.value}
                            </span>
                          </div>
                        ))}
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Detailed Manager Stats (Collapsible on tile click) */}
              {activeStat && (
                <div className="animate-in fade-in slide-in-from-top-2 duration-200">
                  <ManagerStatsTable 
                    data={filteredData} 
                    agents={data.agents || []} 
                    activeStat={activeStat}
                    brands={displayBrandNames}
                  />
                </div>
              )}

              {/* Звіт: Структура ринку за виробниками (з компактною таблицею, графіком праворуч та можливістю згортання) */}
              <div>
                <MarketStructureByManufacturers 
                  data={latestFilteredVisits}
                  allManufacturers={data.manufacturers || []}
                />
              </div>

              {/* Звіт: Результати за менеджерами (з можливістю згортання) */}
              <div>
                <ManagerResultsTable 
                  data={latestFilteredVisits}
                  agents={data.agents || []}
                  salesIndex={salesIndex}
                />
              </div>

              {/* Звіт: Регіони за потенціалом (з можливістю згортання) */}
              <div>
                <RegionPotentialTable 
                  data={latestFilteredVisits}
                  oblasts={data.oblasts || []}
                />
              </div>

              {/* Звіт: Найбільші точки зростання за клієнтами (потенціал зростання >= 20) */}
              <div>
                <GrowthPointsByClientsTable 
                  data={latestFilteredVisits}
                />
              </div>

              {/* Звіт: Торгові точки (з карткою торгової точки та історією візитів) */}
              <div>
                <TradePointsTable 
                  data={latestFilteredVisits}
                  allVisits={data?.raw || []}
                  allBrands={data?.allBrands || []}
                  salesIndex={salesIndex}
                />
              </div>
            </div>
          )}

          {/* TAB 2: АНАЛІЗ ПО МОДЕЛЯХ */}
          {viewMode === "models" && (
            <div className="relative z-10 space-y-6 animate-in fade-in duration-200">
              {/* Звіт: Аналіз по моделях (Highfoam vs Privat та список Торгових точок) */}
              <ModelAnalysisReport
                data={latestFilteredVisits}
                allVisits={data?.raw || []}
                allBrands={data?.allBrands || []}
                salesIndex={salesIndex}
                selectedHfModels={filters.hfModels || []}
                selectedPmModels={filters.pmModels || []}
              />
            </div>
          )}

          {/* TAB 3: АНАЛІЗ ФАКТИЧНИХ ПРОДАЖ (розбіжності продажів IT-Enterprise і CRM) */}
          {viewMode === "sales" && (
            <div className="relative z-10 space-y-6 animate-in fade-in duration-200">
              <SalesDiscrepancyReport
                rows={filteredSalesRows}
                hasAnySales={sales.rows.length > 0}
                months={filters.salesMonths || []}
                appliedFilters={salesFilterLabels}
              />
            </div>
          )}
        </>
      )}
    </div>
  );
}
export default AnalyticsPage;
