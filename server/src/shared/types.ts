// ─── Enums (mirror Prisma enums) ─────────────────

export enum TeamRole {
  ADMIN = 'ADMIN',
  MANAGER = 'MANAGER',
  MEMBER = 'MEMBER',
  VIEWER = 'VIEWER',
}

export enum WorkItemType {
  INCIDENT = 'INCIDENT',
  TASK = 'TASK',
  REQUEST = 'REQUEST',
  INVESTIGATION = 'INVESTIGATION',
}

export enum WorkItemStatus {
  OPEN = 'OPEN',
  TRIAGED = 'TRIAGED',
  IN_PROGRESS = 'IN_PROGRESS',
  BLOCKED = 'BLOCKED',
  RESOLVED = 'RESOLVED',
  CLOSED = 'CLOSED',
}

export enum WorkItemPriority {
  CRITICAL = 'CRITICAL',
  HIGH = 'HIGH',
  MEDIUM = 'MEDIUM',
  LOW = 'LOW',
}

export enum EventAction {
  CREATED = 'CREATED',
  UPDATED = 'UPDATED',
  STATUS_CHANGED = 'STATUS_CHANGED',
  PRIORITY_CHANGED = 'PRIORITY_CHANGED',
  ASSIGNED = 'ASSIGNED',
  UNASSIGNED = 'UNASSIGNED',
  COMMENTED = 'COMMENTED',
  RESOLVED = 'RESOLVED',
  CLOSED = 'CLOSED',
  REOPENED = 'REOPENED',
}

// ─── Valid State Transitions ─────────────────────
// This map defines which status transitions are allowed.
// Key = current status, Value = array of allowed next statuses.
// This MUST be enforced server-side in the transition endpoint.

export const VALID_STATUS_TRANSITIONS: Record<WorkItemStatus, WorkItemStatus[]> = {
  [WorkItemStatus.OPEN]: [WorkItemStatus.TRIAGED, WorkItemStatus.IN_PROGRESS, WorkItemStatus.CLOSED],
  [WorkItemStatus.TRIAGED]: [WorkItemStatus.IN_PROGRESS, WorkItemStatus.BLOCKED, WorkItemStatus.CLOSED],
  [WorkItemStatus.IN_PROGRESS]: [WorkItemStatus.BLOCKED, WorkItemStatus.RESOLVED, WorkItemStatus.CLOSED],
  [WorkItemStatus.BLOCKED]: [WorkItemStatus.IN_PROGRESS, WorkItemStatus.CLOSED],
  [WorkItemStatus.RESOLVED]: [WorkItemStatus.CLOSED, WorkItemStatus.IN_PROGRESS],
  [WorkItemStatus.CLOSED]: [WorkItemStatus.OPEN],
};

// ─── Permission Definitions ──────────────────────
// Maps roles to allowed actions. Used by the authorize middleware.

export enum Permission {
  CREATE_WORK_ITEM = 'CREATE_WORK_ITEM',
  VIEW_WORK_ITEM = 'VIEW_WORK_ITEM',
  EDIT_OWN_WORK_ITEM = 'EDIT_OWN_WORK_ITEM',
  EDIT_ANY_WORK_ITEM = 'EDIT_ANY_WORK_ITEM',
  ASSIGN_WORK_ITEM = 'ASSIGN_WORK_ITEM',
  TRANSITION_WORK_ITEM = 'TRANSITION_WORK_ITEM',
  CLOSE_OWN_WORK_ITEM = 'CLOSE_OWN_WORK_ITEM',
  CLOSE_ANY_WORK_ITEM = 'CLOSE_ANY_WORK_ITEM',
  ADD_COMMENT = 'ADD_COMMENT',
  MANAGE_TEAM = 'MANAGE_TEAM',
}

export const ROLE_PERMISSIONS: Record<TeamRole, Permission[]> = {
  [TeamRole.VIEWER]: [
    Permission.VIEW_WORK_ITEM,
    Permission.ADD_COMMENT,
  ],
  [TeamRole.MEMBER]: [
    Permission.VIEW_WORK_ITEM,
    Permission.CREATE_WORK_ITEM,
    Permission.EDIT_OWN_WORK_ITEM,
    Permission.TRANSITION_WORK_ITEM,
    Permission.CLOSE_OWN_WORK_ITEM,
    Permission.ADD_COMMENT,
    Permission.ASSIGN_WORK_ITEM,
  ],
  [TeamRole.MANAGER]: [
    Permission.VIEW_WORK_ITEM,
    Permission.CREATE_WORK_ITEM,
    Permission.EDIT_OWN_WORK_ITEM,
    Permission.EDIT_ANY_WORK_ITEM,
    Permission.ASSIGN_WORK_ITEM,
    Permission.TRANSITION_WORK_ITEM,
    Permission.CLOSE_OWN_WORK_ITEM,
    Permission.CLOSE_ANY_WORK_ITEM,
    Permission.ADD_COMMENT,
  ],
  [TeamRole.ADMIN]: [
    Permission.VIEW_WORK_ITEM,
    Permission.CREATE_WORK_ITEM,
    Permission.EDIT_OWN_WORK_ITEM,
    Permission.EDIT_ANY_WORK_ITEM,
    Permission.ASSIGN_WORK_ITEM,
    Permission.TRANSITION_WORK_ITEM,
    Permission.CLOSE_OWN_WORK_ITEM,
    Permission.CLOSE_ANY_WORK_ITEM,
    Permission.ADD_COMMENT,
    Permission.MANAGE_TEAM,
  ],
};

// ─── API Request/Response Types ──────────────────

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  token: string;
  user: UserResponse;
}

export interface UserResponse {
  id: string;
  email: string;
  name: string;
  teams: Array<{
    teamId: string;
    teamName: string;
    role: TeamRole;
  }>;
}

export interface CreateWorkItemRequest {
  title: string;
  description?: string;
  type: WorkItemType;
  priority: WorkItemPriority;
  teamId: string;
  assigneeId?: string;
  dueDate?: string;
}

export interface UpdateWorkItemRequest {
  title?: string;
  description?: string;
  priority?: WorkItemPriority;
  dueDate?: string | null;
  version: number;
}

export interface TransitionWorkItemRequest {
  status: WorkItemStatus;
  version: number;
}

export interface AssignWorkItemRequest {
  assigneeId: string | null;
  version: number;
}

export interface CreateCommentRequest {
  body: string;
}

export interface WorkItemResponse {
  id: string;
  title: string;
  description: string | null;
  type: WorkItemType;
  status: WorkItemStatus;
  priority: WorkItemPriority;
  version: number;
  assignee: { id: string; name: string; email: string } | null;
  reporter: { id: string; name: string; email: string };
  team: { id: string; name: string };
  dueDate: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface WorkItemListResponse {
  items: WorkItemResponse[];
  nextCursor: string | null;
  totalCount: number;
}

export interface TimelineEntry {
  id: string;
  type: 'event' | 'comment';
  userId: string;
  userName: string;
  createdAt: string;
  action?: EventAction;
  changes?: Record<string, { from: unknown; to: unknown }>;
  body?: string;
}

export interface DashboardSummary {
  totalOpen: number;
  totalCritical: number;
  totalAssignedToMe: number;
  byStatus: Record<WorkItemStatus, number>;
  byPriority: Record<WorkItemPriority, number>;
  recentActivity: TimelineEntry[];
}

export interface ApiError {
  error: {
    code: string;
    message: string;
    details?: unknown;
    currentState?: WorkItemResponse;
  };
}

// ─── SSE Event Types ─────────────────────────────

export interface SSEWorkItemUpdated {
  type: 'WORK_ITEM_UPDATED';
  workItemId: string;
  updatedBy: string;
  updatedByName: string;
  version: number;
  changes: Record<string, { from: unknown; to: unknown }>;
  timestamp: string;
}

export interface SSEWorkItemCreated {
  type: 'WORK_ITEM_CREATED';
  workItem: WorkItemResponse;
  timestamp: string;
}

export type SSEEvent = SSEWorkItemUpdated | SSEWorkItemCreated;