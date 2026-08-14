import { useCart } from '@/contexts/CartContext';
import { usePlatformFee, calculatePlatformFee } from '@/hooks/usePlatformFee';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Trash2, ShoppingBag, IndianRupee, ArrowLeft, ArrowRight } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';

/**
 * Cart page — shows scoped carts grouped by vendor+category.
 * If ?vendor=X&category=Y is in the URL, shows only that scope's cart.
 * Otherwise shows all active scopes as a summary.
 */
const Cart = () => {
  const { cart, cartCount, getAllScopes, getScopedCart, getScopedTotal, removeFromCart, clearScopedCart } = useCart();
  const { data: feeConfig } = usePlatformFee();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const scopeVendor = searchParams.get('vendor');
  const scopeCategory = searchParams.get('category');
  const isScopedView = !!(scopeVendor && scopeCategory);

  // ─── SCOPED VIEW: single vendor+category cart ────────────────────────────
  if (isScopedView) {
    const items = getScopedCart(scopeVendor, scopeCategory);
    const total = getScopedTotal(scopeVendor, scopeCategory);
    const providerName = items[0]?.providerName || 'Artist';

    if (items.length === 0) {
      return (
        <div className="min-h-screen bg-gradient-to-br from-cream via-background to-blush/20 py-12 px-4">
          <div className="max-w-2xl mx-auto">
            <Button variant="ghost" onClick={() => navigate('/cart')} className="mb-6">
              <ArrowLeft className="w-4 h-4 mr-2" /> All Carts
            </Button>
            <Card className="border-gold/20">
              <CardContent className="flex flex-col items-center justify-center py-16">
                <ShoppingBag className="w-16 h-16 text-muted-foreground mb-4" />
                <h2 className="text-xl font-semibold mb-2">Cart is empty</h2>
                <p className="text-muted-foreground text-center mb-6">No packages in this cart</p>
                <Button className="bg-gradient-gold hover:opacity-90" onClick={() => navigate('/artists')}>Browse Packages</Button>
              </CardContent>
            </Card>
          </div>
        </div>
      );
    }

    return (
      <div className="min-h-screen bg-gradient-to-br from-cream via-background to-blush/20 py-12 px-4">
        <div className="max-w-3xl mx-auto">
          <Button variant="ghost" onClick={() => navigate('/cart')} className="mb-6">
            <ArrowLeft className="w-4 h-4 mr-2" /> All Carts
          </Button>

          {/* Scope header */}
          <div className="mb-6">
            <h1 className="text-2xl font-display font-bold flex items-center gap-2">
              <ShoppingBag className="w-6 h-6" /> Package Cart
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              <span className="font-semibold text-foreground">{providerName}</span> · <span className="capitalize">{scopeCategory}</span>
            </p>
          </div>

          {/* Items */}
          <Card className="border-gold/20 mb-6">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">{items.length} Package{items.length > 1 ? 's' : ''}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {items.map(item => (
                <div key={item.id} className="flex items-start gap-3 p-3 rounded-lg bg-muted/30 border border-border">
                  {item.imageUrl && <img src={item.imageUrl} alt={item.packageName} className="w-16 h-16 rounded-lg object-cover flex-shrink-0" />}
                  <div className="flex-1 min-w-0">
                    <h4 className="font-semibold text-sm truncate">{item.packageName}</h4>
                    {item.duration && <span className="text-xs text-muted-foreground">{item.duration}</span>}
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <p className="font-semibold text-gold whitespace-nowrap">
                      <IndianRupee className="w-3 h-3 inline" />{item.price.toLocaleString()}
                    </p>
                    <Button variant="ghost" size="sm" onClick={() => removeFromCart(item.id)} className="text-red-500 hover:text-red-700 h-7 w-7 p-0">
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Summary + Checkout */}
          <Card className="border-gold/20">
            <CardContent className="py-5 space-y-3">
              {(() => {
                const fee = feeConfig ? calculatePlatformFee(total, feeConfig) : 0;
                const grandTotal = total + fee;
                const advance = Math.round(grandTotal * 0.2);
                const remaining = grandTotal - advance;
                return (
                  <>
                    <div className="flex justify-between text-sm"><span className="text-muted-foreground">Subtotal ({items.length} package{items.length > 1 ? 's' : ''})</span><span className="font-semibold">₹{total.toLocaleString()}</span></div>
                    <div className="flex justify-between text-sm"><span className="text-muted-foreground">Platform Fee{feeConfig?.type === 'percentage' ? ` (${feeConfig.rate}%)` : ''}</span><span>₹{fee.toLocaleString()}</span></div>
                    <div className="flex justify-between text-sm font-semibold"><span>Total</span><span>₹{grandTotal.toLocaleString()}</span></div>
                    <div className="flex justify-between text-sm"><span className="text-muted-foreground">Advance Payable (20%)</span><span className="font-medium text-[#8B1538]">₹{advance.toLocaleString()}</span></div>
                    <div className="flex justify-between text-sm"><span className="text-muted-foreground">Remaining Balance</span><span>₹{remaining.toLocaleString()}</span></div>
                  </>
                );
              })()}
              <Button
                className="w-full bg-gradient-gold hover:opacity-90 text-base h-12 mt-2"
                onClick={() => navigate(`/checkout?vendor=${scopeVendor}&category=${scopeCategory}`)}
              >
                Proceed to Checkout
              </Button>
              <div className="flex gap-3">
                <Button variant="outline" className="flex-1" onClick={() => navigate(-1)}>Continue Shopping</Button>
                <Button variant="ghost" className="flex-1 text-red-500 hover:text-red-700" onClick={() => { clearScopedCart(scopeVendor, scopeCategory); navigate('/cart'); }}>
                  Clear Cart
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // ─── ALL SCOPES VIEW: grouped summary ────────────────────────────────────
  const scopes = getAllScopes();

  if (scopes.length === 0) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-cream via-background to-blush/20 py-12 px-4">
        <div className="max-w-2xl mx-auto">
          <Button variant="ghost" onClick={() => navigate(-1)} className="mb-6">
            <ArrowLeft className="w-4 h-4 mr-2" /> Back
          </Button>
          <Card className="border-gold/20">
            <CardContent className="flex flex-col items-center justify-center py-16">
              <ShoppingBag className="w-16 h-16 text-muted-foreground mb-4" />
              <h2 className="text-xl font-semibold mb-2">Your carts are empty</h2>
              <p className="text-muted-foreground text-center mb-6">Browse packages from our artists and add them to your cart</p>
              <Button className="bg-gradient-gold hover:opacity-90" onClick={() => navigate('/artists')}>Browse Packages</Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-cream via-background to-blush/20 py-12 px-4">
      <div className="max-w-3xl mx-auto">
        <Button variant="ghost" onClick={() => navigate(-1)} className="mb-6">
          <ArrowLeft className="w-4 h-4 mr-2" /> Back
        </Button>

        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-display font-bold flex items-center gap-2">
            <ShoppingBag className="w-6 h-6" /> Your Carts
          </h1>
          <Badge variant="secondary" className="bg-gold text-white text-sm px-3 py-1">
            {cartCount} item{cartCount > 1 ? 's' : ''} · {scopes.length} cart{scopes.length > 1 ? 's' : ''}
          </Badge>
        </div>

        <div className="space-y-4">
          {scopes.map(scope => (
            <Card key={scope.key} className="border-gold/20 hover:shadow-md transition-shadow">
              <CardContent className="p-5">
                <div className="flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <h3 className="font-semibold text-foreground truncate">{scope.providerName}</h3>
                    <p className="text-sm text-muted-foreground capitalize">{scope.category}</p>
                    <p className="text-xs text-muted-foreground mt-1">{scope.count} package{scope.count > 1 ? 's' : ''}</p>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <div className="text-right">
                      <p className="font-bold text-gold"><IndianRupee className="w-3 h-3 inline" />{scope.total.toLocaleString()}</p>
                    </div>
                    <Button
                      size="sm"
                      className="bg-[#8B1538] hover:bg-[#70102d] text-white"
                      onClick={() => navigate(`/cart?vendor=${scope.providerId}&category=${scope.category}`)}
                    >
                      View Cart <ArrowRight className="w-3.5 h-3.5 ml-1" />
                    </Button>
                  </div>
                </div>
                {/* Mini item preview */}
                <div className="flex flex-wrap gap-1.5 mt-3">
                  {scope.items.slice(0, 4).map(item => (
                    <span key={item.id} className="text-[11px] px-2 py-0.5 rounded-full bg-muted border border-border truncate max-w-[150px]">
                      {item.packageName}
                    </span>
                  ))}
                  {scope.items.length > 4 && <span className="text-[11px] text-muted-foreground">+{scope.items.length - 4} more</span>}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Cart;
