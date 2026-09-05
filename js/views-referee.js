/* =========================================================
   ZONA ÀRBITRE
   Accés · llista de partits assignats · control del marcador
   =========================================================
   Cada botó escriu al servidor i repinta amb el marcador que
   respon. No s'avança res a la pantalla abans que el servidor
   ho confirmi: en un partit de veritat, ensenyar un punt que
   després no ha quedat registrat és pitjor que esperar dos
   dècimes.
   ========================================================= */

/* ---------- Llista de partits assignats ---------- */

async function carregarArbitre() {
  if (!Store.usuari) return;
  await Store.carregarMeusPartits();
}

function viewArbitre() {
  if (!Store.usuari) return viewLogin();

  renderNav('arbitre');

  /*
    La coordinació pot moure el marcador de qualsevol partit, però no en
    té cap d'assignat: aquí li sortia la pantalla buida i prou. Val més
    dir-li on és el que busca.
  */
  if (!Store.esArbitre() && Store.esCoordinacio()) {
    return `
      <div class="page-head">
        <span class="pill pill-yellow">Coordinació</span>
        <h2 class="page-title">Aquesta pantalla és dels àrbitres</h2>
        <p class="page-sub">Hi surten els partits que té assignats cadascú, i tu no en tens.</p>
      </div>
      <div class="card card-pad">
        <p class="ajuda" style="margin-bottom:14px">
          Pots arbitrar qualsevol partit igualment: obre'l des de Partits i
          hi trobaràs el marcador. Per configurar la lliga, ves a Lliga.
        </p>
        <button class="btn btn-primary btn-block" data-anar="#/partits">
          ${icon('calendar', 'icon icon-sm')} Veure els partits
        </button>
        <button class="btn btn-outline btn-block" data-anar="#/admin" style="margin-top:8px">
          ${icon('key', 'icon icon-sm')} Configuració de la lliga
        </button>
      </div>`;
  }

  const partits = Store.meusPartits;
  const directes = partits.filter(p => p.estat === 'directe');
  const propers = partits.filter(p => p.estat === 'programat');
  const fets = partits.filter(p => p.estat === 'finalitzat');

  const bloc = (titol, icona, llista, buit) => `
    <div class="section-title">${icon(icona, 'icon icon-sm')} ${titol}</div>
    <div class="stack">
      ${llista.length
        ? llista.map(p => filaPartit(p, `#/arbitre/partit/${p.id}`)).join('')
        : `<p class="empty">${buit}</p>`}
    </div>`;

  return `
    <div class="spread">
      <div>
        <span class="pill pill-yellow">Àrbitre</span>
        <h2 class="page-title" style="margin-top:8px">${esc(Store.usuari.nom)} ${esc(Store.usuari.cognoms || '')}</h2>
        <p class="page-sub">${partits.length} partits assignats</p>
      </div>
    </div>

    ${directes.length ? bloc('En curs', 'activity', directes, '') : ''}
    ${bloc('Per arbitrar', 'calendar', propers, 'No tens cap partit pendent.')}
    ${bloc('Arbitrats', 'checkCircle', fets, 'Encara no has arbitrat cap partit.')}

    <div class="note" style="margin-top:16px">
      ${icon('key', 'icon icon-sm')}
      <span>Si has d'arbitrar un partit que no és teu, entra-hi des de
      <strong>Partits</strong> i demana el codi al responsable de l'equip local.</span>
    </div>`;
}

/* ---------- Control del marcador ---------- */

async function carregarArbitrePartit(id) {
  await Promise.all([Store.carregarPartit(id), Store.carregarAccions(id)]);

  // Les convocables només fan falta a qui arbitra, i només si el partit
  // s'està jugant: a la resta seria una crida per a res.
  const p = Store.partit(id);
  if (p && p.estat === 'finalitzat') {
    try { await Store.carregarTancament(id); } catch (_) { /* l'acta pot esperar */ }
  }
  if (p && p.estat === 'directe' && Store.potArbitrar(p)) {
    try {
      await Store.carregarConvocables(id);
    } catch (_) {
      // Si falla, s'arbitra igual amb el marcador de tota la vida.
    }
  }
}

function viewArbitrePartit(id) {
  if (!Store.usuari) return viewLogin();

  const p = Store.partit(id);
  if (!p) return viewNoTrobat();

  renderTopbar({ titol: 'Control del partit', enrere: '#/arbitre', accions: false });
  renderTabbar(null);

  const marcadorActual = Store.marcadors[p.id];
  const formacio = marcadorActual?.formacio;

  /* Un set sense formació no es pot arbitrar amb rotació: primer es diu
     qui surt. Només se li demana a qui arbitra; la resta veu el
     marcador tal com sempre. */
  if (p.estat === 'directe' && Store.potArbitrar(p) && formacio?.cal_formacio) {
    renderTopbar({ titol: 'Control del partit', enrere: '#/arbitre', accions: false });
    renderTabbar(null);
    return viewFormacio(p, Store.convocables[p.id]);
  }

  /*
     A quin costat de la pantalla va cada equip. Els equips canvien de
     camp a cada set, i el marcador i els botons han de canviar amb ells:
     si l'àrbitre té l'equip local a la dreta però el botó de sumar-li
     punts és a l'esquerra, s'equivocarà tard o d'hora.
  */
  const localEsquerra = marcadorActual?.local_a_esquerra !== false;
  const bandes = localEsquerra ? ['local', 'visitant'] : ['visitant', 'local'];
  const equipDe = costat => costat === 'local' ? p.local : p.visitant;

  const sg = setsGuanyats(p);
  const enDirecte = p.estat === 'directe';
  const acabat = p.estat === 'finalitzat';
  const potArbitrar = Store.potArbitrar(p);
  const marcador = Store.marcadors[p.id];

  /* --- Accions --- */

  /** Executa una acció del marcador i repinta. Bloqueja els botons
      mentre dura, per no enviar dos punts amb un doble toc. */
  async function accio(fn, { vibracio = 12 } = {}) {
    if (App.ocupat) return;
    App.ocupat = true;
    document.querySelectorAll('.btn-point, .btn-minus').forEach(b => b.disabled = true);
    try {
      const m = await fn();
      vibrar(vibracio);
      return m;
    } catch (e) {
      toast(e.message);
      return null;
    } finally {
      App.ocupat = false;
      await pintar();
    }
  }

  App.accions = {
    iniciar() {
      confirmar({
        titol: 'Iniciar el partit?',
        text: 'El partit passarà a estar EN DIRECTE i el marcador es veurà a voleimasters.cat.',
        confirma: 'Iniciar',
        onOk: () => accio(async () => {
          await Store.iniciarPartit(p.id);
          /*
            Just després d'iniciar surt la pantalla de formació, i sense
            això sortia buida: les convocables només es demanaven en
            entrar al partit, quan encara estava programat i no calien.
            L'àrbitre veia «aquest equip no té cap jugadora fitxada» amb
            la plantilla plena, i només es resolia sortint i tornant a
            entrar.
          */
          await Store.carregarConvocables(p.id, true);
          toast('Partit iniciat · en directe a la web');
        }),
      });
    },

    mesLocal() { sumar('local'); },
    mesVisitant() { sumar('visitant'); },
    menysLocal() { restar('local'); },
    menysVisitant() { restar('visitant'); },

    desfer() {
      accio(async () => {
        await Store.desfer(p.id);
        toast('Última acció desfeta');
      });
    },

    canviar() {
      const conv = Store.convocables[p.id];
      const formacioAra = Store.marcadors[p.id]?.formacio;
      if (!conv || !formacioAra || formacioAra.cal_formacio) {
        toast('Primer cal confirmar la formació');
        return;
      }

      /* Es tria primer l'equip, després qui surt i qui entra. Amb dues
         llistes de vint noms en una sola pantalla no s'encerta res amb
         el mòbil a la mà. */
      const ov = $('#overlay');
      let costat = 'local';

      const pintarDialeg = () => {
        const equip = costat === 'local' ? p.local : p.visitant;
        const aPista = formacioAra[costat].jugadores.map(j => j.dorsal);
        const banqueta = (conv[costat]?.jugadores || [])
          .filter(j => j.dorsal !== null && !aPista.includes(j.dorsal));

        ov.innerHTML = `
          <div class="sheet">
            <h3>Canvi de jugadora</h3>
            <div class="tria-servei" style="margin-bottom:12px">
              ${['local', 'visitant'].map(c => `
                <button class="btn ${c === costat ? 'btn-primary' : 'btn-outline'}"
                        data-costat="${c}">
                  ${esc(c === 'local' ? p.local.sigles || p.local.nom
                                      : p.visitant.sigles || p.visitant.nom)}
                </button>`).join('')}
            </div>
            <div class="field">
              <label for="c-surt">Surt de pista</label>
              <select id="c-surt">
                ${aPista.map((d, i) => `<option value="${d}">P${i + 1} · #${d}</option>`).join('')}
              </select>
            </div>
            <div class="field">
              <label for="c-entra">Entra des de la banqueta</label>
              <select id="c-entra">
                ${banqueta.length
                  ? banqueta.map(j => `<option value="${j.dorsal}">#${j.dorsal} · ${esc(j.nom)}</option>`).join('')
                  : '<option value="">No queda ningú a la banqueta</option>'}
              </select>
            </div>
            <div class="sheet-actions">
              <button class="btn btn-outline" data-tanca="1">Cancel·lar</button>
              <button class="btn btn-primary" data-fer="1"
                      ${banqueta.length ? '' : 'disabled'}>Confirmar</button>
            </div>
          </div>`;
      };

      pintarDialeg();
      ov.hidden = false;

      ov.onclick = async e => {
        if (e.target === ov || e.target.dataset.tanca) {
          ov.hidden = true; ov.innerHTML = ''; return;
        }
        const bandaEl = e.target.closest('[data-costat]');
        if (bandaEl) { costat = bandaEl.dataset.costat; pintarDialeg(); return; }

        if (e.target.dataset.fer) {
          const surt = Number($('#c-surt').value);
          const entra = Number($('#c-entra').value);
          ov.hidden = true; ov.innerHTML = '';
          accio(async () => {
            await Store.canviarJugadora(p.id, costat, surt, entra);
            toast(`Entra #${entra} per #${surt}`);
          });
        }
      };
    },

    finalitzar() {
      confirmar({
        titol: 'Finalitzar el partit?',
        text: 'El resultat quedarà tancat i comptarà per a la classificació.',
        confirma: 'Finalitzar',
        perill: true,
        onOk: () => accio(async () => {
          await Store.finalitzarPartit(p.id);
          toast('Partit finalitzat');
        }),
      });
    },

    async demanarCodi() {
      const codi = prompt('Codi d\'àrbitre suplent (6 xifres):');
      if (!codi) return;
      try {
        await Store.bescanviarCodiArbitre(p.id, codi.trim());
        toast('Ja pots portar aquest marcador');
        await pintar();
      } catch (e) {
        toast(e.message);
      }
    },

    async generarCodi() {
      try {
        const d = await Store.generarCodiArbitre(p.id);
        confirmar({
          titol: 'Codi per a l\'àrbitre suplent',
          text: `${d.codi} — dona-l'hi a qui portarà el marcador. No es tornarà a mostrar.`,
          confirma: 'Entesos',
          onOk() {},
        });
      } catch (e) {
        toast(e.message);
      }
    },
  };

  async function sumar(costat) {
    const m = await accio(() => Store.sumarPunt(p.id, costat), { vibracio: 12 });
    if (!m) return;
    if (m.estat === 'finalitzat') toast('Partit finalitzat automàticament');
    else if (m.set_tancat) toast('Set tancat · comença el set ' + m.set_actual);
  }

  async function restar(costat) {
    await accio(() => Store.restarPunt(p.id, costat));
  }

  /* --- Contingut segons l'estat --- */

  /* Les dues pistes, amb la xarxa al mig. El local canvia de banda a
     cada set i el servidor diu a quina és, perquè el que es veu al
     mòbil coincideixi amb el que l'àrbitre té davant. */
  const zonaPista = (enDirecte && formacio && !formacio.cal_formacio) ? (() => {
    return `
      <div class="pistes">
        ${bandes.map((costat, i) => {
          const banda = i === 0 ? 'esquerra' : 'dreta';
          const equip = equipDe(costat);
          return `
            <div class="pista-panell">
              <div class="pista-cap">
                ${crest(equip)}
                <span class="pista-nom">${esc(equip.sigles || equip.nom)}</span>
                <span class="pista-punts">${p.punts[costat]}</span>
              </div>
              ${avisCompliment(formacio[costat].compliment)}
              ${pistaEquip(formacio[costat], banda, marcadorActual.serveix === costat)}
              ${potArbitrar ? `
                <div class="punts-pista">
                  <button class="btn-punt-pista"
                          data-accio="${costat === 'local' ? 'mesLocal' : 'mesVisitant'}">
                    ${icon('plus', 'icon icon-sm')} 1 punt
                  </button>
                  <button class="btn-menys-pista"
                          data-accio="${costat === 'local' ? 'menysLocal' : 'menysVisitant'}"
                          aria-label="Restar un punt">
                    ${icon('minus', 'icon icon-sm')}
                  </button>
                </div>` : ''}
            </div>`;
        }).join('')}
        <div class="xarxa" aria-hidden="true"></div>
      </div>`;
  })() : '';

  const controls = (enDirecte && potArbitrar) ? `
    ${zonaPista}
    <div class="point-controls">
      ${bandes.map(costat => columnaPunts(
        equipDe(costat),
        costat === 'local' ? 'Local' : 'Visitant',
        costat === 'local' ? 'mesLocal' : 'mesVisitant',
        costat === 'local' ? 'menysLocal' : 'menysVisitant',
      )).join('')}
    </div>

    <div class="ref-actions">
      <button class="btn btn-outline" data-accio="desfer" ${marcador?.pot_desfer === false ? 'disabled' : ''}>
        ${icon('undo', 'icon icon-sm')} Desfer
      </button>
      ${formacio && !formacio.cal_formacio ? `
        <button class="btn btn-outline" data-accio="canviar">
          ${icon('users', 'icon icon-sm')} Canvi
        </button>` : ''}
      <button class="btn btn-danger" data-accio="finalitzar">
        ${icon('stop', 'icon icon-sm')} Finalitzar
      </button>
    </div>` : '';

  const accioInici = (p.estat === 'programat' && potArbitrar) ? `
    <button class="btn btn-primary btn-block" data-accio="iniciar" style="margin-top:16px;height:58px">
      ${icon('play', 'icon')} Iniciar partit
    </button>
    <div class="note" style="margin-top:12px">
      ${icon('info', 'icon icon-sm')}
      <span>En prémer «Iniciar partit», la web mostrarà el partit com a <strong>EN DIRECTE</strong>
      i el marcador s'actualitzarà per a tothom.</span>
    </div>` : '';

  /* Qui no pot arbitrar aquest partit veu com demanar-ne el permís, o
     com donar-lo si és el responsable de l'equip local. */
  const zonaCodi = (!potArbitrar && !acabat) ? `
    <div class="card card-pad" style="margin-top:16px">
      ${icon('key', 'icon')}
      <h3 style="font-size:16px;font-weight:800;margin-top:8px">Aquest partit no és teu</h3>
      <p class="page-sub">Si el portes tu com a suplent, demana el codi de sis xifres
      al responsable de l'equip local i introdueix-lo aquí.</p>
      <button class="btn btn-primary btn-block" data-accio="demanarCodi" style="margin-top:14px">
        Tinc un codi
      </button>
      <button class="btn btn-ghost btn-block" data-accio="generarCodi" style="margin-top:6px">
        Sóc el responsable de l'equip local: generar codi
      </button>
    </div>` : '';

  const resum = acabat ? `
    <div class="note" style="margin-top:16px;border-style:solid">
      ${icon('checkCircle', 'icon icon-sm')}
      <span>Partit finalitzat amb resultat <strong>${sg.local}–${sg.visitant}</strong>.
      El resultat ja consta a la classificació.</span>
    </div>
    ${bloqueTancament(p)}` : '';

  const log = (Store.accions[p.id] || []).slice(0, 40);

  return `
    <div class="ref-header">
      <div class="spread">
        <div>
          <div style="font-size:12px;opacity:.85">
            ${esc(p.categoria.nom)}${p.jornada ? ` · Jornada ${p.jornada}` : ''}
          </div>
          ${p.pista ? `<div class="ref-meta">${icon('pin', 'icon icon-sm')} ${esc(p.pista)}</div>` : ''}
        </div>
        ${pillEstat(p)}
      </div>

      <div class="scoreboard">
        <div class="sb-team">
          ${crest(equipDe(bandes[0]), 'crest-lg crest-outline')}
          <div class="sb-name">${esc(equipDe(bandes[0]).nom)}</div>
          <div class="sb-points">${p.punts[bandes[0]]}</div>
        </div>
        <div class="sb-mid">
          <div class="sb-sets">${sg[bandes[0]]} – ${sg[bandes[1]]}</div>
          <div class="sb-setlabel">Sets</div>
          ${enDirecte ? `<div class="sb-setlabel" style="opacity:.7">Set ${numSetActual(p)} · a ${puntsObjectiu(p)}</div>` : ''}
          ${enDirecte && !localEsquerra ? `
            <div class="sb-canviat">${icon('right', 'icon icon-xs')} Camp canviat</div>` : ''}
        </div>
        <div class="sb-team">
          ${crest(equipDe(bandes[1]), 'crest-lg crest-outline')}
          <div class="sb-name">${esc(equipDe(bandes[1]).nom)}</div>
          <div class="sb-points">${p.punts[bandes[1]]}</div>
        </div>
      </div>

      ${tiraSets(p)}
    </div>

    ${accioInici}
    ${controls}
    ${zonaCodi}
    ${resum}

    ${log.length ? `
      <div class="section-title">${icon('history', 'icon icon-sm')} Historial</div>
      <div class="card">
        <div class="log">
          ${log.map(l => `
            <div class="log-item">
              <span class="log-badge">${badgeLog(l.tipus)}</span>
              <span>${esc(l.text || '')}</span>
              <span class="log-time">${esc(formatHora(l.creada_a))}</span>
            </div>`).join('')}
        </div>
      </div>` : ''}`;
}

/* =========================================================
   TANCAR EL PARTIT
   =========================================================
   Comentaris, la conformitat dels dos equips i l'acta. Surt
   quan el partit ja s'ha acabat.

   Al pavelló, la capitana ve a la taula i dona la conformitat
   al mòbil de l'àrbitre. Per això l'àrbitre pot recollir-la —
   però a l'acta consta que la va recollir ell, que no és el
   mateix que si signa des del seu propi compte.
   ========================================================= */

function bloqueTancament(p) {
  const comentaris = Store.comentaris[p.id] || [];
  const firmes = Store.firmes[p.id] || p.firmes || [];
  const potArbitrar = Store.potArbitrar(p);

  const haSignat = equipId => firmes.some(f => f.equip_id === equipId);
  const totSignat = haSignat(p.local.id) && haSignat(p.visitant.id);

  App.accions.comentar = async boto => {
    const text = $('#c-comentari').value.trim();
    if (!text) { toast('Escriu alguna cosa'); return; }

    boto.disabled = true;
    try {
      await Store.comentar(p.id, text);
      toast('Comentari afegit');
      pintar();
    } catch (e) {
      toast(e.message);
      boto.disabled = false;
    }
  };

  App.accions.conformitat = el => {
    const equipId = Number(el.dataset.equip);
    const nom = equipId === p.local.id ? p.local.nom : p.visitant.nom;

    confirmar({
      titol: `Conformitat de ${nom}?`,
      text: 'Un cop donada no es pot desfer. Assegura\'t que qui respon '
          + 'per l\'equip ha vist el resultat.',
      confirma: 'Donar conformitat',
      async onOk() {
        try {
          await Store.donarConformitat(p.id, equipId);
          toast(`${nom} hi està conforme`);
          pintar();
        } catch (e) {
          toast(e.message);
        }
      },
    });
  };

  const filaEquip = equip => {
    const firma = firmes.find(f => f.equip_id === equip.id);
    return `
      <div class="fila-conformitat">
        <div class="team-cell">
          ${crest(equip)}
          <span>${esc(equip.nom)}</span>
        </div>
        ${firma ? `
          <div class="conforme">
            ${icon('checkCircle', 'icon icon-sm')}
            <div>
              <strong>Conforme</strong>
              <div class="ajuda">
                ${esc(firma.autor || '')}${firma.recollida_arbitre ? " · recollida per l'àrbitre" : ''}
              </div>
            </div>
          </div>`
        : potArbitrar ? `
          <button class="btn btn-outline" data-accio="conformitat" data-equip="${equip.id}">
            Donar conformitat
          </button>`
        : '<span class="pill pill-soft">Pendent</span>'}
      </div>`;
  };

  return `
    <div class="section-title">${icon('checkCircle', 'icon icon-sm')} Conformitat dels equips</div>
    <div class="card card-pad">
      ${filaEquip(p.local)}
      ${filaEquip(p.visitant)}
      ${!totSignat ? `
        <p class="ajuda" style="margin-top:10px">
          Mentre en falti alguna, l'acta surt marcada com a no definitiva.
        </p>` : ''}
    </div>

    <div class="section-title">${icon('news', 'icon icon-sm')} Comentaris</div>
    <div class="card card-pad">
      ${comentaris.length ? comentaris.map(c => `
        <div class="comentari">
          <div class="comentari-cap">
            <strong>${esc(c.equip || 'Àrbitre')}</strong>
            ${c.autor ? `<span class="ajuda">${esc(c.autor)}</span>` : ''}
          </div>
          <p>${esc(c.text)}</p>
        </div>`).join('')
      : '<p class="ajuda">Cap comentari.</p>'}

      <div class="field" style="margin-top:12px">
        <label for="c-comentari">Afegir-ne un</label>
        <textarea id="c-comentari" rows="3"
                  placeholder="Incidències, retards, material…"></textarea>
      </div>
      <button class="btn btn-outline btn-block" data-accio="comentar">Afegir comentari</button>
    </div>

    ${(() => {
      const url = Store.actaUrl(p.id);
      if (!url) {
        return `
          <div class="note" style="margin-top:16px">
            ${icon('info', 'icon icon-sm')}
            <span>L'acta en PDF la genera el servidor, i aquesta còpia no en té.
            Amb la lliga en marxa es baixa des d'aquí amb tot el que hi ha a
            sobre: qui va jugar a cada set, els canvis, els comentaris i les
            conformitats.</span>
          </div>`;
      }
      return `
        <a class="btn btn-primary btn-block" href="${url}"
           style="margin-top:16px;height:52px" download>
          ${icon('download', 'icon icon-sm')} Descarregar l'acta (PDF)
        </a>
        ${!totSignat ? `
          <p class="ajuda" style="text-align:center;margin-top:8px">
            Es pot descarregar igualment; hi constarà que falta alguna conformitat.
          </p>` : ''}`;
    })()}`;
}


/* =========================================================
   FORMACIÓ D'UN SET
   =========================================================
   Surt en començar el partit i abans de cada set. Les sis es
   trien de la plantilla fitxada, en ordre de rotació: la
   primera és qui obre a la P1.
   ========================================================= */

/* Què s'ha triat, mentre no es desa. Es perd en canviar de pantalla,
   que és el que volem: la formació bona és la que hi ha al servidor. */
let formacioTriada = { local: [], visitant: [] };
let serveixTriat = null;

function viewFormacio(p, convocables) {
  const setNumero = numSetActual(p);
  const primerSet = setNumero === 1;

  App.accions = {
    triarJugadora(el) {
      const costat = el.dataset.costat;
      const dorsal = Number(el.dataset.dorsal);
      const triades = formacioTriada[costat];
      const on = triades.indexOf(dorsal);

      if (on >= 0) triades.splice(on, 1);
      else if (triades.length < 6) triades.push(dorsal);
      else { toast('Ja n\'hi ha sis. Treu-ne una abans.'); return; }

      pintar();
    },

    triarServei(el) { serveixTriat = el.dataset.serveix; pintar(); },

    async desarFormacio(boto) {
      for (const costat of ['local', 'visitant']) {
        if (formacioTriada[costat].length !== 6) {
          toast(`Falten jugadores a ${costat === 'local' ? p.local.nom : p.visitant.nom}`);
          return;
        }
      }
      if (primerSet && !serveixTriat) { toast('Digues qui saca primer'); return; }

      boto.disabled = true;
      boto.textContent = 'Desant…';
      try {
        const dades = {
          set_numero: setNumero,
          local: formacioTriada.local,
          visitant: formacioTriada.visitant,
        };
        if (serveixTriat) dades.serveix = serveixTriat;

        await Store.desarFormacio(p.id, dades);
        formacioTriada = { local: [], visitant: [] };
        serveixTriat = null;
        toast('Formació confirmada');
        await navegar();
      } catch (e) {
        toast(e.message);
        boto.disabled = false;
        boto.textContent = 'Confirmar formació';
      }
    },
  };

  const bloc = costat => {
    const equip = costat === 'local' ? p.local : p.visitant;
    const totes = (convocables?.[costat]?.jugadores || []).filter(j => j.dorsal !== null);
    const triades = formacioTriada[costat];

    return `
      <div class="card card-pad">
        <div class="spread">
          <div class="team-cell">
            ${crest(equip)}
            <strong>${esc(equip.nom)}</strong>
          </div>
          <span class="pill ${triades.length === 6 ? 'pill-primary' : 'pill-soft'}">
            ${triades.length}/6
          </span>
        </div>

        ${totes.length ? `
          <div class="graella-dorsals">
            ${totes.map(j => {
              const ordre = triades.indexOf(j.dorsal);
              return `
                <button class="tria-dorsal ${ordre >= 0 ? 'triat' : ''}"
                        data-accio="triarJugadora"
                        data-costat="${costat}" data-dorsal="${j.dorsal}">
                  ${ordre >= 0 ? `<span class="tria-dorsal-ordre">P${ordre + 1}</span>` : ''}
                  <span class="tria-dorsal-num">${j.dorsal}</span>
                  <span class="tria-dorsal-nom">${esc(j.nom)}</span>
                  ${j.es_capita ? '<span class="tria-dorsal-cap">C</span>' : ''}
                </button>`;
            }).join('')}
          </div>
          <p class="ajuda" style="margin-top:10px">
            Toca-les en l'ordre de rotació. La primera és qui obre a la P1.
          </p>`
          : `<p class="ajuda">Aquest equip encara no té cap jugadora fitxada amb dorsal.
             Fins que la coordinació no ompli la plantilla, aquest partit no es pot
             arbitrar amb formació.</p>`}
      </div>`;
  };

  return `
    <div class="page-head">
      <span class="pill pill-yellow">Set ${setNumero}</span>
      <h2 class="page-title">Formació</h2>
      <p class="page-sub">Qui surt a pista i en quin ordre roten.</p>
    </div>

    ${bloc('local')}
    ${bloc('visitant')}

    ${primerSet ? `
      <div class="card card-pad">
        <h3 class="titol-bloc">Qui saca primer?</h3>
        <div class="tria-servei">
          ${['local', 'visitant'].map(c => `
            <button class="btn ${serveixTriat === c ? 'btn-primary' : 'btn-outline'}"
                    data-accio="triarServei" data-serveix="${c}">
              ${esc(c === 'local' ? p.local.nom : p.visitant.nom)}
            </button>`).join('')}
        </div>
      </div>` : `
      <div class="note">
        ${icon('info', 'icon icon-sm')}
        <span>Els equips han canviat de camp. Comença sacant qui no ho va fer
        al set anterior.</span>
      </div>`}

    <button class="btn btn-primary btn-block" data-accio="desarFormacio"
            style="margin-top:16px;height:54px">
      Confirmar formació
    </button>`;
}


/* =========================================================
   LA PISTA
   =========================================================
   Les sis posicions com es veuen de veritat, amb la xarxa al
   mig de la pantalla. Així l'àrbitre no ha de traduir res: el
   que veu al mòbil és el que té davant.

   L'ordre que arriba del servidor és el de rotació: la primera
   és la P1, que és qui saca.
   ========================================================= */

/* Quina casella de la graella ocupa cada posició, segons la banda.
   La P1 (qui saca) és sempre al fons a la dreta de la seva pista. */
const CASELLES_PISTA = {
  esquerra: [5, 6, 1, 4, 3, 2],   // primera columna lluny de la xarxa
  dreta:    [2, 3, 4, 1, 6, 5],   // la xarxa queda a l'esquerra del panell
};

function pistaEquip(dades, banda, serveix) {
  const jugadores = dades.jugadores || [];
  if (!jugadores.length) return '<div class="pista-buida">Sense formació</div>';

  const caselles = CASELLES_PISTA[banda].map(posicio => {
    // La posició P1 és jugadores[0], la P2 jugadores[1]…
    const j = jugadores[posicio - 1];
    if (!j) return '<div class="pista-casella"></div>';

    const sacant = serveix && posicio === 1;
    const marques = [
      j.genere === 'dona' ? '♀' : '',
      j.menor_30 === true ? '<30' : '',
    ].filter(Boolean).join(' ');

    return `
      <div class="pista-casella ${sacant ? 'saca' : ''}">
        <span class="pista-pos">P${posicio}</span>
        <span class="pista-dorsal">${j.dorsal}</span>
        ${marques ? `<span class="pista-marques">${marques}</span>` : ''}
        ${sacant ? '<span class="pista-pilota">🏐</span>' : ''}
      </div>`;
  }).join('');

  return `<div class="pista">${caselles}</div>`;
}

/**
 * Avís de la regla de categories. Només informa: qui decideix és
 * l'àrbitre, que és qui té les fitxes a la taula.
 */
function avisCompliment(compliment) {
  if (!compliment || !compliment.aplica) return '';

  const trossos = [];
  if (compliment.max_menors_30 !== null) {
    trossos.push(`&lt;30: ${compliment.menors_30}/${compliment.max_menors_30}`);
  }
  if (compliment.min_dones !== null) {
    trossos.push(`Dones: ${compliment.dones}/${compliment.min_dones}`);
  }
  if (compliment.sense_dades) {
    trossos.push(`${compliment.sense_dades} sense data de naixement`);
  }

  return `
    <div class="compliment ${compliment.compleix ? 'ok' : 'malament'}">
      ${trossos.join(' · ')}
    </div>`;
}

function columnaPunts(equip, etiqueta, accioMes, accioMenys) {
  return `
    <div class="point-col">
      <div class="point-col-name">${esc(etiqueta)}</div>
      <button class="btn-point" data-accio="${accioMes}">
        ${icon('plus')} ${esc(equip.sigles || '')}
      </button>
      <button class="btn-minus" data-accio="${accioMenys}">
        ${icon('minus', 'icon icon-sm')} Restar punt
      </button>
    </div>`;
}

function badgeLog(tipus) {
  return {
    punt: '+1', correccio: '−1', set: 'S',
    inici: '▶', final: '■', comentari: '💬',
  }[tipus] || '·';
}

function vibrar(ms) {
  if (navigator.vibrate) navigator.vibrate(ms);
}
