/* =========================================================
   MODE MOSTRA
   =========================================================
   Fa que l'app funcioni sense servidor, per ensenyar-la a algú
   que no és a la mateixa xarxa.

   Intercepta les crides a l'API i les respon amb la fotografia
   que hi ha a instantania.js. Les accions de l'àrbitre es
   resolen aquí mateix, en memòria: es poden prémer els botons
   i el marcador es mou, però no surt del telèfon.

   Aquest fitxer NO existeix a l'app de debò. Allà tot ve del
   servidor i el marcador el decideix ell, que és l'únic que
   pot evitar que dos àrbitres arribin a resultats diferents.
   ========================================================= */

/*
  Marca que això és la còpia de mostra. L'app ho mira per no oferir el
  que necessita servidor — l'acta en PDF, sobretot: un enllaç trencat
  treu l'usuari de l'app i el deixa a una pàgina d'error.
*/
window.ES_MOSTRA = true;

(function () {
  const original = window.fetch;

  /* Còpia de treball: el que es toca durant la demostració es queda
     aquí i es perd en tancar. */
  const canviats = new Map();      // partitId → partit
  const historials = new Map();    // partitId → accions
  let sessio = null;

  /* Tots els partits que hi ha a la fotografia, sense repetir. */
  function totsElsPartits() {
    const per = new Map();
    for (const dades of Object.values(INSTANTANIA)) {
      for (const p of (dades && dades.partits) || []) {
        if (!per.has(p.id)) per.set(p.id, p);
      }
    }
    return [...per.values()];
  }

  const usuarisDesats = (INSTANTANIA['/usuaris'] || {}).usuaris || [];

  /**
   * L'usuari de la fotografia que correspon al correu escrit.
   *
   * La contrasenya no es mira: aquí no hi ha cap hash amb què comparar-la,
   * i la còpia de mostra no protegeix res — les dades ja van dins del
   * fitxer. A la lliga de debò la comprova el servidor.
   */
  function usuariPer(identificador) {
    const text = String(identificador || '').toLowerCase().trim();

    const exacte = usuarisDesats.find(u => (u.email || '').toLowerCase() === text);
    if (exacte) return exacte;

    // Amb escriure «arbitre» n'hi ha prou: al mòbil, teclejar el correu
    // sencer per provar nou comptes és una tortura.
    const parcial = usuarisDesats.find(u => (u.email || '').toLowerCase().startsWith(text));
    if (parcial) return parcial;

    return usuarisDesats.find(u => u.email === 'arbitre1@voleimasters.cat')
        || usuarisDesats[0]
        || null;
  }

  /* Marca i regles: es poden tocar durant la demostració. */
  const ajustos = copia(INSTANTANIA['/ajustos'] || { marca: {}, regles: {} });

  /* Sancions i acords, també en memòria. */
  let ajustosTaula = copia(
    (INSTANTANIA['/classificacio/ajustos'] || {}).ajustos || []
  );
  let idAjust = ajustosTaula.reduce((m, a) => Math.max(m, a.id), 0);

  /**
   * Torna a calcular la classificació amb la taula de punts que hi hagi
   * ara mateix, més els ajustos fets a mà.
   *
   * Sense això, canviar la puntuació a la demostració desaria el canvi
   * però la taula seguiria igual, i semblaria que no funciona. Els punts
   * surten dels partits, com al servidor; el que no s'hi reprodueix són
   * els desempats fins, que a la lliga de debò resol PHP.
   */
  function classificacioAlDia(dades) {
    const taula = ajustos.regles?.puntsPerResultat || {};

    return {
      ...dades,
      classificacions: (dades.classificacions || []).map(c => {
        const equips = c.equips.map(e => {
          let punts = 0;
          for (const p of totsElsPartits()) {
            if (p.estat !== 'finalitzat' || !p.sets_guanyats) continue;
            const sg = p.sets_guanyats;
            if (p.local?.id === e.equip_id) {
              punts += taula[`${sg.local}-${sg.visitant}`] ?? 0;
            } else if (p.visitant?.id === e.equip_id) {
              punts += taula[`${sg.visitant}-${sg.local}`] ?? 0;
            }
          }

          const meus = ajustosTaula.filter(a => a.equip_id === e.equip_id);
          const extra = meus.reduce((s, a) => s + a.punts, 0);

          return {
            ...e,
            pts: punts + extra,
            ajust: meus.length ? {
              punts: extra,
              motius: meus.map(a => ({
                punts: a.punts, motiu: a.motiu, data: a.data, autor: a.autor,
              })),
            } : null,
          };
        });

        equips.sort((a, b) => (b.pts - a.pts) || (b.pg - a.pg));

        /*
          Qui puja i qui baixa depèn de la PLAÇA, no de l'equip. Si es
          conservés la marca que tenia cadascun a la fotografia, en
          reordenar la taula les fletxes viatjarien amb l'equip i
          quedarien escampades pel mig — que és el que passava.

          Els dos primers pugen a totes les categories menys la de dalt,
          i els dos últims baixen a totes menys la de baix.
        */
        const nivell = c.categoria?.nivell;
        const pugen  = nivell > 1 ? 2 : 0;
        const baixen = nivell < NIVELL_MES_BAIX ? 2 : 0;

        equips.forEach((e, i) => {
          e.posicio = i + 1;
          e.moviment = i < pugen ? 'ascens'
                     : (baixen && i >= equips.length - baixen) ? 'descens'
                     : null;
        });

        return { ...c, equips };
      }),
    };
  }

  /** La categoria més baixa: d'ella no baixa ningú. */
  const NIVELL_MES_BAIX = Math.max(
    ...((INSTANTANIA['/categories'] || {}).categories || [{ nivell: 5 }])
      .map(c => c.nivell)
  );

  /** Tots els equips de la fotografia, sense repetir. */
  function totsElsEquips() {
    const per = new Map();
    for (const dades of Object.values(INSTANTANIA)) {
      for (const e of (dades && dades.equips) || []) {
        if (!per.has(e.id)) per.set(e.id, e);
      }
    }
    return [...per.values()];
  }

  const resposta = dades => new Response(JSON.stringify(dades), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });

  const error = (missatge, estat) => new Response(
    JSON.stringify({ error: missatge }),
    { status: estat, headers: { 'Content-Type': 'application/json' } }
  );

  /* ---------- Utilitats sobre la fotografia ---------- */

  function copia(x) { return JSON.parse(JSON.stringify(x)); }

  function partitDe(id) {
    if (canviats.has(id)) return canviats.get(id);
    const desat = INSTANTANIA[`/partits/${id}`];
    if (!desat) return null;
    const p = copia(desat.partit);
    canviats.set(id, p);
    return p;
  }

  /** Aplica els canvis fets durant la demostració a una llista. */
  function alDia(llista) {
    return llista.map(p => canviats.get(p.id) || p);
  }

  /* Formacions i rotacions de la demostració, en memòria. La regla és
     la mateixa que al servidor: qui puntua rebent rota i passa a sacar. */
  const formacions = new Map();   // `${partitId}:${set}:${costat}` → dorsals
  const comentaris = new Map();   // partitId → llista
  const firmes = new Map();       // partitId → llista
  const convocatories = new Map();  // partitId → la convocatòria tocada

  function clauFormacio(p, set, costat) { return `${p.id}:${set}:${costat}`; }

  function jugadoresDe(partitId, costat, dorsals) {
    const conv = INSTANTANIA[`/partits/${partitId}/convocables`];
    const totes = (conv && conv[costat] && conv[costat].jugadores) || [];
    return dorsals.map(d => totes.find(j => j.dorsal === d)
      || { dorsal: d, nom: '', cognoms: '', menor_30: null, genere: 'no_consta' });
  }

  function compliment(jugadores) {
    const r = ajustos.regles || {};
    const max = r.maxMenors30 ?? null;
    const min = r.minDones ?? null;
    if (max === null && min === null) return { aplica: false };

    let menors = 0, dones = 0, sense = 0;
    for (const j of jugadores) {
      if (j.menor_30 === null) sense++;
      else if (j.menor_30) menors++;
      if (j.genere === 'dona') dones++;
    }
    return {
      aplica: true,
      menors_30: menors, max_menors_30: max,
      dones, min_dones: min, sense_dades: sense,
      compleix: (max === null || menors <= max) && (min === null || dones >= min),
    };
  }

  /** Qui hi ha a pista, tal com ho torna el servidor. */
  function formacioDe(p) {
    const set = (p.sets || []).length + 1;
    const sortida = { set_numero: set };

    for (const costat of ['local', 'visitant']) {
      const desada = formacions.get(clauFormacio(p, set, costat));
      const rota = (p._rotacio && p._rotacio[costat]) || 0;
      let jugadores = [];

      if (desada) {
        const n = desada.length;
        const gir = n ? rota % n : 0;
        const ordre = desada.slice(gir).concat(desada.slice(0, gir));
        jugadores = jugadoresDe(p.id, costat, ordre);
      }

      sortida[costat] = {
        equip_id: p[costat] && p[costat].id,
        jugadores,
        compliment: compliment(jugadores),
      };
    }

    sortida.cal_formacio = !sortida.local.jugadores.length
                        || !sortida.visitant.jugadores.length;
    return sortida;
  }

  function setsGuanyats(p) {
    return (p.sets || []).reduce((a, s) => {
      if (s.local > s.visitant) a.local++;
      else if (s.visitant > s.local) a.visitant++;
      return a;
    }, { local: 0, visitant: 0 });
  }

  function estatMarcador(p) {
    return {
      partit_id: p.id,
      estat: p.estat,
      sets: p.sets,
      sets_guanyats: setsGuanyats(p),
      punts: p.punts,
      set_actual: p.sets.length + 1,
      punts_objectiu: p.sets.length === 4 ? 15 : 25,
      pot_desfer: (historials.get(p.id) || []).length > 0,
      actualitzat_a: new Date().toISOString().slice(0, 19).replace('T', ' '),
      serveix: p._serveix || null,
      local_a_esquerra: p._localEsquerra !== false,
      formacio: formacioDe(p),
    };
  }

  function anotar(p, text, tipus) {
    const llista = historials.get(p.id) || [];
    llista.unshift({
      tipus, text,
      creada_a: new Date().toISOString().slice(0, 19).replace('T', ' '),
      usuari_nom: sessio?.nom || 'Àrbitre',
    });
    historials.set(p.id, llista);
  }

  /* ---------- Accions de l'àrbitre ----------
     Regles mínimes, només per a la demostració. Les de debò viuen al
     servidor (api/lib/Marcador.php) i són les que compten.            */

  function sumarPunt(p, costat) {
    if (p.estat !== 'directe') return error('El partit no s\'està jugant.', 409);

    (historials.get(p.id) || historials.set(p.id, []).get(p.id));
    p._previ = copia({ sets: p.sets, punts: p.punts, estat: p.estat,
                       _rotacio: p._rotacio, _serveix: p._serveix });
    p.punts[costat]++;

    // La mateixa regla que al servidor.
    p._rotacio = p._rotacio || { local: 0, visitant: 0 };
    if (p._serveix && p._serveix !== costat) p._rotacio[costat]++;
    p._serveix = costat;

    const rival = costat === 'local' ? 'visitant' : 'local';
    const objectiu = p.sets.length === 4 ? 15 : 25;
    const nom = p[costat].nom;

    let setTancat = false;
    if (p.punts[costat] >= objectiu && p.punts[costat] - p.punts[rival] >= 2) {
      const numero = p.sets.length + 1;
      p.sets.push({ ...p.punts });
      anotar(p, `Set ${numero} per a ${nom} (${p.punts[costat]}-${p.punts[rival]})`, 'set');
      p.punts = { local: 0, visitant: 0 };
      p._rotacio = { local: 0, visitant: 0 };
      p._serveix = null;
      p._localEsquerra = p._localEsquerra === false;
      setTancat = true;

      const sg = setsGuanyats(p);
      if (sg.local === 3 || sg.visitant === 3) {
        p.estat = 'finalitzat';
        anotar(p, `Partit finalitzat · ${sg.local}-${sg.visitant}`, 'final');
      }
    } else {
      anotar(p, `Punt per a ${nom} (${p.punts.local}-${p.punts.visitant})`, 'punt');
    }

    p.sets_guanyats = setsGuanyats(p);
    return resposta({
      marcador: { ...estatMarcador(p), set_tancat: setTancat,
                  partit_finalitzat: p.estat === 'finalitzat' },
    });
  }

  function restarPunt(p, costat) {
    if (p.estat !== 'directe') return error('El partit no s\'està jugant.', 409);
    p._previ = copia({ sets: p.sets, punts: p.punts, estat: p.estat });

    if (p.punts[costat] > 0) {
      p.punts[costat]--;
      anotar(p, `Punt restat a ${p[costat].nom} (${p.punts.local}-${p.punts.visitant})`, 'correccio');
    } else if (p.sets.length) {
      const ultim = p.sets.pop();
      p.punts = { ...ultim };
      if (p.punts[costat] > 0) p.punts[costat]--;
      anotar(p, `Set ${p.sets.length + 1} reobert (${p.punts.local}-${p.punts.visitant})`, 'correccio');
    } else {
      return error('No hi ha res a restar.', 409);
    }

    p.sets_guanyats = setsGuanyats(p);
    return resposta({ marcador: estatMarcador(p) });
  }

  /* ---------- L'intercanviador ---------- */

  window.fetch = async function (url, opcions = {}) {
    const cami = String(url).replace(/^.*\/api/, '');
    const metode = (opcions.method || 'GET').toUpperCase();
    const cos = opcions.body ? JSON.parse(opcions.body) : {};

    // Tot el que no és l'API (icones, etc.) va pel camí normal.
    if (!String(url).includes('/api')) return original.apply(this, arguments);

    await new Promise(r => setTimeout(r, 90));   // que no sembli instantani

    /* --- Sessió --- */
    if (cami === '/auth/entrar') {
      const u = usuariPer(cos.identificador);
      if (!u) return error('A la còpia de mostra no hi ha cap compte.', 401);
      sessio = {
        id: u.id, nom: u.nom, cognoms: u.cognoms, email: u.email,
        permisos: u.permisos || [],
      };
      return resposta({ usuari: sessio, token: null });
    }
    if (cami === '/auth/sortir') { sessio = null; return resposta({ ok: true }); }
    if (cami === '/auth/registrar') {
      return error('A la còpia de mostra no es poden crear comptes.', 403);
    }

    /* --- Configuració de la lliga ---
       Es resol aquí, en memòria, per poder ensenyar que funciona: es
       canvia un color o la taula de punts i es veu l'efecte a l'instant.
       En tancar l'app es perd tot.                                    */

    if (cami === '/ajustos' && metode === 'PATCH') {
      if (!sessio) return error('Cal iniciar sessió.', 401);
      Object.assign(ajustos.marca, cos);
      return resposta({ marca: ajustos.marca });
    }

    if (cami === '/regles' && metode === 'PATCH') {
      if (!sessio) return error('Cal iniciar sessió.', 401);
      Object.assign(ajustos.regles, cos);
      return resposta({
        regles: ajustos.regles,
        marcadors_possibles: ajustos.marcadors_possibles,
      });
    }

    if (cami.startsWith('/classificacio/ajustos')) {
      if (!sessio) return error('Cal iniciar sessió.', 401);

      if (metode === 'POST') {
        const equip = totsElsEquips().find(e => e.id === cos.equip_id);
        ajustosTaula.unshift({
          id: ++idAjust,
          equip_id: cos.equip_id,
          equip: equip?.nom || 'Equip',
          categoria_id: 0,
          punts: cos.punts,
          motiu: cos.motiu,
          data: new Date().toISOString().slice(0, 19).replace('T', ' '),
          autor: `${sessio.nom} ${sessio.cognoms}`.trim(),
        });
        return resposta({ ok: true });
      }

      if (metode === 'DELETE') {
        const id = Number(cami.split('/').pop());
        ajustosTaula = ajustosTaula.filter(a => a.id !== id);
        return resposta({ ok: true });
      }

      return resposta({ ajustos: ajustosTaula });
    }

    if (cami === '/usuaris' && metode === 'POST') {
      return error('A la còpia de mostra no es poden crear comptes.', 403);
    }
    if (/^\/usuaris\/\d+\/permisos$/.test(cami) && metode !== 'GET') {
      return error('Els permisos es donen des del servidor de debò.', 403);
    }

    /* --- L'acta: formacions i canvis --- */

    const formacio = cami.match(/^\/partits\/(\d+)\/formacio$/);
    if (formacio && metode === 'POST') {
      if (!sessio) return error('Cal iniciar sessió.', 401);
      const p = partitDe(Number(formacio[1]));
      if (!p) return error('Aquest partit no existeix.', 404);

      const set = (p.sets || []).length + 1;
      if (cos.set_numero !== set) {
        return error(`Ara s'està jugant el set ${set}.`, 409);
      }
      for (const costat of ['local', 'visitant']) {
        const sis = cos[costat];
        if (!Array.isArray(sis) || sis.length !== 6) {
          return error("A pista hi ha d'haver 6 jugadores.", 422);
        }
        if (new Set(sis).size !== sis.length) {
          return error('Hi ha un dorsal repetit a la formació.', 422);
        }
        formacions.set(clauFormacio(p, set, costat), sis.slice());
      }
      if (cos.serveix) p._serveix = cos.serveix;
      if ('local_a_esquerra' in cos) p._localEsquerra = !!cos.local_a_esquerra;
      p._rotacio = p._rotacio || { local: 0, visitant: 0 };

      anotar(p, `Formació confirmada al set ${set}`, 'correccio');
      return resposta({ marcador: estatMarcador(p) });
    }

    const canvi = cami.match(/^\/partits\/(\d+)\/canvi$/);
    if (canvi && metode === 'POST') {
      if (!sessio) return error('Cal iniciar sessió.', 401);
      const p = partitDe(Number(canvi[1]));
      if (!p) return error('Aquest partit no existeix.', 404);

      const set = (p.sets || []).length + 1;
      const clau = clauFormacio(p, set, cos.costat);
      const sis = formacions.get(clau);
      if (!sis) return error('Primer cal confirmar la formació.', 422);
      if (!sis.includes(cos.dorsal_surt)) {
        return error(`La #${cos.dorsal_surt} no és a pista.`, 422);
      }
      if (sis.includes(cos.dorsal_entra)) {
        return error(`La #${cos.dorsal_entra} ja és a pista.`, 422);
      }

      formacions.set(clau, sis.map(d => d === cos.dorsal_surt ? cos.dorsal_entra : d));
      anotar(p, `Canvi: entra #${cos.dorsal_entra} per #${cos.dorsal_surt}`, 'correccio');
      return resposta({ marcador: estatMarcador(p) });
    }

    /* --- Tancar el partit: comentaris i conformitats --- */

    const comentari = cami.match(/^\/partits\/(\d+)\/comentari$/);
    if (comentari && metode === 'POST') {
      if (!sessio) return error('Cal iniciar sessió.', 401);
      const id = Number(comentari[1]);
      const llista = comentaris.get(id) || [];
      llista.push({
        id: llista.length + 1,
        text: cos.text,
        equip: null,
        autor: `${sessio.nom} ${sessio.cognoms}`.trim(),
        data: new Date().toISOString().slice(0, 19).replace('T', ' '),
      });
      comentaris.set(id, llista);
      return resposta({ comentaris: llista });
    }

    const firma = cami.match(/^\/partits\/(\d+)\/firma$/);
    if (firma && metode === 'POST') {
      if (!sessio) return error('Cal iniciar sessió.', 401);
      const id = Number(firma[1]);
      const p = partitDe(id);
      if (!p) return error('Aquest partit no existeix.', 404);
      if (p.estat !== 'finalitzat') {
        return error('El partit encara no ha acabat.', 409);
      }

      const llista = firmes.get(id) || [];
      if (llista.some(f => f.equip_id === cos.equip_id)) {
        return error('Aquest equip ja hi ha donat la conformitat.', 409);
      }
      const equip = [p.local, p.visitant].find(e => e && e.id === cos.equip_id);
      if (!equip) return error('Aquest equip no juga aquest partit.', 422);

      llista.push({
        equip_id: cos.equip_id,
        equip: equip.nom,
        autor: `${sessio.nom} ${sessio.cognoms}`.trim(),
        recollida_arbitre: true,
        data: new Date().toISOString().slice(0, 19).replace('T', ' '),
      });
      firmes.set(id, llista);
      return resposta({ firmes: llista });
    }

    const veureComentaris = cami.match(/^\/partits\/(\d+)\/comentaris$/);
    if (veureComentaris) {
      return resposta({ comentaris: comentaris.get(Number(veureComentaris[1])) || [] });
    }

    /* --- Avisos: no hi ha servidor que els enviï --- */
    if (cami.startsWith('/push')) {
      return error('Els avisos necessiten el servidor de debò.', 503);
    }

    /* --- Accions de l'àrbitre --- */
    const accio = cami.match(/^\/partits\/(\d+)\/(iniciar|punt|restar|desfer|finalitzar)$/);
    if (accio && metode === 'POST') {
      const p = partitDe(Number(accio[1]));
      if (!p) return error('Aquest partit no existeix.', 404);
      if (!sessio) return error('Cal iniciar sessió.', 401);

      switch (accio[2]) {
        case 'iniciar':
          if (p.estat !== 'programat') return error('Aquest partit ja s\'ha iniciat.', 409);
          p.estat = 'directe';
          p.sets = [];
          p.punts = { local: 0, visitant: 0 };
          p.sets_guanyats = { local: 0, visitant: 0 };
          anotar(p, 'Partit iniciat', 'inici');
          return resposta({ marcador: estatMarcador(p) });

        case 'punt':   return sumarPunt(p, cos.costat);
        case 'restar': return restarPunt(p, cos.costat);

        case 'desfer':
          if (!p._previ) return error('No hi ha res per desfer.', 409);
          Object.assign(p, copia(p._previ));
          delete p._previ;
          (historials.get(p.id) || []).shift();
          p.sets_guanyats = setsGuanyats(p);
          return resposta({ marcador: estatMarcador(p) });

        case 'finalitzar':
          if (p.punts.local || p.punts.visitant) p.sets.push({ ...p.punts });
          p.punts = { local: 0, visitant: 0 };
          p.estat = 'finalitzat';
          p.sets_guanyats = setsGuanyats(p);
          anotar(p, `Partit finalitzat · ${p.sets_guanyats.local}-${p.sets_guanyats.visitant}`, 'final');
          return resposta({ marcador: estatMarcador(p) });
      }
    }

    /* --- La convocatòria ---
       Es desa en memòria per poder ensenyar que es marca gent i el
       nombre canvia. En tancar l'app es perd, com tota la resta. */

    const convoc = cami.match(/^\/partits\/(\d+)\/convocatoria$/);
    if (convoc && metode === 'PUT') {
      if (!sessio) return error('Cal iniciar sessió.', 401);
      const id = Number(convoc[1]);
      const base = convocatories.get(id)
        || copia(INSTANTANIA[`/partits/${id}/convocatoria`]);
      if (!base) return error('Això no hi és a la còpia de mostra.', 404);

      const costat = ['local', 'visitant']
        .find(c => base[c].equip_id === cos.equip_id);
      if (!costat) return error('Aquest equip no juga aquest partit.', 422);

      const triades = new Set(cos.fitxes || []);
      base[costat].plantilla.forEach(f => { f.convocat = triades.has(f.fitxa_id); });
      base[costat].convocats = triades.size;
      base.convocatoria_feta = ['local', 'visitant'].some(c => base[c].convocats > 0);
      convocatories.set(id, base);

      return resposta({ ok: true, convocats: triades.size, avis: null });
    }

    if (metode !== 'GET') return error('A la còpia de mostra això no es pot fer.', 403);

    /* --- Lectures --- */

    if (cami === '/') {
      return resposta({ ...INSTANTANIA['/'], usuari: sessio });
    }

    if (cami === '/partits/meus') {
      if (!sessio) return error('Cal iniciar sessió.', 401);
      const meus = totsElsPartits().filter(p => p.arbitre?.id === sessio.id);
      const ordre = { directe: 0, programat: 1, finalitzat: 2 };
      meus.sort((a, b) => (ordre[a.estat] - ordre[b.estat]) || a.data.localeCompare(b.data));
      return resposta({ partits: alDia(meus) });
    }

    const accions = cami.match(/^\/partits\/(\d+)\/accions$/);
    if (accions) {
      const id = Number(accions[1]);
      const propies = historials.get(id);
      if (propies) return resposta({ accions: propies });
      return resposta(INSTANTANIA[cami] || { accions: [] });
    }

    const detall = cami.match(/^\/partits\/(\d+)$/);
    if (detall) {
      const p = partitDe(Number(detall[1]));
      if (!p) return error('Aquest partit no existeix.', 404);
      // Igual que al servidor: qui l'arbitra rep també qui hi ha a pista.
      const amb = { ...p };
      if (p.estat === 'finalitzat') amb.firmes = firmes.get(p.id) || [];
      if (sessio && p.estat !== 'programat') amb.marcador = estatMarcador(p);
      return resposta({ partit: amb });
    }

    if (cami.startsWith('/partits/directe')) {
      const base = INSTANTANIA['/partits/directe'] || { partits: [] };
      const vius = [...canviats.values()].filter(p => p.estat === 'directe');
      const ids = new Set(vius.map(p => p.id));
      return resposta({
        partits: [...vius, ...base.partits.filter(p => !ids.has(p.id))],
        ara: new Date().toISOString().slice(0, 19).replace('T', ' '),
      });
    }

    if (convoc) {
      const tocada = convocatories.get(Number(convoc[1]));
      if (tocada) return resposta(tocada);
    }

    if (cami === '/ajustos') return resposta(ajustos);

    if (cami.startsWith('/classificacio')) {
      const desat = INSTANTANIA[cami];
      if (desat) return resposta(classificacioAlDia(desat));
    }

    const desat = INSTANTANIA[cami];
    if (desat) {
      // Si l'usuari ha mogut algun marcador, que es vegi també a les llistes.
      if (desat.partits) return resposta({ ...desat, partits: alDia(desat.partits) });
      return resposta(desat);
    }

    // Alguna adreça que no es va capturar. Millor dir-ho que fallar en silenci.
    console.warn('[mostra] sense fotografia per a', cami);
    return error('Això no hi és a la còpia de mostra.', 404);
  };
})();
