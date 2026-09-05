/* =========================================================
   AJUSTOS
   =========================================================
   Ja no cal dir on és el servidor: la interfície i l'API viuen
   al mateix domini. Quan algú instal·la la web al mòbil,
   s'instal·la des d'aquí mateix.
   ========================================================= */

const CONFIG = {
  /* Adreça de l'API. Relativa a propòsit: així funciona igual al
     servidor de proves, a voleimasters.cat i instal·lada al mòbil. */
  api: '/api',

  /* Cada quants segons es demana el marcador dels partits en directe.
     Per a una lliga amateur, cinc segons es viuen com «a l'instant». */
  segonsSondeig: 5,

  /* Segons que s'espera una resposta abans de donar-la per perduda. */
  segonsEspera: 15,

  /* Amplada a partir de la qual es pinta com a escriptori: menú a dalt
     en comptes de barra de pestanyes a baix. Ha de coincidir amb
     --amplaria-escriptori de css/app.css. */
  amplariEscriptori: 900,
};

function esEscriptori() {
  return window.innerWidth >= CONFIG.amplariEscriptori;
}

/** S'està executant instal·lada, no dins d'una pestanya del navegador? */
function estaInstalada() {
  return window.matchMedia('(display-mode: standalone)').matches
    || window.navigator.standalone === true;
}

/**
 * Som dins de l'APK o de la còpia de mostra?
 *
 * Allà no hi ha res a instal·lar —ja hi ets— i el navegador tampoc no
 * ofereix cap manera de fer-ho.
 */
function esAppEmpaquetada() {
  return window.ES_MOSTRA === true || location.protocol === 'file:';
}

function esIphone() {
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

/**
 * Hi ha alguna cosa a instal·lar, i es pot?
 *
 * Viu aquí i no a instalar.js perquè el perfil ho pregunta, i la còpia
 * de mostra es publica sense instalar.js: allà no hi ha res a
 * instal·lar. Quan estava a l'altre fitxer, obrir el perfil a la vista
 * prèvia petava amb «espotInstalar is not defined».
 *
 * `window.peticioInstalar` l'omple instalar.js quan el navegador avisa
 * que la web es pot instal·lar. Va a window a posta: un `let` de dalt de
 * tot d'un script no es veu des d'un altre fitxer.
 */
function espotInstalar() {
  if (estaInstalada() || esAppEmpaquetada()) return false;
  // A l'iPhone no hi ha cap avís del navegador i s'ha de fer a mà, però
  // es pot: allà és l'únic camí perquè funcionin els avisos.
  return window.peticioInstalar != null || esIphone();
}
