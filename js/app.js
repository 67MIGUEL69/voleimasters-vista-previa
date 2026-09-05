/* =========================================================
   ARRENCADA I ENRUTADOR
   =========================================================
   Hi ha dues funcions de pintar i la diferència importa:

   · navegar()  demana dades a l'API i després pinta. És el que
                passa en canviar de pantalla.
   · pintar()   pinta amb el que ja hi ha a Store, sense tocar
                la xarxa. És el que passa després de cada punt
                de l'àrbitre i a cada sondeig, i per això no
                parpelleja.
   ========================================================= */

const RUTES = [
  // Partits és la portada: la pantalla d'Inici feia el mateix amb una
  // altra cara, i mantenir-ne dues obligava a tocar-ho tot dues vegades.
  { re: /^\/?$/,                     vista: viewPartits,        carregar: carregarPartits },
  { re: /^\/inici$/,                 vista: viewPartits,        carregar: carregarPartits },
  { re: /^\/partits$/,               vista: viewPartits,        carregar: carregarPartits },
  { re: /^\/partit\/(\d+)\/convocatoria$/, vista: viewConvocatoria,
    carregar: carregarConvocatoriaPartit },
  { re: /^\/partit\/(.+)$/,          vista: viewPartit,         carregar: carregarPartit },
  { re: /^\/classificacio$/,         vista: viewClassificacio,  carregar: carregarClassificacio },
  { re: /^\/equips$/,                vista: viewEquips,         carregar: carregarEquips },
  { re: /^\/equip\/(\d+)\/plantilla$/, vista: viewPlantilla,    carregar: carregarPlantilla },
  { re: /^\/equip\/(.+)$/,           vista: viewEquip,          carregar: carregarEquip },
  { re: /^\/noticies$/,              vista: viewNoticies,       carregar: carregarNoticies },
  { re: /^\/perfil$/,                vista: viewPerfil,         carregar: carregarPerfil },
  { re: /^\/jo$/,                    vista: viewLaMevaFitxa,    carregar: carregarLaMevaFitxa },
  { re: /^\/persona\/(\d+)$/,        vista: viewFitxaPersona,   carregar: carregarFitxaPersona },
  { re: /^\/login$/,                 vista: viewLogin },
  { re: /^\/registre$/,              vista: viewRegistre },
  { re: /^\/admin$/,                 vista: viewAdmin,          carregar: carregarAdmin },
  { re: /^\/arbitre$/,               vista: viewArbitre,        carregar: carregarArbitre },
  { re: /^\/arbitre\/partit\/(.+)$/, vista: viewArbitrePartit,  carregar: carregarArbitrePartit },
];

let rutaAnterior = null;
let rutaActual = null;

function resoldreRuta() {
  const ruta = location.hash.replace(/^#/, '') || '/inici';
  const trobada = RUTES.map(r => ({ r, m: ruta.match(r.re) })).find(x => x.m);
  return { ruta, def: trobada?.r, param: trobada?.m?.[1] };
}

/**
 * Pinta amb el que ja tenim. No demana res a la xarxa.
 *
 * `conservarFormularis` és per als repintats que l'usuari no ha demanat
 * (el sondeig del marcador). Repintar buida els camps, i mentre algú
 * escriu el correu a la pantalla d'accés li desapareixia cada cinc
 * segons: el botó semblava espatllat quan el que passava és que el camp
 * ja era buit.
 */
function pintar({ conservarFormularis = false } = {}) {
  const { ruta, def, param } = resoldreRuta();
  const cont = $('#view');

  const escrit = conservarFormularis ? capturarFormularis(cont) : null;
  const enfocat = conservarFormularis ? document.activeElement?.id : null;

  App.accions = {};
  cont.innerHTML = def ? def.vista(param) : viewNoTrobat();

  if (escrit) restaurarFormularis(escrit, enfocat);
  cont.classList.toggle('no-tabbar', $('#tabbar').hidden);

  if (ruta !== rutaAnterior) {
    window.scrollTo(0, 0);
    rutaAnterior = ruta;
    cont.classList.remove('enter');
    void cont.offsetWidth;      // reinicia l'animació
    cont.classList.add('enter');
  }
}

/** El que hi ha escrit ara mateix, per tornar-ho a posar després. */
function capturarFormularis(cont) {
  const valors = {};
  cont.querySelectorAll('input[id], select[id], textarea[id]').forEach(camp => {
    valors[camp.id] = camp.type === 'checkbox' || camp.type === 'radio'
      ? camp.checked
      : camp.value;
  });
  return valors;
}

function restaurarFormularis(valors, idEnfocat) {
  for (const [id, valor] of Object.entries(valors)) {
    const camp = document.getElementById(id);
    if (!camp) continue;
    if (camp.type === 'checkbox' || camp.type === 'radio') camp.checked = valor;
    else camp.value = valor;
  }
  // I on tenia el dit, que si no el teclat es tanca sol.
  if (idEnfocat) document.getElementById(idEnfocat)?.focus();
}

/** Demana el que necessita la pantalla i després la pinta. */
async function navegar() {
  const { ruta, def, param } = resoldreRuta();
  rutaActual = ruta;

  if (!def || !def.carregar) { pintar(); return; }

  // L'indicador només surt si canviem de pantalla; en tornar a una que ja
  // s'havia visitat es repinta amb el que hi havia i prou.
  const cont = $('#view');
  if (ruta !== rutaAnterior) {
    renderTopbar({});
    cont.innerHTML = blocCarregant();
  }

  try {
    await def.carregar(param);
  } catch (e) {
    if (e.estat === 401) {
      Store.usuari = null;
      App.accions = {};
      cont.innerHTML = viewLogin();
      return;
    }
    App.accions = { reintentar: () => navegar() };
    renderTopbar({});
    renderTabbar(null);
    cont.innerHTML = blocError(e);
    return;
  }

  // Mentre carregàvem, l'usuari pot haver canviat de pantalla.
  if (rutaActual !== ruta) return;

  // Pintar també pot petar. Si no s'agafés aquí, l'excepció pujaria fins
  // a l'arrencada i l'app es quedaria per sempre a la pantalla de càrrega
  // sense dir res: el pitjor error possible, perquè no dona cap pista.
  try {
    pintar();
  } catch (e) {
    App.accions = { reintentar: () => navegar() };
    renderTopbar({});
    renderTabbar(null);
    cont.innerHTML = blocError(e);
  }
}

/* ---------- Accions globals ---------- */

const ACCIONS_GLOBALS = {
  tema() {
    Store.alternarTema();
    pintar();
  },
  sortir() {
    confirmar({
      titol: 'Tancar sessió?',
      text: 'Hauràs de tornar a entrar per gestionar els teus partits.',
      confirma: 'Tancar sessió',
      perill: true,
      async onOk() {
        await Store.sortir();
        toast('Sessió tancada');
        anar('#/inici');
      },
    });
  },
  reintentar() { navegar(); },

  instalarApp() { instalar(); },

  async activarAvisos(boto) {
    boto.disabled = true;
    boto.textContent = 'Demanant permís…';
    try {
      await Avisos.activar();
      toast('Avisos activats');
    } catch (e) {
      toast(e.message);
    }
    pintar();
  },

  desactivarAvisos() {
    confirmar({
      titol: 'Deixar de rebre avisos?',
      text: 'No rebràs res més en aquest dispositiu. Els equips que segueixes també s\'esborraran.',
      confirma: 'Desactivar',
      perill: true,
      async onOk() {
        await Avisos.desactivar();
        toast('Avisos desactivats');
        pintar();
      },
    });
  },

  async provaAvis() {
    try {
      await Avisos.prova();
      toast('Enviat · hauria d\'arribar-te ara mateix');
    } catch (e) {
      toast(e.message);
    }
  },
};

/* ---------- Esdeveniments delegats ---------- */

document.addEventListener('click', e => {
  const anarEl = e.target.closest('[data-anar]');
  if (anarEl) { anar(anarEl.dataset.anar); return; }

  const accioEl = e.target.closest('[data-accio]');
  if (accioEl) {
    const nom = accioEl.dataset.accio;
    (App.accions[nom] || ACCIONS_GLOBALS[nom] || (() => {}))(accioEl);
    return;
  }

  // Les pestanyes d'administració canvien què cal demanar.
  const adminEl = e.target.closest('[data-admin]');
  if (adminEl) { seccioAdmin = adminEl.dataset.admin; navegar(); return; }

  // Els filtres canvien QUÈ es demana: cal tornar a carregar, no repintar.
  const vistaEl = e.target.closest('[data-vista]');
  if (vistaEl) { vistaPartits = vistaEl.dataset.vista; navegar(); return; }

  // El mateix botó de categoria serveix a classificació i a calendari:
  // canvia el que toqui segons on som.
  // Interruptors de preferències d'avisos.
  const avisEl = e.target.closest('[data-avis]');
  if (avisEl) {
    const tipus = avisEl.dataset.avis;
    const nou = !Avisos.estat?.preferencies?.[tipus];
    Avisos.canviarPreferencia(tipus, nou).then(pintar).catch(err => toast(err.message));
    return;
  }

  const deixarEl = e.target.closest('[data-deixar]');
  if (deixarEl) {
    Avisos.deixar(deixarEl.dataset.deixar).then(pintar).catch(err => toast(err.message));
    return;
  }

  const catEl = e.target.closest('[data-categoria]');
  if (catEl) {
    const id = Number(catEl.dataset.categoria);
    if (location.hash.startsWith('#/partits')) categoriaCalendari = id;
    else categoriaActiva = id;
    navegar();
    return;
  }
});

/* En triar un rol, el desplegable del costat ha d'ensenyar el que toca. */
document.addEventListener('change', e => {
  const rolEl = e.target.closest('[data-rol-de]');
  if (rolEl) { refrescarAmbit(Number(rolEl.dataset.rolDe)); return; }

  const convEl = e.target.closest('input[data-convoca]');
  if (convEl) pintarComptador(convEl.dataset.convoca);
});

/* Enter dins d'un formulari fa el botó principal. */
document.addEventListener('keydown', e => {
  if (e.key !== 'Enter' || !e.target.matches('input')) return;
  const principal = document.querySelector('.btn-primary[data-accio]');
  if (principal) App.accions[principal.dataset.accio]?.(principal);
});

window.addEventListener('hashchange', navegar);

/* En canviar entre mòbil i escriptori hi ha pantalles que es pinten
   diferent (la barra de pestanyes, sobretot). Repintem, però només quan
   es creua el llindar: si no, arrossegar la finestra repintaria a cada píxel. */
let eraEscriptori = esEscriptori();
window.addEventListener('resize', () => {
  if (esEscriptori() === eraEscriptori) return;
  eraEscriptori = esEscriptori();
  pintar();
});

/* ---------- Marcador en directe ----------
   Substitueix la simulació que hi havia a la demo. Es demana al servidor
   només el que ha canviat des de l'última vegada; si no s'ha mogut res,
   la resposta arriba pràcticament buida.
------------------------------------------------------------------------ */

const RUTES_EN_VIU = [/^\/?$/, /^\/inici$/, /^\/partits/, /^\/partit\//, /^\/arbitre/];

function sondejarEnBucle() {
  setInterval(async () => {
    if (document.visibilityState !== 'visible') return;  // app en segon pla
    if (App.ocupat) return;                              // l'àrbitre està prement
    if (!$('#overlay').hidden) return;                   // hi ha un diàleg obert

    const ruta = location.hash.replace(/^#/, '') || '/inici';
    if (!RUTES_EN_VIU.some(re => re.test(ruta))) return;

    try {
      if (await Store.sondejar()) pintar({ conservarFormularis: true });
    } catch (_) {
      // Un sondeig fallit no ha de treure cap error per pantalla: pot ser
      // un túnel o un segon sense cobertura. Ja tornarà a provar-ho.
    }
  }, CONFIG.segonsSondeig * 1000);
}

/* ---------- Pantalla de càrrega ---------- */

const SPLASH_MS = 1200;

function amagarSplash() {
  const splash = $('#splash');
  if (!splash) return;
  const espera = Math.max(0, SPLASH_MS - performance.now());
  setTimeout(() => {
    splash.classList.add('oculta');
    splash.addEventListener('transitionend', () => splash.remove(), { once: true });
  }, espera);
}

/* ---------- Xarxa de seguretat ---------- */
/*  Si res d'això s'atura a mig camí, l'usuari es quedaria mirant la
    pantalla de càrrega sense saber què passa. Val més ensenyar-li
    l'error.                                                          */

function petada(e) {
  const splash = $('#splash');
  if (splash) { splash.classList.add('oculta'); splash.remove(); }
  App.accions = { reintentar: () => location.reload() };
  renderTopbar({});
  renderTabbar(null);
  $('#view').innerHTML = blocError(e instanceof Error ? e : new Error(String(e)));
}

window.addEventListener('error', ev => petada(ev.error || ev.message));
window.addEventListener('unhandledrejection', ev => petada(ev.reason));

/* ---------- Arrencada ---------- */

(async function arrencar() {
  try {
    await Store.iniciar();
  } catch (e) {
    // Sense servidor no hi ha res a ensenyar: val més dir-ho clar que
    // deixar l'app en blanc.
    amagarSplash();
    renderTopbar({});
    renderTabbar(null);
    App.accions = { reintentar: () => location.reload() };
    $('#view').innerHTML = blocError(e);
    return;
  }

  await navegar();
  amagarSplash();
  sondejarEnBucle();
})();
