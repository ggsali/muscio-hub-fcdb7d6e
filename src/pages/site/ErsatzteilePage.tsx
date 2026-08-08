import Seo from "@/components/site/Seo";
import ServiceLanding from "@/components/site/ServiceLanding";

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "Service",
  name: "Ersatzteile drucken lassen Schweiz",
  serviceType: "3D Druck Ersatzteile",
  description:
    "Ersatzteile per 3D Druck herstellen lassen – nach STL-Datei, technischer Zeichnung oder Muster. FDM und SLA, Lieferung schweizweit.",
  provider: { "@type": "LocalBusiness", name: "3DMuscio", url: "https://3dmuscio.com" },
  areaServed: "CH",
  url: "https://3dmuscio.com/ersatzteile",
};

export default function ErsatzteilePage() {
  return (
    <>
      <Seo
        title="Ersatzteile drucken lassen Schweiz – 3DMuscio"
        description="Ersatzteile per 3D Druck herstellen lassen: nach STL, Zeichnung oder Muster. FDM & SLA aus Eschlikon TG, ab 1 Stück, Lieferung schweizweit."
        path="/ersatzteile"
        jsonLd={jsonLd}
      />
      <ServiceLanding
        eyebrow="Leistung"
        h1="Ersatzteile drucken lassen in der Schweiz"
        lead="Wenn ein Teil nicht mehr lieferbar ist, fertigen wir es neu. 3DMuscio produziert Ersatzteile per 3D Druck nach STL-Datei, technischer Zeichnung oder vorhandenem Muster – ab einem Stück, ohne Werkzeugkosten und mit kurzen Lieferzeiten in die ganze Schweiz."
        blocks={[
          {
            title: "Wann 3D Druck bei Ersatzteilen sinnvoll ist",
            text: "Vor allem dann, wenn das Originalteil nicht mehr erhältlich ist, die Losgrösse für Spritzguss zu klein wäre oder es schnell gehen muss.",
            bullets: [
              "Teil ist abgekündigt oder nicht mehr lieferbar",
              "Nur ein einzelnes Teil oder wenige Stück benötigt",
              "Maschinenstillstand – Lieferzeit ist entscheidend",
              "Bestehendes Teil soll verbessert oder angepasst werden",
            ],
          },
          {
            title: "Typische Anwendungsbeispiele",
            bullets: [
              "Gehäuse und Gehäusedeckel für Steuerungen",
              "Halterungen, Adapter und Konsolen",
              "Clips, Rastnasen und Kabelführungen",
              "Zahnräder und Führungsrollen (PETG, ABS, Nylon)",
              "Abdeckungen und Blenden für Maschinen",
              "Dichtungen und Puffer aus TPU",
            ],
          },
          {
            title: "Materialien für Ersatzteile",
            text: "FDM in PLA, PETG, ABS, ASA und TPU sowie SLA Resin für feine Details und glatte Oberflächen. Für belastete Funktionsteile empfehlen wir PETG, ABS oder ASA – für Aussenanwendungen ASA wegen der UV-Stabilität.",
          },
        ]}
        steps={[
          { title: "Daten senden", text: "STL-, STEP- oder OBJ-Datei hochladen. Ohne Datei genügen Fotos mit Massen oder eine Skizze." },
          { title: "Machbarkeit & Preis", text: "Wir prüfen Geometrie, Material und Toleranzen. Der Online-Kalkulator zeigt den Preis sofort." },
          { title: "Fertigung", text: "Druck in der Schweiz, inklusive Sichtprüfung und Nachbearbeitung wo nötig." },
          { title: "Lieferung", text: "Versand per Post innerhalb von 2–7 Werktagen oder Abholung in Eschlikon TG." },
        ]}
        ctaTitle="Ersatzteil kalkulieren"
        ctaText="Lade deine Datei hoch und erhalte in wenigen Sekunden einen transparenten Preis – ohne Mindestbestellmenge."
      />
    </>
  );
}
