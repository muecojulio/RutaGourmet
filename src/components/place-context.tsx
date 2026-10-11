import { useEffect, useState } from "react";
import { BookOpenText, ExternalLink } from "lucide-react";
import { wikiContext, type WikiContext as WikiContextData } from "@/lib/conditions";
import { Collapse } from "@/components/ui/collapse";

/**
 * “Historia y cultura cerca” — notable Wikipedia articles around a saved
 * place (geosearch, keyless public API). A collapsible inside the place card;
 * loaded only when opened around the card's coordinates.
 */
export function PlaceContext({ lat, lon }: { lat: number; lon: number }) {
  const [context, setContext] = useState<WikiContextData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    setContext(null);
    setError(null);
    void wikiContext({ lat, lon }).then((result) => {
      if (!live) return;
      if (result.ok) {
        setContext(result.data);
        if (result.data.hits.length === 0) setError("Sin historias cerca por ahora.");
      } else {
        setError(result.error);
      }
    });
    return () => {
      live = false;
    };
  }, [lat, lon]);

  return (
    <Collapse
      title="Historia y cultura cerca"
      subtitle="Lo que Wikipedia sabe de este rumbo"
      icon={<BookOpenText className="size-4" />}
    >
      {context ? (
        context.hits.length > 0 ? (
          <ul className="space-y-3">
            {context.hits.map((hit) => (
              <li key={hit.title}>
                <p className="font-medium text-fg">{hit.title}</p>
                <p className="mt-0.5 text-xs leading-relaxed">{hit.extract}</p>
                <a
                  href={hit.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="press mt-1 inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                >
                  Leer en Wikipedia (sitio externo)
                  <ExternalLink className="size-3" aria-hidden="true" />
                </a>
              </li>
            ))}
            <li className="border-t border-line pt-2 text-[11px] text-muted/80">
              Datos de Wikipedia, CC BY-SA.
            </li>
          </ul>
        ) : (
          <p>{error}</p>
        )
      ) : error ? (
        <p>{error}</p>
      ) : (
        <p className="shimmer rounded-lg py-1 text-transparent">Buscando historias cerca…</p>
      )}
    </Collapse>
  );
}
