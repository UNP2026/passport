import { supabase } from "@/lib/supabase" 

export async function searchOrgs(query) {
  let q = supabase
    .from("orgs")
    .select("id, name, org_code")
    .order("name")
    .limit(20)

  if (query && query.length > 0) {
    q = q.ilike("name", `%${query}%`)
  }

  const { data, error } = await q

  if (error) {
    console.error("searchOrgs error:", error)
    return []
  }

  return data || []
}