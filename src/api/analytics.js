import { supabase } from "@/lib/supabase";

export async function fetchRealAnalyticsData() {
  // 1. Fetch all visits with related data
  const { data: visits, error: visitsError } = await supabase
    .from("visits")
    .select(`
      id,
      visited_at,
      is_cooperating,
      tt_id,
      tt:tt_id (
        id,
        name,
        city
      ),
      author:user_profiles!visits_author_user_id_fkey (
        full_name
      ),
      visit_brands (
        brand:brand_id (
          name,
          is_highfoam
        )
      )
    `)
    .order("visited_at", { ascending: false });

  if (visitsError) {
    console.error("fetchRealAnalyticsData error:", visitsError);
    return null;
  }

  // Filter for latest visits per TT
  const seenTtIds = new Set();
  const latestVisits = [];
  for (const v of (visits || [])) {
    const ttId = v.tt_id || v.tt?.id;
    if (ttId) {
      if (!seenTtIds.has(ttId)) {
        seenTtIds.add(ttId);
        latestVisits.push(v);
      }
    } else {
      latestVisits.push(v);
    }
  }

  // 2. Fetch all brands to know the full list
  const { data: allBrands, error: brandsError } = await supabase
    .from("brands")
    .select("name, is_highfoam, is_pm")
    .order("name", { ascending: true });

  if (brandsError) {
    console.error("fetchBrands error:", brandsError);
  }

  const brandNames = allBrands ? allBrands.map(b => b.name) : [];

  // 3. Process visits into the format expected by the UI
  const brandCounts = {};
  const processedData = latestVisits.map(v => {
    const brandPresence = {};

    brandNames.forEach(bn => {
      const isPresent = v.visit_brands?.some(vb => vb.brand?.name === bn) || false;
      brandPresence[bn] = isPresent;
      if (isPresent) {
        brandCounts[bn] = (brandCounts[bn] || 0) + 1;
      }
    });

    return {
      id: v.id,
      date: v.visited_at ? new Date(v.visited_at).toISOString().split('T')[0] : "—",
      city: v.tt?.city || "Невідомо",
      agent: v.author?.full_name || "Невідомий",
      pointId: v.tt?.id || null,
      point: v.tt?.name || "Невідома ТТ",
      brandPresence,
      isCooperating: v.is_cooperating === true
    };
  });

  const sortedBrands = Object.entries(brandCounts)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);

  // 4. Extract unique lists for filters
  const cities = [...new Set(processedData.map(d => d.city))].sort();
  const agents = [...new Set(processedData.map(d => d.agent))].sort();
  const points = [...new Set(processedData.map(d => d.point))].sort();

  return {
    raw: processedData,
    brands: sortedBrands,
    brandNames,
    allBrands: allBrands || [],
    cities,
    agents,
    points
  };
}

export async function exportFullRawVisits() {
  const { data: visits, error } = await supabase
    .from("visits")
    .select(`
      id,
      visited_at,
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
    `)
    .order("visited_at", { ascending: false });

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
