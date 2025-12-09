import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { format, parseISO, startOfMonth, endOfMonth, subMonths } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { 
  ArrowLeft, 
  Calendar, 
  Search, 
  Filter, 
  X, 
  Clock,
  User,
  Scissors,
  ChevronLeft,
  ChevronRight,
  Download,
  SlidersHorizontal
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { CustomerHistory } from "@/components/CustomerHistory";
import AnimatedBackground from "@/components/AnimatedBackground";

interface AppointmentWithDetails {
  id: string;
  appointment_date: string;
  appointment_time: string;
  status: string;
  payment_status: string;
  payment_method: string | null;
  notes: string | null;
  created_at: string;
  user_id: string;
  service: {
    name: string;
    price: number;
  };
  profile: {
    full_name: string | null;
    phone: string | null;
  } | null;
  additional_services: {
    name: string;
    price: number;
  }[];
}

const statusLabels: Record<string, string> = {
  pending: "Pendente",
  confirmed: "Confirmado",
  completed: "Concluído",
  cancelled: "Cancelado",
};

const statusColors: Record<string, string> = {
  pending: "bg-amber-500/20 text-amber-400 border-amber-500/30",
  confirmed: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
  completed: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  cancelled: "bg-red-500/20 text-red-400 border-red-500/30",
};

const paymentStatusLabels: Record<string, string> = {
  pending: "Pendente",
  paid: "Pago",
  refunded: "Reembolsado",
};

const ITEMS_PER_PAGE = 15;

const AppointmentHistory = () => {
  const navigate = useNavigate();
  const { user, isAdmin, loading: authLoading } = useAuth();
  
  const [appointments, setAppointments] = useState<AppointmentWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  
  // Filters
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [paymentFilter, setPaymentFilter] = useState<string>("all");
  const [dateFrom, setDateFrom] = useState<Date | undefined>(startOfMonth(subMonths(new Date(), 1)));
  const [dateTo, setDateTo] = useState<Date | undefined>(endOfMonth(new Date()));
  const [showFilters, setShowFilters] = useState(false);
  
  // Customer history dialog
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [showCustomerHistory, setShowCustomerHistory] = useState(false);

  useEffect(() => {
    if (!authLoading && !isAdmin) {
      navigate("/");
      toast.error("Acesso negado");
    }
  }, [authLoading, isAdmin, navigate]);

  useEffect(() => {
    if (isAdmin) {
      fetchAppointments();
    }
  }, [isAdmin]);

  const fetchAppointments = async () => {
    setLoading(true);
    try {
      const { data: appointmentsData, error } = await supabase
        .from("appointments")
        .select(`
          *,
          service:services(name, price)
        `)
        .order("appointment_date", { ascending: false })
        .order("appointment_time", { ascending: false });

      if (error) throw error;

      // Fetch profiles
      const userIds = [...new Set(appointmentsData?.map(a => a.user_id) || [])];
      const { data: profilesData } = await supabase
        .from("profiles")
        .select("user_id, full_name, phone")
        .in("user_id", userIds);

      // Fetch additional services
      const appointmentIds = appointmentsData?.map(a => a.id) || [];
      const { data: additionalServicesData } = await supabase
        .from("appointment_services")
        .select(`
          appointment_id,
          service:services(name, price)
        `)
        .in("appointment_id", appointmentIds);

      const profilesMap = new Map(profilesData?.map(p => [p.user_id, p]));
      const additionalServicesMap = new Map<string, { name: string; price: number }[]>();
      
      additionalServicesData?.forEach(as => {
        if (!additionalServicesMap.has(as.appointment_id)) {
          additionalServicesMap.set(as.appointment_id, []);
        }
        if (as.service) {
          additionalServicesMap.get(as.appointment_id)?.push({
            name: as.service.name,
            price: as.service.price
          });
        }
      });

      const enrichedAppointments = appointmentsData?.map(a => ({
        ...a,
        profile: profilesMap.get(a.user_id) || null,
        additional_services: additionalServicesMap.get(a.id) || []
      })) || [];

      setAppointments(enrichedAppointments);
    } catch (error) {
      console.error("Error fetching appointments:", error);
      toast.error("Erro ao carregar histórico");
    } finally {
      setLoading(false);
    }
  };

  const filteredAppointments = useMemo(() => {
    return appointments.filter(appointment => {
      // Search filter
      if (searchTerm) {
        const search = searchTerm.toLowerCase();
        const matchesName = appointment.profile?.full_name?.toLowerCase().includes(search);
        const matchesPhone = appointment.profile?.phone?.includes(search);
        const matchesService = appointment.service?.name.toLowerCase().includes(search);
        if (!matchesName && !matchesPhone && !matchesService) return false;
      }

      // Status filter
      if (statusFilter !== "all" && appointment.status !== statusFilter) return false;

      // Payment filter
      if (paymentFilter !== "all" && appointment.payment_status !== paymentFilter) return false;

      // Date range filter
      const appointmentDate = parseISO(appointment.appointment_date);
      if (dateFrom && appointmentDate < dateFrom) return false;
      if (dateTo && appointmentDate > dateTo) return false;

      return true;
    });
  }, [appointments, searchTerm, statusFilter, paymentFilter, dateFrom, dateTo]);

  const paginatedAppointments = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredAppointments.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredAppointments, currentPage]);

  const totalPages = Math.ceil(filteredAppointments.length / ITEMS_PER_PAGE);

  const clearFilters = () => {
    setSearchTerm("");
    setStatusFilter("all");
    setPaymentFilter("all");
    setDateFrom(startOfMonth(subMonths(new Date(), 1)));
    setDateTo(endOfMonth(new Date()));
    setCurrentPage(1);
  };

  const calculateTotal = (appointment: AppointmentWithDetails) => {
    const mainPrice = appointment.service?.price || 0;
    const additionalTotal = appointment.additional_services.reduce((sum, s) => sum + s.price, 0);
    return mainPrice + additionalTotal;
  };

  const exportToCSV = () => {
    const headers = ["Data", "Hora", "Cliente", "Telefone", "Serviço", "Status", "Pagamento", "Total"];
    const rows = filteredAppointments.map(a => [
      format(parseISO(a.appointment_date), "dd/MM/yyyy"),
      a.appointment_time.slice(0, 5),
      a.profile?.full_name || "N/A",
      a.profile?.phone || "N/A",
      a.service?.name || "N/A",
      statusLabels[a.status] || a.status,
      paymentStatusLabels[a.payment_status] || a.payment_status,
      `R$ ${calculateTotal(a).toFixed(2)}`
    ]);

    const csvContent = [headers, ...rows].map(row => row.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `historico-agendamentos-${format(new Date(), "yyyy-MM-dd")}.csv`;
    link.click();
    toast.success("Arquivo exportado com sucesso!");
  };

  const stats = useMemo(() => {
    const total = filteredAppointments.length;
    const completed = filteredAppointments.filter(a => a.status === "completed").length;
    const cancelled = filteredAppointments.filter(a => a.status === "cancelled").length;
    const revenue = filteredAppointments
      .filter(a => a.status === "completed" || a.status === "confirmed")
      .reduce((sum, a) => sum + calculateTotal(a), 0);
    
    return { total, completed, cancelled, revenue };
  }, [filteredAppointments]);

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <AnimatedBackground />
      
      <div className="relative z-10">
        {/* Header */}
        <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-xl border-b border-border/50">
          <div className="container mx-auto px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={() => navigate("/admin")}
                className="hover:bg-muted"
              >
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <div>
                <h1 className="text-lg md:text-xl font-bold">Histórico de Agendamentos</h1>
                <p className="text-xs text-muted-foreground hidden sm:block">
                  {filteredAppointments.length} agendamentos encontrados
                </p>
              </div>
            </div>
            
            <Button 
              variant="outline" 
              size="sm" 
              onClick={exportToCSV}
              className="gap-2"
            >
              <Download className="h-4 w-4" />
              <span className="hidden sm:inline">Exportar</span>
            </Button>
          </div>
        </header>

        <main className="container mx-auto px-4 py-4 md:py-6 space-y-4 md:space-y-6">
          {/* Stats Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
            <Card className="bg-card/50 backdrop-blur border-border/50">
              <CardContent className="p-3 md:p-4">
                <p className="text-xs text-muted-foreground">Total</p>
                <p className="text-xl md:text-2xl font-bold">{stats.total}</p>
              </CardContent>
            </Card>
            <Card className="bg-card/50 backdrop-blur border-border/50">
              <CardContent className="p-3 md:p-4">
                <p className="text-xs text-muted-foreground">Concluídos</p>
                <p className="text-xl md:text-2xl font-bold text-emerald-400">{stats.completed}</p>
              </CardContent>
            </Card>
            <Card className="bg-card/50 backdrop-blur border-border/50">
              <CardContent className="p-3 md:p-4">
                <p className="text-xs text-muted-foreground">Cancelados</p>
                <p className="text-xl md:text-2xl font-bold text-red-400">{stats.cancelled}</p>
              </CardContent>
            </Card>
            <Card className="bg-card/50 backdrop-blur border-border/50">
              <CardContent className="p-3 md:p-4">
                <p className="text-xs text-muted-foreground">Receita</p>
                <p className="text-lg md:text-2xl font-bold text-primary">
                  R$ {stats.revenue.toFixed(0)}
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Filters */}
          <Card className="bg-card/50 backdrop-blur border-border/50">
            <CardContent className="p-3 md:p-4 space-y-3">
              {/* Search and Toggle */}
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar por nome, telefone ou serviço..."
                    value={searchTerm}
                    onChange={(e) => {
                      setSearchTerm(e.target.value);
                      setCurrentPage(1);
                    }}
                    className="pl-9 bg-background/50"
                  />
                </div>
                <Button
                  variant={showFilters ? "secondary" : "outline"}
                  size="icon"
                  onClick={() => setShowFilters(!showFilters)}
                  className="shrink-0"
                >
                  <SlidersHorizontal className="h-4 w-4" />
                </Button>
              </div>

              {/* Expandable Filters */}
              {showFilters && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-2 border-t border-border/50">
                  <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setCurrentPage(1); }}>
                    <SelectTrigger className="bg-background/50">
                      <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos os Status</SelectItem>
                      <SelectItem value="pending">Pendente</SelectItem>
                      <SelectItem value="confirmed">Confirmado</SelectItem>
                      <SelectItem value="completed">Concluído</SelectItem>
                      <SelectItem value="cancelled">Cancelado</SelectItem>
                    </SelectContent>
                  </Select>

                  <Select value={paymentFilter} onValueChange={(v) => { setPaymentFilter(v); setCurrentPage(1); }}>
                    <SelectTrigger className="bg-background/50">
                      <SelectValue placeholder="Pagamento" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos Pagamentos</SelectItem>
                      <SelectItem value="pending">Pendente</SelectItem>
                      <SelectItem value="paid">Pago</SelectItem>
                      <SelectItem value="refunded">Reembolsado</SelectItem>
                    </SelectContent>
                  </Select>

                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="justify-start gap-2 bg-background/50">
                        <Calendar className="h-4 w-4" />
                        <span className="truncate text-sm">
                          {dateFrom ? format(dateFrom, "dd/MM/yy") : "De"}
                        </span>
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <CalendarComponent
                        mode="single"
                        selected={dateFrom}
                        onSelect={(d) => { setDateFrom(d); setCurrentPage(1); }}
                        locale={ptBR}
                      />
                    </PopoverContent>
                  </Popover>

                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="justify-start gap-2 bg-background/50">
                        <Calendar className="h-4 w-4" />
                        <span className="truncate text-sm">
                          {dateTo ? format(dateTo, "dd/MM/yy") : "Até"}
                        </span>
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <CalendarComponent
                        mode="single"
                        selected={dateTo}
                        onSelect={(d) => { setDateTo(d); setCurrentPage(1); }}
                        locale={ptBR}
                      />
                    </PopoverContent>
                  </Popover>

                  <Button 
                    variant="ghost" 
                    onClick={clearFilters}
                    className="gap-2 sm:col-span-2 lg:col-span-4"
                  >
                    <X className="h-4 w-4" />
                    Limpar Filtros
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Table/List */}
          <Card className="bg-card/50 backdrop-blur border-border/50 overflow-hidden">
            {loading ? (
              <div className="p-4 space-y-3">
                {[...Array(5)].map((_, i) => (
                  <Skeleton key={i} className="h-16 w-full" />
                ))}
              </div>
            ) : filteredAppointments.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">
                <Calendar className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>Nenhum agendamento encontrado</p>
              </div>
            ) : (
              <>
                {/* Desktop Table */}
                <div className="hidden md:block overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-border/50 hover:bg-transparent">
                        <TableHead>Data/Hora</TableHead>
                        <TableHead>Cliente</TableHead>
                        <TableHead>Serviço</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Pagamento</TableHead>
                        <TableHead className="text-right">Total</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paginatedAppointments.map((appointment) => (
                        <TableRow 
                          key={appointment.id} 
                          className="border-border/50 hover:bg-muted/30 cursor-pointer"
                          onClick={() => {
                            setSelectedUserId(appointment.user_id);
                            setShowCustomerHistory(true);
                          }}
                        >
                          <TableCell>
                            <div>
                              <p className="font-medium">
                                {format(parseISO(appointment.appointment_date), "dd/MM/yyyy")}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {appointment.appointment_time.slice(0, 5)}
                              </p>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div>
                              <p className="font-medium">
                                {appointment.profile?.full_name || "Cliente"}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {appointment.profile?.phone || "Sem telefone"}
                              </p>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div>
                              <p>{appointment.service?.name}</p>
                              {appointment.additional_services.length > 0 && (
                                <p className="text-xs text-muted-foreground">
                                  +{appointment.additional_services.length} serviço(s)
                                </p>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge className={`${statusColors[appointment.status]} border`}>
                              {statusLabels[appointment.status]}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <span className="text-sm">
                              {paymentStatusLabels[appointment.payment_status]}
                            </span>
                          </TableCell>
                          <TableCell className="text-right font-medium">
                            R$ {calculateTotal(appointment).toFixed(2)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                {/* Mobile List */}
                <div className="md:hidden divide-y divide-border/50">
                  {paginatedAppointments.map((appointment) => (
                    <div
                      key={appointment.id}
                      className="p-3 hover:bg-muted/30 cursor-pointer active:bg-muted/50 transition-colors"
                      onClick={() => {
                        setSelectedUserId(appointment.user_id);
                        setShowCustomerHistory(true);
                      }}
                    >
                      <div className="flex justify-between items-start mb-2">
                        <div className="flex items-center gap-2">
                          <div className="p-1.5 bg-primary/10 rounded">
                            <Calendar className="h-3.5 w-3.5 text-primary" />
                          </div>
                          <div>
                            <p className="text-sm font-medium">
                              {format(parseISO(appointment.appointment_date), "dd/MM/yy")}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {appointment.appointment_time.slice(0, 5)}
                            </p>
                          </div>
                        </div>
                        <Badge className={`${statusColors[appointment.status]} border text-xs`}>
                          {statusLabels[appointment.status]}
                        </Badge>
                      </div>
                      
                      <div className="flex justify-between items-end">
                        <div>
                          <p className="text-sm font-medium flex items-center gap-1.5">
                            <User className="h-3 w-3 text-muted-foreground" />
                            {appointment.profile?.full_name || "Cliente"}
                          </p>
                          <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                            <Scissors className="h-3 w-3" />
                            {appointment.service?.name}
                            {appointment.additional_services.length > 0 && (
                              <span className="text-primary">
                                +{appointment.additional_services.length}
                              </span>
                            )}
                          </p>
                        </div>
                        <p className="font-semibold text-primary">
                          R$ {calculateTotal(appointment).toFixed(0)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </Card>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              
              <div className="flex items-center gap-1">
                {[...Array(Math.min(5, totalPages))].map((_, i) => {
                  let pageNum: number;
                  if (totalPages <= 5) {
                    pageNum = i + 1;
                  } else if (currentPage <= 3) {
                    pageNum = i + 1;
                  } else if (currentPage >= totalPages - 2) {
                    pageNum = totalPages - 4 + i;
                  } else {
                    pageNum = currentPage - 2 + i;
                  }
                  
                  return (
                    <Button
                      key={pageNum}
                      variant={currentPage === pageNum ? "default" : "ghost"}
                      size="sm"
                      className="w-8 h-8 p-0"
                      onClick={() => setCurrentPage(pageNum)}
                    >
                      {pageNum}
                    </Button>
                  );
                })}
              </div>
              
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          )}
        </main>
      </div>

      {/* Customer History Dialog */}
      <CustomerHistory
        userId={selectedUserId}
        isOpen={showCustomerHistory}
        onClose={() => {
          setShowCustomerHistory(false);
          setSelectedUserId(null);
        }}
      />
    </div>
  );
};

export default AppointmentHistory;
