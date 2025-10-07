import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Edit2, Save, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface PasswordDisplayProps {
  userId: string;
}

export function PasswordDisplay({ userId }: PasswordDisplayProps) {
  const [password, setPassword] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    loadPassword();
  }, [userId]);

  const loadPassword = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('get-user-password', {
        body: { userId },
      });

      if (error) throw error;
      setPassword(data.password);
    } catch (error: any) {
      console.error('Error loading password:', error);
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

    try {
      const { error } = await supabase.functions.invoke('reset-user-password', {
        body: {
          userId,
          newPassword,
        },
      });

      if (error) throw error;

      setPassword(newPassword);
      setEditing(false);
      setNewPassword("");
      
      toast({
        title: "Success",
        description: "Password updated successfully",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const getCensoredPassword = () => {
    if (!password) return "••••••••";
    return password.charAt(0) + "••••••••";
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
    <div className="flex items-center gap-1">
      <code className="text-xs bg-muted px-2 py-1 rounded">{getCensoredPassword()}</code>
      <Button
        size="icon"
        variant="ghost"
        className="h-7 w-7"
        onClick={() => {
          setEditing(true);
          setNewPassword(password || "");
        }}
      >
        <Edit2 className="h-3 w-3" />
      </Button>
    </div>
  );
}
