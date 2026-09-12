import { supabaseAdmin } from "../api/supabase";

/**
 * Compute environmental impact figures on delivery.
 * Mirrors backend/src/services/impactCalc.js
 */
export async function computeImpact(
  materialType: string,
  quantityKg: number
): Promise<{ impact_kg_diverted: number; impact_co2e_kg: number }> {
  const { data: factor, error } = await supabaseAdmin
    .from("emission_factors")
    .select("co2e_kg_per_kg")
    .eq("material_type", materialType)
    .single();

  if (error || !factor) {
    console.warn(
      `No emission factor found for material_type="${materialType}", using default 3.12`
    );
    return {
      impact_kg_diverted: quantityKg,
      impact_co2e_kg: quantityKg * 3.12,
    };
  }

  return {
    impact_kg_diverted: quantityKg,
    impact_co2e_kg: quantityKg * parseFloat(factor.co2e_kg_per_kg),
  };
}
