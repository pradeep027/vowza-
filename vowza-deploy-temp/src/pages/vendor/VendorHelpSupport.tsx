import { useState } from 'react';
import { HelpCircle, Phone, Mail, Clock, ChevronDown, ChevronUp, Search, MessageSquare } from 'lucide-react';

const FAQS = [
  { q: 'How do I accept a booking?', a: 'Go to Bookings → Pending tab. Click "Accept" on the booking request. The customer will be notified and asked to pay the advance.' },
  { q: 'How do I block a date?', a: 'Go to Calendar → click "Block Dates". Select start and end dates, optionally add a reason, then confirm. Customers cannot book you on blocked dates.' },
  { q: 'When will a booking appear as confirmed?', a: 'After you accept a request and the customer pays the required advance, the booking automatically moves to "Confirmed" status.' },
  { q: 'How do customers pay me?', a: 'Customers pay a 20% advance to confirm the booking. The remaining amount is paid directly to you at the event. Vowza holds the advance securely until service completion.' },
  { q: 'How do I update my profile?', a: 'Go to Profile Settings. You can update your name, bio, location, languages, photos, and all other profile details.' },
  { q: 'How do I change my availability?', a: 'Use the Calendar page to block dates when you are unavailable. Confirmed bookings automatically appear on your calendar.' },
  { q: 'How do I create a package?', a: 'Go to Services & Packages → click "Add Package". Follow the step-by-step wizard to set name, pricing, services included, and media.' },
  { q: 'How do I upload portfolio photos/videos?', a: 'Go to Portfolio → click Upload. Select images or videos from your device. They will appear on your public profile.' },
  { q: 'What happens if I decline a booking?', a: 'The customer is notified that their request was declined. The booking moves to Declined status. No charges apply.' },
  { q: 'How do I contact Vowza support?', a: 'Scroll down on this page to see the support phone number and email. You can call or email us during support hours.' },
  { q: 'How long does profile verification take?', a: 'Profile verification typically takes 24–48 hours after you complete your registration and upload required documents.' },
  { q: 'Can I have multiple packages?', a: 'Yes! You can create as many packages as you need with different pricing, services, and specializations.' },
];

const SECTIONS = [
  { title: 'Getting Started', items: ['Complete your artist profile', 'Add services and packages', 'Upload portfolio photos & videos', 'Set your availability on the calendar'] },
  { title: 'Bookings', items: ['How booking requests work', 'Accepting or declining requests', 'Confirmed bookings', 'Advance payment process', 'Booking completion'] },
  { title: 'Calendar', items: ['Block dates when unavailable', 'View confirmed bookings', 'Manage your availability'] },
  { title: 'Payments', items: ['Advance payments (20%)', 'Remaining payment at event', 'Earnings in Wallet', 'Bank account setup'] },
  { title: 'Account', items: ['Login & security', 'Profile settings', 'Notification preferences'] },
];

export default function VendorHelpSupport() {
  const [searchQ, setSearchQ] = useState('');
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  const filteredFaqs = searchQ.trim()
    ? FAQS.filter(f => f.q.toLowerCase().includes(searchQ.toLowerCase()) || f.a.toLowerCase().includes(searchQ.toLowerCase()))
    : FAQS;

  return (
    <div className="space-y-8 max-w-[900px]">
      <div>
        <h1 className="text-xl font-bold text-foreground">Help & Support</h1>
        <p className="text-sm text-muted-foreground mt-1">How can we help you?</p>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input value={searchQ} onChange={e => setSearchQ(e.target.value)} placeholder="Search help topics..."
          className="w-full pl-9 pr-4 py-3 rounded-xl border border-border/60 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[#8B1538]/20" />
      </div>

      {/* Quick Help Sections */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {SECTIONS.map(s => (
          <div key={s.title} className="bg-white rounded-2xl border border-border/60 p-5">
            <h3 className="text-sm font-semibold text-foreground mb-3">{s.title}</h3>
            <ul className="space-y-2">
              {s.items.map(item => (
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
              {openFaq === i && (
                <p className="mt-2 text-xs text-muted-foreground leading-relaxed pl-0">{faq.a}</p>
              )}
            </div>
          ))}
          {filteredFaqs.length === 0 && (
            <p className="py-6 text-center text-sm text-muted-foreground">No matching questions found.</p>
          )}
        </div>
      </div>

      {/* Contact Support */}
      <div className="bg-white rounded-2xl border border-border/60 p-6">
        <h2 className="text-base font-semibold text-foreground mb-4">Contact Vowza Support</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="flex items-center gap-3 p-4 rounded-xl bg-[#8B1538]/5 border border-[#8B1538]/10">
            <Phone className="w-5 h-5 text-[#8B1538]" />
            <div>
              <p className="text-xs text-muted-foreground">Phone</p>
              <p className="text-sm font-semibold text-foreground">+91 93918 08498</p>
            </div>
          </div>
          <div className="flex items-center gap-3 p-4 rounded-xl bg-[#8B1538]/5 border border-[#8B1538]/10">
            <Mail className="w-5 h-5 text-[#8B1538]" />
            <div>
              <p className="text-xs text-muted-foreground">Email</p>
              <p className="text-sm font-semibold text-foreground">support@vowza.in</p>
            </div>
          </div>
          <div className="flex items-center gap-3 p-4 rounded-xl bg-[#8B1538]/5 border border-[#8B1538]/10">
            <Clock className="w-5 h-5 text-[#8B1538]" />
            <div>
              <p className="text-xs text-muted-foreground">Hours</p>
              <p className="text-sm font-semibold text-foreground">Mon–Sat, 9AM–6PM</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
