import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface AgentDeletionDialogProps {
  agentId: string;
  agentName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function AgentDeletionDialog({
  agentId,
  agentName,
  open,
  onOpenChange,
  onSuccess,
}: AgentDeletionDialogProps) {
  const [step, setStep] = useState<"warning" | "password">("warning");
  const [password, setPassword] = useState("");
  const [deleting, setDeleting] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();

  const handleClose = () => {
    setStep("warning");
    setPassword("");
    onOpenChange(false);
  };

  const handleWarningConfirm = (e: React.MouseEvent) => {
    e.preventDefault(); // Prevent dialog from closing
    setStep("password");
  };

  const handlePasswordConfirm = async () => {
    if (!password) {
      toast({
        title: "Error",
        description: "Please enter your password",
        variant: "destructive",
      });
      return;
    }

    setDeleting(true);
    try {
      // Verify admin password
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: user.email!,
        password: password,
      });

      if (signInError) {
        toast({
          title: "Error",
          description: "Invalid password",
          variant: "destructive",
        });
        setDeleting(false);
        return;
      }

      console.log("Password verified, starting deletion process for agent:", agentId);

      // Delete in order: conversations (which will cascade to transcripts), agent_assignments, then agent
      const { data: conversations } = await supabase
        .from("conversations")
        .select("id")
        .eq("agent_id", agentId);

      console.log("Found conversations to delete:", conversations?.length || 0);

      if (conversations && conversations.length > 0) {
        const conversationIds = conversations.map((c) => c.id);
        
        // Delete transcripts
        const { error: transcriptsError } = await supabase
          .from("transcripts")
          .delete()
          .in("conversation_id", conversationIds);

        if (transcriptsError) {
          console.error("Error deleting transcripts:", transcriptsError);
          throw transcriptsError;
        }
        console.log("Transcripts deleted");

        // Delete conversations
        const { error: conversationsError } = await supabase
          .from("conversations")
          .delete()
          .eq("agent_id", agentId);

        if (conversationsError) {
          console.error("Error deleting conversations:", conversationsError);
          throw conversationsError;
        }
        console.log("Conversations deleted");
      }

      // Delete agent assignments
      const { error: assignmentsError } = await supabase
        .from("agent_assignments")
        .delete()
        .eq("agent_id", agentId);

      if (assignmentsError) {
        console.error("Error deleting agent assignments:", assignmentsError);
        throw assignmentsError;
      }
      console.log("Agent assignments deleted");

      // Delete client user agent permissions
      const { error: permissionsError } = await supabase
        .from("client_user_agent_permissions")
        .delete()
        .eq("agent_id", agentId);

      if (permissionsError) {
        console.error("Error deleting agent permissions:", permissionsError);
        throw permissionsError;
      }
      console.log("Agent permissions deleted");

      // Delete agent update logs
      const { error: logsError } = await supabase
        .from("agent_update_logs")
        .delete()
        .eq("agent_id", agentId);

      if (logsError) {
        console.error("Error deleting update logs:", logsError);
        throw logsError;
      }
      console.log("Update logs deleted");

      // Delete agent integrations
      const { error: integrationsError } = await supabase
        .from("agent_integrations")
        .delete()
        .eq("agent_id", agentId);

      if (integrationsError) {
        console.error("Error deleting integrations:", integrationsError);
        throw integrationsError;
      }
      console.log("Integrations deleted");

      // Delete agent workflows
      const { error: workflowsError } = await supabase
        .from("agent_workflows")
        .delete()
        .eq("agent_id", agentId);

      if (workflowsError) {
        console.error("Error deleting workflows:", workflowsError);
        throw workflowsError;
      }
      console.log("Workflows deleted");

      // Delete agent workflow categories
      const { error: categoriesError } = await supabase
        .from("agent_workflow_categories")
        .delete()
        .eq("agent_id", agentId);

      if (categoriesError) {
        console.error("Error deleting workflow categories:", categoriesError);
        throw categoriesError;
      }
      console.log("Workflow categories deleted");

      // Delete agent spec sections
      const { error: specsError } = await supabase
        .from("agent_spec_sections")
        .delete()
        .eq("agent_id", agentId);

      if (specsError) {
        console.error("Error deleting spec sections:", specsError);
        throw specsError;
      }
      console.log("Spec sections deleted");

      // Delete the agent
      const { error: deleteError } = await supabase
        .from("agents")
        .delete()
        .eq("id", agentId);

      if (deleteError) throw deleteError;
      console.log("Agent deleted successfully");

      toast({
        title: "Success",
        description: "Agent deleted successfully",
      });

      handleClose();
      console.log("Calling onSuccess callback");
      onSuccess();
    } catch (error: any) {
      console.error("Error deleting agent:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to delete agent",
        variant: "destructive",
      });
    } finally {
      setDeleting(false);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={handleClose}>
      <AlertDialogContent className="z-[100]">
        {step === "warning" ? (
          <>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Agent</AlertDialogTitle>
              <AlertDialogDescription asChild>
                <div className="space-y-2">
                  <p className="font-semibold text-destructive">
                    Warning: This action cannot be undone.
                  </p>
                  <p>
                    Deleting "{agentName}" will permanently remove:
                  </p>
                  <ul className="list-disc list-inside space-y-1 text-sm">
                    <li>All conversations associated with this agent</li>
                    <li>All transcripts from those conversations</li>
                    <li>All client assignments for this agent</li>
                    <li>The agent configuration and settings</li>
                  </ul>
                  <p className="mt-4">
                    Are you sure you want to proceed?
                  </p>
                </div>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                handleWarningConfirm(e);
              }}
              className="bg-destructive hover:bg-destructive/90"
            >
              Continue
            </AlertDialogAction>
            </AlertDialogFooter>
          </>
        ) : (
          <>
            <AlertDialogHeader>
              <AlertDialogTitle>Confirm Admin Password</AlertDialogTitle>
              <AlertDialogDescription>
                Please enter your admin password to confirm the deletion of "{agentName}".
              </AlertDialogDescription>
            </AlertDialogHeader>
            <div className="py-4">
              <Label htmlFor="admin-password">Admin Password</Label>
              <Input
                id="admin-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    handlePasswordConfirm();
                  }
                }}
              />
            </div>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={handleClose}>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={handlePasswordConfirm}
                disabled={deleting}
                className="bg-destructive hover:bg-destructive/90"
              >
                {deleting ? "Deleting..." : "Delete Agent"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </>
        )}
      </AlertDialogContent>
    </AlertDialog>
  );
}
