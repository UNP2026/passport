import { supabase } from "@/lib/supabase"

export async function searchDistributors(query) {
  let q = supabase
    .from("distributors")
    .select("id, name")
    .eq("is_active", true)
    .order("name", { ascending: true })
    .limit(20)

  if (query && query.length > 0) {
    q = q.ilike("name", `%${query}%`)
  }

  const { data, error } = await q

  if (error) {
    console.error("searchDistributors error:", error)
    return []
  }

  return data || []
}
