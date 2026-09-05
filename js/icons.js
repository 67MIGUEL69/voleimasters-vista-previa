/* =========================================================
   Icones SVG inline (sense dependències externes, funcionen
   sense connexió quan l'app estigui empaquetada com APK).
   ========================================================= */

const ICON_PATHS = {
  ball: '<circle cx="12" cy="12" r="9"/><path d="M12 3c3.6 4.5 3.6 13.5 0 18"/><path d="M3.6 15.2c5.4-.6 12-4.4 15.6-10"/><path d="M4.6 7.4c4.6 3.8 10.6 5.9 16.7 5.9"/>',
  home: '<path d="M3 9.5 12 3l9 6.5V20a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1z"/>',
  calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 11h18"/>',
  trophy: '<path d="M8 3h8v6a4 4 0 0 1-8 0z"/><path d="M8 5H5a3 3 0 0 0 3 3M16 5h3a3 3 0 0 1-3 3"/><path d="M12 13v4M9 21h6M10 21v-2h4v2"/>',
  users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.1a4 4 0 0 1 0 7.75"/>',
  user: '<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
  whistle: '<path d="M22 10.5a5.5 5.5 0 1 1-11 0 5.5 5.5 0 0 1 11 0z"/><path d="M11.2 8H3a1 1 0 0 0-1 1v3a1 1 0 0 0 1 1h8.2"/><circle cx="16.5" cy="10.5" r="1.6"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  minus: '<path d="M5 12h14"/>',
  play: '<path d="M6 4.5v15l13-7.5z"/>',
  stop: '<rect x="5" y="5" width="14" height="14" rx="2"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.5 2"/>',
  pin: '<path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0z"/><circle cx="12" cy="10" r="2.6"/>',
  left: '<path d="M15 5 8 12l7 7"/>',
  right: '<path d="M9 5l7 7-7 7"/>',
  undo: '<path d="M3 4v6h6"/><path d="M3.5 14a8.5 8.5 0 1 0 2-8.8L3 10"/>',
  moon: '<path d="M21 12.8A9 9 0 1 1 11.2 3 7 7 0 0 0 21 12.8z"/>',
  sun: '<circle cx="12" cy="12" r="4.2"/><path d="M12 2v2M12 20v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M2 12h2M20 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4"/>',
  logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="M16 17l5-5-5-5M21 12H9"/>',
  mail: '<rect x="2.5" y="4.5" width="19" height="15" rx="2"/><path d="m3 6.5 9 6 9-6"/>',
  lock: '<rect x="4.5" y="10.5" width="15" height="10" rx="2"/><path d="M8 10.5V7a4 4 0 0 1 8 0v3.5"/>',
  activity: '<path d="M22 12h-4l-3 8-6-16-3 8H2"/>',
  check: '<path d="M20 6 9 17l-5-5"/>',
  checkCircle: '<circle cx="12" cy="12" r="9"/><path d="m8.5 12 2.5 2.5 4.5-5"/>',
  alert: '<path d="M12 3.5 22 20H2z"/><path d="M12 10v4M12 17.2v.1"/>',
  list: '<path d="M8 6h13M8 12h13M8 18h13M3.5 6h.01M3.5 12h.01M3.5 18h.01"/>',
  medal: '<circle cx="12" cy="15" r="5.5"/><path d="M8.5 10 6 3M15.5 10 18 3M9.5 3h5"/>',
  chart: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
  news: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M7 8h6M7 12h10M7 16h10"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8v.1"/>',
  history: '<path d="M3 4v6h6"/><path d="M3.5 14a8.5 8.5 0 1 0 2-8.8L3 10"/><path d="M12 8v4.5l3 1.8"/>',
  shield: '<path d="M12 3l8 3v6c0 5-3.5 8.2-8 9-4.5-.8-8-4-8-9V6z"/>',
  wifiOff: '<path d="M3 3l18 18"/><path d="M8.5 16.4a5 5 0 0 1 7 0"/><path d="M5 12.9a10 10 0 0 1 4-2.5"/><path d="M15 10.4a10 10 0 0 1 4 2.5"/><path d="M2 8.8A15 15 0 0 1 7.5 6M16.5 6A15 15 0 0 1 22 8.8"/><path d="M12 20h.01"/>',
  server: '<rect x="3" y="4" width="18" height="7" rx="2"/><rect x="3" y="13" width="18" height="7" rx="2"/><path d="M7 7.5h.01M7 16.5h.01"/>',
  key: '<circle cx="8" cy="15" r="4"/><path d="m10.8 12.2 8.2-8.2M17 6l2 2M14 9l2 2"/>',
  up: '<path d="M12 19V5M6 11l6-6 6 6"/>',
  expandir: '<path d="M4 9V5h4M20 15v4h-4M20 9V5h-4M4 15v4h4"/>',
  contraure: '<path d="M8 5v4H4M16 19v-4h4M16 5v4h4M8 19v-4H4"/>',
  close: '<path d="M18 6 6 18M6 6l12 12"/>',
  camera: '<path d="M4 8h3l1.6-2.2h6.8L17 8h3a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z"/><circle cx="12" cy="13.5" r="3.6"/>',
  edit: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>',
  download: '<path d="M12 3v12M7 11l5 5 5-5"/><path d="M4 20h16"/>',
  bell: '<path d="M18 8a6 6 0 1 0-12 0c0 6-2 7-2 7h16s-2-1-2-7"/><path d="M10.3 21a1.9 1.9 0 0 0 3.4 0"/>',
  down: '<path d="M12 5v14M6 13l6 6 6-6"/>',
};

/** Retorna el marcatge SVG d'una icona. */
function icon(name, cls = 'icon') {
  const path = ICON_PATHS[name] || ICON_PATHS.info;
  return `<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${path}</svg>`;
}

/** Variant amb farciment (per icones sòlides com el play). */
function iconFilled(name, cls = 'icon') {
  const path = ICON_PATHS[name] || ICON_PATHS.info;
  return `<svg class="${cls}" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">${path}</svg>`;
}
