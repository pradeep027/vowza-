import { useCart } from '@/contexts/CartContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Trash2, ShoppingBag, Calendar, Clock, IndianRupee } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const Cart = () => {
  const { cart, removeFromCart, clearCart, cartTotal } = useCart();
  const navigate = useNavigate();

  if (cart.length === 0) {
    return (
      <Card className="border-gold/20">
        <CardContent className="flex flex-col items-center justify-center py-12">
          <ShoppingBag className="w-16 h-16 text-muted-foreground mb-4" />
          <p className="text-muted-foreground text-center">Your cart is empty</p>
          <Button 
            variant="outline" 
            className="mt-4"
            onClick={() => navigate('/artists')}
          >
            Browse Artists
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-gold/20">
      <CardHeader>
        <CardTitle className="flex flex-col items-start gap-2 sm:flex-row sm:items-center sm:justify-between">
          <span className="flex items-center gap-2">
            <ShoppingBag className="w-5 h-5" />
            Shopping Cart ({cart.length})
          </span>
          <Badge variant="secondary" className="bg-gold text-white">
            ₹{cartTotal.toLocaleString()}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {cart.map((item) => (
          <div key={item.providerId} className="flex flex-col gap-3 p-4 rounded-lg bg-muted/30 border border-border sm:flex-row sm:items-start sm:gap-4">
            <div className="flex-1 min-w-0">
              <h4 className="font-semibold">{item.providerName}</h4>
              <p className="text-sm text-muted-foreground">{item.profession}</p>
              {item.package && (
                <Badge variant="outline" className="mt-2">{item.package}</Badge>
              )}
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 sm:gap-4 mt-2 text-sm text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Calendar className="w-4 h-4" />
                  {item.date}
                </span>
                <span className="flex items-center gap-1">
                  <Clock className="w-4 h-4" />
                  {item.time}
                </span>
                <span className="flex items-center gap-1">
                  {item.duration}h
                </span>
              </div>
            </div>
            <div className="flex items-center justify-between sm:block sm:text-right">
              <p className="font-semibold text-gold">₹{item.price.toLocaleString()}</p>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => removeFromCart(item.providerId)}
                className="text-red-500 hover:text-red-700 sm:mt-2"
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          </div>
        ))}
        
        <div className="border-t pt-4 space-y-3">
          <div className="flex justify-between items-center">
            <span className="text-muted-foreground">Subtotal</span>
            <span className="font-semibold">₹{cartTotal.toLocaleString()}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-muted-foreground">Platform Fee</span>
            <span className="font-semibold">₹{Math.round(cartTotal * 0.05).toLocaleString()}</span>
          </div>
          <div className="flex justify-between items-center text-lg font-bold">
            <span>Total</span>
            <span className="text-gold">₹{Math.round(cartTotal * 1.05).toLocaleString()}</span>
          </div>
          <Button 
            className="w-full bg-gradient-gold hover:opacity-90"
            onClick={() => navigate('/checkout')}
          >
            Proceed to Checkout
          </Button>
          <Button 
            variant="ghost" 
            className="w-full"
            onClick={clearCart}
          >
            Clear Cart
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default Cart;
