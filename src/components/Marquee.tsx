const items = [
  "PLA", "PETG", "ABS", "TPU", "Resin", "Nylon", "ASA", "Carbon-Fiber",
  "48h Lieferung", "0.1mm Präzision", "Swiss Made", "500+ Kunden",
];

export const Marquee = () => (
  <div className="relative overflow-hidden py-4 border-y border-border bg-muted/50">
    <div className="marquee-track flex gap-8 w-max">
      {[...items, ...items].map((item, i) => (
        <span key={i} className="text-sm font-medium text-muted-foreground whitespace-nowrap flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-primary" />
          {item}
        </span>
      ))}
    </div>
  </div>
);
