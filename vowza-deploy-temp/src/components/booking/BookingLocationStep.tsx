import { useState } from 'react';
import { MapPin, Navigation, Loader2 } from 'lucide-react';

// Indian states & UTs
const STATES = ['Andhra Pradesh','Arunachal Pradesh','Assam','Bihar','Chhattisgarh','Goa','Gujarat','Haryana','Himachal Pradesh','Jharkhand','Karnataka','Kerala','Madhya Pradesh','Maharashtra','Manipur','Meghalaya','Mizoram','Nagaland','Odisha','Punjab','Rajasthan','Sikkim','Tamil Nadu','Telangana','Tripura','Uttar Pradesh','Uttarakhand','West Bengal','Andaman & Nicobar','Chandigarh','Dadra & Nagar Haveli','Daman & Diu','Delhi','Jammu & Kashmir','Ladakh','Lakshadweep','Puducherry'];

export interface BookingLocation {
  state: string;
  district: string;
  town_city: string;
  exact_address: string;
  pincode: string;
  landmark: string;
  venue_name: string;
  latitude: number | null;
  longitude: number | null;
  location_source: 'MANUAL' | 'CURRENT_LOCATION' | 'SEARCH' | '';
}

interface Props {
  value: BookingLocation;
  onChange: (loc: BookingLocation) => void;
}

const inputClass = 'w-full rounded-xl border border-[#e7d9c4] bg-white px-3.5 py-2.5 text-sm outline-none transition placeholder:text-stone-400 focus:border-[#8b1538] focus:ring-2 focus:ring-[#8b1538]/15';

export default function BookingLocationStep({ value, onChange }: Props) {
  const [detecting, setDetecting] = useState(false);
  const [geoError, setGeoError] = useState('');

  const detectLocation = () => {
    if (!navigator.geolocation) { setGeoError('Geolocation not supported by your browser.'); return; }
    setDetecting(true); setGeoError('');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        onChange({ ...value, latitude: pos.coords.latitude, longitude: pos.coords.longitude, location_source: 'CURRENT_LOCATION' });
        setDetecting(false);
      },
      (err) => {
        setDetecting(false);
        if (err.code === 1) setGeoError("Location access wasn't allowed. You can enter the event location manually.");
        else setGeoError("Couldn't detect your location. Please enter manually.");
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-1">
        <MapPin className="w-4 h-4 text-[#8b1538]" />
        <h3 className="text-base font-bold text-[#3d1924]">Event / Service Location</h3>
      </div>

      {/* Use Current Location */}
      <div className="rounded-xl border border-[#e7d9c4] bg-[#fffdf9] p-3">
        <button type="button" onClick={detectLocation} disabled={detecting}
          className="inline-flex items-center gap-2 rounded-lg border border-[#8b1538]/20 bg-[#8b1538]/5 px-4 py-2.5 text-sm font-semibold text-[#8b1538] hover:bg-[#8b1538]/10 transition disabled:opacity-50">
          {detecting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Navigation className="h-4 w-4" />}
          {detecting ? 'Detecting location...' : '📍 Use My Current Location'}
        </button>
        {value.latitude && value.longitude && value.location_source === 'CURRENT_LOCATION' && (
          <p className="mt-2 text-xs text-emerald-600 font-medium">✓ GPS coordinates captured. Please fill in the address details below.</p>
        )}
        {geoError && <p className="mt-2 text-xs text-amber-600">{geoError}</p>}
        <p className="mt-2 text-[11px] text-stone-400">Or enter the event location manually below</p>
      </div>

      {/* State */}
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="text-sm font-semibold text-[#3d1924]">State <span className="text-red-500">*</span></span>
          <select className={inputClass} value={value.state} onChange={e => onChange({ ...value, state: e.target.value, district: '', town_city: '' })}>
            <option value="">Select State</option>
            {STATES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </label>
        <label className="block">
          <span className="text-sm font-semibold text-[#3d1924]">District <span className="text-red-500">*</span></span>
          <input className={inputClass} value={value.district} onChange={e => onChange({ ...value, district: e.target.value, town_city: '' })} placeholder={value.state ? "Enter district" : "Select state first"} disabled={!value.state} />
        </label>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="text-sm font-semibold text-[#3d1924]">Town / City <span className="text-red-500">*</span></span>
          <input className={inputClass} value={value.town_city} onChange={e => onChange({ ...value, town_city: e.target.value })} placeholder={value.district ? "Enter town or city" : "Enter district first"} disabled={!value.district} />
        </label>
        <label className="block">
          <span className="text-sm font-semibold text-[#3d1924]">Pincode <span className="text-red-500">*</span></span>
          <input className={inputClass} value={value.pincode} onChange={e => { const v = e.target.value.replace(/\D/g, '').slice(0, 6); onChange({ ...value, pincode: v }); }} placeholder="6-digit pincode" maxLength={6} inputMode="numeric" />
          {value.pincode && value.pincode.length > 0 && value.pincode.length < 6 && <p className="text-xs text-red-500 mt-1">Must be 6 digits</p>}
        </label>
      </div>

      <label className="block">
        <span className="text-sm font-semibold text-[#3d1924]">Venue Name</span>
        <input className={inputClass} value={value.venue_name} onChange={e => onChange({ ...value, venue_name: e.target.value })} placeholder="e.g. Grand Convention Hall, Hotel Taj, Customer Residence" />
      </label>

      <label className="block">
        <span className="text-sm font-semibold text-[#3d1924]">Full Venue Address <span className="text-red-500">*</span></span>
        <textarea className={`${inputClass} min-h-[60px] resize-y`} value={value.exact_address} onChange={e => onChange({ ...value, exact_address: e.target.value })} placeholder="Enter complete venue address (building, street, road, area...)" />
      </label>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="text-sm font-semibold text-[#3d1924]">Landmark <span className="text-stone-400 font-normal">(optional)</span></span>
          <input className={inputClass} value={value.landmark} onChange={e => onChange({ ...value, landmark: e.target.value })} placeholder="Near Metro Station, Opposite Hospital" />
        </label>
      </div>
    </div>
  );
}

export function validateLocation(loc: BookingLocation): string | null {
  if (!loc.state) return 'Please select a state';
  if (!loc.district.trim()) return 'Please enter a district';
  if (!loc.town_city.trim()) return 'Please enter a town/city';
  if (!loc.exact_address.trim()) return 'Please enter the full venue address';
  if (!loc.pincode || loc.pincode.length !== 6) return 'Please enter a valid 6-digit pincode';
  return null;
}

export const emptyLocation: BookingLocation = { state: '', district: '', town_city: '', exact_address: '', pincode: '', landmark: '', venue_name: '', latitude: null, longitude: null, location_source: '' };
