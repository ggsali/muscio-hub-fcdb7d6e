import { motion } from "framer-motion";
import { ClipboardList, Cog, CreditCard, Package, CheckCircle2, Check, Home } from "lucide-react";

const STEPS_WEBSITE = [
  { key: 'offen', label: 'Zahlung ausstehend', icon: CreditCard },
  { key: 'bezahlt', label: 'Bezahlt', icon: CheckCircle2 },
  { key: 'bearbeitung', label: 'In Produktion', icon: Cog },
  { key: 'geliefert', label: 'Versandt', icon: Package },
  { key: 'abgeschlossen', label: 'Abgeschlossen', icon: CheckCircle2 },
] as const;

const STEPS_MANUAL = [
  { key: 'offen', label: 'Bestellt', icon: ClipboardList },
  { key: 'bearbeitung', label: 'In Bearbeitung', icon: Cog },
  { key: 'bezahlt', label: 'Bezahlt', icon: CreditCard },
  { key: 'geliefert', label: 'Versandt', icon: Package },
  { key: 'abgeschlossen', label: 'Abgeschlossen', icon: CheckCircle2 },
] as const;

function statusToStep(status: string, isWebsite: boolean): number {
  if (isWebsite) {
    switch (status) {
      case 'Offen': return 0
      case 'Bezahlt': return 1
      case 'In Bearbeitung': return 2
      case 'Geliefert': return 3
      case 'Abgeschlossen': return 4
      default: return 0
    }
  } else {
    switch (status) {
      case 'Offen': return 0
      case 'In Bearbeitung': return 1
      case 'Bezahlt': return 2
      case 'Geliefert': return 3
      case 'Abgeschlossen': return 4
      default: return 0
    }
  }
}

export default function OrderProgress({ status, source, lieferart }: { status: string; source?: string; lieferart?: string }) {
  const isWebsiteOrder = source === 'website' || source === 'shop' || source === 'kalkulator'
  const isPickup = lieferart === 'abholung'
  const baseSteps = isWebsiteOrder ? STEPS_WEBSITE : STEPS_MANUAL
  const STEPS = baseSteps.map(s =>
    s.key === 'geliefert' && isPickup ? { ...s, label: 'Abholbereit', icon: Home } : s
  )
  const activeIdx = statusToStep(status, isWebsiteOrder);

  return (
    <div className="w-full">
      {/* Desktop: horizontal */}
      <div className="hidden md:flex items-center w-full">
        {STEPS.map((s, i) => {
          const done = i < activeIdx;
          const active = i === activeIdx;
          const Icon = s.icon;
          return (
            <div key={s.key} className="flex items-center flex-1 last:flex-none">
              <div className="flex flex-col items-center gap-1.5 min-w-0">
                <motion.div
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ delay: i * 0.05, duration: 0.3 }}
                  className={`w-9 h-9 rounded-full flex items-center justify-center border-2 transition-colors ${
                    active ? "bg-primary border-primary text-primary-foreground shadow-[0_0_0_4px_hsl(var(--primary)/0.15)]" :
                    done ? "bg-success border-success text-white" :
                    "bg-muted border-border text-muted-foreground"
                  }`}
                >
                  {done ? <Check className="w-4 h-4" /> : <Icon className="w-4 h-4" />}
                </motion.div>
                <span className={`text-[10px] font-medium text-center whitespace-nowrap ${
                  active ? "text-primary" : done ? "text-success" : "text-muted-foreground"
                }`}>{s.label}</span>
              </div>
              {i < STEPS.length - 1 && (
                <div className="flex-1 h-0.5 mx-1 mb-5 bg-border relative overflow-hidden rounded">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: i < activeIdx ? "100%" : "0%" }}
                    transition={{ duration: 0.4, delay: i * 0.05 }}
                    className="absolute inset-y-0 left-0 bg-success"
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Mobile: vertical */}
      <div className="md:hidden flex flex-col">
        {STEPS.map((s, i) => {
          const done = i < activeIdx;
          const active = i === activeIdx;
          const Icon = s.icon;
          return (
            <div key={s.key} className="flex items-start gap-3">
              <div className="flex flex-col items-center">
                <motion.div
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ delay: i * 0.05 }}
                  className={`w-8 h-8 rounded-full flex items-center justify-center border-2 ${
                    active ? "bg-primary border-primary text-primary-foreground" :
                    done ? "bg-success border-success text-white" :
                    "bg-muted border-border text-muted-foreground"
                  }`}
                >
                  {done ? <Check className="w-3.5 h-3.5" /> : <Icon className="w-3.5 h-3.5" />}
                </motion.div>
                {i < STEPS.length - 1 && (
                  <div className={`w-0.5 h-6 ${done ? "bg-success" : "bg-border"}`} />
                )}
              </div>
              <span className={`text-xs font-medium pt-1.5 ${
                active ? "text-primary" : done ? "text-success" : "text-muted-foreground"
              }`}>{s.label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
