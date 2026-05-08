import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ProspectPoolProvider } from "./context/ProspectPoolContext";
import AppLayout from "./components/layout/AppLayout";
import Dashboard from "./pages/Dashboard";
import Signals from "./pages/Signals";
import Accounts from "./pages/Accounts";
import Emails from "@/pages/Emails";
import ProspectPools from "./pages/ProspectPools";
import AccountDetail from "./pages/AccountDetail";
import Alerts from "./pages/Alerts";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <ProspectPoolProvider>
        <BrowserRouter>
          <Routes>
            <Route element={<AppLayout />}>
              <Route path="/" element={<Dashboard />} />
              <Route path="/prospect-pools" element={<ProspectPools />} />
              <Route path="/campaigns" element={<ProspectPools />} />
              <Route path="/signals" element={<Signals />} />
              <Route path="/accounts" element={<Accounts />} />
              <Route path="/accounts/:id" element={<AccountDetail />} />
              <Route path="/emails" element={<Emails />} />
              <Route path="/alerts" element={<Alerts />} />
            </Route>
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </ProspectPoolProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
