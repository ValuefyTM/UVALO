/** Short device name from a user agent: "Chrome pe Android", "Safari pe iPhone"… */
export function device(ua: string | null) {
  if (!ua) return "Dispozitiv necunoscut";
  const os = /iPhone/.test(ua) ? "iPhone" : /iPad/.test(ua) ? "iPad" : /Android/.test(ua) ? "Android" : /Windows/.test(ua) ? "Windows" : /Mac OS X/.test(ua) ? "Mac" : /Linux/.test(ua) ? "Linux" : "";
  const br = /Edg\//.test(ua) ? "Edge" : /OPR\//.test(ua) ? "Opera" : /SamsungBrowser/.test(ua) ? "Samsung Internet" : /Firefox\//.test(ua) ? "Firefox" : /CriOS|Chrome\//.test(ua) ? "Chrome" : /Safari\//.test(ua) ? "Safari" : "Browser";
  return os ? `${br} pe ${os}` : br;
}

/** A phone or tablet browser (the inspection app is for those; the platform installs only on a computer). iPad in desktop mode passes as a Mac. */
export const isPhoneUa = (ua: string) => /Android|iPhone|iPad|iPod|Mobile|webOS|BlackBerry|Opera Mini/i.test(ua);
