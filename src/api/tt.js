import { supabase } from "../lib/supabase" // твой путь

export async function searchTT(orgId, query) {
  if (!orgId) return []

  let q = supabase
    .from("tt")
    .select("id, org_id, name, city, street, house, address_text")
    .eq("org_id", orgId)
    .order("name")
    .limit(20)

  if (query && query.length > 0) {
    q = q.ilike("name", `%${query}%`)
  }

  const { data, error } = await q

  if (error) {
    console.error("searchTT error:", error)
    return []
  }
  return data || []
}

export async function getTTById(ttId) {
  if (!ttId) return null

  const { data, error } = await supabase
    .from("tt")
    .select("id, org_id, name, city, street, house, address_text")
    .eq("id", ttId)
    .maybeSingle()

  if (error) {
    console.error("getTTById error:", error)
    return null
  }
  return data || null
}