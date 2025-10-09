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

  const handleWarningConfirm = () => {
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

      // Delete in order: conversations (which will cascade to transcripts), agent_assignments, then agent
      const { data: conversations } = await supabase
        .from("conversations")
        .select("id")
        .eq("agent_id", agentId);

      if (conversations && conversations.length > 0) {
        const conversationIds = conversations.map((c) => c.id);
        
        // Delete transcripts
        await supabase
          .from("transcripts")
          .delete()
          .in("conversation_id", conversationIds);

        // Delete conversations
        await supabase
          .from("conversations")
          .delete()
          .eq("agent_id", agentId);
      }

      // Delete agent assignments
      await supabase
        .from("agent_assignments")
        .delete()
        .eq("agent_id", agentId);

      // Delete the agent
      const { error: deleteError } = await supabase
        .from("agents")
        .delete()
        .eq("id", agentId);

      if (deleteError) throw deleteError;

      toast({
        title: "Success",
        description: "Agent deleted successfully",
      });

      handleClose();
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
      <AlertDialogContent>
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
                onClick={handleWarningConfirm}
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
