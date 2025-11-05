import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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

interface Department {
  id: string;
  name: string;
  color: string;
}

interface ClientUser {
  id: string;
  user_id: string;
  first_name: string | null;
  last_name: string | null;
  avatar_url: string | null;
  department_id: string | null;
  created_at: string;
  profile: Profile;
  department?: Department | null;
}

interface ClientUserManagementTableProps {
  users: ClientUser[];
  onEdit: (user: ClientUser) => void;
  onReinvite: (userId: string) => void;
  onDelete: (user: ClientUser) => void;
}

export function ClientUserManagementTable({
  users,
  onEdit,
  onReinvite,
  onDelete,
}: ClientUserManagementTableProps) {
  const getInitials = (firstName: string | null, lastName: string | null) => {
    if (firstName && lastName) {
      return (firstName[0] + lastName[0]).toUpperCase();
    }
    return "CU";
  };

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b">
            <th className="text-left py-3 px-4 font-medium">User</th>
            <th className="text-left py-3 px-4 font-medium">Email</th>
            <th className="text-left py-3 px-4 font-medium">Department</th>
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
                    {user.avatar_url && <AvatarImage src={user.avatar_url} />}
                    <AvatarFallback>
                      {getInitials(user.first_name, user.last_name)}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <div className="font-medium">
                      {user.first_name} {user.last_name}
                    </div>
                  </div>
                </div>
              </td>
              <td className="py-3 px-4 text-sm text-muted-foreground">
                {user.profile.email}
              </td>
              <td className="py-3 px-4">
                {user.department ? (
                  <Badge 
                    style={{ 
                      backgroundColor: user.department.color,
                      color: '#fff'
                    }}
                  >
                    {user.department.name}
                  </Badge>
                ) : (
                  <span className="text-sm text-muted-foreground">No department</span>
                )}
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