import assert from "node:assert/strict";
import { test } from "node:test";
import { foldText, matchesQuery } from "./text.ts";

test("foldText: lowercase, trim and strip diacritics", () => {
  assert.equal(foldText("  Jalapeño "), "jalapeno");
  assert.equal(foldText("EL CARDENAL"), "el cardenal");
  assert.equal(foldText("Tacos à la Mérida"), "tacos a la merida");
});

test("matchesQuery: case- and diacritic-insensitive", () => {
  assert.equal(matchesQuery("Café de Jalapeño", "cafe jalapeno"), true);
  assert.equal(matchesQuery("El Cardenal", "cardenal"), true);
});

test("matchesQuery: every word must be present", () => {
  assert.equal(matchesQuery("Mercado de Coyoacán", "coyoacan mercado"), true);
  assert.equal(matchesQuery("Mercado de Coyoacán", "coyoacan xochimilco"), false);
});

test("matchesQuery: empty needle matches", () => {
  assert.equal(matchesQuery("Cualquier cosa", ""), true);
});
