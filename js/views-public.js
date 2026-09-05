/* =========================================================
   PANTALLES PÚBLIQUES
   =========================================================
   Cada pantalla té dues parts: `carregar` demana a l'API el
   que necessita, i la funció de vista pinta amb el que ja hi
   ha a Store. Tota l'espera queda concentrada a l'enrutador.

   Les mateixes pantalles serveixen per al mòbil i per a
   l'escriptori: el que canvia és el CSS, no el codi.
   ========================================================= */

/* ---------- Partits ----------
   Tres maneres de mirar el mateix: el que passa ara, el calendari sencer
   per jornades, i el que ja s'ha jugat. Abans això eren dues pantalles
   separades que ensenyaven llistes de partits gairebé iguals.
--------------------------------------------------------------------- */

let vistaPartits = 'directe';        // directe · propers · jornades · resultats
let categoriaCalendari = null;
let llistaPartits = [];

async function carregarPartits() {
  if (vistaPartits === 'jornades') {
    const cats = await Store.carregarCategories();
    categoriaCalendari ??= cats[0]?.id ?? null;
    if (categoriaCalendari !== null) await Store.carregarCalendari(categoriaCalendari);
    return;
  }
  const estat = { directe: 'directe', propers: 'programat', resultats: 'finalitzat' }[vistaPartits];
  llistaPartits = await Store.carregarPartits(estat);

  // La notícia més recent acompanya la pantalla d'entrada.
  if (!Store.noticies.length) {
    try { await Store.carregarNoticies(3); } catch (_) { /* no és imprescindible */ }
  }
}

function viewPartits() {
  renderNav('partits');

  const pestanyes = [
    { id: 'directe', nom: 'En directe' },
    { id: 'propers', nom: 'Propers' },
    { id: 'jornades', nom: 'Jornades' },
    { id: 'resultats', nom: 'Resultats' },
  ];

  const buit = {
    directe: "Ara mateix no s'està jugant cap partit.",
    propers: 'No hi ha partits programats.',
    resultats: 'Encara no hi ha resultats.',
  }[vistaPartits];

  // En directe és la portada: hi van les targetes grosses i la notícia.
  const esPortada = vistaPartits === 'directe';
  const noticia = Store.noticies[0];

  // Es rellegeix del magatzem a cada pintada. El sondeig hi deixa els
  // partits actualitzats, i si aquí es fes servir la llista tal com va
  // arribar, el marcador es quedaria congelat.
  const llista = llistaPartits.map(p => Store.partit(p.id) || p);

  return `
    <div class="hero">
      <span class="pill pill-yellow">Lliga Voleimasters</span>
      <h2 class="page-title" style="margin-top:8px">Partits</h2>
      <p class="page-sub">Vòlei de Catalunya</p>
    </div>

    <div class="segments">
      ${pestanyes.map(p => `
        <button class="segment ${p.id === vistaPartits ? 'active' : ''}" data-vista="${p.id}">
          ${p.nom}
        </button>`).join('')}
    </div>

    ${vistaPartits === 'jornades' ? bloqueJornades() : `
      ${esPortada && llista.length ? `
        <div class="graella-directe" style="margin-top:14px">
          ${llista.map(targetaDirecte).join('')}
        </div>` : `
        <div class="stack" style="margin-top:14px">
          ${llista.length
            ? llista.map(p => filaPartit(p, `#/partit/${p.id}`)).join('')
            : `<p class="empty">${buit}</p>`}
        </div>`}
      ${esPortada && !llista.length ? `<p class="empty">${buit}</p>` : ''}
    `}

    ${esPortada && noticia ? `
      <div class="section-title">${icon('news', 'icon icon-sm')} Notícies</div>
      <button class="card card-pad card-clicable" data-anar="#/noticies">
        ${noticia.etiqueta ? `<span class="pill pill-yellow">${esc(noticia.etiqueta)}</span>` : ''}
        <h4 class="noticia-titol">${esc(noticia.titol)}</h4>
        ${noticia.entradeta ? `<p class="page-sub" style="margin-top:6px">${esc(noticia.entradeta)}</p>` : ''}
        <p class="page-sub">${esc(formatData(String(noticia.publicada_a).slice(0, 10)))}</p>
      </button>` : ''}`;
}

function bloqueJornades() {
  const partits = Store.calendari[categoriaCalendari] || [];

  const selector = `
    <div class="segments" style="margin-top:12px">
      ${Store.categories.map(c => `
        <button class="segment ${c.id === categoriaCalendari ? 'active' : ''}" data-categoria="${c.id}">
          ${esc(c.nom)}
        </button>`).join('')}
    </div>`;

  if (!partits.length) {
    return selector + '<p class="empty">Encara no hi ha partits en aquesta categoria.</p>';
  }

  const perJornada = new Map();
  partits.forEach(p => {
    const j = p.jornada ?? 0;
    if (!perJornada.has(j)) perJornada.set(j, []);
    perJornada.get(j).push(p);
  });

  const jornades = [...perJornada.keys()].sort((a, b) => a - b);

  // La jornada que s'està jugant (o la primera pendent) surt ja desplegada:
  // és la que ve a mirar tothom.
  const actual = jornades.find(j => perJornada.get(j).some(p => p.estat !== 'finalitzat'))
    ?? jornades.at(-1);

  return selector + '<div class="jornades">' + jornades.map(j => {
    const llista = perJornada.get(j);
    const acabats = llista.filter(p => p.estat === 'finalitzat').length;
    return `
      <details class="card jornada"${j === actual ? ' open' : ''}>
        <summary>
          <span class="jornada-num">${j}</span>
          <span class="jornada-info">
            <strong>Jornada ${j}</strong>
            <small>${esc(formatData(llista[0].data))}</small>
          </span>
          <span class="jornada-comptador">${acabats}/${llista.length} jugats</span>
        </summary>
        <div class="jornada-partits">${llista.map(filaJornada).join('')}</div>
      </details>`;
  }).join('') + '</div>';
}

/** Fila compacta: equip · resultat · equip. Per al calendari. */
function filaJornada(p) {
  const sg = setsGuanyats(p);
  const enDirecte = p.estat === 'directe';
  const acabat = p.estat === 'finalitzat';

  const centre = enDirecte
    ? `<span class="viu">${sg.local}-${sg.visitant}</span>
       <small class="viu-punts">${p.punts.local}-${p.punts.visitant}</small>`
    : acabat
      ? `<strong>${sg.local}-${sg.visitant}</strong>`
      : `<small class="muted">${esc(p.hora || '')}</small>`;

  const pes = costat => acabat && sg[costat] > sg[costat === 'local' ? 'visitant' : 'local']
    ? 'guanyador' : '';

  return `
    <a class="fila-jornada" data-anar="#/partit/${p.id}">
      <span class="fj-equip dreta ${pes('local')}">${esc(p.local.nom)}</span>
      <span class="fj-centre">
        ${enDirecte ? '<small class="etiqueta-viu">En directe</small>' : ''}
        ${centre}
      </span>
      <span class="fj-equip ${pes('visitant')}">${esc(p.visitant.nom)}</span>
    </a>`;
}

/* ---------- Detall d'un partit ---------- */

async function carregarPartit(id) {
  await Store.carregarPartit(id);
}

function viewPartit(id) {
  const p = Store.partit(id);
  if (!p) return viewNoTrobat();

  renderTopbar({ titol: 'Detall del partit', enrere: '#/partits' });
  renderTabbar(null);

  const sg = setsGuanyats(p);
  const enDirecte = p.estat === 'directe';

  return `
    <div class="ref-header">
      <div class="spread">
        ${pillEstat(p)}
        <span style="font-size:11px;opacity:.85">
          ${esc(p.categoria.nom)}${p.jornada ? ` · Jornada ${p.jornada}` : ''}
        </span>
      </div>

      <div class="scoreboard">
        <div class="sb-team">
          ${crest(p.local, 'crest-lg crest-outline')}
          <div class="sb-name">${esc(p.local.nom)}</div>
          <div class="sb-points">${enDirecte ? p.punts.local : sg.local}</div>
        </div>
        <div class="sb-mid">
          <div class="sb-sets">${sg.local} – ${sg.visitant}</div>
          <div class="sb-setlabel">${enDirecte ? 'Set ' + numSetActual(p) : 'Sets'}</div>
        </div>
        <div class="sb-team">
          ${crest(p.visitant, 'crest-lg crest-outline')}
          <div class="sb-name">${esc(p.visitant.nom)}</div>
          <div class="sb-points">${enDirecte ? p.punts.visitant : sg.visitant}</div>
        </div>
      </div>

      ${tiraSets(p)}
    </div>

    <div class="columnes">
      <section>
        <div class="section-title">${icon('chart', 'icon icon-sm')} Sets</div>
        <div class="card card-pad">
          ${p.sets.length || enDirecte
            ? tiraSets(p, 'clar')
            : '<p class="muted" style="font-size:13px">El partit encara no ha començat.</p>'}
        </div>
      </section>

      <section>
        <div class="section-title">${icon('info', 'icon icon-sm')} Informació</div>
        <div class="card">
          <div class="log-item">${icon('calendar', 'icon icon-sm')} ${esc(formatData(p.data))}${p.hora ? ' · ' + esc(p.hora) : ''}</div>
          ${p.pista ? `<div class="log-item">${icon('pin', 'icon icon-sm')} ${esc(p.pista)}</div>` : ''}
          <div class="log-item">${icon('whistle', 'icon icon-sm')} Àrbitre
            <span class="log-time">${esc(p.arbitre?.nom || 'Per designar')}</span>
          </div>
          ${p.iniciat_a ? `<div class="log-item">${icon('clock', 'icon icon-sm')} Iniciat a les
            <span class="log-time">${esc(formatHora(p.iniciat_a))}</span></div>` : ''}
        </div>
      </section>
    </div>

    ${p.estat !== 'finalitzat' && Store.pot('partit.convocatoria') ? `
      <button class="btn btn-outline btn-block" data-anar="#/partit/${id}/convocatoria"
              style="margin-bottom:14px">
        ${icon('users', 'icon icon-sm')} Convocatòria
      </button>` : ''}

    <div class="section-title">${icon('users', 'icon icon-sm')} Equips</div>
    <div class="grid-2">
      ${[p.local, p.visitant].map(e => `
        <button class="team-card" data-anar="#/equip/${e.id}">
          ${crest(e, 'crest-lg')}
          <div class="team-card-name">${esc(e.nom)}</div>
        </button>`).join('')}
    </div>`;
}

/* ---------- Classificació ---------- */

let categoriaActiva = null;

/* Dues maneres de mirar la taula. Es recorda entre visites: qui la vol
   completa la vol sempre, i qui la vol simple, també. */
let taulaCompleta = localStorage.getItem('volei-taula') === 'completa';

async function carregarClassificacio() {
  const categories = await Store.carregarCategories();
  categoriaActiva ??= categories[0]?.id ?? null;
  if (categoriaActiva !== null) await Store.carregarClassificacio(categoriaActiva);
}

function viewClassificacio() {
  renderNav('classificacio');

  const taula = Store.classificacions[categoriaActiva] || [];
  const cat = Store.categoria(categoriaActiva);
  const hiHaSorteig = taula.some(e => e.sorteig_pendent);

  App.accions = {
    canviarVista() {
      taulaCompleta = !taulaCompleta;
      localStorage.setItem('volei-taula', taulaCompleta ? 'completa' : 'simple');
      pintar();
    },
  };

  return `
    <h2 class="page-title">Classificació</h2>
    <p class="page-sub" style="margin-bottom:16px">Lliga Voleimasters</p>

    <div class="segments">
      ${Store.categories.map(c => `
        <button class="segment metall-${c.nivell} ${c.id === categoriaActiva ? 'active' : ''}"
                data-categoria="${c.id}">${esc(c.nom)}</button>`).join('')}
    </div>

    <div class="card metall-fons-${cat?.nivell ?? 0}" style="margin-top:14px">
      <div class="card-head">
        ${icon('trophy', 'icon icon-sm')} ${esc(cat?.nom || '')}
        <button class="btn-vista" data-accio="canviarVista">
          ${icon(taulaCompleta ? 'contraure' : 'expandir', 'icon icon-sm')}
          ${taulaCompleta ? 'Vista simple' : 'Vista completa'}
        </button>
      </div>
      <div class="table-wrap">
        <table class="standings">
          <thead>
            <tr>
              <th>Equip</th>
              <th>PJ</th>
              ${taulaCompleta ? '<th>PG</th><th>PP</th><th>Sets</th>' : ''}
              <th class="pts">PTS</th>
            </tr>
          </thead>
          <tbody>
            ${taula.map(e => `
              <tr class="mov-${e.moviment || 'cap'}" data-anar="#/equip/${e.equip_id}"
                  ${e.moviment ? `title="${e.moviment === 'ascens' ? 'Puja de categoria' : 'Baixa de categoria'}"` : ''}>
                <td>
                  <div class="team-cell">
                    ${crest(e)}
                    <span>${esc(e.nom)}</span>
                    ${e.moviment === 'ascens' ? icon('up', 'icon icon-xs mov-icon') : ''}
                    ${e.moviment === 'descens' ? icon('down', 'icon icon-xs mov-icon') : ''}
                    ${e.sorteig_pendent ? '<span class="pill pill-soft">sorteig</span>' : ''}
                  </div>
                </td>
                <td>${e.pj}</td>
                ${taulaCompleta ? `
                  <td class="win">${e.pg}</td>
                  <td class="loss">${e.pp}</td>
                  <td class="muted">${e.sf}-${e.sc}</td>` : ''}
                <td class="pts">${e.pts}</td>
              </tr>`).join('')}
          </tbody>
        </table>
      </div>
      ${llegendaMoviments(taula)}
    </div>

    ${hiHaSorteig ? `
      <div class="note note-avis" style="margin-top:14px">
        ${icon('alert', 'icon icon-sm')}
        <span>Hi ha equips igualats en tots els criteris de desempat: l'ordre entre ells
        s'ha de decidir per sorteig i encara no és definitiu.</span>
      </div>` : ''}`;
}

/**
 * Peu que explica el verd i el vermell. Només surt el que la taula
 * ensenya: a Or no hi ha ascens i a Ferro no hi ha descens, i posar-hi
 * una llegenda de colors que no hi són despistaria.
 */
function llegendaMoviments(taula) {
  const puja = taula.some(e => e.moviment === 'ascens');
  const baixa = taula.some(e => e.moviment === 'descens');
  if (!puja && !baixa) return '';

  return `
    <div class="llegenda-taula">
      ${puja ? '<span><i class="llegenda-punt puja"></i> Puja de categoria</span>' : ''}
      ${baixa ? '<span><i class="llegenda-punt baixa"></i> Baixa de categoria</span>' : ''}
    </div>`;
}

/* ---------- Equips ---------- */

async function carregarEquips() {
  const categories = await Store.carregarCategories();
  await Promise.all(categories.map(c => Store.carregarEquips(c.id)));
}

function viewEquips() {
  renderNav('equips');

  const total = Object.values(Store.equipsPerCategoria)
    .reduce((n, llista) => n + llista.length, 0);

  App.accions = {};

  return `
    <h2 class="page-title">Equips</h2>
    <p class="page-sub" style="margin-bottom:16px">${total} equips a la lliga</p>

    ${bloqueCrearEquip()}

    ${Store.categories.map(c => `
      <div class="section-title metall-text-${c.nivell}">
        ${icon('shield', 'icon icon-sm')} ${esc(c.nom)}
      </div>
      <div class="grid-2">
        ${(Store.equipsPerCategoria[c.id] || []).map(e => `
          <button class="team-card" data-anar="#/equip/${e.id}">
            ${crest(e, 'crest-lg')}
            <div class="team-card-name">${esc(e.nom)}</div>
            <div class="team-card-meta">${esc(e.ciutat || '')}</div>
          </button>`).join('')}
      </div>`).join('')}`;
}

/* ---------- Fitxa d'un equip ---------- */

let editantEquip = false;

async function carregarEquip(id) {
  await Promise.all([Store.carregarEquip(id), Avisos.carregar()]);
}

function viewEquip(id) {
  const fitxa = Store.fitxesEquip[id];
  if (!fitxa) return viewNoTrobat();

  const e = fitxa.equip;
  const st = fitxa.estadistiques;

  renderTopbar({ titol: e.nom, enrere: '#/equips' });
  renderTabbar(null);

  if (editantEquip) return formulariEquip(fitxa);

  App.accions = {
    editar() { editantEquip = true; pintar(); },

    async seguir(boto) {
      boto.disabled = true;
      try {
        if (Avisos.segueix(e.id)) {
          await Avisos.deixar(e.id);
          toast('Ja no segueixes ' + e.nom);
        } else {
          await Avisos.seguir(e.id);
          toast('Segueixes ' + e.nom + '. T\'avisarem dels seus partits.');
        }
      } catch (err) {
        toast(err.message);
      }
      pintar();
    },
  };

  const stat = (valor, etiqueta) => `
    <div class="stat">
      <div class="stat-valor">${valor}</div>
      <div class="team-card-meta">${etiqueta}</div>
    </div>`;

  const propers = fitxa.partits.filter(p => p.estat !== 'finalitzat').slice(0, 5);
  const ultims = fitxa.partits.filter(p => p.estat === 'finalitzat').slice(-5).reverse();

  return `
    <div class="card card-pad" style="text-align:center">
      ${crest(e, 'crest-lg')}
      <h3 class="equip-nom">${esc(e.nom)}</h3>
      <p class="page-sub">${[e.ciutat, e.categoria?.nom].filter(Boolean).map(esc).join(' · ')}</p>
      ${st ? `
        <div class="row" style="margin-top:18px">
          ${stat(st.pts, 'Punts')}
          ${stat(st.pj, 'Jugats')}
          ${stat(st.pg, 'Guanyats')}
          ${stat(st.pp, 'Perduts')}
        </div>` : ''}
      ${Avisos.esPossible() ? `
        <button class="btn ${Avisos.segueix(e.id) ? 'btn-outline' : 'btn-primary'} btn-block"
                data-accio="seguir" style="margin-top:16px">
          ${icon('bell', 'icon icon-sm')}
          ${Avisos.segueix(e.id) ? 'Deixar de seguir' : 'Seguir aquest equip'}
        </button>` : ''}
      ${fitxa.pots_gestionar ? `
        <button class="btn btn-outline btn-block" data-anar="#/equip/${e.id}/plantilla"
                style="margin-top:8px">
          ${icon('users', 'icon icon-sm')} Gestionar la plantilla
        </button>
        <button class="btn btn-ghost btn-block" data-accio="editar" style="margin-top:8px">
          ${icon('edit', 'icon icon-sm')} Editar la fitxa
        </button>` : ''}
    </div>

    ${e.descripcio?.trim() ? `
      <div class="section-title">${icon('info', 'icon icon-sm')} Descripció</div>
      <div class="card card-pad"><p class="descripcio">${esc(e.descripcio)}</p></div>` : ''}

    ${st ? `
      <div class="section-title">${icon('chart', 'icon icon-sm')} Balanç de sets</div>
      <div class="card card-pad row" style="gap:20px">
        ${stat(st.sf, 'A favor')}
        ${stat(st.sc, 'En contra')}
        ${stat((st.sf - st.sc > 0 ? '+' : '') + (st.sf - st.sc), 'Diferència')}
      </div>` : ''}

    <div class="columnes">
      <section>
        <div class="section-title">${icon('users', 'icon icon-sm')} Plantilla</div>
        <div class="card">
          ${fitxa.plantilla.length ? fitxa.plantilla.map(j => `
            <div class="log-item">
              <span class="dorsal">${j.dorsal ?? '–'}</span>
              <span>${esc(j.nom)} ${esc(j.cognoms)}</span>
              <span class="log-time">
                ${j.es_capita ? 'Capità' : j.tipus === 'entrenador' ? 'Entrenador' : ''}
              </span>
            </div>`).join('') : '<p class="empty">Sense jugadors donats d\'alta.</p>'}
        </div>
      </section>

      <section>
        ${propers.length ? `
          <div class="section-title">${icon('calendar', 'icon icon-sm')} Propers partits</div>
          <div class="stack">${propers.map(p => filaPartit(p, `#/partit/${p.id}`)).join('')}</div>
        ` : ''}
        ${ultims.length ? `
          <div class="section-title">${icon('history', 'icon icon-sm')} Últims resultats</div>
          <div class="stack">${ultims.map(p => filaPartit(p, `#/partit/${p.id}`)).join('')}</div>
        ` : ''}
      </section>
    </div>`;
}

function formulariEquip(fitxa) {
  const e = fitxa.equip;

  App.accions = {
    cancelar() { editantEquip = false; pintar(); },

    async desar(boto) {
      boto.disabled = true;
      boto.textContent = 'Desant…';
      try {
        await Store.desarEquip(e.id, {
          color: $('#f-color').value,
          sigles: $('#f-sigles').value.trim(),
          ciutat: $('#f-ciutat').value.trim(),
          logo: $('#f-logo').value.trim(),
          descripcio: $('#f-descripcio').value,
        });
        editantEquip = false;
        toast('Fitxa desada');
        pintar();
      } catch (err) {
        toast(err.message);
        boto.disabled = false;
        boto.textContent = 'Desar';
      }
    },
  };

  return `
    <div class="card card-pad">
      <h3 class="form-titol">Editar la fitxa</h3>

      <div class="field">
        <label for="f-color">Color de l'equip</label>
        <div class="fila-color">
          <input id="f-color" type="color" value="${esc(e.color || '#4a7c00')}" />
          <span class="muted">Es fa servir als escuts, al marcador i a l'acta.</span>
        </div>
      </div>

      <div class="fila-camps">
        <div class="field">
          <label for="f-sigles">Sigles</label>
          <input id="f-sigles" type="text" maxlength="4" autocapitalize="characters"
                 value="${esc(e.sigles || '')}" placeholder="EPV" />
        </div>
        <div class="field">
          <label for="f-ciutat">Ciutat</label>
          <input id="f-ciutat" type="text" value="${esc(e.ciutat || '')}" />
        </div>
      </div>

      <div class="field">
        <label for="f-logo">Logo (adreça d'imatge)</label>
        <input id="f-logo" type="url" inputmode="url" autocapitalize="off"
               placeholder="https://…" value="${esc(e.logo || '')}" />
      </div>

      <div class="field">
        <label for="f-descripcio">Descripció</label>
        <textarea id="f-descripcio" rows="5">${esc(e.descripcio || '')}</textarea>
      </div>

      <div class="ref-actions">
        <button class="btn btn-outline" data-accio="cancelar">Cancel·lar</button>
        <button class="btn btn-primary" data-accio="desar">Desar</button>
      </div>

      <p class="nota-petita">
        Els punts, la categoria i el nom els mou la coordinació de la lliga, no l'equip.
      </p>
    </div>`;
}

/* ---------- Notícies ---------- */

async function carregarNoticies() {
  await Store.carregarNoticies();
}

function viewNoticies() {
  renderNav('noticies');

  return `
    <h2 class="page-title">Notícies</h2>
    <p class="page-sub" style="margin-bottom:16px">Comunicats i actualitat de la lliga</p>

    <div class="stack">
      ${Store.noticies.length ? Store.noticies.map(n => `
        <article class="card card-pad">
          ${n.etiqueta ? `<span class="pill pill-yellow">${esc(n.etiqueta)}</span>` : ''}
          <h3 class="noticia-titol gran">${esc(n.titol)}</h3>
          ${n.entradeta ? `<p class="descripcio">${esc(n.entradeta)}</p>` : ''}
          <p class="page-sub">${esc(formatData(String(n.publicada_a).slice(0, 10)))}</p>
        </article>`).join('')
        : '<p class="empty">Encara no hi ha notícies.</p>'}
    </div>`;
}

/* ---------- Perfil ---------- */

const NOMS_ROL = {
  admin: 'Administració', coord_lliga: 'Coordinació de lliga',
  coord_club: 'Coordinació de club', coord_equip: "Coordinació d'equip",
  entrenador: 'Entrenador', jugador: 'Jugador', capita: 'Capità',
  arbitre: 'Àrbitre', usuari: 'Usuari',
};

async function carregarPerfil() {
  await Avisos.carregar();
}

function viewPerfil() {
  renderTopbar({ titol: 'Perfil', enrere: '#/inici' });
  renderTabbar(null);

  const u = Store.usuari;
  const rols = [...new Set((u?.permisos || []).map(p => NOMS_ROL[p.rol] || p.rol))];

  return `
    ${u ? `
      <div class="card card-pad" style="text-align:center">
        <div class="crest crest-lg" style="margin:0 auto">${esc(inicials(u))}</div>
        <h3 class="equip-nom">${esc(u.nom)} ${esc(u.cognoms || '')}</h3>
        <p class="page-sub">${esc(rols.join(' · ') || 'Usuari')}</p>
        <button class="btn btn-primary btn-block" data-anar="#/jo" style="margin-top:16px">
          ${icon('user', 'icon icon-sm')} La meva fitxa
        </button>
        ${Store.esArbitre() ? `
          <button class="btn btn-outline btn-block" data-anar="#/arbitre" style="margin-top:8px">
            ${icon('whistle', 'icon icon-sm')} Els meus partits
          </button>` : ''}
        ${Store.esCoordinacio() ? `
          <button class="btn btn-outline btn-block" data-anar="#/admin" style="margin-top:8px">
            ${icon('key', 'icon icon-sm')} Configuració de la lliga
          </button>` : ''}
      </div>` : `
      <div class="card card-pad" style="text-align:center">
        <div class="crest crest-lg" style="margin:0 auto">${icon('user')}</div>
        <h3 class="equip-nom">Convidat</h3>
        <p class="page-sub">Inicia sessió per gestionar els teus partits.</p>
        <button class="btn btn-primary btn-block" data-anar="#/login" style="margin-top:16px">Iniciar sessió</button>
        <button class="btn btn-ghost btn-block" data-anar="#/registre" style="margin-top:6px">Crear un compte</button>
      </div>`}

    ${bloqueInstalar()}

    <div class="section-title">${icon('list', 'icon icon-sm')} Preferències</div>
    <div class="card">
      <button class="log-item" style="width:100%" data-accio="tema">
        ${icon(Store.tema === 'dark' ? 'sun' : 'moon', 'icon icon-sm')}
        Tema ${Store.tema === 'dark' ? 'clar' : 'fosc'}
        <span class="log-time">${Store.tema === 'dark' ? 'Fosc' : 'Clar'}</span>
      </button>
      <button class="log-item" style="width:100%" data-anar="#/noticies">
        ${icon('news', 'icon icon-sm')} Notícies de la lliga
      </button>
      ${u ? `
        <button class="log-item" style="width:100%;color:var(--red)" data-accio="sortir">
          ${icon('logout', 'icon icon-sm')} Tancar sessió
        </button>` : ''}
    </div>`;
}

/* ---------- Avisos ---------- */

const TIPUS_AVIS = [
  { clau: 'marcador', nom: 'Marcador en directe',
    detall: 'Quan comença un partit dels equips que segueixes, quan es tanca un set i el resultat final.' },
  { clau: 'noticies', nom: 'Notícies de la lliga',
    detall: 'Comunicats de la coordinació.' },
  { clau: 'calendari', nom: 'Canvis de calendari',
    detall: 'Partits ajornats, canvis d\'hora o de pista.' },
];

/**
 * Instal·lar l'app, sempre a mà.
 *
 * El cartell d'abaix es pot tancar i llavors no torna mai més. Aquí no
 * marxa: qui el va tancar i després ho vol, sap on trobar-ho. Dins de
 * l'app instal·lada o de l'APK no hi surt, que no hi hauria res a fer.
 */
function bloqueInstalar() {
  if (!espotInstalar()) return '';

  return `
    <div class="section-title">${icon('download', 'icon icon-sm')} L'app al mòbil</div>
    <div class="card card-pad">
      <p class="page-sub" style="margin-bottom:14px">
        Instal·lada s'obre com qualsevol altra app, va sense connexió i és
        l'única manera de rebre els avisos dels partits.
      </p>
      <button class="btn btn-primary btn-block" data-accio="instalarApp">
        ${icon('download', 'icon icon-sm')} Instal·lar Voleimasters
      </button>
    </div>`;
}

function bloqueAvisos() {
  if (!Avisos.esPossible()) {
    return `
      <div class="section-title">${icon('bell', 'icon icon-sm')} Avisos</div>
      <div class="note">
        ${icon('info', 'icon icon-sm')}
        <span>Aquest navegador no pot rebre avisos.</span>
      </div>`;
  }

  // A l'iPhone no funcionen fins que s'afegeix a la pantalla d'inici; val
  // més dir-ho aquí que deixar que ho provi i no li arribi res.
  if (esIphone() && !estaInstalada()) {
    return `
      <div class="section-title">${icon('bell', 'icon icon-sm')} Avisos</div>
      <div class="note note-avis">
        ${icon('info', 'icon icon-sm')}
        <span>Per rebre avisos a l'iPhone cal afegir Voleimasters a la pantalla d'inici:
        toca Compartir i tria «Afegir a la pantalla d'inici».</span>
      </div>`;
  }

  const actius = !!Avisos.estat?.subscrit;

  if (!actius) {
    return `
      <div class="section-title">${icon('bell', 'icon icon-sm')} Avisos</div>
      <div class="card card-pad">
        <p class="page-sub" style="margin-bottom:14px">
          Rep un avís quan juguin els teus equips, encara que tinguis l'app tancada.
        </p>
        <button class="btn btn-primary btn-block" data-accio="activarAvisos">
          ${icon('bell', 'icon icon-sm')} Activar els avisos
        </button>
        ${Avisos.permis() === 'denied' ? `
          <p class="nota-petita">Ara mateix els tens bloquejats al navegador.
          Caldrà permetre'ls des dels ajustos del lloc.</p>` : ''}
      </div>`;
  }

  const prefs = Avisos.estat.preferencies;
  const seguits = Avisos.estat.seguint;

  return `
    <div class="section-title">${icon('bell', 'icon icon-sm')} Avisos</div>
    <div class="card">
      ${TIPUS_AVIS.map(t => `
        <button class="log-item interruptor" style="width:100%" data-avis="${t.clau}">
          <span class="interruptor-text">
            <strong>${esc(t.nom)}</strong>
            <small>${esc(t.detall)}</small>
          </span>
          <span class="palanca ${prefs[t.clau] ? 'activa' : ''}"></span>
        </button>`).join('')}
    </div>

    <div class="card" style="margin-top:10px">
      <div class="log-item">
        ${icon('users', 'icon icon-sm')} Equips que segueixes
        <span class="log-time">${seguits.length}</span>
      </div>
      ${seguits.length
        ? seguits.map(e => `
            <button class="log-item" style="width:100%" data-deixar="${e.id}">
              <span class="dorsal">${icon('close', 'icon icon-xs')}</span>
              <span>${esc(e.nom)}</span>
            </button>`).join('')
        : `<p class="nota-petita" style="padding:0 16px 14px">
             Encara no en segueixes cap. Entra a la fitxa d'un equip i toca «Seguir».
           </p>`}
    </div>

    <div class="card" style="margin-top:10px">
      <button class="log-item" style="width:100%" data-accio="provaAvis">
        ${icon('bell', 'icon icon-sm')} Enviar-me un avís de prova
      </button>
      <button class="log-item" style="width:100%;color:var(--red)" data-accio="desactivarAvisos">
        ${icon('close', 'icon icon-sm')} Deixar de rebre avisos
      </button>
    </div>`;
}

function inicials(u) {
  return ((u.nom?.[0] || '') + (u.cognoms?.[0] || '')).toUpperCase() || '?';
}

function viewNoTrobat() {
  renderTopbar({ titol: 'No trobat', enrere: '#/inici' });
  renderTabbar(null);
  return `<p class="empty">Aquest contingut no existeix.</p>`;
}
