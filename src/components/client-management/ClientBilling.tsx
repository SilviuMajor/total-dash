import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { DollarSign, TrendingUp, Calendar } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface Subscription {
  id: string;
  plan_name: string;
  monthly_limit: number;
  current_usage: number;
  billing_cycle_start: string;
  billing_cycle_end: string;
  amount_cents: number;
  currency: string;
  status: string;
}

export function ClientBilling({ clientId }: { clientId: string }) {
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    loadSubscription();
  }, [clientId]);

  const loadSubscription = async () => {
    try {
      const { data, error } = await supabase
        .from('client_subscriptions')
        .select('*')
        .eq('client_id', clientId)
        .single();

      if (error && error.code !== 'PGRST116') throw error;
      
      // Create default subscription if none exists
      if (!data) {
        const { data: newSub, error: insertError } = await supabase
          .from('client_subscriptions')
          .insert([{ client_id: clientId }])
          .select()
          .single();

        if (insertError) throw insertError;
        setSubscription(newSub);
      } else {
        setSubscription(data);
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Card className="p-6 bg-gradient-card border-border/50 animate-pulse">
        <div className="h-64"></div>
      </Card>
    );
  }

  if (!subscription) return null;

  const usagePercentage = (subscription.current_usage / subscription.monthly_limit) * 100;
  const amount = (subscription.amount_cents / 100).toFixed(2);

  return (
    <div className="space-y-6">
      <div className="grid gap-6 md:grid-cols-3">
        <Card className="p-6 bg-gradient-card border-border/50">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
              <DollarSign className="w-6 h-6 text-primary" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Monthly Cost</p>
              <p className="text-2xl font-bold text-foreground">
                {subscription.currency} {amount}
              </p>
            </div>
          </div>
        </Card>

        <Card className="p-6 bg-gradient-card border-border/50">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
              <TrendingUp className="w-6 h-6 text-primary" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Current Usage</p>
              <p className="text-2xl font-bold text-foreground">
                {subscription.current_usage} / {subscription.monthly_limit}
              </p>
            </div>
          </div>
        </Card>

        <Card className="p-6 bg-gradient-card border-border/50">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
              <Calendar className="w-6 h-6 text-primary" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Billing Cycle</p>
              <p className="text-sm font-medium text-foreground">
                {new Date(subscription.billing_cycle_end).toLocaleDateString()}
              </p>
            </div>
          </div>
        </Card>
      </div>

      <Card className="p-6 bg-gradient-card border-border/50">
        <h3 className="text-lg font-semibold text-foreground mb-4">Subscription Details</h3>
        <div className="space-y-6">
          <div className="flex items-center justify-between py-3 border-b border-border/50">
            <span className="text-sm text-muted-foreground">Plan</span>
            <Badge variant="outline">{subscription.plan_name}</Badge>
          </div>

          <div className="flex items-center justify-between py-3 border-b border-border/50">
            <span className="text-sm text-muted-foreground">Status</span>
            <Badge variant={subscription.status === 'active' ? 'default' : 'secondary'}>
              {subscription.status}
            </Badge>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Usage This Cycle</span>
              <span className="text-sm font-medium text-foreground">
                {usagePercentage.toFixed(1)}%
              </span>
            </div>
            <Progress value={usagePercentage} className="h-2" />
          </div>

          <div className="flex items-center justify-between py-3 border-b border-border/50">
            <span className="text-sm text-muted-foreground">Cycle Start</span>
            <span className="text-sm text-foreground">
              {new Date(subscription.billing_cycle_start).toLocaleDateString()}
            </span>
          </div>

          <div className="flex items-center justify-between py-3">
            <span className="text-sm text-muted-foreground">Cycle End</span>
            <span className="text-sm text-foreground">
              {new Date(subscription.billing_cycle_end).toLocaleDateString()}
            </span>
          </div>
        </div>
      </Card>
    </div>
  );
}
