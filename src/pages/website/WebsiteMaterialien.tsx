import { useState } from "react";
import { Link } from "react-router-dom";
import { ScrollReveal } from "@/components/ScrollReveal";
import { Button } from "@/components/ui/button";
import { materials, Material, calculatorMaterials } from "@/data/materials";
import { Thermometer, Move, Eye, DollarSign, ArrowRight, Check, X } from "lucide-react";
import { motion } from "framer-motion";

type FilterType = "Alle" | "FDM" | "SLA" | "Flexibel" | "Industrie";
const industrieMaterials = ["nylon", "cf-pla", "asa"];

const WebsiteMaterialien = () => {
  const [filter, setFilter] = useState<FilterType>("Alle");

  const filtered = materials.filter(m => {
    if (filter === "Alle") return true;
    if (filter === "Industrie") return industrieMaterials.includes(m.id);
    return m.type === filter;
  });

  const filters: FilterType[] = ["Alle", "FDM", "SLA", "Flexibel", "Industrie"];

  const ratingDots = (value: number, max = 5) =>
    Array.from({ length: max }).map((_, i) => (
      <div key={i} className={`w-1.5 h-1.5 rounded-full ${i < value ? "bg-[#00cc66]" : "bg-white/10"}`} />
    ));

  return (
    <div className="pt-24 pb-16 bg-[#0a0a0a] min-h-screen">
      <div className="container mx-auto px-4">
        <ScrollReveal>
          <div className="max-w-xl mb-12">
            <p className="text-xs font-medium text-[#00cc66] uppercase tracking-widest mb-3">Materialien</p>
            <h1 className="text-4xl md:text-5xl font-extrabold text-white tracking-tight mb-4">
              Das richtige Material für jeden Einsatz.
            </h1>
            <p className="text-white/50 text-base">12+ Materialien — von Prototypen bis Serienproduktion.</p>
          </div>
        </ScrollReveal>

        <ScrollReveal>
          <div className="flex flex-wrap gap-2 mb-10">
            {filters.map(f => (
              <button key={f} onClick={() => setFilter(f)}
                className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all ${filter === f ? "bg-white text-[#0a0a0a]" : "bg-[#111] text-white/50 border border-white/8 hover:border-white/20"}`}>
                {f}
              </button>
            ))}
          </div>
        </ScrollReveal>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-24">
          {filtered.map((m, i) => (
            <ScrollReveal key={m.id} delay={i * 0.04}>
              <MaterialCard material={m} ratingDots={ratingDots} />
            </ScrollReveal>
          ))}
        </div>

        <ScrollReveal>
          <div className="mb-8">
            <p className="text-xs font-medium text-[#00cc66] uppercase tracking-widest mb-3">Vergleich</p>
            <h2 className="text-2xl font-bold text-white mb-8 tracking-tight">Materialvergleich</h2>
            <div className="overflow-x-auto rounded-xl border border-white/8">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-white/5">
                    <th className="text-left py-3 px-4 font-semibold text-white/50 text-xs">Material</th>
                    <th className="text-center py-3 px-2 font-semibold text-white/50 text-xs">Typ</th>
                    <th className="text-center py-3 px-2 font-semibold text-white/50 text-xs">Flex</th>
                    <th className="text-center py-3 px-2 font-semibold text-white/50 text-xs">Detail</th>
                    <th className="text-center py-3 px-2 font-semibold text-white/50 text-xs">Outdoor</th>
                    <th className="text-center py-3 px-2 font-semibold text-white/50 text-xs">Food</th>
                    <th className="text-right py-3 px-4 font-semibold text-white/50 text-xs">CHF/g</th>
                  </tr>
                </thead>
                <tbody>
                  {materials.map(m => (
                    <tr key={m.id} className="border-t border-white/5 hover:bg-white/3 transition-colors">
                      <td className="py-3 px-4 font-medium text-white flex items-center gap-2 text-xs">
                        <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: m.color }} />
                        {m.name}
                      </td>
                      <td className="text-center py-3 px-2">
                        <span className="text-[10px] px-2 py-0.5 bg-white/5 rounded text-white/50">{m.type}</span>
                      </td>
                      <td className="text-center py-3 px-2"><div className="flex justify-center gap-0.5">{ratingDots(m.flexibility)}</div></td>
                      <td className="text-center py-3 px-2"><div className="flex justify-center gap-0.5">{ratingDots(m.detail)}</div></td>
                      <td className="text-center py-3 px-2">
                        {["asa", "petg", "abs"].includes(m.id) ? <Check className="w-3.5 h-3.5 text-[#00cc66] mx-auto" /> : <X className="w-3.5 h-3.5 text-white/10 mx-auto" />}
                      </td>
                      <td className="text-center py-3 px-2">
                        {["petg"].includes(m.id) ? <Check className="w-3.5 h-3.5 text-[#00cc66] mx-auto" /> : <X className="w-3.5 h-3.5 text-white/10 mx-auto" />}
                      </td>
                      <td className="text-right py-3 px-4 font-semibold text-[#00cc66] text-xs">{m.pricePerGram.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </ScrollReveal>
      </div>
    </div>
  );
};

const MaterialCard = ({ material: m, ratingDots }: { material: Material; ratingDots: (v: number) => JSX.Element[] }) => (
  <motion.div className="bg-[#111] rounded-xl border border-white/8 hover:border-[#00cc66]/30 transition-all overflow-hidden group" whileHover={{ y: -2 }}>
    <div className="h-1" style={{ backgroundColor: m.color }} />
    <div className="p-5">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-base font-bold text-white">{m.name}</h3>
        <span className="text-[10px] px-2 py-0.5 bg-white/5 rounded text-white/50 font-semibold">{m.type}</span>
      </div>
      <p className="text-white/40 text-xs mb-4 leading-relaxed">{m.description}</p>
      <div className="grid grid-cols-2 gap-2 mb-4">
        <div className="flex items-center gap-1.5 text-xs">
          <Thermometer className="w-3 h-3 text-white/30" />
          <span className="text-white/40">{m.temperature}</span>
        </div>
        <div className="flex items-center gap-1.5 text-xs">
          <Move className="w-3 h-3 text-white/30" />
          <div className="flex gap-0.5">{ratingDots(m.flexibility)}</div>
        </div>
        <div className="flex items-center gap-1.5 text-xs">
          <Eye className="w-3 h-3 text-white/30" />
          <div className="flex gap-0.5">{ratingDots(m.detail)}</div>
        </div>
        <div className="flex items-center gap-1.5 text-xs">
          <DollarSign className="w-3 h-3 text-white/30" />
          <div className="flex gap-0.5">{ratingDots(m.priceRating)}</div>
        </div>
      </div>
      <div className="flex flex-wrap gap-1 mb-4">
        {m.useCases.map(u => (
          <span key={u} className="text-[10px] px-2 py-0.5 bg-white/5 rounded text-white/40">{u}</span>
        ))}
      </div>
      <div className="flex items-center justify-between pt-3 border-t border-white/5">
        <span className="text-sm font-bold text-[#00cc66]">CHF {m.pricePerGram.toFixed(2)}/g</span>
        <Link to="/kalkulator" className="text-xs text-white/30 hover:text-[#00cc66] font-medium flex items-center gap-1 transition-colors">
          Kalkulator <ArrowRight className="w-3 h-3" />
        </Link>
      </div>
    </div>
  </motion.div>
);

export default WebsiteMaterialien;
