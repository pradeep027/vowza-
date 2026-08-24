import { createContext, useContext, useState, useEffect, useCallback, useMemo, ReactNode } from 'react';
import { toast } from 'sonner';

/* ─── Types ────────────────────────────────────────────────────────────────── */
export interface CartItem {
  /** Unique key: `${category}_${packageId}` */
  id: string;
  packageId: string;
  providerId: string;
  providerName: string;
  category: string;
  /** DB table for this category's packages */
  packageTable: string;
  /** DB table for bookings */
  bookingTable: string;
  packageName: string;
  price: number;
  duration?: string;
  imageUrl?: string;
  addedAt: number;
}

/** A scope groups items by vendor + category */
export interface CartScope {
  key: string; // `${providerId}_${category}`
  providerId: string;
  providerName: string;
  category: string;
  items: CartItem[];
  total: number;
  count: number;
}

interface CartContextType {
  /** All items across all scopes */
  cart: CartItem[];
  /** Total count across all scopes */
  cartCount: number;
  /** Total amount across all scopes */
  cartTotal: number;

  /** Add item to its vendor+category scope */
  addToCart: (item: Omit<CartItem, 'id' | 'addedAt'>) => void;
  /** Remove a single item by ID */
  removeFromCart: (itemId: string) => void;
  /** Check if a package is already in any cart */
  isInCart: (packageId: string, category: string) => boolean;

  /** Get items for a specific vendor+category scope */
  getScopedCart: (providerId: string, category: string) => CartItem[];
  /** Get total for a specific scope */
  getScopedTotal: (providerId: string, category: string) => number;
  /** Get count for a specific scope */
  getScopedCount: (providerId: string, category: string) => number;
  /** Clear only items in a specific scope */
  clearScopedCart: (providerId: string, category: string) => void;

  /** Get all active scopes grouped */
  getAllScopes: () => CartScope[];

  /** Clear everything */
  clearCart: () => void;
}

const STORAGE_KEY = 'vowza_cart';

/* ─── Helpers ──────────────────────────────────────────────────────────────── */
function loadCart(): CartItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed;
  } catch {
    return [];
  }
}

function saveCart(items: CartItem[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  } catch { /* storage full — degrade gracefully */ }
}

function makeScopeKey(providerId: string, category: string): string {
  return `${providerId}_${category}`;
}

/* ─── Context ──────────────────────────────────────────────────────────────── */
const CartContext = createContext<CartContextType | undefined>(undefined);

export const CartProvider = ({ children }: { children: ReactNode }) => {
  const [cart, setCart] = useState<CartItem[]>(loadCart);

  useEffect(() => { saveCart(cart); }, [cart]);

  const isInCart = useCallback(
    (packageId: string, category: string) =>
      cart.some(item => item.packageId === packageId && item.category === category),
    [cart]
  );

  const addToCart = useCallback((item: Omit<CartItem, 'id' | 'addedAt'>) => {
    const itemId = `${item.category}_${item.packageId}`;
    setCart(prev => {
      if (prev.some(i => i.id === itemId)) {
        toast.info('Already in cart');
        return prev;
      }
      toast.success('Added to cart');
      return [...prev, { ...item, id: itemId, addedAt: Date.now() }];
    });
  }, []);

  const removeFromCart = useCallback((itemId: string) => {
    setCart(prev => prev.filter(item => item.id !== itemId));
    toast.success('Removed from cart');
  }, []);

  const clearCart = useCallback(() => {
    setCart([]);
    localStorage.removeItem(STORAGE_KEY);
  }, []);

  // ─── Scoped helpers ─────────────────────────────────────────────────────
  const getScopedCart = useCallback((providerId: string, category: string): CartItem[] => {
    return cart.filter(item => item.providerId === providerId && item.category === category);
  }, [cart]);

  const getScopedTotal = useCallback((providerId: string, category: string): number => {
    return cart
      .filter(item => item.providerId === providerId && item.category === category)
      .reduce((sum, item) => sum + item.price, 0);
  }, [cart]);

  const getScopedCount = useCallback((providerId: string, category: string): number => {
    return cart.filter(item => item.providerId === providerId && item.category === category).length;
  }, [cart]);

  const clearScopedCart = useCallback((providerId: string, category: string) => {
    setCart(prev => prev.filter(item => !(item.providerId === providerId && item.category === category)));
  }, []);

  const getAllScopes = useCallback((): CartScope[] => {
    const scopeMap = new Map<string, CartScope>();
    for (const item of cart) {
      const key = makeScopeKey(item.providerId, item.category);
      if (!scopeMap.has(key)) {
        scopeMap.set(key, {
          key,
          providerId: item.providerId,
          providerName: item.providerName,
          category: item.category,
          items: [],
          total: 0,
          count: 0,
        });
      }
      const scope = scopeMap.get(key)!;
      scope.items.push(item);
      scope.total += item.price;
      scope.count += 1;
    }
    return Array.from(scopeMap.values());
  }, [cart]);

  const cartTotal = useMemo(() => cart.reduce((sum, item) => sum + item.price, 0), [cart]);
  const cartCount = cart.length;

  return (
    <CartContext.Provider value={{
      cart, cartCount, cartTotal,
      addToCart, removeFromCart, isInCart,
      getScopedCart, getScopedTotal, getScopedCount, clearScopedCart,
      getAllScopes, clearCart,
    }}>
      {children}
    </CartContext.Provider>
  );
};

export const useCart = () => {
  const context = useContext(CartContext);
  if (context === undefined) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
};
