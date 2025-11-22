import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useWallet } from "@/contexts/WalletContext";
import { useEvents } from "@/hooks/useEvents";
import { formatTokenAmount, shortAddr } from "@/lib/addresses";
import { EventType, SIVEvent } from "@/store/eventsStore";
import {
  AlertTriangle,
  ArrowDownToLine,
  ArrowUpFromLine,
  Copy,
  ExternalLink,
  Fuel,
  Loader2,
  RefreshCw,
  Shield,
  TrendingUp,
} from "lucide-react";
import { toast } from "sonner";

const Activity = () => {
  const { connected: isConnected } = useWallet();
  const {
    events,
    loading,
    error,
    pollingEnabled,
    selectedTypes,
    refresh,
    toggleEventType,
  } = useEvents();

  // Event type configurations
  const eventConfig: Record<
    EventType,
    { icon: any; label: string; color: string }
  > = {
    Deposit: { icon: ArrowDownToLine, label: "Deposit", color: "success" },
    Withdraw: { icon: ArrowUpFromLine, label: "Withdraw", color: "info" },
    RebalanceExecuted: {
      icon: RefreshCw,
      label: "Rebalance",
      color: "success",
    },
    SlicePlanned: { icon: TrendingUp, label: "Slice Planned", color: "info" },
    SliceBooked: { icon: TrendingUp, label: "Slice Booked", color: "success" },
    SwapExecuted: { icon: RefreshCw, label: "Swap", color: "success" },
    GuardArmed: { icon: Shield, label: "Guard", color: "warning" },
    GasBankUpdated: { icon: Fuel, label: "Gas Bank", color: "info" },
    CircuitBreaker: {
      icon: AlertTriangle,
      label: "Circuit Breaker",
      color: "destructive",
    },
    AutonomousModeStarted: {
      icon: RefreshCw,
      label: "Autonomous Started",
      color: "success",
    },
    AutonomousModeStopped: {
      icon: AlertTriangle,
      label: "Autonomous Stopped",
      color: "warning",
    },
    TriggerRebalanceStarted: {
      icon: RefreshCw,
      label: "Rebalance Triggered",
      color: "info",
    },
    NextRebalanceScheduled: {
      icon: RefreshCw,
      label: "Rebalance Scheduled",
      color: "info",
    },
    RedeemToUSDC: { icon: ArrowUpFromLine, label: "Redeem", color: "info" },
  };

  // Available filters
  const filters: { id: EventType | "all"; label: string }[] = [
    { id: "all", label: "All" },
    { id: "Deposit", label: "Deposits" },
    { id: "Withdraw", label: "Withdrawals" },
    { id: "RebalanceExecuted", label: "Rebalances" },
    { id: "SliceBooked", label: "Slices" },
    { id: "GuardArmed", label: "Guard" },
  ];

  // Format event details
  const formatEventDetails = (event: SIVEvent): string => {
    switch (event.type) {
      case "Deposit":
        return event.data.amount &&
          typeof event.data.amount === "bigint" &&
          event.data.amount > 0n
          ? `${formatTokenAmount(event.data.amount, 6, 2)} USDC.e`
          : "Deposit";
      case "Withdraw":
        return event.data.shares &&
          typeof event.data.shares === "bigint" &&
          event.data.shares > 0n
          ? `${formatTokenAmount(event.data.shares, 18, 2)} shares`
          : "Withdraw";
      case "SlicePlanned":
        return `Slice #${event.data.sliceNumber || "?"}`;
      case "SliceBooked":
        return `Slot ${event.data.slot || "?"}, Slice #${
          event.data.sliceNumber || "?"
        }`;
      case "SwapExecuted":
        return `Slice #${event.data.sliceNumber || "?"}`;
      case "RebalanceExecuted":
        return `${event.data.totalSwaps || "?"} swaps, Epoch ${
          event.data.epoch || "?"
        }`;
      case "GuardArmed":
        return event.data.armed ? "Armed" : "Disarmed";
      case "GasBankUpdated":
        return event.data.newBalance &&
          typeof event.data.newBalance === "bigint" &&
          event.data.newBalance > 0n
          ? `${formatTokenAmount(event.data.newBalance, 9, 2)} MAS`
          : "Updated";
      case "CircuitBreaker":
        return event.data.triggered ? "Triggered" : "Cleared";
      default:
        return "";
    }
  };

  // Format relative time
  const formatRelativeTime = (timestamp: number): string => {
    const now = Date.now();
    const diff = now - timestamp;
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (seconds < 60) return "Just now";
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return `${days}d ago`;
  };

  // Handle filter toggle
  const handleFilterToggle = (filterId: EventType | "all") => {
    if (filterId === "all") {
      // Clear all filters
      if (selectedTypes.length > 0) {
        selectedTypes.forEach((type) => toggleEventType(type));
      }
    } else {
      toggleEventType(filterId);
    }
  };

  // Check if filter is active
  const isFilterActive = (filterId: EventType | "all"): boolean => {
    if (filterId === "all") {
      return selectedTypes.length === 0;
    }
    return selectedTypes.includes(filterId);
  };

  // Copy transaction hash
  const handleCopyTx = (txHash: string) => {
    navigator.clipboard.writeText(txHash);
    toast.success("Transaction hash copied");
  };

  // Wallet not connected
  if (!isConnected) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold mb-2">Activity</h1>
          <p className="text-muted-foreground">
            Track all vault transactions and events
          </p>
        </div>
        <Card className="glass p-12 text-center">
          <Shield className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
          <h3 className="text-lg font-semibold mb-2">Wallet Not Connected</h3>
          <p className="text-muted-foreground">
            Connect your wallet to view vault activity
          </p>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold mb-2">Activity</h1>
          <p className="text-muted-foreground">
            Track all vault transactions and events
          </p>
        </div>
        <div className="flex items-center gap-2">
          {pollingEnabled && (
            <Badge variant="outline" className="border-success/20 text-success">
              <div className="w-2 h-2 bg-success rounded-full mr-2 animate-pulse" />
              Live
            </Badge>
          )}
          <Button
            onClick={refresh}
            variant="outline"
            size="sm"
            disabled={loading}
          >
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <RefreshCw className="w-4 h-4" />
            )}
          </Button>
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <Card className="glass border-destructive/20 bg-destructive/5 p-4">
          <div className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="w-5 h-5" />
            <p className="font-semibold">Error loading events</p>
          </div>
          <p className="text-sm text-muted-foreground mt-1">{error}</p>
        </Card>
      )}

      {/* Filters */}
      <Card className="glass p-4">
        <div className="flex flex-wrap gap-2">
          {filters.map((f) => (
            <Button
              key={f.id}
              size="sm"
              variant={isFilterActive(f.id) ? "default" : "outline"}
              onClick={() => handleFilterToggle(f.id)}
              className="press-scale"
            >
              {f.label}
            </Button>
          ))}
        </div>
      </Card>

      {/* Event Feed */}
      {loading && events.length === 0 ? (
        <Card className="glass p-12 text-center">
          <Loader2 className="w-8 h-8 mx-auto mb-4 animate-spin text-complement" />
          <p className="text-muted-foreground">Loading events...</p>
        </Card>
      ) : events.length === 0 ? (
        <Card className="glass p-12 text-center">
          <TrendingUp className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
          <h3 className="text-lg font-semibold mb-2">No Events Yet</h3>
          <p className="text-muted-foreground">
            {selectedTypes.length > 0
              ? "No events match the selected filters"
              : "Events will appear here once vault activity begins"}
          </p>
        </Card>
      ) : (
        <Card className="glass divide-y divide-border/50">
          {events.map((event, index) => {
            const config = eventConfig[event.type];
            const Icon = config.icon;
            return (
              <div
                key={`${event.id}-${index}`}
                className="p-6 hover:bg-muted/30 transition-colors"
              >
                <div className="flex items-center gap-4">
                  <div
                    className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                      config.color === "success"
                        ? "bg-success-muted"
                        : config.color === "warning"
                        ? "bg-warning-muted"
                        : config.color === "destructive"
                        ? "bg-destructive/10"
                        : "bg-complement-muted"
                    }`}
                  >
                    <Icon
                      className={`w-5 h-5 ${
                        config.color === "success"
                          ? "text-success"
                          : config.color === "warning"
                          ? "text-warning"
                          : config.color === "destructive"
                          ? "text-destructive"
                          : "text-complement"
                      }`}
                    />
                  </div>

                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-semibold">{config.label}</h3>
                      <Badge
                        variant="outline"
                        className={`text-xs ${
                          config.color === "success"
                            ? "border-success/20 text-success"
                            : config.color === "warning"
                            ? "border-warning/20 text-warning"
                            : config.color === "destructive"
                            ? "border-destructive/20 text-destructive"
                            : "border-complement/20 text-complement"
                        }`}
                      >
                        {event.type}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <span>{formatRelativeTime(event.timestamp)}</span>
                      <span className="font-mono">
                        {formatEventDetails(event)}
                      </span>
                      {event.txHash && (
                        <button
                          className="flex items-center gap-1 hover:text-foreground transition-colors"
                          onClick={() => handleCopyTx(event.txHash!)}
                        >
                          {shortAddr(event.txHash)}
                          <Copy className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  </div>

                  {event.txHash && (
                    <a
                      href={`https://explorer.massa.net/mainnet/operation/${event.txHash}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-complement hover:text-complement/80 transition-colors"
                    >
                      <ExternalLink className="w-5 h-5" />
                    </a>
                  )}
                </div>
              </div>
            );
          })}
        </Card>
      )}
    </div>
  );
};

export default Activity;
