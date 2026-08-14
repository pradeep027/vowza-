// ─── Terms of Service Page ────────────────────────────────────────────────────
import Footer from "@/components/Footer";
import LegalPageHeader from "@/components/LegalPageHeader";

const sections = [
  {
    title: "1. Acceptance of Terms",
    content:
      "By accessing or using the Vowza platform, you agree to be bound by these Terms of Service. If you do not agree, please do not use our platform.",
  },
  {
    title: "2. Platform Description",
    content:
      "Vowza is an online marketplace that connects customers with event service professionals (artists, photographers, decorators, caterers, and more). Vowza facilitates bookings but is not directly responsible for the quality of services delivered by artists.",
  },
  {
    title: "3. User Accounts",
    content:
      "You are responsible for maintaining the confidentiality of your account credentials and for all activities that occur under your account. You must be at least 18 years old to create an account.",
  },
  {
    title: "4. Bookings and Payments",
    content:
      "All bookings are subject to artist availability confirmation. Payments are processed securely and the advance is held in escrow until the event is completed. Refund eligibility depends on the cancellation policy at the time of booking.",
  },
  {
    title: "5. Artist Verification",
    content:
      "Vowza attempts to verify artist identities and credentials, but does not guarantee the accuracy of all information displayed on artist profiles. Customers are encouraged to review portfolios and ratings before booking.",
  },
  {
    title: "6. Prohibited Conduct",
    content:
      "Users may not post false information, engage in fraudulent transactions, harass other users, or misuse the platform. Vowza reserves the right to suspend or terminate accounts for violations.",
  },
  {
    title: "7. Limitation of Liability",
    content:
      "Vowza is not liable for indirect, incidental, or consequential damages arising from the use of our platform. Our liability is limited to the transaction value of the specific booking in dispute.",
  },
  {
    title: "8. Changes to Terms",
    content:
      "Vowza may update these terms at any time. Continued use of the platform after changes constitutes acceptance of the updated terms.",
  },
  {
    title: "9. Contact",
    content:
      "For legal queries, contact vowza.services@gmail.com or write to Vowza Technologies Pvt. Ltd., Hyderabad, India.",
  },
];

export default function TermsOfService() {
  return (
    <div className="min-h-screen bg-background">
      <LegalPageHeader title="Terms of Service" lastUpdated={new Date()} />
      <main>
        <div className="container px-4 py-10 md:py-16">
          <div className="max-w-3xl mx-auto">
            <p className="text-muted-foreground text-sm leading-relaxed mb-8">
              Please read these Terms of Service carefully before using the Vowza platform.
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
