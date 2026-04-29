import { motion } from "framer-motion";

const partners = [
  { name: "Bühler Group", logo: "Bühler" },
  { name: "ETH Zürich", logo: "ETH" },
  { name: "Siemens", logo: "Siemens" },
  { name: "ABB", logo: "ABB" },
  { name: "Roche", logo: "Roche" },
  { name: "Geberit", logo: "Geberit" },
];

export const PartnerMarquee = () => {
  return (
    <div className="w-full py-12 bg-background border-y border-border overflow-hidden">
      <div className="container mx-auto px-4 mb-8">
        <p className="text-center text-sm font-medium text-muted-foreground uppercase tracking-widest">
          Vertraut von führenden Unternehmen
        </p>
      </div>
      <div className="relative flex overflow-x-hidden">
        <motion.div
          animate={{ x: ["0%", "-50%"] }}
          transition={{ duration: 20, ease: "linear", repeat: Infinity }}
          className="flex gap-16 whitespace-nowrap px-8"
        >
          {[...partners, ...partners].map((partner, i) => (
            <div
              key={i}
              className="text-2xl font-bold text-muted-foreground/40 hover:text-primary transition-colors cursor-default"
            >
              {partner.logo}
            </div>
          ))}
        </motion.div>
      </div>
    </div>
  );
};
