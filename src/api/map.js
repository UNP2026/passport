import { supabase } from "@/lib/supabase";

export async function fetchMapData() {
  // Fetch all TTs with their orgs
  const { data: tts, error: ttsError } = await supabase
    .from("tt")
    .select(`
      id,
      name,
      lat,
      lng,
      city,
      street,
      house,
      orgs ( name )
    `);

  if (ttsError) {
    console.error("fetchMapData tts error:", ttsError);
    return [];
  }

  // Fetch all visits to aggregate data
  const { data: visits, error: visitsError } = await supabase
    .from("visits")
    .select(`
      tt_id,
      visited_at,
      is_cooperating,
      author:user_profiles!visits_author_user_id_fkey ( full_name ),
      price_type_id,
      tt_type_id,
      visit_brands (
        brand:brand_id (
          name,
          is_highfoam
        )
      )
    `)
    .order("visited_at", { ascending: false });

  if (visitsError) {
    console.error("fetchMapData visits error:", visitsError);
    return [];
  }

  // Fetch prices
  const { data: prices, error: pricesError } = await supabase
    .from("price")
    .select("id, category");
  
  const priceMap = new Map();
  if (!pricesError && prices) {
    prices.forEach(p => priceMap.set(p.id, p.category));
  }

  // Fetch TT types
  const { data: ttTypes, error: ttTypesError } = await supabase
    .from("tt_types")
    .select("id, name");
  
  const typeMap = new Map();
  if (!ttTypesError && ttTypes) {
    ttTypes.forEach(t => typeMap.set(t.id, t.name));
  }

  // Aggregate visits per TT
  const ttMap = new Map();
  tts.forEach(tt => {
    if (tt.lat && tt.lng) {
      ttMap.set(tt.id, {
        id: tt.id,
        name: tt.name,
        lat: tt.lat,
        lng: tt.lng,
        address: `${tt.city || ''}, ${tt.street || ''} ${tt.house || ''}`.trim(),
        orgName: tt.orgs?.name || "Невідома організація",
        typeName: "Інше", // Will be updated from visits
        visitCount: 0,
        lastVisitDate: null,
        lastVisitManager: null,
        lastVisitPrice: null,
        brands: [],
        isCooperating: false
      });
    }
  });

  visits.forEach(v => {
    const tt = ttMap.get(v.tt_id);
    if (tt) {
      tt.visitCount += 1;
      if (!tt.lastVisitDate) {
        // Since visits are ordered descending, the first one encountered is the latest
        tt.lastVisitDate = v.visited_at ? new Date(v.visited_at).toLocaleDateString("uk-UA") : null;
        tt.lastVisitManager = v.author?.full_name || "Невідомий";
        tt.lastVisitPrice = priceMap.get(v.price_type_id) || "Не вказано";
        tt.typeName = typeMap.get(v.tt_type_id) || "Інше";
        tt.isCooperating = v.is_cooperating === true;
        
        if (v.visit_brands && v.visit_brands.length > 0) {
          tt.brands = v.visit_brands.map(vb => vb.brand?.name).filter(Boolean);
        }
      }
    }
  });

  return Array.from(ttMap.values());
}
