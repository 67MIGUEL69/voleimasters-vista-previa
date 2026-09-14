/* =========================================================
   INSTAL·LACIÓ I ACTUALITZACIONS
   =========================================================
   Tres coses:

   1. Registra el service worker (el que fa que la web es pugui
      instal·lar i arrenqui sense connexió).
   2. Ofereix instal·lar-la. A Android el navegador ens avisa
      quan es pot; a iPhone no existeix aquest avís i cal
      explicar-ho a mà, perquè allà les notificacions NOMÉS
      funcionen si l'has afegit a la pantalla d'inici.
   3. Avisa quan hi ha una versió nova i la posa en marxa
      només si l'usuari ho accepta: canviar el codi a mig
      partit seria la pitjor manera de fer-ho.
   ========================================================= */

// A window perquè config.js hi pugui mirar: vegeu espotInstalar().
window.peticioInstalar = null;   // l'avís que dona Android
let registreSw = null;

/* ---------- Service worker ---------- */

async function registrarServiceWorker() {
  if (!('serviceWorker' in navigator)) return;

  try {
    registreSw = await navigator.serviceWorker.register('/sw.js');
  } catch (e) {
    return;   // sense service worker l'app funciona igual, però no s'instal·la
  }

  // Ja n'hi ha una d'esperant (l'usuari havia dit que no abans).
  if (registreSw.waiting) mostrarAvisVersio();

  registreSw.addEventListener('updatefound', () => {
    const nova = registreSw.installing;
    nova?.addEventListener('statechange', () => {
      // Si hi ha un controlador, és una actualització i no la primera
      // instal·lació: només llavors té sentit avisar.
      if (nova.state === 'installed' && navigator.serviceWorker.controller) {
        mostrarAvisVersio();
      }
    });
  });

  // Quan la nova pren el control, recarreguem perquè tot quadri.
  let recarregant = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (recarregant) return;
    recarregant = true;
    location.reload();
  });
}

function mostrarAvisVersio() {
  mostrarBarra({
    text: 'Hi ha una versió nova de Voleimasters.',
    boto: 'Actualitzar',
    onOk() {
      registreSw?.waiting?.postMessage('actualitza');
    },
  });
}

/* ---------- Instal·lació ---------- */

window.addEventListener('beforeinstallprompt', e => {
  e.preventDefault();
  window.peticioInstalar = e;
  oferirInstalacio();
});

/*
  A l'iPhone aquell avís no existeix, i si esperéssim que arribés el
  cartell no sortiria mai justament a qui més el necessita: allà els
  avisos NOMÉS funcionen si l'app està a la pantalla d'inici.
*/
window.addEventListener('load', () => {
  if (esIphone()) oferirInstalacio();
});

window.addEventListener('appinstalled', () => {
  window.peticioInstalar = null;
  amagarBarra();
  toast('Voleimasters instal·lat');
  pintar();          // el bloc del perfil ja no hi ha de sortir
});

/*
  Qui tanca el cartell no el torna a veure mai més, en aquest aparell.
  És una molèstia que tapa contingut: preguntar-ho un cop és raonable,
  insistir-hi no. Qui canviï d'idea té el botó al perfil, que no marxa.
*/
function haDitQueNo() {
  return localStorage.getItem('volei-instalacio') === 'no';
}

function oferirInstalacio() {
  if (!espotInstalar() || haDitQueNo()) return;

  mostrarBarra({
    text: "Instal·la Voleimasters al mòbil i tindràs avisos dels partits.",
    boto: 'Instal·lar',
    onOk: instalar,
    onNo() { localStorage.setItem('volei-instalacio', 'no'); },
  });
}

async function instalar() {
  // A iPhone no hi ha cap botó d'instal·lar: s'ha de fer a mà i val la
  // pena dir-ho, perquè és el pas que desbloqueja les notificacions.
  if (!window.peticioInstalar) {
    confirmar({
      titol: 'Instal·lar al mòbil',
      text: esIphone()
        ? 'Toca el botó de Compartir a la barra de baix i tria «Afegir a la pantalla d\'inici».'
        : 'Obre el menú del navegador i tria «Instal·lar aplicació» o «Afegir a la pantalla d\'inici».',
      confirma: 'Entesos',
      onOk() {},
    });
    return;
  }

  window.peticioInstalar.prompt();
  const { outcome } = await window.peticioInstalar.userChoice;
  window.peticioInstalar = null;
  // Dir que no al diàleg del navegador també compta com a tancar el
  // cartell: ja s'ha preguntat i la resposta ha estat que no.
  if (outcome !== 'accepted') localStorage.setItem('volei-instalacio', 'no');
  amagarBarra();
}

/* ---------- Barra d'avís ---------- */

function mostrarBarra({ text, boto, onOk, onNo }) {
  const barra = $('#barra');
  barra.innerHTML = `
    <span class="barra-text">${esc(text)}</span>
    <button class="btn btn-primary btn-petit" data-barra="ok">${esc(boto)}</button>
    <button class="icon-btn ghost" data-barra="no" aria-label="Ara no">${icon('close')}</button>`;
  barra.hidden = false;
  // Sense això la barra tapa l'última fila: a la pantalla de formació
  // s'hi menjava mitja línia de dorsals.
  document.body.classList.add('amb-barra');

  barra.onclick = e => {
    const accio = e.target.closest('[data-barra]')?.dataset.barra;
    if (!accio) return;
    amagarBarra();
    if (accio === 'ok') onOk?.();
    else onNo?.();
  };
}

function amagarBarra() {
  const barra = $('#barra');
  barra.hidden = true;
  barra.innerHTML = '';
  document.body.classList.remove('amb-barra');
}
