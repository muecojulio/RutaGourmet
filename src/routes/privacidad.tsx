import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, ShieldCheck } from "lucide-react";
import { Collapse } from "@/components/ui/collapse";

export const Route = createFileRoute("/privacidad")({
  component: PrivacyPolicyPage,
});

const UPDATED = "11 de octubre de 2026";

const SECTIONS: Array<{ title: string; body: React.ReactNode }> = [
  {
    title: "1. Responsable del tratamiento",
    body: (
      <>
        <p>
          RutaGourmet es una aplicación web progresiva personal y sin ánimo de lucro, publicada como
          proyecto abierto en GitHub (muecojulio/RutaGourmet). A efectos de esta política, el
          responsable es quien opera la instancia de la aplicación que visitas (normalmente, el
          despliegue propio en Vercel con base de datos Neon).
        </p>
        <p>Contacto: abre un issue en el repositorio público del proyecto.</p>
      </>
    ),
  },
  {
    title: "2. Datos que se tratan y dónde viven",
    body: (
      <>
        <p>
          <strong className="text-fg">Tus lugares, favoritos, notas y punto de partida</strong> se
          guardan únicamente en el almacenamiento local de tu navegador (<code>localStorage</code>,
          clave <code>rutagourmet-v1</code>). No se envían a ningún servidor de la aplicación.
        </p>
        <p>
          <strong className="text-fg">Ubicación del dispositivo:</strong> se solicita solo cuando
          pulsas «usar mi ubicación» o al abrir la app si aún no tienes punto de partida. No se
          almacena de forma persistente más allá de tu último punto de partida local, no se asocia a
          tu identidad y no se comparte con terceros con fines comerciales.
        </p>
        <p>
          <strong className="text-fg">Datos técnicos efímeros:</strong> las peticiones al servidor
          de la aplicación pueden quedar en una caché en memoria sin identificadores personales,
          para aliviar a los servicios públicos y responder más rápido. Se expiran por tiempo
          (minutos-horas) y por capacidad.
        </p>
      </>
    ),
  },
  {
    title: "3. Servicios públicos de terceros (sin llaves ni registro)",
    body: (
      <>
        <ul className="list-disc space-y-1.5 pl-5">
          <li>
            <strong className="text-fg">OpenStreetMap</strong> — Nominatim (geocodificación) y
            Overpass (lugares cercanos). Datos © colaboradores de OpenStreetMap, ODbL.
          </li>
          <li>
            <strong className="text-fg">Photon</strong> (por Komoot) — búsqueda de lugares.
          </li>
          <li>
            <strong className="text-fg">OSRM</strong> (demo router.project-osrm.org y espejos
            comunitarios) — cálculo de rutas a pie, bici y auto.
          </li>
          <li>
            <strong className="text-fg">CARTO</strong> — teselas del mapa base.
          </li>
          <li>
            <strong className="text-fg">Open-Meteo</strong> — clima del momento (sin clave).
          </li>
          <li>
            <strong className="text-fg">Wikipedia</strong> (geobúsqueda en español) — contexto
            histórico de cada rumbo; contenidos CC BY-SA.
          </li>
        </ul>
        <p>
          Estas consultas incluyen las coordenadas o el texto de tu búsqueda, porque es lo único
          necesario para responder. Cada servicio aplica su propia política de privacidad.
        </p>
      </>
    ),
  },
  {
    title: "4. Finalidad y base jurídica",
    body: (
      <p>
        La finalidad es exclusivamente prestar la funcionalidad que pides: guardar lugares, calcular
        rutas, mostrar el clima y contexto cercano. No hay marketing, ni perfiles, ni decisiones
        automatizadas. Cuando se aplica el RGPD, la base es tu <em>consentimiento</em> (art. 6.1.a)
        para la geolocalización y el <em>interés legítimo</em> (art. 6.1.f) del funcionamiento
        técnico; bajo la LFPDPPP mexicana, el tratamiento se restringe a lo previsto en la finalidad
        que aquí se informa.
      </p>
    ),
  },
  {
    title: "5. Conservación",
    body: (
      <p>
        Los datos locales permanecen hasta que los borres (pestaña Descargar QR → «Borrar datos de
        este teléfono») o limpies el almacenamiento del navegador. Las cachés del servidor expiran
        automáticamente en minutos u horas. Las tablas de autenticación del despliegue (si estuviera
        activado el inicio de sesión) se conservan mientras exista la sesión y se eliminan con ella.
      </p>
    ),
  },
  {
    title: "6. Tus derechos",
    body: (
      <p>
        Puedes ejercer acceso, rectificación, cancelación/oposición y portabilidad — y, bajo el
        RGPD, la limitación del tratamiento — directamente desde la propia app: borrar los datos
        locales lo elimina todo de inmediato; desactivar el permiso de ubicación en tu sistema
        operativo detiene el acceso al sensor. Para cualquier otro asunto, escribe por el canal de
        contacto del repositorio.
      </p>
    ),
  },
  {
    title: "7. Menores",
    body: (
      <p>
        RutaGourmet no dirige sus servicios a menores de 14 años y no recaba datos personales de
        forma activa, por lo que no puede distinguirlos. Si eres responsable de un menor y quieres
        eliminar cualquier rastro local, basta con borrar los datos del dispositivo.
      </p>
    ),
  },
  {
    title: "8. Seguridad",
    body: (
      <p>
        La aplicación aplica: transporte cifrado (HTTPS/HSTS cuando el despliegue lo sirve),
        cabeceras <code>X-Content-Type-Options</code>, <code>Referrer-Policy</code> y una{" "}
        <code>Permissions-Policy</code> restrictiva; salida del servidor restringida por lista de
        permitidos (protección frente a SSRF); validación estricta de entradas con Zod; límites de
        tasa por proceso; y cookies de sesión firmadas por Better Auth con <code>__Host-</code>
        cuando el inicio de sesión está activo.
      </p>
    ),
  },
  {
    title: "9. Cambios en esta política",
    body: (
      <p>
        Cualquier cambio se publicará en esta misma página con una nueva fecha de actualización. Al
        ser un proyecto abierto, también puedes consultar el historial de cambios en el repositorio.
      </p>
    ),
  },
];

function PrivacyPolicyPage() {
  return (
    <main className="mx-auto min-h-dvh w-full max-w-3xl px-4 py-8">
      <div className="backdrop-glow" aria-hidden="true" />
      <Link
        to="/"
        className="press inline-flex h-10 items-center gap-2 rounded-full px-3 text-sm font-medium text-muted hover:text-fg"
      >
        <ArrowLeft className="size-4" aria-hidden="true" />
        Volver a la app
      </Link>

      <header className="mt-4 flex items-start gap-3">
        <div className="grid size-12 shrink-0 place-items-center rounded-2xl bg-good/15 text-good">
          <ShieldCheck className="size-6" aria-hidden="true" />
        </div>
        <div>
          <h1 className="font-display text-3xl leading-tight sm:text-4xl">
            Política de <span className="text-primary italic">Privacidad</span>
          </h1>
          <p className="mt-1 text-sm text-muted">RutaGourmet · Última actualización: {UPDATED}</p>
        </div>
      </header>

      <div className="mt-6 rounded-3xl border border-good/30 bg-good/10 p-4 text-sm">
        <p className="font-medium text-fg">En una línea</p>
        <p className="mt-1 text-muted">
          Todo lo que guardas vive en tu teléfono; las búsquedas van a servicios públicos sin
          cuentas; puedes borrarlo todo con un toque.
        </p>
      </div>

      <div className="mt-6 space-y-3">
        {SECTIONS.map((section, index) => (
          <Collapse
            key={section.title}
            title={section.title}
            defaultOpen={index === 0}
            className="text-left"
          >
            <div className="space-y-2 [&_a]:text-primary [&_a:hover]:underline [&_code]:rounded [&_code]:bg-surface-2 [&_code]:px-1 [&_p]:leading-relaxed">
              {section.body}
            </div>
          </Collapse>
        ))}
      </div>

      <footer className="mt-8 border-t border-line pt-4 text-xs text-muted">
        Hecho con cariño por la comunidad: OpenStreetMap, Open-Meteo, Wikipedia, OSRM y CARTO hacen
        posible esta app sin llaves ni registros.
      </footer>
    </main>
  );
}
