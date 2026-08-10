import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MessageCircle, X } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useCustomerAuth } from "@/contexts/CustomerAuthContext";

export function ChatFab() {
  const [open, setOpen] = useState(false);
  const [whatsapp, setWhatsapp] = useState<string>("");
  const ref = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const { user } = useCustomerAuth();

  useEffect(() => {
    supabase
      .from("website_settings")
      .select("value")
      .eq("key", "whatsapp")
      .maybeSingle()
      .then(({ data }) => {
        const num = (data?.value as any)?.nummer?.toString().trim() || "";
        setWhatsapp(num);
      });
  }, []);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  const goLiveChat = () => {
    setOpen(false);
    window.dispatchEvent(new CustomEvent("open-chat-widget"));
  };

  const handleClick = () => {
    if (whatsapp) {
      setOpen(o => !o);
    } else {
      goLiveChat();
    }
  };

  return (
    <div ref={ref} className="fixed bottom-24 md:bottom-6 right-4 md:right-6 z-50 flex flex-col items-end gap-3">
      <AnimatePresence>
        {open && whatsapp && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            transition={{ duration: 0.18 }}
            className="bg-card border border-border rounded-xl shadow-lg p-2 min-w-[220px]"
          >
            <a
              href={`https://wa.me/${whatsapp}`}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => setOpen(false)}
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-accent transition-colors"
            >
              <span className="w-8 h-8 rounded-full bg-[#25D366] text-white flex items-center justify-center">
                <MessageCircle className="w-4 h-4" />
              </span>
              <span className="text-sm font-medium">WhatsApp schreiben</span>
            </a>
            <button
              onClick={goLiveChat}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-accent transition-colors text-left"
            >
              <span className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center">
                <MessageCircle className="w-4 h-4" />
              </span>
              <span className="text-sm font-medium">Live Chat öffnen</span>
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <button
        onClick={handleClick}
        aria-label="Chat öffnen"
        className="w-14 h-14 rounded-full bg-primary text-primary-foreground shadow-lg flex items-center justify-center transition-transform hover:scale-110"
      >
        {open && whatsapp ? <X className="w-6 h-6" /> : <MessageCircle className="w-7 h-7" />}
      </button>
    </div>
  );
}
