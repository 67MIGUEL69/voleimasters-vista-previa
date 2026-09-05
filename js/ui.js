/* =========================================================
   COMPONENTS I UTILITATS D'INTERFÍCIE REUTILITZABLES
   ========================================================= */

const $ = sel => document.querySelector(sel);
const $$ = sel => [...document.querySelectorAll(sel)];

/* Accions específiques de la vista activa (les omple cada vista abans de pintar-se) */
const App = { accions: {} };

function esc(str) {
  return String(str).replace(/[&<>"']/g, c => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}

function anar(ruta) {
  // Si ja hi som (p. ex. entrar a #/arbitre des del propi #/arbitre),
  // el hash no canvia i no salta l'esdeveniment: repintem a mà.
  if ((location.hash || '#/inici') === ruta) { pintar(); return; }
  location.hash = ruta;
}

/* ---------- Toast ---------- */

let _toastTimer;
function toast(missatge) {
  const el = $('#toast');
  el.textContent = missatge;
  el.hidden = false;
  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => { el.hidden = true; }, 2200);
}

/* ---------- Diàleg de confirmació ---------- */

function confirmar({ titol, text, confirma = 'Confirmar', perill = false, onOk }) {
  const ov = $('#overlay');
  ov.innerHTML = `
    <div class="sheet">
      <h3>${esc(titol)}</h3>
      <p>${esc(text)}</p>
      <div class="sheet-actions">
        <button class="btn btn-outline" data-accio="cancel">Cancel·lar</button>
        <button class="btn ${perill ? 'btn-danger' : 'btn-primary'}" data-accio="ok">${esc(confirma)}</button>
      </div>
    </div>`;
  ov.hidden = false;

  const tancar = () => { ov.hidden = true; ov.innerHTML = ''; };
  ov.onclick = e => {
    if (e.target === ov || e.target.dataset.accio === 'cancel') return tancar();
    if (e.target.dataset.accio === 'ok') { tancar(); onOk(); }
  };
}

/* ---------- Seccions ---------- */
/*
   Les mateixes per a les dues formes de navegar: barra de pestanyes a
   baix al mòbil, menú horitzontal a dalt a l'escriptori.

   L'última no és fixa: depèn de qui ets. Un àrbitre necessita els seus
   partits a mà; algú d'un equip, el seu equip; i a qui només ve a mirar
   no li serveix de res cap de les dues, així que no li surt.
*/

const SECCIONS_FIXES = [
  { id: 'partits', ruta: '#/partits', nom: 'Partits', icona: 'calendar' },
  { id: 'classificacio', ruta: '#/classificacio', nom: 'Classificació', icona: 'trophy' },
  { id: 'equips', ruta: '#/equips', nom: 'Equips', icona: 'users' },
  { id: 'noticies', ruta: '#/noticies', nom: 'Notícies', icona: 'news' },
];

function seccions() {
  const llista = [...SECCIONS_FIXES];

  // Si algú és àrbitre i a més juga, mana l'arbitratge: és el que fa amb
  // el mòbil a la mà i amb pressa.
  if (Store.esArbitre()) {
    llista.push({ id: 'arbitre', ruta: '#/arbitre', nom: 'Àrbitre', icona: 'whistle' });
  } else if (Store.esCoordinacio()) {
    llista.push({ id: 'admin', ruta: '#/admin', nom: 'Lliga', icona: 'key' });
  } else {
    const equip = Store.elMeuEquip();
    if (equip) {
      llista.push({ id: 'equip', ruta: `#/equip/${equip}`, nom: 'El meu equip', icona: 'shield' });
    }
  }
  return llista;
}

/**
 * On va a parar algú just després d'entrar.
 *
 * A la feina que ha vingut a fer: l'àrbitre als seus partits, la
 * coordinació a la configuració de la lliga i la resta a la portada.
 */
function pantallaDInici() {
  if (Store.esArbitre()) return '#/arbitre';
  if (Store.esCoordinacio()) return '#/admin';
  return '#/inici';
}

/* ---------- Capçalera ---------- */

function renderTopbar({ titol, enrere, accions = true, seccio = null } = {}) {
  const temaIcona = Store.tema === 'dark' ? 'sun' : 'moon';

  const esquerra = enrere
    ? `<button class="icon-btn ghost" data-anar="${esc(enrere)}" aria-label="Enrere">${icon('left')}</button>
       <h1 class="topbar-title">${esc(titol || '')}</h1>`
    : `<a class="brand" data-anar="#/inici">
         <div class="brand-mark" role="img" aria-label="Voleimasters"></div>
         <h1 class="brand-name">Voleimasters<span>.cat</span></h1>
       </a>`;

  // El menú d'escriptori es pinta sempre; el CSS l'amaga al mòbil. Així no
  // cal repintar res quan es gira el mòbil o es canvia la mida de finestra.
  const menu = `
    <nav class="nav-escriptori">
      ${seccions().map(s => `
        <a class="nav-enllac ${s.id === seccio ? 'actiu' : ''}" data-anar="${s.ruta}">${esc(s.nom)}</a>
      `).join('')}
    </nav>`;

  const dreta = accions ? `
    <div class="topbar-actions">
      <button class="icon-btn" data-accio="tema" aria-label="Canviar tema">${icon(temaIcona)}</button>
      <button class="icon-btn" data-anar="#/perfil" aria-label="Perfil">${icon('user')}</button>
    </div>` : '';

  $('#topbar').innerHTML = `<div class="topbar-inner">${esquerra}${enrere ? '' : menu}${dreta}</div>`;
}

/* ---------- Navegació inferior (només mòbil) ---------- */

function renderTabbar(actiu) {
  const bar = $('#tabbar');
  if (!actiu) { bar.hidden = true; return; }
  bar.hidden = false;
  bar.innerHTML = seccions().map(t => `
    <button class="tab ${t.id === actiu ? 'active' : ''}" data-anar="${t.ruta}">
      ${icon(t.icona)}
      <span>${t.nom}</span>
      <i class="tab-dot"></i>
    </button>`).join('');
}

/** Capçalera + navegació d'una pantalla de secció, d'un sol cop. */
function renderNav(seccio) {
  renderTopbar({ seccio });
  renderTabbar(seccio);
}

/* ---------- Estats de càrrega i d'error ---------- */

function blocCarregant(text = 'Carregant…') {
  return `<div class="carregant"><span class="spinner"></span> ${esc(text)}</div>`;
}

/**
 * Pantalla d'error. Distingeix el cas de «no arribo al servidor», que és
 * el que passarà de veritat al pavelló quan la cobertura falli, de la
 * resta: no és el mateix consell.
 */
function blocError(e, reintentar = true) {
  const senseXarxa = e?.estat === 0;
  return `
    <div class="card card-pad" style="text-align:center">
      ${icon(senseXarxa ? 'wifiOff' : 'alert', 'icon')}
      <h3 style="font-size:16px;font-weight:800;margin-top:10px">
        ${senseXarxa ? 'Sense connexió' : 'Alguna cosa ha fallat'}
      </h3>
      <p class="page-sub">${esc(e?.message || 'Torna-ho a provar.')}</p>
      ${senseXarxa ? `
        <p class="page-sub" style="margin-top:8px">
          Comprova que tens dades o wifi. Els marcadors no es guarden al
          mòbil a propòsit: val més no ensenyar-ne cap que ensenyar-ne un
          de fa mitja hora.
        </p>` : ''}
      ${reintentar ? `
        <button class="btn btn-primary btn-block" data-accio="reintentar" style="margin-top:16px">
          Tornar-ho a provar
        </button>` : ''}
    </div>`;
}

/* ---------- Peces reutilitzables ---------- */

/**
 * Escut de l'equip, amb el color que ha triat a la seva fitxa.
 *
 * Sobre les targetes fosques (marcador en directe, capçalera de partit)
 * el color NO omple l'escut: hi fa de vora. Si l'omplís, un equip amb el
 * verd de la marca desapareixeria dins d'una targeta que també és verda.
 */
function crest(equip, extra = '') {
  const color = /^#[0-9a-f]{6}$/i.test(equip?.color || '') ? equip.color : null;
  const sobreFosc = extra.includes('crest-outline');

  let estil = '';
  if (color) {
    estil = sobreFosc
      ? ` style="border-color:${color};box-shadow:inset 0 0 0 2px ${color}"`
      : ` style="background:${color};color:#fff"`;
  }
  return `<div class="crest ${extra}"${estil}>${esc(equip?.sigles || '·')}</div>`;
}

function pillEstat(p) {
  if (p.estat === 'directe') return `<span class="pill pill-live"><i class="dot-live"></i> En directe</span>`;
  if (p.estat === 'finalitzat') return `<span class="pill pill-done">Finalitzat</span>`;
  if (p.estat === 'ajornat') return `<span class="pill pill-soft">Ajornat</span>`;
  if (p.estat === 'suspes') return `<span class="pill pill-soft">Suspès</span>`;
  return `<span class="pill pill-soft">${esc(formatData(p.data))} · ${esc(p.hora || '')}</span>`;
}

/** Fila de partit per a llistes (públic i àrbitre). */
function filaPartit(p, ruta) {
  const local = p.local;
  const visitant = p.visitant;
  const sg = setsGuanyats(p);
  const enDirecte = p.estat === 'directe';
  const acabat = p.estat === 'finalitzat';

  const marcador = (costat) => {
    if (p.estat === 'programat') return '<span class="match-score muted">–</span>';
    const val = sg[costat];
    const classe = enDirecte ? 'match-score live' : 'match-score';
    return `<span class="${classe}">${val}</span>`;
  };

  const classeEquip = (costat) => {
    if (!acabat) return '';
    return sg[costat] > sg[costat === 'local' ? 'visitant' : 'local'] ? 'winner' : 'loser';
  };

  const puntsEnJoc = enDirecte
    ? `<div class="match-sets">Set ${numSetActual(p)}: <strong>${p.punts.local}-${p.punts.visitant}</strong></div>`
    : '';

  return `
    <button class="match" data-anar="${esc(ruta)}">
      <div class="match-top">
        <span>${esc(p.categoria.nom)}${p.jornada ? ` · J${p.jornada}` : ''}</span>
        ${pillEstat(p)}
      </div>
      <div class="match-team ${classeEquip('local')}">
        ${crest(local)}
        <span class="match-team-name">${esc(local.nom)}</span>
        ${marcador('local')}
      </div>
      <div class="match-team ${classeEquip('visitant')}">
        ${crest(visitant)}
        <span class="match-team-name">${esc(visitant.nom)}</span>
        ${marcador('visitant')}
      </div>
      ${puntsEnJoc}
    </button>`;
}

/** Targeta destacada per a un partit en directe. */
function targetaDirecte(p) {
  const local = p.local;
  const visitant = p.visitant;
  const sg = setsGuanyats(p);

  return `
    <div class="live-card" data-anar="#/partit/${p.id}">
      <div class="spread">
        <span class="pill pill-live" style="background:rgba(255,255,255,.16);color:#fff">
          <i class="dot-live"></i> En directe
        </span>
        <span style="font-size:11px;opacity:.8">Set ${numSetActual(p)}</span>
      </div>
      <div class="live-card-row">
        ${crest(local, 'crest-outline')}
        <span class="live-name">${esc(local.nom)}</span>
        <span class="live-sets">${sg.local}</span>
        <span class="live-points">${p.punts.local}</span>
      </div>
      <div class="live-card-row">
        ${crest(visitant, 'crest-outline')}
        <span class="live-name">${esc(visitant.nom)}</span>
        <span class="live-sets">${sg.visitant}</span>
        <span class="live-points">${p.punts.visitant}</span>
      </div>
    </div>`;
}

/** Tira amb el resultat de cada set. variant: 'fosc' (sobre el degradat) o 'clar'. */
function tiraSets(p, variant = 'fosc') {
  const chips = (p.sets || []).map((s, i) =>
    `<span class="set-chip">S${i + 1} ${s.local}-${s.visitant}</span>`).join('');
  const actual = p.estat === 'directe'
    ? `<span class="set-chip current">S${numSetActual(p)} ${p.punts.local}-${p.punts.visitant}</span>`
    : '';
  if (!chips && !actual) return '';
  return `<div class="sets-strip ${variant}">${chips}${actual}</div>`;
}
