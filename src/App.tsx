import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
import { DemoModeProvider } from "@/contexts/DemoModeContext";
import { ProtectedRoute } from "@/components/app/ProtectedRoute";
import { AdminRoute } from "@/components/app/AdminRoute";
import Auth from "./pages/auth/Auth";
import ClaimCode from "./pages/auth/ClaimCode";
import Home from "./pages/app/Home";
import Calls from "./pages/app/Calls";
import CallDetail from "./pages/app/CallDetail";
import Calendar from "./pages/app/Calendar";
import Sms from "./pages/app/Sms";
import Settings from "./pages/app/Settings";
import MasterOverview from "./pages/master/MasterOverview";
import MasterCompanies from "./pages/master/MasterCompanies";
import MasterCompanyDetail from "./pages/master/MasterCompanyDetail";
import MasterCodes from "./pages/master/MasterCodes";
import NotFound from "./pages/NotFound.tsx";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <DemoModeProvider>
            <Routes>
              <Route path="/auth" element={<Auth />} />
              <Route path="/claim" element={<ClaimCode />} />

              {/* Owner master panel */}
              <Route path="/master" element={<AdminRoute><MasterOverview /></AdminRoute>} />
              <Route path="/master/companies" element={<AdminRoute><MasterCompanies /></AdminRoute>} />
              <Route path="/master/companies/:id" element={<AdminRoute><MasterCompanyDetail /></AdminRoute>} />
              <Route path="/master/codes" element={<AdminRoute><MasterCodes /></AdminRoute>} />

              {/* Customer dashboard (admins only see this in demo mode) */}
              <Route path="/" element={<ProtectedRoute><Home /></ProtectedRoute>} />
              <Route path="/calls" element={<ProtectedRoute><Calls /></ProtectedRoute>} />
              <Route path="/calls/:id" element={<ProtectedRoute><CallDetail /></ProtectedRoute>} />
              <Route path="/calendar" element={<ProtectedRoute><Calendar /></ProtectedRoute>} />
              <Route path="/sms" element={<ProtectedRoute><Sms /></ProtectedRoute>} />
              <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />

              {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </DemoModeProvider>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
