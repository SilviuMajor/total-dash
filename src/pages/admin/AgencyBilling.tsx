import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Loader2, DollarSign, Users, TrendingUp, TrendingDown, Download, Search, Calendar } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";

interface BillingData {
  id: string;
  name: string;
  logo_url: string | null;
  created_at: string;
  status: string;
  current_period_end: string | null;
  trial_ends_at: string | null;
  subscription_created_at: string;
  plan_name: string;
  price_monthly_cents: number;
  stripe_subscription_id: string | null;
}

export default function AgencyBilling() {
  const [loading, setLoading] = useState(true);
  const [billingData, setBillingData] = useState<BillingData[]>([]);
  const [filteredData, setFilteredData] = useState<BillingData[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [planFilter, setPlanFilter] = useState<string>("all");
  const [dateRange, setDateRange] = useState<string>("all");
  const [sortField, setSortField] = useState<string>("name");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const navigate = useNavigate();

  useEffect(() => {
    loadBillingData();
  }, []);

  useEffect(() => {
    filterAndSortData();
  }, [billingData, searchTerm, statusFilter, planFilter, sortField, sortDirection]);

  const loadBillingData = async () => {
    try {
      const { data, error } = await supabase
        .from('agencies')
        .select(`
          id,
          name,
          logo_url,
          created_at,
          agency_subscriptions (
            status,
            current_period_end,
            trial_ends_at,
            created_at,
            stripe_subscription_id,
            snapshot_plan_name,
            snapshot_price_monthly_cents,
            custom_price_monthly_cents,
            is_custom_pricing,
            plan:subscription_plans (
              name,
              price_monthly_cents
            )
          )
        `);

      if (error) throw error;

      const formatted = data?.map((agency: any) => {
        const sub = agency.agency_subscriptions?.[0];
        const price = sub?.is_custom_pricing 
          ? sub.custom_price_monthly_cents 
          : (sub?.snapshot_price_monthly_cents || sub?.plan?.price_monthly_cents || 0);
        
        return {
          id: agency.id,
          name: agency.name,
          logo_url: agency.logo_url,
          created_at: agency.created_at,
          status: sub?.status || 'none',
          current_period_end: sub?.current_period_end,
          trial_ends_at: sub?.trial_ends_at,
          subscription_created_at: sub?.created_at,
          plan_name: sub?.snapshot_plan_name || sub?.plan?.name || 'No Plan',
          price_monthly_cents: price,
          stripe_subscription_id: sub?.stripe_subscription_id,
        };
      }) || [];

      setBillingData(formatted);
    } catch (error) {
      console.error('Error loading billing data:', error);
    } finally {
      setLoading(false);
    }
  };

  const filterAndSortData = () => {
    let filtered = [...billingData];

    if (searchTerm) {
      filtered = filtered.filter(item =>
        item.name.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    if (statusFilter !== "all") {
      filtered = filtered.filter(item => item.status === statusFilter);
    }

    if (planFilter !== "all") {
      filtered = filtered.filter(item => item.plan_name === planFilter);
    }

    filtered.sort((a, b) => {
      let aVal: any = a[sortField as keyof BillingData];
      let bVal: any = b[sortField as keyof BillingData];

      if (sortField === "price_monthly_cents") {
        aVal = Number(aVal);
        bVal = Number(bVal);
      }

      if (aVal < bVal) return sortDirection === "asc" ? -1 : 1;
      if (aVal > bVal) return sortDirection === "asc" ? 1 : -1;
      return 0;
    });

    setFilteredData(filtered);
  };

  const toggleSort = (field: string) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
  };

  const getDateFilteredData = () => {
    if (dateRange === "all") return billingData;
    
    const now = new Date();
    const cutoffDate = new Date();
    
    switch (dateRange) {
      case "30days":
        cutoffDate.setDate(now.getDate() - 30);
        break;
      case "3months":
        cutoffDate.setMonth(now.getMonth() - 3);
        break;
      case "12months":
        cutoffDate.setMonth(now.getMonth() - 12);
        break;
    }
    
    return billingData.filter(item => 
      item.subscription_created_at && new Date(item.subscription_created_at) >= cutoffDate
    );
  };

  const calculateRevenue = (days: number | null = null) => {
    const data = days ? getDateFilteredData() : billingData;
    return data
      .filter(item => item.status === 'active')
      .reduce((sum, item) => sum + item.price_monthly_cents, 0) / 100;
  };

  const getActiveCount = () => {
    return billingData.filter(item => item.status === 'active').length;
  };

  const getNewTrials = () => {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    return billingData.filter(item => 
      item.status === 'trialing' && 
      item.subscription_created_at &&
      new Date(item.subscription_created_at) >= thirtyDaysAgo
    ).length;
  };

  const getNewSignups = () => {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    return billingData.filter(item => 
      item.status === 'active' &&
      item.subscription_created_at &&
      new Date(item.subscription_created_at) >= thirtyDaysAgo
    ).length;
  };

  const getChurnedCount = () => {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    return billingData.filter(item => 
      item.status === 'canceled' &&
      item.subscription_created_at &&
      new Date(item.subscription_created_at) >= thirtyDaysAgo
    ).length;
  };

  const getStatusBadge = (status: string, trialEndsAt: string | null) => {
    if (status === 'trialing' && trialEndsAt) {
      const daysLeft = Math.floor((new Date(trialEndsAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
      return (
        <Badge className="bg-blue-500/10 text-blue-500 border-blue-500/20">
          Trial ({daysLeft > 0 ? `${daysLeft}d left` : 'Expired'})
        </Badge>
      );
    }

    switch (status) {
      case 'active':
        return <Badge className="bg-success/10 text-success border-success/20">Active</Badge>;
      case 'past_due':
        return <Badge className="bg-warning/10 text-warning border-warning/20">Past Due</Badge>;
      case 'canceled':
        return <Badge className="bg-destructive/10 text-destructive border-destructive/20">Canceled</Badge>;
      case 'incomplete':
        return <Badge variant="outline">Incomplete</Badge>;
      default:
        return <Badge variant="outline">No Subscription</Badge>;
    }
  };

  const formatCurrency = (cents: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(cents / 100);
  };

  const exportToCSV = () => {
    const headers = ['Agency', 'Plan', 'Status', 'MRR', 'Next Billing', 'Stripe ID'];
    const rows = filteredData.map(item => [
      item.name,
      item.plan_name,
      item.status,
      formatCurrency(item.price_monthly_cents),
      item.current_period_end ? format(new Date(item.current_period_end), 'MMM dd, yyyy') : 'N/A',
      item.stripe_subscription_id || 'Not Linked',
    ]);

    const csv = [headers, ...rows].map(row => row.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `agency-billing-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  };

  const uniquePlans = Array.from(new Set(billingData.map(item => item.plan_name))).filter(plan => plan !== 'No Plan');

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Agency Billing</h1>
        <p className="text-muted-foreground mt-2">
          Monitor revenue, subscriptions, and billing metrics across all agencies
        </p>
      </div>

      {/* Date Range Selector */}
      <div className="flex items-center gap-4">
        <Select value={dateRange} onValueChange={setDateRange}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Select time period" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Time</SelectItem>
            <SelectItem value="30days">Last 30 Days</SelectItem>
            <SelectItem value="3months">Last 3 Months</SelectItem>
            <SelectItem value="12months">Last 12 Months</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Summary Cards */}
      <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-6">
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Revenue (Last 30 Days)</CardDescription>
            <CardTitle className="text-3xl">{formatCurrency(calculateRevenue(30) * 100)}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <DollarSign className="w-4 h-4" />
              <span>Active subscriptions only</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Revenue (Last 12 Months)</CardDescription>
            <CardTitle className="text-3xl">{formatCurrency(calculateRevenue() * 100)}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Calendar className="w-4 h-4" />
              <span>Total MRR</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Active Subscriptions</CardDescription>
            <CardTitle className="text-3xl">{getActiveCount()}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Users className="w-4 h-4" />
              <span>Paying customers (excl. trials)</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardDescription>New Trials (Last 30 Days)</CardDescription>
            <CardTitle className="text-3xl">{getNewTrials()}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <TrendingUp className="w-4 h-4" />
              <span>Trial signups</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardDescription>New Signups (Last 30 Days)</CardDescription>
            <CardTitle className="text-3xl">{getNewSignups()}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <TrendingUp className="w-4 h-4" />
              <span>New paid subscriptions</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Churned (Last 30 Days)</CardDescription>
            <CardTitle className="text-3xl">{getChurnedCount()}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <TrendingDown className="w-4 h-4" />
              <span>Canceled subscriptions</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters and Search */}
      <Card>
        <CardHeader>
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <CardTitle>All Agencies</CardTitle>
            <Button onClick={exportToCSV} variant="outline" size="sm">
              <Download className="w-4 h-4 mr-2" />
              Export CSV
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search agencies..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full md:w-[180px]">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="trialing">Trial</SelectItem>
                <SelectItem value="past_due">Past Due</SelectItem>
                <SelectItem value="canceled">Canceled</SelectItem>
              </SelectContent>
            </Select>
            <Select value={planFilter} onValueChange={setPlanFilter}>
              <SelectTrigger className="w-full md:w-[180px]">
                <SelectValue placeholder="Filter by plan" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Plans</SelectItem>
                {uniquePlans.map(plan => (
                  <SelectItem key={plan} value={plan}>{plan}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Data Table */}
          <div className="rounded-lg border border-border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="cursor-pointer" onClick={() => toggleSort('name')}>
                    Agency {sortField === 'name' && (sortDirection === 'asc' ? '↑' : '↓')}
                  </TableHead>
                  <TableHead>Plan</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="cursor-pointer" onClick={() => toggleSort('price_monthly_cents')}>
                    MRR {sortField === 'price_monthly_cents' && (sortDirection === 'asc' ? '↑' : '↓')}
                  </TableHead>
                  <TableHead>Next Billing</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredData.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                      No agencies found matching your filters
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredData.map((agency) => (
                    <TableRow 
                      key={agency.id}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => navigate(`/admin/agencies/${agency.id}`)}
                    >
                      <TableCell>
                        <div className="flex items-center gap-3">
                          {agency.logo_url && (
                            <img src={agency.logo_url} alt={agency.name} className="w-8 h-8 rounded object-contain" />
                          )}
                          <span className="font-medium">{agency.name}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{agency.plan_name}</Badge>
                      </TableCell>
                      <TableCell>{getStatusBadge(agency.status, agency.trial_ends_at)}</TableCell>
                      <TableCell className="font-medium">{formatCurrency(agency.price_monthly_cents)}</TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {agency.current_period_end
                          ? format(new Date(agency.current_period_end), 'MMM dd, yyyy')
                          : 'N/A'}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
