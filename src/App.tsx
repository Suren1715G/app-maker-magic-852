import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
import { DemoModeProvider } from "@/contexts/DemoModeContext";
import { LocationProvider } from "@/contexts/LocationContext";
import { ProtectedRoute } from "@/components/app/ProtectedRoute";
import { AdminRoute } from "@/components/app/AdminRoute";
import { ReceptionistWidget } from "@/components/app/ReceptionistWidget";
import { useAuth } from "@/contexts/AuthContext";
import { ConversationProvider } from "@elevenlabs/react";
import Auth from "./pages/auth/Auth";
import ClaimCode from "./pages/auth/ClaimCode";
import Home from "./pages/app/Home";
import Calls from "./pages/app/Calls";
import CallDetail from "./pages/app/CallDetail";
import Calendar from "./pages/app/Calendar";
import Sms from "./pages/app/Sms";
import Settings from "./pages/app/Settings";
import Analytics from "./pages/app/Analytics";
import Notifications from "./pages/app/Notifications";
import Billing from "./pages/app/Billing";
import Referrals from "./pages/app/Referrals";
import Support from "./pages/app/Support";
import Assistant from "./pages/app/Assistant";
import Notes from "./pages/app/Notes";
import MasterOverview from "./pages/master/MasterOverview";
import MasterCompanies from "./pages/master/MasterCompanies";
import MasterCompanyDetail from "./pages/master/MasterCompanyDetail";
import MasterCodes from "./pages/master/MasterCodes";
import MasterSupport from "./pages/master/MasterSupport";
import NotFound from "./pages/NotFound.tsx";

const queryClient = new QueryClient();

// Renders the AI receptionist once at the app root (above <Routes>),
// so its session survives navigation. Only visible to logged-in users.
const PersistentReceptionist = () => {
  const { user } = useAuth();
  if (!user) return null;
  return (
    <ConversationProvider>
      <ReceptionistWidget />
    </ConversationProvider>
  );
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <DemoModeProvider>
            <LocationProvider>
              <PersistentReceptionist />
              <Routes>
              <Route path="/auth" element={<Auth />} />
              <Route path="/claim" element={<ClaimCode />} />

              {/* Owner master panel */}
              <Route path="/master" element={<AdminRoute><MasterOverview /></AdminRoute>} />
              <Route path="/master/companies" element={<AdminRoute><MasterCompanies /></AdminRoute>} />
              <Route path="/master/companies/:id" element={<AdminRoute><MasterCompanyDetail /></AdminRoute>} />
              <Route path="/master/codes" element={<AdminRoute><MasterCodes /></AdminRoute>} />
              <Route path="/master/support" element={<AdminRoute><MasterSupport /></AdminRoute>} />

              {/* Customer dashboard (admins only see this in demo mode) */}
              <Route path="/" element={<ProtectedRoute><Home /></ProtectedRoute>} />
              <Route path="/calls" element={<ProtectedRoute><Calls /></ProtectedRoute>} />
              <Route path="/calls/:id" element={<ProtectedRoute><CallDetail /></ProtectedRoute>} />
              <Route path="/calendar" element={<ProtectedRoute><Calendar /></ProtectedRoute>} />
              <Route path="/sms" element={<ProtectedRoute><Sms /></ProtectedRoute>} />
              <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
              <Route path="/analytics" element={<ProtectedRoute><Analytics /></ProtectedRoute>} />
              <Route path="/notifications" element={<ProtectedRoute><Notifications /></ProtectedRoute>} />
              <Route path="/billing" element={<ProtectedRoute><Billing /></ProtectedRoute>} />
              <Route path="/referrals" element={<ProtectedRoute><Referrals /></ProtectedRoute>} />
              <Route path="/support" element={<ProtectedRoute><Support /></ProtectedRoute>} />
              <Route path="/assistant" element={<ProtectedRoute><Assistant /></ProtectedRoute>} />
              <Route path="/notes" element={<ProtectedRoute><Notes /></ProtectedRoute>} />

              {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
              <Route path="*" element={<NotFound />} />
              </Routes>
            </LocationProvider>
          </DemoModeProvider>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
