import { supabase } from "@/lib/supabase";

export async function fetchRealAnalyticsData({ userId = null, isSalesOnly = false } = {}) {
  // 1. Fetch visits with related data (scoped to current user if sales role)
  let visitsQuery = supabase
    .from("visits")
    .select(`
      id,
      visited_at,
      author_user_id,
      is_cooperating,
      tt_id,
      tt:tt_id (
        id,
        name,
        city,
        street,
        house,
        orgs (
          id,
          name,
          org_code
        )
      ),
      author:user_profiles!visits_author_user_id_fkey (
        full_name
      ),
      tt_type:tt_types (
        id,
        name
      ),
      price_seg_low,
      price_seg_mid,
      price_seg_high,
      sells_pillows,
      visit_result_note,
      contact_name,
      contact_position,
      contact_phone,
      contact_email,
      tt_description,
      is_working,
      visit_manufacturers (
        manufacturer:manufacturer_id (
          id,
          name
        ),
        pp,
        kv
      ),
      visit_brands (
        brand:brand_id (
          id,
          name,
          is_highfoam,
          is_pm
        )
      )
    `);

  if (isSalesOnly && userId) {
    visitsQuery = visitsQuery.eq("author_user_id", userId);
  }

  const { data: visits, error: visitsError } = await visitsQuery.order("visited_at", { ascending: false });

  if (visitsError) {
    console.error("fetchRealAnalyticsData error:", visitsError);
    return null;
  }

  // 2. Fetch all brands and manufacturers to know full lists
  const [brandsRes, mfsRes, ttRes] = await Promise.all([
    supabase
      .from("brands")
      .select("id, name, is_highfoam, is_pm, pm_org_id")
      .order("name", { ascending: true }),
    supabase
      .from("manufacturers")
      .select("name")
      .eq("is_active", true)
      .order("sort_order", { ascending: true }),
    // Кількість ТТ по організації (для колонки «Кіл-ть ТТ»)
    supabase
      .from("tt")
      .select("org_id")
  ]);

  const ttCountByOrgId = new Map();
  (ttRes?.data || []).forEach(t => {
    if (!t.org_id) return;
    ttCountByOrgId.set(t.org_id, (ttCountByOrgId.get(t.org_id) || 0) + 1);
  });

  const DEFAULT_CATALOG_MODELS = [
    // Highfoam models
    { id: "hf-1", name: "Highfoam Noble Silver", is_highfoam: true, is_pm: false },
    { id: "hf-2", name: "Highfoam Noble Platinum", is_highfoam: true, is_pm: false },
    { id: "hf-3", name: "Highfoam Noble Aurum", is_highfoam: true, is_pm: false },
    { id: "hf-4", name: "Highfoam Noble Argentum", is_highfoam: true, is_pm: false },
    { id: "hf-5", name: "Highfoam Fresh Green", is_highfoam: true, is_pm: false },
    { id: "hf-6", name: "Highfoam Fresh Black", is_highfoam: true, is_pm: false },
    { id: "hf-7", name: "Highfoam Fresh Rosi", is_highfoam: true, is_pm: false },
    { id: "hf-8", name: "Highfoam Zephyr Lazy", is_highfoam: true, is_pm: false },
    { id: "hf-9", name: "Highfoam Zephyr Glaze", is_highfoam: true, is_pm: false },
    { id: "hf-10", name: "Highfoam Emerald Classic", is_highfoam: true, is_pm: false },
    { id: "hf-11", name: "Highfoam Emerald Soft", is_highfoam: true, is_pm: false },
    { id: "hf-12", name: "Highfoam Keiko", is_highfoam: true, is_pm: false },
    { id: "hf-13", name: "Highfoam Faino", is_highfoam: true, is_pm: false },
    { id: "hf-14", name: "Highfoam BlueMarine", is_highfoam: true, is_pm: false },

    // Privat models
    { id: "pm-1", name: "Privat Sleep", is_highfoam: false, is_pm: true },
    { id: "pm-2", name: "Privat Comfort", is_highfoam: false, is_pm: true },
    { id: "pm-3", name: "Privat Eco", is_highfoam: false, is_pm: true },
    { id: "pm-4", name: "Privat Optima", is_highfoam: false, is_pm: true },
    { id: "pm-5", name: "Privat Trend", is_highfoam: false, is_pm: true },
    { id: "pm-6", name: "Privat Duo", is_highfoam: false, is_pm: true },
    { id: "pm-7", name: "Privat Classic", is_highfoam: false, is_pm: true },
    { id: "pm-8", name: "Privat Relax", is_highfoam: false, is_pm: true },
    { id: "pm-9", name: "Privat Master", is_highfoam: false, is_pm: true },
    { id: "pm-10", name: "Privat Line", is_highfoam: false, is_pm: true },
  ];

  const dbBrands = brandsRes.data || [];
  const allBrands = dbBrands.length > 0 ? dbBrands : DEFAULT_CATALOG_MODELS;
  const brandNames = allBrands.map(b => b.name);

  // 3. Process all visits into format expected by the UI
  const brandCounts = {};
  const allVisits = visits || [];
  
  const processedData = allVisits.map(v => {
    const brandPresence = {};

    brandNames.forEach(bn => {
      const isPresent = v.visit_brands?.some(vb => vb.brand?.name === bn) || false;
      brandPresence[bn] = isPresent;
      if (isPresent) {
        brandCounts[bn] = (brandCounts[bn] || 0) + 1;
      }
    });

    const [cityName, ...oblastParts] = (v.tt?.city || "").split(',').map(s => s.trim());
    const city = cityName || "Невідомо";
    const oblast = oblastParts.join(', ') || "Не вказано";
    const org = v.tt?.orgs?.name || "Без організації";
    const orgCode = v.tt?.orgs?.org_code || "";
    const orgId = v.tt?.orgs?.id || null;
    const point = v.tt?.name || "Невідома ТТ";
    const agent = v.author?.full_name || "Невідомий";
    const ttType = v.tt_type?.name || "Не вказано";
    const street = v.tt?.street || "";
    const house = v.tt?.house || "";
    const address = [street, house].filter(Boolean).join(" ").trim() || v.tt?.city || "";

    // Unique TT identifier key: Organization + Point name + Address
    const ttKey = `${org.trim().toLowerCase()}:::${point.trim().toLowerCase()}:::${address.trim().toLowerCase()}`;

    // Total and Highfoam PP (potentials) and KV (places)
    const totalPP = v.visit_manufacturers?.reduce((acc, vm) => acc + (vm.pp || 0), 0) || 0;
    const totalKV = v.visit_manufacturers?.reduce((acc, vm) => acc + (vm.kv || 0), 0) || 0;

    const highfoamPP = v.visit_manufacturers
      ?.filter(vm => (vm.manufacturer?.name || "").trim().toLowerCase() === "highfoam")
      .reduce((acc, vm) => acc + (vm.pp || 0), 0) || 0;

    const highfoamKV = v.visit_manufacturers
      ?.filter(vm => (vm.manufacturer?.name || "").trim().toLowerCase() === "highfoam")
      .reduce((acc, vm) => acc + (vm.kv || 0), 0) || 0;

    // Calculate Category letter (A, B, C, D) using PP rule as in Excel export
    let category = "—";
    if (totalPP > 29) category = "A";
    else if (totalPP >= 20) category = "B";
    else if (totalPP >= 10) category = "C";
    else if (totalPP > 0) category = "D";

    const mfs = [
      ...new Set(
        (v.visit_manufacturers || [])
          .map(vm => vm.manufacturer?.name)
          .filter(Boolean)
      )
    ];

    // Моделі (бренди) на точці: Highfoam та Privat
    const hfModels = [...new Set((v.visit_brands || []).filter(vb => vb.brand?.is_highfoam).map(vb => vb.brand.name))];
    const pmModels = [...new Set((v.visit_brands || []).filter(vb => vb.brand?.is_pm && !vb.brand?.is_highfoam).map(vb => vb.brand.name))];

    return {
      id: v.id,
      authorUserId: v.author_user_id,
      date: v.visited_at ? new Date(v.visited_at).toISOString().split('T')[0] : "—",
      visitedAt: v.visited_at,
      city,
      oblast,
      org,
      orgCode,
      orgId,
      agent,
      pointId: v.tt?.id || null,
      point,
      street,
      house,
      address,
      ttKey,
      ttType,
      category,
      totalPP,
      totalKV,
      highfoamPP,
      highfoamKV,
      manufacturers: mfs,
      hfModels,
      pmModels,
      priceSegLow: v.price_seg_low ?? 0,
      priceSegMid: v.price_seg_mid ?? 0,
      priceSegHigh: v.price_seg_high ?? 0,
      sellsPillows: v.sells_pillows === true,
      visitResultNote: v.visit_result_note || "",
      contactName: v.contact_name || "",
      contactPosition: v.contact_position || "",
      contactPhone: v.contact_phone || "",
      contactEmail: v.contact_email || "",
      ttDescription: v.tt_description || "",
      isWorking: v.is_working ?? true,
      visitManufacturers: (v.visit_manufacturers || []).map(vm => ({
        name: vm.manufacturer?.name || "",
        pp: vm.pp || 0,
        kv: vm.kv || 0
      })),
      brandPresence,
      isCooperating: v.is_cooperating === true,
      rawVisit: v
    };
  });

  const sortedBrands = Object.entries(brandCounts)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);

  // 4. Extract unique lists for filters
  const cities = [...new Set(processedData.map(d => d.city).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'uk'));
  const oblasts = [...new Set(processedData.map(d => d.oblast).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'uk'));
  const orgs = [...new Set(processedData.map(d => d.org).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'uk'));
  const points = [...new Set(processedData.map(d => d.point).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'uk'));
  const agents = [...new Set(processedData.map(d => d.agent).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'uk'));
  const ttTypes = [...new Set(processedData.map(d => d.ttType).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'uk'));

  // Manufacturers from table and visits
  const tableMfs = (mfsRes.data || []).map(m => m.name);
  const visitMfs = processedData.flatMap(d => d.manufacturers);
  const manufacturers = [...new Set([...tableMfs, ...visitMfs].filter(Boolean))].sort((a, b) => a.localeCompare(b, 'uk'));

  const categories = ["A", "B", "C", "D"];

  // Кількість ТТ по організації: з таблиці tt, а якщо вона недоступна — унікальні ТТ з візитів
  const ttKeysByOrg = new Map();
  processedData.forEach(d => {
    const k = d.orgId || d.org;
    if (!ttKeysByOrg.has(k)) ttKeysByOrg.set(k, new Set());
    ttKeysByOrg.get(k).add(d.pointId || d.ttKey);
  });
  processedData.forEach(d => {
    const fromVisits = ttKeysByOrg.get(d.orgId || d.org)?.size || 0;
    const fromTable = d.orgId ? (ttCountByOrgId.get(d.orgId) || 0) : 0;
    d.orgTtCount = Math.max(fromTable, fromVisits);
  });

  const byName = (a, b) => a.localeCompare(b, 'uk');
  const hfModelOptions = [...new Set([
    ...allBrands.filter(b => b.is_highfoam).map(b => b.name),
    ...processedData.flatMap(d => d.hfModels),
  ])].sort(byName);
  const pmModelOptions = [...new Set([
    ...allBrands.filter(b => b.is_pm && !b.is_highfoam).map(b => b.name),
    ...processedData.flatMap(d => d.pmModels),
  ])].sort(byName);

  return {
    raw: processedData,
    brands: sortedBrands,
    brandNames,
    allBrands: allBrands || [],
    cities,
    oblasts,
    orgs,
    points,
    agents,
    ttTypes,
    manufacturers,
    categories,
    hfModels: hfModelOptions,
    pmModels: pmModelOptions
  };
}

export async function exportFullRawVisits({ userId = null, isSalesOnly = false } = {}) {
  let visitsQuery = supabase
    .from("visits")
    .select(`
      id,
      visited_at,
      author_user_id,
      is_cooperating,
      tt_id,
      tt (
        name,
        city,
        street,
        house,
        lat,
        lng,
        is_active,
        orgs (name, org_code)
      ),
      author:user_profiles!visits_author_user_id_fkey (
        full_name
      ),
      tt_type:tt_types (name),
      price_type:price (category),
      price_seg_low,
      price_seg_mid,
      price_seg_high,
      is_working,
      sells_pillows,
      contact_name,
      contact_position,
      contact_phone,
      contact_email,
      tt_description,
      visit_result_note,
      visit_brands (
        brand:brand_id (
          name,
          is_highfoam
        )
      ),
      visit_manufacturers (
        manufacturer:manufacturer_id (
          name
        ),
        pp,
        kv
      )
    `);

  if (isSalesOnly && userId) {
    visitsQuery = visitsQuery.eq("author_user_id", userId);
  }

  const { data: visits, error } = await visitsQuery.order("visited_at", { ascending: false });

  if (error) {
    console.error("exportFullRawVisits error:", error);
    return [];
  }

  const { data: allBrands } = await supabase
    .from("brands")
    .select("name, is_highfoam, is_pm");

  const { data: mfs } = await supabase
    .from("manufacturers")
    .select("name")
    .order("sort_order", { ascending: true });
    
  return {
    visits: visits || [],
    brandsInfo: allBrands || [],
    manufacturers: mfs ? mfs.map(m => m.name) : []
  };
}
