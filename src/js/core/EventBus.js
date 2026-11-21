// @ts-check
/**
 * EventBus.js: Bus de eventos tipado (Observer / Pub-Sub) sin dependencias del DOM.
 * Desacopla el motor gráfico, los modelos de estado y los paneles de UI evitando importaciones circulares.
 */

/**
 * Bus de eventos Pub-Sub ligero para desacoplar módulos sin depender del DOM.
 */
export class EventBus {
  /** @type {Map<string, Set<Function>>} */
  #listeners = new Map();

  /**
   * Suscribe un callback a un tópico de evento.
   * @param {string} topic
   * @param {(payload?: any) => void} callback
   * @returns {() => void} Función para cancelar la suscripción.
   */
  on(topic, callback) {
    if (!this.#listeners.has(topic)) {
      this.#listeners.set(topic, new Set());
    }
    this.#listeners.get(topic)?.add(callback);
    return () => this.off(topic, callback);
  }

  /**
   * Elimina un callback previamente suscripto a un tópico.
   * @param {string} topic
   * @param {(payload?: any) => void} callback
   */
  off(topic, callback) {
    this.#listeners.get(topic)?.delete(callback);
  }

  /**
   * Emite sincrónicamente un evento a todos los suscriptores del tópico.
   * @param {string} topic
   * @param {any} [payload]
   */
  emit(topic, payload) {
    const subs = this.#listeners.get(topic);
    if (!subs) return;
    for (const fn of subs) {
      fn(payload);
    }
  }
}

export const appBus = new EventBus();
