import { useEffect, useState } from "react";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

/**
 * Bindet das Admin-Manifest nur für eingeloggte Admins ein und
 * stellt den Installations-Prompt (beforeinstallprompt) bereit.
 */
export function useAdminPwaInstall(isAdmin: boolean) {
  const [promptEvent, setPromptEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);

  // Manifest-Link dynamisch setzen / beim Ausloggen entfernen
  useEffect(() => {
    if (!isAdmin) return;
    const link = document.createElement("link");
    link.rel = "manifest";
    link.href = "/admin-manifest.json";
    document.head.appendChild(link);
    return () => {
      if (link.parentNode) link.parentNode.removeChild(link);
    };
  }, [isAdmin]);

  useEffect(() => {
    if (!isAdmin) {
      setPromptEvent(null);
      return;
    }
    const onBeforeInstall = (e: Event) => {
      e.preventDefault();
      setPromptEvent(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => {
      setInstalled(true);
      setPromptEvent(null);
    };
    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, [isAdmin]);

  const isStandalone =
    typeof window !== "undefined" &&
    (window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as any).standalone === true);

  const install = async () => {
    if (!promptEvent) return;
    await promptEvent.prompt();
    try {
      await promptEvent.userChoice;
    } finally {
      setPromptEvent(null);
    }
  };

  return {
    canInstall: Boolean(promptEvent) && !installed && !isStandalone,
    install,
  };
}
