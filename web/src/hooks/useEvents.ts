import { config } from "@/config/env";
import { useWallet } from "@/contexts/WalletContext";
import { parseEvent as parseVaultEvent } from "@/lib/eventParser";
import { rpc } from "@/lib/massa";
import {
  EventType,
  selectFilteredEvents,
  SIVEvent,
  useEventsStore,
} from "@/store/eventsStore";
import type { IEvent as SCEvent } from "@massalabs/massa-web3";
import { useCallback, useEffect, useRef } from "react";
import { toast } from "sonner";

const POLL_INTERVAL = 5000; // 5 seconds
const MAX_EVENTS_PER_FETCH = 50;

/**
 * Hook for managing vault events with real-time polling
 *
 * Features:
 * - Automatic event polling when wallet connected
 * - Event filtering by type
 * - Deduplication and ordering
 * - Error handling with retries
 * - Graceful cleanup on unmount
 */
export function useEvents() {
  const { connected: isConnected } = useWallet();
  const {
    events,
    selectedTypes,
    loading,
    error,
    pollingEnabled,
    lastPollTime,
    addEvents,
    setLoading,
    setError,
    setPollingEnabled,
    setLastPollTime,
    toggleEventType,
    setSelectedTypes,
    clearEvents,
  } = useEventsStore();

  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastSlotRef = useRef<{ period: number; thread: number } | null>(null);

  /**
   * Parse raw Massa event into typed SIVEvent
   */
  const parseEvent = useCallback((scEvent: SCEvent): SIVEvent | null => {
    try {
      // Use the new eventParser to parse vault events
      const vaultEvent = parseVaultEvent(scEvent);
      if (!vaultEvent) return null;

      // Map VaultEvent to SIVEvent format for the store
      const typeMapping: Record<string, EventType> = {
        Deposit: "Deposit",
        Withdraw: "Withdraw",
        SlicePlanned: "SlicePlanned",
        SwapExecuted: "SwapExecuted",
        MultiHopSwapExecuted: "SwapExecuted", // Map multi-hop to SwapExecuted
        RebalanceExecuted: "RebalanceExecuted",
        RebalanceSkipped: "RebalanceExecuted", // Map to RebalanceExecuted for display
        DriftCalculated: "RebalanceExecuted", // Include drift in rebalance display
        GuardArmed: "GuardArmed",
        GasBankUpdated: "GasBankUpdated",
        AutonomousModeStarted: "AutonomousModeStarted",
        AutonomousModeStopped: "AutonomousModeStopped",
        TriggerRebalanceStarted: "TriggerRebalanceStarted",
        NextRebalanceScheduled: "NextRebalanceScheduled",
      };

      const type = typeMapping[vaultEvent.type];
      if (!type) {
        console.warn(`Unmapped event type: ${vaultEvent.type}`);
        return null;
      }

      // Convert string amounts to bigint where needed
      let data: Record<string, any> = { ...vaultEvent };
      if ("amount" in vaultEvent && typeof vaultEvent.amount === "string") {
        data.amount = BigInt(vaultEvent.amount);
      }
      if ("shares" in vaultEvent && typeof vaultEvent.shares === "string") {
        data.shares = BigInt(vaultEvent.shares);
      }
      if ("change" in vaultEvent && typeof vaultEvent.change === "string") {
        data.change = BigInt(vaultEvent.change);
      }
      if (
        "newBalance" in vaultEvent &&
        typeof vaultEvent.newBalance === "string"
      ) {
        data.newBalance = BigInt(vaultEvent.newBalance);
      }

      return {
        id:
          vaultEvent.transactionId ||
          `${vaultEvent.blockNumber}-${vaultEvent.timestamp}`,
        type,
        timestamp: vaultEvent.timestamp,
        blockHeight: vaultEvent.blockNumber,
        data,
        txHash: vaultEvent.transactionId,
      };
    } catch (error) {
      console.error("Error parsing event:", error);
      return null;
    }
  }, []);

  /**
   * Fetch events from the blockchain
   */
  const fetchEvents = useCallback(async () => {
    try {
      const provider = rpc.public();

      // Build filter
      const filter: any = {
        smartContractAddress: config.addresses.sivVault,
        isFinal: false, // Get both final and pending events
      };

      // If we have a last slot, only fetch events after it
      if (lastSlotRef.current) {
        filter.start = {
          period: lastSlotRef.current.period,
          thread: lastSlotRef.current.thread,
        };
      }

      console.log("[SIV Debug] Fetching events with filter:", filter);

      // Fetch events
      const scEvents = await provider.getEvents(filter);

      console.log(`[SIV Debug] Found ${scEvents?.length || 0} raw events`);

      if (scEvents && scEvents.length > 0) {
        console.log("[SIV Debug] First event:", scEvents[0]);

        // Parse events
        const parsedEvents = scEvents
          .map(parseEvent)
          .filter((e): e is SIVEvent => e !== null)
          .slice(0, MAX_EVENTS_PER_FETCH);

        console.log(`[SIV Debug] Parsed ${parsedEvents.length} events`);

        if (parsedEvents.length > 0) {
          console.log("[SIV Debug] Adding events to store:", parsedEvents);
          addEvents(parsedEvents);

          // Update last slot to the most recent event
          const lastEvent = scEvents[scEvents.length - 1];
          lastSlotRef.current = {
            period: lastEvent.context.slot.period,
            thread: lastEvent.context.slot.thread,
          };
        }
      }

      setLastPollTime(Date.now());
      setError(null);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Failed to fetch events";
      console.error("Error fetching events:", error);
      setError(errorMessage);
    }
  }, [parseEvent, addEvents, setError, setLastPollTime]);

  /**
   * Start polling for events
   */
  const startPolling = useCallback(() => {
    if (pollingIntervalRef.current) {
      return; // Already polling
    }

    console.log("Starting event polling...");
    setPollingEnabled(true);
    setError(null);

    // Initial fetch
    fetchEvents();

    // Set up interval
    pollingIntervalRef.current = setInterval(() => {
      fetchEvents();
    }, POLL_INTERVAL);
  }, [fetchEvents, setPollingEnabled, setError]);

  /**
   * Stop polling for events
   */
  const stopPolling = useCallback(() => {
    if (pollingIntervalRef.current) {
      console.log("Stopping event polling...");
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
      setPollingEnabled(false);
    }
  }, [setPollingEnabled]);

  /**
   * Manually refresh events
   */
  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      await fetchEvents();
      toast.success("Events refreshed");
    } catch (error) {
      toast.error("Failed to refresh events");
    } finally {
      setLoading(false);
    }
  }, [fetchEvents, setLoading]);

  /**
   * Filter events by type
   */
  const filteredEvents = selectFilteredEvents(useEventsStore.getState());

  /**
   * Get events by specific type
   */
  const getEventsByType = useCallback(
    (type: EventType) => {
      return events.filter((e) => e.type === type);
    },
    [events]
  );

  /**
   * Get recent events (last N)
   */
  const getRecentEvents = useCallback(
    (count: number = 10) => {
      return events.slice(0, count);
    },
    [events]
  );

  /**
   * Auto-start polling when connected
   */
  useEffect(() => {
    if (isConnected) {
      startPolling();
    } else {
      stopPolling();
    }

    return () => {
      stopPolling();
    };
  }, [isConnected, startPolling, stopPolling]);

  return {
    // State
    events: filteredEvents,
    allEvents: events,
    loading,
    error,
    pollingEnabled,
    lastPollTime,
    selectedTypes,

    // Actions
    refresh,
    startPolling,
    stopPolling,
    clearEvents,
    toggleEventType,
    setSelectedTypes,

    // Helpers
    getEventsByType,
    getRecentEvents,
  };
}
