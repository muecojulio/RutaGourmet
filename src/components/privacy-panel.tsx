import {
  ShieldCheck,
  Smartphone,
  MapPin,
  Route,
  EyeOff,
  Trash2,
  Globe2,
  ExternalLink,
  CloudSun,
  BookOpenText,
  FileText,
} from "lucide-react";
import { Link } from "@tanstack/react-router";
import type { AppTab } from "@/lib/places-store";
import { Collapse } from "@/components/ui/collapse";
import { Button } from "@/components/ui/button";

interface PrivacyPanelProps {
  onNavigate?: (tab: AppTab) => void;
}

/**
 * The in-app privacy summary. The complete legal policy lives at /privacidad;
 * this panel keeps the friendly, glanceable version and links there.
 */
export function PrivacyPanel({ onNavigate }: PrivacyPanelProps) {
  return (
    <div className="rise space-y-5 pb-6">
      <div>
        <div className="flex items-center gap-2">
          <div className="grid size-9 place-items-center rounded-xl bg-good/15 text-good">
            <ShieldCheck className="size-5" aria-hidden="true" />
          </div>
          <h1 className="font-display text-2xl font-semibold leading-none tracking-tight sm:text-3xl">
            Políticas de Privacidad
          </h1>
        </div>
        <p className="mt-2 text-sm text-muted">
          RutaGourmet está diseñada bajo una estricta política de privacidad desde el primer día:
          tus datos te pertenecen únicamente a ti.
        </p>
      </div>

      {/* Resumen clave */}
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
          <p className="mt-0.5 text-muted">OpenStreetMap, clima e historia públicos.</p>
        </div>
      </div>

      {/* Secciones detalladas — acordeones animados */}
      <div className="space-y-3 text-sm">
        <Collapse
          title="1. Almacenamiento exclusivamente en este dispositivo"
          subtitle="Sin registro, sin servidor propio para tus lugares"
          icon={<Smartphone className="size-4" />}
          defaultOpen
        >
          RutaGourmet no te pide registrarte, iniciar sesión ni proporcionar tu nombre, correo o
          número de teléfono. Tus restaurantes guardados, etiquetas de favoritos, notas personales y
          punto de partida se guardan de forma local en tu navegador mediante{" "}
          <code>localStorage</code>. No viajan a ninguna base de datos privada nuestra.
        </Collapse>

        <Collapse
          title="2. Uso de tu ubicación"
          subtitle="Opcional, con tu consentimiento explícito"
          icon={<MapPin className="size-4" />}
        >
          El acceso al sensor de geolocalización es opcional y requiere tu consentimiento explícito.
          Solo se utiliza en el momento exacto para centrar el mapa, mostrar sitios cercanos
          («Cerca»), consultar el clima del momento y calcular el tiempo estimado de llegada hacia
          el restaurante elegido. Tu ubicación jamás se asocia a un perfil de usuario ni se vende a
          intermediarios de datos.
        </Collapse>

        <Collapse
          title="3. Búsquedas, clima e información pública"
          subtitle="Servicios abiertos, sin llaves ni registros"
          icon={<Route className="size-4" />}
        >
          <span className="block">
            Cuando buscas un lugar o pides una ruta (a pie, auto o bici), la solicitud viaja hacia
            los servicios abiertos de OpenStreetMap (motores Nominatim y Photon) y hacia el servicio
            de enrutamiento público OSRM.
          </span>
          <span className="mt-2 flex items-start gap-2">
            <CloudSun className="mt-0.5 size-4 shrink-0 text-accent" aria-hidden="true" />
            El clima del momento se consulta a <strong className="text-fg">Open-Meteo</strong>, un
            servicio abierto sin registro.
          </span>
          <span className="mt-2 flex items-start gap-2">
            <BookOpenText className="mt-0.5 size-4 shrink-0 text-accent" aria-hidden="true" />
            El contexto histórico de cada rumbo viene de{" "}
            <strong className="text-fg">Wikipedia</strong> (geobúsqueda pública, contenidos CC
            BY-SA).
          </span>
          <span className="mt-2 block">
            Las respuestas pueden mantenerse brevemente en la memoria caché del servidor para
            responder más rápido y no saturar los servicios libres, sin identificadores personales.
          </span>
        </Collapse>

        <Collapse
          title="4. Cero rastreadores y cero publicidad"
          subtitle="Ni analíticas, ni píxeles, ni perfiles"
          icon={<EyeOff className="size-4" />}
        >
          No incluimos Google Analytics, píxeles de Meta, redes publicitarias ni librerías de
          seguimiento conductual. Tampoco conectamos tu sesión a modelos externos con tus
          coordenadas geográficas. Creemos que una app para descubrir comida deliciosa debe ser
          rápida, limpia y respetuosa con tu privacidad.
        </Collapse>

        <Collapse
          title="5. Control total de tus datos"
          subtitle="Borra todo con un toque, sin explicaciones"
          icon={<Trash2 className="size-4" />}
        >
          Tú tienes control absoluto sobre la información guardada. Si deseas eliminar todos los
          datos almacenados en este teléfono, puedes hacerlo en cualquier instante con un solo
          toque.
          {onNavigate ? (
            <Button
              variant="surface"
              size="sm"
              className="mt-3"
              leading={<Trash2 className="size-3.5 text-danger" aria-hidden="true" />}
              onClick={() => onNavigate("qr")}
            >
              Ir al botón de borrar en la pestaña de QR
            </Button>
          ) : null}
        </Collapse>

        <Collapse
          title="6. Licencias de mapas y agradecimientos"
          subtitle="OpenStreetMap, CARTO y la comunidad"
          icon={<Globe2 className="size-4" />}
        >
          Mapas y datos de coordenadas geográficas ©{" "}
          <a
            className="inline-flex items-center gap-0.5 text-primary hover:underline"
            href="https://www.openstreetmap.org/copyright"
            target="_blank"
            rel="noopener noreferrer"
          >
            OpenStreetMap y sus colaboradores
            <ExternalLink className="size-3" aria-hidden="true" />
          </a>
          . Diseño de teselas cartográficas por CARTO y OpenStreetMap.
        </Collapse>
      </div>

      {/* Enlace a la política completa */}
      <Link
        to="/privacidad"
        className="press card-hover flex items-start gap-3 rounded-3xl border border-primary/30 bg-primary/8 p-4"
      >
        <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-primary/15 text-primary">
          <FileText className="size-4" aria-hidden="true" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-medium text-fg">Política de privacidad completa</span>
          <span className="mt-0.5 block text-xs text-muted">
            Responsable, base jurídica, conservación, derechos y contacto — actualizada con cada
            servicio integrado.
          </span>
        </span>
        <ExternalLink className="mt-1 size-4 shrink-0 text-primary" aria-hidden="true" />
      </Link>
    </div>
  );
}
