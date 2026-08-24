import { useState } from 'react';
import { HelpCircle, Phone, Mail, Clock, ChevronDown, ChevronUp, Search } from 'lucide-react';

const FAQS = [
  { q: 'How do I book an artist?', a: 'Browse artists by category, open their profile, select a package, and click "Book Now". Follow the steps to enter event details, location, and requirements, then confirm your booking.' },
  { q: 'How can I check my booking status?', a: 'Go to My Bookings from your dashboard. You\'ll see all your bookings organized by status: Active (pending/confirmed) and Past (completed/cancelled).' },
  { q: 'How do I cancel a booking?', a: 'Open the booking from My Bookings, then click "Cancel". Note that cancellation policies may apply depending on the booking stage.' },
  { q: 'What happens after an artist accepts my request?', a: 'You\'ll receive a notification that your booking is accepted. You\'ll then need to pay the 20% advance to confirm the booking.' },
  { q: 'How do I make the advance payment?', a: 'Once your booking is accepted, go to My Bookings → find the accepted booking → click "Pay 20% Advance". The payment confirms your booking.' },
  { q: 'How do I know if my payment was successful?', a: 'After successful payment, your booking status changes to "Confirmed" and you\'ll receive a confirmation notification.' },
  { q: 'Can I contact an artist before booking?', a: 'Yes! Every artist profile has a chat/message feature. You can discuss requirements, ask questions, and get clarity before booking.' },
  { q: 'What happens if an artist declines my request?', a: 'You\'ll receive a notification that the booking was declined. No charges apply. You can browse and book other available artists.' },
  { q: 'How do I update my event location?', a: 'Event location is set during booking. If you need to change it after booking, please contact the artist directly via messages.' },
  { q: 'How do I change my profile details?', a: 'Go to My Profile from your dashboard. You can update your name, email, phone, and other personal details.' },
  { q: 'How does Vowza AI Planner work?', a: 'Describe your event — type, guest count, city, and budget — and the AI Planner builds a complete vendor list, timeline, and estimated budget in seconds.' },
  { q: 'What if the artist doesn\'t show up?', a: 'Contact Vowza Support immediately. Your advance payment is held securely by Vowza and will be refunded if the artist fails to deliver.' },
];

const CATEGORIES = [
  { title: 'Booking Help', items: ['How to book an artist', 'Booking confirmation process', 'Event details and location', 'Rescheduling a booking'] },
  { title: 'Payments & Refunds', items: ['Advance payment (20%)', 'Payment methods', 'Refund policy', 'Payment issues'] },
  { title: 'Artist Issues', items: ['Artist not responding', 'Quality concerns', 'Artist cancelled', 'Dispute resolution'] },
  { title: 'Account & Profile', items: ['Update personal info', 'Change password', 'Notification settings', 'Delete account'] },
  { title: 'Cancellations', items: ['How to cancel', 'Cancellation policy', 'Refund timeline', 'Partial cancellations'] },
];

export default function CustomerHelpSupport() {
  const [searchQ, setSearchQ] = useState('');
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  const filteredFaqs = searchQ.trim()
    ? FAQS.filter(f => f.q.toLowerCase().includes(searchQ.toLowerCase()) || f.a.toLowerCase().includes(searchQ.toLowerCase()))
    : FAQS;

  return (
    <div className="space-y-8 max-w-[900px]">
      <div>
        <h1 className="text-xl font-bold text-foreground">Help & Support</h1>
        <p className="text-sm text-muted-foreground mt-1">We're here to help you with bookings, payments, artists, and anything else you need.</p>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input value={searchQ} onChange={e => setSearchQ(e.target.value)} placeholder="Search help topics..."
          className="w-full pl-9 pr-4 py-3 rounded-xl border border-border/60 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[#8B1538]/20" />
      </div>

      {/* Categories */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {CATEGORIES.map(c => (
          <div key={c.title} className="bg-white rounded-2xl border border-border/60 p-5">
            <h3 className="text-sm font-semibold text-foreground mb-3">{c.title}</h3>
            <ul className="space-y-2">
              {c.items.map(item => (
                <li key={item} className="flex items-start gap-2 text-xs text-muted-foreground">
                  <HelpCircle className="w-3 h-3 mt-0.5 text-[#8B1538] shrink-0" />{item}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      {/* FAQ */}
      <div className="bg-white rounded-2xl border border-border/60 p-6">
        <h2 className="text-base font-semibold text-foreground mb-4">Frequently Asked Questions</h2>
        <div className="divide-y divide-border/40">
          {filteredFaqs.map((faq, i) => (
            <div key={i} className="py-3">
              <button onClick={() => setOpenFaq(openFaq === i ? null : i)} className="w-full flex items-center justify-between text-left gap-3">
                <span className="text-sm font-medium text-foreground">{faq.q}</span>
                {openFaq === i ? <ChevronUp className="w-4 h-4 text-muted-foreground shrink-0" /> : <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />}
              </button>
              {openFaq === i && <p className="mt-2 text-xs text-muted-foreground leading-relaxed">{faq.a}</p>}
            </div>
          ))}
          {filteredFaqs.length === 0 && <p className="py-6 text-center text-sm text-muted-foreground">No matching questions found.</p>}
        </div>
      </div>

      {/* Contact */}
      <div className="bg-white rounded-2xl border border-border/60 p-6">
        <h2 className="text-base font-semibold text-foreground mb-4">Contact Vowza Support</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="flex items-center gap-3 p-4 rounded-xl bg-[#8B1538]/5 border border-[#8B1538]/10">
            <Phone className="w-5 h-5 text-[#8B1538]" />
            <div><p className="text-xs text-muted-foreground">Phone</p><p className="text-sm font-semibold text-foreground">+91 93918 08498</p></div>
          </div>
          <div className="flex items-center gap-3 p-4 rounded-xl bg-[#8B1538]/5 border border-[#8B1538]/10">
            <Mail className="w-5 h-5 text-[#8B1538]" />
            <div><p className="text-xs text-muted-foreground">Email</p><p className="text-sm font-semibold text-foreground">support@vowza.in</p></div>
          </div>
          <div className="flex items-center gap-3 p-4 rounded-xl bg-[#8B1538]/5 border border-[#8B1538]/10">
            <Clock className="w-5 h-5 text-[#8B1538]" />
            <div><p className="text-xs text-muted-foreground">Hours</p><p className="text-sm font-semibold text-foreground">Mon–Sat, 9AM–6PM</p></div>
          </div>
        </div>
      </div>
    </div>
  );
}
