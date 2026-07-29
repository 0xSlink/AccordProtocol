export type ProposalStatus = "pending" | "ready" | "executed" | "expired" | "revoked";

export type Proposal = {
  id: number;
  to: string;
  amount: string;
  token: string;
  description: string;
  approvals: number;
  threshold: number;
  status: ProposalStatus;
  deadline: string;
  deadlineTs: number;
  createdAt: string;
  proposer: string;
  userHasApproved: boolean;
  approverAddresses: string[];
};

export type Owner = {
  address: string;
  label: string;
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
