"use strict";
// ─── Enums (mirror Prisma enums) ─────────────────
Object.defineProperty(exports, "__esModule", { value: true });
exports.ROLE_PERMISSIONS = exports.Permission = exports.VALID_STATUS_TRANSITIONS = exports.EventAction = exports.WorkItemPriority = exports.WorkItemStatus = exports.WorkItemType = exports.TeamRole = void 0;
var TeamRole;
(function (TeamRole) {
    TeamRole["ADMIN"] = "ADMIN";
    TeamRole["MANAGER"] = "MANAGER";
    TeamRole["MEMBER"] = "MEMBER";
    TeamRole["VIEWER"] = "VIEWER";
})(TeamRole || (exports.TeamRole = TeamRole = {}));
var WorkItemType;
(function (WorkItemType) {
    WorkItemType["INCIDENT"] = "INCIDENT";
    WorkItemType["TASK"] = "TASK";
    WorkItemType["REQUEST"] = "REQUEST";
    WorkItemType["INVESTIGATION"] = "INVESTIGATION";
})(WorkItemType || (exports.WorkItemType = WorkItemType = {}));
var WorkItemStatus;
(function (WorkItemStatus) {
    WorkItemStatus["OPEN"] = "OPEN";
    WorkItemStatus["TRIAGED"] = "TRIAGED";
    WorkItemStatus["IN_PROGRESS"] = "IN_PROGRESS";
    WorkItemStatus["BLOCKED"] = "BLOCKED";
    WorkItemStatus["RESOLVED"] = "RESOLVED";
    WorkItemStatus["CLOSED"] = "CLOSED";
})(WorkItemStatus || (exports.WorkItemStatus = WorkItemStatus = {}));
var WorkItemPriority;
(function (WorkItemPriority) {
    WorkItemPriority["CRITICAL"] = "CRITICAL";
    WorkItemPriority["HIGH"] = "HIGH";
    WorkItemPriority["MEDIUM"] = "MEDIUM";
    WorkItemPriority["LOW"] = "LOW";
})(WorkItemPriority || (exports.WorkItemPriority = WorkItemPriority = {}));
var EventAction;
(function (EventAction) {
    EventAction["CREATED"] = "CREATED";
    EventAction["UPDATED"] = "UPDATED";
    EventAction["STATUS_CHANGED"] = "STATUS_CHANGED";
    EventAction["PRIORITY_CHANGED"] = "PRIORITY_CHANGED";
    EventAction["ASSIGNED"] = "ASSIGNED";
    EventAction["UNASSIGNED"] = "UNASSIGNED";
    EventAction["COMMENTED"] = "COMMENTED";
    EventAction["RESOLVED"] = "RESOLVED";
    EventAction["CLOSED"] = "CLOSED";
    EventAction["REOPENED"] = "REOPENED";
})(EventAction || (exports.EventAction = EventAction = {}));
// ─── Valid State Transitions ─────────────────────
// This map defines which status transitions are allowed.
// Key = current status, Value = array of allowed next statuses.
// This MUST be enforced server-side in the transition endpoint.
exports.VALID_STATUS_TRANSITIONS = {
    [WorkItemStatus.OPEN]: [WorkItemStatus.TRIAGED, WorkItemStatus.IN_PROGRESS, WorkItemStatus.CLOSED],
    [WorkItemStatus.TRIAGED]: [WorkItemStatus.IN_PROGRESS, WorkItemStatus.BLOCKED, WorkItemStatus.CLOSED],
    [WorkItemStatus.IN_PROGRESS]: [WorkItemStatus.BLOCKED, WorkItemStatus.RESOLVED, WorkItemStatus.CLOSED],
    [WorkItemStatus.BLOCKED]: [WorkItemStatus.IN_PROGRESS, WorkItemStatus.CLOSED],
    [WorkItemStatus.RESOLVED]: [WorkItemStatus.CLOSED, WorkItemStatus.IN_PROGRESS],
    [WorkItemStatus.CLOSED]: [WorkItemStatus.OPEN],
};
// ─── Permission Definitions ──────────────────────
// Maps roles to allowed actions. Used by the authorize middleware.
var Permission;
(function (Permission) {
    Permission["CREATE_WORK_ITEM"] = "CREATE_WORK_ITEM";
    Permission["VIEW_WORK_ITEM"] = "VIEW_WORK_ITEM";
    Permission["EDIT_OWN_WORK_ITEM"] = "EDIT_OWN_WORK_ITEM";
    Permission["EDIT_ANY_WORK_ITEM"] = "EDIT_ANY_WORK_ITEM";
    Permission["ASSIGN_WORK_ITEM"] = "ASSIGN_WORK_ITEM";
    Permission["TRANSITION_WORK_ITEM"] = "TRANSITION_WORK_ITEM";
    Permission["CLOSE_OWN_WORK_ITEM"] = "CLOSE_OWN_WORK_ITEM";
    Permission["CLOSE_ANY_WORK_ITEM"] = "CLOSE_ANY_WORK_ITEM";
    Permission["ADD_COMMENT"] = "ADD_COMMENT";
    Permission["MANAGE_TEAM"] = "MANAGE_TEAM";
})(Permission || (exports.Permission = Permission = {}));
exports.ROLE_PERMISSIONS = {
    [TeamRole.VIEWER]: [
        Permission.VIEW_WORK_ITEM,
    ],
    [TeamRole.MEMBER]: [
        Permission.VIEW_WORK_ITEM,
        Permission.CREATE_WORK_ITEM,
        Permission.EDIT_OWN_WORK_ITEM,
        Permission.TRANSITION_WORK_ITEM,
        Permission.CLOSE_OWN_WORK_ITEM,
        Permission.ADD_COMMENT,
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
//# sourceMappingURL=types.js.map