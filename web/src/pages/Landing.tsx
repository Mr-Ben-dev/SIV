import heroBg from "@/assets/hero-bg.jpg";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { motion } from "framer-motion";
import {
  ArrowRight,
  ExternalLink,
  Shield,
  TrendingUp,
  Zap,
} from "lucide-react";
import { Link } from "react-router-dom";

const Landing = () => {
  const features = [
    {
      icon: Shield,
      title: "Guaranteed Automation",
      description:
        "Powered by deferred calls, execution happens in the cheapest slot—no manual intervention needed.",
    },
    {
      icon: Zap,
      title: "Low-Slippage Rebalancing",
      description:
        "Time-sliced execution spreads trades across multiple blocks, minimizing market impact.",
    },
    {
      icon: TrendingUp,
      title: "Risk-Off Guard",
      description:
        "Autonomous protection automatically shifts to defensive positions during market stress.",
    },
  ];

  const stats = [
    { label: "Total Value Locked", value: "$2.4M", change: "+12.3%" },
    { label: "Next Slice", value: "2h 14m", change: "Slot #42" },
    { label: "Last Rebalance", value: "6h ago", change: "0.3% drift" },
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 glass border-b border-border/50">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-gradient-to-br from-primary to-accent rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-sm">S</span>
              </div>
              <span className="text-xl font-bold">Sentinel Index Vault</span>
            </div>
            <div className="flex items-center gap-4">
              <a
                href="#how-it-works"
                className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                How it works
              </a>
              <a
                href="https://docs.lovable.dev"
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
              >
                Docs <ExternalLink className="w-3 h-3" />
              </a>
              <a
                href="https://lovable.dev"
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
              >
                DeWeb Site <ExternalLink className="w-3 h-3" />
              </a>
              <Link to="/app/portfolio">
                <Button className="bg-primary hover:bg-primary/90 text-primary-foreground press-scale">
                  Open App
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative pt-32 pb-24 overflow-hidden">
        <div
          className="absolute inset-0 opacity-20"
          style={{
            backgroundImage: `url(${heroBg})`,
            backgroundSize: "cover",
            backgroundPosition: "center",
          }}
        />
        <div className="absolute inset-0 gradient-radial" />

        <div className="container mx-auto px-6 relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="text-center max-w-4xl mx-auto"
          >
            <h1 className="text-6xl font-bold mb-6 bg-gradient-to-r from-primary via-accent to-complement bg-clip-text text-transparent">
              Sentinel Index Vault
            </h1>
            <p className="text-xl text-muted-foreground mb-8 leading-relaxed">
              A USDC-denominated index vault that drip-rebalances on-chain and
              flips risk-off during stress—guaranteed by Deferred Calls, hosted
              on DeWeb.
            </p>
            <div className="flex items-center justify-center gap-4">
              <Link to="/app/portfolio">
                <Button
                  size="lg"
                  className="bg-primary hover:bg-primary/90 text-primary-foreground press-scale text-lg px-8"
                >
                  Open App <ArrowRight className="ml-2 w-5 h-5" />
                </Button>
              </Link>
              <Button
                size="lg"
                variant="outline"
                className="border-primary/20 hover:bg-primary/5 text-lg px-8 press-scale"
              >
                Learn More
              </Button>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Features */}
      <section id="how-it-works" className="py-24 bg-muted/30">
        <div className="container mx-auto px-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="text-4xl font-bold mb-4">How It Works</h2>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
              Advanced DeFi automation designed for optimal execution and risk
              management
            </p>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-8">
            {features.map((feature, index) => (
              <motion.div
                key={feature.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: index * 0.1 }}
                viewport={{ once: true }}
              >
                <Card className="glass p-8 hover-lift h-full">
                  <div className="w-12 h-12 bg-primary-muted rounded-xl flex items-center justify-center mb-6">
                    <feature.icon className="w-6 h-6 text-primary" />
                  </div>
                  <h3 className="text-xl font-semibold mb-3">
                    {feature.title}
                  </h3>
                  <p className="text-muted-foreground leading-relaxed">
                    {feature.description}
                  </p>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="py-24">
        <div className="container mx-auto px-6">
          <div className="grid md:grid-cols-3 gap-8">
            {stats.map((stat, index) => (
              <motion.div
                key={stat.label}
                initial={{ opacity: 0, scale: 0.9 }}
                whileInView={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.4, delay: index * 0.1 }}
                viewport={{ once: true }}
              >
                <Card className="glass p-8 text-center hover-lift">
                  <div className="text-sm text-muted-foreground mb-2">
                    {stat.label}
                  </div>
                  <div className="text-4xl font-bold font-mono mb-2">
                    {stat.value}
                  </div>
                  <div className="text-sm text-complement font-medium">
                    {stat.change}
                  </div>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border/50 py-12 bg-muted/30">
        <div className="container mx-auto px-6">
          <div className="grid md:grid-cols-4 gap-8 mb-8">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 bg-gradient-to-br from-primary to-accent rounded-lg flex items-center justify-center">
                  <span className="text-white font-bold text-sm">S</span>
                </div>
                <span className="font-bold">SIV</span>
              </div>
              <p className="text-sm text-muted-foreground">
                Autonomous index vault on DeWeb
              </p>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Product</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>
                  <a
                    href="#"
                    className="hover:text-foreground transition-colors"
                  >
                    Features
                  </a>
                </li>
                <li>
                  <a
                    href="#"
                    className="hover:text-foreground transition-colors"
                  >
                    Roadmap
                  </a>
                </li>
                <li>
                  <a
                    href="#"
                    className="hover:text-foreground transition-colors"
                  >
                    Pricing
                  </a>
                </li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Resources</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>
                  <a
                    href="#"
                    className="hover:text-foreground transition-colors"
                  >
                    Documentation
                  </a>
                </li>
                <li>
                  <a
                    href="#"
                    className="hover:text-foreground transition-colors"
                  >
                    API Reference
                  </a>
                </li>
                <li>
                  <a
                    href="#"
                    className="hover:text-foreground transition-colors"
                  >
                    Support
                  </a>
                </li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Network</h4>
              <div className="flex items-center gap-2 mb-2">
                <div className="w-2 h-2 bg-success rounded-full animate-pulse" />
                <span className="text-sm">Mainnet Active</span>
              </div>
            </div>
          </div>
          <div className="pt-8 border-t border-border/50 flex flex-col md:flex-row items-center justify-between gap-4">
            <p className="text-sm text-muted-foreground">
              © 2025 Sentinel Index Vault.{" "}
              <span className="text-warning">Not financial advice.</span>
            </p>
            <div className="text-sm text-muted-foreground">
              v1.0.0 • Powered by DeWeb
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Landing;
