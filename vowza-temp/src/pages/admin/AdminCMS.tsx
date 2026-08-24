// ─── Admin CMS ────────────────────────────────────────────────────────────────
import { useState } from 'react';
import { Globe, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';

const sections = [
  { id: 'hero',        label: 'Hero Section',       desc: 'Headline, subheadline, CTA buttons' },
  { id: 'categories',  label: 'Featured Categories', desc: 'Homepage category display order' },
  { id: 'testimonials',label: 'Testimonials',         desc: 'Customer success stories' },
  { id: 'faq',         label: 'FAQs',                 desc: 'Frequently asked questions' },
  { id: 'about',       label: 'About Page',           desc: 'Company story and mission' },
  { id: 'terms',       label: 'Terms of Service',     desc: 'Legal terms and conditions' },
  { id: 'privacy',     label: 'Privacy Policy',       desc: 'Data handling policy' },
];

export default function AdminCMS() {
  const [active, setActive] = useState<string|null>(null);
  const [content, setContent] = useState('');

  const openSection = (id: string) => { setActive(id); setContent(''); };

  return (
    <div className="p-6 space-y-5">
      <div>
        <h1 className="text-2xl font-display font-bold text-foreground">CMS</h1>
        <p className="text-sm text-muted-foreground">Manage website content</p>
      </div>

      {active ? (
        <div className="space-y-4">
          <button onClick={() => setActive(null)} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
            ← Back to CMS
          </button>
          <div className="bg-white dark:bg-[#1a1a24] rounded-2xl border border-border/60 p-5 space-y-4">
            <h2 className="font-semibold text-foreground">{sections.find(s=>s.id===active)?.label}</h2>
            <textarea
              value={content}
              onChange={e => setContent(e.target.value)}
              rows={12}
              className="input-premium text-sm w-full resize-none font-mono"
              placeholder="Enter content in JSON or markdown format…"
            />
            <div className="flex gap-3">
              <button
                onClick={() => { toast.success('Content saved (DB table required)'); setActive(null); }}
                className="px-5 py-2.5 rounded-xl bg-maroon text-white text-sm font-semibold hover:opacity-90">
                Save Changes
              </button>
              <button onClick={() => setActive(null)} className="px-5 py-2.5 rounded-xl border border-border text-sm font-medium hover:bg-secondary">
                Cancel
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-white dark:bg-[#1a1a24] rounded-2xl border border-border/60 divide-y divide-border/40">
          {sections.map(s => (
            <button key={s.id} onClick={() => openSection(s.id)}
              className="w-full flex items-center justify-between px-5 py-4 hover:bg-surface-2 transition-colors text-left">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-secondary flex items-center justify-center">
                  <Globe className="w-4 h-4 text-muted-foreground"/>
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">{s.label}</p>
                  <p className="text-xs text-muted-foreground">{s.desc}</p>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-muted-foreground"/>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
