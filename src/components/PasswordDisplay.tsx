import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Mail, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
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

interface PasswordDisplayProps {
  userId: string;
  userEmail?: string;
}

export function PasswordDisplay({ userId, userEmail }: PasswordDisplayProps) {
  const [sendingReset, setSendingReset] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const { toast } = useToast();

  const handleSendResetEmail = async () => {
    setSendingReset(true);
    try {
      const { error } = await supabase.functions.invoke('send-password-reset-email', {
        body: { userId },
      });

      if (error) throw error;

      setShowResetConfirm(false);
      
      toast({
        title: "Success",
        description: "Password reset email sent",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to send reset email",
        variant: "destructive",
      });
    } finally {
      setSendingReset(false);
    }
  };

  return (
    <>
      <Button
        size="icon"
        variant="ghost"
        className="h-7 w-7"
        onClick={() => setShowResetConfirm(true)}
        title="Send password reset email"
      >
        <Mail className="h-3 w-3" />
      </Button>

      <AlertDialog open={showResetConfirm} onOpenChange={setShowResetConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Send Password Reset Email</AlertDialogTitle>
            <AlertDialogDescription>
              This will send a password reset email to the user. They will be able to set a new password.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={sendingReset}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleSendResetEmail} disabled={sendingReset}>
              {sendingReset ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Sending...
                </>
              ) : (
                "Send Reset Email"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
