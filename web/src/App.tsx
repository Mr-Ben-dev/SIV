import { ThemeProvider } from "@/components/ThemeProvider";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { WalletProvider } from "@/contexts/WalletContext";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { AppShell } from "./layouts/AppShell";
import Activity from "./pages/Activity";
import Autonomy from "./pages/Autonomy";
import Help from "./pages/Help";
import Landing from "./pages/Landing";
import NotFound from "./pages/NotFound";
import Portfolio from "./pages/Portfolio";
import Settings from "./pages/Settings";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider defaultTheme="dark">
      <WalletProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <Routes>
              <Route path="/" element={<Landing />} />
              <Route
                path="/app/*"
                element={
                  <AppShell>
                    <Routes>
                      <Route path="portfolio" element={<Portfolio />} />
                      <Route path="autonomy" element={<Autonomy />} />
                      <Route path="activity" element={<Activity />} />
                      <Route path="settings" element={<Settings />} />
                      <Route path="help" element={<Help />} />
                    </Routes>
                  </AppShell>
                }
              />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </TooltipProvider>
      </WalletProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
