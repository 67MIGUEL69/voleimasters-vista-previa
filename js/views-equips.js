/* =========================================================
   EQUIPS: CREAR-LOS I OMPLIR-LOS
   =========================================================
   La plantilla és la base de tot el que ve després: les
   convocatòries surten d'aquí, i l'acta d'un partit també.
   Per això el dorsal, la data de naixement i el gènere es
   demanen en fitxar i no el dia del partit.

   Qui pot fer què ho decideix el servidor; aquí només
   s'amaguen els botons que no serveixen.
   ========================================================= */

let creantEquip = false;

async function carregarPlantilla(id) {
  await Promise.all([
    Store.carregarEquip(id),
    Store.carregarPlantilla(id),
  ]);
  // Els entrenadors només els veu qui és de l'equip; si no, el servidor
  // contesta 403 i la pantalla tira igual sense aquell bloc.
  try { await Store.carregarEntrenadors(id); } catch (_) { delete Store.entrenadors[id]; }
  // I les sol·licituds, només qui el gestiona.
  try { await Store.carregarSolicitudsEquip(id); } catch (_) { delete Store.solicitudsEquip[id]; }
}

function viewPlantilla(id) {
  const fitxa = Store.fitxesEquip[id];
  const dades = Store.plantilles[id];
  if (!fitxa || !dades) return viewNoTrobat();

  const equip = fitxa.equip;
  const potGestionar = dades.pot_gestionar;

  renderTopbar({ titol: 'Plantilla', enrere: `#/equip/${id}`, accions: false });
  renderTabbar(null);

  App.accions = {
    async fitxar(boto) {
      const dorsalCru = $('#p-dorsal').value.trim();
      const noves = {
        nom: $('#p-nom').value.trim(),
        cognoms: $('#p-cognoms').value.trim(),
        tipus: $('#p-tipus').value,
        genere: $('#p-genere').value,
        data_naixement: $('#p-naixement').value || null,
        dni: $('#p-dni').value.trim() || null,
      };
      if (dorsalCru !== '') noves.dorsal = Number(dorsalCru);

      if (!noves.nom || !noves.cognoms) { toast('Falta el nom i els cognoms'); return; }
      if (!noves.tipus) { toast('Digues si és jugadora, entrenador o delegat'); return; }

      boto.disabled = true;
      boto.textContent = 'Fitxant…';
      try {
        await Store.fitxar(id, noves);
        toast('Fitxada');
        pintar();
      } catch (e) {
        toast(e.message);
        boto.disabled = false;
        boto.textContent = 'Fitxar';
      }
    },

    async capitana(el) {
      try {
        await Store.editarFitxa(id, Number(el.dataset.fitxa), { es_capita: true });
        toast('Capitania canviada');
        pintar();
      } catch (e) { toast(e.message); }
    },

    dorsal(el) {
      const fitxaId = Number(el.dataset.fitxa);
      const actual = el.dataset.dorsal || '';
      const ov = $('#overlay');
      ov.innerHTML = `
        <div class="sheet">
          <h3>Canviar el dorsal</h3>
          <div class="field">
            <label for="d-nou">Dorsal</label>
            <input id="d-nou" type="number" min="0" max="199" value="${esc(actual)}" />
          </div>
          <div class="sheet-actions">
            <button class="btn btn-outline" data-tanca="1">Cancel·lar</button>
            <button class="btn btn-primary" data-fer="1">Desar</button>
          </div>
        </div>`;
      ov.hidden = false;
      ov.onclick = async ev => {
        if (ev.target === ov || ev.target.dataset.tanca) {
          ov.hidden = true; ov.innerHTML = ''; return;
        }
        if (!ev.target.dataset.fer) return;
        const valor = $('#d-nou').value.trim();
        ov.hidden = true; ov.innerHTML = '';
        try {
          await Store.editarFitxa(id, fitxaId,
            { dorsal: valor === '' ? null : Number(valor) });
          toast('Dorsal canviat');
          pintar();
        } catch (e) { toast(e.message); }
      };
    },

    baixa(el) {
      const fitxaId = Number(el.dataset.fitxa);
      confirmar({
        titol: `Donar de baixa ${el.dataset.nom}?`,
        text: 'Deixarà de sortir a la plantilla i el seu dorsal quedarà lliure. '
            + 'Les actes dels partits que ja ha jugat no canvien.',
        confirma: 'Donar de baixa',
        perill: true,
        async onOk() {
          try {
            await Store.donarBaixa(id, fitxaId);
            toast('Baixa feta');
            pintar();
          } catch (e) { toast(e.message); }
        },
      });
    },
  };

  const jugadores = dades.plantilla.filter(f => f.tipus === 'jugador');
  const tecnics = dades.plantilla.filter(f => f.tipus !== 'jugador');

  const fila = f => `
    <div class="fila-fitxa">
      <button class="fitxa-dorsal ${potGestionar ? '' : 'sense-accio'}"
              ${potGestionar ? `data-accio="dorsal" data-fitxa="${f.fitxa_id}"
                                data-dorsal="${f.dorsal ?? ''}"` : 'disabled'}>
        ${f.dorsal ?? '–'}
      </button>
      <button class="fitxa-qui" data-anar="#/persona/${f.persona_id}">
        <strong>${esc(f.nom)} ${esc(f.cognoms)}</strong>
        <div class="ajuda">
          ${f.es_capita ? 'Capitana · ' : ''}${esc(NOM_TIPUS[f.tipus] || f.tipus)}
          ${f.data_naixement ? ' · ' + esc(f.data_naixement) : ''}
        </div>
      </button>
      ${potGestionar ? `
        <div class="fitxa-accions">
          ${f.tipus === 'jugador' && !f.es_capita ? `
            <button class="icon-btn ghost" data-accio="capitana" data-fitxa="${f.fitxa_id}"
                    aria-label="Fer capitana" title="Fer capitana">${icon('medal')}</button>` : ''}
          <button class="icon-btn ghost" data-accio="baixa" data-fitxa="${f.fitxa_id}"
                  data-nom="${esc(f.nom)}" aria-label="Donar de baixa">${icon('close')}</button>
        </div>` : ''}
    </div>`;

  return `
    <div class="page-head">
      <div class="team-cell">
        ${crest(equip)}
        <span class="pill pill-soft">${esc(equip.categoria?.nom || '')}</span>
      </div>
      <h2 class="page-title">${esc(equip.nom)}</h2>
      <p class="page-sub">
        ${jugadores.length} jugadores${tecnics.length ? ` · ${tecnics.length} al cos tècnic` : ''}
      </p>
    </div>

    ${tecnics.length ? `
      <div class="section-title">${icon('whistle', 'icon icon-sm')} Cos tècnic</div>
      <div class="card">${tecnics.map(fila).join('')}</div>` : ''}

    <div class="section-title">${icon('users', 'icon icon-sm')} Jugadores</div>
    <div class="card">
      ${jugadores.length ? jugadores.map(fila).join('')
        : '<div class="card-pad"><p class="ajuda">Encara no hi ha ningú fitxat.</p></div>'}
    </div>

    ${bloqueSolicituds(id)}

    ${bloqueEntrenadors(id)}

    ${potGestionar ? `
      <div class="section-title">${icon('plus', 'icon icon-sm')} Fitxar algú</div>
      <div class="card card-pad">
        <div class="fila-camps">
          <div class="field">
            <label for="p-nom">Nom</label>
            <input id="p-nom" type="text" />
          </div>
          <div class="field">
            <label for="p-cognoms">Cognoms</label>
            <input id="p-cognoms" type="text" />
          </div>
        </div>
        <div class="fila-camps">
          <div class="field">
            <label for="p-tipus">Què és</label>
            <select id="p-tipus">
              <option value="">— Què és? —</option>
              <option value="jugador">Jugadora</option>
              <option value="entrenador">Entrenador</option>
              <option value="delegat">Delegat</option>
            </select>
          </div>
          <div class="field">
            <label for="p-dorsal">Dorsal</label>
            <input id="p-dorsal" type="number" min="0" max="199" />
          </div>
        </div>
        <div class="fila-camps">
          <div class="field">
            <label for="p-naixement">Data de naixement</label>
            <input id="p-naixement" type="date" />
          </div>
          <div class="field">
            <label for="p-genere">Gènere</label>
            <select id="p-genere">
              <option value="no_consta">No consta</option>
              <option value="dona">Dona</option>
              <option value="home">Home</option>
              <option value="altre">Altre</option>
            </select>
          </div>
        </div>
        <div class="field">
          <label for="p-dni">DNI</label>
          <input id="p-dni" type="text" autocapitalize="characters" />
        </div>
        <p class="ajuda" style="margin-bottom:10px">
          La data de naixement i el gènere fan falta per a la regla de pista:
          l'àrbitre les veu marcades a l'acta sense haver de preguntar.
        </p>
        <button class="btn btn-primary btn-block" data-accio="fitxar">Fitxar</button>
      </div>` : ''}`;
}

/**
 * Qui entrena l'equip.
 *
 * Va a part de la plantilla perquè són dues coses: la fitxa serveix per
 * a l'acta i el rol, per als permisos. Nomenar entrenador algú li dona
 * les dues, però treure-li el rol no el fa fora de la plantilla.
 *
 * S'hi afegeix per correu: ensenyar la llista de comptes de la lliga a
 * cada coordinador de club seria donar-li una agenda que no li toca.
 */
function bloqueEntrenadors(equipId) {
  const dades = Store.entrenadors[equipId];
  if (!dades) return '';

  App.accions.afegirEntrenador = async boto => {
    const email = $('#e-email').value.trim();
    if (!email) { toast('Escriu el correu'); return; }

    boto.disabled = true;
    boto.textContent = 'Afegint…';
    try {
      const r = await Store.afegirEntrenador(equipId, email);
      toast(r.fitxa_creada
        ? `${r.entrenador.nom} entrena l'equip i ja surt a la plantilla`
        : `${r.entrenador.nom} entrena l'equip`);
      pintar();
    } catch (e) {
      toast(e.message);
      boto.disabled = false;
      boto.textContent = 'Afegir';
    }
  };

  App.accions.treureEntrenador = el => {
    confirmar({
      titol: `Treure ${el.dataset.nom} d'entrenador?`,
      text: 'Deixarà de poder gestionar l\'equip. La seva fitxa es queda '
          + 'a la plantilla: donar-la de baixa és a part.',
      confirma: 'Treure',
      perill: true,
      async onOk() {
        try {
          await Store.treureEntrenador(equipId, Number(el.dataset.usuari));
          toast('Tret');
          pintar();
        } catch (e) { toast(e.message); }
      },
    });
  };

  return `
    <div class="section-title">${icon('whistle', 'icon icon-sm')} Qui entrena</div>
    <div class="card">
      ${dades.entrenadors.length ? dades.entrenadors.map(e => `
        <div class="fila-fitxa">
          <div class="fitxa-qui">
            <strong>${esc(e.nom)}</strong>
            <div class="ajuda">${esc(e.email || '')}</div>
          </div>
          ${dades.pot_gestionar ? `
            <button class="icon-btn ghost" data-accio="treureEntrenador"
                    data-usuari="${e.usuari_id}" data-nom="${esc(e.nom)}"
                    aria-label="Treure">${icon('close')}</button>` : ''}
        </div>`).join('')
        : '<div class="card-pad"><p class="ajuda">Aquest equip no té entrenador.</p></div>'}

      ${dades.pot_gestionar ? `
        <div class="card-pad">
          <div class="field">
            <label for="e-email">Correu de l'entrenador</label>
            <input id="e-email" type="email" placeholder="nom@exemple.cat" />
          </div>
          <button class="btn btn-outline btn-block" data-accio="afegirEntrenador">
            Afegir
          </button>
          <p class="nota-petita">
            Ha de tenir compte a Voleimasters. Si encara no en té, que es registri primer.
          </p>
        </div>` : ''}
    </div>`;
}

const NOM_TIPUS = {
  jugador: 'Jugadora',
  entrenador: 'Entrenador',
  delegat: 'Delegat',
};

/* ---------- Crear un equip ---------- */

function bloqueCrearEquip() {
  if (!Store.pot('equip.crear')) return '';

  App.accions.obrirCrear = () => { creantEquip = true; pintar(); };
  App.accions.tancarCrear = () => { creantEquip = false; pintar(); };

  App.accions.crearEquip = async boto => {
    const dades = {
      nom: $('#e-nom').value.trim(),
      categoria_id: Number($('#e-categoria').value),
      sigles: $('#e-sigles').value.trim() || null,
      ciutat: $('#e-ciutat').value.trim() || null,
      color: $('#e-color').value,
    };

    // De quin club és. Sense això, qui coordina un club crearia un equip
    // fora del seu abast i després no el podria ni omplir.
    const club = $('#e-club');
    if (club && club.value) dades.club_id = Number(club.value);

    if (!dades.nom) { toast('Falta el nom'); return; }
    if (!dades.categoria_id) { toast('Tria a quin grup va'); return; }
    if (club && !club.value) { toast('Digues de quin club és'); return; }

    boto.disabled = true;
    boto.textContent = 'Creant…';
    try {
      const equip = await Store.crearEquip(dades);
      creantEquip = false;
      toast(`${equip.nom} creat`);
      anar(`#/equip/${equip.id}/plantilla`);
    } catch (e) {
      toast(e.message);
      boto.disabled = false;
      boto.textContent = 'Crear equip';
    }
  };

  if (!creantEquip) {
    return `
      <button class="btn btn-outline btn-block" data-accio="obrirCrear"
              style="margin-bottom:16px">
        ${icon('plus', 'icon icon-sm')} Crear un equip
      </button>`;
  }

  return `
    <div class="card card-pad" style="margin-bottom:16px">
      <h3 class="titol-bloc">Equip nou</h3>
      <div class="field">
        <label for="e-nom">Nom</label>
        <input id="e-nom" type="text" placeholder="CV Exemple" />
      </div>
      <div class="fila-camps">
        <div class="field">
          <label for="e-sigles">Sigles</label>
          <input id="e-sigles" type="text" maxlength="4" placeholder="CVE" />
        </div>
        <div class="field">
          <label for="e-ciutat">Ciutat</label>
          <input id="e-ciutat" type="text" />
        </div>
      </div>
      ${(() => {
        const clubs = Store.elsMeusClubs();
        // Qui mana a la lliga pot crear-ne sense club; qui coordina un
        // club, no: l'equip ha de ser del seu.
        if (!clubs.length) return '';
        return `
          <div class="field">
            <label for="e-club">Club</label>
            <select id="e-club">
              <option value="">— Tria el club —</option>
              ${clubs.map(c => `<option value="${c.id}">${esc(c.nom)}</option>`).join('')}
            </select>
          </div>`;
      })()}

      <div class="field">
        <label for="e-categoria">Grup</label>
        <select id="e-categoria">
          <option value="">— Tria el grup —</option>
          ${Store.categories.map(c => {
            const ocupades = (Store.equipsPerCategoria[c.id] || []).length;
            const ple = ocupades >= c.places;
            return `<option value="${c.id}" ${ple ? 'disabled' : ''}>
              ${esc(c.nom)} — ${ocupades}/${c.places}${ple ? ' (ple)' : ''}
            </option>`;
          }).join('')}
        </select>
      </div>
      <div class="field">
        <label for="e-color">Color</label>
        <div class="fila-color">
          <input id="e-color" type="color" value="#4a7c00" />
          <span class="ajuda">El que surt al seu escut i a les targetes.</span>
        </div>
      </div>
      <div class="sheet-actions" style="margin-top:14px">
        <button class="btn btn-outline" data-accio="tancarCrear">Cancel·lar</button>
        <button class="btn btn-primary" data-accio="crearEquip">Crear equip</button>
      </div>
    </div>`;
}

/* =========================================================
   LA CONVOCATÒRIA D'UN PARTIT
   =========================================================
   Qui ve al pavelló, decidit per l'equip abans de jugar.
   L'àrbitre no la toca: només tria les sis de pista d'entre
   les que hi ha aquí.

   No és obligatòria. Si un equip no la fa, el dia del partit
   l'àrbitre veu la plantilla sencera i el partit tira igual.
   ========================================================= */

async function carregarConvocatoriaPartit(id) {
  await Promise.all([
    Store.carregarPartit(id),
    Store.carregarConvocatoria(id),
  ]);
}

function viewConvocatoria(id) {
  const p = Store.partit(id);
  const c = Store.convocatories[id];
  if (!p || !c) return viewNoTrobat();

  renderTopbar({ titol: 'Convocatòria', enrere: `#/partit/${id}`, accions: false });
  renderTabbar(null);

  App.accions = {
    async desar(boto) {
      const equipId = Number(boto.dataset.equip);
      const fitxes = $$(`input[data-convoca="${equipId}"]:checked`)
        .map(i => Number(i.value));

      boto.disabled = true;
      boto.textContent = 'Desant…';
      try {
        const r = await Store.desarConvocatoria(id, equipId, fitxes);
        toast(r.avis || (fitxes.length
          ? `${fitxes.length} convocades`
          : 'Convocatòria buidada'));
        pintar();
      } catch (e) {
        toast(e.message);
        boto.disabled = false;
        boto.textContent = 'Desar la convocatòria';
      }
    },

    // Marcar-les una per una, sent normalment gairebé totes, és pesat.
    tots(boto) {
      const equipId = boto.dataset.equip;
      const caselles = $$(`input[data-convoca="${equipId}"]`);
      const encendre = caselles.some(i => !i.checked);
      caselles.forEach(i => { i.checked = encendre; });
      pintarComptador(equipId);
    },

    compta(el) { pintarComptador(el.dataset.equip); },
  };

  const bloc = costat => {
    const d = c[costat];
    const equip = p[costat];
    const convocats = d.plantilla.filter(f => f.convocat);

    if (!d.pot_convocar) {
      // Els noms del rival no arriben fins que el partit s'ha jugat: qui
      // ve a jugar no és res que hagi de saber l'altre equip abans.
      const buit = !d.visible
        ? (d.convocats
            ? `Ja tenen ${d.convocats} convocades. Els noms surten a l'acta
               quan s'hagi jugat el partit.`
            : 'Encara no han fet la convocatòria.')
        : 'Aquest equip encara no ha fet la convocatòria.';

      return `
        <section>
          <div class="section-title">${crest(equip)} ${esc(equip.nom)}</div>
          <div class="card">
            ${convocats.length
              ? convocats.map(f => `
                  <div class="log-item">
                    <span class="conv-dorsal">${f.dorsal ?? '–'}</span>
                    ${esc(f.nom)} ${esc(f.cognoms)}
                    ${f.es_capita ? '<span class="log-time">capitana</span>' : ''}
                  </div>`).join('')
              : `<div class="card-pad"><p class="ajuda">${buit}</p></div>`}
          </div>
        </section>`;
    }

    const fila = f => `
      <label class="fila-convocada">
        <input type="checkbox" value="${f.fitxa_id}"
               data-convoca="${d.equip_id}" ${f.convocat ? 'checked' : ''} />
        <span class="conv-dorsal">${f.dorsal ?? '–'}</span>
        <span class="conv-qui">
          <strong>${esc(f.nom)} ${esc(f.cognoms)}</strong>
          ${f.es_capita || f.tipus !== 'jugador' ? `<span class="ajuda">
            ${f.es_capita ? 'Capitana' : ''}${f.es_capita && f.tipus !== 'jugador' ? ' · ' : ''}
            ${f.tipus !== 'jugador' ? esc(NOM_TIPUS[f.tipus] || f.tipus) : ''}
          </span>` : ''}
        </span>
      </label>`;

    const jugadores = d.plantilla.filter(f => f.tipus === 'jugador');
    const tecnics = d.plantilla.filter(f => f.tipus !== 'jugador');

    return `
      <section>
        <div class="section-title">${crest(equip)} ${esc(equip.nom)}</div>
        <div class="card">
          ${jugadores.length || tecnics.length ? `
            ${jugadores.map(fila).join('')}
            ${tecnics.length ? `<div class="log-item ajuda">Cos tècnic</div>
              ${tecnics.map(fila).join('')}` : ''}
            <div class="card-pad">
              <div class="spread">
                <span class="ajuda" id="compte-${d.equip_id}">
                  ${convocats.length} convocades
                </span>
                <button class="btn btn-outline btn-petit" data-accio="tots"
                        data-equip="${d.equip_id}">Totes / cap</button>
              </div>
              <button class="btn btn-primary btn-block" data-accio="desar"
                      data-equip="${d.equip_id}">Desar la convocatòria</button>
            </div>`
            : `<div class="card-pad"><p class="ajuda">
                 Aquest equip no té ningú fitxat. Omple la plantilla primer:
                 <a href="#/equip/${equip.id}/plantilla">obrir la plantilla</a>.
               </p></div>`}
        </div>
      </section>`;
  };

  return `
    <div class="page-head">
      <h2 class="page-title">${esc(p.local.nom)} · ${esc(p.visitant.nom)}</h2>
      <p class="page-sub">
        ${esc(formatData(p.data))}${p.hora ? ' · ' + esc(p.hora) : ''}
        ${p.jornada ? ` · Jornada ${p.jornada}` : ''}
      </p>
    </div>

    <div class="card card-pad" style="margin-bottom:12px">
      <p class="ajuda" style="margin:0">
        Marca qui ve al partit. El dia del partit l'àrbitre triarà les sis de
        pista d'entre aquestes. Es pot canviar fins que el partit comenci.
      </p>
    </div>

    <div class="columnes">
      ${bloc('local')}
      ${bloc('visitant')}
    </div>`;
}

/** El comptador de sota, sense repintar tota la pantalla. */
function pintarComptador(equipId) {
  const marcades = $$(`input[data-convoca="${equipId}"]:checked`).length;
  const on = $(`#compte-${equipId}`);
  if (on) on.textContent = `${marcades} convocades`;
}

/* ---------- Qui demana entrar a l'equip ----------
   Acceptar-ho NO fitxa ningú: obre el contacte. Una fitxa és un
   compromís amb la lliga i no s'ha de crear amb un toc; es fa aquí sota,
   a «Fitxar algú», quan ho tinguin parlat. */

function bloqueSolicituds(equipId) {
  const llista = Store.solicitudsEquip[equipId];
  if (!llista || !llista.length) return '';

  Object.assign(App.accions, {
    async contestarSolicitud(el) {
      const id = Number(el.dataset.solicitud);
      const resposta = el.dataset.resposta;
      el.disabled = true;
      try {
        await Store.contestarSolicitud(equipId, id, resposta);
        toast(resposta === 'acceptar' ? 'Acceptada' : 'Rebutjada');
        pintar();
      } catch (e) {
        toast(e.message);
        el.disabled = false;
      }
    },
  });

  const pendents = llista.filter(s => s.estat === 'pendent');
  const contestades = llista.filter(s => s.estat !== 'pendent');

  const fila = s => `
    <div class="card-pad" style="border-top:1px solid var(--border)">
      <div class="fila-equip-nom" style="gap:10px">
        ${retratPetit(s.persona)}
        <span class="fitxa-equip">
          <strong>${esc(s.persona.nom)} ${esc(s.persona.cognoms)}</strong>
          <span class="ajuda">
            ${esc(nomsPosicions(s.persona.posicions))}${s.persona.alcada ? ` · ${s.persona.alcada} cm` : ''}
          </span>
        </span>
      </div>
      ${s.missatge ? `<p class="descripcio" style="margin-top:8px">${esc(s.missatge)}</p>` : ''}
      ${s.contacte ? `
        <div class="note" style="margin-top:10px">
          ${icon('info', 'icon icon-sm')}
          <span>
            Telèfon: <a href="tel:${esc(s.contacte.telefon)}">${esc(s.contacte.telefon)}</a>
            · DNI: ${esc(s.contacte.dni)}
            · Neix el ${esc(formatData(s.contacte.data_naixement))}
            <br />Quan ho tingueu parlat, fitxa'l aquí sota.
          </span>
        </div>` : ''}
      ${s.estat === 'pendent' ? `
        <div class="ref-actions" style="margin-top:10px">
          <button class="btn btn-outline" data-accio="contestarSolicitud"
                  data-solicitud="${s.id}" data-resposta="rebutjar">Ara no</button>
          <button class="btn btn-primary" data-accio="contestarSolicitud"
                  data-solicitud="${s.id}" data-resposta="acceptar">Acceptar</button>
        </div>`
        : `<p class="ajuda" style="margin-top:8px">${
            s.estat === 'acceptada' ? 'Acceptada' : 'Rebutjada'}</p>`}
    </div>`;

  return `
    <div class="section-title">
      ${icon('users', 'icon icon-sm')} Demanen entrar a l'equip
      ${pendents.length ? `<span class="pill pill-yellow" style="margin-left:auto">
        ${pendents.length}</span>` : ''}
    </div>
    <div class="card">
      ${pendents.map(fila).join('')}
      ${contestades.map(fila).join('')}
      <div class="card-pad">
        <p class="ajuda" style="margin:0">
          Acceptar-ho no els fitxa: et deixa veure el telèfon per parlar-hi.
          Fitxar-los es fa aquí sota quan ho tingueu acordat.
        </p>
      </div>
    </div>`;
}

/* ---------- Buscar equip ----------
   Qui no juga enlloc pot demanar-ho a qualsevol equip. A qualsevol i no
   només als que s'haguessin obert: si cap no s'obrís, això no serviria
   de res, i un equip sempre pot dir que no.

   Abans de poder demanar res cal tenir la fitxa completa: DNI, telèfon i
   data de naixement. És el que l'equip necessita per fitxar ningú, i
   demanar-ho després seria pitjor. */

let dadesBuscar = null;

async function carregarBuscarEquip() {
  dadesBuscar = await Store.carregarBuscarEquip();
  await Store.carregarCategories();
  await Promise.all(Store.categories.map(c => Store.carregarEquips(c.id)));
}

const NOM_CAMP_FITXA = {
  dni: 'el DNI',
  telefon: 'el telèfon',
  data_naixement: 'la data de naixement',
};

function viewBuscarEquip() {
  renderTopbar({ titol: 'Busques equip?', enrere: '#/equips', accions: false });
  renderTabbar(null);

  if (!Store.usuari) return viewLogin();

  const d = dadesBuscar || { falta: [], solicituds: [], ja_te_equip: false };
  const demanats = new Map((d.solicituds || []).map(s => [s.equip.id, s]));

  App.accions = {
    async demanar(el) {
      const equipId = Number(el.dataset.equip);
      const nom = el.dataset.nom;
      obrirMissatge(equipId, nom);
    },
  };

  function obrirMissatge(equipId, nom) {
    const ov = $('#overlay');
    ov.innerHTML = `
      <div class="sheet">
        <h3>Demanar entrar a ${esc(nom)}</h3>
        <p>Els arribarà el teu nom i la teva fitxa. Si t'accepten, veuran
        el teu telèfon per parlar amb tu.</p>
        <div class="field">
          <label for="s-missatge">Vols dir-los alguna cosa? (opcional)</label>
          <textarea id="s-missatge" rows="3" maxlength="400"
                    placeholder="Fa deu anys que jugo, puc els dimarts…"></textarea>
        </div>
        <div class="sheet-actions">
          <button class="btn btn-outline" data-tanca="1">Cancel·lar</button>
          <button class="btn btn-primary" data-fer="enviar">Demanar-ho</button>
        </div>
      </div>`;
    ov.hidden = false;
    ov.onclick = async e => {
      if (e.target === ov || e.target.dataset.tanca) {
        ov.hidden = true; ov.innerHTML = ''; return;
      }
      if (e.target.dataset.fer !== 'enviar') return;
      e.target.disabled = true;
      try {
        await Store.demanarEquip(equipId, $('#s-missatge').value.trim() || null);
        ov.hidden = true; ov.innerHTML = '';
        toast('Sol·licitud enviada');
        await navegar();
      } catch (err) {
        toast(err.message);
        e.target.disabled = false;
      }
    };
  }

  if (d.ja_te_equip) {
    return `
      <div class="card card-pad" style="text-align:center">
        ${icon('shield', 'icon')}
        <h3 style="font-size:16px;font-weight:800;margin-top:10px">Ja tens equip</h3>
        <p class="page-sub">Aquesta temporada ja estàs fitxat. Si vols canviar
        d'equip, parla-ho amb la coordinació.</p>
      </div>`;
  }

  if ((d.falta || []).length) {
    return `
      <div class="card card-pad">
        ${icon('info', 'icon')}
        <h3 style="font-size:16px;font-weight:800;margin-top:8px">Abans, la teva fitxa</h3>
        <p class="page-sub">Per demanar equip cal que hi consti
        ${esc(llistaEnText(d.falta.map(c => NOM_CAMP_FITXA[c] || c)))}. És el que
        necessiten per fitxar-te, i demanar-t'ho després seria pitjor.</p>
        <button class="btn btn-primary btn-block" data-anar="#/jo" style="margin-top:14px">
          Omplir la meva fitxa
        </button>
      </div>`;
  }

  const fetes = (d.solicituds || []).length ? `
    <div class="section-title">${icon('clock', 'icon icon-sm')} El que has demanat</div>
    <div class="card">
      ${d.solicituds.map(s => `
        <div class="log-item">
          ${crest(s.equip)}
          <span>${esc(s.equip.nom)}</span>
          <span class="log-time">${esc({
            pendent: 'Esperant resposta',
            acceptada: 'T\'han dit que sí',
            rebutjada: 'T\'han dit que no',
          }[s.estat] || s.estat)}</span>
        </div>`).join('')}
    </div>` : '';

  return `
    <div class="page-head">
      <h2 class="page-title">Busques equip?</h2>
      <p class="page-sub">Demana-ho als equips que vulguis. Rebran la teva fitxa,
      i si t'accepten es posaran en contacte amb tu.</p>
    </div>

    ${fetes}

    ${Store.categories.map(c => `
      <div class="section-title metall-text-${c.nivell}">
        ${icon('shield', 'icon icon-sm')} ${esc(c.nom)}
      </div>
      <div class="card">
        ${(Store.equipsPerCategoria[c.id] || []).map(e => {
          const feta = demanats.get(e.id);
          return `
            <div class="log-item">
              ${crest(e)}
              <span>${esc(e.nom)}</span>
              ${feta ? `<span class="log-time">${esc({
                  pendent: 'Demanat',
                  acceptada: 'Accepten',
                  rebutjada: 'Han dit que no',
                }[feta.estat] || feta.estat)}</span>`
                : `<button class="btn btn-outline btn-petit" data-accio="demanar"
                           data-equip="${e.id}" data-nom="${esc(e.nom)}"
                           style="margin-left:auto">Demanar-ho</button>`}
            </div>`;
        }).join('')}
      </div>`).join('')}`;
}

/** «el DNI i el telèfon», «el DNI, el telèfon i la data de naixement». */
function llistaEnText(coses) {
  if (coses.length <= 1) return coses[0] || '';
  return coses.slice(0, -1).join(', ') + ' i ' + coses[coses.length - 1];
}
