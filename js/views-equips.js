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
              ${clubs.length > 1 ? '<option value="">Tria el club</option>' : ''}
              ${clubs.map(c => `<option value="${c.id}">${esc(c.nom)}</option>`).join('')}
            </select>
          </div>`;
      })()}

      <div class="field">
        <label for="e-categoria">Grup</label>
        <select id="e-categoria">
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
