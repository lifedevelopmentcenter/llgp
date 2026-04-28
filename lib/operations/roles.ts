import type { UserRole } from "@/lib/types";

export const OPS_ACCESS_ROLES: UserRole[] = [
  "global_admin",
  "global_team_lead",
  "global_operations_member",
  "finance_coordinator",
  "travel_coordinator",
  "missions_coordinator",
];

export const OPS_TEAM_ADMIN_ROLES: UserRole[] = ["global_admin", "global_team_lead"];

export const OPS_ASSIGNABLE_ROLES: UserRole[] = [
  "global_team_lead",
  "global_operations_member",
  "finance_coordinator",
  "travel_coordinator",
  "missions_coordinator",
  "national_leader",
  "city_leader",
  "hub_leader",
  "participant",
];

export const OPS_EDITOR_ROLES: UserRole[] = [
  "global_admin",
  "global_team_lead",
  "global_operations_member",
  "missions_coordinator",
];

export const hasRole = (role: UserRole | undefined, roles: UserRole[]) => Boolean(role && roles.includes(role));
