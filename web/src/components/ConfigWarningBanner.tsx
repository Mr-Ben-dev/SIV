import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { getEnvErrors } from "@/config/env";
import { AlertTriangle, Copy, X } from "lucide-react";
import { useState } from "react";

export function ConfigWarningBanner() {
  const [dismissed, setDismissed] = useState(false);
  const [copied, setCopied] = useState(false);
  const envErrors = getEnvErrors();

  if (envErrors.length === 0 || dismissed) {
    return null;
  }

  const handleCopy = async () => {
    const template = `# Massa Network Configuration
VITE_MASSA_NETWORK=mainnet
VITE_MASSA_RPC_HTTP=https://mainnet.massa.net/api/v2
VITE_MASSA_RPC_WS=wss://mainnet.massa.net/ws

# Contract Addresses
VITE_SIV_VAULT_ADDRESS=AS1oVUJJbhe8qShhhvfhsPwL5RjqVD8i4RQ4F7Sd7wsNW3iMsWVM
VITE_USDCE_ADDRESS=AS1hCJXjndR4c9vekLWsXGnrdigp4AaZ7uYG3UKFzzKnWVsrNLPJ
VITE_WMAS_ADDRESS=AS12U4TZfNK7qoLyEERBBRDMu8nm5MKoRzPXDXans4v9wdATZedz9
VITE_WETHB_ADDRESS=AS125oPLYRTtfVjpWisPZVTLjBhCFfQ1jDsi75XNtRm1NZux54eCj

# DEX Addresses
VITE_DUSA_ROUTER_ADDRESS=AS1gUwVGA3A5Dnmev8c2BjBR2wC8y9hb7CFZXVzLb1iwASFHUZ1p
VITE_DUSA_QUOTER_ADDRESS=AS1d3DvZeqTo3Uq7mfAAUmNggjFXqEfGGpSUv6uTYvikVVW8EybN
VITE_EAGLEFI_ROUTER_ADDRESS=AS1gUwVGA3A5Dnmev8c2BjBR2wC8y9hb7CFZXVzLb1iwASFHUZ1p

# Explorer
VITE_EXPLORER_URL=https://explorer.massa.net
VITE_DEFAULT_SLIPPAGE_BPS=50
VITE_EPOCH_SECONDS=1800
VITE_SLICES_PER_REBALANCE=6
`;

    try {
      await navigator.clipboard.writeText(template);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error("Failed to copy:", error);
    }
  };

  return (
    <div className="border-b border-warning/20 bg-warning/5 backdrop-blur-sm">
      <Alert
        variant="destructive"
        className="rounded-none border-0 bg-transparent"
      >
        <div className="container flex items-start justify-between gap-4 py-3">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-warning mt-0.5" />
            <div className="flex-1">
              <AlertTitle className="text-sm font-semibold text-warning mb-1">
                Configuration Warning
              </AlertTitle>
              <AlertDescription className="text-xs text-warning/90 space-y-1">
                <p>Some environment variables are missing or invalid:</p>
                <ul className="list-disc list-inside space-y-0.5 ml-2">
                  {envErrors.slice(0, 3).map((error, i) => (
                    <li key={i}>{error}</li>
                  ))}
                  {envErrors.length > 3 && (
                    <li className="italic">
                      ...and {envErrors.length - 3} more
                    </li>
                  )}
                </ul>
                <p className="mt-2 text-warning/80">
                  The app will continue with default values. Some features may
                  not work correctly.
                </p>
              </AlertDescription>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleCopy}
              className="border-warning/30 hover:bg-warning/10 text-warning text-xs"
            >
              {copied ? (
                <>
                  <Copy className="h-3 w-3 mr-1" />
                  Copied!
                </>
              ) : (
                <>
                  <Copy className="h-3 w-3 mr-1" />
                  Copy .env template
                </>
              )}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setDismissed(true)}
              className="hover:bg-warning/10 text-warning h-8 w-8 p-0"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </Alert>
    </div>
  );
}
