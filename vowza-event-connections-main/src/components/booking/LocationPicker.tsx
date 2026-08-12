/**
 * LocationPicker — Reusable cascading location selector for Vowza
 * Supports: State→District→Town dropdowns, GPS detection, reverse geocoding,
 * Google Maps link, manual entry fallback.
 * Usable in: Customer booking, Artist onboarding, Vendor profile.
 */
import React, { useState, useCallback, useMemo } from 'react';
import { MapPin, Navigation, Loader2, ExternalLink, AlertCircle } from 'lucide-react';
import { getStateNames, getDistrictNames, getTownsForDistrict } from '@/data/indiaLocations';
import { validateTownCity, validateArea, validatePincode, validateAddress } from '@/utils/validation';

export interface LocationData {
  country: string;
  state: string;
  district: string;
  town_city: string;
  locality: string;
  venue_name: string;
  address_line: string;
  pincode: string;
  latitude: number | null;
  longitude: number | null;
  location_source: 'MANUAL' | 'CURRENT_LOCATION' | 'MAP_SELECT' | '';
}

export const emptyLocationData: LocationData = {
  country: 'India',
  state: '',
  district: '',
  town_city: '',
  locality: '',
  venue_name: '',
  address_line: '',
  pincode: '',
  latitude: null,
  longitude: null,
  location_source: '',
};

export function validateLocationData(loc: LocationData): string | null {
  if (!loc.state) return 'Please select a state';
  if (!loc.district) return 'Please select a district';
  if (!loc.town_city.trim()) return 'Please select or enter a town/city';
  const cityCheck = validateTownCity(loc.town_city);
  if (!cityCheck.valid) return cityCheck.error;
  if (!loc.locality.trim()) return 'Please enter area/locality';
  const areaCheck = validateArea(loc.locality);
  if (!areaCheck.valid) return areaCheck.error;
  if (loc.venue_name.trim()) {
    const venueCheck = validateAddress(loc.venue_name);
    if (!venueCheck.valid) return venueCheck.error;
  } else {
    return 'Please enter venue/exact location';
  }
  if (!loc.pincode || loc.pincode.length !== 6) return 'Please enter a valid 6-digit pincode';
  const pincodeCheck = validatePincode(loc.pincode);
  if (!pincodeCheck.valid) return pincodeCheck.error;
  return null;
}

/** Light validation — no venue required (for artist onboarding) */
export function validateLocationDataLight(loc: LocationData): string | null {
  if (!loc.state) return 'Please select a state';
  if (!loc.district) return 'Please select a district';
  if (!loc.town_city.trim()) return 'Please select or enter a town/city';
  const cityCheck = validateTownCity(loc.town_city);
  if (!cityCheck.valid) return cityCheck.error;
  if (loc.locality && loc.locality.trim()) {
    const areaCheck = validateArea(loc.locality);
    if (!areaCheck.valid) return areaCheck.error;
  }
  if (!loc.pincode || loc.pincode.length !== 6) return 'Please enter a valid 6-digit pincode';
  const pincodeCheck = validatePincode(loc.pincode);
  if (!pincodeCheck.valid) return pincodeCheck.error;
  return null;
}

interface Props {
  value: LocationData;
  onChange: (loc: LocationData) => void;
  /** Hide venue field (e.g. for artist onboarding) */
  hideVenue?: boolean;
  /** Compact mode — less padding */
  compact?: boolean;
  /** Custom title (default: "Event / Service Location") */
  title?: string;
}

const inputClass = 'w-full rounded-xl border border-[#e7d9c4] bg-white px-3.5 py-2.5 text-sm text-[#3d1924] outline-none transition placeholder:text-stone-400 focus:border-[#8b1538] focus:ring-2 focus:ring-[#8b1538]/15';
const selectClass = 'w-full rounded-xl border border-[#e7d9c4] bg-white px-3.5 py-2.5 text-sm text-[#3d1924] outline-none transition focus:border-[#8b1538] focus:ring-2 focus:ring-[#8b1538]/15 pr-9 bg-no-repeat bg-[length:10px_10px] bg-[right_14px_center] disabled:opacity-50 disabled:cursor-not-allowed';
const ARROW_STYLE: React.CSSProperties = { backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='10' viewBox='0 0 10 10'%3E%3Cpath fill='%235a3440' d='M5 7L1 3h8z'/%3E%3C/svg%3E\")" };
const labelClass = 'text-sm font-semibold text-[#3d1924]';

export default function LocationPicker({ value, onChange, hideVenue, compact, title }: Props) {
  const [detecting, setDetecting] = useState(false);
  const [geoError, setGeoError] = useState('');
  const [geocoding, setGeocoding] = useState(false);

  const states = useMemo(() => getStateNames(), []);
  const districts = useMemo(() => value.state ? getDistrictNames(value.state) : [], [value.state]);
  const towns = useMemo(() => (value.state && value.district) ? getTownsForDistrict(value.state, value.district) : [], [value.state, value.district]);

  const update = useCallback((patch: Partial<LocationData>) => {
    onChange({ ...value, ...patch });
  }, [value, onChange]);

  // Reverse geocode using Nominatim (free, no API key)
  const reverseGeocode = useCallback(async (lat: number, lng: number) => {
    setGeocoding(true);
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&addressdetails=1&accept-language=en`, {
        headers: { 'User-Agent': 'Vowza/1.0' }
      });
      if (!res.ok) return;
      const data = await res.json();
      const addr = data.address || {};

      // Map Nominatim fields to our structure
      const detectedState = addr.state || '';
      const detectedDistrict = addr.state_district || addr.county || '';
      const detectedTown = addr.city || addr.town || addr.village || addr.hamlet || '';
      const detectedLocality = addr.suburb || addr.neighbourhood || addr.road || '';
      const detectedPincode = addr.postcode || '';

      // Only populate fields where we got data — try to match against our dataset
      const matchedState = states.find(s => s.toLowerCase() === detectedState.toLowerCase()) || '';
      let matchedDistrict = '';
      if (matchedState) {
        const dList = getDistrictNames(matchedState);
        matchedDistrict = dList.find(d => d.toLowerCase() === detectedDistrict.toLowerCase()) ||
          dList.find(d => detectedDistrict.toLowerCase().includes(d.toLowerCase())) || '';
      }

      update({
        state: matchedState || value.state,
        district: matchedDistrict || (matchedState ? '' : value.district),
        town_city: detectedTown || value.town_city,
        locality: detectedLocality || value.locality,
        pincode: detectedPincode || value.pincode,
        latitude: lat,
        longitude: lng,
        location_source: 'CURRENT_LOCATION',
      });
    } catch {
      // Silently fail geocoding — GPS coords are still captured
    } finally {
      setGeocoding(false);
    }
  }, [value, states, update]);

  const detectLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setGeoError('Geolocation is not supported by your browser.');
      return;
    }
    setDetecting(true);
    setGeoError('');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        update({ latitude, longitude, location_source: 'CURRENT_LOCATION' });
        setDetecting(false);
        reverseGeocode(latitude, longitude);
      },
      (err) => {
        setDetecting(false);
        if (err.code === 1) setGeoError('Location access was denied. You can select your location manually below.');
        else setGeoError('Unable to detect your current location. Please enter manually.');
      },
      { enableHighAccuracy: true, timeout: 12000 }
    );
  }, [update, reverseGeocode]);

  const handleStateChange = (newState: string) => {
    update({ state: newState, district: '', town_city: '', locality: '', pincode: '' });
  };

  const handleDistrictChange = (newDistrict: string) => {
    update({ district: newDistrict, town_city: '' });
  };

  const mapUrl = value.latitude && value.longitude
    ? `https://www.google.com/maps?q=${value.latitude},${value.longitude}&z=15`
    : null;

  const padding = compact ? 'space-y-3' : 'space-y-4';

  return (
    <div className={padding}>
      <div className="flex items-center gap-2 mb-1">
        <MapPin className="w-4 h-4 text-[#8b1538]" />
        <h3 className="text-base font-bold text-[#3d1924]">{title || 'Event / Service Location'}</h3>
      </div>

      {/* GPS Detection */}
      <div className="rounded-xl border border-[#e7d9c4] bg-[#fffdf9] p-3">
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={detectLocation} disabled={detecting || geocoding}
            className="inline-flex items-center gap-2 rounded-lg border border-[#8b1538]/20 bg-[#8b1538]/5 px-4 py-2.5 text-sm font-semibold text-[#8b1538] hover:bg-[#8b1538]/10 transition disabled:opacity-50">
            {detecting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Navigation className="h-4 w-4" />}
            {detecting ? 'Detecting...' : '📍 Use My Current Location'}
          </button>
          {mapUrl && (
            <a href={mapUrl} target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-sm font-medium text-emerald-700 hover:bg-emerald-100 transition">
              <ExternalLink className="h-3.5 w-3.5" />View on Map
            </a>
          )}
        </div>

        {geocoding && (
          <p className="mt-2 text-xs text-blue-600 flex items-center gap-1.5">
            <Loader2 className="h-3 w-3 animate-spin" />Detecting address from coordinates...
          </p>
        )}
        {value.latitude && value.longitude && !geocoding && (
          <p className="mt-2 text-xs text-emerald-600 font-medium">
            ✓ Location detected ({value.latitude.toFixed(5)}, {value.longitude.toFixed(5)}). Please verify the fields below.
          </p>
        )}
        {geoError && (
          <p className="mt-2 text-xs text-amber-600 flex items-center gap-1.5">
            <AlertCircle className="h-3 w-3 shrink-0" />{geoError}
          </p>
        )}
        <p className="mt-2 text-[11px] text-stone-400">Or enter the event location manually below</p>
      </div>

      {/* State + District */}
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className={labelClass}>State <span className="text-red-500">*</span></span>
          <select className={selectClass} style={ARROW_STYLE} value={value.state} onChange={e => handleStateChange(e.target.value)}>
            <option value="">Select State</option>
            {states.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </label>
        <label className="block">
          <span className={labelClass}>District <span className="text-red-500">*</span></span>
          <select className={selectClass} style={ARROW_STYLE} value={value.district} onChange={e => handleDistrictChange(e.target.value)} disabled={!value.state}>
            <option value="">{value.state ? 'Select District' : 'Select State First'}</option>
            {districts.map(d => <option key={d} value={d}>{d}</option>)}
          </select>
          {value.state && districts.length === 0 && (
            <input className={`${inputClass} mt-1`} value={value.district} onChange={e => update({ district: e.target.value })} placeholder="Enter district" />
          )}
        </label>
      </div>

      {/* Town/City + Pincode */}
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className={labelClass}>Town / City <span className="text-red-500">*</span></span>
          {towns.length > 0 ? (
            <>
              <select className={selectClass} style={ARROW_STYLE} value={towns.includes(value.town_city) ? value.town_city : '__other__'} onChange={e => {
                if (e.target.value === '__other__') update({ town_city: '' });
                else update({ town_city: e.target.value });
              }} disabled={!value.district}>
                <option value="">{value.district ? 'Select Town/City' : 'Select District First'}</option>
                {towns.map(t => <option key={t} value={t}>{t}</option>)}
                <option value="__other__">Other (type below)</option>
              </select>
              {!towns.includes(value.town_city) && value.district && (
                <input className={`${inputClass} mt-1`} value={value.town_city} onChange={e => update({ town_city: e.target.value })} placeholder="Enter town/city name" />
              )}
            </>
          ) : (
            <input className={inputClass} value={value.town_city} onChange={e => update({ town_city: e.target.value })} placeholder={value.district ? 'Enter town or city' : 'Select district first'} disabled={!value.district} />
          )}
        </label>
        <label className="block">
          <span className={labelClass}>Pincode <span className="text-red-500">*</span></span>
          <input className={inputClass} value={value.pincode} onChange={e => {
            const v = e.target.value.replace(/\D/g, '').slice(0, 6);
            update({ pincode: v });
          }} placeholder="6-digit pincode" maxLength={6} inputMode="numeric" />
          {value.pincode && value.pincode.length > 0 && value.pincode.length < 6 && (
            <p className="text-xs text-red-500 mt-1">Must be exactly 6 digits</p>
          )}
        </label>
      </div>

      {/* Locality */}
      <label className="block">
        <span className={labelClass}>Area / Locality <span className="text-red-500">*</span></span>
        <input className={inputClass} value={value.locality} onChange={e => update({ locality: e.target.value })} placeholder="e.g. Madhapur, Banjara Hills, Koramangala" />
      </label>

      {/* Venue */}
      {!hideVenue && (
        <label className="block">
          <span className={labelClass}>Venue / Exact Location <span className="text-red-500">*</span></span>
          <input className={inputClass} value={value.venue_name} onChange={e => update({ venue_name: e.target.value })} placeholder="e.g. Grand Convention Hall, Taj Hotel, Customer Residence" />
        </label>
      )}

      {/* Address line (optional additional details) */}
      <label className="block">
        <span className={labelClass}>Additional Address Details <span className="text-stone-400 font-normal">(optional)</span></span>
        <input className={inputClass} value={value.address_line} onChange={e => update({ address_line: e.target.value })} placeholder="Building name, floor, road, landmark..." />
      </label>

      {/* Location Preview */}
      {value.state && value.district && value.town_city && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-3">
          <p className="text-xs font-semibold text-emerald-700 mb-1">📍 Selected Location</p>
          <p className="text-sm text-emerald-800">
            {[value.venue_name, value.locality, value.town_city, value.district, value.state].filter(Boolean).join(', ')}
            {value.pincode && ` — ${value.pincode}`}
          </p>
          {value.latitude && value.longitude && (
            <p className="text-[11px] text-emerald-600 mt-1">
              Coordinates: {value.latitude.toFixed(5)}, {value.longitude.toFixed(5)}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
