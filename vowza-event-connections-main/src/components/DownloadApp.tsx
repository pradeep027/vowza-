// ─── DownloadApp — App download CTA section ──────────────────────────────────
import { Smartphone, Star, Users, ArrowRight } from "lucide-react";

const DownloadApp = () => (
  <section className="py-20 md:py-28 bg-[#09090f] overflow-hidden">
    <div className="container px-4">
      <div className="relative max-w-4xl mx-auto text-center">
        {/* Glow */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[400px] rounded-full opacity-15 blur-[100px]"
          style={{ background: "radial-gradient(circle, hsl(345 72% 36%), transparent 70%)" }} />

        <div className="relative z-10">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-white/10 bg-white/5 mb-8">
            <Smartphone className="w-4 h-4 text-gold" />
            <span className="text-sm font-medium text-white/70">Coming Soon to iOS & Android</span>
          </div>

          <h2 className="text-3xl md:text-5xl font-display font-bold text-white mb-5 leading-tight">
            Vowza in Your Pocket.<br />
            <span className="text-gradient-gold">Book Anywhere, Anytime.</span>
          </h2>

          <p className="text-white/50 max-w-xl mx-auto mb-10 text-base">
            The full Vowza marketplace, Vowza AI Planner, real-time chat, and booking management — all in a beautiful mobile app.
          </p>

          {/* App store buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-10">
            {["App Store", "Google Play"].map(store => (
              <div
                key={store}
                className="flex items-center gap-3 px-6 py-4 rounded-2xl border border-white/12 bg-white/5 cursor-not-allowed opacity-60 w-full sm:w-auto"
              >
                <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center flex-shrink-0">
                  <Smartphone className="w-4 h-4 text-white/60" />
                </div>
                <div className="text-left">
                  <p className="text-[10px] text-white/40">Coming soon on</p>
                  <p className="text-sm font-semibold text-white/60">{store}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Stats */}
          <div className="flex flex-wrap items-center justify-center gap-8">
            {[
              { icon: Star,  label: "4.9 App Rating" },
              { icon: Users, label: "50K+ Pre-registered" },
              { icon: ArrowRight, label: "Notify Me →" },
            ].map(({ icon: Icon, label }) => (
              <div key={label} className="flex items-center gap-1.5 text-sm text-white/35">
                <Icon className="w-4 h-4 text-white/25" />
                <span>{label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  </section>
);

export default DownloadApp;
