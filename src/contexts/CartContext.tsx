import React, { createContext, useContext, useState, useCallback, useEffect } from "react";

export interface SelectedOption {
  optionId: string;
  optionName: string;
  wertId: string;
  wertName: string;
  aufschlag: number;
}

export interface CartItem {
  id: string;
  productId: string;
  name: string;
  preis: number;
  quantity: number;
  image?: string;
  slug: string;
  optionen?: SelectedOption[];
}

const variantKey = (productId: string, optionen?: SelectedOption[]) =>
  `${productId}|${(optionen || []).map(o => `${o.optionId}:${o.wertId}`).sort().join(",")}`;

interface CartContextType {
  items: CartItem[];
  addItem: (item: Omit<CartItem, "id">) => void;
  removeItem: (itemId: string) => void;
  updateQuantity: (itemId: string, quantity: number) => void;
  clearCart: () => void;
  totalItems: number;
  totalPrice: number;
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
}

const CartContext = createContext<CartContextType | null>(null);
const STORAGE_KEY = "muscio_cart_v1";

export const useCart = () => {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within CartProvider");
  return ctx;
};


export const CartProvider = ({ children }: { children: React.ReactNode }) => {
  const [items, setItems] = useState<CartItem[]>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? (JSON.parse(raw) as CartItem[]) : [];
    } catch { return []; }
  });
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(items)); } catch {}
  }, [items]);

  const addItem = useCallback((newItem: Omit<CartItem, "id">) => {
    setItems(prev => {
      const key = variantKey(newItem.productId, newItem.optionen);
      const existing = prev.find(i => variantKey(i.productId, i.optionen) === key);
      if (existing) {
        return prev.map(i =>
          i.id === existing.id ? { ...i, quantity: i.quantity + newItem.quantity } : i
        );
      }
      return [...prev, { ...newItem, id: crypto.randomUUID() }];
    });
    setIsOpen(true);
  }, []);

  const removeItem = useCallback((itemId: string) => {
    setItems(prev => prev.filter(i => i.id !== itemId));
  }, []);

  const updateQuantity = useCallback((itemId: string, quantity: number) => {
    if (quantity <= 0) {
      setItems(prev => prev.filter(i => i.id !== itemId));
    } else {
      setItems(prev => prev.map(i => (i.id === itemId ? { ...i, quantity } : i)));
    }
  }, []);


  const clearCart = useCallback(() => setItems([]), []);

  const totalItems = items.reduce((sum, i) => sum + i.quantity, 0);
  const totalPrice = items.reduce((sum, i) => sum + i.preis * i.quantity, 0);

  return (
    <CartContext.Provider value={{
      items, addItem, removeItem, updateQuantity, clearCart,
      totalItems, totalPrice, isOpen, setIsOpen
    }}>
      {children}
    </CartContext.Provider>
  );
};
