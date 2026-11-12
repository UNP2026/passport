import { supabase } from "@/lib/supabase";

const PAGE = 1000;
const COLUMNS = [
  "id", "period", "skm", "org_code", "n_kdk", "kol",
  "manager_user_id", "manager_name",
  "org_id", "org_name", "org_name_1c",
  "brand_id", "brand_name", "model_name_1c", "is_highfoam", "is_pm",
  "manager_in_crm", "org_in_crm", "model_in_crm",
].join(", ");

/**
 * Фактичні продажі з IT-Enterprise (представлення sales_v: продажі + назви з CRM за кодами).
 * RLS: admin/head бачать усе, sales — лише свої продажі.
 * Supabase віддає максимум 1000 рядків за запит, тому читаємо сторінками.
 */
export async function fetchSales() {
  const rows = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from("sales_v")
      .select(COLUMNS)
      .order("id", { ascending: true })
      .range(from, from + PAGE - 1);
    if (error) {
      console.error("fetchSales error:", error);
      return { rows, months: [], error };
    }
    rows.push(...(data || []));
    if (!data || data.length < PAGE) break;
  }

  const prepared = rows.map(r => ({
    ...r,
    month: String(r.period).slice(0, 7), // "2026-01"
    n_kdk: r.n_kdk == null ? null : String(r.n_kdk),
    kol: Number(r.kol) || 0,
  }));
  const months = [...new Set(prepared.map(r => r.month))].sort();
  return { rows: prepared, months, error: null };
}
