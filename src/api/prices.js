import { supabase } from "@/lib/supabase"

export async function getPriceCategories() {
  const { data, error } = await supabase
    .from("price")
    .select("id, category")
    .eq("is_active", true)
    .order("category", { ascending: true })

  if (error) {
    console.error("getPriceCategories error:", error)
    return []
  }

  return (data || []).map(item => ({
    id: item.id,
    label: item.category
  }))
}
