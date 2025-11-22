import { config } from "@/config/env";
import { useCallback, useEffect, useState } from "react";

export interface VaultEvent {
  id: string;
  type: string;
  data: any;
  timestamp: number;
  operationId: string;
  slot: number;
}

/**
 * Hook to fetch and monitor vault events from Massa blockchain
 * Polls RPC every 30 seconds for new events
 */
export function useVaultEvents() {
  const [events, setEvents] = useState<VaultEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchEvents = useCallback(async () => {
    try {
      // Fetch events from Massa RPC using get_filtered_sc_output_event
      const response = await fetch("https://mainnet.massa.net/api/v2", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "get_filtered_sc_output_event",
          params: [
            {
              start: null,
              end: null,
              emitter_address: config.addresses.sivVault,
              original_caller_address: null,
              original_operation_id: null,
              is_final: true,
            },
          ],
        }),
      });

      const data = await response.json();

      if (data.error) {
        throw new Error(data.error.message || "Failed to fetch events");
      }

      if (data.result) {
        // Parse events
        const parsed = data.result.map((e: any) => {
          // Event format: "EventType:{json data}"
          const eventData = e.data || "";
          const colonIndex = eventData.indexOf(":");

          let type = "Unknown";
          let parsedData: any = {};

          if (colonIndex > 0) {
            type = eventData.substring(0, colonIndex);
            const jsonStr = eventData.substring(colonIndex + 1);

            try {
              parsedData = jsonStr ? JSON.parse(jsonStr) : {};
            } catch (err) {
              console.warn("Failed to parse event JSON:", jsonStr);
              parsedData = { raw: jsonStr };
            }
          } else {
            parsedData = { raw: eventData };
          }

          return {
            id: e.id || `${e.context?.slot?.period}-${e.context?.slot?.thread}`,
            type,
            data: parsedData,
            timestamp: e.context?.slot?.timestamp || Date.now(),
            operationId: e.context?.origin_operation_id || "",
            slot: e.context?.slot?.period || 0,
          };
        });

        // Sort by timestamp descending (newest first)
        parsed.sort(
          (a: VaultEvent, b: VaultEvent) => b.timestamp - a.timestamp
        );

        setEvents(parsed);
        setError(null);
      }
    } catch (err) {
      console.error("Failed to fetch vault events:", err);
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Initial fetch
    fetchEvents();

    // Poll every 30 seconds
    const interval = setInterval(fetchEvents, 30000);

    return () => clearInterval(interval);
  }, [fetchEvents]);

  // Helper to filter events by type
  const eventsByType = useCallback(
    (type: string): VaultEvent[] => {
      return events.filter((e) => e.type === type);
    },
    [events]
  );

  // Helper to get latest event of a type
  const latestEvent = useCallback(
    (type: string): VaultEvent | null => {
      const filtered = eventsByType(type);
      return filtered.length > 0 ? filtered[0] : null;
    },
    [eventsByType]
  );

  return {
    events,
    loading,
    error,
    eventsByType,
    latestEvent,
    refresh: fetchEvents,
  };
}
