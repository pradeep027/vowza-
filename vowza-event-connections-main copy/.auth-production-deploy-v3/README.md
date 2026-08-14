# Vowza — India's Premier Event Marketplace

**Where Talent Meets Celebration**

Vowza connects customers with verified event professionals — photographers, DJs, bands, makeup artists, decorators, caterers, pandits, banquet halls, and 50+ more categories — all from one trusted platform.

---

## Tech Stack

| Layer       | Technology                         |
|-------------|-------------------------------------|
| Frontend    | React 18, TypeScript, Vite          |
| Styling     | Tailwind CSS, shadcn/ui             |
| Backend     | Supabase (PostgreSQL + Auth + Storage) |
| State       | TanStack React Query                |
| Animations  | Framer Motion                       |
| Charts      | Recharts                            |
| Icons       | Lucide React                        |

---

## Local Development

```bash
# Install dependencies
npm install

# Start dev server
npm run dev
# → http://localhost:8080

# Build for production
npm run build
```

---

## Environment Variables

Copy `.env.example` to `.env` and fill in your Supabase credentials:

```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

---

## Database Setup

Run the SQL migrations in order in the Supabase SQL Editor:

1. `supabase/migrations/20260728000000_notifications_rls.sql`
2. `supabase/migrations/20260801000000_dynamic_marketplace_v2.sql`

---

## Key Features

- **Dynamic Category Marketplace** — 20 categories, each with subcategories, filters, and verified vendor listings
- **Vendor Profiles** — Cover image, portfolio gallery, pricing packages, FAQs, availability calendar
- **Category-Aware Vendor Dashboard** — Edit only the fields relevant to your profession
- **AI Event Planner** — Describe your event, get a full vendor list + budget breakdown
- **Admin Panel** — Approve/reject vendors, manage categories, view analytics
- **Secure Payments** — Escrow model via Razorpay (integration ready)
- **Real-time Notifications** — Booking updates, admin approvals, announcements

---

## Admin Setup

To promote a user to admin, run in the Supabase SQL Editor:

```sql
INSERT INTO public.user_roles (user_id, role)
VALUES ('<your-user-uuid>', 'admin')
ON CONFLICT DO NOTHING;
```

Then navigate to `/admin/dashboard`.

---

## License

© Vowza Technologies Pvt. Ltd. All rights reserved.
