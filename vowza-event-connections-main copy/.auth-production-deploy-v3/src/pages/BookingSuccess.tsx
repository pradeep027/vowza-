import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { CheckCircle, Calendar, Clock, MapPin, IndianRupee, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';

interface BookingDetails {
  bookingId: string;
  artistName: string;
  eventDate: string;
  eventTime: string;
  duration: string;
  venue: string;
  amount: number;
  advanceAmount?: number;
  remainingBalance?: number;
  eventType: string;
  status: string;
}

const BookingSuccess = () => {
  const navigate = useNavigate();
  const [details, setDetails] = useState<BookingDetails | null>(null);

  useEffect(() => {
    const raw = sessionStorage.getItem('vowza_booking_success');
    if (raw) {
      setDetails(JSON.parse(raw));
      sessionStorage.removeItem('vowza_booking_success');
    } else {
      navigate('/my-bookings');
    }
  }, [navigate]);

  if (!details) return null;

  const fmtDate = (iso: string) =>
    new Date(iso).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="pt-20 pb-16 px-4">
        <div className="max-w-lg mx-auto text-center">
          {/* Success icon */}
          <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-emerald-50 border-4 border-emerald-100 flex items-center justify-center">
            <CheckCircle className="w-10 h-10 text-emerald-500" />
          </div>

          <h1 className="text-2xl md:text-3xl font-display font-bold text-foreground mb-2">Booking Request Sent!</h1>
          <p className="text-muted-foreground mb-8">
            Your request has been sent to <span className="font-semibold text-foreground">{details.artistName}</span>. They typically respond within 24 hours.
          </p>

          {/* Booking details card */}
          <div className="text-left rounded-2xl border border-border/60 bg-white p-5 md:p-6 shadow-sm space-y-4 mb-8">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Booking ID</span>
              <span className="text-xs font-mono text-muted-foreground">{details.bookingId.slice(0, 8).toUpperCase()}</span>
            </div>
            <div className="border-t border-border/40" />
            <div className="space-y-3 text-sm">
              <div className="flex items-start gap-3">
                <Calendar className="w-4 h-4 text-[#8B1538] mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-semibold">{fmtDate(details.eventDate)}</p>
                  {details.eventTime && <p className="text-muted-foreground">{details.eventTime} · {details.duration} hours</p>}
                </div>
              </div>
              <div className="flex items-start gap-3">
                <MapPin className="w-4 h-4 text-[#8B1538] mt-0.5 flex-shrink-0" />
                <p>{details.venue}</p>
              </div>
              <div className="flex items-start gap-3">
                <IndianRupee className="w-4 h-4 text-[#8B1538] mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-semibold">₹{details.amount.toLocaleString()}</p>
                  {details.advanceAmount && <p className="text-xs text-muted-foreground">30% advance: ₹{details.advanceAmount.toLocaleString()} · Remaining: ₹{(details.remainingBalance || 0).toLocaleString()}</p>}
                </div>
              </div>
            </div>
            <div className="border-t border-border/40" />
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Status</span>
              <span className="px-2.5 py-1 rounded-full bg-amber-50 text-amber-700 text-xs font-semibold">Awaiting Response</span>
            </div>
            <p className="text-xs text-muted-foreground bg-blue-50 border border-blue-100 rounded-lg p-3">
              The artist will review your request and confirm within 24 hours. You'll receive a notification once they respond.
            </p>
          </div>

          {/* Actions */}
          <div className="space-y-3">
            <Link to="/my-bookings" className="block">
              <Button className="w-full bg-[#8B1538] hover:bg-[#70102d] text-white">
                View My Bookings <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </Link>
            <Link to="/artists" className="block">
              <Button variant="outline" className="w-full">Continue Browsing Artists</Button>
            </Link>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default BookingSuccess;
