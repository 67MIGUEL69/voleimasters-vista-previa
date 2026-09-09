/* =========================================================
   MUNTAR LA TEMPORADA
   =========================================================
   Crear la lliga de l'any, posar-hi els grups i repartir-hi
   els equips. Fins ara tot això només existia perquè ho
   inventava el fitxer de dades d'exemple: no hi havia manera
   de començar una temporada des de l'app.

   L'ordre és el que es fa de debò cada estiu:
     1. Es crea la temporada, copiant els grups de l'anterior.
     2. Es reparteixen els equips pels grups.
     3. Quan quadra, s'activa i passa a ser la que es veu.

   El calendari (jornades i partits) va a part.
   ========================================================= */

let temporadaMuntant = null;    // quina s'està preparant
let grupCalendari = null;       // de quin grup es mira el calendari

async function carregarCompeticio() {
  const temporades = await Store.carregarTemporades();
  if (!temporadaMuntant || !temporades.some(t => t.id === temporadaMuntant)) {
    temporadaMuntant = temporades.find(t => t.activa)?.id || temporades[0]?.id || null;
  }
  if (!temporadaMuntant) return;

  const cats = await Store.carregarCategoriesDe(temporadaMuntant);
  await Promise.all(cats.map(c => Store.carregarEquips(c.id, temporadaMuntant)));
  await Store.carregarSenseGrup(temporadaMuntant);

  if (grupCalendari && !cats.some(c => c.id === grupCalendari)) grupCalendari = null;
  if (grupCalendari) await Store.carregarJornades(grupCalendari);
}

function bloqueCompeticio() {
  const temporades = Store.temporades;
  const actual = temporades.find(t => t.id === temporadaMuntant);

  App.accions.triarTemporada = async el => {
    temporadaMuntant = Number(el.value);
    await carregarCompeticio();
    pintar();
  };

  App.accions.novaTemporada = () => formulariTemporada();

  /*
    Crear un grup. Hi era a l'API des del principi però cap pantalla no
    el cridava, i el text deia que es feien «a la pestanya Equips», que
    no era veritat: la coordinació es va trobar una temporada nova sense
    grups i sense manera de fer-ne cap.
  */
  App.accions.nouGrup = () => {
    const seguent = (Store.categoriesTemporada || [])
      .reduce((n, c) => Math.max(n, c.nivell), 0) + 1;

    const ov = $('#overlay');
    ov.innerHTML = `
      <div class="sheet">
        <h3>Un grup nou</h3>
        <div class="field">
          <label for="g-nom">Nom</label>
          <input id="g-nom" type="text" maxlength="60" placeholder="Or, Plata, Bronze…" />
        </div>
        <div class="fila-camps">
          <div class="field">
            <label for="g-nivell">Nivell</label>
            <input id="g-nivell" type="number" min="1" max="50" value="${seguent}" />
          </div>
          <div class="field">
            <label for="g-places">Places</label>
            <input id="g-places" type="number" min="2" max="64" value="8" />
          </div>
        </div>
        <p class="ajuda">El nivell ordena els grups: l'1 és el de dalt. Les places
        són quants equips hi caben.</p>
        <p class="ajuda" id="g-error" hidden></p>
        <div class="sheet-actions">
          <button class="btn btn-outline" data-tanca="1">Cancel·lar</button>
          <button class="btn btn-primary" data-fer="crear">Crear-lo</button>
        </div>
      </div>`;
    ov.hidden = false;
    $('#g-nom').focus();

    ov.onclick = async e => {
      if (e.target === ov || e.target.dataset.tanca) {
        ov.hidden = true; ov.innerHTML = ''; return;
      }
      if (e.target.dataset.fer !== 'crear') return;

      const error = $('#g-error');
      const nom = $('#g-nom').value.trim();
      if (!nom) {
        error.textContent = 'Falta el nom.';
        error.hidden = false;
        return;
      }

      e.target.disabled = true;
      try {
        await Store.crearGrup({
          temporada_id: temporadaMuntant,
          nom,
          nivell: Number($('#g-nivell').value),
          places: Number($('#g-places').value),
        });
        ov.hidden = true; ov.innerHTML = '';
        await carregarCompeticio();
        toast(`Grup ${nom} creat`);
        pintar();
      } catch (err) {
        error.textContent = err.message;
        error.hidden = false;
        e.target.disabled = false;
      }
    };
  };

  App.accions.esborrarGrup = el => {
    const id = Number(el.dataset.grup);
    const nom = el.dataset.nom;
    confirmar({
      titol: `Esborrar el grup ${nom}?`,
      text: 'Ha d\'estar buit d\'equips.',
      confirma: 'Esborrar',
      perill: true,
      async onOk() {
        try {
          await Store.esborrarGrup(id);
          await carregarCompeticio();
          toast('Grup esborrat');
          pintar();
        } catch (e) { toast(e.message); }
      },
    });
  };

  App.accions.activarTemporada = () => {
    confirmar({
      titol: `Activar ${actual.nom}?`,
      text: 'Passarà a ser la temporada que es veu a la web i a l\'app. '
          + 'La que hi ha ara es quedarà com a històric.',
      confirma: 'Activar',
      async onOk() {
        try {
          await Store.activarTemporada(actual.id);
          toast(`${actual.nom} activada`);
          navegar();
        } catch (e) { toast(e.message); }
      },
    });
  };

  App.accions.tancarTemporada = () => {
    confirmar({
      titol: `Tancar ${actual.nom}?`,
      text: 'Quedarà com a històric i ja no s\'hi podrà escriure res més.',
      confirma: 'Tancar',
      perill: true,
      async onOk() {
        try {
          await Store.editarTemporada(actual.id, { tancada: true });
          toast('Temporada tancada');
          pintar();
        } catch (e) { toast(e.message); }
      },
    });
  };

  /*
    Posar i moure fan el mateix i s'obren igual: una llista de grups amb
    les places que li queden a cadascun. Amb quaranta equips per
    repartir, un desplegable de 110 px al costat del nom era d'encertar-hi
    amb la punta del dit.
  */
  App.accions.triarGrup = el => moureDeGrup(Number(el.dataset.equip), el.dataset.nom);

  App.accions.treureEquip = el => {
    confirmar({
      titol: `Treure ${el.dataset.nom} de ${actual.nom}?`,
      text: 'Sortirà dels grups d\'aquesta temporada. La plantilla i les '
          + 'temporades anteriors no es toquen.',
      confirma: 'Treure',
      perill: true,
      async onOk() {
        try {
          await Store.treureDelGrup(Number(el.dataset.equip), temporadaMuntant);
          toast('Tret del grup');
          await carregarCompeticio();
          pintar();
        } catch (e) { toast(e.message); }
      },
    });
  };

  if (!temporades.length) {
    return `<div class="card card-pad">
        <p class="ajuda">No hi ha cap temporada.</p>
        <button class="btn btn-primary btn-block" data-accio="novaTemporada"
                style="margin-top:12px">Crear-ne una</button>
      </div>`;
  }

  const cats = Store.categoriesTemporada;
  const tancada = actual?.tancada;

  return `
    <div class="card card-pad">
      <div class="field">
        <label for="t-temporada">Temporada</label>
        <select id="t-temporada" data-accio="triarTemporada">
          ${temporades.map(t => `
            <option value="${t.id}" ${t.id === temporadaMuntant ? 'selected' : ''}>
              ${esc(t.nom)}${t.activa ? ' · la que es veu' : ''}${t.tancada ? ' · tancada' : ''}
            </option>`).join('')}
        </select>
      </div>
      ${actual ? `
        <p class="ajuda">
          ${actual.data_inici ? `Del ${esc(formatData(actual.data_inici))}` : 'Sense dates'}
          ${actual.data_fi ? ` al ${esc(formatData(actual.data_fi))}` : ''}
        </p>` : ''}
      <div class="fila-botons" style="margin-top:12px">
        <button class="btn btn-primary" data-accio="novaTemporada">Nova temporada</button>
        ${actual && !actual.activa && !actual.tancada ? `
          <button class="btn btn-outline" data-accio="activarTemporada">Activar</button>` : ''}
        ${actual && !actual.activa && !actual.tancada ? `
          <button class="btn btn-ghost" data-accio="tancarTemporada">Tancar</button>` : ''}
      </div>
    </div>

    ${tancada ? `
      <div class="note" style="margin-top:12px">
        ${icon('lock', 'icon icon-sm')}
        <span>Aquesta temporada està tancada: és històric i no s'hi pot tocar res.</span>
      </div>` : ''}

    ${actual && !actual.activa && !tancada ? `
      <div class="note note-avis" style="margin-top:12px">
        ${icon('alert', 'icon icon-sm')}
        <span>Aquesta temporada <strong>no és la que es veu a la web</strong>. Pots
        anar-la muntant, però fins que no premis «Activar» ningú no en veurà res.</span>
      </div>` : ''}

    <div class="section-title">${icon('trophy', 'icon icon-sm')} Grups i equips</div>
    ${cats.length ? cats.map(c => bloqueGrup(c, tancada)).join('')
      : `<div class="card card-pad"><p class="ajuda">
           Aquesta temporada encara no té cap grup. Els grups són les
           categories de la lliga —Or, Plata, Bronze…— i cada equip va a un.
         </p></div>`}
    ${!tancada ? `
      <button class="btn btn-outline btn-block" data-accio="nouGrup"
              style="margin-bottom:12px">
        ${icon('plus', 'icon icon-sm')} Crear un grup
      </button>` : ''}

    ${!tancada ? bloqueSenseGrup() : ''}

    ${bloqueCalendari(cats, tancada)}`;
}

function bloqueGrup(categoria, tancada) {
  const equips = Store.equipsPerCategoria[categoria.id] || [];
  const plenes = equips.length >= categoria.places;

  return `
    <div class="card" style="margin-bottom:12px">
      <div class="card-pad spread">
        <strong>${esc(categoria.nom)}</strong>
        <span style="display:flex;align-items:center;gap:8px">
          <span class="pill ${plenes ? 'pill-soft' : 'pill-yellow'}">
            ${equips.length}/${categoria.places}
          </span>
          ${!tancada && !equips.length ? `
            <button class="icon-btn ghost" data-accio="esborrarGrup"
                    data-grup="${categoria.id}" data-nom="${esc(categoria.nom)}"
                    aria-label="Esborrar el grup">${icon('close')}</button>` : ''}
        </span>
      </div>
      ${equips.length ? equips.map(e => `
        <div class="fila-fitxa">
          ${crest(e)}
          <div class="fitxa-qui"><strong>${esc(e.nom)}</strong></div>
          ${!tancada ? `
            <div class="fitxa-accions">
              <button class="icon-btn ghost" data-accio="triarGrup"
                      data-equip="${e.id}" data-nom="${esc(e.nom)}"
                      aria-label="Moure de grup" title="Moure de grup">${icon('right')}</button>
              <button class="icon-btn ghost" data-accio="treureEquip"
                      data-equip="${e.id}" data-nom="${esc(e.nom)}"
                      aria-label="Treure">${icon('close')}</button>
            </div>` : ''}
        </div>`).join('')
        : '<div class="card-pad"><p class="ajuda">Encara no hi ha cap equip.</p></div>'}
    </div>`;
}

function bloqueSenseGrup() {
  const equips = Store.senseGrup;
  if (!equips.length) {
    return `
      <div class="note" style="margin-top:12px">
        ${icon('check', 'icon icon-sm')}
        <span>Tots els equips tenen grup en aquesta temporada.</span>
      </div>`;
  }

  return `
    <div class="section-title">${icon('users', 'icon icon-sm')} Sense grup (${equips.length})</div>
    <div class="card">
      ${equips.map(e => `
        <div class="fila-fitxa">
          ${crest(e)}
          <div class="fitxa-qui">
            <strong>${esc(e.nom)}</strong>
            ${e.club ? `<div class="ajuda">${esc(e.club)}</div>` : ''}
          </div>
          <button class="btn btn-primary btn-petit" data-accio="triarGrup"
                  data-equip="${e.id}" data-nom="${esc(e.nom)}">Posar en un grup</button>
        </div>`).join('')}
    </div>`;
}

/* ---------- El calendari d'un grup ----------
   Les jornades i els creuaments els escriu la coordinació a mà, com al
   full que ens van passar: cada jornada té la seva finestra de dates i a
   dins hi van els partits, triats un a un.

   Hi havia un botó de muntar-ho tot sol —tothom contra tothom— i s'ha
   tret: mai coincidia amb el que elles ja tenien decidit, i tocar-ho
   després era més feina que escriure-ho. */

function bloqueCalendari(cats, tancada) {
  App.accions.obrirCalendari = async el => {
    const id = Number(el.dataset.grup);
    grupCalendari = grupCalendari === id ? null : id;
    if (grupCalendari) {
      await Store.carregarJornades(grupCalendari);
      await Store.carregarEquips(grupCalendari);
    }
    pintar();
  };

  App.accions.afegirJornada = async boto => {
    const jornades = Store.jornades[grupCalendari] || [];
    const seguent = jornades.length ? Math.max(...jornades.map(j => j.numero)) + 1 : 1;

    boto.disabled = true;
    try {
      await Store.desarJornades(grupCalendari, [
        ...jornades.map(j => ({
          numero: j.numero, data_inici: j.data_inici, data_limit: j.data_limit,
        })),
        { numero: seguent, data_inici: null, data_limit: null },
      ]);
      toast(`Jornada ${seguent} afegida`);
      pintar();
    } catch (e) {
      toast(e.message);
      boto.disabled = false;
    }
  };

  App.accions.treureJornada = el => {
    const numero = Number(el.dataset.jornada);
    confirmar({
      titol: `Treure la jornada ${numero}?`,
      text: 'Ha d\'estar buida de partits.',
      confirma: 'Treure-la',
      perill: true,
      async onOk() {
        try {
          await Store.desarJornades(grupCalendari,
            (Store.jornades[grupCalendari] || [])
              .filter(j => j.numero !== numero)
              .map(j => ({
                numero: j.numero, data_inici: j.data_inici, data_limit: j.data_limit,
              })));
          toast('Jornada treta');
          pintar();
        } catch (e) { toast(e.message); }
      },
    });
  };

  App.accions.afegirCreuament = el => {
    const jornadaId = Number(el.dataset.jornada);
    const numero = el.dataset.numero;
    const equips = Store.equipsPerCategoria[grupCalendari] || [];

    const opcions = '<option value="">— Tria un equip —</option>'
      + equips.map(e => `<option value="${e.id}">${esc(e.nom)}</option>`).join('');

    const ov = $('#overlay');
    ov.innerHTML = `
      <div class="sheet">
        <h3>Un partit de la jornada ${esc(numero)}</h3>
        <div class="field">
          <label for="c-local">Juga a casa</label>
          <select id="c-local">${opcions}</select>
        </div>
        <div class="field">
          <label for="c-visitant">Hi va</label>
          <select id="c-visitant">${opcions}</select>
        </div>
        <p class="ajuda" id="c-error" hidden></p>
        <div class="sheet-actions">
          <button class="btn btn-outline" data-tanca="1">Cancel·lar</button>
          <button class="btn btn-primary" data-fer="afegir">Afegir-lo</button>
        </div>
      </div>`;
    ov.hidden = false;

    ov.onclick = async e => {
      if (e.target === ov || e.target.dataset.tanca) {
        ov.hidden = true; ov.innerHTML = ''; return;
      }
      if (e.target.dataset.fer !== 'afegir') return;

      const local = Number($('#c-local').value);
      const visitant = Number($('#c-visitant').value);
      const error = $('#c-error');
      if (!local || !visitant) {
        error.textContent = 'Falta dir qui juga.';
        error.hidden = false;
        return;
      }
      if (local === visitant) {
        error.textContent = 'Un equip no pot jugar contra ell mateix.';
        error.hidden = false;
        return;
      }

      e.target.disabled = true;
      try {
        await Store.crearPartit(jornadaId, local, visitant);
        await Store.carregarJornades(grupCalendari);
        ov.hidden = true; ov.innerHTML = '';
        toast('Partit afegit');
        pintar();
      } catch (err) {
        error.textContent = err.message;
        error.hidden = false;
        e.target.disabled = false;
      }
    };
  };

  App.accions.treureCreuament = el => {
    const id = Number(el.dataset.partit);
    confirmar({
      titol: 'Treure aquest partit?',
      text: 'Desapareixerà del calendari.',
      confirma: 'Treure\'l',
      perill: true,
      async onOk() {
        try {
          await Store.esborrarPartit(id);
          await Store.carregarJornades(grupCalendari);
          toast('Partit tret');
          pintar();
        } catch (e) { toast(e.message); }
      },
    });
  };

  App.accions.desarJornades = async boto => {
    const jornades = (Store.jornades[grupCalendari] || []).map(j => ({
      numero: j.numero,
      data_inici: $(`#ji-${j.numero}`).value || null,
      data_limit: $(`#jl-${j.numero}`).value || null,
    }));

    boto.disabled = true;
    boto.textContent = 'Desant…';
    try {
      await Store.desarJornades(grupCalendari, jornades);
      toast('Dates desades');
      pintar();
    } catch (e) {
      toast(e.message);
      boto.disabled = false;
      boto.textContent = 'Desar les dates';
    }
  };

  if (!grupCalendari) {
    return `
      <div class="section-title">${icon('calendar', 'icon icon-sm')} Calendari</div>
      <div class="card">
        ${cats.map(c => `
          <button class="log-item" style="width:100%" data-accio="obrirCalendari"
                  data-grup="${c.id}">
            ${esc(c.nom)}
            <span class="log-time">${(Store.equipsPerCategoria[c.id] || []).length} equips</span>
          </button>`).join('')}
      </div>`;
  }

  const grup = cats.find(c => c.id === grupCalendari);
  const jornades = Store.jornades[grupCalendari] || [];
  const partits = jornades.reduce((n, j) => n + j.partits, 0);
  const equips = (Store.equipsPerCategoria[grupCalendari] || []).length;

  const jornada = j => `
    <div class="card" style="margin-bottom:10px">
      <div class="card-pad">
        <div class="spread" style="margin-bottom:8px">
          <strong>Jornada ${j.numero}</strong>
          <span class="ajuda">${j.jugats}/${j.partits} jugats</span>
        </div>
        <div class="fila-camps">
          <div class="field">
            <label for="ji-${j.numero}">Des de</label>
            <input id="ji-${j.numero}" type="date" value="${esc(j.data_inici || '')}"
                   ${tancada ? 'disabled' : ''} />
          </div>
          <div class="field">
            <label for="jl-${j.numero}">Fins a</label>
            <input id="jl-${j.numero}" type="date" value="${esc(j.data_limit || '')}"
                   ${tancada ? 'disabled' : ''} />
          </div>
        </div>
      </div>

      ${j.creuaments.map(c => `
        <div class="fila-fitxa">
          <div class="fitxa-qui">
            <strong>${esc(c.local.nom)}</strong>
            <span class="ajuda">contra ${esc(c.visitant.nom)}</span>
          </div>
          ${!tancada && c.estat === 'programat' ? `
            <button class="icon-btn ghost" data-accio="treureCreuament"
                    data-partit="${c.id}" aria-label="Treure">${icon('close')}</button>`
            : `<span class="log-time">${esc(NOM_ESTAT_PARTIT[c.estat] || c.estat)}</span>`}
        </div>`).join('')}

      ${!tancada ? `
        <button class="log-item" style="width:100%" data-accio="afegirCreuament"
                data-jornada="${j.id}" data-numero="${j.numero}">
          ${icon('plus', 'icon icon-sm')} Afegir un partit
          ${j.partits === 0 ? '<span class="log-time">buida</span>' : ''}
        </button>
        ${j.partits === 0 ? `
          <button class="log-item" style="width:100%;color:var(--red)"
                  data-accio="treureJornada" data-jornada="${j.numero}">
            ${icon('close', 'icon icon-sm')} Treure la jornada
          </button>` : ''}` : ''}
    </div>`;

  return `
    <div class="section-title">${icon('calendar', 'icon icon-sm')} Calendari · ${esc(grup.nom)}</div>
    <div class="card card-pad" style="margin-bottom:12px">
      <div class="spread">
        <span class="ajuda">${equips} equips · ${jornades.length} jornades · ${partits} partits</span>
        <button class="btn btn-ghost btn-petit" data-accio="obrirCalendari"
                data-grup="${grupCalendari}">Tancar</button>
      </div>
      ${equips < 2 ? `
        <p class="ajuda" style="margin-top:8px">
          Posa equips en aquest grup abans de fer-li el calendari.
        </p>` : ''}
    </div>

    ${jornades.map(jornada).join('')}

    ${!tancada ? `
      <button class="btn btn-outline btn-block" data-accio="afegirJornada"
              ${equips < 2 ? 'disabled' : ''}>
        ${icon('plus', 'icon icon-sm')} Afegir una jornada
      </button>
      ${jornades.length ? `
        <button class="btn btn-primary btn-block" data-accio="desarJornades"
                style="margin-top:8px">Desar les dates</button>` : ''}` : ''}`;
}

const NOM_ESTAT_PARTIT = {
  programat: 'Programat', directe: 'En joc', finalitzat: 'Jugat',
  ajornat: 'Ajornat', suspes: 'Suspès',
};

/* ---------- Diàlegs ---------- */

function formulariTemporada() {
  const ov = $('#overlay');
  const anterior = Store.temporades[0];
  ov.innerHTML = `
    <div class="sheet">
      <h3>Nova temporada</h3>
      <div class="field">
        <label for="t-nom">Nom</label>
        <input id="t-nom" type="text" maxlength="20" placeholder="2027-28" />
      </div>
      <div class="fila-camps">
        <div class="field">
          <label for="t-inici">Comença</label>
          <input id="t-inici" type="date" />
        </div>
        <div class="field">
          <label for="t-fi">Acaba</label>
          <input id="t-fi" type="date" />
        </div>
      </div>
      ${anterior ? `
        <label class="fila-convocada" style="padding-left:0">
          <input id="t-copiar" type="checkbox" checked />
          <span class="conv-qui">
            <strong>Copiar els grups de ${esc(anterior.nom)}</strong>
            <span class="ajuda">Els mateixos noms, nivells i places. Els equips no.</span>
          </span>
        </label>` : ''}
      <div class="sheet-actions">
        <button class="btn btn-outline" data-tanca="1">Cancel·lar</button>
        <button class="btn btn-primary" data-fer="1">Crear</button>
      </div>
    </div>`;
  ov.hidden = false;

  ov.onclick = async e => {
    if (e.target === ov || e.target.dataset.tanca) {
      ov.hidden = true; ov.innerHTML = ''; return;
    }
    if (!e.target.dataset.fer) return;

    const dades = { nom: $('#t-nom').value.trim() };
    if (!dades.nom) { toast('Posa-li un nom'); return; }
    if ($('#t-inici').value) dades.data_inici = $('#t-inici').value;
    if ($('#t-fi').value) dades.data_fi = $('#t-fi').value;
    if ($('#t-copiar')?.checked) dades.copiar_grups_de = anterior.id;

    ov.hidden = true; ov.innerHTML = '';
    try {
      const r = await Store.crearTemporada(dades);
      temporadaMuntant = r.temporada.id;
      toast(r.grups_copiats
        ? `${r.temporada.nom} creada amb ${r.grups_copiats} grups`
        : `${r.temporada.nom} creada`);
      await carregarCompeticio();
      pintar();
    } catch (err) { toast(err.message); }
  };
}

function moureDeGrup(equipId, nom) {
  const ov = $('#overlay');
  // «Moure» només si ja és en algun grup; si no, s'hi posa per primer cop.
  const jaTeGrup = Store.senseGrup.every(e => e.id !== equipId);
  ov.innerHTML = `
    <div class="sheet">
      <h3>${jaTeGrup ? 'Moure' : 'Posar'} ${esc(nom)}</h3>
      <div class="card">
        ${Store.categoriesTemporada.map(c => {
          const equips = Store.equipsPerCategoria[c.id] || [];
          const plens = equips.length >= c.places;
          const hiEs = equips.some(e => e.id === equipId);
          return `
            <button class="log-item" style="width:100%" data-grup="${c.id}"
                    ${hiEs || (plens && !hiEs) ? 'disabled' : ''}>
              ${esc(c.nom)}
              <span class="log-time">
                ${equips.length}/${c.places}${hiEs ? ' · hi és ara' : ''}
              </span>
            </button>`;
        }).join('')}
      </div>
      <div class="sheet-actions">
        <button class="btn btn-outline" data-tanca="1">Cancel·lar</button>
      </div>
    </div>`;
  ov.hidden = false;

  ov.onclick = async e => {
    if (e.target === ov || e.target.dataset.tanca) {
      ov.hidden = true; ov.innerHTML = ''; return;
    }
    const boto = e.target.closest('[data-grup]');
    if (!boto) return;
    ov.hidden = true; ov.innerHTML = '';
    try {
      const r = await Store.posarEnGrup(equipId, Number(boto.dataset.grup));
      toast(`${r.equip.nom} → ${r.categoria.nom}`);
      await carregarCompeticio();
      pintar();
    } catch (err) { toast(err.message); }
  };
}
