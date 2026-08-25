export type ProposalStatus = "pending" | "ready" | "executed" | "expired" | "revoked";

export type ProposalKind = "transfer" | "add_owner" | "remove_owner" | "change_threshold" | "set_spending_limit" | "change_owner_weight";

export type ProposalCategory = "transfer" | "payroll" | "grant" | "ops" | "other";

export type Proposal = {
  id: number;
  kind: ProposalKind;
  category: ProposalCategory;
  to: string;
  amount: string;
  token: string;
  description: string;
  approvals: number;
  threshold: number;
  quorumWeight: number;
  approvalWeight: number;
  totalWeight: number;
  status: ProposalStatus;
  deadline: string;
  deadlineTs: number;
  createdAt: string;
  proposer: string;
  userHasApproved: boolean;
  approverAddresses: string[];
  executedAt?: string | null;
};

export type Owner = {
  address: string;
  label: string;
  weight: number;
};

export type OwnerWeight = {
  address: string;
  weight: number;
};

export type DashboardStat = {
  label: string;
  value: string;
  sub: string;
};

export type ProposalEventType = "approved" | "revoked" | "executed";

export type ProposalEvent = {
  type: ProposalEventType;
  actor: string;
  timestamp: string;
  ledger?: number;
};

export type Delegation = {
  delegator: string;
  delegate: string;
  weight: number;
  expiry: string;
  expiryTs: number;
  active: boolean;
};

export type OwnerDelegations = {
  outgoing: Delegation | null;
  incoming: Delegation[];
};

