import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Loader2, DollarSign, Users, Clock, TrendingDown, Download, Search } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";

interface BillingData {
  id: string;
  name: string;
  logo_url: string | null;
  created_at: string;
  status: string;
  current_period_start: string | null;
  current_period_end: string | null;
  trial_ends_at: string | null;
  manual_override: boolean;
  subscription_start: string;
  plan_name: string;
  tier: string;
  price_monthly_cents: number;
}

export default function AgencyBilling() {
  const [loading, setLoading] = useState(true);
  const [billingData, setBillingData] = useState<BillingData[]>([]);
  const [filteredData, setFilteredData] = useState<BillingData[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [planFilter, setPlanFilter] = useState<string>("all");
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
            current_period_start,
            current_period_end,
            trial_ends_at,
            manual_override,
            created_at,
            plan:subscription_plans (
              name,
              tier,
              price_monthly_cents
            )
          )
        `)
        .eq('is_active', true);

      if (error) throw error;

      const formatted = data?.map((agency: any) => ({
        id: agency.id,
        name: agency.name,
        logo_url: agency.logo_url,
        created_at: agency.created_at,
        status: agency.agency_subscriptions?.[0]?.status || 'none',
        current_period_start: agency.agency_subscriptions?.[0]?.current_period_start,
        current_period_end: agency.agency_subscriptions?.[0]?.current_period_end,
        trial_ends_at: agency.agency_subscriptions?.[0]?.trial_ends_at,
        manual_override: agency.agency_subscriptions?.[0]?.manual_override || false,
        subscription_start: agency.agency_subscriptions?.[0]?.created_at,
        plan_name: agency.agency_subscriptions?.[0]?.plan?.name || 'No Plan',
        tier: agency.agency_subscriptions?.[0]?.plan?.tier || 'none',
        price_monthly_cents: agency.agency_subscriptions?.[0]?.plan?.price_monthly_cents || 0,
      })) || [];

      setBillingData(formatted);
    } catch (error) {
      console.error('Error loading billing data:', error);
    } finally {
      setLoading(false);
    }
  };

  const filterAndSortData = () => {
    let filtered = [...billingData];

    // Search filter
    if (searchTerm) {
      filtered = filtered.filter(item =>
        item.name.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Status filter
    if (statusFilter !== "all") {
      filtered = filtered.filter(item => item.status === statusFilter);
    }

    // Plan filter
    if (planFilter !== "all") {
      filtered = filtered.filter(item => item.tier === planFilter);
    }

    // Sorting
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

  const calculateMRR = () => {
    return billingData
      .filter(item => item.status === 'active' || item.status === 'trialing')
      .reduce((sum, item) => sum + item.price_monthly_cents, 0) / 100;
  };

  const getActiveCount = () => {
    return billingData.filter(item => item.status === 'active' || item.status === 'trialing').length;
  };

  const getTrialCount = () => {
    return billingData.filter(item => item.status === 'trialing').length;
  };

  const getChurnedCount = () => {
    return billingData.filter(item => item.status === 'canceled').length;
  };

  const getStatusBadge = (status: string, manualOverride: boolean) => {
    if (manualOverride) {
      return <Badge className="bg-purple-500/10 text-purple-500 border-purple-500/20">Manual Override</Badge>;
    }

    switch (status) {
      case 'active':
        return <Badge className="bg-success/10 text-success border-success/20">Active</Badge>;
      case 'trialing':
        return <Badge className="bg-blue-500/10 text-blue-500 border-blue-500/20">Trial</Badge>;
      case 'past_due':
        return <Badge className="bg-warning/10 text-warning border-warning/20">Past Due</Badge>;
      case 'canceled':
        return <Badge className="bg-destructive/10 text-destructive border-destructive/20">Canceled</Badge>;
      case 'incomplete':
        return <Badge variant="outline">Incomplete</Badge>;
      default:
        return <Badge variant="outline">None</Badge>;
    }
  };

  const getTierBadge = (tier: string) => {
    const colors: Record<string, string> = {
      free_trial: "bg-muted text-muted-foreground",
      starter: "bg-blue-500/10 text-blue-500",
      professional: "bg-purple-500/10 text-purple-500",
      enterprise: "bg-primary/10 text-primary",
    };

    return (
      <Badge className={colors[tier] || "bg-muted text-muted-foreground"}>
        {tier.replace('_', ' ').toUpperCase()}
      </Badge>
    );
  };

  const getContractLength = (startDate: string) => {
    if (!startDate) return 'N/A';
    const days = Math.floor((Date.now() - new Date(startDate).getTime()) / (1000 * 60 * 60 * 24));
    return `${days} days`;
  };

  const getTrialDaysRemaining = (trialEndsAt: string | null) => {
    if (!trialEndsAt) return 'N/A';
    const days = Math.floor((new Date(trialEndsAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    return days > 0 ? `${days} days left` : 'Expired';
  };

  const formatCurrency = (cents: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(cents / 100);
  };

  const exportToCSV = () => {
    const headers = ['Agency', 'Plan', 'Status', 'MRR', 'Contract Length', 'Trial Status', 'Manual Override'];
    const rows = filteredData.map(item => [
      item.name,
      item.plan_name,
      item.status,
      formatCurrency(item.price_monthly_cents),
      getContractLength(item.subscription_start),
      item.status === 'trialing' ? getTrialDaysRemaining(item.trial_ends_at) : 'N/A',
      item.manual_override ? 'Yes' : 'No',
    ]);

    const csv = [headers, ...rows].map(row => row.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `agency-billing-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  };

  const uniquePlans = Array.from(new Set(billingData.map(item => item.tier))).filter(Boolean);

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

      {/* Summary Cards */}
      <div className="grid md:grid-cols-2 xl:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Total MRR</CardDescription>
            <CardTitle className="text-3xl">{formatCurrency(calculateMRR() * 100)}/mo</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <DollarSign className="w-4 h-4" />
              <span>Monthly Recurring Revenue</span>
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
              <span>Active + Trial users</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Trial Users</CardDescription>
            <CardTitle className="text-3xl">{getTrialCount()}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Clock className="w-4 h-4" />
              <span>Currently in trial</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Churned</CardDescription>
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
                  <SelectItem key={plan} value={plan}>{plan.replace('_', ' ').toUpperCase()}</SelectItem>
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
                  <TableHead>Contract Length</TableHead>
                  <TableHead>Trial Status</TableHead>
                  <TableHead>Next Billing</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredData.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                      No agencies found matching your filters
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredData.map((agency) => (
                    <TableRow key={agency.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          {agency.logo_url && (
                            <img src={agency.logo_url} alt={agency.name} className="w-8 h-8 rounded object-contain" />
                          )}
                          <span className="font-medium">{agency.name}</span>
                        </div>
                      </TableCell>
                      <TableCell>{getTierBadge(agency.tier)}</TableCell>
                      <TableCell>{getStatusBadge(agency.status, agency.manual_override)}</TableCell>
                      <TableCell className="font-medium">{formatCurrency(agency.price_monthly_cents)}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {getContractLength(agency.subscription_start)}
                      </TableCell>
                      <TableCell>
                        {agency.status === 'trialing' ? (
                          <span className="text-sm text-blue-500">{getTrialDaysRemaining(agency.trial_ends_at)}</span>
                        ) : (
                          <span className="text-sm text-muted-foreground">N/A</span>
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {agency.current_period_end
                          ? formatDistanceToNow(new Date(agency.current_period_end), { addSuffix: true })
                          : 'N/A'}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => navigate(`/super-admin/agencies/${agency.id}`)}
                        >
                          View Details
                        </Button>
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
