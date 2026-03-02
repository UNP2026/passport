import { supabase } from "@/lib/supabase"

export async function getHighfoamBrands() {
  const { data, error } = await supabase
    .from("brands")
    .select("id, name")
    .eq("is_highfoam", true)
    .order("name", { ascending: true })

  if (error) {
    console.error("getHighfoamBrands error:", error)
    return []
  }
  return data || []
}

export async function getPrivateLabelBrands(orgId) {
  if (!orgId) return []
  
  const { data, error } = await supabase
    .from("brands")
    .select("id, name")
    .eq("is_pm", true)
    .eq("pm_org_id", orgId)
    .order("name", { ascending: true })

  if (error) {
    console.error("getPrivateLabelBrands error:", error)
    return []
  }
  return data || []
}
