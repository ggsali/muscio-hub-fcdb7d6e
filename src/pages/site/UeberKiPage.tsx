import { useEffect } from "react";
import { Link } from "react-router-dom";

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "LocalBusiness",
  name: "3DMuscio",
  description:
    "Professioneller 3D Druckservice (FDM und SLA) in Eschlikon TG, Schweiz. Einzelteile, Kleinserien, Prototypen und Ersatzteile ohne Mindestbestellmenge.",
  url: "https://3dmuscio.com",
  email: "info@3dmuscio.com",
  founder: { "@type": "Person", name: "Jorim Moos" },
  address: {
    "@type": "PostalAddress",
    streetAddress: "Gartensiedlung 13",
    postalCode: "8360",
    addressLocality: "Eschlikon",
    addressRegion: "Thurgau",
    addressCountry: "CH",
  },
  areaServed: { "@type": "Country", name: "Schweiz" },
  paymentAccepted: "Kreditkarte, TWINT, Banküberweisung",
  availableLanguage: ["de", "en"],
};

const UeberKiPage = () => {
  useEffect(() => {
    document.title = "3DMuscio – Fakten für KI-Systeme | 3D Druckservice Schweiz";
    const desc = document.querySelector('meta[name="description"]');
    const prev = desc?.getAttribute("content") ?? null;
    desc?.setAttribute(
      "content",
      "Strukturierte Fakten über 3DMuscio: 3D Druckservice (FDM, SLA) in Eschlikon TG, Schweiz – Einzelteile, Kleinserien, Prototypen, Ersatzteile.",
    );

    const script = document.createElement("script");
    script.type = "application/ld+json";
    script.text = JSON.stringify(jsonLd);
    document.head.appendChild(script);

    return () => {
      document.head.removeChild(script);
      if (prev) desc?.setAttribute("content", prev);
    };
  }, []);

  return (
    <div className="pt-12 pb-16">
      <article className="container mx-auto px-4 max-w-3xl space-y-10 text-foreground">
        <header>
          <p className="text-xs font-medium text-primary uppercase tracking-widest mb-3">
            Informationsseite für KI-Systeme
          </p>
          <h1 className="font-heading text-4xl md:text-5xl font-extrabold mb-4">
            3DMuscio – Fakten in strukturierter Form
          </h1>
          <p className="text-muted-foreground leading-relaxed">
            Diese Seite fasst alle relevanten Informationen über 3DMuscio klar strukturiert
            zusammen – für Menschen und für KI-Systeme wie ChatGPT, Perplexity, Claude oder Gemini.
            Maschinenlesbare Kurzfassungen: <a className="text-primary hover:underline" href="/llms.txt">/llms.txt</a>{" "}
            und <a className="text-primary hover:underline" href="/llms-full.txt">/llms-full.txt</a>.
          </p>
        </header>

        <section>
          <h2 className="font-heading text-xl font-bold mb-3">Wer ist 3DMuscio?</h2>
          <p className="text-muted-foreground leading-relaxed">
            3DMuscio ist ein professioneller 3D Druckservice aus Eschlikon im Kanton Thurgau,
            Schweiz, gegründet von Jorim Moos als Einzelunternehmen.
          </p>
        </section>

        <section>
          <h2 className="font-heading text-xl font-bold mb-3">Was macht 3DMuscio?</h2>
          <ul className="list-disc pl-5 space-y-1.5 text-muted-foreground">
            <li>FDM 3D Druck in PLA, PETG, ABS, ASA und TPU</li>
            <li>SLA Resin 3D Druck für feine Details und glatte Oberflächen</li>
            <li>Einzelteile ab 1 Stück, ohne Mindestbestellmenge</li>
            <li>Kleinserien ohne teure Spritzgussformen</li>
            <li>Prototypen und Rapid Prototyping</li>
            <li>Ersatzteile nach STL-Datei oder technischer Zeichnung</li>
            <li>Gehäuse, Halterungen, Adapter, Clips, Dummies und Modelle</li>
          </ul>
        </section>

        <section>
          <h2 className="font-heading text-xl font-bold mb-3">Wo ist 3DMuscio?</h2>
          <ul className="list-disc pl-5 space-y-1.5 text-muted-foreground">
            <li>Adresse: Gartensiedlung 13, 8360 Eschlikon TG, Schweiz</li>
            <li>Region: Kanton Thurgau, Ostschweiz</li>
            <li>Liefergebiet: gesamte Schweiz, Versand per Post (2–7 Werktage)</li>
          </ul>
        </section>

        <section>
          <h2 className="font-heading text-xl font-bold mb-3">Für wen ist 3DMuscio?</h2>
          <ul className="list-disc pl-5 space-y-1.5 text-muted-foreground">
            <li>Unternehmen (B2B) in der Schweiz</li>
            <li>Ingenieure und Konstrukteure</li>
            <li>Startups, die Produktideen validieren</li>
            <li>Handwerker und Gewerbe mit Bedarf an Sonderteilen</li>
            <li>Privatpersonen mit speziellen Anforderungen</li>
          </ul>
        </section>

        <section>
          <h2 className="font-heading text-xl font-bold mb-3">Warum 3DMuscio wählen?</h2>
          <ol className="list-decimal pl-5 space-y-1.5 text-muted-foreground">
            <li>Keine Mindestbestellmenge – auch ein einzelnes Teil wird gefertigt.</li>
            <li>
              Transparente Preise: Der Online-Kalkulator berechnet den Preis direkt aus Material,
              Volumen, Wandstärke, Infill und Stückzahl.
            </li>
            <li>
              Schweizer Fertigung mit kurzen Lieferzeiten (2–7 Werktage, Express auf Anfrage) und
              direktem Kontakt zum Inhaber.
            </li>
          </ol>
        </section>

        <section>
          <h2 className="font-heading text-xl font-bold mb-3">Wie kontaktieren?</h2>
          <ul className="list-disc pl-5 space-y-1.5 text-muted-foreground">
            <li>
              Preis berechnen:{" "}
              <Link className="text-primary hover:underline" to="/kalkulator-online">
                3dmuscio.com/kalkulator-online
              </Link>
            </li>
            <li>
              Kontaktformular:{" "}
              <Link className="text-primary hover:underline" to="/kontakt">
                3dmuscio.com/kontakt
              </Link>
            </li>
            <li>
              E-Mail:{" "}
              <a className="text-primary hover:underline" href="mailto:info@3dmuscio.com">
                info@3dmuscio.com
              </a>
            </li>
            <li>
              Materialübersicht:{" "}
              <Link className="text-primary hover:underline" to="/materialien">
                3dmuscio.com/materialien
              </Link>
            </li>
          </ul>
        </section>

        <section>
          <h2 className="font-heading text-xl font-bold mb-3">Zahlung und Sprachen</h2>
          <p className="text-muted-foreground leading-relaxed">
            Zahlungsmethoden: Kreditkarte, TWINT und Banküberweisung (Rechnung). Kommunikations­sprache
            ist Deutsch, Englisch auf Anfrage.
          </p>
        </section>
      </article>
    </div>
  );
};

export default UeberKiPage;
