/** Canonical category gate for features that apply only to Water Suppliers. */
export function isWaterSupplier(provider: unknown): boolean {
  if (!provider || typeof provider !== 'object') return false;
  const row = provider as Record<string, unknown>;
  const details = (row.vendor_details ?? row.category_details ?? {}) as Record<string, unknown>;
  const candidates = [
    row.profession,
    row.category,
    row.category_name,
    details.category,
    details.category_name,
    details.profession,
    details.business_category,
  ];

  return candidates.some((value) => {
    const normalized = String(value ?? '')
      .trim()
      .toLowerCase()
      .replace(/[\s-]+/g, '_');
    return normalized === 'water_supplier' || normalized === 'drinking_water_supplier';
  });
}
