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

/** Canonical category gate for photography package experiences. */
export function isPhotographer(provider: unknown): boolean {
  if (!provider || typeof provider !== 'object') return false;
  const row = provider as Record<string, unknown>;
  const details = (row.vendor_details ?? row.category_details ?? {}) as Record<string, unknown>;
  return [row.profession, row.category, row.category_name, details.category, details.category_name, details.profession]
    .some(value => String(value ?? '').trim().toLowerCase().replace(/[\s-]+/g, '_') === 'photographer');
}

/** Canonical category gate for catering service providers. */
export function isCaterer(provider: unknown): boolean {
  if (!provider || typeof provider !== 'object') return false;
  const row = provider as Record<string, unknown>;
  const details = (row.vendor_details ?? row.category_details ?? {}) as Record<string, unknown>;
  return [row.profession, row.category, row.category_name, details.category, details.category_name, details.profession]
    .some(value => String(value ?? '').trim().toLowerCase().replace(/[\s-]+/g, '_') === 'catering_services');
}

/** Canonical category gate for videography/cinematography providers. */
export function isVideographer(provider: unknown): boolean {
  if (!provider || typeof provider !== 'object') return false;
  const row = provider as Record<string, unknown>;
  const details = (row.vendor_details ?? row.category_details ?? {}) as Record<string, unknown>;
  return [row.profession, row.category, row.category_name, details.category, details.category_name, details.profession]
    .some(value => {
      const n = String(value ?? '').trim().toLowerCase().replace(/[\s-]+/g, '_');
      return n === 'videographer' || n === 'cinematographer';
    });
}
