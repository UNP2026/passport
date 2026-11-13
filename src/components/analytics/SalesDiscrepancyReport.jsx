import React, { useMemo, useState } from "react";
import {
  Receipt, Building2, Package, User, Search, Download, ArrowUpDown, CheckCircle2, AlertTriangle,
} from "lucide-react";
import * as XLSX from "xlsx";
import { formatSales, salesForExcel, salesPeriodLabel } from "../../lib/salesUtils";

const norm = (s) => (s || "").trim().toLowerCase();

const TYPES = [
  { id: "org", label: "Організації немає в CRM", short: "Немає організації", icon: Building2, color: "rose" },
  { id: "model", label: "Моделі немає в CRM", short: "Немає моделі", icon: Package, color: "amber" },
  { id: "manager", label: "Менеджера немає в CRM", short: "Немає менеджера", icon: User, color: "sky" },
];
const BADGE = {
  rose: "bg-rose-500/15 text-rose-300 border-rose-500/30",
  amber: "bg-amber-500/15 text-amber-300 border-amber-500/30",
  sky: "bg-sky-500/15 text-sky-300 border-sky-500/30",
};
const TILE_ACTIVE = {
  rose: "border-rose-500/60 bg-rose-500/10 ring-2 ring-rose-500/20",
  amber: "border-amber-500/60 bg-amber-500/10 ring-2 ring-amber-500/20",
  sky: "border-sky-500/60 bg-sky-500/10 ring-2 ring-sky-500/20",
};

const GROUPS = [
  { id: "detail", label: "Детально", hint: "Усі розбіжності: організація × модель × менеджер" },
  { id: "org", label: "По організаціях", hint: "Лише організації, яких немає в CRM" },
  { id: "model", label: "По моделях", hint: "Лише моделі, яких немає в CRM" },
];

/**
 * Розбіжності фактичних продажів (IT-Enterprise) і даних CRM за «Період продаж»:
 * продажі по організаціях, моделях або менеджерах, коди яких не знайдено в CRM.
 * Організація може бути в CRM, а модель — ні (і навпаки).
 */
export function SalesDiscrepancyReport({ rows = [], hasAnySales = false, months = [], appliedFilters = [] }) {
  const [typeFilter, setTypeFilter] = useState(null); // null | "org" | "model" | "manager"
  const [groupBy, setGroupBy] = useState("detail");
  const [query, setQuery] = useState("");
  const [sortField, setSortField] = useState("total");
  const [sortDir, setSortDir] = useState("desc");

  const divisor = months.length || 1;
  const isMulti = months.length > 1;
  const periodLabel = salesPeriodLabel(months);

  // Продажі за період (rows уже відфільтровані сторінкою за менеджером, організацією, моделями)
  const periodRows = useMemo(() => {
    const set = new Set(months);
    return rows.filter(r => set.has(r.month));
  }, [rows, months]);

  const periodTotal = useMemo(() => periodRows.reduce((a, r) => a + r.kol, 0), [periodRows]);

  // Рядки з розбіжністю, згруповані: організація × модель × менеджер
  const detail = useMemo(() => {
    const map = new Map();
    periodRows.forEach(r => {
      if (r.org_in_crm && r.model_in_crm && r.manager_in_crm) return;
      const key = `${r.org_code}|${r.skm}|${r.n_kdk ?? ""}`;
      let g = map.get(key);
      if (!g) {
        g = {
          key,
          orgCode: r.org_code,
          orgName: r.org_name || r.org_name_1c || "—",
          orgInCrm: r.org_in_crm,
          skm: r.skm,
          modelName: r.brand_name || r.model_name_1c || "—",
          modelInCrm: r.model_in_crm,
          managerName: r.manager_name || (r.n_kdk ? `код ${r.n_kdk}` : "Без менеджера"),
          managerInCrm: r.manager_in_crm,
          total: 0,
          monthSet: new Set(),
        };
        map.set(key, g);
      }
      g.total += r.kol;
      g.monthSet.add(r.month);
    });
    return [...map.values()];
  }, [periodRows]);

  const matchesType = (g, t) =>
    t === "org" ? !g.orgInCrm : t === "model" ? !g.modelInCrm : t === "manager" ? !g.managerInCrm : true;

  // Підсумки по типах (унікальні коди та штуки)
  const summary = useMemo(() => {
    const res = {};
    TYPES.forEach(t => {
      const list = detail.filter(g => matchesType(g, t.id));
      const codes = new Set(list.map(g => (t.id === "org" ? g.orgCode : t.id === "model" ? g.skm : g.managerName)));
      res[t.id] = { codes: codes.size, total: list.reduce((a, g) => a + g.total, 0) };
    });
    res.all = detail.reduce((a, g) => a + g.total, 0);
    return res;
  }, [detail]);

  // Групування
  const grouped = useMemo(() => {
    // «По організаціях» — лише організації, яких немає в CRM; «По моделях» — лише моделі, яких немає в CRM
    const list = detail.filter(g =>
      matchesType(g, typeFilter) &&
      (groupBy !== "org" || !g.orgInCrm) &&
      (groupBy !== "model" || !g.modelInCrm)
    );
    if (groupBy === "detail") {
      return list.map(g => ({ ...g, months: g.monthSet.size, avg: g.total / divisor }));
    }
    const map = new Map();
    list.forEach(g => {
      const key = groupBy === "org" ? g.orgCode : g.skm;
      let a = map.get(key);
      if (!a) {
        a = groupBy === "org"
          ? { key, orgCode: g.orgCode, orgName: g.orgName, orgInCrm: g.orgInCrm, modelInCrm: true, managerInCrm: true,
              models: new Set(), modelsMissing: new Set(), managers: new Set(), total: 0, monthSet: new Set() }
          : { key, skm: g.skm, modelName: g.modelName, modelInCrm: g.modelInCrm, orgInCrm: true, managerInCrm: true,
              orgs: new Set(), orgsMissing: new Set(), managers: new Set(), total: 0, monthSet: new Set() };
        map.set(key, a);
      }
      a.total += g.total;
      g.monthSet.forEach(m => a.monthSet.add(m));
      a.managers.add(g.managerName);
      if (!g.managerInCrm) a.managerInCrm = false;
      if (groupBy === "org") {
        a.models.add(g.skm);
        if (!g.modelInCrm) { a.modelsMissing.add(g.skm); a.modelInCrm = false; }
      } else {
        a.orgs.add(g.orgCode);
        if (!g.orgInCrm) { a.orgsMissing.add(g.orgCode); a.orgInCrm = false; }
      }
    });
    return [...map.values()].map(a => ({
      ...a,
      managerName: [...a.managers].sort((x, y) => x.localeCompare(y, "uk")).join(", "),
      modelsCount: a.models?.size, modelsMissingCount: a.modelsMissing?.size,
      orgsCount: a.orgs?.size, orgsMissingCount: a.orgsMissing?.size,
      months: a.monthSet.size,
      avg: a.total / divisor,
    }));
  }, [detail, typeFilter, groupBy, divisor]);

  const visible = useMemo(() => {
    const q = norm(query);
    const list = !q ? grouped : grouped.filter(g =>
      [g.orgCode, g.orgName, g.skm, g.modelName, g.managerName].some(v => norm(String(v ?? "")).includes(q))
    );
    return [...list].sort((a, b) => {
      const av = a[sortField], bv = b[sortField];
      if (typeof av === "string" || typeof bv === "string") {
        const c = String(av ?? "").localeCompare(String(bv ?? ""), "uk");
        return sortDir === "asc" ? c : -c;
      }
      return sortDir === "asc" ? (av || 0) - (bv || 0) : (bv || 0) - (av || 0);
    });
  }, [grouped, query, sortField, sortDir]);

  const visibleTotal = visible.reduce((a, g) => a + g.total, 0);

  const sortBy = (f) => {
    if (sortField === f) setSortDir(d => (d === "asc" ? "desc" : "asc"));
    else { setSortField(f); setSortDir(typeof grouped[0]?.[f] === "string" ? "asc" : "desc"); }
  };

  const issues = (g) => TYPES.filter(t => matchesType(g, t.id));

  const exportExcel = () => {
    const data = visible.map(g => {
      const row = { "Розбіжність": issues(g).map(t => t.short).join(", ") };
      if (groupBy !== "model") {
        row["Код організації"] = g.orgCode;
        row["Організація"] = g.orgName;
        row["Організація в CRM"] = g.orgInCrm ? "Так" : "Ні";
      }
      if (groupBy !== "org") {
        row["Код моделі (skm)"] = g.skm;
        row["Модель"] = g.modelName;
        row["Модель в CRM"] = g.modelInCrm ? "Так" : "Ні";
      }
      if (groupBy === "org") { row["Моделей"] = g.modelsCount; row["З них немає в CRM"] = g.modelsMissingCount; }
      if (groupBy === "model") { row["Організацій"] = g.orgsCount; row["З них немає в CRM"] = g.orgsMissingCount; }
      row["Менеджер"] = g.managerName;
      row["Місяців з продажами"] = g.months;
      if (isMulti) row["Продажі, сер./міс."] = salesForExcel(g.avg);
      row[`Продажі за період (${periodLabel}), шт`] = g.total;
      return row;
    });
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Розбіжності продажів");
    XLSX.writeFile(wb, `Розбіжності_продажів_CRM_${new Date().toISOString().split("T")[0]}.xlsx`);
  };

  const Th = ({ field, children, align = "text-left", title }) => (
    <th
      onClick={() => sortBy(field)}
      title={title}
      className={`p-3 font-semibold cursor-pointer select-none hover:text-white transition-colors whitespace-nowrap ${align} ${
        sortField === field ? "text-indigo-300 bg-indigo-500/10" : ""
      }`}
    >
      <span className="inline-flex items-center gap-1">
        {children}
        <ArrowUpDown className="h-3 w-3 opacity-50" />
      </span>
    </th>
  );

  const CrmMark = ({ ok }) => ok
    ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 shrink-0" title="Є в CRM" />
    : <AlertTriangle className="h-3.5 w-3.5 text-rose-400 shrink-0" title="Немає в CRM" />;

  const colCount = 6 + (isMulti ? 1 : 0);
  const sharePct = periodTotal > 0 ? (summary.all / periodTotal) * 100 : 0;

  return (
    <div className="space-y-6">
      {/* Шапка */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 glass p-4 sm:p-5 rounded-3xl border border-white/10">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
            <Receipt className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-lg sm:text-xl font-bold text-white tracking-tight">Аналіз фактичних продаж</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Продажі з IT-Enterprise, яких не вдалося зіставити з CRM · {periodLabel}
              {isMulti ? ` · середнє за ${months.length} міс.` : ""}
            </p>
            {appliedFilters.length > 0 && (
              <p className="text-[11px] text-indigo-300 mt-0.5">Застосовано фільтри: {appliedFilters.join(", ")}</p>
            )}
          </div>
        </div>
        <button
          type="button"
          onClick={exportExcel}
          disabled={!visible.length}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600/20 hover:bg-indigo-600 text-indigo-300 hover:text-white border border-indigo-500/30 transition-all font-medium text-xs disabled:opacity-50 shrink-0"
        >
          <Download className="h-3.5 w-3.5" />
          <span>Експорт в Excel</span>
        </button>
      </div>

      {/* Підсумки по типах — клік фільтрує таблицю */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="glass p-4 rounded-3xl border border-white/10">
          <div className="text-xs font-bold uppercase tracking-wider text-white/90 mb-2">Не зіставлено з CRM</div>
          <div className="text-2xl font-extrabold text-white">{formatSales(summary.all / divisor) === "—" ? "0" : formatSales(summary.all / divisor)}</div>
          <div className="text-[11px] text-muted-foreground mt-1">
            шт{isMulti ? " / міс." : ""} · {sharePct.toFixed(1).replace(".", ",")}% продажів за період{appliedFilters.length ? " (з фільтрами)" : ""}
          </div>
        </div>
        {TYPES.map(t => {
          const st = summary[t.id];
          const active = typeFilter === t.id;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setTypeFilter(active ? null : t.id)}
              className={`glass p-4 rounded-3xl border text-left transition-all ${
                active ? TILE_ACTIVE[t.color] : "border-white/10 hover:border-white/25 hover:bg-white/[0.06]"
              }`}
            >
              <div className="flex items-center gap-2 mb-2">
                <span className={`p-1.5 rounded-lg border ${BADGE[t.color]}`}><t.icon className="h-3.5 w-3.5" /></span>
                <span className="text-xs font-bold uppercase tracking-wider text-white/90">{t.label}</span>
              </div>
              <div className="text-2xl font-extrabold text-white">{st.codes}</div>
              <div className="text-[11px] text-muted-foreground mt-1">
                кодів · {formatSales(st.total / divisor) === "—" ? "0" : formatSales(st.total / divisor)} шт{isMulti ? " / міс." : ""}
              </div>
            </button>
          );
        })}
      </div>

      {/* Таблиця */}
      <div className="glass rounded-3xl border border-white/10 p-4 sm:p-5 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex bg-white/5 p-0.5 rounded-xl border border-white/10">
              {GROUPS.map(g => (
                <button
                  key={g.id}
                  type="button"
                  onClick={() => setGroupBy(g.id)}
                  title={g.hint}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    groupBy === g.id ? "bg-indigo-600 text-white shadow" : "text-muted-foreground hover:text-white"
                  }`}
                >
                  {g.label}
                </button>
              ))}
            </div>
            {typeFilter && (
              <button
                type="button"
                onClick={() => setTypeFilter(null)}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold border ${BADGE[TYPES.find(t => t.id === typeFilter).color]}`}
                title="Прибрати фільтр"
              >
                {TYPES.find(t => t.id === typeFilter).short} ✕
              </button>
            )}
          </div>
          <span className="text-[11px] text-muted-foreground lg:mr-auto lg:ml-1">
            {GROUPS.find(g => g.id === groupBy)?.hint}
          </span>
          <div className="relative min-w-[220px] sm:min-w-[280px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Пошук: код, організація, модель, менеджер"
              className="w-full bg-white/5 border border-white/10 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder:text-muted-foreground focus:outline-none focus:border-indigo-500"
            />
          </div>
        </div>

        <div className="overflow-x-auto rounded-2xl border border-white/10 max-h-[600px] custom-scrollbar">
          <table className="w-full text-left border-collapse text-xs min-w-[900px]">
            <thead className="sticky top-0 bg-[#162032] z-10 text-[11px] uppercase tracking-wider text-muted-foreground border-b border-white/10">
              <tr>
                <th className="p-3 font-semibold whitespace-nowrap">Розбіжність</th>
                {groupBy !== "model" && <Th field="orgName">Організація</Th>}
                {groupBy !== "org" && <Th field="modelName">Модель</Th>}
                {groupBy === "org" && <Th field="modelsMissingCount" align="text-center" title="Моделей у продажах / з них немає в CRM">Моделі</Th>}
                {groupBy === "model" && <Th field="orgsMissingCount" align="text-center" title="Організацій у продажах / з них немає в CRM">Організації</Th>}
                <Th field="managerName">Менеджер</Th>
                <Th field="months" align="text-center" title="Місяців з продажами в обраному періоді">Міс.</Th>
                {isMulti && <Th field="avg" align="text-right" title="Середні продажі за місяць">Сер./міс., шт</Th>}
                <Th field="total" align="text-right" title="Продажі за весь обраний період">{isMulti ? "Всього, шт" : "Продажі, шт"}</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {visible.length === 0 ? (
                <tr>
                  <td colSpan={colCount} className="p-10 text-center text-muted-foreground">
                    {!hasAnySales
                      ? "Фактичних продажів ще немає"
                      : periodRows.length === 0
                      ? "За обраними фільтрами продажів немає"
                      : query
                      ? `За запитом «${query}» нічого не знайдено`
                      : groupBy === "org"
                      ? "За обраний період немає продажів по організаціях, яких немає в CRM"
                      : groupBy === "model"
                      ? "За обраний період немає продажів по моделях, яких немає в CRM"
                      : "Розбіжностей за обраний період немає — усі продажі зіставлено з CRM"}
                  </td>
                </tr>
              ) : visible.map(g => (
                <tr key={g.key} className="hover:bg-white/[0.04] transition-colors">
                  <td className="p-3">
                    <div className="flex flex-wrap gap-1">
                      {issues(g).map(t => (
                        <span key={t.id} className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border whitespace-nowrap ${BADGE[t.color]}`}>
                          {t.short}
                        </span>
                      ))}
                    </div>
                  </td>
                  {groupBy !== "model" && (
                    <td className="p-3">
                      <div className="flex items-center gap-1.5">
                        <CrmMark ok={g.orgInCrm} />
                        <span className="text-white/90 truncate max-w-[260px]" title={g.orgName}>{g.orgName}</span>
                      </div>
                      <div className="text-[10px] text-muted-foreground font-mono pl-5">код {g.orgCode}</div>
                    </td>
                  )}
                  {groupBy !== "org" && (
                    <td className="p-3">
                      <div className="flex items-center gap-1.5">
                        <CrmMark ok={g.modelInCrm} />
                        <span className="text-white/90 truncate max-w-[240px]" title={g.modelName}>{g.modelName}</span>
                      </div>
                      <div className="text-[10px] text-muted-foreground font-mono pl-5">skm {g.skm}</div>
                    </td>
                  )}
                  {groupBy === "org" && (
                    <td className="p-3 text-center font-mono text-white/85">
                      {g.modelsCount}
                      {g.modelsMissingCount > 0 && <span className="text-amber-300"> / {g.modelsMissingCount}</span>}
                    </td>
                  )}
                  {groupBy === "model" && (
                    <td className="p-3 text-center font-mono text-white/85">
                      {g.orgsCount}
                      {g.orgsMissingCount > 0 && <span className="text-rose-300"> / {g.orgsMissingCount}</span>}
                    </td>
                  )}
                  <td className="p-3">
                    <div className="flex items-center gap-1.5">
                      <CrmMark ok={g.managerInCrm} />
                      <span className="text-white/80 truncate max-w-[220px]" title={g.managerName}>{g.managerName}</span>
                    </div>
                  </td>
                  <td className="p-3 text-center font-mono text-muted-foreground">{g.months}</td>
                  {isMulti && <td className="p-3 text-right font-mono text-emerald-300">{formatSales(g.avg)}</td>}
                  <td className="p-3 text-right font-mono font-semibold text-white">{g.total.toLocaleString("uk-UA")}</td>
                </tr>
              ))}
            </tbody>
            {visible.length > 0 && (
              <tfoot>
                <tr className="bg-[#15213b] text-white font-bold border-t-2 border-white/20">
                  <td className="p-3 uppercase tracking-wide" colSpan={colCount - (isMulti ? 2 : 1)}>
                    Разом · {visible.length} {groupBy === "org" ? "орг." : groupBy === "model" ? "мод." : "рядків"}
                  </td>
                  {isMulti && <td className="p-3 text-right font-mono text-emerald-300">{formatSales(visibleTotal / divisor)}</td>}
                  <td className="p-3 text-right font-mono">{visibleTotal.toLocaleString("uk-UA")}</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>

        <p className="text-[11px] text-muted-foreground leading-relaxed">
          Зіставлення за кодами IT-Enterprise: код організації → «Організації» CRM, skm → «Моделі» CRM, код менеджера → профіль користувача.
          Щойно організацію чи модель внесуть у CRM з тим самим кодом, рядок зникне з цього звіту.
        </p>
      </div>
    </div>
  );
}
