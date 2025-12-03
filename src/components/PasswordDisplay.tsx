import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Edit2, Save, X, Mail, Loader2 } from "lucide-react";
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
  const [hint, setHint] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [loading, setLoading] = useState(true);
  const [sendingReset, setSendingReset] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    loadHint();
  }, [userId]);

  const loadHint = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('get-user-password', {
        body: { userId },
      });

      if (error) throw error;
      setHint(data?.hint || null);
    } catch (error: any) {
      console.error('Error loading password hint:', error);
      setHint(null);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!newPassword.trim()) {
      toast({
        title: "Error",
        description: "Password cannot be empty",
        variant: "destructive",
      });
      return;
    }

    if (newPassword.length < 6) {
      toast({
        title: "Error",
        description: "Password must be at least 6 characters",
        variant: "destructive",
      });
      return;
    }

    try {
      const { error } = await supabase.functions.invoke('reset-user-password', {
        body: {
          userId,
          newPassword,
          isAdminReset: true,
        },
      });

      if (error) throw error;

      // Update local hint to first 2 chars
      setHint(newPassword.substring(0, 2));
      setEditing(false);
      setNewPassword("");
      
      toast({
        title: "Success",
        description: "Password updated successfully",
      });
    } catch (error: any) {
      let errorMessage = error.message;
      
      if (error.message?.includes('6 characters') || error.message?.includes('weak password')) {
        errorMessage = "Password must be at least 6 characters";
      }
      
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    }
  };

  const handleSendResetEmail = async () => {
    setSendingReset(true);
    try {
      const { error } = await supabase.functions.invoke('send-password-reset-email', {
        body: { userId },
      });

      if (error) throw error;

      // Clear local hint since user will set new password
      setHint(null);
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

  const getHintDisplay = () => {
    if (!hint) return "No hint";
    return `${hint}••••••`;
  };

  if (loading) {
    return <span className="text-xs text-muted-foreground">Loading...</span>;
  }

  if (editing) {
    return (
      <div className="flex items-center gap-1">
        <Input
          type="text"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          placeholder="New password"
          className="h-7 w-32 text-xs"
        />
        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={handleSave}>
          <Save className="h-3 w-3" />
        </Button>
        <Button
          size="icon"
          variant="ghost"
          className="h-7 w-7"
          onClick={() => {
            setEditing(false);
            setNewPassword("");
          }}
        >
          <X className="h-3 w-3" />
        </Button>
      </div>
    );
  }

  return (
    <>
      <div className="flex items-center gap-1">
        <code className="text-xs bg-muted px-2 py-1 rounded">{getHintDisplay()}</code>
        <Button
          size="icon"
          variant="ghost"
          className="h-7 w-7"
          onClick={() => setEditing(true)}
          title="Set new password"
        >
          <Edit2 className="h-3 w-3" />
        </Button>
        <Button
          size="icon"
          variant="ghost"
          className="h-7 w-7"
          onClick={() => setShowResetConfirm(true)}
          title="Send password reset email"
        >
          <Mail className="h-3 w-3" />
        </Button>
      </div>

      <AlertDialog open={showResetConfirm} onOpenChange={setShowResetConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Send Password Reset Email</AlertDialogTitle>
            <AlertDialogDescription>
              This will send a password reset email to the user. They will be able to set a new password, and you will no longer see a password hint for this user.
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
