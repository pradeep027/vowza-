// ─── Admin Analytics ──────────────────────────────────────────────────────────
import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import {
  AreaChart, Area, BarChart, Bar, LineChart, Line,
  PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import { RefreshCw } from 'lucide-react';

const COLORS = ['#C9323A','#D4A017','#3B5BDB','#2F9E44','#E8590C','#7048E8','#0CA678'];

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white dark:bg-[#1a1a24] rounded-2xl border border-border/60 p-5">
      <h3 className="text-sm font-semibold text-foreground mb-4">{title}</h3>
      {children}
    </div>
  );
}

export default function AdminAnalytics() {
  const [loading, setLoading] = useState(true);
  const [cityData, setCityData]     = useState<any[]>([]);
  const [catData, setCatData]       = useState<any[]>([]);
  const [monthlyUsers, setMonthlyUsers] = useState<any[]>([]);
  const [monthlyBookings, setMonthlyBookings] = useState<any[]>([]);

  useEffect(() => { load(); }, []);

  const load = async () => {
    setLoading(true);
    try {
      // Artists by profession/category
      const { data: artists } = await supabase.from('provider_profiles').select('profession, city');
      const catCount: Record<string,number> = {};
      const cityCount: Record<string,number> = {};
      (artists ?? []).forEach((a: any) => {
        if (a.profession) catCount[a.profession] = (catCount[a.profession]||0)+1;
        if (a.city)       cityCount[a.city]      = (cityCount[a.city]||0)+1;
      });
      setCatData(Object.entries(catCount).sort((a,b)=>b[1]-a[1]).slice(0,7).map(([name,value])=>({ name: name.replace(/_/g,' '), value })));
      setCityData(Object.entries(cityCount).sort((a,b)=>b[1]-a[1]).slice(0,8).map(([city,count])=>({ city, count })));

      // Monthly user signups (last 6 months)
      const { data: users } = await supabase.from('profiles').select('created_at');
      const now = new Date();
      const months = Array.from({length:6},(_,i)=>{
        const d = new Date(now.getFullYear(), now.getMonth()-5+i, 1);
        return { label: d.toLocaleString('default',{month:'short'}), year: d.getFullYear(), month: d.getMonth() };
      });
      const usersByMonth = months.map(m => ({
        month: m.label,
        users: (users??[]).filter((u:any)=>{ const d=new Date(u.created_at); return d.getFullYear()===m.year&&d.getMonth()===m.month; }).length,
      }));
      setMonthlyUsers(usersByMonth);

      // Monthly bookings
      const { data: bookings } = await supabase.from('bookings').select('created_at, total_amount');
      const bkByMonth = months.map(m => ({
        month: m.label,
        bookings: (bookings??[]).filter((b:any)=>{ const d=new Date(b.created_at); return d.getFullYear()===m.year&&d.getMonth()===m.month; }).length,
        revenue: (bookings??[]).filter((b:any)=>{ const d=new Date(b.created_at); return d.getFullYear()===m.year&&d.getMonth()===m.month; }).reduce((s:number,b:any)=>s+(b.total_amount||0),0),
      }));
      setMonthlyBookings(bkByMonth);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  if (loading) return (
    <div className="p-6 grid grid-cols-1 lg:grid-cols-2 gap-5">
      {Array.from({length:4}).map((_,i)=><div key={i} className="skeleton rounded-2xl h-64"/>)}
    </div>
  );

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-display font-bold text-foreground">Analytics</h1><p className="text-sm text-muted-foreground">Platform performance overview</p></div>
        <button onClick={load} className="p-2 rounded-lg border border-border hover:bg-secondary text-muted-foreground"><RefreshCw className="w-4 h-4"/></button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* User Growth */}
        <Section title="User Growth (6 Months)">
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={monthlyUsers}>
              <defs><linearGradient id="ug" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#3B5BDB" stopOpacity={0.3}/><stop offset="95%" stopColor="#3B5BDB" stopOpacity={0}/></linearGradient></defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(220 14% 91%)"/>
              <XAxis dataKey="month" tick={{fontSize:11}}/>
              <YAxis tick={{fontSize:11}}/>
              <Tooltip/>
              <Area type="monotone" dataKey="users" stroke="#3B5BDB" fill="url(#ug)" strokeWidth={2}/>
            </AreaChart>
          </ResponsiveContainer>
        </Section>

        {/* Booking Growth */}
        <Section title="Monthly Bookings">
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={monthlyBookings}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(220 14% 91%)"/>
              <XAxis dataKey="month" tick={{fontSize:11}}/>
              <YAxis tick={{fontSize:11}}/>
              <Tooltip/>
              <Bar dataKey="bookings" fill="#C9323A" radius={[6,6,0,0]}/>
            </BarChart>
          </ResponsiveContainer>
        </Section>

        {/* Top Categories */}
        <Section title="Artists by Category">
          {catData.length === 0 ? <p className="text-sm text-muted-foreground text-center py-8">No data</p> : (
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie data={catData} cx="50%" cy="50%" outerRadius={90} dataKey="value"
                  label={({name,percent})=>`${name.slice(0,10)} ${(percent*100).toFixed(0)}%`} labelLine={false} fontSize={10}>
                  {catData.map((_,i)=><Cell key={i} fill={COLORS[i%COLORS.length]}/>)}
                </Pie>
                <Tooltip/>
              </PieChart>
            </ResponsiveContainer>
          )}
        </Section>

        {/* Top Cities */}
        <Section title="Top Cities by Artists">
          {cityData.length === 0 ? <p className="text-sm text-muted-foreground text-center py-8">No data</p> : (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={cityData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(220 14% 91%)"/>
                <XAxis type="number" tick={{fontSize:10}}/>
                <YAxis dataKey="city" type="category" tick={{fontSize:10}} width={80}/>
                <Tooltip/>
                <Bar dataKey="count" fill="#D4A017" radius={[0,6,6,0]}/>
              </BarChart>
            </ResponsiveContainer>
          )}
        </Section>

        {/* Revenue trend */}
        <Section title="Monthly Revenue (₹)">
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={monthlyBookings}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(220 14% 91%)"/>
              <XAxis dataKey="month" tick={{fontSize:11}}/>
              <YAxis tick={{fontSize:11}} tickFormatter={v=>`₹${(v/1000).toFixed(0)}K`}/>
              <Tooltip formatter={(v:any)=>[`₹${v.toLocaleString()}`,'Revenue']}/>
              <Line type="monotone" dataKey="revenue" stroke="#2F9E44" strokeWidth={2} dot={{r:4}}/>
            </LineChart>
          </ResponsiveContainer>
        </Section>
      </div>
    </div>
  );
}
