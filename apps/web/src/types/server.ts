export type MemberRole = "owner" | "admin" | "member";

export interface Server {
  id: string;
  name: string;
  icon: string;          // emoji or image URL
  description: string;
  ownerId: string;
  boardId: string;       // the board that IS this server
  isPublic: boolean;
  memberCount: number;
  onlineCount: number;
  createdAt: string;
  roles?: ServerRole[];
}

export interface ServerMember {
  userId: string;
  username: string;
  avatar: string;        // single char or URL
  role: MemberRole;
  online: boolean;
  status?: string;
}

export interface RolePermission {
  canViewBoard: boolean;
  canEditBoard: boolean;
  canUploadFiles: boolean;
  canManageRoles: boolean;
  canManageMembers: boolean;
  canInviteMembers: boolean;
}

export interface ServerRole {
  id: string;
  name: string;
  color: string;     // hex color
  permissions: RolePermission;
  isDefault?: boolean; // true for the built-in @everyone role
}
