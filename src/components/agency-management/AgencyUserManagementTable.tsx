import { useState } from "react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PasswordDisplay } from "@/components/PasswordDisplay";
import { Settings, Trash2, Mail } from "lucide-react";
import { format } from "date-fns";

interface Profile {
  email: string;
  full_name: string | null;
  first_name: string | null;
  last_name: string | null;
  updated_at: string;
}

export interface AgencyUser {
  id: string;
  user_id: string;
  role: 'owner' | 'admin' | 'user';
  created_at: string;
  profile: Profile;
}

interface AgencyUserManagementTableProps {
  users: AgencyUser[];
  onEdit: (user: AgencyUser) => void;
  onReinvite: (userId: string) => void;
  onDelete: (user: AgencyUser) => void;
}

export function AgencyUserManagementTable({
  users,
  onEdit,
  onReinvite,
  onDelete,
}: AgencyUserManagementTableProps) {
  const getInitials = (name: string | null, firstName: string | null, lastName: string | null) => {
    if (name) {
      return name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2);
    }
    if (firstName && lastName) {
      return (firstName[0] + lastName[0]).toUpperCase();
    }
    return "AU";
  };

  const getRoleBadgeVariant = (role: string) => {
    if (role === 'owner') return 'default';
    if (role === 'admin') return 'secondary';
    return 'outline';
  };

  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="w-full">
        <thead>
          <tr className="border-b bg-muted/50">
            <th className="text-left py-2 px-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">User</th>
            <th className="text-left py-2 px-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">Email</th>
            <th className="text-left py-2 px-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">Role</th>
            <th className="text-left py-2 px-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">Password</th>
            <th className="text-left py-2 px-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">Last Changed</th>
            <th className="text-right py-2 px-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">Actions</th>
          </tr>
        </thead>
        <tbody>
          {users.map((user) => (
            <tr 
              key={user.id} 
              className="border-b last:border-b-0 hover:bg-muted/30 transition-colors"
            >
              <td className="py-2 px-3">
                <div className="flex items-center gap-2">
                  <Avatar className="h-8 w-8">
                    <AvatarFallback className="text-xs">
                      {getInitials(user.profile.full_name, user.profile.first_name, user.profile.last_name)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="font-medium text-sm">
                    {user.profile.full_name || `${user.profile.first_name} ${user.profile.last_name}`}
                  </div>
                </div>
              </td>
              <td className="py-2 px-3 text-sm text-muted-foreground">
                {user.profile.email}
              </td>
              <td className="py-2 px-3">
                <Badge 
                  variant={getRoleBadgeVariant(user.role)}
                  className="text-xs py-0 px-2"
                >
                  {user.role.charAt(0).toUpperCase() + user.role.slice(1)}
                </Badge>
              </td>
              <td className="py-2 px-3">
                <PasswordDisplay userId={user.user_id} />
              </td>
              <td className="py-2 px-3 text-xs text-muted-foreground">
                {format(new Date(user.profile.updated_at), 'MMM d, yyyy')}
              </td>
              <td className="py-2 px-3">
                <div className="flex items-center justify-end gap-1">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => onReinvite(user.user_id)}
                    title="Reinvite user"
                    className="h-7 w-7 p-0"
                  >
                    <Mail className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => onEdit(user)}
                    title="Edit permissions"
                    className="h-7 w-7 p-0"
                  >
                    <Settings className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => onDelete(user)}
                    title="Remove user"
                    className="h-7 w-7 p-0"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {users.length === 0 && (
        <div className="text-center py-8 text-sm text-muted-foreground">
          No users found
        </div>
      )}
    </div>
  );
}