const supabase = require('../supabaseClient');

/**
 * Compute impact figures on delivery.
 *
 * @param {string} materialType — e.g. 'cardboard', 'PET'
 * @param {number} quantityKg — listing quantity (assumed kg)
 * @returns {{ impact_kg_diverted: number, impact_co2e_kg: number }}
 */
async function computeImpact(materialType, quantityKg) {
  // Lookup emission factor
  const { data: factor, error } = await supabase
    .from('emission_factors')
    .select('co2e_kg_per_kg')
    .eq('material_type', materialType)
    .single();

  if (error || !factor) {
    console.warn(`No emission factor found for material_type="${materialType}", using default 3.12`);
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

module.exports = { computeImpact };
