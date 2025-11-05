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
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b">
            <th className="text-left py-3 px-4 font-medium">User</th>
            <th className="text-left py-3 px-4 font-medium">Email</th>
            <th className="text-left py-3 px-4 font-medium">Role</th>
            <th className="text-left py-3 px-4 font-medium">Password</th>
            <th className="text-left py-3 px-4 font-medium">Last Changed</th>
            <th className="text-right py-3 px-4 font-medium">Actions</th>
          </tr>
        </thead>
        <tbody>
          {users.map((user) => (
            <tr key={user.id} className="border-b hover:bg-muted/50">
              <td className="py-3 px-4">
                <div className="flex items-center gap-3">
                  <Avatar>
                    <AvatarFallback>
                      {getInitials(user.profile.full_name, user.profile.first_name, user.profile.last_name)}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <div className="font-medium">
                      {user.profile.full_name || `${user.profile.first_name} ${user.profile.last_name}`}
                    </div>
                  </div>
                </div>
              </td>
              <td className="py-3 px-4 text-sm text-muted-foreground">
                {user.profile.email}
              </td>
              <td className="py-3 px-4">
                <Badge variant={getRoleBadgeVariant(user.role)}>
                  {user.role.charAt(0).toUpperCase() + user.role.slice(1)}
                </Badge>
              </td>
              <td className="py-3 px-4">
                <PasswordDisplay userId={user.user_id} />
              </td>
              <td className="py-3 px-4 text-sm text-muted-foreground">
                {format(new Date(user.profile.updated_at), 'MMM d, yyyy')}
              </td>
              <td className="py-3 px-4">
                <div className="flex items-center justify-end gap-2">
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => onReinvite(user.user_id)}
                    title="Reinvite user"
                  >
                    <Mail className="h-4 w-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => onEdit(user)}
                    title="Edit permissions"
                  >
                    <Settings className="h-4 w-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => onDelete(user)}
                    title="Remove user"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {users.length === 0 && (
        <div className="text-center py-8 text-muted-foreground">
          No users found
        </div>
      )}
    </div>
  );
}