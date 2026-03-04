import { createClient } from "@supabase/supabase-js";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const url = process.env.VITE_SUPABASE_URL;
  const anon = process.env.VITE_SUPABASE_ANON_KEY;
  if (!url || !anon) return res.status(500).json({ error: "Missing SUPABASE_URL or SUPABASE_ANON_KEY" });

  const authHeader = req.headers.authorization || "";
  if (!authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Not authenticated (missing Bearer token)" });
  }

  // ВАЖНО: прокидываем токен пользователя внутрь Supabase client,
  // чтобы в Postgres появился контекст и auth.uid() работал
  const supabase = createClient(url, anon, {
    global: { headers: { Authorization: authHeader } },
  });

  // Получаем реального пользователя из токена
  const { data: userData, error: userErr } = await supabase.auth.getUser();
  if (userErr || !userData?.user) {
    return res.status(401).json({ error: "Invalid session" });
  }
  const userId = userData.user.id;

  const body = req.body;
  const {
    orgTT,
    address,
    contacts,
    commercial,
    manufacturers,
    modelRange,
    pricing,
    note,
    visitDate,
  } = body;

  try {
    const orgName = orgTT?.orgNameNew || orgTT?.orgQuery;
    const ttName = orgTT?.ttNameNew || orgTT?.ttQuery;

    let finalOrgId = orgTT?.selectedOrgId || null;
    let finalTTId = orgTT?.selectedTTId || null;

    // 1) org create (если нужно)
    if (!finalOrgId && orgName) {
      const { data: lastOrg, error: lastOrgErr } = await supabase
        .from("orgs")
        .select("org_code")
        .order("org_code", { ascending: false })
        .limit(1);

      if (lastOrgErr) throw lastOrgErr;

      let nextNum = 1;
      const lastCode = lastOrg?.[0]?.org_code;
      const match = lastCode?.match(/ORG-(\d+)/);
      if (match) nextNum = parseInt(match[1], 10) + 1;

      const orgCode = `ORG-${String(nextNum).padStart(4, "0")}`;

      const { data: newOrg, error: orgErr } = await supabase
        .from("orgs")
        .insert({ name: orgName, org_code: orgCode })
        .select()
        .single();

      if (orgErr) throw orgErr;
      finalOrgId = newOrg.id;
    }

    // 2) tt create (если нужно)
    if (!finalTTId && ttName) {
      if (!finalOrgId) throw new Error("org_id is required to create TT");

      const { data: newTT, error: ttErr } = await supabase
        .from("tt")
        .insert({
          org_id: finalOrgId,
          name: ttName,
          city: address?.city || null,
          street: address?.street || null,
          house: address?.house || null,
          created_by: userId,      // под RLS будет проверка created_by = auth.uid()
          is_active: true,
        })
        .select()
        .single();

      if (ttErr) throw ttErr;
      finalTTId = newTT.id;
    }

    if (!finalTTId) throw new Error("TT is not defined");

    const isCooperating = body.isHighfoamSelected || false;

    // 3) visit create
    const { data: visit, error: visitErr } = await supabase
      .from("visits")
      .insert({
        tt_id: finalTTId,
        author_user_id: userId,
        visited_at: visitDate,
        tt_type_id: contacts?.ttTypeId || null,
        distributor_id: commercial?.distributorId || null,
        visit_lat: address?.geo?.lat || null,
        visit_lng: address?.geo?.lng || null,
        visit_geo_address: address?.geo?.resolvedAddress || address?.address_text || null,
        price_type_id: commercial?.priceCategoryId || null,
        price_seg_low: pricing?.econom ?? null,
        price_seg_mid: pricing?.middle ?? null,
        price_seg_high: body?.premium ?? 0,
        is_working: contacts?.isActive ?? null,
        is_cooperating: isCooperating,
        sells_pillows: commercial?.sellsPillows ?? null,
        contact_name: contacts?.contactName || null,
        contact_position: contacts?.position || null,
        contact_phone: contacts?.phone || null,
        contact_email: contacts?.email || null,
        tt_description: contacts?.ttDescription || null,
        visit_result_note: note?.finalText || null,
      })
      .select()
      .single();

    if (visitErr) throw visitErr;

    // 4) manufacturers
    if (manufacturers?.selected?.length) {
      const mansToInsert = manufacturers.selected.map((m) => ({
        visit_id: visit.id,
        manufacturer_id: m.manufacturerId,
        pp: m.pp,
        kv: m.kv,
      }));
      const { error: mansErr } = await supabase.from("visit_manufacturers").insert(mansToInsert);
      if (mansErr) throw mansErr;
    }

    // 5) brands
    const allBrands = [
      ...(modelRange?.selectedHfBrandIds || []),
      ...(modelRange?.selectedPmBrandIds || []),
    ];
    if (allBrands.length) {
      const brandsToInsert = allBrands.map((bid) => ({ visit_id: visit.id, brand_id: bid }));
      const { error: brandsErr } = await supabase.from("visit_brands").insert(brandsToInsert);
      if (brandsErr) throw brandsErr;
    }

    return res.status(200).json({ success: true, visitId: visit.id });
  } catch (error) {
    console.error("Save Visit Error:", error);
    return res.status(500).json({
      error: error.message || "Failed to save visit",
      stack: process.env.NODE_ENV === "development" ? error.stack : undefined,
    });
  }
}