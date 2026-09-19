/* =========================================================
   ARBITRAR SENSE CONNEXIÓ
   =========================================================
   Als pavellons la cobertura va i ve, i un partit no es pot
   aturar perquè el mòbil de l'àrbitre s'ha quedat sense xarxa.

   Cada acció del marcador (punt, restar, formació, canvi,
   iniciar, finalitzar) passa per aquesta cua:

   1. Es comprova i s'aplica AL MÒBIL amb les mateixes regles
      que el servidor, i la pantalla es mou a l'instant.
   2. Es desa al telèfon (localStorage) amb un identificador
      propi, perquè sobrevisqui a tancar l'app.
   3. S'envia al servidor per ordre. Si no hi ha xarxa, es
      torna a provar sola cada pocs segons i en recuperar-la.

   Qui mana continua sent el servidor: el que respon substitueix
   el que s'havia calculat aquí. L'identificador fa que una
   acció que va arribar però de la qual no va tornar la resposta
   no es compti dues vegades en reenviar-la.
   ========================================================= */

const CuaArbitre = {
  PREFIX: 'volei-arbitratge-',
  SEGONS_REINTENT: 5,
  /* Una acció que triga més que això a confirmar-se ja es diu per pantalla. */
  SEGONS_AVIS: 3,

  enviaments: new Map(),   // partitId → promesa de l'enviament en curs
  enVol: new Map(),        // partitId → id de l'acció que ha sortit
  senseXarxa: new Set(),   // partits amb l'últim intent fallat per xarxa

  /** Es crida quan el marcador canvia de fons, per repintar. */
  enCanviar: null,

  /* ---------- Què hi ha desat al telèfon ---------- */

  llegir(id) {
    try {
      const text = localStorage.getItem(this.PREFIX + id);
      return text ? JSON.parse(text) : null;
    } catch (_) {
      return null;
    }
  },

  desar(id, dades) {
    dades.desat_a = Date.now();
    try {
      localStorage.setItem(this.PREFIX + id, JSON.stringify(dades));
    } catch (_) {
      // Sense espai o amb l'emmagatzematge bloquejat, la cua viu només en
      // memòria: es perdria tancant l'app, però l'arbitratge segueix.
    }
    this.memoria[id] = dades;
  },

  /* Còpia en memòria per si localStorage no funciona. */
  memoria: {},

  /*
    Només el que va desar qui té la sessió oberta: en un mòbil compartit,
    el partit que arbitrava un altre no és cosa teva.
  */
  dades(id) {
    const d = this.llegir(id) || this.memoria[id] || null;
    if (!d || !Store.usuari || d.usuari_id !== Store.usuari.id) return null;
    return d;
  },

  /** Per obrir l'app sense xarxa: aquest usuari té res a mig enviar? */
  hiHaPendentsDe(usuariId) {
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const clau = localStorage.key(i);
        if (!clau.startsWith(this.PREFIX)) continue;
        const d = JSON.parse(localStorage.getItem(clau) || 'null');
        if (d?.usuari_id === usuariId && d.pendents?.length) return true;
      }
    } catch (_) { /* sense emmagatzematge */ }
    return false;
  },

  /**
   * Es guarda el partit tal com ha arribat del servidor quan l'àrbitre
   * l'obre. És el que permet tornar-lo a obrir sense xarxa.
   *
   * Si hi ha accions per enviar, el marcador oficial no es toca: el que
   * arriba pot portar ja alguna de les que han sortit sense resposta, i
   * sumar-les a sobre les comptaria dues vegades a la pantalla.
   */
  recordarPartit(partit, marcador, convocables) {
    const id = partit.id;
    const dades = this.dades(id) || { pendents: [], usuari_id: Store.usuari?.id };
    dades.partit = partit;
    if (convocables) dades.convocables = convocables;
    if (marcador && !dades.pendents.length) dades.base = marcador;
    this.desar(id, dades);
  },

  pendents(id) {
    return this.dades(id)?.pendents?.length || 0;
  },

  /** Hi ha res que el servidor encara no sàpiga, i fa estona que espera? */
  estat(id) {
    const d = this.dades(id);
    const n = d?.pendents?.length || 0;
    if (!n) return { pendents: 0, avisar: false };
    const mesVella = d.pendents[0].creada_a || Date.now();
    return {
      pendents: n,
      avisar: this.senseXarxa.has(Number(id))
        || Date.now() - mesVella > this.SEGONS_AVIS * 1000,
    };
  },

  partitsAmbPendents() {
    const ids = [];
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const clau = localStorage.key(i);
        if (!clau.startsWith(this.PREFIX)) continue;
        const id = Number(clau.slice(this.PREFIX.length));
        if (this.pendents(id)) ids.push(id);
      }
    } catch (_) { /* sense emmagatzematge */ }
    for (const id of Object.keys(this.memoria)) {
      if (this.pendents(id) && !ids.includes(Number(id))) ids.push(Number(id));
    }
    return ids;
  },

  /*
    El que no té res per enviar i fa més d'un dia que no es toca, fora:
    porta noms de jugadores i no hi ha cap motiu per guardar-ho.
  */
  netejar({ tot = false } = {}) {
    try {
      const claus = [];
      for (let i = 0; i < localStorage.length; i++) {
        const clau = localStorage.key(i);
        if (clau.startsWith(this.PREFIX)) claus.push(clau);
      }
      for (const clau of claus) {
        const d = JSON.parse(localStorage.getItem(clau) || 'null');
        if (d?.pendents?.length) continue;
        if (tot || !d || Date.now() - (d.desat_a || 0) > 24 * 3600 * 1000) {
          localStorage.removeItem(clau);
          delete this.memoria[clau.slice(this.PREFIX.length)];
        }
      }
    } catch (_) { /* sense emmagatzematge */ }
  },

  /* ---------- El marcador que es veu ---------- */

  /**
   * El marcador oficial amb les accions pendents aplicades a sobre.
   * Les que ara no quadren (per exemple, una formació d'un set que s'ha
   * desfet) no es pinten, però no es llencen: qui decideix és el servidor.
   */
  provisional(id) {
    const d = this.dades(id);
    if (!d?.base) return null;
    let m = d.base;
    for (const a of d.pendents) {
      try {
        m = MotorMarcador.aplicar(m, a.accio, a.cos, this.context(d));
      } catch (_) { /* no es pinta */ }
    }
    return m;
  },

  context(d) {
    return { regles: Store.regles || {}, convocables: d.convocables || null };
  },

  /* ---------- Fer una acció ---------- */

  /**
   * Comprova l'acció, la posa a la cua i la pinta. No espera el servidor:
   * si ho fes, sense cobertura l'àrbitre es quedaria amb els botons
   * bloquejats fins que es rendís la connexió.
   */
  fer(id, accio, cos = {}) {
    id = Number(id);
    const d = this.dades(id);
    const partit = Store.partit(id) || d?.partit;
    if (!d?.base || !partit || !Store.potArbitrar(partit)) {
      // No hi ha res desat d'aquest partit, o no és teu: sense punt de
      // partida no es pot calcular res, i s'envia com sempre.
      return this.directe(id, accio, cos);
    }

    const ara = this.provisional(id);
    // Si no quadra, es diu ara, igual que ho diria el servidor.
    const resultat = MotorMarcador.aplicar(ara, accio, cos, this.context(d));

    d.pendents.push({ id: nouIdAccio(), accio, cos, creada_a: Date.now() });
    this.desar(id, d);
    Store.aplicarMarcador(id, this.provisional(id));

    this.enviar(id);
    return resultat;
  },

  /** Sense cua: per als partits que no s'han obert des de la pantalla d'arbitrar. */
  async directe(id, accio, cos) {
    const r = await Api.post(`/partits/${id}/${accio}`, cos);
    Store.aplicarMarcador(id, r.marcador);
    const d = this.dades(id);
    if (d && !d.pendents.length) { d.base = r.marcador; this.desar(id, d); }
    return r.marcador;
  },

  /** L'últim intent d'enviar ha fallat per la xarxa? */
  teXarxa(id) {
    return !this.senseXarxa.has(Number(id));
  },

  /**
   * Treu l'última acció que encara no ha sortit. Retorna false si no n'hi
   * ha cap o si l'única que queda ja és camí del servidor.
   */
  treureUltima(id) {
    id = Number(id);
    const d = this.dades(id);
    const ultima = d?.pendents?.[d.pendents.length - 1];
    if (!ultima || this.enVol.get(id) === ultima.id) return false;
    d.pendents.pop();
    this.desar(id, d);
    Store.aplicarMarcador(id, this.provisional(id));
    return true;
  },

  /* ---------- Enviar ---------- */

  enviar(id) {
    id = Number(id);
    if (this.enviaments.has(id)) return this.enviaments.get(id);
    const promesa = this._enviar(id).finally(() => {
      this.enviaments.delete(id);
      this.enVol.delete(id);
    });
    this.enviaments.set(id, promesa);
    return promesa;
  },

  async _enviar(id) {
    let hiHaHagutCanvis = false;

    for (;;) {
      const d = this.dades(id);
      const accio = d?.pendents?.[0];
      if (!accio) break;

      this.enVol.set(id, accio.id);
      let r;
      try {
        r = await Api.post(`/partits/${id}/${accio.accio}`, { ...accio.cos, id_client: accio.id });
      } catch (e) {
        this.enVol.delete(id);
        if (esFallaDeXarxa(e)) {
          const abans = this.senseXarxa.has(id);
          this.senseXarxa.add(id);
          if (!abans) this.avisar();
          if (e.estat === 401) this.avisarSessio();
          return;
        }
        // El servidor l'ha rebutjada (el partit ja no s'estava jugant, una
        // jugadora que no hi era…). Es treu, perquè les de darrere puguin
        // passar, i es diu.
        const actual = this.dades(id);
        actual.pendents = actual.pendents.filter(a => a.id !== accio.id);
        this.desar(id, actual);
        toast(`No s'ha pogut desar una acció: ${e.message}`);
        hiHaHagutCanvis = true;
        continue;
      }

      this.enVol.delete(id);
      this.senseXarxa.delete(id);
      const actual = this.dades(id);
      actual.pendents = actual.pendents.filter(a => a.id !== accio.id);
      actual.base = r.marcador;
      this.desar(id, actual);
      hiHaHagutCanvis = true;
    }

    this.senseXarxa.delete(id);
    if (hiHaHagutCanvis) {
      Store.aplicarMarcador(id, this.provisional(id));
      try { await Store.carregarAccions(id); } catch (_) { /* ja vindrà */ }
      this.avisar(id);
    }
  },

  enviarTot() {
    return Promise.all(this.partitsAmbPendents().map(id => this.enviar(id)));
  },

  avisar(id = null) {
    if (typeof this.enCanviar === 'function') this.enCanviar(id);
  },

  avisarSessio() {
    toast('Torna a entrar al teu compte per enviar el que tens pendent');
  },

  /** Es reintenta sol: cada pocs segons i en tornar la connexió. */
  engegar() {
    this.netejar();
    setInterval(() => { this.enviarTot(); }, this.SEGONS_REINTENT * 1000);
    window.addEventListener('online', () => this.enviarTot());
    this.enviarTot();
  },
};

/*
  Sense xarxa, un servidor que ha caigut un moment o una sessió caducada:
  en tots tres casos l'acció és bona i s'ha de tornar a provar. La resta
  de respostes d'error vol dir que el servidor l'ha mirat i no la vol.
*/
function esFallaDeXarxa(e) {
  return !e.estat || e.estat >= 500 || e.estat === 401 || e.estat === 408 || e.estat === 429;
}

function nouIdAccio() {
  if (window.crypto?.randomUUID) {
    try { return crypto.randomUUID(); } catch (_) { /* fora de https */ }
  }
  return Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 12);
}


/* =========================================================
   LES REGLES DEL MARCADOR, AL MÒBIL
   =========================================================
   Còpia de api/lib/Marcador.php i api/lib/Formacio.php. Només
   serveix per pintar mentre el servidor no respon: si algun
   dia no coincideixen, la resposta del servidor ho corregeix
   tota sola. Si es canvia una regla allà, s'ha de canviar aquí.
   ========================================================= */

const MotorMarcador = {
  regles(r) {
    return {
      setsPerGuanyar: 3, puntsSet: 25, puntsSetDecisiu: 15, diferenciaMinima: 2,
      ...Object.fromEntries(Object.entries(r || {}).filter(([, v]) => v !== null && v !== undefined)),
    };
  },

  /** Retorna el marcador nou, o llança el mateix error que llançaria el servidor. */
  aplicar(anterior, accio, cos, ctx) {
    const m = structuredClone(anterior);
    const regles = this.regles(ctx.regles);
    delete m.set_tancat;
    delete m.partit_finalitzat;
    m.formacio = m.formacio || this.formacioBuida(m);

    switch (accio) {
      case 'iniciar': this.iniciar(m); break;
      case 'punt': this.punt(m, cos.costat, regles); break;
      case 'restar': this.restar(m, cos.costat); break;
      case 'finalitzar': this.finalitzar(m); break;
      case 'formacio': this.formacio(m, cos, ctx); break;
      case 'canvi': this.canvi(m, cos, ctx); break;
      default: throw new ErrorApi('Acció desconeguda.', 422);
    }

    m.sets_guanyats = this.setsGuanyats(m.sets);
    m.set_actual = m.sets.length + 1;
    m.punts_objectiu = this.puntsObjectiu(m.sets, regles);
    m.pot_desfer = true;
    m.provisional = true;
    for (const costat of ['local', 'visitant']) {
      m.formacio[costat].compliment = this.compliment(m.formacio[costat].jugadores, ctx.regles || {});
    }
    return m;
  },

  formacioBuida(m) {
    return {
      local: { equip_id: null, jugadores: [], compliment: { aplica: false } },
      visitant: { equip_id: null, jugadores: [], compliment: { aplica: false } },
      cal_formacio: true,
      set_numero: (m.sets?.length || 0) + 1,
    };
  },

  enJoc(m) {
    if (m.estat !== 'directe') throw new ErrorApi("El partit no s'està jugant ara mateix.", 409);
  },

  costat(c) {
    if (c !== 'local' && c !== 'visitant') {
      throw new ErrorApi('El costat ha de ser "local" o "visitant".', 422);
    }
  },

  setsGuanyats(sets) {
    const g = { local: 0, visitant: 0 };
    for (const s of sets) {
      if (s.local > s.visitant) g.local++;
      else if (s.visitant > s.local) g.visitant++;
    }
    return g;
  },

  puntsObjectiu(sets, regles) {
    return sets.length === (regles.setsPerGuanyar - 1) * 2
      ? regles.puntsSetDecisiu : regles.puntsSet;
  },

  iniciar(m) {
    if (m.estat !== 'programat') throw new ErrorApi("Aquest partit ja s'ha iniciat.", 409);
    m.estat = 'directe';
    m.sets = [];
    m.punts = { local: 0, visitant: 0 };
  },

  punt(m, costat, regles) {
    this.costat(costat);
    this.enJoc(m);

    m.punts[costat]++;

    // Qui puntua rebent, rota i passa a sacar; qui ja sacava, continua.
    if (m.serveix !== null && m.serveix !== undefined && m.serveix !== costat) {
      const jugadores = m.formacio[costat].jugadores;
      if (jugadores.length) jugadores.push(jugadores.shift());
      m.serveix = costat;
    } else if (m.serveix === null || m.serveix === undefined) {
      m.serveix = costat;
    }

    const rival = costat === 'local' ? 'visitant' : 'local';
    const objectiu = this.puntsObjectiu(m.sets, regles);
    if (m.punts[costat] >= objectiu
        && m.punts[costat] - m.punts[rival] >= regles.diferenciaMinima) {

      // Es recorda qui hi havia a pista per si el set es reobre restant.
      m.pistaDelsSets = m.pistaDelsSets || [];
      m.pistaDelsSets[m.sets.length] = {
        local: m.formacio.local.jugadores, visitant: m.formacio.visitant.jugadores,
      };

      m.sets.push({ ...m.punts });
      m.punts = { local: 0, visitant: 0 };
      m.serveix = null;
      m.local_a_esquerra = !m.local_a_esquerra;
      m.formacio.local.jugadores = [];
      m.formacio.visitant.jugadores = [];
      m.formacio.cal_formacio = true;
      m.formacio.set_numero = m.sets.length + 1;
      m.set_tancat = true;

      const g = this.setsGuanyats(m.sets);
      if (g.local === regles.setsPerGuanyar || g.visitant === regles.setsPerGuanyar) {
        m.estat = 'finalitzat';
        m.partit_finalitzat = true;
      }
    }
  },

  restar(m, costat) {
    this.costat(costat);
    this.enJoc(m);

    if (m.punts[costat] > 0) {
      m.punts[costat]--;
    } else if (m.punts.local === 0 && m.punts.visitant === 0 && m.sets.length) {
      const ultim = m.sets.pop();
      m.punts = { ...ultim };
      if (m.punts[costat] > 0) m.punts[costat]--;
      const pista = m.pistaDelsSets?.[m.sets.length];
      if (pista) {
        m.formacio.local.jugadores = pista.local;
        m.formacio.visitant.jugadores = pista.visitant;
        m.formacio.cal_formacio = !pista.local.length || !pista.visitant.length;
      }
      m.formacio.set_numero = m.sets.length + 1;
    } else {
      throw new ErrorApi('No hi ha res a restar.', 409);
    }
  },

  finalitzar(m) {
    this.enJoc(m);
    if (m.punts.local > 0 || m.punts.visitant > 0) m.sets.push({ ...m.punts });
    m.estat = 'finalitzat';
    m.punts = { local: 0, visitant: 0 };
  },

  formacio(m, cos, ctx) {
    const enJoc = m.sets.length + 1;
    if (Number(cos.set_numero) !== enJoc) {
      throw new ErrorApi(`Ara s'està jugant el set ${enJoc}.`, 409);
    }
    for (const costat of ['local', 'visitant']) {
      const dorsals = cos[costat];
      if (!Array.isArray(dorsals)) throw new ErrorApi(`Falta la formació de l'equip ${costat}.`, 422);
      if (dorsals.length !== 6) throw new ErrorApi("A pista hi ha d'haver 6 jugadors.", 422);
      if (new Set(dorsals).size !== dorsals.length) {
        throw new ErrorApi('Hi ha un dorsal repetit a la formació.', 422);
      }
      m.formacio[costat].jugadores = dorsals.map(d => this.jugadora(ctx, costat, Number(d)));
    }
    if (cos.serveix) m.serveix = cos.serveix;
    if (cos.local_a_esquerra !== undefined) m.local_a_esquerra = !!cos.local_a_esquerra;
    m.formacio.cal_formacio = false;
    m.formacio.set_numero = enJoc;
  },

  canvi(m, cos, ctx) {
    this.costat(cos.costat);
    const surt = Number(cos.dorsal_surt);
    const entra = Number(cos.dorsal_entra);
    if (surt === entra) throw new ErrorApi('Has triat el mateix jugador dues vegades.', 422);

    const jugadores = m.formacio[cos.costat].jugadores;
    const on = jugadores.findIndex(j => j.dorsal === surt);
    if (on < 0) throw new ErrorApi(`La #${surt} no és a pista.`, 422);
    if (jugadores.some(j => j.dorsal === entra)) throw new ErrorApi(`La #${entra} ja és a pista.`, 422);
    jugadores[on] = this.jugadora(ctx, cos.costat, entra);
  },

  jugadora(ctx, costat, dorsal) {
    const j = (ctx.convocables?.[costat]?.jugadores || []).find(x => x.dorsal === dorsal);
    return {
      dorsal,
      fitxa_id: j?.fitxa_id ?? null,
      nom: j?.nom ?? null,
      cognoms: j?.cognoms ?? null,
      menor_30: j?.menor_30 ?? null,
      genere: j?.genere ?? null,
    };
  },

  compliment(aPista, regles) {
    const maxim = regles.maxMenors30 ?? null;
    const minim = regles.minDones ?? null;
    if (maxim === null && minim === null) return { aplica: false };

    let menors = 0, dones = 0, desconegudes = 0;
    for (const j of aPista) {
      if (j.menor_30 === null) desconegudes++;
      else if (j.menor_30) menors++;
      if (j.genere === 'dona') dones++;
    }
    return {
      aplica: true,
      menors_30: menors,
      max_menors_30: maxim,
      dones,
      min_dones: minim,
      sense_dades: desconegudes,
      compleix: (maxim === null || menors <= maxim) && (minim === null || dones >= minim),
    };
  },
};
