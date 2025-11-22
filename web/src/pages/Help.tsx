import { Card } from "@/components/ui/card";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { ArrowRight, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";

const Help = () => {
  const steps = [
    {
      title: "Deposit USDC",
      description: "Users deposit USDC.e into the vault and receive share tokens representing their portion of the pool.",
    },
    {
      title: "Detect Drift",
      description: "The system monitors portfolio weights and detects when they drift from target allocations.",
    },
    {
      title: "Schedule Slices",
      description: "Rebalancing is split into 6 time-sliced transactions, executed via deferred calls in the cheapest slots.",
    },
    {
      title: "Execute & Guard",
      description: "Each slice executes automatically. The risk-off guard monitors volatility and shifts to defensive positions when needed.",
    },
  ];

  const faqs = [
    {
      q: "What wallet do I need?",
      a: "Sentinel Index Vault requires the Bearby wallet extension for the Massa blockchain. Download it from the official Massa website.",
    },
    {
      q: "What fees does the vault charge?",
      a: "The vault charges a 0.3% management fee on deposits and 0.1% performance fee on gains. Gas fees are paid from the Gas Bank.",
    },
    {
      q: "How does the Gas Bank work?",
      a: "The Gas Bank is a shared pool of MAS tokens used to pay for automated transactions. You can refill it anytime from your portfolio.",
    },
    {
      q: "Can I withdraw anytime?",
      a: "Yes, withdrawals are available 24/7. You'll receive a basket of tokens matching your share, or wait for exit-to-USDC feature.",
    },
    {
      q: "What is DeWeb hosting?",
      a: "DeWeb is decentralized web hosting on the Massa blockchain, ensuring the vault interface is always accessible and censorship-resistant.",
    },
    {
      q: "Where can I view transactions?",
      a: "All transactions are visible on the Massa Explorer. Click any transaction hash in the Activity page to view details.",
    },
  ];

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-3xl font-bold mb-2">Help & Documentation</h1>
        <p className="text-muted-foreground">
          Learn how Sentinel Index Vault works and get answers to common questions
        </p>
      </div>

      {/* How SIV Works */}
      <Card className="glass p-6 space-y-6">
        <h2 className="text-xl font-semibold">How SIV Works</h2>

        <div className="space-y-4">
          {steps.map((step, index) => (
            <div key={index} className="flex gap-4">
              <div className="flex-shrink-0">
                <div className="w-10 h-10 rounded-full bg-primary-muted flex items-center justify-center">
                  <span className="text-primary font-bold">{index + 1}</span>
                </div>
              </div>
              <div className="flex-1">
                <h3 className="font-semibold mb-1">{step.title}</h3>
                <p className="text-sm text-muted-foreground">{step.description}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="pt-4 border-t border-border/50">
          <div className="bg-complement-muted border border-complement/20 rounded-lg p-4">
            <p className="text-sm text-complement mb-2">
              <strong>Key Advantage:</strong> Time-slicing reduces market impact and finds optimal execution prices across multiple blocks.
            </p>
          </div>
        </div>
      </Card>

      {/* FAQ */}
      <Card className="glass p-6 space-y-6">
        <h2 className="text-xl font-semibold">Frequently Asked Questions</h2>

        <Accordion type="single" collapsible className="w-full">
          {faqs.map((faq, index) => (
            <AccordionItem key={index} value={`item-${index}`}>
              <AccordionTrigger className="text-left">
                {faq.q}
              </AccordionTrigger>
              <AccordionContent className="text-muted-foreground">
                {faq.a}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </Card>

      {/* Resources */}
      <Card className="glass p-6 space-y-4">
        <h2 className="text-xl font-semibold">Additional Resources</h2>

        <div className="space-y-2">
          <a
            href="https://docs.lovable.dev"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-between p-3 rounded-lg hover:bg-muted/30 transition-colors group"
          >
            <span className="text-sm font-medium">Full Documentation</span>
            <ExternalLink className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
          </a>
          <a
            href="https://massa.net"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-between p-3 rounded-lg hover:bg-muted/30 transition-colors group"
          >
            <span className="text-sm font-medium">Massa Network</span>
            <ExternalLink className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
          </a>
          <a
            href="https://explorer.massa.net"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-between p-3 rounded-lg hover:bg-muted/30 transition-colors group"
          >
            <span className="text-sm font-medium">Block Explorer</span>
            <ExternalLink className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
          </a>
        </div>
      </Card>

      {/* Support */}
      <Card className="glass p-6 text-center space-y-4">
        <h3 className="text-lg font-semibold">Need More Help?</h3>
        <p className="text-muted-foreground">
          Join our community or reach out to the team for support
        </p>
        <Button className="bg-primary hover:bg-primary/90 text-primary-foreground press-scale">
          Join Discord <ArrowRight className="ml-2 w-4 h-4" />
        </Button>
      </Card>
    </div>
  );
};

export default Help;
