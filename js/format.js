/* =========================================================
   FORMAT DE DATES I MARCADOR
   ========================================================= */

const MESOS = ['gen', 'feb', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'oct', 'nov', 'des'];
const DIES = ['dg', 'dl', 'dt', 'dc', 'dj', 'dv', 'ds'];

/** '2026-08-02' → 'Avui', 'Demà', 'ds 8 ago'… */
function formatData(iso) {
  if (!iso) return '';
  // Arriben els dos formats: «2026-08-15» dels partits i «2026-08-15
  // 22:04:14» de tot el que porta hora. Ens quedem amb el dia.
  const d = new Date(String(iso).slice(0, 10) + 'T00:00:00');
  if (isNaN(d)) return iso;

  const avui = new Date();
  avui.setHours(0, 0, 0, 0);
  const dies = Math.round((d - avui) / 86400000);

  if (dies === 0) return 'Avui';
  if (dies === 1) return 'Demà';
  if (dies === -1) return 'Ahir';
  return `${DIES[d.getDay()]} ${d.getDate()} ${MESOS[d.getMonth()]}`;
}

/** '2026-08-02 19:31:04' → '19:31' */
function formatHora(marca) {
  if (!marca) return '';
  const m = String(marca).match(/(\d{2}):(\d{2})/);
  return m ? `${m[1]}:${m[2]}` : '';
}

/** Número del set que s'està jugant. */
function numSetActual(p) {
  return (p.sets?.length || 0) + 1;
}

/**
 * Punts per tancar el set actual. Només per ensenyar-ho a la pantalla:
 * qui decideix de debò quan es tanca és el servidor.
 */
function puntsObjectiu(p) {
  return (p.sets?.length || 0) === 4 ? 15 : 25;
}

/** Sets guanyats. L'API ja els envia; això és per si es pinta un partit
    acabat d'actualitzar que encara no els porta. */
function setsGuanyats(p) {
  if (p.sets_guanyats) return p.sets_guanyats;
  return (p.sets || []).reduce((acc, s) => {
    if (s.local > s.visitant) acc.local++;
    else if (s.visitant > s.local) acc.visitant++;
    return acc;
  }, { local: 0, visitant: 0 });
}
