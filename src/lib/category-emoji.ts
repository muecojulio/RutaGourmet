/** Category → emoji badge, so every place reads at a glance. */
const CATEGORY_EMOJI: Record<string, string> = {
  Restaurante: "🍽️",
  Café: "☕",
  "Comida rápida": "🍔",
  Bar: "🍸",
  Heladería: "🍦",
  Cervecería: "🍺",
  Pub: "🍻",
  Comedor: "🥘",
  Lugar: "📍",
};

export function categoryEmoji(category: string): string {
  return CATEGORY_EMOJI[category] ?? "📍";
}
