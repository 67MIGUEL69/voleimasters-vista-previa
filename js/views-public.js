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

/**
 * El que espera resposta teva, a la portada.
 *
 * Una data proposada per l'altre equip, un partit sense dia, una
 * pregunta de disponibilitat: coses que demanen una decisió i que abans
 * només es veien si obries el partit que tocava per casualitat. L'avís
 * al mòbil no hi arriba sempre —cal tenir-los activats, ser un telèfon i
 * que el servidor tingui el cron en marxa— i aquí no cal res.
 */
const MAX_PENDENTS = 4;

const ICONA_PENDENT = {
  proposta: 'calendar',
  sense_dia: 'clock',
  disponibilitat: 'users',
  acta: 'edit',
};

function bloqueEtToca() {
  const llista = Store.pendents;
  if (!llista.length) return '';

  const mostrats = llista.slice(0, MAX_PENDENTS);
  const resten = llista.length - mostrats.length;

  return `
    <div class="section-title">${icon('bell', 'icon icon-sm')} Notificacions</div>
    <div class="card" style="margin-bottom:16px">
      ${mostrats.map(p => `
        <button class="log-item et-toca" style="width:100%" data-anar="${esc(p.url)}">
          ${icon(ICONA_PENDENT[p.tipus] || 'info', 'icon icon-sm')}
          <span class="et-toca-text">
            <strong>${esc(p.titol)}</strong>
            <span class="ajuda">${esc(p.detall)}</span>
          </span>
          ${icon('right', 'icon icon-sm')}
        </button>`).join('')}
      ${resten > 0 ? `
        <div class="card-pad">
          <p class="ajuda" style="margin:0">
            I ${resten} ${resten === 1 ? 'cosa més' : 'coses més'} per fer.
          </p>
        </div>` : ''}
    </div>`;
}

/*
  El nom de la lliga surt dels ajustos, no d'aquí dins.

  Estava escrit a mà en tres pantalles, i la coordinació el canviava des
  d'administració sense que passés res enlloc: es va estar mig dia
  buscant per què el subtítol nou no sortia.
*/
function nomDeLaLliga() {
  return Store.marca?.nom || 'Voleimasters';
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
      <span class="pill pill-yellow">${esc(nomDeLaLliga())}</span>
      <h2 class="page-title" style="margin-top:8px">Partits</h2>
      ${Store.marca?.subtitol ? `<p class="page-sub">${esc(Store.marca.subtitol)}</p>` : ''}
    </div>

    ${bloqueEtToca()}

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
        <button class="segment ${c.id === categoriaCalendari ? 'active' : ''}"
                data-categoria="${c.id}" data-per="calendari">
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

  // Les propostes de data només interessen a qui pot fer-hi alguna cosa;
  // per a qui ve a mirar el marcador seria una crida per a res.
  const p = Store.partit(id);
  if (p?.pot_editar_dades || p?.pot_assignar_arbitre) {
    try { await Store.carregarPropostes(id); } catch (_) { /* no és imprescindible */ }
  }

  // La disponibilitat la mira qui hi juga i qui l'organitza. El servidor
  // ja retalla el que no et toca; si no ets ningú, torna les llistes
  // buides i no es pinta res.
  if (Store.usuari) {
    try { await Store.carregarDisponibilitat(id); } catch (_) { /* tampoc no ho és */ }
  }
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

    ${bloqueActa(p, id)}

    ${bloqueDisponibilitat(p, id)}

    ${bloqueOrganitzar(p, id)}

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
    <p class="page-sub" style="margin-bottom:16px">${esc(nomDeLaLliga())}</p>

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

/*
  Per grup o per club. Un club pot tenir equips repartits per tota la
  lliga —els Papis en tenen a Or i a Plata— i mirant la llista per
  categories no hi ha manera de saber qui és de qui.
*/
let vistaEquips = 'grup';

function targetaEquip(e, ambGrup = false) {
  const sota = ambGrup ? (e.categoria?.nom || '') : (e.ciutat || '');
  return `
    <button class="team-card" data-anar="#/equip/${e.id}">
      ${crest(e, 'crest-lg')}
      <div class="team-card-name">${esc(e.nom)}</div>
      <div class="team-card-meta">${esc(sota)}</div>
    </button>`;
}

function viewEquips() {
  renderNav('equips');

  const tots = Store.categories.flatMap(c => Store.equipsPerCategoria[c.id] || []);

  App.accions = {
    vista(el) { vistaEquips = el.dataset.vistaEquips; pintar(); },
  };

  const perGrup = Store.categories.map(c => `
    <div class="section-title metall-text-${c.nivell}">
      ${icon('shield', 'icon icon-sm')} ${esc(c.nom)}
    </div>
    <div class="grid-2">
      ${(Store.equipsPerCategoria[c.id] || []).map(e => targetaEquip(e)).join('')}
    </div>`).join('');

  // Els clubs, per ordre alfabètic, i al final els equips que no en són
  // de cap: existeixen, i amagar-los seria pitjor.
  const clubs = new Map();
  const sense = [];
  for (const e of tots) {
    if (e.club_id === null || e.club_id === undefined) { sense.push(e); continue; }
    if (!clubs.has(e.club_id)) clubs.set(e.club_id, { nom: e.club, equips: [] });
    clubs.get(e.club_id).equips.push(e);
  }
  const ordenats = [...clubs.values()].sort((a, b) => a.nom.localeCompare(b.nom, 'ca'));

  const perClub = ordenats.map(c => `
    <div class="section-title">
      ${icon('shield', 'icon icon-sm')} ${esc(c.nom)}
      <span class="ajuda" style="margin-left:auto;font-weight:600">
        ${c.equips.length} ${c.equips.length === 1 ? 'equip' : 'equips'}
      </span>
    </div>
    <div class="grid-2">${c.equips.map(e => targetaEquip(e, true)).join('')}</div>`).join('')
    + (sense.length ? `
      <div class="section-title">${icon('users', 'icon icon-sm')} Sense club</div>
      <div class="grid-2">${sense.map(e => targetaEquip(e, true)).join('')}</div>` : '');

  return `
    <h2 class="page-title">Equips</h2>
    <p class="page-sub" style="margin-bottom:16px">${tots.length} equips a la lliga</p>

    ${bloqueBuscarEquip()}
    ${bloqueCrearEquip()}

    <div class="segments" style="margin-bottom:4px">
      <button class="segment ${vistaEquips === 'grup' ? 'active' : ''}"
              data-accio="vista" data-vista-equips="grup">Per grup</button>
      <button class="segment ${vistaEquips === 'club' ? 'active' : ''}"
              data-accio="vista" data-vista-equips="club">Per club</button>
    </div>

    ${vistaEquips === 'grup' ? perGrup : perClub}`;
}

/*
  L'accés a buscar equip. A dalt de tot i petit, que qui ve a mirar la
  classificació no hi té res a fer.

  Surt a qui ha entrat i no consta a cap equip. Qui coordina la lliga o
  un club tampoc el veu: no busca equip, en reparteix.
*/
function bloqueBuscarEquip() {
  if (!Store.usuari) return '';
  if (Store.esCoordinacio() || Store.pot('equip.crear')) return '';
  if (Store.elMeuEquip() !== null) return '';

  return `
    <button class="btn btn-outline btn-block" data-anar="#/buscar-equip"
            style="margin-bottom:14px">
      ${icon('users', 'icon icon-sm')} Busques equip?
    </button>`;
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
      <p class="page-sub">${[e.ciutat, e.categoria?.nom, e.club].filter(Boolean).map(esc).join(' · ')}</p>
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

    triarLogo() {
      const camp = document.createElement('input');
      camp.type = 'file';
      camp.accept = 'image/*';
      camp.onchange = async () => {
        const fitxer = camp.files?.[0];
        if (!fitxer) return;
        toast('Preparant el logotip…');
        try {
          await Store.desarLogo(e.id, await reduirLogo(fitxer));
          toast('Logotip canviat');
          pintar();
        } catch (err) { toast(err.message); }
      };
      camp.click();
    },

    treureLogo() {
      confirmar({
        titol: 'Treure el logotip?',
        text: "L'escut tornarà a ensenyar les sigles amb els colors de l'equip.",
        confirma: 'Treure\'l',
        perill: true,
        async onOk() {
          try {
            await Store.esborrarLogo(e.id);
            toast('Logotip tret');
            pintar();
          } catch (err) { toast(err.message); }
        },
      });
    },

    async desar(boto) {
      boto.disabled = true;
      boto.textContent = 'Desant…';
      try {
        await Store.desarEquip(e.id, {
          color: $('#f-color').value,
          color_secundari: $('#f-color-2').value,
          sigles: $('#f-sigles').value.trim(),
          ciutat: $('#f-ciutat').value.trim(),
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
        <label for="f-color">Colors de l'equip</label>
        <div class="fila-color">
          <input id="f-color" type="color" value="${esc(e.color || '#4a7c00')}"
                 aria-label="Color principal" />
          <input id="f-color-2" type="color" value="${esc(e.color_2 || '#ffffff')}"
                 aria-label="Segon color" />
          ${crest({ sigles: e.sigles, color: e.color, color_2: e.color_2 })}
        </div>
        <p class="nota-petita">
          Es fan servir als escuts, al marcador i a l'acta. El segon serveix
          per distingir-vos d'un altre equip que hagi triat el mateix color.
        </p>
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
        <label>Logotip</label>
        <div class="fila-color">
          ${crest({ sigles: e.sigles, color: e.color, color_2: e.color_2, logo: e.logo },
                  'crest-lg')}
          <button class="btn btn-outline btn-petit" data-accio="triarLogo">
            ${e.logo ? 'Canviar-lo' : 'Pujar una imatge'}
          </button>
          ${e.logo ? `<button class="btn btn-ghost btn-petit" data-accio="treureLogo">
            Treure'l
          </button>` : ''}
        </div>
        <p class="nota-petita">
          El logotip es puja des del mòbil o l'ordinador i es desa aquí mateix.
          Es canvia sol quan en pugeu un de nou: no se n'acumulen de vells.
        </p>
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
  // Els documents del club: només si has entrat, i sense fer sorolls si
  // no en tens cap.
  if (Store.usuari) {
    try { await Store.carregarClubs(); } catch (_) { Store.clubs = []; }
  } else {
    Store.clubs = [];
  }
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

    ${bloqueClub()}
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
    </div>

    <p class="credits">
      Desenvolupat a Catalunya per
      <a href="https://sportagia.com" target="_blank" rel="noopener">SportAgIA.com</a>.<br />
      Un servei de
      <a href="https://universagia.com" target="_blank" rel="noopener">UniversAgIA.com</a> (2026)
    </p>`;
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
/**
 * El que el club guarda de portes endins.
 *
 * De moment la pòlissa d'assegurança, que és el cas que va demanar la
 * coordinació. La veu tothom qui és del club —jugadors inclosos, que són
 * els que la necessiten el dia que algú es fa mal— i la penja la
 * coordinació del club.
 */
function bloqueClub() {
  if (!Store.clubs.length) return '';

  App.accions.pujarDocument = el => {
    const clubId = Number(el.dataset.club);
    const camp = document.createElement('input');
    camp.type = 'file';
    camp.accept = 'application/pdf,image/jpeg,image/png';
    camp.onchange = async () => {
      const fitxer = camp.files?.[0];
      if (!fitxer) return;
      toast('Pujant…');
      try {
        await Store.pujarDocument(clubId, {
          fitxer: await llegirComDataUrl(fitxer),
          nom: fitxer.name,
          tipus: 'assegurança',
        });
        toast('Document penjat');
        pintar();
      } catch (e) { toast(e.message); }
    };
    camp.click();
  };

  App.accions.treureDocument = el => {
    confirmar({
      titol: 'Esborrar aquest document?',
      text: 'Deixarà d\'estar a l\'abast de la gent del club.',
      confirma: 'Esborrar',
      perill: true,
      async onOk() {
        try {
          await Store.esborrarDocument(Number(el.dataset.doc));
          toast('Esborrat');
          pintar();
        } catch (e) { toast(e.message); }
      },
    });
  };

  return Store.clubs.map(c => `
    <div class="section-title">${icon('shield', 'icon icon-sm')} ${esc(c.nom)}</div>
    <div class="card">
      ${c.documents.length ? c.documents.map(d => `
        <div class="log-item">
          ${icon('news', 'icon icon-sm')}
          ${Store.enllacDocument(d.id)
            ? `<a href="${esc(Store.enllacDocument(d.id))}" target="_blank" rel="noopener">
                 ${esc(d.nom || 'Document')}
               </a>`
            : esc(d.nom || 'Document')}
          <span class="log-time">${midaEnKb(d.bytes)}</span>
          ${c.pot_editar ? `
            <button class="icon-btn ghost" data-accio="treureDocument" data-doc="${d.id}"
                    aria-label="Esborrar">${icon('close')}</button>` : ''}
        </div>`).join('')
        : `<div class="card-pad"><p class="ajuda">
             ${c.pot_editar
               ? 'Aquí hi va la pòlissa d\'assegurança i el que calgui tenir a mà.'
               : 'El club encara no hi ha penjat res.'}
           </p></div>`}
      ${c.pot_editar ? `
        <div class="card-pad">
          <button class="btn btn-outline btn-block" data-accio="pujarDocument"
                  data-club="${c.id}">
            ${icon('plus', 'icon icon-sm')} Penjar un document
          </button>
          <p class="nota-petita">
            PDF, JPEG o PNG. Ho veu la gent del club i ningú més.
          </p>
        </div>` : ''}
    </div>`).join('');
}

/** Un pes que es pugui llegir. Arrodonir a KB deixava un PDF petit en «0 KB». */
function midaEnKb(bytes) {
  if (bytes >= 1024 * 1024) return (bytes / 1024 / 1024).toFixed(1) + ' MB';
  if (bytes >= 1024) return Math.round(bytes / 1024) + ' KB';
  return '< 1 KB';
}

/**
 * Redueix el logotip abans d'enviar-lo.
 *
 * Com la foto de la fitxa (`reduirImatge`), però sense retallar i en PNG:
 * un escut retallat pel mig perd mitja lletra, i molts porten fons
 * transparent, que en JPEG es tornaria un quadrat negre. Es col·loca
 * centrat dins d'un quadrat de 256 px, que és més del que l'escut
 * ensenya mai.
 */
function reduirLogo(fitxer, costat = 256) {
  return new Promise((resol, rebutja) => {
    const lector = new FileReader();
    lector.onerror = () => rebutja(new Error('No s\'ha pogut llegir el fitxer.'));
    lector.onload = () => {
      const img = new Image();
      img.onerror = () => rebutja(new Error('Això no sembla una imatge.'));
      img.onload = () => {
        const mes = Math.max(img.width, img.height);
        const escala = Math.min(1, costat / mes);
        const a = Math.round(img.width * escala);
        const alt = Math.round(img.height * escala);
        const mida = Math.round(mes * escala);

        const llenc = document.createElement('canvas');
        llenc.width = llenc.height = mida;
        llenc.getContext('2d').drawImage(img, (mida - a) / 2, (mida - alt) / 2, a, alt);
        resol(llenc.toDataURL('image/png'));
      };
      img.src = lector.result;
    };
    lector.readAsDataURL(fitxer);
  });
}

/** Un fitxer tal com el vol l'API: data URL. */
function llegirComDataUrl(fitxer) {
  return new Promise((resol, rebutja) => {
    const lector = new FileReader();
    lector.onerror = () => rebutja(new Error('No s\'ha pogut llegir el fitxer.'));
    lector.onload = () => resol(lector.result);
    lector.readAsDataURL(fitxer);
  });
}

function bloqueInstalar() {
  /*
    A la còpia de mostra no s'hi pot instal·lar res —no porta service
    worker— però amagar-ho sense dir res feia pensar que l'opció no
    existeix. Val més explicar-ho, com es fa amb l'acta.
  */
  if (esAppEmpaquetada()) {
    return `
      <div class="section-title">${icon('download', 'icon icon-sm')} L'app al mòbil</div>
      <div class="note">
        ${icon('info', 'icon icon-sm')}
        <span>Aquí hi va el botó per instal·lar Voleimasters al mòbil. En
        aquesta còpia de mostra no funciona, perquè no porta el darrere que
        fa falta; a la web de debò s'instal·la des d'aquí i llavors va
        sense connexió i rep els avisos dels partits.</span>
      </div>`;
  }

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

/**
 * Quedar el dia i designar qui l'arbitra.
 *
 * Només ho veu qui pot fer-ho en aquest partit: el servidor ho diu amb
 * `pot_editar_dades` i `pot_assignar_arbitre`, que depenen dels dos
 * equips que hi juguen. Tenir la capacitat no vol dir tenir-la sobre
 * aquest partit.
 */
/** Queda la data fora de la finestra de la jornada? */
function avisDeJornada(p) {
  if (!p.data || !p.jornada) return null;
  if (p.jornada_inici && p.data < p.jornada_inici) {
    return `La jornada ${p.jornada} no comença fins al ${formatData(p.jornada_inici)}.`;
  }
  if (p.jornada_limit && p.data > p.jornada_limit) {
    return `La jornada ${p.jornada} s'havia de jugar abans del `
         + `${formatData(p.jornada_limit)}.`;
  }
  return null;
}

/**
 * La proposta que espera resposta.
 *
 * Qui l'ha de contestar hi té els dos botons; qui l'ha feta, només
 * l'espera. Sense això, el local proposava i no sabia si havia arribat.
 */
/**
 * «Podeu jugar el dia X?»
 *
 * Dues cares del mateix: qui organitza hi veu el recompte i qui hi juga,
 * els tres botons. Abans de proposar un dia a l'altre equip val més
 * saber si el teu hi és.
 */
function bloqueDisponibilitat(p, id) {
  const dades = Store.disponibilitat[id];
  if (!dades || !dades.equips.length) return '';

  App.accions.preguntarEquip = async boto => {
    const equipId = Number(boto.dataset.equip);
    const data = $('#o-data')?.value;
    if (!data) { toast('Posa primer quin dia vols preguntar'); return; }

    boto.disabled = true;
    try {
      await Store.preguntarDisponibilitat(id, equipId, {
        data, hora: $('#o-hora')?.value || null,
      });
      toast('Preguntat a l\'equip');
      pintar();
    } catch (e) { toast(e.message); boto.disabled = false; }
  };

  App.accions.responcDisponibilitat = async boto => {
    boto.disabled = true;
    try {
      await Store.respondreDisponibilitat(id, Number(boto.dataset.consulta),
        boto.dataset.resposta);
      toast('Contestat');
      pintar();
    } catch (e) { toast(e.message); boto.disabled = false; }
  };

  const blocs = dades.equips.map(eq => {
    const oberta = eq.consultes.find(c => c.oberta);
    if (!oberta) return '';

    const meva = oberta.respostes.find(r => r.persona_id === dades.persona_id);
    const jugo = dades.persona_id !== null
      && (meva !== undefined || oberta.pendents.some(x => x.persona_id === dades.persona_id));

    return `
      <div class="card card-pad" style="margin-bottom:12px">
        <div class="spread">
          <strong>Podeu jugar el ${esc(formatData(oberta.data))}${oberta.hora ? ' a les ' + esc(oberta.hora) : ''}?</strong>
        </div>
        ${oberta.nota ? `<p class="ajuda">${esc(oberta.nota)}</p>` : ''}

        ${jugo ? `
          <div class="proposta-botons" style="margin-top:12px">
            ${/*
                 Tots tres iguals fins que en tries un. El «Sí» sortia
                 ple de color abans de contestar i semblava ja triat.
               */
              [['si', 'Sí'], ['potser', 'Potser'], ['no', 'No']].map(([r, text]) => `
              <button class="btn ${meva?.resposta === r ? 'btn-primary' : 'btn-outline'} btn-petit"
                      data-accio="responcDisponibilitat" data-consulta="${oberta.id}"
                      data-resposta="${r}">${text}</button>`).join('')}
          </div>
          ${meva ? `<p class="ajuda" style="margin-top:8px">
            Has dit que ${meva.resposta === 'si' ? 'sí' : meva.resposta}.
          </p>` : ''}` : ''}

        ${eq.pot_preguntar ? `
          <div class="recompte" style="margin-top:12px">
            <span class="marca-si">${oberta.recompte.si} sí</span>
            <span class="marca-potser">${oberta.recompte.potser} potser</span>
            <span class="marca-no">${oberta.recompte.no} no</span>
            <span class="ajuda">${oberta.pendents.length} sense contestar</span>
          </div>
          ${oberta.respostes.length ? `
            <div class="card" style="margin-top:10px">
              ${oberta.respostes.map(r => `
                <div class="log-item">
                  ${esc(r.nom)}
                  <span class="log-time marca-${r.resposta}">
                    ${r.resposta === 'si' ? 'sí' : esc(r.resposta)}
                    ${r.comentari ? '· ' + esc(r.comentari) : ''}
                  </span>
                </div>`).join('')}
            </div>` : ''}` : ''}
      </div>`;
  }).filter(Boolean).join('');

  if (!blocs) return '';

  return `
    <div class="section-title">${icon('users', 'icon icon-sm')} Pot jugar l'equip?</div>
    ${blocs}`;
}

function bloquePropostaPendent(pendent, potContestar) {
  return `
    <div class="proposta ${potContestar ? 'proposta-teva' : ''}">
      <div class="proposta-cap">
        ${icon('calendar', 'icon icon-sm')}
        <strong>${esc(pendent.equip)} proposa</strong>
      </div>
      <p class="proposta-quan">
        ${esc(formatData(pendent.data))}${pendent.hora ? ' · ' + esc(pendent.hora) : ''}
        ${pendent.pista ? '<br>' + esc(pendent.pista) : ''}
      </p>
      ${potContestar ? `
        <div class="proposta-botons">
          <button class="btn btn-primary btn-petit" data-accio="acceptarData">
            ${icon('check', 'icon icon-sm')} Ens va bé
          </button>
          <button class="btn btn-outline btn-petit" data-accio="rebutjarData">
            No podem
          </button>
        </div>`
        : '<p class="ajuda">Esperant que l\'altre equip contesti.</p>'}
    </div>`;
}

/** De quin equip pots preguntar la disponibilitat, si és que pots. */
function equipQuePregunta(partitId) {
  const dades = Store.disponibilitat[partitId];
  return dades?.equips.find(e => e.pot_preguntar)?.equip_id ?? null;
}

/**
 * L'acta d'un partit jugat.
 *
 * La veu qualsevol, com el resultat: hi surt qui va jugar, els canvis i
 * els comentaris, res que no es pugui explicar. Abans només hi arribava
 * l'àrbitre des de la seva pantalla, i les actes dels partits vells no
 * les podia consultar ningú.
 */
function bloqueActa(p, id) {
  if (p.estat !== 'finalitzat') return '';

  const url = Store.actaUrl(id);
  if (!url) {
    return `
      <div class="note" style="margin-bottom:14px">
        ${icon('info', 'icon icon-sm')}
        <span>L'acta en PDF la genera el servidor, i aquesta còpia no en té.</span>
      </div>`;
  }

  return `
    <a class="btn btn-outline btn-block" href="${esc(url)}"
       target="_blank" rel="noopener" style="margin-bottom:14px">
      ${icon('news', 'icon icon-sm')} Acta del partit
    </a>`;
}

function bloqueOrganitzar(p, id) {
  if (!p.pot_editar_dades && !p.pot_assignar_arbitre) return '';

  const prop = Store.propostes[id] || {};
  const pendent = prop.pendent || null;
  const esDeLaLliga = Store.esCoordinacio();

  App.accions.desarDades = async boto => {
    const canvis = {
      data: $('#o-data').value || null,
      hora: $('#o-hora').value || null,
      pista: $('#o-pista').value.trim() || null,
    };

    const textOriginal = boto.textContent;
    boto.disabled = true;
    boto.textContent = 'Enviant…';
    try {
      const r = await Store.desarDadesPartit(id, canvis);
      toast(r.proposta ? 'Proposta enviada a l\'altre equip'
                       : (r.avis || 'Partit quedat'));
      pintar();
    } catch (e) {
      toast(e.message);
      boto.disabled = false;
      boto.textContent = textOriginal;
    }
  };

  App.accions.acceptarData = async boto => {
    boto.disabled = true;
    try {
      await Store.respondreProposta(id, pendent.id, 'accepta');
      toast('Partit quedat');
      pintar();
    } catch (e) { toast(e.message); boto.disabled = false; }
  };

  App.accions.rebutjarData = () => {
    const ov = $('#overlay');
    ov.innerHTML = `
      <div class="sheet">
        <h3>No us va bé?</h3>
        <p>L'altre equip ho veurà i en proposarà un altre dia.</p>
        <div class="field">
          <label for="r-motiu">Per què (opcional)</label>
          <input id="r-motiu" type="text" maxlength="255"
                 placeholder="Tenim mitja plantilla fora" />
        </div>
        <div class="sheet-actions">
          <button class="btn btn-outline" data-tanca="1">Cancel·lar</button>
          <button class="btn btn-danger" data-fer="1">Rebutjar</button>
        </div>
      </div>`;
    ov.hidden = false;
    ov.onclick = async e => {
      if (e.target === ov || e.target.dataset.tanca) {
        ov.hidden = true; ov.innerHTML = ''; return;
      }
      if (!e.target.dataset.fer) return;
      const motiu = $('#r-motiu').value.trim() || null;
      ov.hidden = true; ov.innerHTML = '';
      try {
        await Store.respondreProposta(id, pendent.id, 'rebutja', motiu);
        toast('Data rebutjada');
        pintar();
      } catch (err) { toast(err.message); }
    };
  };

  App.accions.triarArbitre = async () => {
    try {
      await Store.carregarArbitres();
    } catch (e) { toast(e.message); return; }

    const ov = $('#overlay');
    ov.innerHTML = `
      <div class="sheet">
        <h3>Qui arbitra</h3>
        <div class="card">
          ${Store.arbitres.map(a => `
            <button class="log-item" style="width:100%" data-arbitre="${a.id}">
              ${esc(a.nom)}
              <span class="log-time">${a.partits} partits</span>
            </button>`).join('')}
        </div>
        <div class="sheet-actions">
          <button class="btn btn-outline" data-tanca="1">Cancel·lar</button>
          ${p.arbitre ? '<button class="btn btn-ghost" data-arbitre="">Treure\'l</button>' : ''}
        </div>
      </div>`;
    ov.hidden = false;

    ov.onclick = async e => {
      if (e.target === ov || e.target.dataset.tanca) {
        ov.hidden = true; ov.innerHTML = ''; return;
      }
      const boto = e.target.closest('[data-arbitre]');
      if (!boto) return;
      ov.hidden = true; ov.innerHTML = '';
      try {
        const nou = boto.dataset.arbitre ? Number(boto.dataset.arbitre) : null;
        const partit = await Store.designarArbitre(id, nou);
        toast(partit.arbitre ? `Arbitra ${partit.arbitre.nom}` : 'Àrbitre tret');
        pintar();
      } catch (err) { toast(err.message); }
    };
  };

  /*
    L'avís de sortir de la finestra es donava només en desar, i un toast
    marxa. Si la data queda fora, val més que ho digui sempre que
    s'obri el partit.
  */
  const fora = avisDeJornada(p);

  return `
    <div class="section-title">${icon('clock', 'icon icon-sm')} Organitzar</div>
    <div class="card card-pad" style="margin-bottom:14px">
      ${fora ? `
        <div class="note note-avis" style="margin-bottom:12px">
          ${icon('alert', 'icon icon-sm')}<span>${esc(fora)}</span>
        </div>` : ''}
      ${pendent ? bloquePropostaPendent(pendent, prop.pot_contestar) : ''}

      ${p.pot_editar_dades ? `
        <div class="fila-camps">
          <div class="field">
            <label for="o-data">Dia</label>
            <input id="o-data" type="date" value="${esc(p.data || '')}" />
          </div>
          <div class="field">
            <label for="o-hora">Hora</label>
            <input id="o-hora" type="time" value="${esc(p.hora || '')}" />
          </div>
        </div>
        <div class="field">
          <label for="o-pista">Pista</label>
          <input id="o-pista" type="text" value="${esc(p.pista || '')}"
                 placeholder="On es juga" />
        </div>
        <button class="btn btn-primary btn-block" data-accio="desarDades">
          ${esDeLaLliga ? 'Desar'
            : (pendent && !prop.pot_contestar ? 'Proposar-ne un altre' : 'Proposar aquest dia')}
        </button>
        ${equipQuePregunta(id) ? `
          <button class="btn btn-outline btn-block" data-accio="preguntarEquip"
                  data-equip="${equipQuePregunta(id)}" style="margin-top:8px">
            ${icon('users', 'icon icon-sm')} Preguntar-ho al meu equip
          </button>` : ''}`
      : `<p class="ajuda">El dia i la pista els posa la coordinació dels equips.</p>`}

      ${p.pot_assignar_arbitre ? `
        <button class="btn btn-outline btn-block" data-accio="triarArbitre"
                style="margin-top:${p.pot_editar_dades ? '8px' : '12px'}">
          ${icon('whistle', 'icon icon-sm')}
          ${p.arbitre ? `Arbitra ${esc(p.arbitre.nom)}` : 'Designar àrbitre'}
        </button>` : ''}
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
