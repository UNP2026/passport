import { createClient } from "@supabase/supabase-js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const authHeader = req.headers.authorization;
  const token = authHeader ? authHeader.split(" ")[1] : null;

  const supabase = createClient(
    process.env.VITE_SUPABASE_URL || "",
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || "",
    {
      global: {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      },
    }
  );

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
    userId,
  } = body;

  try {
    if (!process.env.VITE_SUPABASE_URL) {
      throw new Error("VITE_SUPABASE_URL is not defined");
    }

    const orgName = orgTT.orgNameNew || orgTT.orgQuery;
    const ttName = orgTT.ttNameNew || orgTT.ttQuery;

    if (!userId) {
      throw new Error("ID користувача не знайдено. Будь ласка, переконайтеся, що ви авторизовані.");
    }

    let finalOrgId = orgTT.selectedOrgId;
    let finalTTId = orgTT.selectedTTId;

    // 1. Якщо організація нова - створюємо
    if (!finalOrgId && orgName) {
      const { data: lastOrg } = await supabase
        .from("orgs")
        .select("org_code")
        .order("org_code", { ascending: false })
        .limit(1);

      let nextNum = 1;
      if (lastOrg && lastOrg[0]?.org_code) {
        const match = lastOrg[0].org_code.match(/ORG-(\d+)/);
        if (match) nextNum = parseInt(match[1]) + 1;
      }
      const orgCode = `ORG-${String(nextNum).padStart(4, "0")}`;

      const { data: newOrg, error: orgErr } = await supabase
        .from("orgs")
        .insert({
          name: orgName,
          org_code: orgCode,
        })
        .select()
        .single();

      if (orgErr) throw orgErr;
      finalOrgId = newOrg.id;
    }

    // 2. Якщо ТТ нова - створюємо
    if (!finalTTId && ttName) {
      const { data: newTT, error: ttErr } = await supabase
        .from("tt")
        .insert({
          org_id: finalOrgId,
          name: ttName,
          city: address.city,
          street: address.street,
          house: address.house,
          created_by: userId,
          is_active: true,
        })
        .select()
        .single();

      if (ttErr) throw ttErr;
      finalTTId = newTT.id;
    }

    if (!finalTTId) {
      throw new Error("Торгова точка не визначена. Будь ласка, оберіть або введіть назву ТТ.");
    }

    if (!contacts.ttTypeId) {
      throw new Error("Тип торгової точки не обрано. Будь ласка, вкажіть тип ТТ у розділі 'Контакти'.");
    }

    const isCooperating = body.isHighfoamSelected || false;

    // 3. Створюємо візит
    const { data: visit, error: visitErr } = await supabase
      .from("visits")
      .insert({
        tt_id: finalTTId,
        author_user_id: userId,
        visited_at: visitDate,
        tt_type_id: contacts.ttTypeId || null,
        distributor_id: commercial.distributorId || null,
        visit_lat: address.geo?.lat || null,
        visit_lng: address.geo?.lng || null,
        visit_geo_address: address.geo?.resolvedAddress || address.address_text || null,
        price_type_id: commercial.priceCategoryId || null,
        price_seg_low: pricing.econom,
        price_seg_mid: pricing.middle,
        price_seg_high: body.premium || 0,
        is_working: contacts.isActive,
        is_cooperating: isCooperating,
        sells_pillows: commercial.sellsPillows,
        contact_name: contacts.contactName,
        contact_position: contacts.position,
        contact_phone: contacts.phone,
        contact_email: contacts.email,
        tt_description: contacts.ttDescription,
        visit_result_note: note.finalText,
      })
      .select()
      .single();

    if (visitErr) throw visitErr;

    // 4. Зберігаємо виробників
    if (manufacturers.selected.length > 0) {
      const mansToInsert = manufacturers.selected.map((m) => ({
        visit_id: visit.id,
        manufacturer_id: m.manufacturerId || null,
        pp: m.pp,
        kv: m.kv,
      }));
      const { error: mansErr } = await supabase.from("visit_manufacturers").insert(mansToInsert);
      if (mansErr) throw mansErr;
    }

    // 5. Зберігаємо бренди
    const allBrands = [...modelRange.selectedHfBrandIds, ...modelRange.selectedPmBrandIds];
    if (allBrands.length > 0) {
      const brandsToInsert = allBrands.map((bid) => ({
        visit_id: visit.id,
        brand_id: bid || null,
      }));
      const { error: brandsErr } = await supabase.from("visit_brands").insert(brandsToInsert);
      if (brandsErr) throw brandsErr;
    }

    return res.status(200).json({ success: true, visitId: visit.id });
  } catch (error) {
    console.error("Save Visit Error:", error);
    const message = error.message || error.details || "Failed to save visit";
    return res.status(500).json({ 
      error: message,
      details: error.details || null,
      hint: error.hint || null,
      stack: process.env.NODE_ENV === "development" ? error.stack : undefined
    });
  }
}
