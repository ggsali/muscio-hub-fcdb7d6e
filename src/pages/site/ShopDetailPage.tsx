import { useEffect, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useCart } from "@/contexts/CartContext";
import { Button } from "@/components/ui/button";
import { ScrollReveal } from "@/components/site/ScrollReveal";
import { ShoppingCart, ChevronLeft, Minus, Plus, Loader2, Package } from "lucide-react";
import { toast } from "sonner";

interface Product {
  id: string; name: string; slug: string;
  kurzbeschreibung: string | null; beschreibung: string | null;
  preis: number; vergleichspreis: number | null; material: string | null;
  lagerbestand: number; unendlich_bestand: boolean;
  shop_product_images: { storage_path: string; is_primary: boolean; sort_order: number }[];
  shop_categories: { name: string; slug: string } | null;
}

const getImageUrl = (path: string) =>
  supabase.storage.from("shop-products").getPublicUrl(path).data.publicUrl;

const ShopDetailPage = () => {
  const { slug } = useParams();
  const nav = useNavigate();
  const { addItem } = useCart();
  const [p, setP] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [qty, setQty] = useState(1);
  const [activeImg, setActiveImg] = useState(0);

  useEffect(() => {
    if (!slug) return;
    setLoading(true);
    supabase.from("shop_products")
      .select("*, shop_product_images(*), shop_categories(name, slug)")
      .eq("slug", slug).eq("aktiv", true).maybeSingle()
      .then(({ data }) => {
        if (data) {
          const sorted = [...(data.shop_product_images || [])].sort((a, b) =>
            (a.is_primary ? -1 : 1) || a.sort_order - b.sort_order);
          setP({ ...data, shop_product_images: sorted } as any);
        }
        setLoading(false);
      });
  }, [slug]);

  if (loading) return (
    <div className="pt-24 pb-20 flex justify-center"><Loader2 className="w-8 h-8 text-primary animate-spin" /></div>
  );
  if (!p) return (
    <div className="pt-24 pb-20 text-center">
      <p className="text-muted-foreground">Produkt nicht gefunden.</p>
      <Button asChild className="mt-4"><Link to="/shop">Zum Shop</Link></Button>
    </div>
  );

  const inStock = p.unendlich_bestand || p.lagerbestand > 0;
  const img = p.shop_product_images[activeImg];

  const handleAdd = () => {
    addItem({
      productId: p.id, name: p.name, preis: Number(p.preis), quantity: qty,
      image: img ? getImageUrl(img.storage_path) : undefined, slug: p.slug,
    });
    toast.success(`${p.name} (${qty}×) hinzugefügt`);
  };

  return (
    <div className="pt-24 pb-20">
      <div className="container mx-auto px-4 max-w-6xl">
        <button onClick={() => nav(-1)} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-6">
          <ChevronLeft className="w-4 h-4" /> Zurück
        </button>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
          <ScrollReveal>
            <div className="space-y-3">
              <div className="aspect-square bg-card border border-border rounded-2xl overflow-hidden">
                {img ? (
                  <img src={getImageUrl(img.storage_path)} alt={p.name} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Package className="w-16 h-16 text-muted-foreground/30" />
                  </div>
                )}
              </div>
              {p.shop_product_images.length > 1 && (
                <div className="grid grid-cols-5 gap-2">
                  {p.shop_product_images.map((im, i) => (
                    <button key={i} onClick={() => setActiveImg(i)}
                      className={`aspect-square rounded-lg overflow-hidden border ${i === activeImg ? "border-primary" : "border-border"}`}>
                      <img src={getImageUrl(im.storage_path)} alt="" className="w-full h-full object-cover" />
                    </button>
                  ))}
                </div>
              )}
            </div>
          </ScrollReveal>

          <ScrollReveal delay={0.1}>
            {p.shop_categories && (
              <p className="text-xs font-medium text-primary uppercase tracking-widest mb-2">{p.shop_categories.name}</p>
            )}
            <h1 className="font-heading text-3xl md:text-4xl font-extrabold mb-3">{p.name}</h1>
            {p.kurzbeschreibung && <p className="text-muted-foreground text-lg mb-5">{p.kurzbeschreibung}</p>}

            <div className="flex items-baseline gap-3 mb-6">
              <span className="text-3xl font-bold text-primary">CHF {Number(p.preis).toFixed(2)}</span>
              {p.vergleichspreis && (
                <span className="text-lg text-muted-foreground line-through">CHF {Number(p.vergleichspreis).toFixed(2)}</span>
              )}
            </div>

            {p.material && (
              <div className="text-sm mb-4">
                <span className="text-muted-foreground">Material: </span>
                <span className="font-medium">{p.material}</span>
              </div>
            )}

            <div className="text-sm mb-6">
              {inStock ? (
                <span className="inline-flex items-center gap-2 text-green-600">
                  <span className="w-2 h-2 rounded-full bg-green-600" /> Auf Lager
                </span>
              ) : (
                <span className="text-muted-foreground">Ausverkauft</span>
              )}
            </div>

            {inStock && (
              <div className="flex items-center gap-3 mb-6">
                <div className="flex items-center border border-input rounded-lg">
                  <button onClick={() => setQty(Math.max(1, qty - 1))} className="w-10 h-10 flex items-center justify-center hover:bg-muted">
                    <Minus className="w-3 h-3" />
                  </button>
                  <span className="w-10 text-center text-sm font-medium">{qty}</span>
                  <button onClick={() => setQty(qty + 1)} className="w-10 h-10 flex items-center justify-center hover:bg-muted">
                    <Plus className="w-3 h-3" />
                  </button>
                </div>
                <Button size="lg" onClick={handleAdd} className="flex-1 gap-2">
                  <ShoppingCart className="w-4 h-4" /> In den Warenkorb
                </Button>
              </div>
            )}

            {p.beschreibung && (
              <div className="border-t border-border pt-6">
                <h2 className="font-heading text-lg font-bold mb-3">Beschreibung</h2>
                <p className="text-muted-foreground whitespace-pre-wrap leading-relaxed">{p.beschreibung}</p>
              </div>
            )}
          </ScrollReveal>
        </div>
      </div>
    </div>
  );
};

export default ShopDetailPage;
