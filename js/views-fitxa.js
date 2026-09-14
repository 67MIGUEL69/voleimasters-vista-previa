/* =========================================================
   LA FITXA DE CADASCÚ
   =========================================================
   Fins ara, entrar com a jugador no servia de res: es veia
   la lliga i prou. La fitxa és el que fa que un compte de
   jugador tingui sentit — la foto, l'edat, com el poden
   trobar— i la manté ell mateix, no la coordinació.

   Dues pantalles amb el mateix darrere:
     · #/jo            la meva, amb els camps oberts
     · #/persona/{id}  la d'algú altre, de només mirar
                       (i editable per a la coordinació)

   Què és públic i què no ho decideix el servidor: aquí, si
   una dada privada no arriba, senzillament no es pinta.
   ========================================================= */

/*
  Els comptes d'abans no tenien DNI, telèfon ni data de naixement: ara es
  demanen en registrar-se, però qui ja hi era es va quedar sense. Sense
  aquests tres l'equip no el pot fitxar i la regla de pista no sap si té
  menys de 30 anys, així que val més dir-ho a la seva fitxa que descobrir-ho
  el dia del partit.
*/
const CAMPS_DE_LA_FITXA = {
  dni: 'el DNI',
  telefon: 'el telèfon',
  data_naixement: 'la data de naixement',
};

function avisFitxaIncompleta(f, propia) {
  if (!propia || !('dni' in f)) return '';

  const falten = Object.keys(CAMPS_DE_LA_FITXA)
    .filter(camp => !f[camp])
    .map(camp => CAMPS_DE_LA_FITXA[camp]);
  if (!falten.length) return '';

  const llista = falten.length === 1
    ? falten[0]
    : falten.slice(0, -1).join(', ') + ' i ' + falten[falten.length - 1];

  return `
    <div class="note note-avis" style="margin-top:14px">
      ${icon('alert', 'icon icon-sm')}
      <span>A la teva fitxa hi falta ${esc(llista)}. Sense això no et poden
      fitxar a cap equip. Ho pots omplir aquí sota, a «Les meves dades».</span>
    </div>`;
}

/** «Central i líbero», o «Sense posició» si no n'hi ha cap. */
function nomsPosicions(llista) {
  const noms = (llista || []).map(p => NOM_POSICIO[p] || p);
  if (!noms.length) return 'Sense posició';
  if (noms.length === 1) return esc(noms[0]);
  return esc(noms.slice(0, -1).join(', ') + ' i ' + noms[noms.length - 1]);
}

const NOM_POSICIO = {
  colocador: 'Col·locador/a',
  punta: 'Punta',
  oposat: 'Oposat/ada',
  central: 'Central',
  receptor: 'Receptor/a',
  libero: 'Líbero',
};

async function carregarLaMevaFitxa() {
  await Store.carregarLaMevaFitxa();
}

async function carregarFitxaPersona(id) {
  await Store.carregarFitxaPersona(id);
}

function viewLaMevaFitxa() {
  if (!Store.usuari) return viewLogin();

  const d = Store.laMevaFitxa;
  if (!d) return viewNoTrobat();

  renderTopbar({ titol: 'La meva fitxa', enrere: '#/perfil', accions: false });
  renderTabbar(null);

  /*
    Un compte pot no tenir fitxa: l'administració no juga, i a algú
    acabat de registrar encara no l'han fitxat enlloc. Dir-ho és millor
    que ensenyar un formulari buit que no desa res.
  */
  if (!d.fitxa) {
    return `
      <div class="page-head">
        <h2 class="page-title">Encara no tens fitxa</h2>
      </div>
      <div class="card card-pad">
        <p class="ajuda">
          La fitxa la crea qui et dona d'alta a un equip: la coordinació del
          club o l'entrenador. Quan et fitxin, aquí hi podràs posar la foto i
          les teves dades.
        </p>
      </div>`;
  }

  return pintarFitxa(d, { propia: true });
}

function viewFitxaPersona(id) {
  const d = Store.fitxes[id];
  if (!d) return viewNoTrobat();

  /*
    Sense fletxa enrere, qui hi arriba des d'un enllaç es queda encallat:
    la barra ensenya la marca i prou. Es torna al seu equip, que és d'on
    ve gairebé sempre; si no en té, a la llista d'equips.
  */
  const tornarA = d.fitxa.equips.length
    ? `#/equip/${d.fitxa.equips[0].equip_id}/plantilla`
    : '#/equips';
  renderTopbar({ titol: 'Fitxa', enrere: tornarA, accions: false });
  renderTabbar(null);

  return pintarFitxa(d, { propia: false });
}

/* ---------- La pantalla ---------- */

function pintarFitxa(d, { propia }) {
  const f = d.fitxa;
  const editable = d.pot_editar;
  // Les dades privades només arriben a qui les pot veure. Si no hi són,
  // no és que estiguin buides: és que no són seves.
  const veuPrivat = 'dni' in f;

  App.accions = editable ? accionsFitxa(f, d.posicions || []) : {};

  const equips = f.equips.length ? f.equips.map(e => `
    <div class="fila-equip">
      <button class="fila-equip-nom" data-anar="#/equip/${e.equip_id}">
        ${crest({ sigles: e.sigles, logo: e.logo, color: e.color, color_2: e.color_2 })}
        <span class="fitxa-equip">
          <strong>${esc(e.equip)}</strong>
          <span class="ajuda">
            ${esc(e.categoria || '')}${e.tipus === 'jugador' ? '' : ' · ' + esc(NOM_TIPUS[e.tipus] || e.tipus)}
            ${e.es_capita ? ' · Capitana' : ''}
          </span>
        </span>
      </button>
      ${e.tipus === 'jugador' && editable ? `
        <button class="conv-dorsal conv-dorsal-boto" data-accio="canviarDorsal"
                data-fitxa="${e.fitxa_id}" data-dorsal="${e.dorsal ?? ''}"
                aria-label="Canviar el dorsal">${e.dorsal ?? '+'}</button>`
        : (e.dorsal !== null ? `<span class="conv-dorsal">${e.dorsal}</span>` : '')}
    </div>`).join('')
    : `<div class="card-pad"><p class="ajuda">
         ${propia ? 'Encara no ets a cap equip aquesta temporada.'
                  : 'No és a cap equip aquesta temporada.'}
       </p></div>`;

  return `
    <div class="page-head" style="text-align:center">
      ${retratGran(f)}
      <h2 class="page-title" style="margin-top:12px">${esc(f.nom)} ${esc(f.cognoms)}</h2>
      <p class="page-sub">
        ${nomsPosicions(f.posicions)}
        ${veuPrivat && f.edat !== null ? ` · ${f.edat} anys` : ''}
        ${f.alcada ? ` · ${f.alcada} cm` : ''}
        ${f.pes ? ` · ${f.pes} kg` : ''}
      </p>
      ${editable ? `
        <div class="fitxa-foto-accions">
          <button class="btn btn-outline btn-petit" data-accio="triarFoto">
            ${icon('camera', 'icon icon-sm')} ${f.foto ? 'Canviar la foto' : 'Posar una foto'}
          </button>
          ${f.foto ? `<button class="btn btn-ghost btn-petit" data-accio="treureFoto">Treure-la</button>` : ''}
        </div>` : ''}
    </div>

    ${avisFitxaIncompleta(f, propia && editable)}

    ${f.sobre_mi || editable ? `
      <div class="section-title">${icon('info', 'icon icon-sm')} Sobre mi</div>
      <div class="card card-pad">
        ${editable ? `
          <div class="field">
            <textarea id="f-sobre" rows="3" maxlength="280"
              placeholder="Dues línies teves. Ho veu tothom.">${esc(f.sobre_mi || '')}</textarea>
          </div>` : `<p style="font-size:14px;margin:0">${esc(f.sobre_mi)}</p>`}
      </div>` : ''}

    <div class="section-title">${icon('shield', 'icon icon-sm')} Equips</div>
    <div class="card">${equips}</div>
    ${propia && f.equips.some(e => e.tipus === 'jugador') ? `
      <p class="nota-petita">Toca el dorsal per canviar-lo.</p>` : ''}

    ${editable ? bloqueEditarFitxa(f, d.posicions || [], veuPrivat) : ''}

    ${!editable && veuPrivat ? `
      <div class="section-title">${icon('user', 'icon icon-sm')} Dades</div>
      <div class="card">
        ${filaDada('Telèfon', f.telefon)}
        ${filaDada('Correu', f.email)}
        ${filaDada('DNI', f.dni)}
      </div>` : ''}`;
}

function filaDada(etiqueta, valor) {
  if (!valor) return '';
  return `<div class="log-item">${esc(etiqueta)}<span class="log-time">${esc(valor)}</span></div>`;
}

function retratGran(f) {
  return retrat(f, 'retrat-gran');
}

/** El mateix, petit: a les llistes on surt gent. */
function retratPetit(f) {
  return retrat(f, 'retrat-petit');
}

function retrat(f, mida) {
  if (f.foto) {
    return `<img class="retrat ${mida}" src="${esc(Store.ruta(f.foto))}"
                 alt="${esc(f.nom)} ${esc(f.cognoms)}" />`;
  }
  return `<div class="retrat ${mida} retrat-buit">${esc(inicialsDe(f))}</div>`;
}

function inicialsDe(f) {
  return ((f.nom || '')[0] || '') + ((f.cognoms || '')[0] || '');
}

/* ---------- El formulari ---------- */

function bloqueEditarFitxa(f, posicions, veuPrivat) {
  return `
    <div class="section-title">${icon('list', 'icon icon-sm')} Les meves dades</div>
    <div class="card card-pad">
      <div class="fila-camps">
        <div class="field">
          <label for="f-nom">Nom</label>
          <input id="f-nom" type="text" value="${esc(f.nom)}" />
        </div>
        <div class="field">
          <label for="f-cognoms">Cognoms</label>
          <input id="f-cognoms" type="text" value="${esc(f.cognoms)}" />
        </div>
      </div>

      <div class="field">
        <label>Posicions</label>
        <div class="tria-posicions">
          ${posicions.map(p => `
            <label class="casella">
              <input type="checkbox" name="f-posicio" value="${p}"
                     ${(f.posicions || []).includes(p) ? 'checked' : ''} />
              <span>${esc(NOM_POSICIO[p] || p)}</span>
            </label>`).join('')}
        </div>
        <p class="nota-petita">Marca'n totes les que facis. Si no en marques cap,
        la fitxa dirà «sense posició».</p>
      </div>

      <div class="fila-camps">
        <div class="field">
          <label for="f-genere">Gènere</label>
          <select id="f-genere">
            ${['no_consta', 'dona', 'home', 'altre'].map(g => `
              <option value="${g}" ${f.genere === g ? 'selected' : ''}>
                ${esc({ no_consta: 'No consta', dona: 'Dona', home: 'Home', altre: 'Altre' }[g])}
              </option>`).join('')}
          </select>
        </div>
      </div>

      <div class="fila-camps">
        <div class="field">
          <label for="f-alcada">Alçada (cm)</label>
          <input id="f-alcada" type="number" min="120" max="250"
                 value="${esc(f.alcada ?? '')}" />
        </div>
        <div class="field">
          <label for="f-pes">Pes (kg)</label>
          <input id="f-pes" type="number" min="30" max="200"
                 value="${esc(f.pes ?? '')}" />
        </div>
      </div>

      ${veuPrivat ? `
        <div class="fila-camps">
          <div class="field">
            <label for="f-naixement">Data de naixement</label>
            <input id="f-naixement" type="date" value="${esc(f.data_naixement || '')}" />
          </div>
          <div class="field">
            <label for="f-dni">DNI</label>
            <input id="f-dni" type="text" autocapitalize="characters"
                   value="${esc(f.dni || '')}" />
          </div>
        </div>

        <div class="fila-camps">
          <div class="field">
            <label for="f-telefon">Telèfon</label>
            <input id="f-telefon" type="tel" value="${esc(f.telefon || '')}" />
          </div>
          <div class="field">
            <label for="f-email">Correu</label>
            <input id="f-email" type="email" value="${esc(f.email || '')}" />
          </div>
        </div>` : ''}

      <p class="ajuda" style="margin-bottom:10px">
        El nom, la foto, la posició i el text de «Sobre mi» els veu tothom.
        La data de naixement, el DNI, el telèfon i el correu, només tu, la
        gent del teu equip i la coordinació.
      </p>
      <button class="btn btn-primary btn-block" data-accio="desarFitxa">Desar</button>
    </div>`;
}

function accionsFitxa(f, posicions) {
  return {
    async desarFitxa(boto) {
      const canvis = {
        nom: $('#f-nom').value.trim(),
        cognoms: $('#f-cognoms').value.trim(),
        posicions: [...document.querySelectorAll('input[name="f-posicio"]:checked')]
          .map(c => c.value),
        genere: $('#f-genere').value,
      };
      const sobre = $('#f-sobre');
      if (sobre) canvis.sobre_mi = sobre.value.trim();

      // Buit vol dir «no ho dic», no zero.
      canvis.alcada = $('#f-alcada').value === '' ? null : Number($('#f-alcada').value);
      canvis.pes = $('#f-pes').value === '' ? null : Number($('#f-pes').value);

      // Els camps privats només hi són si els pot veure: enviar-los
      // buits li esborraria el telèfon a algú altre.
      if ($('#f-naixement')) {
        canvis.data_naixement = $('#f-naixement').value || null;
        canvis.dni = $('#f-dni').value.trim();
        canvis.telefon = $('#f-telefon').value.trim();
        canvis.email = $('#f-email').value.trim();
      }

      boto.disabled = true;
      boto.textContent = 'Desant…';
      try {
        await Store.desarFitxaPersona(f.id, canvis);
        toast('Fitxa desada');
        pintar();
      } catch (e) {
        toast(e.message);
        boto.disabled = false;
        boto.textContent = 'Desar';
      }
    },

    canviarDorsal(el) {
      const fitxaId = Number(el.dataset.fitxa);
      const ov = $('#overlay');
      ov.innerHTML = `
        <div class="sheet">
          <h3>El teu dorsal</h3>
          <div class="field">
            <label for="d-meu">Número</label>
            <input id="d-meu" type="number" min="0" max="199"
                   value="${esc(el.dataset.dorsal || '')}" />
          </div>
          <p class="ajuda">Si ja el porta una companya, t'ho dirà.</p>
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
        const valor = $('#d-meu').value.trim();
        ov.hidden = true; ov.innerHTML = '';
        try {
          await Store.canviarElMeuDorsal(f.id, fitxaId,
            valor === '' ? null : Number(valor));
          toast('Dorsal canviat');
          pintar();
        } catch (e) { toast(e.message); }
      };
    },

    triarFoto() {
      const camp = document.createElement('input');
      camp.type = 'file';
      camp.accept = 'image/*';
      camp.onchange = async () => {
        const fitxer = camp.files?.[0];
        if (!fitxer) return;
        toast('Preparant la foto…');
        try {
          await Store.desarFoto(f.id, await reduirImatge(fitxer));
          toast('Foto canviada');
          pintar();
        } catch (e) {
          toast(e.message);
        }
      };
      camp.click();
    },

    treureFoto() {
      confirmar({
        titol: 'Treure la foto?',
        text: 'La fitxa tornarà a ensenyar les inicials.',
        confirma: 'Treure-la',
        perill: true,
        async onOk() {
          try {
            await Store.esborrarFoto(f.id);
            toast('Foto treta');
            pintar();
          } catch (e) { toast(e.message); }
        },
      });
    },
  };
}

/**
 * Redueix la foto abans d'enviar-la.
 *
 * Una foto de mòbil són tres o quatre megues, i pujar-les des del
 * pavelló amb la cobertura justa no és pla. Es retalla quadrada i es
 * baixa a 512 px, que és més del que la fitxa ensenya mai: queda en
 * menys de 100 KB i el servidor no ha de saber tocar imatges (a un
 * allotjament compartit no es pot donar per fet que hi hagi GD).
 */
function reduirImatge(fitxer, costat = 512) {
  return new Promise((resol, rebutja) => {
    const lector = new FileReader();
    lector.onerror = () => rebutja(new Error('No s\'ha pogut llegir la foto.'));
    lector.onload = () => {
      const img = new Image();
      img.onerror = () => rebutja(new Error('Això no sembla una foto.'));
      img.onload = () => {
        // Quadrada i pel mig: una cara centrada és el que s'espera d'un
        // retrat, i evita haver de decidir com encabir cada proporció.
        const costatOriginal = Math.min(img.width, img.height);
        const x = (img.width - costatOriginal) / 2;
        const y = (img.height - costatOriginal) / 2;
        const mida = Math.min(costat, costatOriginal);

        const llenc = document.createElement('canvas');
        llenc.width = llenc.height = mida;
        const ctx = llenc.getContext('2d');
        ctx.drawImage(img, x, y, costatOriginal, costatOriginal, 0, 0, mida, mida);
        resol(llenc.toDataURL('image/jpeg', 0.82));
      };
      img.src = lector.result;
    };
    lector.readAsDataURL(fitxer);
  });
}
