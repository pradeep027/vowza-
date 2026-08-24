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

/** Canonical category gate for drone photography/videography operators. */
export function isDroneOperator(provider: unknown): boolean {
  if (!provider || typeof provider !== 'object') return false;
  const row = provider as Record<string, unknown>;
  const details = (row.vendor_details ?? row.category_details ?? {}) as Record<string, unknown>;
  return [row.profession, row.category, row.category_name, details.category, details.category_name, details.profession]
    .some(value => {
      const n = String(value ?? '').trim().toLowerCase().replace(/[\s-]+/g, '_');
      return n === 'drone_photography' || n === 'drone_operator' || n === 'drone_videography';
    });
}

/** Canonical category gate for DJ / disc jockey service providers. */
export function isDJ(provider: unknown): boolean {
  if (!provider || typeof provider !== 'object') return false;
  const row = provider as Record<string, unknown>;
  const details = (row.vendor_details ?? row.category_details ?? {}) as Record<string, unknown>;
  return [row.profession, row.category, row.category_name, details.category, details.category_name, details.profession]
    .some(value => {
      const n = String(value ?? '').trim().toLowerCase().replace(/[\s-]+/g, '_');
      return n === 'dj' || n === 'disc_jockey' || n === 'dj_services';
    });
}

/** Canonical category gate for decorator/event decoration providers. */
export function isDecorator(provider: unknown): boolean {
  if (!provider || typeof provider !== 'object') return false;
  const row = provider as Record<string, unknown>;
  const details = (row.vendor_details ?? row.category_details ?? {}) as Record<string, unknown>;
  return [row.profession, row.category, row.category_name, details.category, details.category_name, details.profession]
    .some(value => {
      const n = String(value ?? '').trim().toLowerCase().replace(/[\s-]+/g, '_');
      return n === 'decorator' || n === 'event_decorator' || n === 'decoration_services' || n === 'floral_decorator' || n === 'wedding_decorator';
    });
}

/** Canonical category gate for makeup artist providers. */
export function isMakeupArtist(provider: unknown): boolean {
  if (!provider || typeof provider !== 'object') return false;
  const row = provider as Record<string, unknown>;
  const details = (row.vendor_details ?? row.category_details ?? {}) as Record<string, unknown>;
  return [row.profession, row.category, row.category_name, details.category, details.category_name, details.profession]
    .some(value => {
      const n = String(value ?? '').trim().toLowerCase().replace(/[\s-]+/g, '_');
      return n === 'makeup_artist' || n === 'bridal_makeup' || n === 'makeup';
    });
}

/** Canonical category gate for mehendi/henna artist providers. */
export function isMehendiArtist(provider: unknown): boolean {
  if (!provider || typeof provider !== 'object') return false;
  const row = provider as Record<string, unknown>;
  const details = (row.vendor_details ?? row.category_details ?? {}) as Record<string, unknown>;
  return [row.profession, row.category, row.category_name, details.category, details.category_name, details.profession]
    .some(value => {
      const n = String(value ?? '').trim().toLowerCase().replace(/[\s-]+/g, '_');
      return n === 'mehendi_artist' || n === 'mehndi_artist' || n === 'mehendi' || n === 'henna_artist';
    });
}

/** Canonical category gate for anchors/hosts/emcees. */
export function isAnchor(provider: unknown): boolean {
  if (!provider || typeof provider !== 'object') return false;
  const row = provider as Record<string, unknown>;
  const details = (row.vendor_details ?? row.category_details ?? {}) as Record<string, unknown>;
  return [row.profession, row.category, row.category_name, details.category, details.category_name, details.profession]
    .some(value => {
      const n = String(value ?? '').trim().toLowerCase().replace(/[\s-]+/g, '_');
      return n === 'anchor' || n === 'host' || n === 'emcee' || n === 'event_anchor' || n === 'event_host' || n === 'mc';
    });
}

/** Canonical category gate for banquet hall / venue providers. */
export function isBanquetHall(provider: unknown): boolean {
  if (!provider || typeof provider !== 'object') return false;
  const row = provider as Record<string, unknown>;
  const details = (row.vendor_details ?? row.category_details ?? {}) as Record<string, unknown>;
  return [row.profession, row.category, row.category_name, details.category, details.category_name, details.profession]
    .some(value => {
      const n = String(value ?? '').trim().toLowerCase().replace(/[\s-]+/g, '_');
      return n === 'banquet_hall' || n === 'banquet' || n === 'venue' || n === 'hall' || n === 'function_hall' || n === 'convention_hall' || n === 'wedding_hall' || n === 'event_venue';
    });
}

/** Canonical category gate for rental service providers (tent, stage, chairs, generator, sound, lighting, etc.). */
export function isRentalService(provider: unknown): boolean {
  if (!provider || typeof provider !== 'object') return false;
  const row = provider as Record<string, unknown>;
  const details = (row.vendor_details ?? row.category_details ?? {}) as Record<string, unknown>;
  return [row.profession, row.category, row.category_name, details.category, details.category_name, details.profession]
    .some(value => {
      const n = String(value ?? '').trim().toLowerCase().replace(/[\s-]+/g, '_');
      return n === 'rental' || n === 'rentals' || n === 'rental_services' || n === 'tent_house' || n === 'shamiana' || n === 'stage_rental' || n === 'furniture_rental' || n === 'generator_rental' || n === 'sound_rental' || n === 'lighting_rental' || n === 'equipment_rental';
    });
}

/** Canonical category gate for pandits / priests / purohits. */
export function isPriest(provider: unknown): boolean {
  if (!provider || typeof provider !== 'object') return false;
  const row = provider as Record<string, unknown>;
  const details = (row.vendor_details ?? row.category_details ?? {}) as Record<string, unknown>;
  return [row.profession, row.category, row.category_name, details.category, details.category_name, details.profession]
    .some(value => {
      const n = String(value ?? '').trim().toLowerCase().replace(/[\s-]+/g, '_');
      return n === 'priest' || n === 'pandit' || n === 'purohit' || n === 'pujari' || n === 'panditji' || n === 'astrologer_priest' || n === 'temple_priest' || n === 'hindu_priest' || n === 'muslim_priest' || n === 'christian_priest' || n === 'vedic_pandit';
    });
}

/** Canonical category gate for band / music band providers. */
export function isBand(provider: unknown): boolean {
  if (!provider || typeof provider !== 'object') return false;
  const row = provider as Record<string, unknown>;
  const details = (row.vendor_details ?? row.category_details ?? {}) as Record<string, unknown>;
  return [row.profession, row.category, row.category_name, details.category, details.category_name, details.profession]
    .some(value => {
      const n = String(value ?? '').trim().toLowerCase().replace(/[\s-]+/g, '_');
      return n === 'music_band' || n === 'maharashtra_band' || n === 'traditional_band' || n === 'instrumental_artist' || n === 'classical_musician' || n === 'wedding_band' || n === 'dhol_band' || n === 'brass_band';
    });
}

/** Canonical category gate for singer / vocalist providers. */
export function isSinger(provider: unknown): boolean {
  if (!provider || typeof provider !== 'object') return false;
  const row = provider as Record<string, unknown>;
  const details = (row.vendor_details ?? row.category_details ?? {}) as Record<string, unknown>;
  return [row.profession, row.category, row.category_name, details.category, details.category_name, details.profession]
    .some(value => {
      const n = String(value ?? '').trim().toLowerCase().replace(/[\s-]+/g, '_');
      return n === 'singer';
    });
}

/** Canonical category gate for dancer / dance performance providers. */
export function isDancer(provider: unknown): boolean {
  if (!provider || typeof provider !== 'object') return false;
  const row = provider as Record<string, unknown>;
  const details = (row.vendor_details ?? row.category_details ?? {}) as Record<string, unknown>;
  return [row.profession, row.category, row.category_name, details.category, details.category_name, details.profession]
    .some(value => {
      const n = String(value ?? '').trim().toLowerCase().replace(/[\s-]+/g, '_');
      return n === 'dancer' || n === 'kuchipudi_dancer' || n === 'classical_dancer' || n === 'western_dancer' || n === 'hip_hop_dancer' || n === 'contemporary_dancer';
    });
}

/** Canonical category gate for photographers and videographers (merged category). */
export function isPhotographyOrVideography(provider: unknown): boolean {
  if (!provider || typeof provider !== 'object') return false;
  const row = provider as Record<string, unknown>;
  const details = (row.vendor_details ?? row.category_details ?? {}) as Record<string, unknown>;
  
  // Check for explicit merged category
  const isMerged = [row.profession, row.category, row.category_name, details.category, details.category_name, details.profession]
    .some(value => {
      const n = String(value ?? '').trim().toLowerCase().replace(/[\s-]+/g, '_');
      return n === 'photography_videography' || n === 'photography_and_videography';
    });
  
  return isMerged || isPhotographer(provider) || isVideographer(provider) || isDroneOperator(provider);
}

/** Check if provider offers only photography services. */
export function isPhotographyOnly(provider: unknown): boolean {
  return isPhotographer(provider) && !isVideographer(provider) && !isDroneOperator(provider);
}

/** Check if provider offers only videography services. */
export function isVideographyOnly(provider: unknown): boolean {
  return isVideographer(provider) && !isPhotographer(provider) && !isDroneOperator(provider);
}

/** Check if provider offers both photography and videography services. */
export function isPhotographyAndVideography(provider: unknown): boolean {
  return isPhotographer(provider) && isVideographer(provider);
}
