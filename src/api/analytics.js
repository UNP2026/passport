import { supabase } from "@/lib/supabase";

export async function fetchRealAnalyticsData() {
  // 1. Fetch all visits with related data
  const { data: visits, error: visitsError } = await supabase
    .from("visits")
    .select(`
      id,
      visited_at,
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

  // 2. Fetch all brands to know the full list
  const { data: allBrands, error: brandsError } = await supabase
    .from("brands")
    .select("name, is_highfoam")
    .order("name", { ascending: true });

  if (brandsError) {
    console.error("fetchBrands error:", brandsError);
  }

  const brandNames = allBrands ? allBrands.map(b => b.name) : [];

  // 3. Process visits into the format expected by the UI
  const brandCounts = {};
  const processedData = visits.map(v => {
    const brandPresence = {};
    let hasHighfoam = false;

    brandNames.forEach(bn => {
      const isPresent = v.visit_brands.some(vb => vb.brand?.name === bn);
      brandPresence[bn] = isPresent;
      if (isPresent) {
        brandCounts[bn] = (brandCounts[bn] || 0) + 1;
        const brandObj = allBrands?.find(b => b.name === bn);
        if (brandObj && brandObj.is_highfoam) {
          hasHighfoam = true;
        }
      }
    });

    return {
      id: v.id,
      date: v.visited_at ? new Date(v.visited_at).toISOString().split('T')[0] : "—",
      city: v.tt?.city || "Невідомо",
      agent: v.author?.full_name || "Невідомий",
      point: v.tt?.id || "Невідома ТТ",
      point_name: v.tt?.name || "Невідома ТТ",
      brandPresence,
      hasHighfoam
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
    cities,
    agents,
    points
  };
}
