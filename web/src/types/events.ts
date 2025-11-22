/**
 * Vault event types based on contract emissions
 */

export type VaultEventType =
  | "Deposit"
  | "Withdraw"
  | "GuardArmed"
  | "GasBankUpdated"
  | "AutonomousModeStarted"
  | "AutonomousModeStopped"
  | "TriggerRebalanceStarted"
  | "NextRebalanceScheduled"
  | "SlicePlanned"
  | "RebalanceExecuted"
  | "ManualRebalanceTriggered"
  | "RebalanceSkipped"
  | "SwapExecuted"
  | "MultiHopSwapExecuted"
  | "TokenApproved"
  | "BalancesRead"
  | "CurrentWeights"
  | "RebalanceCompleted"
  | "DriftCalculated"
  | "AutonomousRebalanceScheduled"
  | "AutonomousRebalanceSkipped"
  | "ContractPaused"
  | "ContractUnpaused"
  | "TargetsUpdated"
  | "MaxDriftUpdated"
  | "RebalanceEpochUpdated"
  | "EmergencyWithdraw"
  | "OwnershipTransferred";

export interface BaseEvent {
  type: VaultEventType;
  timestamp: number;
  blockNumber?: number;
  transactionId?: string;
}

export interface DepositEvent extends BaseEvent {
  type: "Deposit";
  user: string;
  amount: string;
  shares: string;
}

export interface WithdrawEvent extends BaseEvent {
  type: "Withdraw";
  user: string;
  shares: string;
  amount: string;
  toUSDC: boolean;
}

export interface GuardArmedEvent extends BaseEvent {
  type: "GuardArmed";
  armed: boolean;
  reason: string;
}

export interface GasBankUpdatedEvent extends BaseEvent {
  type: "GasBankUpdated";
  newBalance: string;
  change: string;
}

export interface AutonomousModeStartedEvent extends BaseEvent {
  type: "AutonomousModeStarted";
  timestamp: number;
}

export interface SlicePlannedEvent extends BaseEvent {
  type: "SlicePlanned";
  sliceNumber: number;
  estimatedTime: number;
}

export interface RebalanceExecutedEvent extends BaseEvent {
  type: "RebalanceExecuted";
  epoch: number;
  totalSwaps: number;
}

export interface ManualRebalanceTriggeredEvent extends BaseEvent {
  type: "ManualRebalanceTriggered";
  timestamp: number;
}

export interface RebalanceSkippedEvent extends BaseEvent {
  type: "RebalanceSkipped";
  reason: string;
}

export interface SwapExecutedEvent extends BaseEvent {
  type: "SwapExecuted";
  tokenIn: string;
  tokenOut: string;
  amountIn: string;
  amountOut: string;
}

export interface MultiHopSwapExecutedEvent extends BaseEvent {
  type: "MultiHopSwapExecuted";
  path: string;
  amountIn: string;
  amountOut: string;
}

export interface TokenApprovedEvent extends BaseEvent {
  type: "TokenApproved";
  token: string;
  spender: string;
  amount: string;
}

export interface BalancesReadEvent extends BaseEvent {
  type: "BalancesRead";
  wmas: string;
  weth: string;
  usdc: string;
}

export interface CurrentWeightsEvent extends BaseEvent {
  type: "CurrentWeights";
  wmasBps: string;
  wethBps: string;
  usdcBps: string;
  totalUSDC: string;
}

export interface RebalanceCompletedEvent extends BaseEvent {
  type: "RebalanceCompleted";
  epoch: number;
  totalSwaps: number;
  beforeWeights: string;
  afterWeights: string;
}

export interface DriftCalculatedEvent extends BaseEvent {
  type: "DriftCalculated";
  wmasCurrent: number;
  wethCurrent: number;
  usdcCurrent: number;
  wmasDrift: number;
  wethDrift: number;
  usdcDrift: number;
  maxDrift: number;
}

export interface AutonomousRebalanceScheduledEvent extends BaseEvent {
  type: "AutonomousRebalanceScheduled";
  timestamp: number;
  gasBankRemaining: string;
}

export interface AutonomousRebalanceSkippedEvent extends BaseEvent {
  type: "AutonomousRebalanceSkipped";
  reason: string;
  balance: string;
}

export interface ContractPausedEvent extends BaseEvent {
  type: "ContractPaused";
  timestamp: number;
}

export interface ContractUnpausedEvent extends BaseEvent {
  type: "ContractUnpaused";
  timestamp: number;
}

export interface TargetsUpdatedEvent extends BaseEvent {
  type: "TargetsUpdated";
  target0: number;
  target1: number;
  target2: number;
}

export interface MaxDriftUpdatedEvent extends BaseEvent {
  type: "MaxDriftUpdated";
  maxDrift: number;
}

export interface RebalanceEpochUpdatedEvent extends BaseEvent {
  type: "RebalanceEpochUpdated";
  epoch: number;
}

export interface EmergencyWithdrawEvent extends BaseEvent {
  type: "EmergencyWithdraw";
  token: string;
  amount: string;
  to: string;
}

export interface OwnershipTransferredEvent extends BaseEvent {
  type: "OwnershipTransferred";
  oldOwner: string;
  newOwner: string;
}

export type VaultEvent =
  | DepositEvent
  | WithdrawEvent
  | GuardArmedEvent
  | GasBankUpdatedEvent
  | AutonomousModeStartedEvent
  | SlicePlannedEvent
  | RebalanceExecutedEvent
  | ManualRebalanceTriggeredEvent
  | RebalanceSkippedEvent
  | SwapExecutedEvent
  | MultiHopSwapExecutedEvent
  | TokenApprovedEvent
  | BalancesReadEvent
  | CurrentWeightsEvent
  | RebalanceCompletedEvent
  | DriftCalculatedEvent
  | AutonomousRebalanceScheduledEvent
  | AutonomousRebalanceSkippedEvent
  | ContractPausedEvent
  | ContractUnpausedEvent
  | TargetsUpdatedEvent
  | MaxDriftUpdatedEvent
  | RebalanceEpochUpdatedEvent
  | EmergencyWithdrawEvent
  | OwnershipTransferredEvent;
