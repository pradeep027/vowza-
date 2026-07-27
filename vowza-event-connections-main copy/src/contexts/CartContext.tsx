import { createContext, useContext, useState, ReactNode } from 'react';

interface CartItem {
  providerId: string;
  providerName: string;
  profession: string;
  price: number;
  date: string;
  time: string;
  duration: number;
  package?: string;
}

interface CartContextType {
  cart: CartItem[];
  addToCart: (item: CartItem) => void;
  removeFromCart: (providerId: string) => void;
  clearCart: () => void;
  isInCart: (providerId: string) => boolean;
  cartTotal: number;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export const CartProvider = ({ children }: { children: ReactNode }) => {
  const [cart, setCart] = useState<CartItem[]>([]);

  const addToCart = (item: CartItem) => {
    if (isInCart(item.providerId)) {
      return; // Already in cart
    }
    setCart([...cart, item]);
  };

  const removeFromCart = (providerId: string) => {
    setCart(cart.filter(item => item.providerId !== providerId));
  };

  const clearCart = () => {
    setCart([]);
  };

  const isInCart = (providerId: string) => {
    return cart.some(item => item.providerId === providerId);
  };

  const cartTotal = cart.reduce((total, item) => total + item.price, 0);

  return (
    <CartContext.Provider value={{ cart, addToCart, removeFromCart, clearCart, isInCart, cartTotal }}>
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
