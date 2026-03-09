import { createClient } from "@supabase/supabase-js";

function asUuidOrNull(v) {
  if (v === undefined || v === null) return null;
  const s = String(v).trim();
  return s === "" ? null : s;
}

function toYmd(d) {
  if (!d) return "unknown-date";

  // если уже ISO
  if (/^\d{4}-\d{2}-\d{2}$/.test(d)) return d;

  // если DD.MM.YYYY
  const m = String(d).match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
  if (m) {
    const [, dd, mm, yyyy] = m;
    return `${yyyy}-${mm}-${dd}`;
  }

  const dt = new Date(d);
  if (isNaN(dt.getTime())) return "unknown-date";
  return dt.toISOString().slice(0, 10);
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "";
  const anon = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || "";
  if (!url || !anon) {
    return res.status(500).json({ error: "Missing SUPABASE_URL or SUPABASE_ANON_KEY" });
  }

  const authHeader = req.headers.authorization || "";
  if (!authHeader.toLowerCase().startsWith("bearer ")) {
    return res.status(401).json({ error: "Not authenticated (missing Bearer token)" });
  }

  const supabase = createClient(url, anon, {
    global: { headers: { Authorization: authHeader } },
  });

  const { data: userData, error: userErr } = await supabase.auth.getUser();
  if (userErr || !userData?.user) {
    return res.status(401).json({ error: "Invalid session" });
  }
  const userId = userData.user.id;

  const body = req.body || {};
  const { orgTT, address, contacts, commercial, manufacturers, modelRange, pricing, note, visitDate } = body;

  try {
    const orgName = orgTT?.orgNameNew || orgTT?.orgQuery;
    const ttName = orgTT?.ttNameNew || orgTT?.ttQuery;

    let finalOrgId = asUuidOrNull(orgTT?.selectedOrgId);
    let finalTTId = asUuidOrNull(orgTT?.selectedTTId);

    // 1) ORG create (если нужно) — генерируем id заранее и пишем drive_folder_id сразу
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

      const orgId = crypto.randomUUID();
      const orgFolder = `orgs/${orgId}/`;

      const { data: newOrg, error: orgErr } = await supabase
        .from("orgs")
        .insert({
          id: orgId,
          name: orgName,
          org_code: orgCode,
          drive_folder_id: orgFolder,
        })
        .select("id, drive_folder_id")
        .single();

      if (orgErr) throw orgErr;
      finalOrgId = newOrg.id;
    }

    // 2) TT create (если нужно) — генерируем id заранее и пишем drive_folder_id сразу
    if (!finalTTId && ttName) {
      if (!finalOrgId) throw new Error("org_id is required to create TT");

      const ttId = crypto.randomUUID();
      const ttFolder = `orgs/${finalOrgId}/tt/${ttId}/`;

      const { data: newTT, error: ttErr } = await supabase
        .from("tt")
        .insert({
          id: ttId,
          org_id: finalOrgId,
          name: ttName,
          city: address?.city ?? null,
          street: address?.street ?? null,
          house: address?.house ?? null,
          is_active: true,
          drive_folder_id: ttFolder,
          // created_by у тебя ставится default/trigger’ом, руками можно не передавать
        })
        .select("id, drive_folder_id")
        .single();

      if (ttErr) throw ttErr;
      finalTTId = newTT.id;
    }

    if (!finalTTId) {
      throw new Error("Торгова точка не визначена. Будь ласка, оберіть або введіть назву ТТ.");
    }

    const ttTypeId = asUuidOrNull(contacts?.ttTypeId);
    if (!ttTypeId) {
      throw new Error("Тип торгової точки не обрано. Будь ласка, вкажіть тип ТТ у розділі 'Контакти'.");
    }

    // если org не создавали в этом запросе (org существующий), но finalOrgId пуст —
    // доберем org_id через tt (на случай, если фронт не передал selectedOrgId)
    if (!finalOrgId) {
      const { data: ttRow, error: ttFetchErr } = await supabase
        .from("tt")
        .select("org_id")
        .eq("id", finalTTId)
        .single();
      if (ttFetchErr) throw ttFetchErr;
      finalOrgId = ttRow.org_id;
    }

    const isCooperating = Boolean(body.isHighfoamSelected);

    // 3) VISIT create — генерируем id заранее и вставляем drive_folder_id сразу (без UPDATE)
    const visitId = crypto.randomUUID();
    const ymd = toYmd(visitDate);
    const visitFolder = `orgs/${finalOrgId}/tt/${finalTTId}/visits/${ymd}_${visitId}/`;

    const { data: visit, error: visitErr } = await supabase
      .from("visits")
      .insert({
        id: visitId,
        tt_id: finalTTId,
        author_user_id: userId,
        visited_at: ymd !== "unknown-date" ? ymd : null,
        tt_type_id: ttTypeId,
        distributor_id: asUuidOrNull(commercial?.distributorId),
        visit_lat: address?.geo?.lat ?? null,
        visit_lng: address?.geo?.lng ?? null,
        visit_geo_address: address?.geo?.resolvedAddress ?? address?.address_text ?? null,
        price_type_id: asUuidOrNull(commercial?.priceCategoryId),
        price_seg_low: pricing?.econom ?? null,
        price_seg_mid: pricing?.middle ?? null,
        price_seg_high: body?.premium ?? 0,
        is_working: contacts?.isActive ?? null,
        is_cooperating: isCooperating,
        sells_pillows: commercial?.sellsPillows ?? null,
        contact_name: contacts?.contactName ?? null,
        contact_position: contacts?.position ?? null,
        contact_phone: contacts?.phone ?? null,
        contact_email: contacts?.email ?? null,
        tt_description: contacts?.ttDescription ?? null,
        visit_result_note: note?.finalText ?? null,
        drive_folder_id: visitFolder,
      })
      .select("id, drive_folder_id")
      .single();

    if (visitErr) throw visitErr;

    // 4) manufacturers
    const mansSelected = (manufacturers?.selected || [])
      .map((m) => ({ ...m, manufacturerId: asUuidOrNull(m.manufacturerId) }))
      .filter((m) => m.manufacturerId);

    if (mansSelected.length) {
      const mansToInsert = mansSelected.map((m) => ({
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
    ]
      .map(asUuidOrNull)
      .filter(Boolean);

    if (allBrands.length) {
      const brandsToInsert = allBrands.map((bid) => ({
        visit_id: visit.id,
        brand_id: bid,
      }));
      const { error: brandsErr } = await supabase.from("visit_brands").insert(brandsToInsert);
      if (brandsErr) throw brandsErr;
    }

    return res.status(200).json({
      success: true,
      visitId: visit.id,
      visitFolder: visit.drive_folder_id,
      orgId: finalOrgId,
      ttId: finalTTId,
    });
  } catch (error) {
    console.error("Save Visit Error:", error);
    const message = error?.message || error?.details || "Failed to save visit";
    return res.status(500).json({
      error: message,
      details: error?.details || null,
      hint: error?.hint || null,
      stack: process.env.NODE_ENV === "development" ? error?.stack : undefined,
    });
  }
}