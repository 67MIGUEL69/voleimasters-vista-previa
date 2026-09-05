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

    const [d, ajustos] = await Promise.all([
      Api.get('/'),
      // Si els ajustos fallen no val la pena aturar l'app: es pinta amb
      // els colors de sempre, que és millor que no pintar res.
      Api.get('/ajustos').catch(() => null),
    ]);

    this.usuari = d.usuari;
    this.temporadaActiva = d.temporada_activa;

    if (ajustos) {
      this.marca = ajustos.marca;
      this.regles = ajustos.regles;
      this.marcadorsPossibles = ajustos.marcadors_possibles;
      this.aplicarMarca();
    }
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
    return d.usuari;
  },

  async registrar(dades) {
    const d = await Api.post('/auth/registrar', dades);
    this.usuari = d.usuari;
    return d.usuari;
  },

  async sortir() {
    try { await Api.post('/auth/sortir'); } catch (_) { /* igualment sortim */ }
    this.usuari = null;
    this.meusPartits = [];
    this.fitxesEquip = {};
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

  /** Pot moure el marcador d'aquest partit? El servidor ho torna a mirar. */
  potArbitrar(p) {
    if (!this.usuari) return false;
    if (this.teRol('admin') || this.teRol('coord_lliga')) return true;
    return p.arbitre?.id === this.usuari.id;
  },

  /* ---------- Consultes al que ja tenim ---------- */

  partit(id) { return this.partits.get(Number(id)); },
  categoria(id) { return this.categories.find(c => c.id === Number(id)); },

  desarPartits(llista) {
    llista.forEach(p => this.partits.set(p.id, p));
    return llista;
  },

  /* ---------- Descàrregues ---------- */

  async carregarPartits(estat) {
    const d = await Api.get(`/partits?estat=${estat}&limit=200`);
    this.desarPartits(d.partits);
    return estat === 'finalitzat' ? d.partits.slice().reverse() : d.partits;
  },

  async carregarPartit(id) {
    const d = await Api.get(`/partits/${id}`);
    this.partits.set(d.partit.id, d.partit);

    // A qui l'arbitra li arriba també l'estat del marcador, amb qui hi
    // ha a pista. Sense això no sabria que li falta la formació fins que
    // premés un punt.
    if (d.partit.marcador) this.marcadors[id] = d.partit.marcador;

    return d.partit;
  },

  async carregarAccions(id) {
    const d = await Api.get(`/partits/${id}/accions`);
    this.accions[id] = d.accions;
    return d.accions;
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

  /* ---------- L'acta: qui hi ha a pista ---------- */

  convocables: {},        // partitId → { local, visitant }

  /*
    `forcar` serveix per a l'inici del partit: fins llavors l'equip encara
    podia tocar la convocatòria, i la llista que tinguéssim desada podria
    no portar-hi qui es va afegir a última hora.
  */
  async carregarConvocables(partitId, forcar = false) {
    if (!forcar && this.convocables[partitId]) return this.convocables[partitId];
    const d = await Api.get(`/partits/${partitId}/convocables`);
    this.convocables[partitId] = d;
    return d;
  },

  /** Desa les sis de cada equip per al set que s'està jugant. */
  async desarFormacio(partitId, dades) {
    const d = await Api.post(`/partits/${partitId}/formacio`, dades);
    this.aplicarMarcador(partitId, d.marcador);
    return d.marcador;
  },

  async canviarJugadora(partitId, costat, surt, entra) {
    const d = await Api.post(`/partits/${partitId}/canvi`, {
      costat, dorsal_surt: surt, dorsal_entra: entra,
    });
    this.aplicarMarcador(partitId, d.marcador);
    return d.marcador;
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

  async generarCalendari(categoriaId) {
    const d = await Api.post(`/categories/${categoriaId}/calendari`, {});
    this.jornades[categoriaId] = d.jornades_detall;
    this.partits = new Map();
    return d;
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

  async fitxar(equipId, dades) {
    await Api.post(`/equips/${equipId}/plantilla`, dades);
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

  async desarMarca(canvis) {
    const d = await Api.patch('/ajustos', canvis);
    return d.marca;
  },

  desarRegles(regles) {
    return Api.patch('/regles', regles);
  },

  async carregarUsuaris(cerca = '') {
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
  async sondejar() {
    const des = this.ultimSondeig ? `?des=${encodeURIComponent(this.ultimSondeig)}` : '';
    const d = await Api.get('/partits/directe' + des);

    // L'hora ve del servidor a propòsit: si la posés el mòbil, un rellotge
    // mal ajustat es perdria canvis o els repetiria.
    this.ultimSondeig = d.ara;
    this.desarPartits(d.partits);
    return d.partits.length > 0;
  },

  /* ---------- Accions de l'àrbitre ---------- */
  /*  Totes escriuen al servidor i es queden amb el marcador que respon,
      que és l'oficial. Aquí no es calcula res.                        */

  iniciarPartit(id) { return this._accio(id, 'iniciar'); },
  desfer(id) { return this._accio(id, 'desfer'); },
  finalitzarPartit(id) { return this._accio(id, 'finalitzar'); },
  sumarPunt(id, costat) { return this._accio(id, 'punt', { costat }); },
  restarPunt(id, costat) { return this._accio(id, 'restar', { costat }); },

  async _accio(id, accio, cos) {
    const d = await Api.post(`/partits/${id}/${accio}`, cos);
    this.aplicarMarcador(id, d.marcador);
    await this.carregarAccions(id);
    return d.marcador;
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

  /** Codi temporal per a un àrbitre suplent. */
  generarCodiArbitre(id) { return Api.post(`/partits/${id}/codi-arbitre`); },
  bescanviarCodiArbitre(id, codi) {
    return Api.post(`/partits/${id}/codi-arbitre/bescanviar`, { codi });
  },
};
