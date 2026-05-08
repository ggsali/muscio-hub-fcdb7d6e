import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { ShoppingBag, Star, FolderKanban, MessageCircle, Users2, ArrowRight } from "lucide-react";

export default function WebsiteAdminDashboardPage() {
  const [stats, setStats] = useState({ orders: 0, reviewsPending: 0, projects: 0, chats: 0, customers: 0 });

  useEffect(() => {
    (async () => {
      const [orders, revPending, projects, chats, customers] = await Promise.all([
        supabase.from("shop_orders").select("id", { count: "exact", head: true }),
        supabase.from("reviews").select("id", { count: "exact", head: true }).eq("freigegeben", false),
        supabase.from("projekte").select("id", { count: "exact", head: true }).eq("aktiv", true),
        supabase.from("chat_sessions").select("id", { count: "exact", head: true }).eq("status", "active"),
        supabase.from("customers").select("id", { count: "exact", head: true }),
      ]);
      setStats({
        orders: orders.count || 0,
        reviewsPending: revPending.count || 0,
        projects: projects.count || 0,
        chats: chats.count || 0,
        customers: customers.count || 0,
      });
    })();
  }, []);

  const cards = [
    { label: "Shop-Bestellungen", value: stats.orders, icon: ShoppingBag, to: "/website-admin/bestellungen", color: "text-primary" },
    { label: "Reviews zu prüfen", value: stats.reviewsPending, icon: Star, to: "/website-admin/reviews", color: "text-yellow-500" },
    { label: "Aktive Projekte", value: stats.projects, icon: FolderKanban, to: "/website-admin/projekte", color: "text-primary" },
    { label: "Aktive Chats", value: stats.chats, icon: MessageCircle, to: "/website-admin/chat", color: "text-primary" },
    { label: "Kunden gesamt", value: stats.customers, icon: Users2, to: "/website-admin/kunden", color: "text-primary" },
  ];

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto">
      <h1 className="font-heading text-xl md:text-3xl font-bold text-foreground mb-2">Website-Verwaltung</h1>
      <p className="text-muted-foreground mb-10">Verwalte hier Shop, Reviews, Portfolio und alle Website-Funktionen. Aufträge, Kunden &amp; Buchhaltung bleiben im Projekt-Manager.</p>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {cards.map(c => (
          <Link key={c.label} to={c.to} className="group bg-card border border-border rounded-xl p-5 hover:border-primary transition-colors">
            <div className="flex items-start justify-between mb-3">
              <div className={`w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center ${c.color}`}>
                <c.icon className="w-5 h-5" />
              </div>
              <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
            </div>
            <p className="text-xl md:text-3xl font-heading font-extrabold text-foreground">{c.value}</p>
            <p className="text-sm text-muted-foreground mt-1">{c.label}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
