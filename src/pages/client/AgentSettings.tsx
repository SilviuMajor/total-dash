import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SupportRequestForm } from "@/components/agent-management/SupportRequestForm";

export default function AgentSettings() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-4xl font-bold text-foreground">Agent Settings</h1>
        <p className="text-muted-foreground">Configure and manage your agent</p>
      </div>
      
      <Tabs defaultValue="support">
        <TabsList>
          <TabsTrigger value="support">Support</TabsTrigger>
        </TabsList>
        
        <TabsContent value="support">
          <SupportRequestForm />
        </TabsContent>
      </Tabs>
    </div>
  );
}
