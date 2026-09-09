/* =========================================================
   ADMINISTRACIÓ
   =========================================================
   El que la coordinació pot canviar sense demanar-ho a ningú:
   l'aparença, les regles de puntuació, els punts de la
   classificació i qui pot fer què.

   Només hi arriba qui mana a la lliga. El servidor ho torna a
   comprovar a cada petició: amagar un botó no és cap barrera.
   ========================================================= */

let seccioAdmin = 'marca';
let usuarisAdmin = [];
let ambitsAdmin = { equip: [], club: [], competicio: [] };
let ajustosTaula = [];
let cercaUsuaris = '';

const SECCIONS_ADMIN = [
  { id: 'competicio', nom: 'Temporada' },
  { id: 'noticies', nom: 'Notícies' },
  { id: 'marca', nom: 'Aparença' },
  { id: 'regles', nom: 'Regles' },
  { id: 'taula', nom: 'Classificació' },
  { id: 'usuaris', nom: 'Usuaris' },
];

/*
  Sobre què mana cada rol. Ho decideix el rol i no qui omple el formulari:
  un àrbitre d'un equip concret no vol dir res, i deixar-ho triar només
  serviria per crear permisos que no s'apliquen enlloc.
*/
const AMBIT_DE_ROL = {
  admin: 'global',
  coord_lliga: 'competicio',
  arbitre: 'competicio',
  coord_club: 'club',
  coord_equip: 'equip',
  entrenador: 'equip',
  capita: 'equip',
  jugador: 'equip',
  usuari: 'global',
};

/*
  No hi ha cap rol triat d'entrada: cal dir-ho.

  Abans en venia un de posat («Jugador») per no convertir ningú en
  administrador prement «Donar» sense mirar. Val més no triar per l'altre:
  qui reparteix permisos ha de dir quin vol.
*/
const ROL_PER_DEFECTE = '';

const NOMS_ROL_ADMIN = {
  admin: 'Administració',
  coord_lliga: 'Coordinació de lliga',
  coord_club: 'Coordinació de club',
  coord_equip: "Coordinació d'equip",
  entrenador: 'Entrenador',
  capita: 'Capità',
  jugador: 'Jugador',
  arbitre: 'Àrbitre',
  usuari: 'Usuari',
};

async function carregarAdmin() {
  if (seccioAdmin === 'competicio') {
    await carregarCompeticio();
    return;
  }
  await Store.carregarCategories();
  if (seccioAdmin === 'usuaris') {
    const d = await Store.carregarUsuaris(cercaUsuaris);
    usuarisAdmin = d.usuaris;
    ambitsAdmin = d.ambits;
  }
  if (seccioAdmin === 'taula') {
    /*
      Sense grups no hi ha classificació que ajustar. Abans es demanaven
      igualment els equips «del grup undefined» i la pantalla petava en
      lloc de dir que encara no n'hi ha cap.
    */
    const grup = categoriaActiva || Store.categories[0]?.id;
    ajustosTaula = grup ? await Store.carregarAjustosTaula() : [];
    if (grup) await Store.carregarEquips(grup);
  }
  if (seccioAdmin === 'noticies') {
    noticiesAdmin = await Store.carregarNoticiesAdmin();
  }
}

function viewAdmin() {
  renderNav('admin');

  if (!Store.esCoordinacio()) {
    return `
      <div class="card card-pad" style="text-align:center">
        ${icon('lock', 'icon')}
        <h3 style="font-size:16px;font-weight:800;margin-top:10px">Només per a la coordinació</h3>
        <p class="page-sub">Aquesta pantalla la gestiona la coordinació de la lliga.</p>
      </div>`;
  }

  const pestanyes = SECCIONS_ADMIN.map(s => `
    <button class="segment ${s.id === seccioAdmin ? 'active' : ''}" data-admin="${s.id}">
      ${esc(s.nom)}
    </button>`).join('');

  const cos = {
    competicio: bloqueCompeticio,
    noticies: bloqueNoticies,
    marca: bloqueMarca,
    regles: bloqueRegles,
    taula: bloqueTaula,
    usuaris: bloqueUsuaris,
  }[seccioAdmin]();

  return `
    <div class="page-head">
      <span class="pill pill-yellow">Administració</span>
      <h2 class="page-title">Configuració</h2>
      <p class="page-sub">Els canvis es veuen a l'instant, a la web i a l'app.</p>
    </div>
    <div class="segments">${pestanyes}</div>
    ${cos}`;
}

/* ---------- Notícies ----------
   La taula i la pantalla pública hi eren des del principi, però no hi
   havia manera d'escriure'n cap si no era tocant la base de dades a mà.

   Una notícia sense data de publicació és un esborrany: es pot deixar
   escrita i publicar-la quan toqui. */

let noticiesAdmin = [];
let noticiaOberta = null;      // id que s'està editant, o 'nova'

function bloqueNoticies() {
  Object.assign(App.accions, {
    novaNoticia() { noticiaOberta = 'nova'; pintar(); },
    editarNoticia(el) { noticiaOberta = Number(el.dataset.noticia); pintar(); },
    tancarNoticia() { noticiaOberta = null; pintar(); },

    async desarNoticia(boto) {
      const titol = $('#n-titol').value.trim();
      if (!titol) { toast('Falta el títol'); return; }

      const dades = {
        titol,
        etiqueta: $('#n-etiqueta').value.trim() || null,
        entradeta: $('#n-entradeta').value.trim() || null,
        cos: $('#n-cos').value.trim() || null,
        publicar: $('#n-publicar').checked,
      };

      boto.disabled = true;
      boto.textContent = 'Desant…';
      try {
        if (noticiaOberta === 'nova') await Store.crearNoticia(dades);
        else await Store.desarNoticia(noticiaOberta, dades);
        noticiesAdmin = await Store.carregarNoticiesAdmin();
        await Store.carregarNoticies();
        noticiaOberta = null;
        toast(dades.publicar ? 'Notícia publicada' : 'Esborrany desat');
        pintar();
      } catch (e) {
        toast(e.message);
        boto.disabled = false;
        boto.textContent = 'Desar';
      }
    },

    esborrarNoticia(el) {
      const id = Number(el.dataset.noticia);
      confirmar({
        titol: 'Esborrar la notícia?',
        text: 'Desapareixerà de la web. No es pot desfer.',
        confirma: 'Esborrar',
        perill: true,
        async onOk() {
          try {
            await Store.esborrarNoticia(id);
            noticiesAdmin = await Store.carregarNoticiesAdmin();
            await Store.carregarNoticies();
            noticiaOberta = null;
            toast('Notícia esborrada');
            pintar();
          } catch (e) { toast(e.message); }
        },
      });
    },
  });

  if (noticiaOberta !== null) {
    const n = noticiaOberta === 'nova'
      ? { titol: '', etiqueta: '', entradeta: '', cos: '', publicada_a: null }
      : noticiesAdmin.find(x => x.id === noticiaOberta) || {};

    return `
      <div class="card card-pad">
        <h3 class="form-titol">${noticiaOberta === 'nova' ? 'Notícia nova' : 'Editar la notícia'}</h3>

        <div class="field">
          <label for="n-titol">Títol</label>
          <input id="n-titol" type="text" maxlength="200" value="${esc(n.titol || '')}" />
        </div>

        <div class="field">
          <label for="n-etiqueta">Etiqueta (opcional)</label>
          <input id="n-etiqueta" type="text" maxlength="40" value="${esc(n.etiqueta || '')}"
                 placeholder="Avís, Calendari, Resultats…" />
        </div>

        <div class="field">
          <label for="n-entradeta">Entradeta</label>
          <textarea id="n-entradeta" rows="2" maxlength="400"
                    placeholder="Dues línies que resumeixin la notícia.">${esc(n.entradeta || '')}</textarea>
        </div>

        <div class="field">
          <label for="n-cos">Text</label>
          <textarea id="n-cos" rows="8">${esc(n.cos || '')}</textarea>
        </div>

        <label class="casella" style="margin:6px 0 12px">
          <input id="n-publicar" type="checkbox" ${n.publicada_a ? 'checked' : ''} />
          <span>Publicada</span>
        </label>
        <p class="nota-petita">Sense marcar, es queda com a esborrany i no la veu ningú.</p>

        <div class="ref-actions">
          <button class="btn btn-outline" data-accio="tancarNoticia">Cancel·lar</button>
          <button class="btn btn-primary" data-accio="desarNoticia">Desar</button>
        </div>
        ${noticiaOberta !== 'nova' ? `
          <button class="btn btn-danger btn-block" style="margin-top:10px"
                  data-accio="esborrarNoticia" data-noticia="${n.id}">
            Esborrar la notícia
          </button>` : ''}
      </div>`;
  }

  return `
    <button class="btn btn-primary btn-block" data-accio="novaNoticia">
      ${icon('news', 'icon icon-sm')} Escriure una notícia
    </button>

    <div class="card" style="margin-top:14px">
      ${noticiesAdmin.length ? noticiesAdmin.map(n => `
        <button class="log-item" style="width:100%" data-accio="editarNoticia"
                data-noticia="${n.id}">
          <span>
            ${n.etiqueta ? `<span class="pill pill-yellow">${esc(n.etiqueta)}</span> ` : ''}
            ${esc(n.titol)}
          </span>
          <span class="log-time">
            ${n.publicada_a ? esc(formatData(String(n.publicada_a).slice(0, 10))) : 'Esborrany'}
          </span>
          ${icon('right', 'icon icon-sm')}
        </button>`).join('')
        : '<div class="card-pad"><p class="ajuda" style="margin:0">Encara no n\'hi ha cap.</p></div>'}
    </div>`;
}

/* ---------- Aparença ---------- */

function bloqueMarca() {
  const m = Store.marca || {};

  App.accions.desarMarca = async boto => {
    const canvis = {
      nom: $('#m-nom').value.trim(),
      subtitol: $('#m-subtitol').value.trim(),
      color_principal: $('#m-principal').value,
      color_clar: $('#m-clar').value,
      color_accent: $('#m-accent').value,
      color_fosc: $('#m-fosc').value,
      logo: $('#m-logo').value.trim(),
      logo_clar: $('#m-logo-clar').value.trim(),
    };

    boto.disabled = true;
    boto.textContent = 'Desant…';
    try {
      Store.marca = await Store.desarMarca(canvis);
      Store.aplicarMarca();
      toast('Aparença desada');
      pintar();
    } catch (e) {
      toast(e.message);
      boto.disabled = false;
      boto.textContent = 'Desar';
    }
  };

  // Cada color s'ensenya al costat del seu selector: així es veu què és
  // cadascun sense haver-ho de provar.
  const color = (id, etiqueta, valor, explicacio) => `
    <div class="field">
      <label for="${id}">${esc(etiqueta)}</label>
      <div class="fila-color">
        <input id="${id}" type="color" value="${esc(valor || '#000000')}" />
        <span class="ajuda">${esc(explicacio)}</span>
      </div>
    </div>`;

  return `
    <div class="card card-pad">
      <h3 class="titol-bloc">Nom</h3>
      <div class="field">
        <label for="m-nom">Nom de la lliga</label>
        <input id="m-nom" type="text" value="${esc(m.nom || '')}" maxlength="80" />
      </div>
      <div class="field">
        <label for="m-subtitol">Subtítol</label>
        <input id="m-subtitol" type="text" value="${esc(m.subtitol || '')}" maxlength="80" />
      </div>

      <h3 class="titol-bloc">Colors</h3>
      ${color('m-principal', 'Principal', m.color_principal, 'Botons i elements actius')}
      ${color('m-clar', 'Clar', m.color_clar, 'Detalls i fons suaus')}
      ${color('m-accent', 'Accent', m.color_accent, 'Marcadors i etiquetes')}
      ${color('m-fosc', 'Fosc', m.color_fosc, 'Fons de les targetes en directe')}

      <h3 class="titol-bloc">Logotip</h3>
      <div class="field">
        <label for="m-logo">Sobre fons clar</label>
        <input id="m-logo" type="text" value="${esc(m.logo || '')}" placeholder="/icones/logo.png" />
      </div>
      <div class="field">
        <label for="m-logo-clar">Sobre fons fosc</label>
        <input id="m-logo-clar" type="text" value="${esc(m.logo_clar || '')}"
               placeholder="/icones/logo-clar.png" />
      </div>
      <p class="ajuda">
        Cal que el logotip sobre fons fosc sigui una versió amb el negre convertit
        en blanc. Si no, la part principal desapareix en mode fosc.
      </p>

      <button class="btn btn-primary btn-block" data-accio="desarMarca"
              style="margin-top:16px">Desar</button>
    </div>`;
}

/* ---------- Regles ---------- */

function bloqueRegles() {
  const r = Store.regles || {};
  const taula = r.puntsPerResultat || {};

  App.accions.desarRegles = async boto => {
    const punts = {};
    document.querySelectorAll('[data-marcador]').forEach(camp => {
      punts[camp.dataset.marcador] = Number(camp.value);
    });

    boto.disabled = true;
    boto.textContent = 'Desant…';
    try {
      // Buit vol dir «no s'aplica», no zero.
      const opcional = id => $(id).value === '' ? null : Number($(id).value);

      const d = await Store.desarRegles({
        setsPerGuanyar: Number($('#r-sets').value),
        puntsSet: Number($('#r-punts-set').value),
        puntsSetDecisiu: Number($('#r-punts-decisiu').value),
        diferenciaMinima: Number($('#r-diferencia').value),
        maxMenors30: opcional('#r-max-menors'),
        minDones: opcional('#r-min-dones'),
        segonsEntrePunts: Number($('#r-segons').value || 0),
        puntsPerResultat: punts,
      });
      Store.regles = d.regles;
      Store.marcadorsPossibles = d.marcadors_possibles;
      toast('Regles desades');
      pintar();
    } catch (e) {
      toast(e.message);
      boto.disabled = false;
      boto.textContent = 'Desar';
    }
  };

  const files = (Store.marcadorsPossibles || Object.keys(taula)).map(marcador => {
    const [favor, contra] = marcador.split('-').map(Number);
    const guanya = favor > contra;
    return `
      <tr>
        <td><strong>${esc(marcador)}</strong>
            <span class="ajuda">${guanya ? 'guanya' : 'perd'}</span></td>
        <td class="dreta">
          <input class="camp-punts" type="number" min="0" max="99"
                 data-marcador="${esc(marcador)}" value="${taula[marcador] ?? 0}" />
        </td>
      </tr>`;
  }).join('');

  const numero = (id, etiqueta, valor) => `
    <div class="field">
      <label for="${id}">${esc(etiqueta)}</label>
      <input id="${id}" type="number" min="1" max="99" value="${valor ?? ''}" />
    </div>`;

  return `
    <div class="card card-pad">
      <h3 class="titol-bloc">Com es juga</h3>
      <div class="fila-camps">
        ${numero('r-sets', 'Sets per guanyar', r.setsPerGuanyar)}
        ${numero('r-diferencia', 'Diferència mínima', r.diferenciaMinima)}
      </div>
      <div class="fila-camps">
        ${numero('r-punts-set', 'Punts per set', r.puntsSet)}
        ${numero('r-punts-decisiu', 'Punts al decisiu', r.puntsSetDecisiu)}
      </div>

      <h3 class="titol-bloc">Qui ha d'haver-hi a pista</h3>
      <p class="ajuda" style="margin-bottom:10px">
        L'àrbitre veu un avís vermell si la pista no ho compleix, però pot
        seguir sumant punts igualment: qui decideix és ell, que té les
        fitxes a la taula. Deixa-ho buit per no comprovar-ho.
      </p>
      <div class="fila-camps">
        <div class="field">
          <label for="r-max-menors">Màxim de menors de 30</label>
          <input id="r-max-menors" type="number" min="0" max="6"
                 value="${r.maxMenors30 ?? ''}" placeholder="sense límit" />
        </div>
        <div class="field">
          <label for="r-min-dones">Mínim de dones</label>
          <input id="r-min-dones" type="number" min="0" max="6"
                 value="${r.minDones ?? ''}" placeholder="sense mínim" />
        </div>
      </div>

      <h3 class="titol-bloc">El marcador de l'àrbitre</h3>
      <p class="ajuda" style="margin-bottom:10px">
        Segons que els botons de punt es queden bloquejats després
        d'anotar. Un doble toc amb el mòbil a la mà costa dos punts, i
        desfer-los al mig d'un canvi de servei és un embolic. Amb 0 no es
        bloqueja res.
      </p>
      <div class="field">
        <label for="r-segons">Segons entre punt i punt</label>
        <input id="r-segons" type="number" min="0" max="30"
               value="${r.segonsEntrePunts ?? 5}" />
      </div>

      <h3 class="titol-bloc">Punts de la classificació</h3>
      <p class="ajuda">
        Quants punts val cada resultat. El canvi afecta tota la temporada:
        la classificació es torna a calcular a partir dels partits, no hi ha
        cap número guardat que pugui quedar antic.
      </p>
      <div class="table-wrap">
        <table class="standings">
          <thead><tr><th>Resultat</th><th class="dreta">Punts</th></tr></thead>
          <tbody>${files}</tbody>
        </table>
      </div>

      <p class="ajuda" style="margin-top:12px">
        Si canvies els sets per guanyar, la taula es refà amb els resultats
        nous i hauràs de repassar-la.
      </p>

      <button class="btn btn-primary btn-block" data-accio="desarRegles"
              style="margin-top:16px">Desar</button>
    </div>`;
}

/* ---------- Classificació ---------- */

function bloqueTaula() {
  const categoria = categoriaActiva || Store.categories[0]?.id;
  const equips = Store.equipsPerCategoria[categoria] || [];

  if (!categoria) {
    return `
      <div class="card card-pad">
        ${icon('info', 'icon')}
        <h3 style="font-size:16px;font-weight:800;margin-top:8px">Encara no hi ha grups</h3>
        <p class="page-sub">Sumar o restar punts és sobre la classificació d'un grup.
        Crea'n un a la pestanya Temporada i aquí ja hi podràs tocar.</p>
      </div>`;
  }

  App.accions.afegirAjust = async boto => {
    const equipId = Number($('#a-equip').value);
    const punts = Number($('#a-punts').value);
    const motiu = $('#a-motiu').value.trim();

    if (!equipId) { toast('Tria a quin equip'); return; }
    if (!punts) { toast('Posa quants punts'); return; }
    if (!motiu) { toast('Escriu per què'); return; }

    boto.disabled = true;
    boto.textContent = 'Aplicant…';
    try {
      await Store.afegirAjustTaula(equipId, punts, motiu);
      ajustosTaula = await Store.carregarAjustosTaula();
      delete Store.classificacions[categoria];
      toast('Aplicat');
      pintar();
    } catch (e) {
      toast(e.message);
      boto.disabled = false;
      boto.textContent = 'Aplicar';
    }
  };

  App.accions.treureAjust = el => {
    confirmar({
      titol: 'Desfer aquest ajust?',
      text: 'Els punts tornaran a ser els que surten dels partits.',
      confirma: 'Desfer',
      perill: true,
      async onOk() {
        await Store.treureAjustTaula(Number(el.dataset.id));
        ajustosTaula = await Store.carregarAjustosTaula();
        Store.classificacions = {};
        toast('Desfet');
        pintar();
      },
    });
  };

  /*
    Cap opció triada d'entrada. Amb el primer equip de la llista ja
    seleccionat, prémer «Aplicar» sense mirar sancionava qui no tocava —i
    aquí es resten punts de la classificació.
  */
  const opcions = '<option value="">— Tria un equip —</option>'
    + equips.map(e => `<option value="${e.id}">${esc(e.nom)}</option>`).join('');

  const llista = ajustosTaula.length
    ? ajustosTaula.map(a => `
        <div class="fila-ajust">
          <div>
            <strong>${esc(a.equip)}</strong>
            <span class="pill ${a.punts < 0 ? 'pill-sancio' : 'pill-primary'}">
              ${a.punts > 0 ? '+' : ''}${a.punts}
            </span>
            <div class="ajuda">${esc(a.motiu)}</div>
            <div class="ajuda">${esc(a.autor || 'algú')} · ${esc(formatData(a.data))}</div>
          </div>
          <button class="icon-btn ghost" data-accio="treureAjust" data-id="${a.id}"
                  aria-label="Desfer">${icon('close')}</button>
        </div>`).join('')
    : `<p class="ajuda">Encara no s'ha tocat res. La classificació surt sencera dels partits.</p>`;

  const pestanyesCat = Store.categories.map(c => `
    <button class="segment ${c.id === categoria ? 'active' : ''}"
            data-categoria="${c.id}">${esc(c.nom)}</button>`).join('');

  return `
    <div class="segments">${pestanyesCat}</div>

    <div class="card card-pad">
      <h3 class="titol-bloc">Sumar o restar punts</h3>
      <p class="ajuda">
        Per a sancions, incompareixences o acords. No substitueix la
        classificació: s'hi suma, i queda constància de qui ho ha fet i per què.
      </p>

      <div class="field">
        <label for="a-equip">Equip</label>
        <select id="a-equip">${opcions}</select>
      </div>
      <div class="field">
        <label for="a-punts">Punts (negatiu per sancionar)</label>
        <input id="a-punts" type="number" min="-99" max="99" placeholder="-1" />
      </div>
      <div class="field">
        <label for="a-motiu">Motiu</label>
        <input id="a-motiu" type="text" maxlength="200"
               placeholder="Incompareixença a la jornada 3" />
      </div>
      <button class="btn btn-primary btn-block" data-accio="afegirAjust">Aplicar</button>
    </div>

    <div class="card card-pad">
      <h3 class="titol-bloc">Ajustos aplicats</h3>
      ${llista}
    </div>

    <div class="note">
      ${icon('info', 'icon icon-sm')}
      <span>Els partits guanyats, els sets i els partits jugats surten dels
      resultats. Si n'hi ha cap de mal apuntat, corregeix el partit des de la
      seva fitxa: així la taula i el resultat no poden dir coses diferents.</span>
    </div>`;
}

/* ---------- Usuaris ---------- */

/**
 * Sobre què es pot donar el rol triat. Si el rol és global no hi ha res a
 * triar, i el desplegable s'amaga: ensenyar-hi un equip faria pensar que
 * s'està fent administrador «d'aquell equip», que no vol dir res.
 */
function opcionsAmbit(rol) {
  const tipus = AMBIT_DE_ROL[rol];
  if (tipus === 'global') return '';
  return (ambitsAdmin[tipus] || [])
    .map(a => `<option value="${a.id}">${esc(a.nom)}</option>`).join('');
}

/** Actualitza el desplegable d'àmbit quan es canvia el rol. */
function refrescarAmbit(usuariId) {
  const rol = $(`#rol-${usuariId}`).value;
  const camp = $(`#ambit-${usuariId}`);
  const opcions = opcionsAmbit(rol);
  camp.innerHTML = opcions;
  camp.hidden = opcions === '';
}

function bloqueUsuaris() {
  App.accions.cercarUsuaris = async () => {
    cercaUsuaris = $('#u-cerca').value.trim();
    usuarisAdmin = (await Store.carregarUsuaris(cercaUsuaris)).usuaris;
    pintar();
  };

  App.accions.crearUsuari = async boto => {
    const dades = {
      nom: $('#u-nom').value.trim(),
      cognoms: $('#u-cognoms').value.trim(),
      email: $('#u-email').value.trim(),
      contrasenya: $('#u-contrasenya').value,
    };
    if (!dades.nom || !dades.email || !dades.contrasenya) {
      toast('Falten el nom, el correu o la contrasenya');
      return;
    }

    boto.disabled = true;
    boto.textContent = 'Creant…';
    try {
      await Store.crearUsuari(dades);
      usuarisAdmin = (await Store.carregarUsuaris(cercaUsuaris)).usuaris;
      toast('Usuari creat');
      pintar();
    } catch (e) {
      toast(e.message);
      boto.disabled = false;
      boto.textContent = 'Crear';
    }
  };

  App.accions.treurePermis = async el => {
    const { usuari, rol, tipus, ambit } = el.dataset;
    try {
      await Store.treurePermis(Number(usuari), rol, tipus, ambit ? Number(ambit) : null);
      usuarisAdmin = (await Store.carregarUsuaris(cercaUsuaris)).usuaris;
      toast('Permís tret');
      pintar();
    } catch (e) {
      toast(e.message);
    }
  };

  App.accions.donarPermis = async el => {
    const usuari = Number(el.dataset.usuari);
    const rol = $(`#rol-${usuari}`).value;
    const ambit = $(`#ambit-${usuari}`);

    if (!rol) { toast('Tria quin rol li dones'); return; }

    // El rol decideix sobre què mana: un àrbitre ho és de la competició,
    // una coordinació d'equip ho és d'un equip concret.
    const tipus = AMBIT_DE_ROL[rol];
    const id = tipus === 'global' ? null : Number(ambit.value);
    if (tipus !== 'global' && !id) { toast('Tria sobre què'); return; }

    try {
      await Store.donarPermis(usuari, rol, tipus, id);
      usuarisAdmin = (await Store.carregarUsuaris(cercaUsuaris)).usuaris;
      toast('Permís donat');
      pintar();
    } catch (e) {
      toast(e.message);
    }
  };

  const fitxes = usuarisAdmin.map(u => {
    const permisos = u.permisos.length
      ? u.permisos.map(p => `
          <span class="etiqueta-rol">
            ${esc(NOMS_ROL_ADMIN[p.rol] || p.rol)}${p.ambit_nom ? ' · ' + esc(p.ambit_nom) : ''}
            <button data-accio="treurePermis" data-usuari="${u.id}" data-rol="${esc(p.rol)}"
                    data-tipus="${esc(p.ambit_tipus)}" data-ambit="${p.ambit_id ?? ''}"
                    aria-label="Treure">×</button>
          </span>`).join('')
      : '<span class="ajuda">Sense cap permís: només pot mirar.</span>';

    return `
      <div class="fila-usuari">
        <div class="fila-usuari-cap">
          <strong>${esc(u.nom)} ${esc(u.cognoms || '')}</strong>
          <span class="ajuda">${esc(u.email || u.telefon || '')}</span>
        </div>
        <div class="etiquetes-rol">${permisos}</div>
        <div class="fila-permis">
          <select id="rol-${u.id}" data-rol-de="${u.id}">
            <option value="">— Tria un rol —</option>
            ${Object.entries(NOMS_ROL_ADMIN).map(([r, n]) =>
              `<option value="${r}">${esc(n)}</option>`
            ).join('')}
          </select>
          <select id="ambit-${u.id}" ${opcionsAmbit(ROL_PER_DEFECTE) ? '' : 'hidden'}>
            ${opcionsAmbit(ROL_PER_DEFECTE)}
          </select>
          <button class="btn btn-outline" data-accio="donarPermis"
                  data-usuari="${u.id}">Acceptar</button>
        </div>
      </div>`;
  }).join('');

  return `
    <div class="card card-pad">
      <div class="field">
        <label for="u-cerca">Cercar</label>
        <div class="fila-cerca">
          <input id="u-cerca" type="text" value="${esc(cercaUsuaris)}"
                 placeholder="Nom, cognoms o correu" />
          <button class="btn btn-outline" data-accio="cercarUsuaris">Cercar</button>
        </div>
      </div>
      <p class="ajuda">${usuarisAdmin.length} usuaris</p>
      <div class="llista-usuaris">${fitxes}</div>
    </div>

    <div class="card card-pad">
      <h3 class="titol-bloc">Crear un usuari</h3>
      <div class="fila-camps">
        <div class="field">
          <label for="u-nom">Nom</label>
          <input id="u-nom" type="text" />
        </div>
        <div class="field">
          <label for="u-cognoms">Cognoms</label>
          <input id="u-cognoms" type="text" />
        </div>
      </div>
      <div class="field">
        <label for="u-email">Correu</label>
        <input id="u-email" type="email" autocapitalize="off" />
      </div>
      <div class="field">
        <label for="u-contrasenya">Contrasenya</label>
        <input id="u-contrasenya" type="text" placeholder="8 caràcters com a mínim" />
      </div>
      <button class="btn btn-primary btn-block" data-accio="crearUsuari">Crear</button>
      <p class="ajuda" style="margin-top:10px">
        Es crea sense cap permís. Els rols es donen des de la fitxa de dalt.
      </p>
    </div>`;
}
