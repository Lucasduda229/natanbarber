import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import { OfflineIndicator } from "@/components/OfflineIndicator";
import Index from "./pages/Index";
import Register from "./pages/Register";
import Login from "./pages/Login";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import Booking from "./pages/Booking";
import BuySubscription from "./pages/BuySubscription";
import MyAppointments from "./pages/MyAppointments";
import Admin from "./pages/Admin";
import AppointmentHistory from "./pages/AppointmentHistory";
import Install from "./pages/Install";
import Pedido from "./pages/Pedido";
import Profile from "./pages/Profile";
import NotFound from "./pages/NotFound";
import AuthRecoveryRedirect from "./components/AuthRecoveryRedirect";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <OfflineIndicator />
        <BrowserRouter>
          <AuthRecoveryRedirect />
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/register" element={<Register />} />
            <Route path="/login" element={<Login />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/booking" element={<Booking />} />
            <Route path="/buy-subscription" element={<BuySubscription />} />
            <Route path="/my-appointments" element={<MyAppointments />} />
            <Route path="/admin" element={<Admin />} />
            <Route path="/admin/history" element={<AppointmentHistory />} />
            <Route path="/install" element={<Install />} />
            <Route path="/pedido" element={<Pedido />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
