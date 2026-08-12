// ─── Privacy Policy Page ──────────────────────────────────────────────────────
import Footer from "@/components/Footer";
import LegalPageHeader from "@/components/LegalPageHeader";

const sections = [
  {
    title: "1. Information We Collect",
    content:
      "We collect information you provide when you register, create a profile, make a booking, or contact us. This includes your name, email address, phone number, city, and payment information. We also collect usage data such as pages visited and search queries.",
  },
  {
    title: "2. How We Use Your Information",
    content:
      "We use your information to provide and improve our services, process bookings and payments, send you notifications about your bookings, and communicate platform updates. We do not sell your personal information to third parties.",
  },
  {
    title: "3. Information Sharing",
    content:
      "We share your information with artists you choose to book, our payment processing partners, and service providers who operate our infrastructure. All third parties are contractually required to protect your data.",
  },
  {
    title: "4. Data Security",
    content:
      "We implement industry-standard security measures including encryption, secure databases, and access controls to protect your personal information.",
  },
  {
    title: "5. Cookies",
    content:
      "We use cookies and similar technologies to keep you logged in, remember your preferences, and analyse platform usage. You can manage cookie preferences through your browser settings.",
  },
  {
    title: "6. Your Rights",
    content:
      "You have the right to access, correct, or delete your personal data at any time. To exercise these rights, contact us at privacy@vowza.com.",
  },
  {
    title: "7. Contact Us",
    content:
      "For privacy-related questions, email us at vowza.services@gmail.com or write to Vowza Technologies Pvt. Ltd., Hyderabad, India.",
  },
];

export default function PrivacyPolicy() {
  return (
    <div className="min-h-screen bg-background">
      <LegalPageHeader title="Privacy Policy" lastUpdated={new Date()} />
      <main>
        <div className="container px-4 py-10 md:py-16">
          <div className="max-w-3xl mx-auto">
            <p className="text-muted-foreground text-sm leading-relaxed mb-8">
              Vowza Technologies Pvt. Ltd. ("Vowza", "we", "our", "us") is committed to protecting your privacy. This policy explains how we collect, use, and protect your information when you use the Vowza platform.
            </p>

            <div className="space-y-8">
              {sections.map(s => (
                <div key={s.title} className="bg-surface-1 rounded-2xl border border-border/60 p-6">
                  <h2 className="text-base font-semibold text-foreground mb-3">{s.title}</h2>
                  <p className="text-sm text-muted-foreground leading-relaxed">{s.content}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
