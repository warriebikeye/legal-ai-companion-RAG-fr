// src/utils/countries.js
// Single source of truth for supported countries + their currency, shared
// between HomePage (jurisdiction picker) and UpgradePage (pricing).

export const COUNTRIES = [
  { name: "Nigeria",      flag: "🇳🇬", currency: "NGN" },
  { name: "Kenya",        flag: "🇰🇪", currency: "KES" },
  { name: "Ghana",        flag: "🇬🇭", currency: "GHS" },
  { name: "South Africa", flag: "🇿🇦", currency: "ZAR" },
  { name: "Tanzania",     flag: "🇹🇿", currency: "TZS" },
  { name: "Liberia",      flag: "🇱🇷", currency: "LRD" },
];

export const USER_COUNTRY_KEY = "userCountry";

export function getCountry(name) {
  return COUNTRIES.find((c) => c.name === name) || null;
}

// Best-effort IP geolocation. Resolves to a country name from COUNTRIES,
// or null if detection fails or the visitor's country isn't supported yet.
export async function detectCountryName() {
  try {
    const res = await fetch("https://ipapi.co/json/");
    const data = await res.json();
    const found = COUNTRIES.find((c) => c.name === data.country_name);
    return found ? found.name : null;
  } catch (err) {
    console.warn("Auto-location failed:", err);
    return null;
  }
}
