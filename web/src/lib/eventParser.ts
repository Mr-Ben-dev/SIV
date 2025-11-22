/**
 * Parse Massa smart contract events
 * Contract emits events in format: "EventType:{json}"
 */

import type { VaultEvent, VaultEventType } from "@/types/events";

// Event type from massa-web3 EventPoller
interface SCEvent {
  data: string;
  context: {
    block?: {
      timestamp: number;
      number?: number;
    };
    slot: { period: number; thread: number };
    origin_operation_id?: string;
  };
}

/**
 * Parse a raw Massa SC event into a typed VaultEvent
 * @param scEvent Raw event from EventPoller
 * @returns Parsed VaultEvent or null if parsing fails
 */
export function parseEvent(scEvent: SCEvent): VaultEvent | null {
  try {
    const eventData = scEvent.data;

    // Skip DiagnosticCheckpoint events (plain text, used for debugging)
    if (eventData.startsWith("DiagnosticCheckpoint:")) {
      return null; // Silently ignore diagnostic events
    }

    // Events are in format "EventType:{json}"
    const colonIndex = eventData.indexOf(":");
    if (colonIndex === -1) {
      console.warn("Invalid event format (no colon):", eventData);
      return null;
    }

    const type = eventData.substring(0, colonIndex) as VaultEventType;
    const jsonStr = eventData.substring(colonIndex + 1);
    const payload = JSON.parse(jsonStr);

    // Base event fields from Massa
    const baseEvent = {
      timestamp:
        scEvent.context?.slot?.timestamp ||
        scEvent.context?.block?.timestamp ||
        Date.now(),
      blockNumber: scEvent.context?.block?.number,
      transactionId: scEvent.context?.origin_operation_id,
    };

    switch (type) {
      case "Deposit":
        return {
          type: "Deposit",
          ...baseEvent,
          user: payload.user,
          amount: payload.amount,
          shares: payload.shares,
        };

      case "Withdraw":
        return {
          type: "Withdraw",
          ...baseEvent,
          user: payload.user,
          shares: payload.shares,
          amount: payload.amount,
          toUSDC: payload.toUSDC,
        };

      case "GuardArmed":
        return {
          type: "GuardArmed",
          ...baseEvent,
          armed: payload.armed,
          reason: payload.reason,
        };

      case "AutonomousModeStarted":
        return {
          type: "AutonomousModeStarted",
          ...baseEvent,
          timestamp: payload.timestamp,
        };

      case "AutonomousModeStopped":
        return {
          type: "AutonomousModeStopped",
          ...baseEvent,
          reason: payload.reason,
          balance: payload.balance,
        };

      case "TriggerRebalanceStarted":
        return {
          type: "TriggerRebalanceStarted",
          ...baseEvent,
          caller: payload.caller,
          timestamp: payload.timestamp,
        };

      case "NextRebalanceScheduled":
        return {
          type: "NextRebalanceScheduled",
          ...baseEvent,
          deferredId: payload.deferredId,
          targetSlot: payload.targetSlot,
          quote: payload.quote,
        };

      case "GasBankUpdated":
        return {
          type: "GasBankUpdated",
          ...baseEvent,
          newBalance: payload.newBalance,
          change: payload.change,
        };

      case "SlicePlanned":
        return {
          type: "SlicePlanned",
          ...baseEvent,
          sliceNumber: payload.sliceNumber,
          estimatedTime: payload.estimatedTime,
        };

      case "RebalanceExecuted":
        return {
          type: "RebalanceExecuted",
          ...baseEvent,
          epoch: payload.epoch,
          totalSwaps: payload.totalSwaps,
        };

      case "ManualRebalanceTriggered":
        return {
          type: "ManualRebalanceTriggered",
          ...baseEvent,
          timestamp: payload.timestamp,
        };

      case "RebalanceSkipped":
        return {
          type: "RebalanceSkipped",
          ...baseEvent,
          reason: payload.reason,
        };

      case "SwapExecuted":
        return {
          type: "SwapExecuted",
          ...baseEvent,
          tokenIn: payload.tokenIn,
          tokenOut: payload.tokenOut,
          amountIn: payload.amountIn,
          amountOut: payload.amountOut,
        };

      case "MultiHopSwapExecuted":
        return {
          type: "MultiHopSwapExecuted",
          ...baseEvent,
          path: payload.path,
          amountIn: payload.amountIn,
          amountOut: payload.amountOut,
        };

      case "TokenApproved":
        return {
          type: "TokenApproved",
          ...baseEvent,
          token: payload.token,
          spender: payload.spender,
          amount: payload.amount,
        };

      case "BalancesRead":
        return {
          type: "BalancesRead",
          ...baseEvent,
          wmas: payload.wmas,
          weth: payload.weth,
          usdc: payload.usdc,
        };

      case "CurrentWeights":
        return {
          type: "CurrentWeights",
          ...baseEvent,
          wmasBps: payload.wmasBps,
          wethBps: payload.wethBps,
          usdcBps: payload.usdcBps,
          totalUSDC: payload.totalUSDC,
        };

      case "RebalanceCompleted":
        return {
          type: "RebalanceCompleted",
          ...baseEvent,
          epoch: payload.epoch,
          totalSwaps: payload.totalSwaps,
          beforeWeights: payload.beforeWeights,
          afterWeights: payload.afterWeights,
        };

      default:
        console.warn("Unknown event type:", type);
        return null;
    }
  } catch (error) {
    console.error("Failed to parse event:", error, scEvent);
    return null;
  }
}

/**
 * Format event for display in Activity feed
 */
export function formatEventDescription(event: VaultEvent): string {
  switch (event.type) {
    case "Deposit":
      return `Deposited ${event.amount} USDC.e → ${event.shares} shares`;
    case "Withdraw":
      return `Redeemed ${event.shares} shares → ${event.amount} ${
        event.toUSDC ? "USDC.e" : "tokens"
      }`;
    case "GuardArmed":
      return event.armed
        ? `🛡️ Guard Armed: ${event.reason}`
        : "✅ Guard Disarmed";
    case "GasBankUpdated":
      return `Gas Bank: +${event.change} MAS (Balance: ${event.newBalance})`;
    case "AutonomousModeStarted":
      return `🚀 Autonomous Mode Started`;
    case "SlicePlanned":
      return `Rebalance Slice #${event.sliceNumber} scheduled`;
    case "RebalanceExecuted":
      return `✅ Rebalance Complete (${event.totalSwaps} swaps executed)`;
    case "SwapExecuted":
      return `🔄 Swap: ${event.tokenIn.slice(-4)} → ${event.tokenOut.slice(
        -4
      )} (${event.amountIn})`;
    case "MultiHopSwapExecuted":
      return `🔄 Multi-hop Swap: ${event.path} (${event.amountIn})`;
    case "RebalanceCompleted":
      return `✅ Rebalance Done: ${event.totalSwaps} swaps | Weights: ${event.afterWeights}`;
    case "CurrentWeights":
      return `⚖️ Weights: WMAS ${event.wmasBps}bps | WETH ${event.wethBps}bps | USDC ${event.usdcBps}bps`;
    case "BalancesRead":
      return `📊 Balances: WMAS ${event.wmas} | WETH ${event.weth} | USDC ${event.usdc}`;
    case "TokenApproved":
      return `✅ Token Approved: ${event.token.slice(-4)} for ${event.amount}`;
    case "ManualRebalanceTriggered":
      return `🔧 Manual Rebalance Triggered`;
    case "RebalanceSkipped":
      return `⏭️ Rebalance Skipped: ${event.reason}`;
    case "DriftCalculated":
      return `📊 Drift Calculated: Max ${event.maxDrift} bps`;
    case "AutonomousRebalanceScheduled":
      return `🤖 Autonomous Rebalance Scheduled (Gas: ${event.gasBankRemaining})`;
    case "AutonomousRebalanceSkipped":
      return `⏭️ Autonomous Skip: ${event.reason}`;
    case "ContractPaused":
      return `⏸️ Contract Paused`;
    case "ContractUnpaused":
      return `▶️ Contract Unpaused`;
    case "TargetsUpdated":
      return `🎯 Targets Updated: ${event.target0}/${event.target1}/${event.target2} bps`;
    case "MaxDriftUpdated":
      return `📏 Max Drift Updated: ${event.maxDrift} bps`;
    case "RebalanceEpochUpdated":
      return `⏰ Epoch Updated: ${event.epoch}s`;
    case "EmergencyWithdraw":
      return `🚨 Emergency Withdraw: ${event.amount} to ${event.to.slice(-4)}`;
    case "OwnershipTransferred":
      return `👑 Ownership → ${event.newOwner.slice(-4)}`;
    default:
      return "Unknown event";
  }
}

/**
 * Get icon for event type
 */
export function getEventIcon(eventType: VaultEventType): string {
  switch (eventType) {
    case "Deposit":
      return "💰";
    case "Withdraw":
      return "💸";
    case "GuardArmed":
      return "🛡️";
    case "GasBankUpdated":
      return "⛽";
    case "AutonomousModeStarted":
      return "🚀";
    case "SlicePlanned":
      return "📅";
    case "RebalanceExecuted":
      return "⚖️";
    case "SwapExecuted":
      return "🔄";
    case "MultiHopSwapExecuted":
      return "🔄";
    case "TokenApproved":
      return "✅";
    case "BalancesRead":
      return "📊";
    case "CurrentWeights":
      return "⚖️";
    case "RebalanceCompleted":
      return "✅";
    case "ManualRebalanceTriggered":
      return "🔧";
    case "RebalanceSkipped":
      return "⏭️";
    case "DriftCalculated":
      return "📊";
    case "AutonomousRebalanceScheduled":
      return "🤖";
    case "AutonomousRebalanceSkipped":
      return "⏭️";
    case "ContractPaused":
      return "⏸️";
    case "ContractUnpaused":
      return "▶️";
    case "TargetsUpdated":
      return "🎯";
    case "MaxDriftUpdated":
      return "📏";
    case "RebalanceEpochUpdated":
      return "⏰";
    case "EmergencyWithdraw":
      return "🚨";
    case "OwnershipTransferred":
      return "👑";
    default:
      return "📋";
  }
}
