import { useState, useMemo } from "react";
import { format, parseISO, subDays, subYears, isAfter, isBefore, isEqual } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import {
  BarChart3, Clock, CreditCard, Banknote, Download, Crown, Trash2,
  Pencil, Save, XCircle, CalendarIcon, Filter, ChevronDown, ChevronUp,
  TrendingUp, Wallet, Eye, EyeOff, Search
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import pixIcon from "@/assets/pix-icon.png";

interface AppointmentService {
  name: string;
  price: number;
}

interface Appointment {
  id: string;
  user_id: string;
  appointment_date: string;
  appointment_time: string;
  status: string;
  payment_status: string;
  payment_method: string | null;
  notes: string | null;
  profiles: {
    full_name: string | null;
    phone: string | null;
  } | null;
  services: AppointmentService[];
}

interface RevenueAdjustment {
  id: string;
  appointment_id: string;
  original_value: number;
  adjusted_value: number;
  adjustment_reason: string | null;
}

interface PackagePayment {
  id: string;
  user_id: string;
  package_id: string | null;
  package_name: string;
  amount: number;
  payment_date: string;
  payment_method: string | null;
  notes: string | null;
  created_at: string;
  payment_status?: string;
  profiles?: {
    full_name: string | null;
  } | null;
}

interface FinancialReportProps {
  appointments: Appointment[];
  packagePayments: PackagePayment[];
  revenueAdjustments: RevenueAdjustment[];
  cashClosingDay: number;
  reportStartDate: Date | undefined;
  reportEndDate: Date | undefined;
  setReportStartDate: (date: Date | undefined) => void;
  setReportEndDate: (date: Date | undefined) => void;
  getAdjustedValue: (appointmentId: string, originalValue: number) => number;
  getServicesTotal: (services: AppointmentService[], notes?: string | null) => number;
  getServicesTotalForRevenue: (services: AppointmentService[], paymentMethod: string | null, notes?: string | null) => number;
  getServicesNames: (services: AppointmentService[]) => string;
  saveRevenueAdjustment: (appointmentId: string, originalValue: number, adjustedValue: number) => void;
  deletePackagePayment: (paymentId: string, packageName: string) => void;
  editingAppointmentId: string | null;
  setEditingAppointmentId: (id: string | null) => void;
  editValue: string;
  setEditValue: (value: string) => void;
  editingClosingDay: boolean;
  setEditingClosingDay: (editing: boolean) => void;
  closingDayInput: string;
  setClosingDayInput: (value: string) => void;
  saveCashClosingDay: (day: number) => void;
}

const FinancialReport = ({
  appointments,
  packagePayments,
  revenueAdjustments,
  cashClosingDay,
  reportStartDate,
  reportEndDate,
  setReportStartDate,
  setReportEndDate,
  getAdjustedValue,
  getServicesTotal,
  getServicesTotalForRevenue,
  getServicesNames,
  saveRevenueAdjustment,
  deletePackagePayment,
  editingAppointmentId,
  setEditingAppointmentId,
  editValue,
  setEditValue,
  editingClosingDay,
  setEditingClosingDay,
  closingDayInput,
  setClosingDayInput,
  saveCashClosingDay,
}: FinancialReportProps) => {
  const [activeQuickFilter, setActiveQuickFilter] = useState<string>("30dias");
  const [showCharts, setShowCharts] = useState(true);
  const [subscriptionPaymentFilter, setSubscriptionPaymentFilter] = useState<string>("all");
  const [subscriptionStatusFilter, setSubscriptionStatusFilter] = useState<string>("all");
  const [subscriptionSearch, setSubscriptionSearch] = useState("");
  const [showAllTransactions, setShowAllTransactions] = useState(false);
  const [showAllSubscriptions, setShowAllSubscriptions] = useState(false);

  // Filtered appointments by date range
  const filteredReportAppointments = useMemo(() => {
    if (!reportStartDate || !reportEndDate) return appointments;
    return appointments.filter(a => {
      const appointmentDate = parseISO(a.appointment_date);
      const afterStart = isAfter(appointmentDate, reportStartDate) || isEqual(appointmentDate, reportStartDate);
      const beforeEnd = isBefore(appointmentDate, reportEndDate) || isEqual(appointmentDate, reportEndDate);
      return afterStart && beforeEnd;
    });
  }, [appointments, reportStartDate, reportEndDate]);

  // Calculated totals
  const totals = useMemo(() => {
    const pixTotal = filteredReportAppointments
      .filter(a => a.payment_status === 'paid_pix' && a.payment_method !== 'subscription')
      .reduce((sum, a) => sum + getAdjustedValue(a.id, getServicesTotalForRevenue(a.services, a.payment_method, a.notes)), 0);
    const cashTotal = filteredReportAppointments
      .filter(a => a.payment_status === 'paid_cash' && a.payment_method !== 'subscription')
      .reduce((sum, a) => sum + getAdjustedValue(a.id, getServicesTotalForRevenue(a.services, a.payment_method, a.notes)), 0);
    const cardTotal = filteredReportAppointments
      .filter(a => a.payment_status === 'paid_card' && a.payment_method !== 'subscription')
      .reduce((sum, a) => sum + getAdjustedValue(a.id, getServicesTotalForRevenue(a.services, a.payment_method, a.notes)), 0);
    const receptionTotal = filteredReportAppointments
      .filter(a => a.payment_status === 'paid_reception' && a.payment_method !== 'subscription')
      .reduce((sum, a) => sum + getAdjustedValue(a.id, getServicesTotalForRevenue(a.services, a.payment_method, a.notes)), 0);
    const pendingTotal = filteredReportAppointments
      .filter(a => a.payment_status === 'pending' && a.payment_method !== 'subscription' && a.status !== 'cancelled')
      .reduce((sum, a) => sum + getAdjustedValue(a.id, getServicesTotalForRevenue(a.services, a.payment_method, a.notes)), 0);
    const received = pixTotal + cashTotal + cardTotal + receptionTotal;

    // Package payments
    const filteredPP = packagePayments.filter(p => {
      if (!reportStartDate || !reportEndDate) return true;
      const paymentDate = parseISO(p.payment_date);
      const afterStart = isAfter(paymentDate, reportStartDate) || isEqual(paymentDate, reportStartDate);
      const beforeEnd = isBefore(paymentDate, reportEndDate) || isEqual(paymentDate, reportEndDate);
      return afterStart && beforeEnd;
    });
    const packageTotal = filteredPP
      .filter(p => p.payment_status && p.payment_status !== 'pending')
      .reduce((sum, p) => sum + (p.amount || 0), 0);

    return { pixTotal, cashTotal, cardTotal, receptionTotal, pendingTotal, received, packageTotal, filteredPP };
  }, [filteredReportAppointments, packagePayments, reportStartDate, reportEndDate, getAdjustedValue, getServicesTotalForRevenue]);

  const grandTotal = totals.received + totals.packageTotal;

  // Quick filter handler
  const applyQuickFilter = (filter: string) => {
    setActiveQuickFilter(filter);
    const now = new Date();
    switch (filter) {
      case "hoje":
        setReportStartDate(now);
        setReportEndDate(now);
        break;
      case "7dias":
        setReportStartDate(subDays(now, 7));
        setReportEndDate(now);
        break;
      case "30dias":
        setReportStartDate(subDays(now, 30));
        setReportEndDate(now);
        break;
      case "fechamento": {
        const currentDay = now.getDate();
        const currentMonth = now.getMonth();
        const currentYear = now.getFullYear();
        if (currentDay > cashClosingDay) {
          setReportStartDate(new Date(currentYear, currentMonth, cashClosingDay + 1));
          setReportEndDate(new Date(currentYear, currentMonth + 1, cashClosingDay));
        } else {
          setReportStartDate(new Date(currentYear, currentMonth - 1, cashClosingDay + 1));
          setReportEndDate(new Date(currentYear, currentMonth, cashClosingDay));
        }
        break;
      }
      case "todo": {
        const earliestDate = appointments.length > 0
          ? appointments.reduce((earliest, a) => {
              const date = parseISO(a.appointment_date);
              return date < earliest ? date : earliest;
            }, parseISO(appointments[0].appointment_date))
          : subYears(now, 1);
        setReportStartDate(earliestDate);
        setReportEndDate(now);
        break;
      }
    }
  };

  // Filtered subscription payments
  const filteredSubscriptionPayments = useMemo(() => {
    let filtered = totals.filteredPP;
    if (subscriptionPaymentFilter !== "all") {
      filtered = filtered.filter(p => p.payment_method === subscriptionPaymentFilter);
    }
    if (subscriptionStatusFilter !== "all") {
      filtered = filtered.filter(p => {
        if (subscriptionStatusFilter === "pending") return p.payment_status === "pending";
        return p.payment_status !== "pending";
      });
    }
    if (subscriptionSearch) {
      const search = subscriptionSearch.toLowerCase();
      filtered = filtered.filter(p =>
        (p.profiles?.full_name || "").toLowerCase().includes(search) ||
        (p.package_name || "").toLowerCase().includes(search)
      );
    }
    return filtered;
  }, [totals.filteredPP, subscriptionPaymentFilter, subscriptionStatusFilter, subscriptionSearch]);

  const subscriptionTotalFiltered = filteredSubscriptionPayments.reduce((sum, p) => sum + (p.amount || 0), 0);

  // Export PDF
  const exportPDF = () => {
    import('jspdf').then(({ jsPDF }) => {
      const doc = new jsPDF();
      const paidAppointments = filteredReportAppointments.filter(a =>
        a.payment_status === 'paid_pix' || a.payment_status === 'paid_cash' || a.payment_status === 'paid_card' || a.payment_status === 'paid'
      );
      const periodLabel = reportStartDate && reportEndDate
        ? `${format(reportStartDate, "dd/MM/yyyy")} a ${format(reportEndDate, "dd/MM/yyyy")}`
        : 'Período selecionado';

      doc.setFontSize(20);
      doc.setTextColor(218, 165, 32);
      doc.text('Relatório Financeiro', 105, 20, { align: 'center' });
      doc.setFontSize(12);
      doc.setTextColor(100);
      doc.text('Natan Barber', 105, 28, { align: 'center' });
      doc.setFontSize(10);
      doc.text(`Período: ${periodLabel}`, 105, 36, { align: 'center' });
      doc.text(`Gerado em: ${format(new Date(), "dd/MM/yyyy HH:mm", { locale: ptBR })}`, 105, 42, { align: 'center' });

      doc.setFontSize(14);
      doc.setTextColor(0);
      doc.text('Resumo por Método de Pagamento', 20, 55);
      doc.setFontSize(11);
      let yPos = 65;
      doc.text(`PIX: R$ ${totals.pixTotal.toFixed(2)}`, 25, yPos); yPos += 8;
      doc.text(`Dinheiro: R$ ${totals.cashTotal.toFixed(2)}`, 25, yPos); yPos += 8;
      doc.text(`Cartão: R$ ${totals.cardTotal.toFixed(2)}`, 25, yPos); yPos += 10;
      doc.setFontSize(12);
      doc.setTextColor(218, 165, 32);
      doc.text(`Total Recebido: R$ ${totals.received.toFixed(2)}`, 25, yPos);

      yPos += 20;
      doc.setFontSize(14);
      doc.setTextColor(0);
      doc.text('Detalhamento', 20, yPos);
      yPos += 10;
      doc.setFontSize(9);
      doc.setTextColor(100);
      doc.text('Data', 20, yPos);
      doc.text('Cliente', 45, yPos);
      doc.text('Serviço', 95, yPos);
      doc.text('Valor', 145, yPos);
      doc.text('Pagamento', 170, yPos);
      yPos += 5;
      doc.setDrawColor(200);
      doc.line(20, yPos, 190, yPos);
      doc.setTextColor(0);
      paidAppointments.slice(0, 30).forEach(a => {
        yPos += 7;
        if (yPos > 270) { doc.addPage(); yPos = 20; }
        const isSubscription = a.payment_method === 'subscription';
        const value = isSubscription ? 0 : getAdjustedValue(a.id, getServicesTotal(a.services, a.notes));
        const paymentLabel = a.payment_status === 'paid_pix' ? 'PIX' : a.payment_status === 'paid_cash' ? 'Dinheiro' : a.payment_status === 'paid_card' ? 'Cartão' : 'Pago';
        doc.text(format(parseISO(a.appointment_date), "dd/MM/yy"), 20, yPos);
        doc.text((a.profiles?.full_name || 'N/A').substring(0, 20), 45, yPos);
        doc.text(getServicesNames(a.services).substring(0, 25), 95, yPos);
        doc.text(`R$ ${value.toFixed(2)}`, 145, yPos);
        doc.text(paymentLabel, 170, yPos);
      });
      if (paidAppointments.length > 30) {
        yPos += 10;
        doc.setTextColor(100);
        doc.text(`... e mais ${paidAppointments.length - 30} transações`, 20, yPos);
      }
      doc.save(`relatorio-financeiro-${format(reportStartDate || new Date(), "yyyy-MM-dd")}.pdf`);
      toast.success("PDF exportado!");
    });
  };

  // Export Excel
  const exportExcel = () => {
    import('xlsx').then((XLSX) => {
      const paidAppointments = filteredReportAppointments.filter(a =>
        a.payment_status === 'paid_pix' || a.payment_status === 'paid_cash' || a.payment_status === 'paid_card' || a.payment_status === 'paid'
      );
      const periodLabel = reportStartDate && reportEndDate
        ? `${format(reportStartDate, "dd/MM/yyyy")} a ${format(reportEndDate, "dd/MM/yyyy")}`
        : 'Período selecionado';
      const summaryData = [
        ['Relatório Financeiro - Natan Barber'],
        [`Período: ${periodLabel}`],
        [`Gerado em: ${format(new Date(), "dd/MM/yyyy HH:mm", { locale: ptBR })}`],
        [],
        ['RESUMO POR MÉTODO'],
        ['PIX', `R$ ${totals.pixTotal.toFixed(2)}`],
        ['Dinheiro', `R$ ${totals.cashTotal.toFixed(2)}`],
        ['Cartão', `R$ ${totals.cardTotal.toFixed(2)}`],
        ['Total Recebido', `R$ ${totals.received.toFixed(2)}`],
        [],
        ['Aguardando Pagamento', `R$ ${totals.pendingTotal.toFixed(2)}`],
      ];
      const transactionsData = [
        ['Data', 'Horário', 'Cliente', 'Serviço', 'Valor Original', 'Valor Ajustado', 'Pagamento', 'Tipo'],
        ...paidAppointments.map(a => {
          const isSubscription = a.payment_method === 'subscription';
          const originalValue = isSubscription ? 0 : getServicesTotal(a.services, a.notes);
          const adjustedValue = isSubscription ? 0 : getAdjustedValue(a.id, originalValue);
          const paymentLabel = a.payment_status === 'paid_pix' ? 'PIX' : a.payment_status === 'paid_cash' ? 'Dinheiro' : a.payment_status === 'paid_card' ? 'Cartão' : 'Pago';
          return [
            format(parseISO(a.appointment_date), "dd/MM/yyyy"),
            a.appointment_time.slice(0, 5),
            a.profiles?.full_name || 'N/A',
            getServicesNames(a.services),
            `R$ ${originalValue.toFixed(2)}`,
            `R$ ${adjustedValue.toFixed(2)}`,
            paymentLabel,
            isSubscription ? 'Assinatura' : 'Avulso'
          ];
        })
      ];
      const wb = XLSX.utils.book_new();
      const wsSummary = XLSX.utils.aoa_to_sheet(summaryData);
      const wsTransactions = XLSX.utils.aoa_to_sheet(transactionsData);
      wsSummary['!cols'] = [{ wch: 25 }, { wch: 20 }];
      wsTransactions['!cols'] = [{ wch: 12 }, { wch: 8 }, { wch: 25 }, { wch: 30 }, { wch: 15 }, { wch: 15 }, { wch: 12 }, { wch: 12 }];
      XLSX.utils.book_append_sheet(wb, wsSummary, 'Resumo');
      XLSX.utils.book_append_sheet(wb, wsTransactions, 'Transações');
      XLSX.writeFile(wb, `relatorio-financeiro-${format(reportStartDate || new Date(), "yyyy-MM-dd")}.xlsx`);
      toast.success("Excel exportado!");
    });
  };

  const paidAppointments = filteredReportAppointments
    .filter(a => a.payment_status === 'paid_pix' || a.payment_status === 'paid_cash' || a.payment_status === 'paid_card' || a.payment_status === 'paid')
    .sort((a, b) => new Date(b.appointment_date).getTime() - new Date(a.appointment_date).getTime());

  const visibleTransactions = showAllTransactions ? paidAppointments : paidAppointments.slice(0, 10);
  const visibleSubscriptions = showAllSubscriptions ? filteredSubscriptionPayments : filteredSubscriptionPayments.slice(0, 8);

  return (
    <Card className="bg-card/80 backdrop-blur-xl border-primary/20">
      <CardHeader className="pb-3 space-y-4">
        {/* Title + Export + Closing Day */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-lg">
              <BarChart3 className="w-5 h-5 text-primary" />
              Resumo Financeiro
            </CardTitle>
            <div className="flex gap-1.5">
              <Button variant="outline" size="sm" onClick={exportPDF}
                className="h-8 px-2 border-red-500/30 hover:bg-red-500/10 text-red-400 text-xs">
                <Download className="w-3.5 h-3.5 mr-1" /> PDF
              </Button>
              <Button variant="outline" size="sm" onClick={exportExcel}
                className="h-8 px-2 border-green-500/30 hover:bg-green-500/10 text-green-400 text-xs">
                <Download className="w-3.5 h-3.5 mr-1" /> Excel
              </Button>
            </div>
          </div>
          {/* Closing Day Config - inline below exports */}
          <div className="flex items-center justify-between bg-muted/30 rounded-lg px-3 py-2">
            <p className="text-xs text-muted-foreground flex items-center gap-1.5">
              <CalendarIcon className="w-3.5 h-3.5" />
              Fechamento: <span className="font-semibold text-foreground">dia {cashClosingDay}</span>
            </p>
            {editingClosingDay ? (
              <div className="flex items-center gap-1">
                <Input type="number" min={1} max={28} value={closingDayInput}
                  onChange={(e) => setClosingDayInput(e.target.value)}
                  className="w-14 h-7 text-xs text-center" />
                <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-green-500"
                  onClick={() => { saveCashClosingDay(parseInt(closingDayInput)); setEditingClosingDay(false); }}>
                  <Save className="w-3.5 h-3.5" />
                </Button>
                <Button size="sm" variant="ghost" className="h-7 w-7 p-0"
                  onClick={() => setEditingClosingDay(false)}>
                  <XCircle className="w-3.5 h-3.5" />
                </Button>
              </div>
            ) : (
              <Button variant="ghost" size="sm" className="h-7 text-xs px-2"
                onClick={() => { setEditingClosingDay(true); setClosingDayInput(cashClosingDay.toString()); }}>
                <Pencil className="w-3 h-3 mr-1" /> Alterar
              </Button>
            )}
          </div>
        </div>

        {/* Quick Filters - Scrollable on mobile */}
        <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-hide">
          {[
            { key: "hoje", label: "Hoje" },
            { key: "7dias", label: "7 dias" },
            { key: "30dias", label: "30 dias" },
            { key: "fechamento", label: `Fech. (dia ${cashClosingDay})` },
            { key: "todo", label: "Todo Período" },
          ].map(f => (
            <Button
              key={f.key}
              variant={activeQuickFilter === f.key ? "default" : "outline"}
              size="sm"
              className={cn(
                "h-8 text-xs px-3 whitespace-nowrap rounded-full flex-shrink-0 transition-all",
                activeQuickFilter === f.key
                  ? "bg-primary text-primary-foreground shadow-md"
                  : "border-border/50 hover:border-primary/40"
              )}
              onClick={() => applyQuickFilter(f.key)}
            >
              {f.label}
            </Button>
          ))}
        </div>

        {/* Date Range Picker - Compact on mobile */}
        <div className="flex items-center gap-2 flex-wrap">
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="h-8 text-xs border-primary/20 bg-card/60 gap-1.5 rounded-lg">
                <CalendarIcon className="w-3.5 h-3.5" />
                {reportStartDate ? format(reportStartDate, "dd/MM/yy") : "Início"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0 z-[100] bg-card border border-primary/20" align="start">
              <Calendar mode="single" selected={reportStartDate} onSelect={(d) => { setReportStartDate(d); setActiveQuickFilter(""); }} initialFocus locale={ptBR} className="p-3 pointer-events-auto" />
            </PopoverContent>
          </Popover>
          <span className="text-xs text-muted-foreground">até</span>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="h-8 text-xs border-primary/20 bg-card/60 gap-1.5 rounded-lg">
                <CalendarIcon className="w-3.5 h-3.5" />
                {reportEndDate ? format(reportEndDate, "dd/MM/yy") : "Fim"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0 z-[100] bg-card border border-primary/20" align="start">
              <Calendar mode="single" selected={reportEndDate} onSelect={(d) => { setReportEndDate(d); setActiveQuickFilter(""); }} initialFocus locale={ptBR} className="p-3 pointer-events-auto" />
            </PopoverContent>
          </Popover>
          <Badge variant="secondary" className="text-[10px] ml-auto">
            {filteredReportAppointments.length} agend.
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-5">
        {/* ========== GRAND TOTAL HERO ========== */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary/20 via-primary/10 to-transparent border border-primary/30 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground mb-0.5 flex items-center gap-1.5">
                <TrendingUp className="w-3.5 h-3.5" /> Total Geral Recebido
              </p>
              <p className="text-3xl sm:text-4xl font-black text-primary tracking-tight">
                R$ {grandTotal.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
              </p>
              <p className="text-[11px] text-muted-foreground mt-1">
                Atendimentos R$ {totals.received.toFixed(0)} + Assinaturas R$ {totals.packageTotal.toFixed(0)}
              </p>
            </div>
            <div className="w-16 h-16 rounded-2xl bg-primary/20 flex items-center justify-center">
              <Wallet className="w-8 h-8 text-primary" />
            </div>
          </div>
        </div>

        {/* ========== PAYMENT METHOD CARDS - 2x2 grid mobile ========== */}
        <div className="grid grid-cols-2 gap-2.5">
          {/* PIX */}
          <div className="rounded-xl bg-[#00D4AA]/8 border border-[#00D4AA]/25 p-3">
            <div className="flex items-center gap-2 mb-1.5">
              <div className="w-8 h-8 rounded-lg bg-[#00D4AA]/15 flex items-center justify-center">
                <img src={pixIcon} alt="PIX" className="w-5 h-5 object-contain" />
              </div>
              <span className="text-xs font-medium text-muted-foreground">PIX</span>
            </div>
            <p className="text-xl font-bold text-[#00D4AA]">
              R$ {totals.pixTotal.toLocaleString('pt-BR', { minimumFractionDigits: 0 })}
            </p>
            {totals.received > 0 && (
              <div className="mt-1.5 h-1.5 bg-muted/40 rounded-full overflow-hidden">
                <div className="h-full bg-[#00D4AA] rounded-full transition-all duration-700"
                  style={{ width: `${(totals.pixTotal / totals.received) * 100}%` }} />
              </div>
            )}
            <p className="text-[10px] text-muted-foreground mt-1">
              {totals.received > 0 ? `${Math.round((totals.pixTotal / totals.received) * 100)}%` : '0%'}
            </p>
          </div>

          {/* Dinheiro */}
          <div className="rounded-xl bg-green-500/8 border border-green-500/25 p-3">
            <div className="flex items-center gap-2 mb-1.5">
              <div className="w-8 h-8 rounded-lg bg-green-500/15 flex items-center justify-center">
                <Banknote className="w-5 h-5 text-green-500" />
              </div>
              <span className="text-xs font-medium text-muted-foreground">Dinheiro</span>
            </div>
            <p className="text-xl font-bold text-green-500">
              R$ {totals.cashTotal.toLocaleString('pt-BR', { minimumFractionDigits: 0 })}
            </p>
            {totals.received > 0 && (
              <div className="mt-1.5 h-1.5 bg-muted/40 rounded-full overflow-hidden">
                <div className="h-full bg-green-500 rounded-full transition-all duration-700"
                  style={{ width: `${(totals.cashTotal / totals.received) * 100}%` }} />
              </div>
            )}
            <p className="text-[10px] text-muted-foreground mt-1">
              {totals.received > 0 ? `${Math.round((totals.cashTotal / totals.received) * 100)}%` : '0%'}
            </p>
          </div>

          {/* Cartão */}
          <div className="rounded-xl bg-blue-500/8 border border-blue-500/25 p-3">
            <div className="flex items-center gap-2 mb-1.5">
              <div className="w-8 h-8 rounded-lg bg-blue-500/15 flex items-center justify-center">
                <CreditCard className="w-5 h-5 text-blue-500" />
              </div>
              <span className="text-xs font-medium text-muted-foreground">Cartão</span>
            </div>
            <p className="text-xl font-bold text-blue-500">
              R$ {totals.cardTotal.toLocaleString('pt-BR', { minimumFractionDigits: 0 })}
            </p>
            {totals.received > 0 && (
              <div className="mt-1.5 h-1.5 bg-muted/40 rounded-full overflow-hidden">
                <div className="h-full bg-blue-500 rounded-full transition-all duration-700"
                  style={{ width: `${(totals.cardTotal / totals.received) * 100}%` }} />
              </div>
            )}
            <p className="text-[10px] text-muted-foreground mt-1">
              {totals.received > 0 ? `${Math.round((totals.cardTotal / totals.received) * 100)}%` : '0%'}
            </p>
          </div>

          {/* Aguardando */}
          <div className="rounded-xl bg-yellow-500/8 border border-yellow-500/25 p-3">
            <div className="flex items-center gap-2 mb-1.5">
              <div className="w-8 h-8 rounded-lg bg-yellow-500/15 flex items-center justify-center">
                <Clock className="w-5 h-5 text-yellow-500" />
              </div>
              <span className="text-xs font-medium text-muted-foreground">Aguardando</span>
            </div>
            <p className="text-xl font-bold text-yellow-500">
              R$ {totals.pendingTotal.toLocaleString('pt-BR', { minimumFractionDigits: 0 })}
            </p>
            <p className="text-[10px] text-muted-foreground mt-2.5">
              {filteredReportAppointments.filter(a => a.payment_status === 'pending' && a.status !== 'cancelled' && a.payment_method !== 'subscription').length} pedido(s)
            </p>
          </div>
        </div>

        {/* ========== CHARTS - Collapsible ========== */}
        <button
          onClick={() => setShowCharts(!showCharts)}
          className="flex items-center justify-between w-full text-sm text-muted-foreground hover:text-foreground transition-colors py-1"
        >
          <span className="flex items-center gap-2 font-medium">
            <BarChart3 className="w-4 h-4" /> Gráficos
          </span>
          {showCharts ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>

        {showCharts && totals.received > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Donut Chart */}
            <Card className="bg-card/60 border-border/40">
              <CardContent className="p-4">
                <p className="text-xs font-medium text-muted-foreground mb-3">Distribuição por Método</p>
                {(() => {
                  const total = totals.received;
                  if (total === 0) return null;
                  const pixPercent = Math.round((totals.pixTotal / total) * 100);
                  const cashPercent = Math.round((totals.cashTotal / total) * 100);
                  const cardPercent = 100 - pixPercent - cashPercent;
                  return (
                    <div className="flex items-center gap-5">
                      <div className="relative w-24 h-24 sm:w-28 sm:h-28 flex-shrink-0">
                        <svg viewBox="0 0 36 36" className="w-full h-full -rotate-90">
                          <circle cx="18" cy="18" r="15.915" fill="transparent" stroke="hsl(142, 76%, 36%)" strokeWidth="3.5"
                            strokeDasharray={`${cashPercent} ${100 - cashPercent}`} strokeDashoffset="0" />
                          <circle cx="18" cy="18" r="15.915" fill="transparent" stroke="hsl(217, 91%, 60%)" strokeWidth="3.5"
                            strokeDasharray={`${cardPercent} ${100 - cardPercent}`} strokeDashoffset={`-${cashPercent}`} />
                          <circle cx="18" cy="18" r="15.915" fill="transparent" stroke="hsl(166, 100%, 42%)" strokeWidth="3.5"
                            strokeDasharray={`${pixPercent} ${100 - pixPercent}`} strokeDashoffset={`-${cashPercent + cardPercent}`} />
                        </svg>
                        <div className="absolute inset-0 flex flex-col items-center justify-center">
                          <p className="text-base font-bold text-foreground">R$ {total.toFixed(0)}</p>
                          <p className="text-[9px] text-muted-foreground">Recebido</p>
                        </div>
                      </div>
                      <div className="flex flex-col gap-2.5 text-xs">
                        <div className="flex items-center gap-2">
                          <div className="w-2.5 h-2.5 rounded-full bg-[#00D4AA]" />
                          <span>PIX <span className="text-muted-foreground">({pixPercent}%)</span></span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="w-2.5 h-2.5 rounded-full bg-green-500" />
                          <span>Dinheiro <span className="text-muted-foreground">({cashPercent}%)</span></span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="w-2.5 h-2.5 rounded-full bg-blue-500" />
                          <span>Cartão <span className="text-muted-foreground">({cardPercent}%)</span></span>
                        </div>
                      </div>
                    </div>
                  );
                })()}
              </CardContent>
            </Card>

            {/* Bar Chart */}
            <Card className="bg-card/60 border-border/40">
              <CardContent className="p-4">
                <p className="text-xs font-medium text-muted-foreground mb-3">Comparativo</p>
                {(() => {
                  const maxValue = Math.max(totals.pixTotal, totals.cashTotal, totals.cardTotal, totals.pendingTotal, 1);
                  const bars = [
                    { label: "PIX", value: totals.pixTotal, color: "bg-[#00D4AA]", icon: <img src={pixIcon} alt="" className="w-3.5 h-3.5" /> },
                    { label: "Dinheiro", value: totals.cashTotal, color: "bg-green-500", icon: <Banknote className="w-3.5 h-3.5 text-green-500" /> },
                    { label: "Cartão", value: totals.cardTotal, color: "bg-blue-500", icon: <CreditCard className="w-3.5 h-3.5 text-blue-500" /> },
                    { label: "Aguardando", value: totals.pendingTotal, color: "bg-yellow-500", icon: <Clock className="w-3.5 h-3.5 text-yellow-500" /> },
                  ];
                  return (
                    <div className="space-y-3">
                      {bars.map(b => (
                        <div key={b.label}>
                          <div className="flex justify-between text-xs mb-1">
                            <span className="flex items-center gap-1.5">{b.icon} {b.label}</span>
                            <span className="font-semibold">R$ {b.value.toFixed(0)}</span>
                          </div>
                          <div className="h-3 bg-muted/40 rounded-full overflow-hidden">
                            <div className={cn("h-full rounded-full transition-all duration-700", b.color)}
                              style={{ width: `${(b.value / maxValue) * 100}%` }} />
                          </div>
                        </div>
                      ))}
                    </div>
                  );
                })()}
              </CardContent>
            </Card>
          </div>
        )}

        {/* ========== TRANSACTIONS LIST ========== */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <Wallet className="w-4 h-4 text-primary" />
              Pagamentos Recebidos
            </h4>
            <Badge variant="secondary" className="text-[10px]">
              {paidAppointments.length} total
            </Badge>
          </div>

          {paidAppointments.length === 0 ? (
            <div className="text-center text-muted-foreground py-8 text-sm">
              Nenhum pagamento no período
            </div>
          ) : (
            <div className="space-y-1.5">
              {visibleTransactions.map((appointment) => {
                const isSubscription = appointment.payment_method === 'subscription';
                const originalValue = isSubscription ? 0 : getServicesTotal(appointment.services, appointment.notes);
                const adjustedValue = isSubscription ? 0 : getAdjustedValue(appointment.id, originalValue);
                const hasAdjustment = revenueAdjustments.some(adj => adj.appointment_id === appointment.id);
                const isEditing = editingAppointmentId === appointment.id;

                return (
                  <div key={appointment.id}
                    className="flex items-center gap-3 p-2.5 rounded-xl bg-card/60 border border-border/40 hover:border-primary/30 transition-colors">
                    {/* Icon */}
                    <div className={cn(
                      "w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0",
                      appointment.payment_status === 'paid_pix' ? "bg-[#00D4AA]/15" :
                      appointment.payment_status === 'paid_card' ? "bg-blue-500/15" : "bg-green-500/15"
                    )}>
                      {appointment.payment_status === 'paid_pix' ? (
                        <img src={pixIcon} alt="PIX" className="w-4.5 h-4.5 object-contain" />
                      ) : appointment.payment_status === 'paid_card' ? (
                        <CreditCard className="w-4 h-4 text-blue-500" />
                      ) : (
                        <Banknote className="w-4 h-4 text-green-500" />
                      )}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{appointment.profiles?.full_name || 'Cliente'}</p>
                      <p className="text-[11px] text-muted-foreground truncate">
                        {format(parseISO(appointment.appointment_date), "dd/MM")} • {getServicesNames(appointment.services)}
                      </p>
                    </div>

                    {/* Value */}
                    <div className="text-right flex-shrink-0">
                      {isEditing ? (
                        <div className="flex items-center gap-1">
                          <span className="text-[10px] text-muted-foreground">R$</span>
                          <Input type="number" step="0.01" value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            className="w-16 h-7 text-xs text-right" autoFocus />
                          <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-green-500"
                            onClick={() => {
                              const newValue = parseFloat(editValue);
                              if (!isNaN(newValue) && newValue >= 0) {
                                saveRevenueAdjustment(appointment.id, originalValue, newValue);
                              } else { toast.error("Valor inválido"); }
                            }}>
                            <Save className="w-3.5 h-3.5" />
                          </Button>
                          <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-muted-foreground"
                            onClick={() => { setEditingAppointmentId(null); setEditValue(""); }}>
                            <XCircle className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      ) : (
                        <button
                          onClick={() => { setEditingAppointmentId(appointment.id); setEditValue(adjustedValue.toFixed(2)); }}
                          className="group"
                        >
                          <p className={cn(
                            "text-sm font-bold",
                            appointment.payment_status === 'paid_pix' ? "text-[#00D4AA]" :
                            appointment.payment_status === 'paid_card' ? "text-blue-500" : "text-green-500"
                          )}>
                            R$ {adjustedValue.toFixed(2)}
                            <Pencil className="w-2.5 h-2.5 inline ml-1 opacity-0 group-hover:opacity-60 transition-opacity" />
                          </p>
                          {hasAdjustment && originalValue !== adjustedValue && (
                            <p className="text-[9px] text-muted-foreground line-through">R$ {originalValue.toFixed(2)}</p>
                          )}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}

              {paidAppointments.length > 10 && (
                <Button variant="ghost" size="sm" className="w-full text-xs text-muted-foreground mt-1"
                  onClick={() => setShowAllTransactions(!showAllTransactions)}>
                  {showAllTransactions
                    ? <><ChevronUp className="w-3.5 h-3.5 mr-1" /> Mostrar menos</>
                    : <><ChevronDown className="w-3.5 h-3.5 mr-1" /> Ver todos ({paidAppointments.length})</>}
                </Button>
              )}
            </div>
          )}
        </div>

        {/* ========== SUBSCRIPTION PAYMENTS ========== */}
        <div className="border-t border-border/40 pt-5">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <Crown className="w-4 h-4 text-amber-500" />
              Assinaturas & Pacotes
            </h4>
            <Badge variant="secondary" className="text-[10px] bg-amber-500/10 text-amber-500 border-amber-500/30">
              {filteredSubscriptionPayments.length} pagamento(s)
            </Badge>
          </div>

          {/* Subscription Total Hero */}
          {totals.filteredPP.length > 0 && (
            <div className="rounded-xl bg-gradient-to-r from-amber-500/15 to-amber-600/5 border border-amber-500/25 p-3.5 mb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <Crown className="w-5 h-5 text-amber-500" />
                  <div>
                    <p className="text-xs text-muted-foreground">Total Assinaturas</p>
                    <p className="text-xl font-bold text-amber-500">
                      R$ {subscriptionTotalFiltered.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-[10px] text-muted-foreground">{filteredSubscriptionPayments.length} de {totals.filteredPP.length}</p>
                </div>
              </div>
            </div>
          )}

          {/* Subscription Filters */}
          <div className="flex flex-wrap gap-2 mb-3">
            <div className="relative flex-1 min-w-[140px]">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <Input
                placeholder="Buscar cliente..."
                value={subscriptionSearch}
                onChange={(e) => setSubscriptionSearch(e.target.value)}
                className="h-8 text-xs pl-8 bg-card/60"
              />
            </div>
            <Select value={subscriptionPaymentFilter} onValueChange={setSubscriptionPaymentFilter}>
              <SelectTrigger className="h-8 text-xs w-auto min-w-[90px] bg-card/60">
                <SelectValue placeholder="Método" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="pix">PIX</SelectItem>
                <SelectItem value="dinheiro">Dinheiro</SelectItem>
                <SelectItem value="cartao">Cartão</SelectItem>
              </SelectContent>
            </Select>
            <Select value={subscriptionStatusFilter} onValueChange={setSubscriptionStatusFilter}>
              <SelectTrigger className="h-8 text-xs w-auto min-w-[100px] bg-card/60">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="pending">Pendente</SelectItem>
                <SelectItem value="confirmed">Confirmado</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Subscription List */}
          {filteredSubscriptionPayments.length === 0 ? (
            <div className="text-center text-muted-foreground py-6 text-sm">
              Nenhum pagamento de assinatura encontrado
            </div>
          ) : (
            <div className="space-y-1.5">
              {visibleSubscriptions.map((payment) => {
                const isPending = payment.payment_status === "pending";
                return (
                  <div key={payment.id}
                    className={cn(
                      "flex items-center gap-3 p-2.5 rounded-xl border transition-colors group",
                      isPending
                        ? "bg-yellow-500/5 border-yellow-500/20"
                        : "bg-card/60 border-amber-500/20 hover:border-amber-500/40"
                    )}>
                    <div className={cn(
                      "w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0",
                      isPending ? "bg-yellow-500/15" : "bg-amber-500/15"
                    )}>
                      <Crown className={cn("w-4 h-4", isPending ? "text-yellow-500" : "text-amber-500")} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{payment.profiles?.full_name || 'Cliente'}</p>
                      <p className="text-[11px] text-muted-foreground truncate">
                        {payment.package_name} • {format(parseISO(payment.payment_date), "dd/MM/yy")}
                        {payment.notes && ` • ${payment.notes}`}
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      <div className="text-right">
                        <p className={cn("text-sm font-bold", isPending ? "text-yellow-500" : "text-amber-500")}>
                          R$ {payment.amount.toFixed(2)}
                        </p>
                        <div className="flex items-center gap-1 justify-end">
                          {isPending && (
                            <Badge variant="outline" className="text-[9px] border-yellow-500/30 text-yellow-500 px-1 py-0">
                              Pendente
                            </Badge>
                          )}
                          <Badge variant="outline" className={cn(
                            "text-[9px] px-1 py-0",
                            payment.payment_method === 'pix' ? "border-[#00D4AA]/30 text-[#00D4AA]" :
                            payment.payment_method === 'cartao' ? "border-blue-500/30 text-blue-500" :
                            "border-green-500/30 text-green-500"
                          )}>
                            {payment.payment_method === 'cartao' ? 'Cartão' : payment.payment_method === 'dinheiro' ? 'Dinheiro' : 'PIX'}
                          </Badge>
                        </div>
                      </div>
                      <Button variant="ghost" size="sm"
                        className="h-7 w-7 p-0 opacity-0 group-hover:opacity-100 sm:opacity-100 text-destructive hover:bg-destructive/10"
                        onClick={() => deletePackagePayment(payment.id, payment.package_name)}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                );
              })}

              {filteredSubscriptionPayments.length > 8 && (
                <Button variant="ghost" size="sm" className="w-full text-xs text-muted-foreground mt-1"
                  onClick={() => setShowAllSubscriptions(!showAllSubscriptions)}>
                  {showAllSubscriptions
                    ? <><ChevronUp className="w-3.5 h-3.5 mr-1" /> Mostrar menos</>
                    : <><ChevronDown className="w-3.5 h-3.5 mr-1" /> Ver todos ({filteredSubscriptionPayments.length})</>}
                </Button>
              )}
            </div>
          )}
        </div>

      </CardContent>
    </Card>
  );
};

export default FinancialReport;
