// Фактичні продажі з 1С: обраний період, середнє за місяць, індекси для таблиць аналітики.

const MONTHS_SHORT = ["січ", "лют", "бер", "кві", "тра", "чер", "лип", "сер", "вер", "жов", "лис", "гру"];
const MONTHS_FULL = ["Січень", "Лютий", "Березень", "Квітень", "Травень", "Червень",
  "Липень", "Серпень", "Вересень", "Жовтень", "Листопад", "Грудень"];

export const monthShort = (m) => {
  const [y, mm] = m.split("-");
  return `${MONTHS_SHORT[Number(mm) - 1]} ${y}`;
};
export const monthFull = (m) => {
  const [y, mm] = m.split("-");
  return `${MONTHS_FULL[Number(mm) - 1]} ${y}`;
};

/** Підпис обраного періоду: «жов 2026» або «січ 2026 – бер 2026 (сер. за 3 міс.)» */
export function salesPeriodLabel(months = []) {
  if (!months.length) return "—";
  const sorted = [...months].sort();
  if (sorted.length === 1) return monthShort(sorted[0]);
  return `${monthShort(sorted[0])} – ${monthShort(sorted[sorted.length - 1])}`;
}

/** Діапазон місяців між a і b (включно) серед доступних */
export function monthRange(available = [], a, b) {
  const [from, to] = a <= b ? [a, b] : [b, a];
  return available.filter(m => m >= from && m <= to);
}

/** За замовчуванням — останній місяць, за який є продажі */
export const defaultSalesMonths = (available = []) =>
  available.length ? [available[available.length - 1]] : [];

export const isDefaultSalesMonths = (selected = [], available = []) => {
  const def = defaultSalesMonths(available);
  return selected.length === def.length && selected.every((m, i) => m === def[i]);
};

/** Формат: «—» для нуля/відсутності, до 1 знаку після коми для середнього */
export function formatSales(v) {
  if (v == null || !Number.isFinite(v) || v === 0) return "—";
  return v.toLocaleString("uk-UA", { maximumFractionDigits: 1 });
}

/** Значення для Excel: число з 1 знаком або порожньо */
export const salesForExcel = (v) => (v ? Math.round(v * 10) / 10 : "");

const add = (map, key, kol) => map.set(key, (map.get(key) || 0) + kol);
const norm = (s) => (s || "").trim().toLowerCase();

/**
 * Індекс продажів за обраний період. Усі getter-и повертають СЕРЕДНЄ за місяць:
 * сума за обрані місяці / кількість обраних місяців.
 *  - manager(userId | ім'я)
 *  - managerOrg(userId, orgCode), org(orgCode)
 *  - brand(brandId), managerOrgBrand(userId, orgCode, brandId), orgBrand(orgCode, brandId)
 */
export function buildSalesIndex(rows = [], months = []) {
  const set = new Set(months);
  const divisor = months.length || 1;
  const byManager = new Map();
  const byManagerName = new Map();
  const byManagerOrg = new Map();
  const byOrg = new Map();
  const byBrand = new Map();
  const byManagerOrgBrand = new Map();
  const byOrgBrand = new Map();
  let total = 0;

  rows.forEach(r => {
    if (!set.has(r.month)) return;
    const kol = r.kol;
    total += kol;
    if (r.manager_user_id) {
      add(byManager, r.manager_user_id, kol);
      add(byManagerOrg, `${r.manager_user_id}|${r.org_code}`, kol);
    }
    if (r.manager_name) add(byManagerName, norm(r.manager_name), kol);
    add(byOrg, r.org_code, kol);
    if (r.brand_id) {
      add(byBrand, r.brand_id, kol);
      add(byOrgBrand, `${r.org_code}|${r.brand_id}`, kol);
      if (r.manager_user_id) add(byManagerOrgBrand, `${r.manager_user_id}|${r.org_code}|${r.brand_id}`, kol);
    }
  });

  const avg = (map, key) => (map.get(key) || 0) / divisor;
  return {
    months,
    monthsCount: months.length,
    total: total / divisor,
    manager: (userId, name) =>
      userId && byManager.has(userId) ? avg(byManager, userId) : avg(byManagerName, norm(name)),
    managerOrg: (userId, orgCode) => (userId && orgCode ? avg(byManagerOrg, `${userId}|${orgCode}`) : 0),
    org: (orgCode) => (orgCode ? avg(byOrg, orgCode) : 0),
    brand: (brandId) => (brandId ? avg(byBrand, brandId) : 0),
    managerOrgBrand: (userId, orgCode, brandId) =>
      userId && orgCode && brandId ? avg(byManagerOrgBrand, `${userId}|${orgCode}|${brandId}`) : 0,
    orgBrand: (orgCode, brandId) => (orgCode && brandId ? avg(byOrgBrand, `${orgCode}|${brandId}`) : 0),
  };
}

export const EMPTY_SALES_INDEX = buildSalesIndex([], []);
