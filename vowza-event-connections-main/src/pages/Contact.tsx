// ─── Contact Page ─────────────────────────────────────────────────────────────
import { useState } from "react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Mail, Phone, MapPin, Send, MessageCircle, Clock } from "lucide-react";
import { toast } from "sonner";
import { validateFullName, validateEmail, isGarbageText } from "@/utils/validation";

export default function Contact() {
  const [name,    setName]    = useState("");
  const [email,   setEmail]   = useState("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const nameCheck = validateFullName(name);
    if (!nameCheck.valid) { toast.error(nameCheck.error!); return; }
    const emailCheck = validateEmail(email);
    if (!emailCheck.valid) { toast.error(emailCheck.error!); return; }
    if (!message.trim()) { toast.error("Please enter your message."); return; }
    if (message.trim().length < 10) { toast.error("Message must be at least 10 characters."); return; }
    if (isGarbageText(message)) { toast.error("Please enter a meaningful message."); return; }
    setSending(true);
    // Simulated send — wire to email service or Supabase in production
    await new Promise(r => setTimeout(r, 1200));
    toast.success("Message sent! We'll get back to you within 24 hours.");
    setName(""); setEmail(""); setSubject(""); setMessage("");
    setSending(false);
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="pt-16 md:pt-18">
        <div className="container px-4 py-14 md:py-20">
          <div className="max-w-5xl mx-auto">

            {/* Header */}
            <div className="text-center mb-12">
              <div className="section-label bg-maroon/8 text-maroon mb-5 mx-auto inline-flex">Contact Us</div>
              <h1 className="text-3xl md:text-4xl font-display font-bold text-foreground mb-3">
                We're here to help
              </h1>
              <p className="text-muted-foreground max-w-lg mx-auto text-sm">
                Have a question, feedback, or need support? Reach out and our team will respond within 24 hours.
              </p>
            </div>

            <div className="grid md:grid-cols-2 gap-8">

              {/* Contact info */}
              <div className="space-y-5">
                {[
                  { icon: Mail,     label: "Email",    value: "vowza.services@gmail.com",    href: "mailto:vowza.services@gmail.com" },
                  { icon: Phone,    label: "Phone",    value: "+91 87123 21751",    href: "tel:+918712321751" },
                  { icon: Phone,    label: "Phone 2",  value: "+91 89190 73577",    href: "tel:+918919073577" },
                  { icon: Phone,    label: "Phone 3",  value: "+91 90329 51931",    href: "tel:+919032951931" },
                  { icon: Phone,    label: "Phone 4",  value: "+91 75693 64703",    href: "tel:+917569364703" },
                  { icon: MapPin,   label: "Address",  value: "Hyderabad, India", href: undefined },
                  { icon: Clock,    label: "Hours",    value: "Mon–Sat, 9 AM – 7 PM IST", href: undefined },
                  { icon: MessageCircle, label: "Support",  value: "vowza.services@gmail.com",    href: "mailto:vowza.services@gmail.com" },
                ].map(({ icon: Icon, label, value, href }) => (
                  <div key={label} className="flex items-start gap-4 p-5 bg-surface-1 rounded-2xl border border-border/60">
                    <div className="w-10 h-10 rounded-xl bg-maroon/8 flex items-center justify-center flex-shrink-0">
                      <Icon className="w-5 h-5 text-maroon" />
                    </div>
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">{label}</p>
                      {href ? (
                        <a href={href} className="text-sm font-medium text-foreground hover:text-maroon transition-colors">
                          {value}
                        </a>
                      ) : (
                        <p className="text-sm font-medium text-foreground">{value}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* Contact form */}
              <div className="bg-surface-1 rounded-2xl border border-border/60 p-6 md:p-7">
                <h2 className="text-lg font-display font-semibold text-foreground mb-5">Send a Message</h2>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label htmlFor="c-name" className="text-xs font-semibold text-muted-foreground block mb-1.5">Name *</label>
                      <input id="c-name" type="text" value={name} onChange={e => setName(e.target.value)} required placeholder="Your name" className="input-premium text-sm w-full" />
                    </div>
                    <div>
                      <label htmlFor="c-email" className="text-xs font-semibold text-muted-foreground block mb-1.5">Email *</label>
                      <input id="c-email" type="email" value={email} onChange={e => setEmail(e.target.value)} required placeholder="your@email.com" className="input-premium text-sm w-full" />
                    </div>
                  </div>
                  <div>
                    <label htmlFor="c-subject" className="text-xs font-semibold text-muted-foreground block mb-1.5">Subject</label>
                    <input id="c-subject" type="text" value={subject} onChange={e => setSubject(e.target.value)} placeholder="How can we help?" className="input-premium text-sm w-full" />
                  </div>
                  <div>
                    <label htmlFor="c-message" className="text-xs font-semibold text-muted-foreground block mb-1.5">Message *</label>
                    <textarea id="c-message" rows={5} value={message} onChange={e => setMessage(e.target.value)} required placeholder="Tell us more about your query…" className="input-premium text-sm w-full resize-none" />
                  </div>
                  <button
                    type="submit"
                    disabled={sending}
                    className="btn-primary w-full justify-center py-3"
                  >
                    {sending ? "Sending…" : (
                      <><Send className="w-4 h-4" /> Send Message</>
                    )}
                  </button>
                </form>
              </div>
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
