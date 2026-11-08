"""Classe les cartes WikiMasters selon des règles et peut les mettre en favoris.

Installation : pip install playwright && playwright install chromium
Lancement : python wiki_masters_tri.py

Le navigateur reste ouvert avec un profil local afin de conserver la connexion.
Au premier lancement, connectez-vous à WikiMasters dans la fenêtre qui s'ouvre.
"""

from __future__ import annotations

import asyncio
import re
import unicodedata
from dataclasses import dataclass, field
from pathlib import Path

from playwright.async_api import Locator, Page, async_playwright


# Configuration
PROFILE_DIR = Path(__file__).with_name("wiki_masters_profile")
PAUSE_BETWEEN_CARDS_MS = 500
DEFAULT_RULES = """Foot : footballeur, footballeuse, football
Acteurs : acteur
Actrices : actrice
F1 : formule 1, formule 2, formule 3
Voitures : Ludospace, modèle d'automobile, modèle de voiture
Films : film
Politique : politique
Chanteur : chanteur
Chanteuse : chanteuse
Ville/Communes FR : Commune française
Peugeot : Peugeot
Citroën : Citroën
Renault : Renault, Alpine"""


@dataclass(frozen=True)
class Rule:
    label: str
    keywords: tuple[str, ...]


@dataclass
class Stats:
    matches: int = 0
    tagged: int = 0
    favorites: int = 0
    missing_tags: set[str] = field(default_factory=set)


def normalize(value: str | None) -> str:
    """Lowercase text, remove accents and punctuation, and collapse spaces."""
    value = unicodedata.normalize("NFD", value or "")
    value = "".join(char for char in value if unicodedata.category(char) != "Mn")
    value = re.sub(r"[^\w\s]", " ", value, flags=re.UNICODE)
    return re.sub(r"\s+", " ", value).strip().lower()


def parse_rules(text: str) -> list[Rule]:
    rules: list[Rule] = []
    for line in text.splitlines():
        label, separator, values = line.partition(":")
        keywords = tuple(filter(None, (normalize(item) for item in values.split(","))))
        if separator and label.strip() and keywords:
            rules.append(Rule(label.strip(), keywords))
    return rules


def matching_labels(rules: list[Rule], title: str, description: str) -> list[str]:
    text = f" {normalize(f'{title} {description}')} "
    return [
        rule.label
        for rule in rules
        if any(f" {keyword} " in text for keyword in rule.keywords)
    ]


def read_options() -> tuple[list[Rule], bool, bool, bool]:
    print("WikiMasters — tri automatique des cartes")
    print("Règles : une par ligne, au format Étiquette : mot1, mot2.")
    print("Appuyez sur Entrée pour utiliser les règles par défaut.\n")
    custom = input("Coller des règles personnalisées ? (o/N) ").strip().lower() == "o"
    if custom:
        print("Collez les règles, puis terminez avec une ligne contenant uniquement .")
        lines: list[str] = []
        while (line := input()) != ".":
            lines.append(line)
        rules = parse_rules("\n".join(lines))
    else:
        rules = parse_rules(DEFAULT_RULES)

    dry_run = input("Simulation seulement, sans modification ? (O/n) ").strip().lower() != "n"
    favorite = input("Mettre en favori les cartes avec une étiquette ? (O/n) ").strip().lower() != "n"
    all_pages = input("Parcourir les pages suivantes ? (o/N) ").strip().lower() == "o"
    return rules, dry_run, favorite, all_pages


def log(message: str) -> None:
    print(f"[WM-tri] {message}")


async def wait_for_locator(locator: Locator, timeout_ms: int = 4_000) -> bool:
    try:
        await locator.wait_for(state="visible", timeout=timeout_ms)
        return True
    except Exception:
        return False


async def card_text(card: Locator, selector: str) -> str:
    locator = card.locator(selector).first
    return (await locator.inner_text()).strip() if await locator.count() else ""


async def get_cards(page: Page) -> list[Locator]:
    cards = page.locator("div.relative.isolate.group").filter(has=page.locator("h3"))
    # Exclure toute carte éventuelle incluse dans la fenêtre de détail.
    result: list[Locator] = []
    for index in range(await cards.count()):
        card = cards.nth(index)
        if not await card.locator(".card-frame").count() and not await card.evaluate(
            "element => Boolean(element.closest('.card-frame'))"
        ):
            result.append(card)
    return result


async def find_card(page: Page, title: str) -> Locator | None:
    for card in await get_cards(page):
        if await card_text(card, "h3") == title:
            return card
    return None


async def modal_has_tag(page: Page, label: str) -> bool:
    frame = page.locator(".card-frame")
    heading = frame.locator("p").filter(has_text=re.compile(r"^\s*Étiquettes\s*$", re.I)).first
    if not await heading.count():
        return False
    tag_box = heading.locator("xpath=following-sibling::*[1]")
    wanted = normalize(label)
    for index in range(await tag_box.locator("span").count()):
        tag_name = normalize(await tag_box.locator("span").nth(index).inner_text())
        if tag_name == wanted or tag_name.startswith(f"{wanted} "):
            return True
    return False


async def add_tag(page: Page, label: str) -> bool:
    input_box = page.locator('.card-frame input[placeholder^="Ajouter une"]').first
    if not await input_box.count():
        return False
    await input_box.fill(label)
    option = page.locator('[role="listbox"] [role="option"]').filter(
        has_text=re.compile(rf"^\s*{re.escape(label)}\s*$", re.I)
    ).first
    if not await wait_for_locator(option, 2_000):
        return False
    button = option.locator("button").first
    await (button if await button.count() else option).click()
    try:
        await page.wait_for_function(
            "([label]) => { const n = s => (s || '').normalize('NFD').replace(/[\\u0300-\\u036f]/g, '').toLowerCase().trim(); "
            "return [...document.querySelectorAll('.card-frame p')].some(p => n(p.textContent) === 'etiquettes' && "
            "[...p.nextElementSibling.querySelectorAll('span')].some(s => n(s.textContent) === n(label))); }",
            arg=[label],
            timeout=3_000,
        )
        return True
    except Exception:
        return False


async def close_modal(page: Page) -> None:
    close_button = page.locator('.card-frame button[aria-label="Fermer"]').first
    if await close_button.count():
        await close_button.click()
    else:
        await page.keyboard.press("Escape")
    try:
        await page.locator('.card-frame input[placeholder^="Ajouter une"]').wait_for(
            state="detached", timeout=3_000
        )
    except Exception:
        pass


async def process_card(
    page: Page,
    title: str,
    description: str,
    already_tagged: bool,
    rules: list[Rule],
    dry_run: bool,
    favorite_tagged: bool,
    stats: Stats,
) -> None:
    labels = matching_labels(rules, title, description)
    has_tag = already_tagged

    if labels and dry_run:
        log(f"[simulation] {title} → {', '.join(labels)}")
        stats.matches += 1
        has_tag = True
    elif labels:
        card = await find_card(page, title)
        if card is None:
            return
        target = card.locator('[class*="cursor-pointer"]:not(button)').first
        await (target if await target.count() else card).click()
        input_box = page.locator('.card-frame input[placeholder^="Ajouter une"]').first
        if not await wait_for_locator(input_box):
            log(f"Fenêtre non ouverte : {title}")
            return

        for label in labels:
            if await modal_has_tag(page, label):
                has_tag = True
            elif await add_tag(page, label):
                stats.tagged += 1
                has_tag = True
                log(f"{title} → {label}")
            else:
                stats.missing_tags.add(label)
        await close_modal(page)
        await page.wait_for_timeout(PAUSE_BETWEEN_CARDS_MS)

    if not favorite_tagged or not has_tag:
        return
    if dry_run:
        log(f"[simulation] favori : {title}")
        return

    card = await find_card(page, title)
    favorite = card.locator('button[aria-label^="Ajouter aux favoris"]') if card else None
    if favorite and await favorite.count():
        await favorite.click()
        stats.favorites += 1
        await page.wait_for_timeout(200)


async def process_page(
    page: Page,
    rules: list[Rule],
    dry_run: bool,
    favorite_tagged: bool,
    should_stop: asyncio.Event,
    stats: Stats,
) -> None:
    snapshot = []
    for card in await get_cards(page):
        snapshot.append(
            (
                await card_text(card, "h3"),
                await card_text(card, "p"),
                await card.locator("span.rounded-full.border").count() > 0,
            )
        )

    for title, description, tagged in snapshot:
        if should_stop.is_set():
            return
        await process_card(page, title, description, tagged, rules, dry_run, favorite_tagged, stats)


async def run() -> None:
    rules, dry_run, favorite_tagged, all_pages = read_options()
    if not rules:
        log("Aucune règle valide.")
        return

    stats = Stats()
    should_stop = asyncio.Event()

    async with async_playwright() as playwright:
        context = await playwright.chromium.launch_persistent_context(
            str(PROFILE_DIR), headless=False, viewport={"width": 1440, "height": 1000}
        )
        page = context.pages[0] if context.pages else await context.new_page()
        await page.goto("https://wiki-masters.com/", wait_until="domcontentloaded")
        print("Connectez-vous si nécessaire, puis ouvrez la collection à trier.")
        input("Quand la grille de cartes est visible, appuyez sur Entrée ici… ")

        page_number = 1
        while True:
            log(f"--- Page {page_number} ---")
            await process_page(page, rules, dry_run, favorite_tagged, should_stop, stats)
            if not all_pages:
                break

            next_button = page.get_by_role("button", name=re.compile(r"^Suivant", re.I)).first
            if not await next_button.count() or await next_button.is_disabled():
                break
            before = "|".join([await card_text(card, "h3") for card in await get_cards(page)])
            await next_button.click()
            try:
                await page.wait_for_function(
                    "before => [...document.querySelectorAll('div.relative.isolate.group h3')].map(x => x.textContent.trim()).join('|') !== before",
                    arg=before,
                    timeout=10_000,
                )
            except Exception:
                break
            await page.wait_for_timeout(800)
            page_number += 1

        if dry_run:
            log(f"Simulation terminée : {stats.matches} carte(s) correspondent.")
        else:
            log(f"Terminé : {stats.tagged} étiquette(s) posée(s), {stats.favorites} favori(s).")
        if stats.missing_tags:
            log("Étiquettes introuvables (à créer dans « Gérer les étiquettes ») : " + ", ".join(sorted(stats.missing_tags)))
        await context.close()


if __name__ == "__main__":
    try:
        asyncio.run(run())
    except KeyboardInterrupt:
        print("\nArrêt demandé.")
