/* =========================================================
   CRIDES A L'API
   =========================================================
   La sessió va per galeta httpOnly, no per testimoni guardat:
   com que la interfície i l'API són al mateix domini, la galeta
   viatja sola i JavaScript no la pot llegir. Si algun dia
   s'injectés un script a la pàgina, no se l'enduria.
   ========================================================= */

/** Error d'API amb el codi HTTP, per poder-hi reaccionar diferent. */
class ErrorApi extends Error {
  constructor(missatge, estat, causa) {
    super(missatge);
    this.estat = estat;
    // La causa original es guarda encara que no s'ensenyi: sense això,
    // «no s'ha pogut connectar» tapa igual una caiguda de xarxa que un
    // error de programació, i el segon costa moltíssim de trobar.
    if (causa) this.cause = causa;
  }
}

const Api = {
  async crida(metode, cami, cos) {
    const opcions = {
      method: metode,
      headers: {},
      credentials: 'same-origin',
      signal: AbortSignal.timeout(CONFIG.segonsEspera * 1000),
    };
    if (cos !== undefined) {
      opcions.headers['Content-Type'] = 'application/json';
      opcions.body = JSON.stringify(cos);
    }

    let resposta;
    try {
      resposta = await fetch(CONFIG.api + cami, opcions);
    } catch (e) {
      // Sense xarxa, servidor apagat o temps esgotat: totes arriben aquí.
      throw new ErrorApi("No s'ha pogut connectar amb el servidor.", 0, e);
    }

    let dades = {};
    try {
      dades = await resposta.json();
    } catch (_) { /* 204 o resposta buida */ }

    if (!resposta.ok) {
      throw new ErrorApi(dades.error || 'Error del servidor.', resposta.status);
    }
    return dades;
  },

  get(cami) { return this.crida('GET', cami); },
  post(cami, cos) { return this.crida('POST', cami, cos ?? {}); },
  put(cami, cos) { return this.crida('PUT', cami, cos); },
  patch(cami, cos) { return this.crida('PATCH', cami, cos); },
  delete(cami) { return this.crida('DELETE', cami); },
};
