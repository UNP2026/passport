import { supabase } from "@/lib/supabase"

export async function getManufacturers() {
  const { data, error } = await supabase
    .from("manufacturers")
    .select("id, name")
    .eq("is_active", true)
    .order("sort_order")

  if (error) {
    console.error("getManufacturers error:", error)
    return []
  }

  return (data || []).map(item => ({
    id: item.id,
    label: item.name
  }))
}
