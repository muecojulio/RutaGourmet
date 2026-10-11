import {
  ShieldCheck,
  Smartphone,
  MapPin,
  Route,
  EyeOff,
  Trash2,
  Globe2,
  ExternalLink,
} from "lucide-react";
import type { AppTab } from "@/lib/places-store";

interface PrivacyPanelProps {
  onNavigate?: (tab: AppTab) => void;
}

export function PrivacyPanel({ onNavigate }: PrivacyPanelProps) {
  return (
    <div className="rise space-y-5 pb-6">
      <div>
        <div className="flex items-center gap-2">
          <div className="grid size-9 place-items-center rounded-xl bg-good/15 text-good">
            <ShieldCheck className="size-5" />
          </div>
          <h1 className="font-display text-2xl font-semibold leading-none tracking-tight sm:text-3xl">
            Políticas de Privacidad
          </h1>
        </div>
        <p className="mt-2 text-sm text-muted">
          RutaGourmet está diseñada bajo una estricta política de privacidad desde el primer día: tus datos te pertenecen únicamente a ti.
        </p>
      </div>

      {/* Resumen clave / Highlights */}
      <div className="grid grid-cols-2 gap-2 text-xs">
        <div className="rounded-2xl border border-line bg-surface p-3">
          <p className="font-medium text-fg">Sin cuentas</p>
          <p className="mt-0.5 text-muted">Sin correos ni contraseñas requeridas.</p>
        </div>
        <div className="rounded-2xl border border-line bg-surface p-3">
          <p className="font-medium text-fg">100% Local</p>
          <p className="mt-0.5 text-muted">Tus lugares guardados en tu teléfono.</p>
        </div>
        <div className="rounded-2xl border border-line bg-surface p-3">
          <p className="font-medium text-fg">Sin rastreadores</p>
          <p className="mt-0.5 text-muted">Cero publicidad y cero telemetría invasiva.</p>
        </div>
        <div className="rounded-2xl border border-line bg-surface p-3">
          <p className="font-medium text-fg">Datos abiertos</p>
          <p className="mt-0.5 text-muted">OpenStreetMap y enrutamiento comunitario.</p>
        </div>
      </div>

      {/* Secciones detalladas */}
      <div className="space-y-3 text-sm">
        {/* 1. Almacenamiento Local */}
        <section className="rounded-3xl border border-line bg-surface p-4">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
              <Smartphone className="size-4" />
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="font-medium text-fg">1. Almacenamiento exclusivamente en este dispositivo</h2>
              <p className="mt-1.5 text-xs text-muted leading-relaxed">
                RutaGourmet no te pide registrarte, iniciar sesión ni proporcionar tu nombre, correo o número de teléfono.
                Tus restaurantes guardados, etiquetas de favoritos, notas personales y punto de partida se guardan de forma local en tu navegador mediante <code>localStorage</code>. No viajan a ninguna base de datos privada nuestra.
              </p>
            </div>
          </div>
        </section>

        {/* 2. Ubicación y Geodatos */}
        <section className="rounded-3xl border border-line bg-surface p-4">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
              <MapPin className="size-4" />
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="font-medium text-fg">2. Uso de tu ubicación</h2>
              <p className="mt-1.5 text-xs text-muted leading-relaxed">
                El acceso al sensor de geolocalización es opcional y requiere tu consentimiento explícito. Solo se utiliza en el momento exacto para centrar el mapa, mostrar sitios cercanos ("Cerca") y calcular el tiempo estimado de llegada hacia el restaurante elegido. Tu ubicación jamás se asocia a un perfil de usuario ni se vende a intermediarios de datos.
              </p>
            </div>
          </div>
        </section>

        {/* 3. Búsqueda y Enrutamiento Comunitario */}
        <section className="rounded-3xl border border-line bg-surface p-4">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
              <Route className="size-4" />
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="font-medium text-fg">3. Búsquedas y cálculo de trayectos</h2>
              <p className="mt-1.5 text-xs text-muted leading-relaxed">
                Cuando buscas un lugar o pides una ruta (a pie, auto o bici), la solicitud viaja desde tu teléfono hacia los servicios abiertos de OpenStreetMap (motores Nominatim y Photon) y hacia el servicio de enrutamiento público OSRM. La consulta puede mantenerse brevemente en la memoria caché del servidor para responder más rápido y no saturar los servicios libres, sin identificadores personales.
              </p>
            </div>
          </div>
        </section>

        {/* 4. Cero Conectores Externos ni Publicidad */}
        <section className="rounded-3xl border border-line bg-surface p-4">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-lg bg-good/10 text-good">
              <EyeOff className="size-4" />
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="font-medium text-fg">4. Cero rastreadores y cero publicidad</h2>
              <p className="mt-1.5 text-xs text-muted leading-relaxed">
                No incluimos Google Analytics, píxeles de Meta, redes publicitarias ni librerías de seguimiento conductual. Tampoco conectamos tu sesión a Zapier, Hugging Face ni modelos externos con tus coordenadas geográficas. Creemos que una app para descubrir comida deliciosa debe ser rápida, limpia y respetuosa con tu privacidad.
              </p>
            </div>
          </div>
        </section>

        {/* 5. Control Total / Borrado */}
        <section className="rounded-3xl border border-line bg-surface p-4">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-lg bg-red-500/10 text-red-400">
              <Trash2 className="size-4" />
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="font-medium text-fg">5. Control total de tus datos</h2>
              <p className="mt-1.5 text-xs text-muted leading-relaxed">
                Tú tienes control absoluto sobre la información guardada. Si deseas eliminar todos los datos almacenados en este teléfono, puedes hacerlo en cualquier instante con un solo clic.
              </p>
              {onNavigate ? (
                <button
                  type="button"
                  onClick={() => onNavigate("qr")}
                  className="press mt-2.5 inline-flex h-9 items-center gap-1.5 rounded-full border border-line bg-surface-2 px-3 text-xs font-medium text-fg hover:border-primary/40"
                >
                  <Trash2 className="size-3 text-red-400" />
                  <span>Ir al botón de borrar en la pestaña de QR</span>
                </button>
              ) : null}
            </div>
          </div>
        </section>

        {/* 6. Créditos y Licencias */}
        <section className="rounded-3xl border border-line bg-surface p-4">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-lg bg-accent/15 text-accent">
              <Globe2 className="size-4" />
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="font-medium text-fg">6. Licencias de mapas y agradecimientos</h2>
              <p className="mt-1.5 text-xs text-muted leading-relaxed">
                Mapas y datos de coordenadas geográficas ©{" "}
                <a
                  className="text-primary hover:underline inline-flex items-center gap-0.5"
                  href="https://www.openstreetmap.org/copyright"
                  target="_blank"
                  rel="noreferrer"
                >
                  OpenStreetMap y sus colaboradores
                  <ExternalLink className="size-3" />
                </a>
                . Diseño de teselas cartográficas por CARTO y OpenStreetMap.
              </p>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
