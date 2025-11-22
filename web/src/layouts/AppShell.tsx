import { ConfigWarningBanner } from "@/components/ConfigWarningBanner";
import { NavLink } from "@/components/NavLink";
import { NetworkBadge } from "@/components/NetworkBadge";
import { Badge } from "@/components/ui/badge";
import { WalletButton } from "@/components/WalletButton";
import { motion } from "framer-motion";
import {
  Activity,
  ExternalLink,
  HelpCircle,
  LayoutDashboard,
  Settings,
  Zap,
} from "lucide-react";
import { ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";

interface AppShellProps {
  children: ReactNode;
}

const navigation = [
  { name: "Portfolio", href: "/app/portfolio", icon: LayoutDashboard },
  { name: "Autonomy", href: "/app/autonomy", icon: Zap },
  { name: "Activity", href: "/app/activity", icon: Activity },
  { name: "Settings", href: "/app/settings", icon: Settings },
  { name: "Help", href: "/app/help", icon: HelpCircle },
];

export const AppShell = ({ children }: AppShellProps) => {
  const location = useLocation();

  return (
    <div className="min-h-screen bg-background gradient-radial">
      {/* Configuration Warning Banner */}
      <ConfigWarningBanner />

      {/* Top Navigation */}
      <header className="fixed top-0 left-0 right-0 z-40 glass border-b border-border/50">
        <div className="flex items-center justify-between px-6 py-4">
          <div className="flex items-center gap-6">
            <Link to="/" className="flex items-center gap-2">
              <div className="w-8 h-8 bg-gradient-to-br from-primary to-accent rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-sm">S</span>
              </div>
              <span className="text-lg font-bold">SIV</span>
            </Link>
            <NetworkBadge />
            <Badge
              variant="outline"
              className="text-xs border-complement/30 text-complement"
            >
              DeWeb
            </Badge>
            <a
              href="https://explorer.massa.net"
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
            >
              Explorer <ExternalLink className="w-3 h-3" />
            </a>
          </div>
          <WalletButton />
        </div>
      </header>

      <div className="flex pt-16">
        {/* Sidebar */}
        <aside className="fixed left-0 top-16 bottom-0 w-64 glass border-r border-border/50 p-4">
          <nav className="space-y-2">
            {navigation.map((item) => (
              <NavLink
                key={item.name}
                to={item.href}
                className="flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all hover:bg-muted/50"
                activeClassName="bg-primary-muted text-primary"
              >
                <item.icon className="w-5 h-5" />
                {item.name}
              </NavLink>
            ))}
          </nav>
        </aside>

        {/* Main Content */}
        <main className="flex-1 ml-64 p-8">
          <motion.div
            key={location.pathname}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
          >
            {children}
          </motion.div>
        </main>
      </div>
    </div>
  );
};
