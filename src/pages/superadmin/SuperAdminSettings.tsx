import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AgentTypesSection } from "@/components/agency-management/AgentTypesSection";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Eye, EyeOff, Trash2 } from "lucide-react";

export default function SuperAdminSettings() {
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [showOpenAI, setShowOpenAI] = useState(false);
  const [showResend, setShowResend] = useState(false);
  const [apiKeys, setApiKeys] = useState({
    openai: '',
    resend: ''
  });

  const handleSaveOpenAI = async () => {
    if (!apiKeys.openai.trim()) {
      toast({
        title: "Error",
        description: "Please enter an API key",
        variant: "destructive",
      });
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase.functions.invoke('save-api-key', {
        body: { 
          keyType: 'openai',
          apiKey: apiKeys.openai.trim()
        }
      });

      if (error) throw error;

      toast({
        title: "Success",
        description: "OpenAI API key saved successfully",
      });
      setApiKeys(prev => ({ ...prev, openai: '' }));
      setShowOpenAI(false);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteOpenAI = async () => {
    if (!confirm('Are you sure you want to delete the OpenAI API key?')) return;

    setSaving(true);
    try {
      const { error } = await supabase.functions.invoke('delete-api-key', {
        body: { keyType: 'openai' }
      });

      if (error) throw error;

      toast({
        title: "Success",
        description: "OpenAI API key deleted",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleSaveResend = async () => {
    if (!apiKeys.resend.trim()) {
      toast({
        title: "Error",
        description: "Please enter an API key",
        variant: "destructive",
      });
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase.functions.invoke('save-api-key', {
        body: { 
          keyType: 'resend',
          apiKey: apiKeys.resend.trim()
        }
      });

      if (error) throw error;

      toast({
        title: "Success",
        description: "Resend API key saved successfully",
      });
      setApiKeys(prev => ({ ...prev, resend: '' }));
      setShowResend(false);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteResend = async () => {
    if (!confirm('Are you sure you want to delete the Resend API key?')) return;

    setSaving(true);
    try {
      const { error } = await supabase.functions.invoke('delete-api-key', {
        body: { keyType: 'resend' }
      });

      if (error) throw error;

      toast({
        title: "Success",
        description: "Resend API key deleted",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-4xl font-bold">Settings</h1>
        <p className="text-muted-foreground">
          Manage super admin settings and configurations
        </p>
      </div>

      <Tabs defaultValue="general" className="space-y-4">
        <TabsList>
          <TabsTrigger value="general">General</TabsTrigger>
          <TabsTrigger value="agent-types">Agent Types</TabsTrigger>
          <TabsTrigger value="integrations">API Integration</TabsTrigger>
        </TabsList>

        <TabsContent value="general" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>General Settings</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">
                Super admin general settings will be available here.
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="agent-types" className="space-y-4">
          <AgentTypesSection />
        </TabsContent>

        <TabsContent value="integrations" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>OpenAI Integration</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="openai-key">API Key</Label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Input
                      id="openai-key"
                      type={showOpenAI ? "text" : "password"}
                      value={apiKeys.openai}
                      onChange={(e) => setApiKeys(prev => ({ ...prev, openai: e.target.value }))}
                      placeholder="sk-..."
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="absolute right-0 top-0 h-full px-3"
                      onClick={() => setShowOpenAI(!showOpenAI)}
                    >
                      {showOpenAI ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                  </div>
                  <Button onClick={handleSaveOpenAI} disabled={saving}>
                    Save
                  </Button>
                  <Button variant="destructive" onClick={handleDeleteOpenAI} disabled={saving}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Resend Integration</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="resend-key">API Key</Label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Input
                      id="resend-key"
                      type={showResend ? "text" : "password"}
                      value={apiKeys.resend}
                      onChange={(e) => setApiKeys(prev => ({ ...prev, resend: e.target.value }))}
                      placeholder="re_..."
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="absolute right-0 top-0 h-full px-3"
                      onClick={() => setShowResend(!showResend)}
                    >
                      {showResend ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                  </div>
                  <Button onClick={handleSaveResend} disabled={saving}>
                    Save
                  </Button>
                  <Button variant="destructive" onClick={handleDeleteResend} disabled={saving}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
