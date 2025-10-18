import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useClientAgentContext } from "@/hooks/useClientAgentContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";

export function SupportRequestForm() {
  const { user } = useAuth();
  const { selectedAgentId } = useClientAgentContext();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    subject: "",
    description: "",
    priority: "medium",
    category: "technical-issue",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!user || !selectedAgentId) {
      toast({
        title: "Error",
        description: "User or agent information not available",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);

    try {
      // Get user details
      const { data: clientUserData } = await supabase
        .from('client_users')
        .select('full_name, client_id')
        .eq('user_id', user.id)
        .single();

      // Get agent name
      const { data: agentData } = await supabase
        .from('agents')
        .select('name')
        .eq('id', selectedAgentId)
        .single();

      // Get client name
      const { data: clientData } = await supabase
        .from('clients')
        .select('name')
        .eq('id', clientUserData?.client_id)
        .single();

      // Send email via edge function
      const { error } = await supabase.functions.invoke('send-support-email', {
        body: {
          userEmail: user.email,
          userName: clientUserData?.full_name || 'Unknown User',
          clientName: clientData?.name || 'Unknown Client',
          agentName: agentData?.name || 'Unknown Agent',
          subject: formData.subject,
          description: formData.description,
          priority: formData.priority,
          category: formData.category,
        },
      });

      if (error) throw error;

      toast({
        title: "Support request sent",
        description: "We'll get back to you as soon as possible.",
      });

      // Reset form
      setFormData({
        subject: "",
        description: "",
        priority: "medium",
        category: "technical-issue",
      });
    } catch (error) {
      console.error('Error sending support request:', error);
      toast({
        title: "Error",
        description: "Failed to send support request. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Submit Support Request</CardTitle>
        <CardDescription>
          Need help with your agent? Fill out this form and our support team will assist you.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="subject">Subject</Label>
            <Input
              id="subject"
              value={formData.subject}
              onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
              placeholder="Brief description of the issue"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="category">Category</Label>
            <Select
              value={formData.category}
              onValueChange={(value) => setFormData({ ...formData, category: value })}
            >
              <SelectTrigger id="category">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="technical-issue">Technical Issue</SelectItem>
                <SelectItem value="feature-question">Feature Question</SelectItem>
                <SelectItem value="bug-report">Bug Report</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="priority">Priority</Label>
            <Select
              value={formData.priority}
              onValueChange={(value) => setFormData({ ...formData, priority: value })}
            >
              <SelectTrigger id="priority">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="low">Low</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="high">High</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Please provide detailed information about your issue..."
              className="min-h-[150px]"
              required
            />
          </div>

          <Button type="submit" disabled={isSubmitting} className="w-full">
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Submit Support Request
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
