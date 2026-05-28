import { useState, useEffect } from "react";
import { Helmet } from "react-helmet-async";
import { Link, useParams, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { useCart } from "@/contexts/CartContext";
import { Button } from "@/components/ui/button";
import { ScrollReveal } from "@/components/site/ScrollReveal";
import { ShoppingCart, ArrowLeft, Star, Package, Zap, Shield, ChevronLeft, ChevronRight, Minus, Plus, Tag, Check, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

interface Product {
  id: string; name: string; slug: string;
  beschreibung: string | null; kurzbeschreibung: string | null;
  preis: number; vergleichspreis: number | null;
  material: string | null;
  lagerbestand: number; unendlich_bestand: boolean;
  tags: string[] | null;
  shop_product_images: { id: string; storage_path: string; is_primary: boolean; sort_order: number }[];
  shop_categories: { name: string; slug: string } | null;
  kategorie_id?: string | null;
}

const getImageUrl = (path: string) =>
  supabase.storage.from("shop-products").getPublicUrl(path).data.publicUrl;

export default function ShopDetailPage() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { addItem } = useCart();
  const { toast } = useToast();
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [quantity, setQuantity] = useState(1);
  const [activeImg, setActiveImg] = useState(0);
  const [added, setAdded] = useState(false);
  const [related, setRelated] = useState<any[]>([]);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const { data } = await supabase
        .from("shop_products")
        .select("*, shop_product_images(*), shop_categories(name, slug)")
        .eq("slug", slug!)
        .eq("aktiv", true)
        .maybeSingle();
      if (data) {
        const sorted: Product = {
          ...(data as any),
          shop_product_images: [...((data as any).shop_product_images || [])].sort(
            (a: any, b: any) => (a.is_primary ? -1 : 1) || a.sort_order - b.sort_order
          ),
        };
        setProduct(sorted);
        if ((data as any).kategorie_id) {
          const { data: rel } = await supabase
            .from("shop_products")
            .select("*, shop_product_images(*)")
            .eq("aktiv", true)
            .eq("kategorie_id", (data as any).kategorie_id)
            .neq("id", (data as any).id)
            .limit(4);
          setRelated(rel || []);
        }
      }
      setLoading(false);
    };
    load();
  }, [slug]);

  const handleAddToCart = () => {
    if (!product) return;
    const primaryImg = product.shop_product_images.find(i => i.is_primary) || product.shop_product_images[0];
    addItem({
      productId: product.id, name: product.name, preis: product.preis, quantity,
      image: primaryImg ? getImageUrl(primaryImg.storage_path) : undefined, slug: product.slug,
    });
    setAdded(true);
    setTimeout(() => setAdded(false), 2000);
    toast({ title: "In den Warenkorb hinzugefügt", description: `${quantity}× ${product.name}` });
  };

  const inStock = product ? (product.unendlich_bestand || product.lagerbestand > 0) : false;
  const discount = product?.vergleichspreis ? Math.round((1 - product.preis / product.vergleichspreis) * 100) : null;

  if (loading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="w-8 h-8 text-primary animate-spin" /></div>;
  if (!product) return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4">
      <p className="text-muted-foreground">Produkt nicht gefunden.</p>
      <Button variant="outline" onClick={() => navigate("/shop")}><ArrowLeft className="w-4 h-4 mr-2" />Zurück zum Shop</Button>
    </div>
  );

  const images = product.shop_product_images;
  const currentImage = images[activeImg];

  return (
    <div className="pt-12 pb-20">
      <div className="container mx-auto px-4 max-w-6xl">
        <div className="flex items-center gap-2 text-xs text-muted-foreground mb-8">
          <Link to="/shop" className="hover:text-foreground transition-colors">Shop</Link>
          {product.shop_categories && (<>
            <span>/</span>
            <Link to={`/shop?kategorie=${product.shop_categories.slug}`} className="hover:text-foreground transition-colors">{product.shop_categories.name}</Link>
          </>)}
          <span>/</span><span className="text-foreground font-medium">{product.name}</span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 mb-20">
          <div className="space-y-3">
            <div className="relative aspect-square bg-muted rounded-2xl overflow-hidden group">
              <AnimatePresence mode="wait">
                <motion.img key={activeImg} src={currentImage ? getImageUrl(currentImage.storage_path) : "/placeholder.svg"}
                  alt={product.name} className="w-full h-full object-cover"
                  initial={{ opacity: 0, scale: 1.02 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.25 }} />
              </AnimatePresence>
              {discount && <div className="absolute top-4 left-4 bg-secondary text-secondary-foreground text-xs font-bold px-2.5 py-1 rounded-lg">-{discount}%</div>}
              {images.length > 1 && (<>
                <button onClick={() => setActiveImg(i => (i - 1 + images.length) % images.length)}
                  className="absolute left-3 top-1/2 -translate-y-1/2 bg-background/80 backdrop-blur-sm rounded-full p-2 opacity-0 group-hover:opacity-100 transition-opacity shadow-lg">
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button onClick={() => setActiveImg(i => (i + 1) % images.length)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 bg-background/80 backdrop-blur-sm rounded-full p-2 opacity-0 group-hover:opacity-100 transition-opacity shadow-lg">
                  <ChevronRight className="w-4 h-4" />
                </button>
              </>)}
            </div>
            {images.length > 1 && (
              <div className="flex gap-2 overflow-x-auto pb-1">
                {images.map((img, i) => (
                  <button key={img.id} onClick={() => setActiveImg(i)}
                    className={cn("w-16 h-16 rounded-lg overflow-hidden flex-shrink-0 border-2 transition-all",
                      activeImg === i ? "border-primary" : "border-border hover:border-primary/50")}>
                    <img src={getImageUrl(img.storage_path)} alt="" className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="flex flex-col">
            {product.shop_categories && <span className="text-xs font-medium text-primary uppercase tracking-widest mb-2">{product.shop_categories.name}</span>}
            <h1 className="font-heading text-3xl md:text-4xl font-extrabold text-foreground tracking-tight mb-3">{product.name}</h1>
            <div className="flex items-baseline gap-3 mb-4">
              <span className="text-3xl font-bold text-foreground">CHF {product.preis.toFixed(2)}</span>
              {product.vergleichspreis && <span className="text-lg text-muted-foreground line-through">CHF {product.vergleichspreis.toFixed(2)}</span>}
              {discount && <span className="text-sm font-bold text-secondary bg-secondary/10 px-2 py-0.5 rounded">{discount}% Rabatt</span>}
            </div>
            {product.kurzbeschreibung && <p className="text-muted-foreground mb-6 leading-relaxed">{product.kurzbeschreibung}</p>}

            <div className="flex flex-wrap gap-2 mb-6">
              <span className={cn("flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full",
                inStock ? "bg-primary/10 text-primary" : "bg-destructive/10 text-destructive")}>
                <div className={cn("w-1.5 h-1.5 rounded-full", inStock ? "bg-primary animate-pulse" : "bg-destructive")} />
                {inStock ? "Auf Lager" : "Ausverkauft"}
              </span>
              {product.material && <span className="text-xs font-medium px-3 py-1.5 rounded-full bg-muted text-muted-foreground">{product.material}</span>}
            </div>

            {inStock && (
              <div className="flex items-center gap-3 mb-6">
                <div className="flex items-center border border-border rounded-lg overflow-hidden">
                  <button onClick={() => setQuantity(q => Math.max(1, q - 1))} className="px-3 py-2.5 hover:bg-muted"><Minus className="w-4 h-4" /></button>
                  <span className="px-4 py-2.5 text-sm font-semibold min-w-[3rem] text-center border-x border-border">{quantity}</span>
                  <button onClick={() => setQuantity(q => q + 1)} className="px-3 py-2.5 hover:bg-muted"><Plus className="w-4 h-4" /></button>
                </div>
                <Button onClick={handleAddToCart} size="lg" className="flex-1 gap-2">
                  {added ? <><Check className="w-4 h-4" /> Hinzugefügt</> : <><ShoppingCart className="w-4 h-4" /> In den Warenkorb</>}
                </Button>
              </div>
            )}

            <div className="flex flex-col gap-2 pt-4 border-t border-border">
              {[
                { icon: Shield, text: "Hergestellt in der Schweiz" },
                { icon: Zap, text: "Versand innerhalb 2-5 Werktagen" },
                { icon: Star, text: "Handgefertigte Qualität" },
              ].map(({ icon: Icon, text }) => (
                <div key={text} className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Icon className="w-3.5 h-3.5 text-primary flex-shrink-0" />{text}
                </div>
              ))}
            </div>

            {product.tags && product.tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-4">
                {product.tags.map(tag => (
                  <span key={tag} className="flex items-center gap-1 text-[10px] px-2 py-1 bg-muted rounded text-muted-foreground">
                    <Tag className="w-2.5 h-2.5" />{tag}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        {product.beschreibung && (
          <ScrollReveal>
            <div className="mb-16 max-w-3xl">
              <h2 className="font-heading text-xl font-bold mb-4">Produktbeschreibung</h2>
              <div className="prose prose-sm text-muted-foreground leading-relaxed whitespace-pre-line">{product.beschreibung}</div>
            </div>
          </ScrollReveal>
        )}

        {related.length > 0 && (
          <ScrollReveal>
            <div>
              <h2 className="font-heading text-xl font-bold mb-6">Ähnliche Produkte</h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {related.map(r => {
                  const primaryImg = [...(r.shop_product_images || [])].sort((a: any) => a.is_primary ? -1 : 1)[0];
                  return (
                    <Link key={r.id} to={`/shop/${r.slug}`}>
                      <motion.div className="group bg-card rounded-xl border border-border hover:border-primary/30 overflow-hidden transition-all" whileHover={{ y: -3 }}>
                        <div className="aspect-square bg-muted overflow-hidden">
                          <img src={primaryImg ? getImageUrl(primaryImg.storage_path) : "/placeholder.svg"} alt={r.name}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                        </div>
                        <div className="p-3">
                          <p className="text-sm font-semibold text-foreground line-clamp-1">{r.name}</p>
                          <p className="text-sm font-bold text-primary mt-1">CHF {r.preis.toFixed(2)}</p>
                        </div>
                      </motion.div>
                    </Link>
                  );
                })}
              </div>
            </div>
          </ScrollReveal>
        )}
      </div>
    </div>
  );
}
