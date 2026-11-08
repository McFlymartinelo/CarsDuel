// ==UserScript==
// @name         WikiMasters - Tri automatique des cartes
// @namespace    local
// @version      0.3
// @description  Pose des étiquettes sur les cartes selon des règles, puis les met en favoris
// @match        https://wiki-masters.com/*
// @match        https://*.wiki-masters.com/*
// @grant        GM_getValue
// @grant        GM_setValue
// ==/UserScript==

(() => {
  'use strict';

  // Configuration
  const CONFIG = {
    storageKey: 'wm_rules_v2',
    pauseBetweenCards: 500,
    pauseAfterFavorite: 200,
    pageLoadTimeout: 10_000,
    defaultRules: [
      'Foot : footballeur, footballeuse, football',
      'Acteurs : acteur',
      'Actrices : actrice',
      'F1 : formule 1, formule 2, formule 3',
      "Voitures : Ludospace, modèle d'automobile, modèle de voiture",
      'Films : film',
      'Politique : politique',
      'Chanteur : chanteur',
      'Chanteuse : chanteuse',
      'Ville/Communes FR : Commune française',
      'Peugeot : Peugeot',
      'Citroën : Citroën',
      'Renault : Renault, Alpine',
    ].join('\n'),
  };

  const SELECTORS = {
    card: 'div.relative.isolate.group',
    modal: '.card-frame',
    tagInput: '.card-frame input[placeholder^="Ajouter une"]',
    tagOption: '[role="listbox"] [role="option"]',
    favoriteButton: 'button[aria-label^="Ajouter aux favoris"]',
    closeButton: '.card-frame button[aria-label="Fermer"]',
  };

  const state = { stopRequested: false, running: false };
  let ui = {};

  // Outils communs
  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  function normalize(value) {
    return (value || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^\p{L}\p{N}\s]/gu, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase();
  }

  async function waitFor(getValue, timeout = 4_000, interval = 100) {
    const startedAt = Date.now();
    while (Date.now() - startedAt < timeout) {
      const value = getValue();
      if (value) return value;
      await sleep(interval);
    }
    return null;
  }

  function setInputValue(input, value) {
    // Utiliser le setter natif permet de déclencher correctement React.
    const setter = Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      'value',
    ).set;
    setter.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  }

  function log(message) {
    console.log('[WM-tri]', message);
    if (!ui.log) return;
    ui.log.textContent += `${message}\n`;
    ui.log.scrollTop = ui.log.scrollHeight;
  }

  // Règles de tri
  function parseRules(text) {
    return text
      .split('\n')
      .map((line) => {
        const separator = line.indexOf(':');
        if (separator < 1) return null;

        const label = line.slice(0, separator).trim();
        const keywords = line
          .slice(separator + 1)
          .split(',')
          .map(normalize)
          .filter(Boolean);

        return label && keywords.length ? { label, keywords } : null;
      })
      .filter(Boolean);
  }

  function matchingLabels(rules, title, description) {
    const text = ` ${normalize(`${title} ${description}`)} `;
    return rules
      .filter((rule) =>
        rule.keywords.some((keyword) => text.includes(` ${keyword} `)),
      )
      .map((rule) => rule.label);
  }

  // Cartes et navigation
  function getCards() {
    return Array.from(document.querySelectorAll(SELECTORS.card)).filter(
      (card) => card.querySelector('h3') && !card.closest(SELECTORS.modal),
    );
  }

  const getCardTitle = (card) => (card.querySelector('h3')?.textContent || '').trim();
  const getCardDescription = (card) => (card.querySelector('p')?.textContent || '').trim();
  const cardHasTag = (card) => Boolean(card.querySelector('span.rounded-full.border'));

  function findCard(title) {
    return getCards().find((card) => getCardTitle(card) === title);
  }

  function pageSignature() {
    return getCards().map(getCardTitle).join('|');
  }

  function openCard(card) {
    const target = card.querySelector('[class*="cursor-pointer"]:not(button)') || card;
    target.click();
  }

  function addToFavorites(card) {
    const button = card.querySelector(SELECTORS.favoriteButton);
    if (!button) return false;
    button.click();
    return true;
  }

  function findNextButton() {
    return Array.from(document.querySelectorAll('button')).find((button) =>
      /^Suivant/i.test(button.textContent.trim()),
    );
  }

  // Étiquettes de la fenêtre de détail
  const getTagInput = () => document.querySelector(SELECTORS.tagInput);

  function getModalTagNames(input) {
    const modal = input.closest(SELECTORS.modal);
    const heading = Array.from(modal.querySelectorAll('p')).find(
      (element) => normalize(element.textContent) === 'etiquettes',
    );
    const tagContainer = heading?.nextElementSibling;
    return tagContainer
      ? Array.from(tagContainer.querySelectorAll('span')).map((tag) => normalize(tag.textContent))
      : [];
  }

  function modalHasTag(label) {
    const input = getTagInput();
    if (!input) return false;
    const normalizedLabel = normalize(label);
    return getModalTagNames(input).some(
      (tag) => tag === normalizedLabel || tag.startsWith(`${normalizedLabel} `),
    );
  }

  async function addTag(label) {
    const input = getTagInput();
    if (!input) return false;

    input.focus();
    setInputValue(input, label);

    const option = await waitFor(
      () =>
        Array.from(document.querySelectorAll(SELECTORS.tagOption)).find(
          (item) => normalize(item.textContent) === normalize(label),
        ),
      2_000,
    );
    if (!option) return false;

    (option.querySelector('button') || option).click();
    return Boolean(await waitFor(() => modalHasTag(label), 3_000));
  }

  async function closeModal() {
    const button = document.querySelector(SELECTORS.closeButton);
    if (button) {
      button.click();
    } else {
      document.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }),
      );
    }
    await waitFor(() => !getTagInput(), 3_000);
  }

  // Traitement des cartes
  function createStats() {
    return { matches: 0, tagged: 0, favorites: 0, missingTags: new Set() };
  }

  async function processCard(item, rules, options, stats) {
    if (state.stopRequested) return;

    const labels = matchingLabels(rules, item.title, item.description);
    let hasTag = item.tagged;

    if (labels.length && options.dryRun) {
      log(`[simulation] ${item.title} → ${labels.join(', ')}`);
      stats.matches += 1;
      hasTag = true;
    } else if (labels.length) {
      const card = findCard(item.title);
      if (!card) return;

      openCard(card);
      if (!(await waitFor(getTagInput, 4_000))) {
        log(`Fenêtre non ouverte : ${item.title}`);
        return;
      }

      for (const label of labels) {
        if (modalHasTag(label)) {
          hasTag = true;
          continue;
        }
        if (await addTag(label)) {
          stats.tagged += 1;
          hasTag = true;
          log(`${item.title} → ${label}`);
        } else {
          stats.missingTags.add(label);
        }
      }

      await closeModal();
      await sleep(CONFIG.pauseBetweenCards);
    }

    if (!options.favoriteTagged || !hasTag) return;
    if (options.dryRun) {
      log(`[simulation] favori : ${item.title}`);
      return;
    }

    const card = findCard(item.title);
    if (card && addToFavorites(card)) {
      stats.favorites += 1;
      await sleep(CONFIG.pauseAfterFavorite);
    }
  }

  async function processPage(rules, options, stats) {
    const snapshot = getCards().map((card) => ({
      title: getCardTitle(card),
      description: getCardDescription(card),
      tagged: cardHasTag(card),
    }));

    for (const item of snapshot) {
      if (state.stopRequested) return;
      await processCard(item, rules, options, stats);
    }
  }

  function reportResults(options, stats) {
    log(
      options.dryRun
        ? `Simulation terminée : ${stats.matches} carte(s) correspondent.`
        : `Terminé : ${stats.tagged} étiquette(s) posée(s), ${stats.favorites} favori(s).`,
    );
    if (stats.missingTags.size) {
      log(
        `Étiquettes introuvables (à créer dans « Gérer les étiquettes ») : ${[
          ...stats.missingTags,
        ].join(', ')}`,
      );
    }
    if (state.stopRequested) log('Arrêté.');
  }

  async function run() {
    if (state.running) return;
    state.running = true;
    state.stopRequested = false;
    ui.log.textContent = '';

    try {
      const rules = parseRules(ui.rules.value);
      if (!rules.length) {
        log('Aucune règle valide.');
        return;
      }

      const options = {
        dryRun: ui.dryRun.checked,
        favoriteTagged: ui.favoriteTagged.checked,
        allPages: ui.allPages.checked,
      };
      const stats = createStats();
      let page = 1;

      while (true) {
        log(`--- Page ${page} ---`);
        await processPage(rules, options, stats);
        if (state.stopRequested || !options.allPages) break;

        const nextButton = findNextButton();
        if (!nextButton || nextButton.disabled) break;

        const previousSignature = pageSignature();
        nextButton.click();
        const pageChanged = await waitFor(
          () => pageSignature() !== previousSignature,
          CONFIG.pageLoadTimeout,
        );
        if (!pageChanged) break;

        await sleep(800);
        page += 1;
      }

      reportResults(options, stats);
    } catch (error) {
      console.error('[WM-tri] Erreur pendant le tri', error);
      log(`Erreur pendant le tri : ${error.message || error}`);
    } finally {
      state.running = false;
    }
  }

  // Panneau de contrôle
  function buildPanel() {
    if (document.getElementById('wm-tri-panel')) return;

    const panel = document.createElement('div');
    panel.id = 'wm-tri-panel';
    panel.style.cssText = `
      position: fixed; bottom: 16px; right: 16px; z-index: 99999;
      background: #fff; color: #222; border: 1px solid #888; border-radius: 8px;
      padding: 12px; width: 320px; font: 13px sans-serif;
      box-shadow: 0 2px 10px rgba(0,0,0,.4);`;
    panel.innerHTML = `
      <strong>Tri de la collection</strong>
      <p style="margin:6px 0 4px">Une règle par ligne :<br><code>Étiquette : mot1, mot2</code><br>
      <small>Les mots sont cherchés dans le titre et la description de la carte.</small></p>
      <textarea id="wm-rules" rows="6" style="width:100%;box-sizing:border-box"></textarea>
      <label style="display:block;margin-top:6px"><input type="checkbox" id="wm-dry" checked> Simulation (ne modifie rien)</label>
      <label style="display:block"><input type="checkbox" id="wm-fav" checked> Mettre en favori les cartes étiquetées</label>
      <label style="display:block"><input type="checkbox" id="wm-pages"> Continuer sur les pages suivantes</label>
      <div style="margin-top:8px;display:flex;gap:6px;flex-wrap:wrap">
        <button id="wm-save">Enregistrer</button>
        <button id="wm-run">Lancer</button>
        <button id="wm-stop">Arrêter</button>
        <button id="wm-close">Fermer</button>
      </div>
      <pre id="wm-log" style="margin:8px 0 0;max-height:140px;overflow:auto;background:#f4f4f4;padding:6px;white-space:pre-wrap;font-size:11px"></pre>`;
    document.body.appendChild(panel);

    ui = {
      rules: panel.querySelector('#wm-rules'),
      dryRun: panel.querySelector('#wm-dry'),
      favoriteTagged: panel.querySelector('#wm-fav'),
      allPages: panel.querySelector('#wm-pages'),
      log: panel.querySelector('#wm-log'),
    };
    ui.rules.value = GM_getValue(CONFIG.storageKey, CONFIG.defaultRules);

    panel.querySelector('#wm-save').onclick = () => {
      GM_setValue(CONFIG.storageKey, ui.rules.value);
      log('Règles enregistrées.');
    };
    panel.querySelector('#wm-run').onclick = () => {
      GM_setValue(CONFIG.storageKey, ui.rules.value);
      run();
    };
    panel.querySelector('#wm-stop').onclick = () => {
      state.stopRequested = true;
    };
    panel.querySelector('#wm-close').onclick = () => panel.remove();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', buildPanel);
  } else {
    buildPanel();
  }
})();
