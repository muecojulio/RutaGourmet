import { useEffect, useState } from "react";
import QRCode from "qrcode";
import {
  Copy,
  Download,
  Laptop,
  QrCode,
  Share2,
  Smartphone,
  Trash2,
  ExternalLink,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { usePlaces } from "@/lib/places-store";
import { Button } from "@/components/ui/button";
import { Segmented } from "@/components/ui/segmented";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

type Platform = "ios" | "android" | "desktop";

export function QrDownloadPanel() {
  const clearAll = usePlaces((s) => s.clearAll);
  const placesCount = usePlaces((s) => s.places.length);

  const [qrUrl, setQrUrl] = useState("https://rutagourmet.app");
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [activePlatform, setActivePlatform] = useState<Platform>("ios");
  const [armed, setArmed] = useState(false);
  const [canShare, setCanShare] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const current = window.location.href;
      setQrUrl(current);
      setCanShare(typeof navigator !== "undefined" && typeof navigator.share === "function");

      if (window.matchMedia("(display-mode: standalone)").matches) {
        setIsInstalled(true);
      }

      const handleBeforeInstall = (e: Event) => {
        e.preventDefault();
        setDeferredPrompt(e as BeforeInstallPromptEvent);
      };
      window.addEventListener("beforeinstallprompt", handleBeforeInstall);

      return () => {
        window.removeEventListener("beforeinstallprompt", handleBeforeInstall);
      };
    }
  }, []);

  useEffect(() => {
    let active = true;
    void QRCode.toDataURL(qrUrl, {
      width: 400,
      margin: 2,
      errorCorrectionLevel: "M",
      color: {
        dark: "#14110e",
        light: "#ffffff",
      },
    })
      .then((dataUri) => {
        if (active) setQrDataUrl(dataUri);
      })
      .catch(() => {
        // Fallback silently if generation fails
      });
    return () => {
      active = false;
    };
  }, [qrUrl]);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(qrUrl);
      setCopied(true);
      toast.success("Enlace copiado al portapapeles");
      setTimeout(() => setCopied(false), 2200);
    } catch {
      toast.error("No se pudo copiar el enlace");
    }
  }

  async function handleShare() {
    if (navigator.share) {
      try {
        await navigator.share({
          title: "RutaGourmet",
          text: "Descarga RutaGourmet para encontrar tus restaurantes favoritos y cómo llegar.",
          url: qrUrl,
        });
      } catch {
        // Ignored if user dismissed share dialog
      }
    } else {
      void handleCopy();
    }
  }

  async function handleInstallPrompt() {
    if (!deferredPrompt) return;
    try {
      await deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      if (choice.outcome === "accepted") {
        toast.success("¡Instalando RutaGourmet!");
        setDeferredPrompt(null);
      }
    } catch {
      toast.error("No se pudo iniciar la instalación");
    }
  }

  return (
    <div className="rise space-y-5 pb-6">
      <div>
        <div className="flex items-center gap-2">
          <div className="grid size-9 place-items-center rounded-xl bg-primary/10 text-primary">
            <QrCode className="size-5" aria-hidden="true" />
          </div>
          <h1
            id="heading-qr"
            className="font-display text-2xl font-semibold leading-none tracking-tight sm:text-3xl"
          >
            Descargar App
          </h1>
        </div>
        <p className="mt-2 text-sm text-muted">
          Escanea el código QR con cualquier dispositivo móvil para abrir e instalar la aplicación
          al instante.
        </p>
      </div>

      {/* QR Code Container */}
      <section className="relative overflow-hidden rounded-3xl border border-line bg-surface p-5 text-center shadow-[var(--shadow-card)]">
        <span
          aria-hidden="true"
          className="pointer-events-none absolute -top-10 left-1/2 size-32 -translate-x-1/2 rounded-full bg-primary/15 blur-2xl"
        />
        <div className="mx-auto flex flex-col items-center">
          <div className="relative rounded-2xl bg-white p-3.5 shadow-md">
            {qrDataUrl ? (
              <img
                src={qrDataUrl}
                alt="Código QR para descargar RutaGourmet en tu dispositivo"
                className="size-52 rounded-lg object-contain sm:size-56"
              />
            ) : (
              <div className="grid size-52 place-items-center rounded-lg bg-surface-2 text-muted sm:size-56">
                <QrCode className="size-16 animate-pulse opacity-40" aria-hidden="true" />
              </div>
            )}
            <div className="pointer-events-none absolute inset-0 rounded-2xl ring-1 ring-black/5" />
          </div>

          <div className="mt-3.5 flex items-center justify-center gap-1.5 text-xs text-muted">
            <span
              className="inline-block size-2 rounded-full bg-good pulse-soft"
              aria-hidden="true"
            />
            <span>Disponible para iPhone, Android, iPad y PC</span>
          </div>

          {/* Quick Action Buttons */}
          <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
            <Button
              variant="surface"
              size="sm"
              success={copied}
              leading={<Copy className="size-3.5" aria-hidden="true" />}
              onClick={() => void handleCopy()}
            >
              {copied ? "¡Enlace copiado!" : "Copiar enlace"}
            </Button>

            {qrDataUrl ? (
              <a
                href={qrDataUrl}
                download="rutagourmet-qr.png"
                className="press inline-flex h-9 items-center gap-2 rounded-full border border-line bg-surface-2 px-3 text-xs font-semibold text-fg hover:border-primary/40"
              >
                <Download className="size-3.5" aria-hidden="true" />
                Guardar QR
              </a>
            ) : null}

            {canShare ? (
              <Button
                variant="surface"
                size="sm"
                leading={<Share2 className="size-3.5" aria-hidden="true" />}
                onClick={() => void handleShare()}
              >
                Compartir
              </Button>
            ) : null}
          </div>

          {/* Native PWA prompt button if available */}
          {deferredPrompt && !isInstalled ? (
            <Button
              size="lg"
              className="mt-4 w-full"
              leading={<Sparkles className="size-4" aria-hidden="true" />}
              onClick={() => void handleInstallPrompt()}
            >
              Instalar ahora en este dispositivo
            </Button>
          ) : null}
        </div>
      </section>

      {/* Guide by Device Platform */}
      <section className="rounded-3xl border border-line bg-surface p-5 shadow-[var(--shadow-card)]">
        <h2 className="text-base font-semibold">Cómo instalar en tu dispositivo</h2>
        <p className="mt-1 text-xs text-muted">
          RutaGourmet es una aplicación web progresiva (PWA) rápida y ligera. Funciona como una app
          nativa sin ocupar almacenamiento innecesario.
        </p>

        {/* Platform Selector — segmented control with keyboard support */}
        <Segmented
          label="Plataforma de instalación"
          className="mt-4"
          size="sm"
          value={activePlatform}
          onChange={setActivePlatform}
          options={[
            {
              id: "ios",
              label: "iPhone / iOS",
              icon: <Smartphone className="size-3.5" aria-hidden="true" />,
            },
            {
              id: "android",
              label: "Android",
              icon: <Smartphone className="size-3.5" aria-hidden="true" />,
            },
            {
              id: "desktop",
              label: "PC / Mac",
              icon: <Laptop className="size-3.5" aria-hidden="true" />,
            },
          ]}
        />

        {/* Steps for selected platform */}
        <div className="mt-4 rounded-2xl bg-surface-2/60 p-4" aria-live="polite">
          {activePlatform === "ios" ? (
            <ol className="space-y-3 text-sm text-muted">
              <Step n={1}>
                <strong className="text-fg">Escanea el código QR</strong> con la cámara de tu iPhone
                o abre la dirección en <strong className="text-fg">Safari</strong>.
              </Step>
              <Step n={2}>
                Toca el botón <strong className="text-fg">Compartir</strong> (ícono de cuadro con
                flecha hacia arriba <Share2 className="inline size-3.5" aria-hidden="true" /> en la
                barra inferior de Safari).
              </Step>
              <Step n={3}>
                Desliza hacia abajo en el menú de opciones y selecciona{" "}
                <strong className="text-fg">«Agregar a inicio»</strong>.
              </Step>
              <Step n={4}>
                Toca <strong className="text-fg">«Agregar»</strong> en la esquina superior derecha.
                ¡Listo! La app se abrirá en pantalla completa como una aplicación nativa.
              </Step>
            </ol>
          ) : activePlatform === "android" ? (
            <ol className="space-y-3 text-sm text-muted">
              <Step n={1}>
                <strong className="text-fg">Escanea el código QR</strong> con tu cámara o Google
                Lens y abre el enlace en <strong className="text-fg">Google Chrome</strong>.
              </Step>
              <Step n={2}>
                Toca el menú de <strong className="text-fg">tres puntos (⋮)</strong> en la esquina
                superior derecha del navegador.
              </Step>
              <Step n={3}>
                Selecciona <strong className="text-fg">«Instalar aplicación»</strong> o{" "}
                <strong className="text-fg">«Agregar a la pantalla principal»</strong>.
              </Step>
              <Step n={4}>
                Toca <strong className="text-fg">«Instalar»</strong> para confirmar. ¡Ya podrás
                abrirla directamente desde tu menú de apps!
              </Step>
            </ol>
          ) : (
            <ol className="space-y-3 text-sm text-muted">
              <Step n={1}>
                Abre el enlace en tu navegador web de escritorio (
                <strong className="text-fg">Chrome, Edge, Brave o Safari</strong>).
              </Step>
              <Step n={2}>
                En la barra de direcciones, haz clic en el ícono de{" "}
                <strong className="text-fg">Instalar</strong> (ícono de computadora o símbolo ⊕).
              </Step>
              <Step n={3}>
                Confirma haciendo clic en <strong className="text-fg">«Instalar»</strong>. Se creará
                una ventana independiente y acceso directo en tu escritorio.
              </Step>
            </ol>
          )}

          <div className="mt-4 flex items-center justify-between border-t border-line/60 pt-3 text-xs text-muted">
            <span>✨ No requiere descargas desde tiendas</span>
            <a
              href="/?install=1&platform=ios"
              className="press inline-flex items-center gap-1 text-primary hover:underline"
            >
              <span>Ver guía visual</span>
              <ExternalLink className="size-3" aria-hidden="true" />
            </a>
          </div>
        </div>
      </section>

      {/* Borrar datos de este teléfono */}
      <section className="rounded-3xl border border-line bg-surface p-5 shadow-[var(--shadow-card)]">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-xl bg-danger/10 text-danger">
            <Trash2 className="size-4" aria-hidden="true" />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="font-semibold text-fg">Borrar datos de este teléfono</h2>
            <p className="mt-1 text-xs text-muted">
              Quita lugares guardados, favoritos y notas de este dispositivo ({placesCount}{" "}
              {placesCount === 1 ? "lugar guardado" : "lugares guardados"}). Esta acción no se puede
              deshacer.
            </p>

            {armed ? (
              <div
                role="alertdialog"
                aria-label="Confirmar borrado"
                className="mt-4 rounded-2xl border border-danger/30 bg-danger/10 p-3.5 text-xs"
              >
                <p className="font-medium text-danger">
                  ¿Estás seguro de eliminar los datos guardados en este dispositivo?
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button
                    variant="danger"
                    size="sm"
                    leading={<Trash2 className="size-3.5" aria-hidden="true" />}
                    onClick={() => {
                      clearAll();
                      setArmed(false);
                      toast.success("Datos locales borrados con éxito");
                    }}
                  >
                    Sí, confirmar borrado
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => setArmed(false)}>
                    Cancelar
                  </Button>
                </div>
              </div>
            ) : (
              <Button
                variant="danger"
                size="sm"
                className="mt-3"
                leading={<Trash2 className="size-3.5" aria-hidden="true" />}
                onClick={() => setArmed(true)}
              >
                Borrar mis lugares
              </Button>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}

function Step({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <li className="flex gap-3">
      <span
        aria-hidden="true"
        className="grid size-6 shrink-0 place-items-center rounded-full bg-primary/15 text-xs font-semibold text-primary"
      >
        {n}
      </span>
      <div>{children}</div>
    </li>
  );
}
