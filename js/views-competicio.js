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

    <div class="section-title">${icon('trophy', 'icon icon-sm')} Grups i equips</div>
    ${cats.length ? cats.map(c => bloqueGrup(c, tancada)).join('')
      : `<div class="card card-pad"><p class="ajuda">
           Aquesta temporada no té cap grup. Se'n creen a la pestanya Equips.
         </p></div>`}

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
        <span class="pill ${plenes ? 'pill-soft' : 'pill-yellow'}">
          ${equips.length}/${categoria.places}
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

/* ---------- El calendari d'un grup ---------- */

function bloqueCalendari(cats, tancada) {
  App.accions.obrirCalendari = async el => {
    const id = Number(el.dataset.grup);
    grupCalendari = grupCalendari === id ? null : id;
    if (grupCalendari) await Store.carregarJornades(grupCalendari);
    pintar();
  };

  App.accions.generarCalendari = el => {
    const grup = cats.find(c => c.id === grupCalendari);
    const equips = (Store.equipsPerCategoria[grupCalendari] || []).length;
    confirmar({
      titol: `Muntar el calendari de ${grup.nom}?`,
      text: `Amb ${equips} equips surten ${equips % 2 ? equips : equips - 1} jornades: `
          + 'tothom contra tothom un cop. Les dates les poses després.',
      confirma: 'Muntar-lo',
      async onOk() {
        try {
          const r = await Store.generarCalendari(grupCalendari);
          toast(`${r.partits} partits en ${r.jornades} jornades`);
          pintar();
        } catch (e) { toast(e.message); }
      },
    });
  };

  App.accions.buidarCalendari = () => {
    const grup = cats.find(c => c.id === grupCalendari);
    confirmar({
      titol: `Buidar el calendari de ${grup.nom}?`,
      text: "S'esborraran tots els partits programats d'aquest grup.",
      confirma: 'Buidar-lo',
      perill: true,
      async onOk() {
        try {
          const r = await Store.buidarCalendari(grupCalendari);
          toast(`${r.esborrats} partits esborrats`);
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

  return `
    <div class="section-title">${icon('calendar', 'icon icon-sm')} Calendari · ${esc(grup.nom)}</div>
    <div class="card card-pad">
      <div class="spread" style="margin-bottom:12px">
        <span class="ajuda">${equips} equips · ${partits} partits</span>
        <button class="btn btn-ghost btn-petit" data-accio="obrirCalendari"
                data-grup="${grupCalendari}">Tancar</button>
      </div>

      ${!partits ? `
        <p class="ajuda" style="margin-bottom:10px">
          Encara no hi ha calendari. Muntar-lo fa que tothom jugui contra
          tothom un cop, repartit per jornades. Les dates es posen després.
        </p>
        <button class="btn btn-primary btn-block" data-accio="generarCalendari"
                ${equips < 2 || tancada ? 'disabled' : ''}>
          ${icon('calendar', 'icon icon-sm')} Muntar el calendari
        </button>`
      : `
        <p class="ajuda" style="margin-bottom:8px">
          La finestra per jugar cada jornada. Els equips queden un dia a dins.
        </p>
        <div class="jornada-caps">
          <span></span><span>Des de</span><span>Fins a</span><span>Jugats</span>
        </div>
        ${jornades.map(j => `
          <div class="jornada-fila">
            <span class="jornada-num">J${j.numero}</span>
            <input id="ji-${j.numero}" type="date" value="${esc(j.data_inici || '')}"
                   aria-label="Jornada ${j.numero}, des de"
                   ${tancada ? 'disabled' : ''} />
            <input id="jl-${j.numero}" type="date" value="${esc(j.data_limit || '')}"
                   aria-label="Jornada ${j.numero}, fins a"
                   ${tancada ? 'disabled' : ''} />
            <span class="jornada-partits">${j.jugats}/${j.partits}</span>
          </div>`).join('')}

        ${!tancada ? `
          <button class="btn btn-primary btn-block" data-accio="desarJornades"
                  style="margin-top:12px">Desar les dates</button>
          <button class="btn btn-ghost btn-block" data-accio="buidarCalendari"
                  style="margin-top:6px">Buidar el calendari</button>` : ''}`}
    </div>`;
}

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
