/* =========================================================
   ESTAT DE L'APP
   =========================================================
   Ja no hi ha dades d'exemple: tot ve de l'API. Aquí només hi
   viu el que s'ha descarregat, perquè les vistes puguin pintar
   sense esperar, i les accions que escriuen al servidor.

   La lògica del marcador (quan es tanca un set, quan s'acaba el
   partit) NO és aquí: la decideix el servidor. Si la repetíssim
   al mòbil, dos aparells connectats al mateix partit podrien
   arribar a resultats diferents.
   ========================================================= */

const Store = {
  usuari: null,
  tema: 'light',
  temporadaActiva: null,

  /* --- El que s'ha descarregat --- */
  partits: new Map(),        // id → partit
  categories: [],
  classificacions: {},       // categoriaId → llista ordenada
  equipsPerCategoria: {},    // categoriaId → llista d'equips
  fitxesEquip: {},           // equipId → { equip, plantilla, partits, … }
  calendari: {},             // categoriaId → tots els partits de la categoria
  noticies: [],
  meusPartits: [],
  accions: {},               // partitId → historial
  marcadors: {},             // partitId → detall del marcador en joc

  /* Hora de l'últim sondeig, per demanar només el que ha canviat. */
  ultimSondeig: null,

  /* ---------- Arrencada ---------- */

  async iniciar() {
    this.tema = localStorage.getItem('volei-tema')
      || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    this.aplicarTema();

    let d, ajustos;
    try {
      [d, ajustos] = await Promise.all([
        Api.get('/'),
        // Si els ajustos fallen no val la pena aturar l'app: es pinta amb
        // els colors de sempre, que és millor que no pintar res.
        Api.get('/ajustos').catch(() => null),
      ]);
      this.recordarArrencada(d, ajustos);
    } catch (e) {
      /*
        Sense xarxa, i amb un partit a mig arbitrar al telèfon, l'app ha
        d'obrir igualment amb el que es va saber l'últim cop. Si no hi ha
        cap partit pendent, val més l'avís de sempre que dades velles.
      */
      const desat = e.estat === 0 ? this.arrencadaDesada() : null;
      if (!desat?.d?.usuari || !CuaArbitre.hiHaPendentsDe(desat.d.usuari.id)) throw e;
      ({ d, ajustos } = desat);
    }

    this.usuari = d.usuari;
    this.temporadaActiva = d.temporada_activa;

    if (ajustos) {
      this.marca = ajustos.marca;
      this.regles = ajustos.regles;
      this.marcadorsPossibles = ajustos.marcadors_possibles;
      this.aplicarMarca();
    }

    await this.carregarPendents();
  },

  /* El que cal per obrir l'app sense xarxa si hi ha un partit a mig arbitrar. */
  recordarArrencada(d, ajustos) {
    try {
      if (!d.usuari) { localStorage.removeItem('volei-arrencada'); return; }
      localStorage.setItem('volei-arrencada', JSON.stringify({ d, ajustos }));
    } catch (_) { /* sense emmagatzematge */ }
  },

  arrencadaDesada() {
    try { return JSON.parse(localStorage.getItem('volei-arrencada') || 'null'); } catch (_) { return null; }
  },

  /* ---------- Marca ----------
     Els colors i el logotip els decideix la lliga des de la pantalla
     d'administració, no aquest fitxer. Aquí només s'aboquen a les
     variables del CSS.                                              */

  marca: null,
  regles: null,
  marcadorsPossibles: [],

  aplicarMarca() {
    if (!this.marca) return;
    const arrel = document.documentElement.style;
    const posa = (variable, valor) => { if (valor) arrel.setProperty(variable, valor); };

    posa('--primary', this.marca.color_principal);
    posa('--lima', this.marca.color_clar);
    posa('--groc', this.marca.color_accent);
    posa('--secondary', this.marca.color_accent);
    posa('--negre', this.marca.color_fosc);

    if (this.marca.logo) posa('--logo', `url("${this.ruta(this.marca.logo)}")`);
    if (this.marca.logo_clar) posa('--logo-clar', `url("${this.ruta(this.marca.logo_clar)}")`);
  },

  /**
   * Els camins de la marca venen absoluts («/icones/logo.png»), que és el
   * que toca a la web. Dins de l'APK la interfície viu a file://, i allà
   * una barra inicial apunta a l'arrel del telèfon: el logotip no es veia.
   */
  ruta(cami) {
    if (location.protocol !== 'file:') return cami;
    return cami.startsWith('/') ? cami.slice(1) : cami;
  },

  /** Mana a la lliga? Decideix si surt la pantalla d'administració. */
  esCoordinacio() {
    return this.teRol('admin') || this.teRol('coord_lliga');
  },

  /* ---------- Tema ---------- */

  aplicarTema() {
    document.documentElement.dataset.theme = this.tema;
  },

  alternarTema() {
    this.tema = this.tema === 'dark' ? 'light' : 'dark';
    localStorage.setItem('volei-tema', this.tema);
    this.aplicarTema();
  },

  /* ---------- Sessió ---------- */

  async entrar(identificador, contrasenya) {
    const d = await Api.post('/auth/entrar', {
      identificador, contrasenya, origen: 'web',
    });
    this.usuari = d.usuari;
    await this.carregarPendents();
    return d.usuari;
  },

  async registrar(dades) {
    const d = await Api.post('/auth/registrar', dades);
    this.usuari = d.usuari;
    await this.carregarPendents();
    return d.usuari;
  },

  async sortir() {
    // El que quedi per enviar de l'arbitratge, abans de perdre la sessió.
    await CuaArbitre.enviarTot();
    try { await Api.post('/auth/sortir'); } catch (_) { /* igualment sortim */ }
    this.usuari = null;
    try { localStorage.removeItem('volei-arrencada'); } catch (_) { /* res */ }
    CuaArbitre.netejar({ tot: true });
    this.meusPartits = [];
    this.fitxesEquip = {};
    this.pendents = [];
  },

  /** Té aquest rol, en qualsevol àmbit? */
  teRol(rol) {
    return !!this.usuari?.permisos?.some(p => p.rol === rol);
  },

  /*
    Ser àrbitre és tenir-ne el rol, i prou.

    Abans hi entraven també l'administració i la coordinació de lliga
    —poden moure el marcador de qualsevol partit, i això segueix sent
    així a potArbitrar()—, però barrejar-ho tenia una conseqüència
    lletja: en entrar, la coordinació anava a parar a la pantalla de
    l'àrbitre, que li surt buida perquè no té cap partit assignat. El
    primer que veia de l'app era una pàgina en blanc.
  */
  esArbitre() {
    return this.teRol('arbitre');
  },

  /**
   * L'equip de l'usuari, si en té cap. Serveix per oferir-li un accés
   * directe: la coordinació i els jugadors van sempre al mateix lloc.
   */
  elMeuEquip() {
    const p = this.usuari?.permisos?.find(
      p => ['coord_equip', 'entrenador', 'capita', 'jugador'].includes(p.rol)
        && p.ambit_tipus === 'equip'
    );
    return p?.ambit_id ?? null;
  },

  /**
   * Pot moure el marcador d'aquest partit? El servidor ho torna a mirar.
   *
   * Quan el partit ve de la seva pròpia adreça, la resposta la dona ell:
   * un suplent que ha bescanviat un codi no consta com a àrbitre, i
   * mirant només qui hi consta li amagàvem els botons tot i tenir-ne
   * permís. A les llistes, que no porten el camp, es mira com sempre.
   */
  potArbitrar(p) {
    if (!this.usuari) return false;
    if (typeof p?.pot_arbitrar === 'boolean') return p.pot_arbitrar;
    if (this.teRol('admin') || this.teRol('coord_lliga')) return true;
    return p?.arbitre?.id === this.usuari.id;
  },

  /* ---------- Consultes al que ja tenim ---------- */

  partit(id) { return this.partits.get(Number(id)); },
  categoria(id) { return this.categories.find(c => c.id === Number(id)); },

  desarPartits(llista) {
    llista.forEach(p => {
      this.partits.set(p.id, p);
      // El sondeig no sap res del que l'àrbitre encara no ha pogut enviar.
      if (CuaArbitre.pendents(p.id)) this.aplicarMarcador(p.id, CuaArbitre.provisional(p.id));
    });
    return llista;
  },

  /* ---------- Descàrregues ---------- */

  async carregarPartits(estat) {
    const d = await Api.get(`/partits?estat=${estat}&limit=200`);
    this.desarPartits(d.partits);
    return estat === 'finalitzat' ? d.partits.slice().reverse() : d.partits;
  },

  async carregarPartit(id) {
    let d;
    try {
      d = await Api.get(`/partits/${id}`);
    } catch (e) {
      // Sense xarxa, l'àrbitre pot tornar a obrir el partit que tenia obert.
      const desat = CuaArbitre.dades(id);
      if (e.estat !== 0 || !desat?.partit) throw e;
      d = { partit: { ...desat.partit, marcador: desat.base } };
    }
    this.partits.set(d.partit.id, d.partit);

    // A qui l'arbitra li arriba també l'estat del marcador, amb qui hi
    // ha a pista. Sense això no sabria que li falta la formació fins que
    // premés un punt.
    if (d.partit.marcador) this.marcadors[id] = d.partit.marcador;

    // Si hi ha accions per enviar, es pinten a sobre del que ha arribat.
    if (CuaArbitre.pendents(id)) this.aplicarMarcador(id, CuaArbitre.provisional(id));

    return d.partit;
  },

  async carregarAccions(id) {
    try {
      const d = await Api.get(`/partits/${id}/accions`);
      this.accions[id] = d.accions;
    } catch (e) {
      if (e.estat !== 0 || !CuaArbitre.dades(id)) throw e;
      this.accions[id] = this.accions[id] || [];
    }
    return this.accions[id];
  },

  async carregarCategories() {
    if (this.categories.length) return this.categories;
    const d = await Api.get('/categories');
    this.categories = d.categories;
    return this.categories;
  },

  /*
    Els grups d'una altra temporada, per muntar-la. Van a part a posta:
    desar-los a `categories` faria que la resta de l'app —classificació,
    filtres, desplegables— ensenyés els grups de l'any que ve.
  */
  categoriesTemporada: [],

  async carregarCategoriesDe(temporadaId) {
    const d = await Api.get(`/categories?temporada=${temporadaId}`);
    this.categoriesTemporada = d.categories;
    return d.categories;
  },

  async carregarClassificacio(categoriaId) {
    const d = await Api.get(`/classificacio?categoria=${categoriaId}`);
    this.classificacions[categoriaId] = d.classificacions[0]?.equips || [];
    return this.classificacions[categoriaId];
  },

  async carregarEquips(categoriaId, temporadaId = null) {
    const q = temporadaId ? `&temporada=${temporadaId}` : '';
    const d = await Api.get(`/equips?categoria=${categoriaId}${q}`);
    this.equipsPerCategoria[categoriaId] = d.equips;
    return d.equips;
  },

  async carregarEquip(id) {
    const d = await Api.get(`/equips/${id}`);
    this.desarPartits(d.partits);
    this.fitxesEquip[id] = d;
    return d;
  },

  async carregarMeusPartits() {
    const d = await Api.get('/partits/meus');
    this.desarPartits(d.partits);
    this.meusPartits = d.partits;
    return d.partits;
  },

  /** Tots els partits d'una categoria, per muntar el calendari per jornades. */
  async carregarCalendari(categoriaId) {
    const d = await Api.get(`/partits?categoria=${categoriaId}&limit=500`);
    this.desarPartits(d.partits);
    this.calendari[categoriaId] = d.partits;
    return d.partits;
  },

  async carregarNoticies(limit = 30) {
    const d = await Api.get(`/noticies?limit=${limit}`);
    this.noticies = d.noticies;
    return this.noticies;
  },

  /** Desa els canvis de la fitxa d'un equip i refresca el que en tenim. */
  async desarEquip(id, canvis) {
    await Api.patch(`/equips/${id}`, canvis);
    delete this.fitxesEquip[id];
    return this.carregarEquip(id);
  },

  /*
    El logotip té adreces pròpies perquè el fitxer d'abans s'esborra en
    pujar-ne un de nou; per això no va dins del PATCH de la fitxa.
  */
  async desarLogo(id, dataUrl) {
    await Api.post(`/equips/${id}/logo`, { logo: dataUrl });
    delete this.fitxesEquip[id];
    return this.carregarEquip(id);
  },

  async esborrarLogo(id) {
    await Api.delete(`/equips/${id}/logo`);
    delete this.fitxesEquip[id];
    return this.carregarEquip(id);
  },

  /* ---------- L'acta: qui hi ha a pista ---------- */

  convocables: {},        // partitId → { local, visitant }

  /*
    `forcar` serveix per a l'inici del partit: fins llavors l'equip encara
    podia tocar la convocatòria, i la llista que tinguéssim desada podria
    no portar-hi qui es va afegir a última hora.
  */
  async carregarConvocables(partitId, forcar = false) {
    if (!forcar && this.convocables[partitId]) return this.convocables[partitId];
    let d;
    try {
      d = await Api.get(`/partits/${partitId}/convocables`);
    } catch (e) {
      // Sense xarxa, les que es van desar en obrir el partit.
      const desades = CuaArbitre.dades(partitId)?.convocables;
      if (e.estat !== 0 || !desades) throw e;
      d = desades;
    }
    this.convocables[partitId] = d;
    const cua = CuaArbitre.dades(partitId);
    if (cua) { cua.convocables = d; CuaArbitre.desar(partitId, cua); }
    return d;
  },

  /** Desa les sis de cada equip per al set que s'està jugant. */
  desarFormacio(partitId, dades) {
    return this._accio(partitId, 'formacio', dades);
  },

  canviarJugadora(partitId, costat, surt, entra) {
    return this._accio(partitId, 'canvi', {
      costat, dorsal_surt: surt, dorsal_entra: entra,
    });
  },

  /* ---------- Tancar el partit: comentaris i conformitats ---------- */

  comentaris: {},   // partitId → llista
  firmes: {},       // partitId → llista

  async carregarTancament(partitId) {
    const [c, p] = await Promise.all([
      Api.get(`/partits/${partitId}/comentaris`),
      Api.get(`/partits/${partitId}`),
    ]);
    this.comentaris[partitId] = c.comentaris;
    this.firmes[partitId] = p.partit.firmes || [];
    return { comentaris: this.comentaris[partitId], firmes: this.firmes[partitId] };
  },

  async comentar(partitId, text) {
    const d = await Api.post(`/partits/${partitId}/comentari`, { text });
    this.comentaris[partitId] = d.comentaris;
    return d.comentaris;
  },

  async donarConformitat(partitId, equipId) {
    const d = await Api.post(`/partits/${partitId}/firma`, { equip_id: equipId });
    this.firmes[partitId] = d.firmes;
    return d.firmes;
  },

  /**
   * L'adreça de l'acta, o null si aquí no es pot generar.
   *
   * L'acta la fa el servidor. A la còpia de mostra, que va per file://,
   * una adreça com «/api/…» apunta a l'arrel del telèfon: el navegador
   * se n'anava a una pàgina d'error i deixava l'usuari fora de l'app.
   * Val més no oferir-la que trencar-la.
   */
  actaUrl(partitId) {
    // La còpia de mostra s'identifica: no té servidor, ni per file://
    // (l'APK) ni per https (la vista prèvia), i en els dos casos
    // l'enllaç se n'anava a una pàgina d'error.
    if (esAppEmpaquetada()) return null;
    return `${CONFIG.api}/partits/${partitId}/acta.pdf`;
  },

  /* ---------- El que t'espera ---------- */

  pendents: [],

  /*
    Es demana en arrencar i després de cada canvi de sessió, perquè el
    punt de la pestanya ha de sortir a qualsevol pantalla, no només a la
    portada.
  */
  async carregarPendents() {
    if (!this.usuari) { this.pendents = []; return []; }
    try {
      const d = await Api.get('/jo/pendents');
      this.pendents = d.pendents;
    } catch (_) {
      // Que no es pugui saber què t'espera no ha d'espatllar cap pantalla.
      this.pendents = [];
    }
    return this.pendents;
  },

  /* ---------- Documents del club ---------- */

  clubs: [],

  async carregarClubs() {
    const d = await Api.get('/clubs/meus');
    this.clubs = d.clubs;
    return d.clubs;
  },

  async pujarDocument(clubId, dades) {
    await Api.post(`/clubs/${clubId}/documents`, dades);
    return this.carregarClubs();
  },

  async esborrarDocument(id) {
    await Api.delete(`/documents/${id}`);
    return this.carregarClubs();
  },

  /*
    El document no es pot enllaçar i prou: va per l'API, que comprova qui
    ets. Es demana amb la sessió i s'obre el que arriba.
  */
  enllacDocument(id) {
    // Dins de l'APK no hi ha servidor a qui demanar-lo, igual que passa
    // amb l'acta: val més no ensenyar un enllaç que porta a un error.
    if (esAppEmpaquetada()) return null;
    return `${CONFIG.api}/documents/${id}/fitxer`;
  },

  /* ---------- Dia, hora i àrbitre ---------- */

  arbitres: [],

  async carregarArbitres() {
    const d = await Api.get('/arbitres');
    this.arbitres = d.arbitres;
    return d.arbitres;
  },

  disponibilitat: {},     // partitId → { equips, persona_id }

  async carregarDisponibilitat(partitId) {
    if (!this.usuari) { delete this.disponibilitat[partitId]; return null; }
    const d = await Api.get(`/partits/${partitId}/disponibilitat`);
    this.disponibilitat[partitId] = d;
    return d;
  },

  async preguntarDisponibilitat(partitId, equipId, dades) {
    await Api.post(`/partits/${partitId}/disponibilitat`, { equip_id: equipId, ...dades });
    return this.carregarDisponibilitat(partitId);
  },

  async respondreDisponibilitat(partitId, consultaId, resposta, comentari = null) {
    await Api.post(`/disponibilitat/${consultaId}/resposta`, { resposta, comentari });
    await this.carregarPendents();
    return this.carregarDisponibilitat(partitId);
  },

  propostes: {},          // partitId → { propostes, pendent, pot_contestar, pot_proposar }

  async carregarPropostes(partitId) {
    const d = await Api.get(`/partits/${partitId}/propostes`);
    this.propostes[partitId] = d;
    return d;
  },

  /*
    Després d'escriure, el partit es torna a demanar sencer en comptes de
    quedar-se amb el que torna l'escriptura.

    El detall hi afegeix `pot_editar_dades` i `pot_assignar_arbitre`, que
    depenen dels dos equips; les respostes de les escriptures no els
    porten. Desant-hi el que tornaven, el bloc d'organitzar desapareixia
    just després de fer-lo servir i no tornava fins a recarregar.
  */
  async desarDadesPartit(partitId, canvis) {
    const d = await Api.patch(`/partits/${partitId}`, canvis);
    await this.carregarPartit(partitId);
    await this.carregarPropostes(partitId);
    await this.carregarPendents();
    return { ...d, partit: this.partit(partitId) };
  },

  async respondreProposta(partitId, propostaId, resposta, motiu = null) {
    const d = await Api.post(
      `/partits/${partitId}/propostes/${propostaId}/resposta`,
      { resposta, motiu });
    await this.carregarPartit(partitId);
    await this.carregarPropostes(partitId);
    await this.carregarPendents();
    return { ...d, partit: this.partit(partitId) };
  },

  async designarArbitre(partitId, arbitreId) {
    await Api.put(`/partits/${partitId}/arbitre`, { arbitre_usuari_id: arbitreId });
    await this.carregarPartit(partitId);
    return this.partit(partitId);
  },

  /* ---------- El calendari ---------- */

  jornades: {},           // categoriaId → llista

  async carregarJornades(categoriaId) {
    const d = await Api.get(`/jornades?categoria=${categoriaId}`);
    this.jornades[categoriaId] = d.jornades;
    return d.jornades;
  },

  async desarJornades(categoriaId, jornades) {
    const d = await Api.put('/jornades', { categoria_id: categoriaId, jornades });
    this.jornades[categoriaId] = d.jornades;
    return d.jornades;
  },

  /*
    Els creuaments els escriu la coordinació un a un. Hi havia un botó de
    muntar-ho tot sol —tothom contra tothom— i s'ha tret: mai coincidia
    amb el que elles ja tenien decidit.
  */
  async crearPartit(jornadaId, localId, visitantId) {
    const d = await Api.post('/partits', {
      jornada_id: jornadaId,
      equip_local_id: localId,
      equip_visitant_id: visitantId,
    });
    this.partits = new Map();
    return d.partit;
  },

  async esborrarPartit(id) {
    await Api.delete(`/partits/${id}`);
    this.partits.delete(Number(id));
  },

  async buidarCalendari(categoriaId) {
    const d = await Api.delete(`/categories/${categoriaId}/calendari`);
    await this.carregarJornades(categoriaId);
    this.partits = new Map();
    return d;
  },

  /* ---------- Muntar la temporada ---------- */

  temporades: [],
  senseGrup: [],          // equips que encara no són a cap grup

  async carregarTemporades() {
    const d = await Api.get('/temporades');
    this.temporades = d.temporades;
    return d.temporades;
  },

  async crearTemporada(dades) {
    const d = await Api.post('/temporades', dades);
    await this.carregarTemporades();
    return d;
  },

  async activarTemporada(id) {
    await Api.post(`/temporades/${id}/activar`, {});
    // Canvia la temporada que es veu: tot el que hi havia desat és
    // d'una altra i ja no val.
    this.categories = [];
    this.equipsPerCategoria = {};
    this.classificacions = {};
    this.partits = new Map();
    await this.carregarTemporades();
  },

  async editarTemporada(id, canvis) {
    await Api.patch(`/temporades/${id}`, canvis);
    await this.carregarTemporades();
  },

  async carregarSenseGrup(temporadaId) {
    const d = await Api.get(`/equips?temporada=${temporadaId}&sense_grup=1`);
    this.senseGrup = d.equips;
    return d.equips;
  },

  /* ---------- Clubs ----------
     Quins clubs hi ha i quins equips té cadascun. Ho reparteix la
     coordinació de la lliga; un club mana dins del seu i prou.        */

  clubsLliga: [],
  equipsSenseClub: [],

  async carregarClubsLliga() {
    const d = await Api.get('/clubs');
    this.clubsLliga = d.clubs;
    this.equipsSenseClub = d.sense_club;
    return d;
  },

  async crearClub(nom) {
    const d = await Api.post('/clubs', { nom });
    await this.carregarClubsLliga();
    return d.club;
  },

  async reanomenarClub(id, nom) {
    await Api.patch(`/clubs/${id}`, { nom });
    return this.carregarClubsLliga();
  },

  async esborrarClub(id) {
    const d = await Api.delete(`/clubs/${id}`);
    await this.carregarClubsLliga();
    return d;
  },

  /** Canviar un equip de club, o deixar-lo sense (clubId null). */
  async moureEquipDeClub(equipId, clubId) {
    await Api.put(`/equips/${equipId}/club`, { club_id: clubId });
    // Les fitxes d'equip porten el nom del club: que es tornin a demanar.
    this.fitxesEquip = {};
    return this.carregarClubsLliga();
  },

  async posarEnGrup(equipId, categoriaId) {
    const d = await Api.put(`/equips/${equipId}/categoria`, { categoria_id: categoriaId });
    this.equipsPerCategoria = {};
    return d;
  },

  async treureDelGrup(equipId, temporadaId) {
    await Api.delete(`/equips/${equipId}/categoria?temporada=${temporadaId}`);
    this.equipsPerCategoria = {};
  },

  /* ---------- Les fitxes de les persones ---------- */

  fitxes: {},        // personaId → { fitxa, pot_editar, posicions }
  laMevaFitxa: null,

  async carregarLaMevaFitxa() {
    const d = await Api.get('/jo/fitxa');
    this.laMevaFitxa = d;
    if (d.fitxa) this.fitxes[d.fitxa.id] = d;
    return d;
  },

  async carregarFitxaPersona(id) {
    const d = await Api.get(`/persones/${id}`);
    this.fitxes[id] = d;
    return d;
  },

  async desarFitxaPersona(id, canvis) {
    const d = await Api.patch(`/persones/${id}`, canvis);
    // La plantilla porta el nom i la foto: si no s'oblida, s'hi queda
    // el que hi havia abans de canviar-ho.
    this.plantilles = {};
    await this.carregarFitxaPersona(id);
    if (this.laMevaFitxa?.fitxa?.id === id) await this.carregarLaMevaFitxa();
    return d.fitxa;
  },

  async canviarElMeuDorsal(personaId, fitxaId, dorsal) {
    await Api.patch(`/fitxes/${fitxaId}`, { dorsal });
    this.plantilles = {};
    await this.carregarFitxaPersona(personaId);
    if (this.laMevaFitxa?.fitxa?.id === personaId) await this.carregarLaMevaFitxa();
  },

  async desarFoto(id, dataUrl) {
    await Api.post(`/persones/${id}/foto`, { foto: dataUrl });
    this.plantilles = {};
    await this.carregarFitxaPersona(id);
    if (this.laMevaFitxa?.fitxa?.id === id) await this.carregarLaMevaFitxa();
  },

  async esborrarFoto(id) {
    await Api.delete(`/persones/${id}/foto`);
    this.plantilles = {};
    await this.carregarFitxaPersona(id);
    if (this.laMevaFitxa?.fitxa?.id === id) await this.carregarLaMevaFitxa();
  },

  /* ---------- Convocatòries ---------- */

  convocatories: {},   // partitId → { local, visitant, convocatoria_feta }

  async carregarConvocatoria(partitId) {
    const d = await Api.get(`/partits/${partitId}/convocatoria`);
    this.convocatories[partitId] = d;
    return d;
  },

  async desarConvocatoria(partitId, equipId, fitxes) {
    const d = await Api.put(`/partits/${partitId}/convocatoria`,
      { equip_id: equipId, fitxes });
    await this.carregarConvocatoria(partitId);
    return d;
  },

  /* ---------- Equips i plantilles ---------- */

  plantilles: {},   // equipId → { plantilla, pot_gestionar }

  async carregarPlantilla(equipId) {
    const d = await Api.get(`/equips/${equipId}/plantilla`);
    this.plantilles[equipId] = d;
    return d;
  },

  async crearEquip(dades) {
    const d = await Api.post('/equips', dades);
    this.equipsPerCategoria = {};   // la llista ha canviat
    return d.equip;
  },

  async arxivarEquip(equipId, arxivat = true) {
    await Api.post(`/equips/${equipId}/arxivar`, { arxivat });
    this.equipsPerCategoria = {};
    delete this.fitxesEquip[equipId];
  },

  entrenadors: {},        // equipId → { pot_gestionar, entrenadors }

  /** Posar un àrbitre pel seu correu. Si no té compte, se'l convida. */
  async convidarArbitre(equipId, email) {
    return Api.post(`/equips/${equipId}/arbitres`, { email });
  },

  async carregarEntrenadors(equipId) {
    const d = await Api.get(`/equips/${equipId}/entrenadors`);
    this.entrenadors[equipId] = d;
    return d;
  },

  async afegirEntrenador(equipId, email) {
    const d = await Api.post(`/equips/${equipId}/entrenadors`, { email });
    await this.carregarEntrenadors(equipId);
    /*
      La plantilla es torna a demanar, no s'esborra i prou: la pantalla la
      llegeix de Store i, sense ella, es pinta com a «no trobat». Esborrar
      i repintar deixava la plantilla en blanc just després d'afegir-hi un
      entrenador.
    */
    await this.carregarPlantilla(equipId);
    return d;
  },

  async treureEntrenador(equipId, usuariId) {
    await Api.delete(`/equips/${equipId}/entrenadors/${usuariId}`);
    return this.carregarEntrenadors(equipId);
  },

  /** Fitxar qui ho havia demanat: la seva fitxa ja hi és, només cal el dorsal. */
  async fitxarSolicitud(equipId, solicitudId, dorsal) {
    await Api.post(`/solicituds/${solicitudId}/fitxar`, { dorsal });
    await this.carregarSolicitudsEquip(equipId);
    return this.carregarPlantilla(equipId);
  },

  async editarFitxa(equipId, fitxaId, canvis) {
    await Api.patch(`/fitxes/${fitxaId}`, canvis);
    return this.carregarPlantilla(equipId);
  },

  async donarBaixa(equipId, fitxaId) {
    await Api.delete(`/fitxes/${fitxaId}`);
    return this.carregarPlantilla(equipId);
  },

  crearGrup(dades) {
    return Api.post('/categories', dades);
  },

  esborrarGrup(id) {
    return Api.delete(`/categories/${id}`);
  },

  /** Els clubs que coordina qui ha iniciat sessió. */
  elsMeusClubs() {
    return (this.usuari?.permisos || [])
      .filter(p => p.ambit_tipus === 'club' && p.ambit_id)
      .map(p => ({ id: p.ambit_id, nom: p.ambit_nom || `Club ${p.ambit_id}` }));
  },

  /** Té aquesta capacitat? El servidor les envia resoltes. */
  pot(capacitat) {
    return (this.usuari?.capacitats || []).includes(capacitat);
  },

  /* ---------- Administració ----------
     Tot això demana coordinació de lliga. El servidor ho torna a
     comprovar; aquí només s'amaguen els botons.                    */

  /* ---------- Buscar equip ---------- */

  solicitudsEquip: {},       // equipId → sol·licituds rebudes

  async carregarBuscarEquip() {
    return Api.get('/jo/buscar-equip');
  },

  async demanarEquip(equipId, missatge) {
    const d = await Api.post(`/equips/${equipId}/solicituds`, { missatge });
    return d.solicitud;
  },

  dorsalsOcupats: {},        // equipId → dorsals que ja té

  async carregarSolicitudsEquip(equipId) {
    const d = await Api.get(`/equips/${equipId}/solicituds`);
    this.solicitudsEquip[equipId] = d.solicituds;
    this.dorsalsOcupats[equipId] = d.dorsals_ocupats || [];
    return d.solicituds;
  },

  async contestarSolicitud(equipId, solicitudId, resposta) {
    await Api.post(`/solicituds/${solicitudId}/resposta`, { resposta });
    await this.carregarSolicitudsEquip(equipId);
    await this.carregarPendents();
  },

  async carregarNoticia(clau) {
    const d = await Api.get(`/noticies/${encodeURIComponent(clau)}`);
    return d.noticia;
  },

  /* ---------- Notícies, des de la coordinació ---------- */

  async carregarNoticiesAdmin() {
    const d = await Api.get('/admin/noticies');
    return d.noticies;
  },

  async crearNoticia(dades) {
    const d = await Api.post('/noticies', dades);
    return d.noticia;
  },

  async desarNoticia(id, dades) {
    const d = await Api.patch(`/noticies/${id}`, dades);
    return d.noticia;
  },

  async esborrarNoticia(id) {
    await Api.delete(`/noticies/${id}`);
  },

  async desarMarca(canvis) {
    const d = await Api.patch('/ajustos', canvis);
    return d.marca;
  },

  desarRegles(regles) {
    return Api.patch('/regles', regles);
  },

  ultimaCercaUsuaris: '',

  async carregarUsuaris(cerca = '') {
    this.ultimaCercaUsuaris = cerca;
    const q = cerca ? `?cerca=${encodeURIComponent(cerca)}` : '';
    return Api.get('/usuaris' + q);
  },

  crearUsuari(dades) {
    return Api.post('/usuaris', dades);
  },

  donarPermis(usuariId, rol, ambitTipus, ambitId) {
    return Api.post(`/usuaris/${usuariId}/permisos`, {
      rol, ambit_tipus: ambitTipus, ambit_id: ambitId,
    });
  },

  treurePermis(usuariId, rol, ambitTipus, ambitId) {
    return Api.crida('DELETE', `/usuaris/${usuariId}/permisos`, {
      rol, ambit_tipus: ambitTipus, ambit_id: ambitId,
    });
  },

  /** Esborrar el compte d'algú altre, des d'administració. */
  async esborrarUsuari(id) {
    await Api.delete(`/usuaris/${id}`);
    return this.carregarUsuaris(this.ultimaCercaUsuaris || '');
  },

  /** Esborrar el teu compte. Demana la contrasenya: no es pot desfer. */
  async esborrarElMeuCompte(contrasenya) {
    await Api.crida('DELETE', '/jo/compte', { contrasenya });
    this.usuari = null;
    this.meusPartits = [];
    this.fitxesEquip = {};
    this.pendents = [];
    try { localStorage.removeItem('volei-arrencada'); } catch (_) { /* res */ }
    CuaArbitre.netejar({ tot: true });
  },

  async carregarAjustosTaula(temporada) {
    const q = temporada ? `?temporada=${temporada}` : '';
    const d = await Api.get('/classificacio/ajustos' + q);
    return d.ajustos;
  },

  afegirAjustTaula(equipId, punts, motiu) {
    return Api.post('/classificacio/ajustos', { equip_id: equipId, punts, motiu });
  },

  treureAjustTaula(id) {
    return Api.delete(`/classificacio/ajustos/${id}`);
  },

  /** Corregir el resultat d'un partit ja tancat. */
  async corregirResultat(partitId, sets) {
    const d = await Api.patch(`/partits/${partitId}/resultat`, { sets });
    this.aplicarMarcador(partitId, d.marcador);
    this.classificacions = {};
    return d.marcador;
  },

  /* ---------- Sondeig del marcador en directe ---------- */

  /**
   * Demana només el que ha canviat des de l'últim cop. Retorna true si
   * alguna cosa s'ha mogut, per saber si val la pena repintar.
   */
  /* Quins partits estaven en directe l'última vegada que ho vam mirar. */
  enDirecteAra: null,

  async sondejar() {
    const des = this.ultimSondeig ? `?des=${encodeURIComponent(this.ultimSondeig)}` : '';
    const d = await Api.get('/partits/directe' + des);

    // L'hora ve del servidor a propòsit: si la posés el mòbil, un rellotge
    // mal ajustat es perdria canvis o els repetiria.
    this.ultimSondeig = d.ara;
    this.desarPartits(d.partits);

    /*
      Si ha canviat QUINS partits s'estan jugant —n'ha començat un o n'ha
      acabat un altre—, repintar no n'hi ha prou: la llista de la portada
      la fa carregarPartits() i es queda amb els d'abans. Fins ara un
      partit que començava no sortia fins que canviaves de pantalla.
    */
    const ara = d.partits.filter(p => p.estat === 'directe').map(p => p.id).sort().join(',');
    const hanCanviat = this.enDirecteAra !== null && this.enDirecteAra !== ara;
    this.enDirecteAra = ara;

    return { canvis: d.partits.length > 0, llistaNova: hanCanviat };
  },

  /* ---------- Accions de l'àrbitre ---------- */
  /*  Passen per la cua de cua-arbitre.js: es pinten de seguida i
      s'envien al servidor quan hi ha xarxa. El marcador que respon el
      servidor és l'oficial i substitueix el calculat al mòbil.       */

  iniciarPartit(id) { return this._accio(id, 'iniciar'); },
  /*
    En acabar, la pantalla passa a les conformitats i l'acta, que ja van al
    servidor: amb xarxa val més esperar que hi hagi arribat tot.
  */
  async finalitzarPartit(id) {
    const marcador = await this._accio(id, 'finalitzar');
    if (CuaArbitre.pendents(id) && CuaArbitre.teXarxa(id)) await CuaArbitre.enviar(id);
    return CuaArbitre.pendents(id) ? marcador : (this.marcadors[id] || marcador);
  },
  sumarPunt(id, costat) { return this._accio(id, 'punt', { costat }); },
  restarPunt(id, costat) { return this._accio(id, 'restar', { costat }); },

  async _accio(id, accio, cos = {}) {
    const marcador = await CuaArbitre.fer(id, accio, cos);
    // Sense xarxa l'historial no es pot demanar; ja arribarà en enviar.
    if (!CuaArbitre.pendents(id)) {
      try { await this.carregarAccions(id); } catch (_) { /* ja vindrà */ }
    }
    return marcador;
  },

  /*
    Amb xarxa, desfer és el de sempre: primer s'acaba d'enviar el que hi
    hagi i després ho desfà el servidor, que és qui sap què hi havia abans.

    Sense xarxa només es pot desfer el que encara no ha sortit del mòbil,
    i és treure-ho de la cua: l'última acció, sigui la que sigui.
  */
  async desfer(id) {
    if (CuaArbitre.pendents(id) && CuaArbitre.teXarxa(id)) await CuaArbitre.enviar(id);
    if (CuaArbitre.pendents(id) && CuaArbitre.treureUltima(id)) return this.marcadors[id];
    try {
      const marcador = await CuaArbitre.directe(id, 'desfer', {});
      try { await this.carregarAccions(id); } catch (_) { /* ja vindrà */ }
      return marcador;
    } catch (e) {
      if (e.estat === 0) {
        throw new ErrorApi("Sense connexió només es pot desfer el que encara no s'ha enviat. "
          + 'Per treure un punt, fes servir el botó de restar.', 0, e);
      }
      throw e;
    }
  },

  /** Aboca el marcador oficial al partit que tenim a la memòria. */
  aplicarMarcador(id, marcador) {
    this.marcadors[id] = marcador;
    const p = this.partits.get(Number(id));
    if (!p) return;
    p.estat = marcador.estat;
    p.sets = marcador.sets;
    p.sets_guanyats = marcador.sets_guanyats;
    p.punts = marcador.punts;
    p.actualitzat_a = marcador.actualitzat_a;
  },

  /* ---------- Amistosos ----------
     Partits que fan servir el marcador i l'acta i res més. No surten a
     cap llista ni compten per a la lliga: només els veu qui els crea. */

  amistosos: [],
  equipsAmistos: [],

  /** Qui en pot crear: qui porta alguna cosa a la lliga, no qui només hi juga. */
  potCrearAmistosos() {
    return ['admin', 'coord_lliga', 'coord_club', 'coord_equip', 'entrenador', 'arbitre', 'capita']
      .some(rol => this.teRol(rol));
  },

  async carregarAmistosos() {
    const d = await Api.get('/amistosos');
    this.amistosos = d.amistosos;
    this.desarPartits(d.amistosos);
    return d.amistosos;
  },

  async carregarEquipsAmistos() {
    const d = await Api.get('/amistosos/equips');
    this.equipsAmistos = d.equips;
    return d.equips;
  },

  async crearAmistos(dades) {
    const d = await Api.post('/amistosos', dades);
    this.partits.set(d.partit.id, d.partit);
    this.amistosos = [d.partit, ...this.amistosos];
    return d.partit;
  },

  async desarEquipAMa(partitId, costat, dades) {
    const d = await Api.put(`/amistosos/${partitId}/equips/${costat}`, dades);
    await this.carregarConvocables(partitId, true);
    await this.carregarPartit(partitId);
    return d;
  },

  async esborrarAmistos(id) {
    await Api.delete(`/amistosos/${id}`);
    this.partits.delete(Number(id));
    this.amistosos = this.amistosos.filter(p => p.id !== Number(id));
  },

  /** Codi temporal per a un àrbitre suplent. */
  generarCodiArbitre(id) { return Api.post(`/partits/${id}/codi-arbitre`); },
  async bescanviarCodiArbitre(id, codi) {
    await Api.post(`/partits/${id}/codi-arbitre/bescanviar`, { codi });
    // El partit torna a demanar-se: la resposta del bescanvi no porta els
    // permisos, i sense això la pantalla seguiria dient que no és teu.
    return this.carregarPartit(id);
  },
};
