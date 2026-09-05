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

const NOM_POSICIO = {
  colocador: 'Col·locador/a',
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
    <button class="log-item" style="width:100%" data-anar="#/equip/${e.equip_id}">
      ${crest({ sigles: e.sigles, logo: e.logo, color: e.color })}
      <span class="fitxa-equip">
        <strong>${esc(e.equip)}</strong>
        <span class="ajuda">
          ${esc(e.categoria || '')}${e.tipus === 'jugador' ? '' : ' · ' + esc(NOM_TIPUS[e.tipus] || e.tipus)}
          ${e.es_capita ? ' · Capitana' : ''}
        </span>
      </span>
      ${e.dorsal !== null ? `<span class="conv-dorsal">${e.dorsal}</span>` : ''}
    </button>`).join('')
    : `<div class="card-pad"><p class="ajuda">
         ${propia ? 'Encara no ets a cap equip aquesta temporada.'
                  : 'No és a cap equip aquesta temporada.'}
       </p></div>`;

  return `
    <div class="page-head" style="text-align:center">
      ${retratGran(f)}
      <h2 class="page-title" style="margin-top:12px">${esc(f.nom)} ${esc(f.cognoms)}</h2>
      <p class="page-sub">
        ${f.posicio ? esc(NOM_POSICIO[f.posicio] || f.posicio) : 'Sense posició'}
        ${veuPrivat && f.edat !== null ? ` · ${f.edat} anys` : ''}
      </p>
      ${editable ? `
        <div class="fitxa-foto-accions">
          <button class="btn btn-outline btn-petit" data-accio="triarFoto">
            ${icon('camera', 'icon icon-sm')} ${f.foto ? 'Canviar la foto' : 'Posar una foto'}
          </button>
          ${f.foto ? `<button class="btn btn-ghost btn-petit" data-accio="treureFoto">Treure-la</button>` : ''}
        </div>` : ''}
    </div>

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
  if (f.foto) {
    return `<img class="retrat retrat-gran" src="${esc(f.foto)}"
                 alt="${esc(f.nom)} ${esc(f.cognoms)}" />`;
  }
  return `<div class="retrat retrat-gran retrat-buit">${esc(inicialsDe(f))}</div>`;
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

      <div class="fila-camps">
        <div class="field">
          <label for="f-posicio">Posició</label>
          <select id="f-posicio">
            <option value="">Sense posició</option>
            ${posicions.map(p => `
              <option value="${p}" ${f.posicio === p ? 'selected' : ''}>
                ${esc(NOM_POSICIO[p] || p)}
              </option>`).join('')}
          </select>
        </div>
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
        posicio: $('#f-posicio').value || null,
        genere: $('#f-genere').value,
      };
      const sobre = $('#f-sobre');
      if (sobre) canvis.sobre_mi = sobre.value.trim();

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
