import { create } from "zustand";
import { persist } from "zustand/middleware";

export type EventType =
  | "Deposit"
  | "Withdraw"
  | "RedeemToUSDC"
  | "SlicePlanned"
  | "SliceBooked"
  | "SwapExecuted"
  | "RebalanceExecuted"
  | "GuardArmed"
  | "GasBankUpdated"
  | "CircuitBreaker"
  | "AutonomousModeStarted"
  | "AutonomousModeStopped"
  | "TriggerRebalanceStarted"
  | "NextRebalanceScheduled";

export interface SIVEvent {
  id: string; // Unique identifier (operation ID or event ID)
  type: EventType;
  timestamp: number; // Unix timestamp in milliseconds
  blockHeight?: number;
  data: Record<string, any>; // Event-specific data
  txHash?: string; // Transaction/operation hash
}

export interface DepositEvent extends SIVEvent {
  type: "Deposit";
  data: {
    user: string;
    amount: bigint;
    shares: bigint;
  };
}

export interface WithdrawEvent extends SIVEvent {
  type: "Withdraw";
  data: {
    user: string;
    shares: bigint;
    amount: bigint;
    toUSDC: boolean;
  };
}

export interface SlicePlannedEvent extends SIVEvent {
  type: "SlicePlanned";
  data: {
    sliceNumber: number;
    estimatedTime: number;
  };
}

export interface SliceBookedEvent extends SIVEvent {
  type: "SliceBooked";
  data: {
    sliceNumber: number;
    slot: number;
    fee: bigint;
  };
}

export interface SwapExecutedEvent extends SIVEvent {
  type: "SwapExecuted";
  data: {
    tokenIn: string;
    tokenOut: string;
    amountIn: bigint;
    amountOut: bigint;
    sliceNumber: number;
  };
}

export interface RebalanceExecutedEvent extends SIVEvent {
  type: "RebalanceExecuted";
  data: {
    epoch: number;
    totalSwaps: number;
  };
}

export interface GuardArmedEvent extends SIVEvent {
  type: "GuardArmed";
  data: {
    armed: boolean;
    reason?: string;
  };
}

export interface GasBankUpdatedEvent extends SIVEvent {
  type: "GasBankUpdated";
  data: {
    newBalance: bigint;
    change: bigint;
  };
}

export interface CircuitBreakerEvent extends SIVEvent {
  type: "CircuitBreaker";
  data: {
    triggered: boolean;
    reason: string;
  };
}

export interface EventsState {
  // Events storage
  events: SIVEvent[];
  maxEvents: number;

  // Subscription state
  subscribed: boolean;
  subscribing: boolean;
  pollingEnabled: boolean;
  lastPollTime: number | null;

  // Filter state
  selectedTypes: EventType[];

  // Loading state
  loading: boolean;
  error: string | null;

  // Pagination
  hasMore: boolean;

  // Actions
  addEvent: (event: SIVEvent) => void;
  addEvents: (events: SIVEvent[]) => void;
  setEvents: (events: SIVEvent[]) => void;
  clearEvents: () => void;
  setSubscribed: (subscribed: boolean) => void;
  setSubscribing: (subscribing: boolean) => void;
  setPollingEnabled: (enabled: boolean) => void;
  setLastPollTime: (timestamp: number) => void;
  setSelectedTypes: (types: EventType[]) => void;
  toggleEventType: (type: EventType) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  setHasMore: (hasMore: boolean) => void;
  reset: () => void;
}

// Helper function to convert BigInt to string for serialization
function serializeBigInt(obj: any): any {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj === "bigint") return obj.toString();
  if (Array.isArray(obj)) return obj.map(serializeBigInt);
  if (typeof obj === "object") {
    const serialized: any = {};
    for (const key in obj) {
      serialized[key] = serializeBigInt(obj[key]);
    }
    return serialized;
  }
  return obj;
}

// Helper function to convert string back to BigInt for deserialization
function deserializeBigInt(obj: any): any {
  if (obj === null || obj === undefined) return obj;
  if (Array.isArray(obj)) return obj.map(deserializeBigInt);
  if (typeof obj === "object") {
    const deserialized: any = {};
    for (const key in obj) {
      const value = obj[key];
      // Convert string numbers that look like BigInt back to BigInt
      if (
        typeof value === "string" &&
        /^\d+$/.test(value) &&
        value.length > 15
      ) {
        deserialized[key] = BigInt(value);
      } else {
        deserialized[key] = deserializeBigInt(value);
      }
    }
    return deserialized;
  }
  return obj;
}

const initialState = {
  events: [],
  maxEvents: 1000,
  subscribed: false,
  subscribing: false,
  pollingEnabled: false,
  lastPollTime: null,
  selectedTypes: [] as EventType[],
  loading: false,
  error: null,
  hasMore: false,
};

export const useEventsStore = create<EventsState>()(
  persist(
    (set, get) => ({
      ...initialState,

      addEvent: (event) => {
        const { events, maxEvents } = get();

        // Check if event already exists
        if (events.some((e) => e.id === event.id)) {
          return;
        }

        // Add event and maintain max limit
        const newEvents = [event, ...events].slice(0, maxEvents);
        set({ events: newEvents });
      },

      addEvents: (newEvents) => {
        const { events, maxEvents } = get();
        const existingIds = new Set(events.map((e) => e.id));

        // Filter out duplicates
        const uniqueEvents = newEvents.filter((e) => !existingIds.has(e.id));

        // Merge and sort by timestamp (newest first)
        const merged = [...uniqueEvents, ...events]
          .sort((a, b) => b.timestamp - a.timestamp)
          .slice(0, maxEvents);

        set({ events: merged });
      },

      setEvents: (events) => set({ events }),
      clearEvents: () => set({ events: [] }),

      setSubscribed: (subscribed) => set({ subscribed }),
      setSubscribing: (subscribing) => set({ subscribing }),
      setPollingEnabled: (enabled) => set({ pollingEnabled: enabled }),
      setLastPollTime: (timestamp) => set({ lastPollTime: timestamp }),

      setSelectedTypes: (types) => set({ selectedTypes: types }),
      toggleEventType: (type) => {
        const { selectedTypes } = get();
        const newTypes = selectedTypes.includes(type)
          ? selectedTypes.filter((t) => t !== type)
          : [...selectedTypes, type];
        set({ selectedTypes: newTypes });
      },

      setLoading: (loading) => set({ loading }),
      setError: (error) => set({ error }),
      setHasMore: (hasMore) => set({ hasMore }),

      reset: () => set(initialState),
    }),
    {
      name: "siv-events-storage",
      storage: {
        getItem: (name) => {
          const str = localStorage.getItem(name);
          if (!str) return null;
          const parsed = JSON.parse(str);
          // Deserialize BigInt values
          if (parsed.state?.events) {
            parsed.state.events = parsed.state.events.map((event: any) => ({
              ...event,
              data: deserializeBigInt(event.data),
            }));
          }
          return parsed;
        },
        setItem: (name, value) => {
          // Serialize BigInt values to strings
          const serialized = {
            ...value,
            state: {
              ...value.state,
              events: value.state.events?.map((event: any) => ({
                ...event,
                data: serializeBigInt(event.data),
              })),
            },
          };
          localStorage.setItem(name, JSON.stringify(serialized));
        },
        removeItem: (name) => localStorage.removeItem(name),
      },
      partialize: (state) => ({
        // Persist events, selectedTypes, and lastPollTime
        events: state.events,
        selectedTypes: state.selectedTypes,
        lastPollTime: state.lastPollTime,
      }),
    }
  )
);

// Selector helpers
export const selectFilteredEvents = (state: EventsState) => {
  if (state.selectedTypes.length === 0) {
    return state.events;
  }
  return state.events.filter((event) =>
    state.selectedTypes.includes(event.type)
  );
};

export const selectEventsByType = (type: EventType) => (state: EventsState) => {
  return state.events.filter((event) => event.type === type);
};
