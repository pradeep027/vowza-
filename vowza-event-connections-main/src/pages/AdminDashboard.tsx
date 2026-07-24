import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { NotificationService } from '@/services/notificationService';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { 
  Users, 
  CheckCircle, 
  XCircle, 
  Eye, 
  Search,
  Filter,
  TrendingUp,
  Shield,
  LogOut,
  FileText,
  MapPin,
  Phone,
  Mail,
  Calendar,
  DollarSign,
  BarChart3,
  Settings,
  Ban,
  Edit,
  IndianRupee
} from 'lucide-react';

interface WorkerProfile {
  id: string;
  user_id: string;
  full_name: string;
  phone: string;
  email: string;
  profession: string;
  experience_years: number;
  city: string;
  area: string;
  verification_status: 'pending' | 'approved' | 'rejected';
  bio: string;
  specialties: string;
  rejection_reason?: string;
  created_at: string;
  verified_at?: string;
  avatar_url?: string;
  [key: string]: any;
}

interface Document {
  id: string;
  document_type: string;
  document_url: string;
  document_number?: string;
  verification_status: 'pending' | 'verified' | 'rejected';
  uploaded_at: string;
  [key: string]: any;
}

interface VerificationStats {
  total: number;
  pending: number;
  underReview: number;
  approved: number;
  rejected: number;
}

const AdminDashboard = () => {
  const [workers, setWorkers] = useState<WorkerProfile[]>([]);
  const [selectedWorker, setSelectedWorker] = useState<WorkerProfile | null>(null);
  const [stats, setStats] = useState<VerificationStats>({
    total: 0,
    pending: 0,
    underReview: 0,
    approved: 0,
    rejected: 0
  });
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [rejectionReason, setRejectionReason] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [activeTab, setActiveTab] = useState<'workers' | 'categories' | 'analytics'>('workers');
  const [categories, setCategories] = useState<any[]>([]);
  const [newCategory, setNewCategory] = useState({ name: '', profession_type: '', description: '', icon: '' });
  const [analytics, setAnalytics] = useState<any[]>([]);
  const [commissions, setCommissions] = useState<any[]>([]);

  const { user, loading, signOut } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !user) {
      navigate('/auth');
      return;
    }

    fetchWorkers();
    fetchCategories();
    fetchAnalytics();
    fetchCommissions();
    if (user) {
      checkAdminAccess();
    }
  }, [user, loading, navigate]);

  const fetchCategories = async () => {
    try {
      const { data } = await supabase
        .from('artist_categories' as any)
        .select('*')
        .order('sort_order');
      
      if (data) {
        setCategories(data);
      }
    } catch (error) {
      console.error('Error fetching categories:', error);
    }
  };

  const handleAddCategory = async () => {
    if (!newCategory.name || !newCategory.profession_type) {
      toast.error('Please fill in required fields');
      return;
    }

    try {
      const { error } = await supabase
        .from('artist_categories' as any)
        .insert({
          name: newCategory.name,
          profession_type: newCategory.profession_type,
          description: newCategory.description,
          icon: newCategory.icon,
          is_active: true
        });

      if (error) throw error;

      toast.success('Category added successfully');
      setNewCategory({ name: '', profession_type: '', description: '', icon: '' });
      fetchCategories();
    } catch (error: any) {
      toast.error(error.message || 'Failed to add category');
    }
  };

  const handleDeleteCategory = async (id: string) => {
    try {
      const { error } = await supabase
        .from('artist_categories' as any)
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast.success('Category deleted successfully');
      fetchCategories();
    } catch (error: any) {
      toast.error(error.message || 'Failed to delete category');
    }
  };

  const fetchAnalytics = async () => {
    try {
      const { data } = await supabase
        .from('platform_analytics' as any)
        .select('*')
        .order('date', { ascending: false })
        .limit(30);
      
      if (data) {
        setAnalytics(data);
      }
    } catch (error) {
      console.error('Error fetching analytics:', error);
    }
  };

  const fetchCommissions = async () => {
    try {
      const { data } = await supabase
        .from('commission_tracking' as any)
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);
      
      if (data) {
        setCommissions(data);
      }
    } catch (error) {
      console.error('Error fetching commissions:', error);
    }
  };

  const checkAdminAccess = async () => {
    if (!user) return;

    try {
      const { data: roles } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id);

      const isAdmin = roles?.some(r => r.role === 'admin');
      
      if (!isAdmin) {
        toast.error('Access denied. Admin only.');
        navigate('/');
        return;
      }

      fetchWorkers();
      fetchStats();
    } catch (error: any) {
      toast.error('Failed to verify admin access');
      navigate('/');
    }
  };

  const fetchWorkers = async () => {
    try {
      const { data, error } = await supabase
        .from('provider_profiles')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Fetch profiles separately to avoid deep type instantiation
      const userIds = (data || []).map((w: any) => w.user_id);
      const { data: profilesData } = await supabase
        .from('profiles')
        .select('id, full_name, phone, email, avatar_url, city, area')
        .in('id', userIds);

      const profilesMap = new Map(profilesData?.map((p: any) => [p.id, p]) || []);

      const transformedData = (data || []).map((w: any) => {
        const profile = profilesMap.get(w.user_id);
        return {
          ...w,
          user_id: w.user_id,
          full_name: profile?.full_name || 'Unknown',
          phone: profile?.phone || '',
          email: profile?.email || '',
          avatar_url: profile?.avatar_url,
          profession: w.profession,
          city: w.city || profile?.city,
          area: w.area || profile?.area,
          documents: []
        };
      });

      // Apply filters client-side to avoid TypeScript issues
      let filteredData = transformedData;
      if (statusFilter !== 'all') {
        filteredData = filteredData.filter((w: any) => w.verification_status === statusFilter);
      }
      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        filteredData = filteredData.filter((w: any) => 
          w.full_name?.toLowerCase().includes(term) ||
          w.phone?.toLowerCase().includes(term) ||
          w.email?.toLowerCase().includes(term) ||
          w.profession?.toLowerCase().includes(term)
        );
      }

      setWorkers(filteredData);
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const { data } = await supabase
        .from('worker_profiles')
        .select('verification_status');

      if (data) {
        const newStats: VerificationStats = {
          total: data.length,
          pending: data.filter(w => w.verification_status === 'pending').length,
          underReview: data.filter(w => w.verification_status === 'under_review').length,
          approved: data.filter(w => w.verification_status === 'approved').length,
          rejected: data.filter(w => w.verification_status === 'rejected').length
        };
        setStats(newStats);
      }
    } catch (error: any) {
      console.error('Failed to fetch stats:', error);
    }
  };

  const handleVerification = async (workerId: string, status: 'approved' | 'rejected') => {
    if (status === 'rejected' && !rejectionReason.trim()) {
      toast.error('Please provide a rejection reason');
      return;
    }

    setIsProcessing(true);

    try {
      const now = new Date().toISOString();

      // Update worker profile
      const { error: updateError } = await supabase
        .from('worker_profiles')
        .update({
          verification_status: status,
          rejection_reason: status === 'rejected' ? rejectionReason : null,
          verified_at: status === 'approved' ? now : null,
          verified_by: user?.id
        })
        .eq('user_id', workerId);

      if (updateError) throw updateError;

      // If approved, assign provider role and create provider profile
      if (status === 'approved') {
        await supabase
          .from('user_roles')
          .upsert({
            user_id: workerId,
            role: 'provider'
          }, {
            onConflict: 'user_id,role'
          });

        const worker = workers.find(w => w.user_id === workerId);
        if (worker) {
          await supabase
            .from('provider_profiles')
            .update({
              verification_status: 'approved'
            } as any)
            .eq('user_id', workerId);
        }
      } else {
        // Reject artist
        await supabase
          .from('provider_profiles')
          .update({
            verification_status: 'rejected',
            rejection_reason: rejectionReason
          } as any)
          .eq('user_id', workerId);
      }

      toast.success(`Worker ${status} successfully`);
      
      // Send notification to artist
      if (status === 'approved') {
        await NotificationService.notifyArtistApproved(workerId);
      } else {
        await NotificationService.notifyArtistRejected(workerId, rejectionReason);
      }
      
      setRejectionReason('');
      setSelectedWorker(null);
      fetchWorkers();
      fetchStats();
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-yellow-500/20 text-yellow-700 border-yellow-500/30';
      case 'under_review': return 'bg-blue-500/20 text-blue-700 border-blue-500/30';
      case 'approved': return 'bg-green-500/20 text-green-700 border-green-500/30';
      case 'rejected': return 'bg-red-500/20 text-red-700 border-red-500/30';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  if (loading || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-cream via-background to-blush/20">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gold"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-cream via-background to-blush/20">
      {/* Header */}
      <header className="bg-card/95 backdrop-blur-sm border-b border-gold/20 sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <h1 className="text-2xl font-bold bg-gradient-to-r from-gold to-maroon bg-clip-text text-transparent">
            Vowza Admin
          </h1>
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon">
              <Shield className="w-5 h-5" />
            </Button>
            <Button variant="ghost" size="icon" onClick={handleSignOut}>
              <LogOut className="w-5 h-5" />
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        {/* Tab Navigation */}
        <div className="flex gap-2 mb-6">
          <Button
            variant={activeTab === 'workers' ? 'default' : 'outline'}
            onClick={() => setActiveTab('workers')}
          >
            <Users className="w-4 h-4 mr-2" />
            Artists
          </Button>
          <Button
            variant={activeTab === 'categories' ? 'default' : 'outline'}
            onClick={() => setActiveTab('categories')}
          >
            <Settings className="w-4 h-4 mr-2" />
            Categories
          </Button>
          <Button
            variant={activeTab === 'analytics' ? 'default' : 'outline'}
            onClick={() => setActiveTab('analytics')}
          >
            <BarChart3 className="w-4 h-4 mr-2" />
            Analytics
          </Button>
        </div>

        {/* Stats Grid */}
        {activeTab === 'workers' && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
          <Card className="border-gold/20">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-full bg-gold/10">
                  <Users className="w-5 h-5 text-gold" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total</p>
                  <p className="text-xl font-bold">{stats.total}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-yellow-500/30">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-full bg-yellow-500/10">
                  <FileText className="w-5 h-5 text-yellow-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Pending</p>
                  <p className="text-xl font-bold">{stats.pending}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-blue-500/30">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-full bg-blue-500/10">
                  <Eye className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">In Review</p>
                  <p className="text-xl font-bold">{stats.underReview}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-green-500/30">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-full bg-green-500/10">
                  <CheckCircle className="w-5 h-5 text-green-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Approved</p>
                  <p className="text-xl font-bold">{stats.approved}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-red-500/30">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-full bg-red-500/10">
                  <XCircle className="w-5 h-5 text-red-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Rejected</p>
                  <p className="text-xl font-bold">{stats.rejected}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
        )}

        {/* Category Management */}
        {activeTab === 'categories' && (
          <div className="space-y-6">
            <Card className="border-gold/20">
              <CardHeader>
                <CardTitle>Add New Category</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="categoryName">Category Name *</Label>
                    <Input
                      id="categoryName"
                      value={newCategory.name}
                      onChange={(e) => setNewCategory({ ...newCategory, name: e.target.value })}
                      placeholder="e.g., Wedding Planner"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="professionType">Profession Type *</Label>
                    <Input
                      id="professionType"
                      value={newCategory.profession_type}
                      onChange={(e) => setNewCategory({ ...newCategory, profession_type: e.target.value })}
                      placeholder="e.g., wedding_planner"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="categoryIcon">Icon</Label>
                  <Input
                    id="categoryIcon"
                    value={newCategory.icon}
                    onChange={(e) => setNewCategory({ ...newCategory, icon: e.target.value })}
                    placeholder="e.g., heart"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="categoryDescription">Description</Label>
                  <Textarea
                    id="categoryDescription"
                    value={newCategory.description}
                    onChange={(e) => setNewCategory({ ...newCategory, description: e.target.value })}
                    placeholder="Describe this category..."
                    rows={3}
                  />
                </div>
                <Button onClick={handleAddCategory} className="bg-gradient-gold hover:opacity-90">
                  Add Category
                </Button>
              </CardContent>
            </Card>

            <Card className="border-gold/20">
              <CardHeader>
                <CardTitle>Existing Categories</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {categories.map((category) => (
                    <div key={category.id} className="flex items-center justify-between p-4 rounded-lg bg-muted/30 border border-border">
                      <div>
                        <p className="font-semibold">{category.name}</p>
                        <p className="text-sm text-muted-foreground">{category.profession_type}</p>
                        {category.description && (
                          <p className="text-sm text-muted-foreground mt-1">{category.description}</p>
                        )}
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteCategory(category.id)}
                        className="text-red-500 hover:text-red-700"
                      >
                        <Ban className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Analytics */}
        {activeTab === 'analytics' && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Card className="border-gold/20">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-full bg-gold/10">
                      <DollarSign className="w-5 h-5 text-gold" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Total Revenue</p>
                      <p className="text-xl font-bold">
                        ₹{analytics.reduce((sum, a) => sum + (a.total_revenue || 0), 0).toLocaleString()}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card className="border-gold/20">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-full bg-gold/10">
                      <TrendingUp className="w-5 h-5 text-gold" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Total Commission</p>
                      <p className="text-xl font-bold">
                        ₹{analytics.reduce((sum, a) => sum + (a.total_commission || 0), 0).toLocaleString()}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card className="border-gold/20">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-full bg-gold/10">
                      <Users className="w-5 h-5 text-gold" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Total Bookings</p>
                      <p className="text-xl font-bold">
                        {analytics.reduce((sum, a) => sum + (a.total_bookings || 0), 0)}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card className="border-gold/20">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-full bg-gold/10">
                      <Calendar className="w-5 h-5 text-gold" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">New Registrations</p>
                      <p className="text-xl font-bold">
                        {analytics.reduce((sum, a) => sum + (a.new_registrations || 0), 0)}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card className="border-gold/20">
              <CardHeader>
                <CardTitle>Commission Tracking</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {commissions.map((commission) => (
                    <div key={commission.id} className="flex items-center justify-between p-4 rounded-lg bg-muted/30 border border-border">
                      <div>
                        <p className="font-semibold">Booking #{commission.booking_id?.slice(0, 8)}</p>
                        <p className="text-sm text-muted-foreground">
                          Amount: ₹{commission.booking_amount?.toLocaleString()} | Commission: ₹{commission.commission_amount?.toLocaleString()}
                        </p>
                      </div>
                      <Badge className={
                        commission.status === 'paid' ? 'bg-green-500/20 text-green-700 border-green-500/30' :
                        commission.status === 'collected' ? 'bg-blue-500/20 text-blue-700 border-blue-500/30' :
                        'bg-yellow-500/20 text-yellow-700 border-yellow-500/30'
                      }>
                        {commission.status}
                      </Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Search & Filters */}
        {activeTab === 'workers' && (
        <Card className="mb-6 border-gold/20">
          <CardContent className="p-4">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <Input
                  placeholder="Search by name, phone, or email..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && fetchWorkers()}
                  className="pl-10 border-border focus:border-gold"
                />
              </div>
              
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full md:w-[200px] border-border focus:border-gold">
                  <Filter className="w-4 h-4 mr-2" />
                  <SelectValue placeholder="All Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="under_review">Under Review</SelectItem>
                  <SelectItem value="approved">Approved</SelectItem>
                  <SelectItem value="rejected">Rejected</SelectItem>
                </SelectContent>
              </Select>
              
              <Button onClick={fetchWorkers} className="bg-gradient-gold hover:opacity-90">
                Search
              </Button>
            </div>
          </CardContent>
        </Card>
        )}

        {/* Workers List */}
        {activeTab === 'workers' && (
        <Card className="border-gold/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="w-5 h-5" />
              Artist Verification Requests
            </CardTitle>
            <CardDescription>Review and verify artist applications</CardDescription>
          </CardHeader>
          <CardContent>
            {workers.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                No verification requests found
              </p>
            ) : (
              <div className="space-y-4">
                {workers.map((worker) => (
                  <div
                    key={worker.id}
                    className="p-4 rounded-lg bg-muted/30 border border-border flex flex-col md:flex-row md:items-center justify-between gap-4"
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <Badge className={getStatusColor(worker.verification_status)}>
                          {worker.verification_status.replace('_', ' ')}
                        </Badge>
                        <span className="font-semibold">{worker.full_name}</span>
                      </div>
                      
                      <div className="flex flex-wrap gap-4 text-sm text-muted-foreground mb-2">
                        <span className="flex items-center gap-1">
                          <Mail className="w-3 h-3" />
                          {worker.email}
                        </span>
                        <span className="flex items-center gap-1">
                          <Phone className="w-3 h-3" />
                          {worker.phone}
                        </span>
                        <span className="flex items-center gap-1">
                          <MapPin className="w-3 h-3" />
                          {worker.service_city}, {worker.service_area}
                        </span>
                      </div>
                      
                      <p className="text-sm">
                        <span className="font-medium">Service:</span> {worker.service_type}
                        <span className="mx-2">•</span>
                        <span className="font-medium">Experience:</span> {worker.experience_years} years
                        <span className="mx-2">•</span>
                        <span className="font-medium">Documents:</span> {worker.documents?.length || 0}
                      </p>
                      
                      <p className="text-sm text-muted-foreground mt-1">
                        Applied: {new Date(worker.created_at).toLocaleDateString('en-IN')}
                      </p>
                    </div>
                    
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setSelectedWorker(worker)}
                          className="border-gold text-gold hover:bg-gold/10"
                        >
                          <Eye className="w-4 h-4 mr-1" />
                          Review
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                        <DialogHeader>
                          <DialogTitle>Artist Verification Review</DialogTitle>
                          <DialogDescription>
                            Review the artist's profile and documents before approving
                          </DialogDescription>
                        </DialogHeader>
                        
                        {selectedWorker && (
                          <div className="space-y-4">
                            {/* Profile Info */}
                            <div className="space-y-3">
                              <h3 className="font-semibold">Profile Information</h3>
                              <div className="grid grid-cols-2 gap-3 text-sm">
                                <div>
                                  <p className="text-muted-foreground">Name</p>
                                  <p className="font-medium">{selectedWorker.full_name}</p>
                                </div>
                                <div>
                                  <p className="text-muted-foreground">Email</p>
                                  <p className="font-medium">{selectedWorker.email}</p>
                                </div>
                                <div>
                                  <p className="text-muted-foreground">Phone</p>
                                  <p className="font-medium">{selectedWorker.phone}</p>
                                </div>
                                <div>
                                  <p className="text-muted-foreground">Service Type</p>
                                  <p className="font-medium">{selectedWorker.service_type}</p>
                                </div>
                                <div>
                                  <p className="text-muted-foreground">Experience</p>
                                  <p className="font-medium">{selectedWorker.experience_years} years</p>
                                </div>
                                <div>
                                  <p className="text-muted-foreground">Location</p>
                                  <p className="font-medium">{selectedWorker.service_city}, {selectedWorker.service_area}</p>
                                </div>
                              </div>
                              
                              {selectedWorker.bio && (
                                <div>
                                  <p className="text-muted-foreground text-sm">Bio</p>
                                  <p className="text-sm">{selectedWorker.bio}</p>
                                </div>
                              )}
                              
                              {selectedWorker.specialties && (
                                <div>
                                  <p className="text-muted-foreground text-sm">Specialties</p>
                                  <div className="flex flex-wrap gap-2 mt-1">
                                    {(typeof selectedWorker.specialties === 'string' 
                                      ? selectedWorker.specialties.split(',') 
                                      : Array.isArray(selectedWorker.specialties) 
                                        ? selectedWorker.specialties 
                                        : []
                                    ).map((spec: string, idx: number) => (
                                      <Badge key={idx} variant="outline">{spec.trim()}</Badge>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                            
                            {/* Documents */}
                            <div className="space-y-3">
                              <h3 className="font-semibold">Verification Documents</h3>
                              {selectedWorker.documents && selectedWorker.documents.length > 0 ? (
                                <div className="space-y-2">
                                  {selectedWorker.documents.map((doc) => (
                                    <div key={doc.id} className="p-3 rounded-lg bg-muted/30 border border-border">
                                      <div className="flex items-center justify-between mb-2">
                                        <span className="font-medium">{doc.document_type}</span>
                                        <Badge className={getStatusColor(doc.verification_status)}>
                                          {doc.verification_status}
                                        </Badge>
                                      </div>
                                      {doc.document_number && (
                                        <p className="text-sm text-muted-foreground">
                                          Document Number: {doc.document_number}
                                        </p>
                                      )}
                                      <a
                                        href={doc.document_url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-sm text-gold hover:underline"
                                      >
                                        View Document
                                      </a>
                                      <p className="text-xs text-muted-foreground mt-1">
                                        Uploaded: {new Date(doc.uploaded_at).toLocaleDateString('en-IN')}
                                      </p>
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <p className="text-sm text-muted-foreground">No documents uploaded</p>
                              )}
                            </div>
                            
                            {/* Actions */}
                            <div className="space-y-3 pt-4 border-t">
                              {selectedWorker.verification_status === 'pending' ? (
                                <>
                                  <div className="space-y-2">
                                    <label className="text-sm font-medium">Rejection Reason (if rejecting)</label>
                                    <Textarea
                                      placeholder="Provide a reason for rejection..."
                                      value={rejectionReason}
                                      onChange={(e) => setRejectionReason(e.target.value)}
                                      rows={3}
                                      className="border-border focus:border-gold resize-none"
                                    />
                                  </div>
                                  
                                  <div className="flex gap-3">
                                    <Button
                                      variant="outline"
                                      className="flex-1 border-red-500 text-red-600 hover:bg-red-50"
                                      onClick={() => handleVerification(selectedWorker.user_id, 'rejected')}
                                      disabled={isProcessing}
                                    >
                                      <XCircle className="w-4 h-4 mr-2" />
                                      Reject
                                    </Button>
                                    <Button
                                      className="flex-1 bg-green-600 hover:bg-green-700"
                                      onClick={() => handleVerification(selectedWorker.user_id, 'approved')}
                                      disabled={isProcessing}
                                    >
                                      <CheckCircle className="w-4 h-4 mr-2" />
                                      Approve
                                    </Button>
                                  </div>
                                </>
                              ) : selectedWorker.verification_status === 'approved' ? (
                                <div className="text-center py-4">
                                  <CheckCircle className="w-12 h-12 text-green-600 mx-auto mb-2" />
                                  <p className="font-medium text-green-600">Artist Verified</p>
                                </div>
                              ) : (
                                <div className="text-center py-4">
                                  <XCircle className="w-12 h-12 text-red-600 mx-auto mb-2" />
                                  <p className="font-medium text-red-600">Artist Rejected</p>
                                  {selectedWorker.rejection_reason && (
                                    <p className="text-sm text-muted-foreground mt-2">
                                      Reason: {selectedWorker.rejection_reason}
                                    </p>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </DialogContent>
                    </Dialog>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
        )}
      </main>
    </div>
  );
};

export default AdminDashboard;
