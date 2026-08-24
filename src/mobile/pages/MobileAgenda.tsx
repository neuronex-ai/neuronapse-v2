import { NewAppointmentModal } from "@/components/agenda/NewAppointmentModal";
import { AppointmentDetailModal } from "@/components/agenda/AppointmentDetailModal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAppointments } from "@/hooks/use-appointments";
import { useAppointmentsByDateRange } from "@/hooks/use-appointments-by-date-range";
import { getAppointmentStatusMeta, isCancelledAppointmentStatus } from "@/lib/appointment-status";
import { cn } from "@/lib/utils";
import {
  addDays,
  addMonths, endOfDay, endOfMonth, format, getDay,
  getDaysInMonth, isSameDay, isSameMonth,
  isToday as isDateToday, startOfDay,
  startOfMonth, startOfWeek, subMonths
} from "date-fns";
import { ptBR } from "date-fns/locale";
import { animate, AnimatePresence, motion, PanInfo, useMotionValue, useTransform } from "framer-motion";
import {
  ArrowRight, Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight, Grid3X3, List, MapPin, MoreHorizontal, Plus, Search, Video, X
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { MobileLayout } from "../components/MobileLayout";

type ViewMode = "week" | "month";
type MobileAgendaAppointment = {
  id: string;
  type?: string | null;
  start_time: string | Date;
  end_time: string | Date;
  status?: string | null;
  notes?: string | null;
  patient_name?: string | null;
  patient_id?: string | null;
};

// Sheet snap points (from bottom of viewport)
const SHEET_HALF = 0.52; // 52% of viewport
const SHEET_FULL = 0.92; // 92% of viewport (near full-screen)

export const MobileAgenda = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [weekOffset, setWeekOffset] = useState(0);
  const [viewMode, setViewMode] = useState<ViewMode>("week");
  const [calendarMonth, setCalendarMonth] = useState(new Date());
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [openedAppointmentId, setOpenedAppointmentId] = useState<string | null>(null);

  // Bottom sheet state
  const [sheetOpen, setSheetOpen] = useState(false);
  const [sheetSnapFraction, setSheetSnapFraction] = useState(SHEET_HALF);
  const sheetY = useMotionValue(0);
  const sheetRef = useRef<HTMLDivElement>(null);

  // Week view data
  const weekStart = startOfWeek(addDays(new Date(), weekOffset * 7), { weekStartsOn: 0 });
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  // For week view: fetch appointments for selected date only
  const { data: dayAppointments, isLoading: isLoadingDay } = useAppointmentsByDateRange(
    startOfDay(selectedDate),
    endOfDay(selectedDate)
  );

  // For month view: fetch entire month of appointments
  const monthStart = startOfMonth(calendarMonth);
  const monthEnd = endOfMonth(calendarMonth);
  const { data: monthAppointments, isLoading: isLoadingMonth } = useAppointmentsByDateRange(
    startOfDay(monthStart),
    endOfDay(monthEnd)
  );
  const { data: allAppointments = [] } = useAppointments({ includeCancelled: true });

  // Current view data
  const appointments = dayAppointments;
  const isLoading = isLoadingDay;

  const filteredAppointments = useMemo(() => {
    let result = appointments
      ?.filter((apt) => !isCancelledAppointmentStatus(apt.status, apt.notes) && apt.type !== "block")
      .sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime()) || [];

    if (searchTerm) {
      const lower = searchTerm.toLowerCase();
      result = result.filter(
        (apt) =>
          apt.patient_name?.toLowerCase().includes(lower) ||
          apt.notes?.toLowerCase().includes(lower)
      );
    }
    return result;
  }, [appointments, searchTerm]);

  useEffect(() => {
    const stateAppointmentId = location.state?.openAppointmentId;
    const queryAppointmentId = searchParams.get("appointmentId");
    const targetId = stateAppointmentId || queryAppointmentId;
    if (targetId) setOpenedAppointmentId(targetId);
  }, [location.state, searchParams]);

  const openedAppointment = useMemo(
    () => allAppointments.find((appointment) => appointment.id === openedAppointmentId),
    [allAppointments, openedAppointmentId]
  );

  useEffect(() => {
    if (openedAppointment) {
      setSelectedDate(new Date(openedAppointment.start_time));
      setCalendarMonth(new Date(openedAppointment.start_time));
    }
  }, [openedAppointment]);

  const closeOpenedAppointment = () => {
    setOpenedAppointmentId(null);
    if (searchParams.has("appointmentId")) {
      const nextParams = new URLSearchParams(searchParams);
      nextParams.delete("appointmentId");
      setSearchParams(nextParams, { replace: true });
    }
    if (location.state?.openAppointmentId) {
      window.history.replaceState({}, document.title, window.location.href);
    }
  };

  // Appointments for the selected day in the bottom sheet (month view)
  const sheetAppointments = useMemo(() => {
    if (!monthAppointments) return [];
    return monthAppointments
      .filter(
        (apt) =>
          isSameDay(new Date(apt.start_time), selectedDate) &&
          !isCancelledAppointmentStatus(apt.status, apt.notes) &&
          apt.type !== "block"
      )
      .sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime());
  }, [monthAppointments, selectedDate]);

  // Count appointments per day for calendar dots
  const appointmentsByDay = useMemo(() => {
    if (!monthAppointments) return {};
    const map: Record<string, number> = {};
    monthAppointments
      .filter((apt) => !isCancelledAppointmentStatus(apt.status, apt.notes) && apt.type !== "block")
      .forEach((apt) => {
        const key = format(new Date(apt.start_time), "yyyy-MM-dd");
        map[key] = (map[key] || 0) + 1;
      });
    return map;
  }, [monthAppointments]);

  // Calendar grid generation
  const calendarDays = useMemo(() => {
    const firstDay = startOfMonth(calendarMonth);
    const daysInMonth = getDaysInMonth(calendarMonth);
    const startDow = getDay(firstDay); // 0 = Sunday

    const days: (Date | null)[] = [];
    for (let i = 0; i < startDow; i++) {
      days.push(null);
    }
    for (let d = 1; d <= daysInMonth; d++) {
      days.push(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth(), d));
    }
    return days;
  }, [calendarMonth]);

  // Navigation
  const handlePrevWeek = () => setWeekOffset((prev) => prev - 1);
  const handleNextWeek = () => setWeekOffset((prev) => prev + 1);
  const handleToday = () => {
    setWeekOffset(0);
    setSelectedDate(new Date());
    setCalendarMonth(new Date());
  };
  const handlePrevMonth = () => setCalendarMonth((prev) => subMonths(prev, 1));
  const handleNextMonth = () => setCalendarMonth((prev) => addMonths(prev, 1));

  const getInitials = (name: string) => name.substring(0, 2).toUpperCase();

  // Calendar day tap handler
  const handleCalendarDayTap = (day: Date) => {
    setSelectedDate(day);
    setSheetSnapFraction(SHEET_HALF);
    setSheetOpen(true);
    // Reset drag position
    sheetY.set(0);
  };

  // Dismiss sheet
  const dismissSheet = () => {
    setSheetOpen(false);
    setSheetSnapFraction(SHEET_HALF);
  };

  // Sheet drag handling — smooth snapping
  const handleSheetDragEnd = (_: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    const { velocity, offset } = info;


    // Actual displacement in px; negative = dragged up, positive = dragged down
    const displacement = offset.y;

    // If dragged down significantly or flicked down fast †’ dismiss
    if (displacement > 100 || velocity.y > 500) {
      dismissSheet();
      return;
    }

    // If dragged up or flicked up †’ expand to full
    if (displacement < -60 || velocity.y < -400) {
      setSheetSnapFraction(SHEET_FULL);
      animate(sheetY, 0, { type: "spring", stiffness: 300, damping: 32 });
      return;
    }

    // Otherwise snap back to current position
    animate(sheetY, 0, { type: "spring", stiffness: 400, damping: 35 });
  };

  // Backdrop opacity derived from sheet drag
  const backdropOpacity = useTransform(
    sheetY,
    [0, 300],
    [1, 0.2]
  );

  // Shared appointment card renderer
  const renderAppointmentCard = (apt: MobileAgendaAppointment, i: number, compact = false) => {
    const isPast = new Date(apt.end_time) < new Date();
    const isOngoing = new Date(apt.start_time) <= new Date() && new Date(apt.end_time) > new Date();
    const statusMeta = getAppointmentStatusMeta(apt.status, apt.notes);

    return (
      <motion.div
        key={apt.id}
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: i * 0.05, type: "spring", stiffness: 300, damping: 28 }}
        onClick={() => {
          if (apt.type === "online" && !isPast) {
            navigate("/teleconsulta", { state: { activeAppointmentId: apt.id } });
          } else if (apt.patient_id) {
            navigate(`/pacientes/${apt.patient_id}`);
          }
        }}
        className={cn(
          "group relative border transition-all duration-300 active:scale-[0.98]",
          compact ? "p-4 rounded-2xl" : "p-5 rounded-[28px]",
          isPast
            ? "bg-transparent border-transparent opacity-40 grayscale bg-secondary/10"
            : isOngoing
              ? "bg-card border-primary/50 shadow-lg shadow-primary/5"
              : "bg-card border-border/50 hover:bg-secondary/20 shadow-sm"
        )}
      >
        {/* Status Badge */}
        {isOngoing && (
          <div
            className={cn(
              "absolute right-4 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 backdrop-blur-md",
              compact ? "top-4" : "top-5"
            )}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_8px_rgba(52,211,153,0.8)]" />
            <span className="text-[9px] font-black uppercase tracking-widest text-emerald-600 dark:text-emerald-400">
              Ao Vivo
            </span>
          </div>
        )}

        <div className="flex gap-4">
          {/* Time Column */}
          <div className="flex flex-col items-center pt-0.5 shrink-0">
            <span
              className={cn(
                "font-black tracking-tighter leading-none",
                compact ? "text-base" : "text-lg",
                isOngoing ? "text-primary" : "text-foreground"
              )}
            >
              {format(new Date(apt.start_time), "HH:mm")}
            </span>
            <div
              className={cn(
                "w-px flex-1 my-2",
                isOngoing ? "bg-gradient-to-b from-primary/50 to-transparent" : "bg-border/50"
              )}
            />
            <span className="text-[10px] font-bold text-muted-foreground">
              {format(new Date(apt.end_time), "HH:mm")}
            </span>
          </div>

          {/* Content Column */}
          <div className="flex-1 min-w-0 pt-0.5">
            <h3
              className={cn(
                "font-bold text-foreground truncate tracking-tight",
                compact ? "text-base mb-2" : "text-lg mb-2.5"
              )}
            >
              {apt.patient_name || "Paciente s/ nome"}
            </h3>

            <div className="flex flex-wrap gap-1.5 mb-3">
              <span
                className={cn(
                  "flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg text-[9px] font-bold uppercase tracking-wider border backdrop-blur-md",
                  apt.type === "online"
                    ? "bg-indigo-500/10 text-indigo-500 dark:text-indigo-300 border-indigo-500/20"
                    : "bg-orange-500/10 text-orange-500 dark:text-orange-300 border-orange-500/20"
                )}
              >
                {apt.type === "online" ? <Video className="w-3 h-3" /> : <MapPin className="w-3 h-3" />}
                {apt.type === "online" ? "Online" : "Presencial"}
              </span>
              <span className={cn("flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg border text-[9px] font-bold uppercase tracking-wider", statusMeta.softClassName, statusMeta.textClassName)}>
                <span className={cn("w-1.5 h-1.5 rounded-full", statusMeta.dotClassName)} />
                {statusMeta.label}
              </span>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-full bg-secondary/50 border border-border/20 flex items-center justify-center text-[9px] font-bold text-muted-foreground">
                  {getInitials(apt.patient_name || "PA")}
                </div>
                {apt.notes && (
                  <p className="text-[10px] text-muted-foreground truncate max-w-[100px]">
                    {apt.notes}
                  </p>
                )}
              </div>

              {isOngoing ? (
                <div className="flex items-center gap-1.5 text-primary group-hover:translate-x-1 transition-transform">
                  <span className="text-[9px] font-bold uppercase tracking-widest">Entrar</span>
                  <ArrowRight className="w-3 h-3" />
                </div>
              ) : (
                <div className="w-7 h-7 rounded-full flex items-center justify-center text-muted-foreground/50 group-hover:text-foreground group-hover:bg-secondary/50 transition-colors">
                  <MoreHorizontal className="w-4 h-4" />
                </div>
              )}
            </div>
          </div>
        </div>
      </motion.div>
    );
  };

  // Compute sheet height in vh
  const sheetHeightVh = `${sheetSnapFraction * 100}vh`;

  return (
    <MobileLayout className="px-0 min-h-screen bg-background text-foreground">
      <div className="pt-6 pb-32 flex flex-col min-h-screen">

        {/* ── Page Header: MacOS Floating Bar ── */}
        <div className="px-5 mb-6 relative z-40 w-full animate-fade-in">
          <div className="w-full h-[60px] flex items-center justify-between p-2 pl-4 pr-2 bg-zinc-900/90 backdrop-blur-2xl border border-white/10 rounded-full shadow-[0_8px_32px_rgba(0,0,0,0.3)] transition-all duration-300">
            {isSearchOpen ? (
              <div className="flex-1 flex items-center gap-2 animate-in fade-in zoom-in-95 duration-200 w-full">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
                  <Input
                    autoFocus
                    placeholder="Buscar paciente..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="h-9 pl-9 bg-white/5 border-transparent rounded-full text-zinc-100 placeholder:text-zinc-500 focus-visible:ring-0 text-sm"
                  />
                </div>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => {
                    setIsSearchOpen(false);
                    setSearchTerm("");
                  }}
                  className="h-9 w-9 rounded-full text-zinc-400 hover:bg-white/10 hover:text-white"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <>
                <div className="flex flex-col justify-center h-full -space-y-0.5">
                  <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest pl-0.5">
                    {format(selectedDate, "EEEE, d 'de' MMMM", { locale: ptBR })}
                  </span>
                  <h1 className="text-base font-bold text-zinc-100 tracking-tight leading-none">
                    Agenda
                  </h1>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => setIsSearchOpen(true)}
                    className="h-9 w-9 rounded-full bg-white/5 border border-white/5 text-zinc-400 hover:text-white hover:bg-white/10 active:scale-95 transition-all"
                  >
                    <Search className="w-4 h-4" />
                  </Button>
                  <NewAppointmentModal>
                    <Button
                      size="icon"
                      className="h-9 w-9 rounded-full bg-primary text-primary-foreground hover:bg-primary/90 shadow-lg active:scale-95 transition-all"
                    >
                      <Plus className="w-4 h-4" />
                    </Button>
                  </NewAppointmentModal>
                </div>
              </>
            )}
          </div>
        </div>

        {/* ── View Mode Toggle ── */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="mb-4 px-5"
        >
          <div className="flex items-center bg-card p-1 rounded-2xl border border-border/50 shadow-sm">
            <button
              onClick={() => {
                setViewMode("week");
                dismissSheet();
              }}
              className={cn(
                "flex-1 flex items-center justify-center gap-2 h-10 rounded-xl text-[10px] font-black uppercase tracking-[0.15em] transition-all duration-300 active:scale-95",
                viewMode === "week"
                  ? "bg-foreground text-background shadow-md"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <List className="w-3.5 h-3.5" />
              Semana
            </button>
            <button
              onClick={() => {
                setViewMode("month");
                setCalendarMonth(selectedDate);
              }}
              className={cn(
                "flex-1 flex items-center justify-center gap-2 h-10 rounded-xl text-[10px] font-black uppercase tracking-[0.15em] transition-all duration-300 active:scale-95",
                viewMode === "month"
                  ? "bg-foreground text-background shadow-md"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Grid3X3 className="w-3.5 h-3.5" />
              Mês
            </button>
          </div>
        </motion.div>

        {/* ── WEEK VIEW ── */}
        <AnimatePresence mode="wait">
          {viewMode === "week" && (
            <motion.div
              key="week-view"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.25 }}
              className="flex-1 flex flex-col"
            >
              {/* Week Navigation & Selector */}
              <div className="px-5 mb-5">
                <div className="space-y-3">
                  <div className="flex items-center justify-between bg-card p-1 rounded-2xl border border-border/50 shadow-sm">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={handlePrevWeek}
                      className="h-9 w-9 rounded-xl text-muted-foreground hover:text-foreground hover:bg-secondary/50 active:scale-95 transition-all"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      onClick={handleToday}
                      className="h-7 px-5 rounded-lg text-[9px] font-black uppercase tracking-[0.2em] text-muted-foreground hover:text-foreground hover:bg-secondary/50 active:scale-95 transition-all"
                    >
                      Hoje
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={handleNextWeek}
                      className="h-9 w-9 rounded-xl text-muted-foreground hover:text-foreground hover:bg-secondary/50 active:scale-95 transition-all"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </Button>
                  </div>

                  <div className="grid grid-cols-7 gap-1.5 pb-1">
                    {weekDays.map((day, i) => {
                      const isSelected = isSameDay(day, selectedDate);
                      const isToday = isSameDay(day, new Date());
                      return (
                        <motion.button
                          initial={{ opacity: 0, x: 16 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: 0.08 + i * 0.04 }}
                          key={day.toISOString()}
                          onClick={() => setSelectedDate(day)}
                          className={cn(
                            "min-h-[70px] min-w-0 rounded-[18px] px-1 py-2.5 flex flex-col items-center justify-center gap-1 transition-all duration-300 active:scale-95 relative overflow-hidden group border",
                            isSelected
                              ? "bg-primary text-primary-foreground shadow-lg shadow-primary/18 z-10 border-primary"
                              : isToday
                                ? "bg-secondary text-foreground border-border"
                                : "bg-transparent text-muted-foreground border-transparent hover:bg-secondary/30"
                          )}
                        >
                          <span
                            className={cn(
                              "text-[9px] font-black uppercase tracking-wider",
                              isSelected ? "text-primary-foreground/80" : "opacity-60"
                            )}
                          >
                            {format(day, "EEE", { locale: ptBR }).substring(0, 3)}
                          </span>
                          <span
                            className={cn(
                              "text-xl font-black tracking-tighter",
                              isSelected ? "text-primary-foreground" : ""
                            )}
                          >
                            {format(day, "d")}
                          </span>
                          {isSelected ? <div className="h-1 w-1 rounded-full bg-primary-foreground/45" /> : <div className="h-1 w-1" />}
                        </motion.button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Appointments List */}
              <div className="flex-1 px-5">
                <AnimatePresence mode="wait">
                  {isLoading ? (
                    <motion.div
                      key="loading"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="space-y-3"
                    >
                      {[...Array(3)].map((_, i) => (
                        <div key={i} className="h-28 rounded-[28px] bg-secondary/30 border border-border/10 animate-pulse" />
                      ))}
                    </motion.div>
                  ) : filteredAppointments.length === 0 ? (
                    <motion.div
                      key="empty"
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -20 }}
                      className="flex flex-col items-center justify-center py-10 text-center"
                    >
                      <div className="w-20 h-20 rounded-[28px] bg-gradient-to-tr from-secondary/50 to-transparent border border-border/10 flex items-center justify-center mb-6 shadow-xl relative overflow-hidden">
                        <CalendarIcon className="w-8 h-8 text-muted-foreground" />
                      </div>
                      <h3 className="text-lg font-bold text-foreground mb-1.5">Dia Livre</h3>
                      <p className="text-xs text-muted-foreground max-w-[200px] leading-relaxed mb-6">
                        Aproveite para organizar suas notas ou estudar novos casos.
                      </p>
                      <NewAppointmentModal>
                        <Button className="h-12 px-7 rounded-2xl bg-primary text-primary-foreground hover:bg-primary/90 font-bold text-[10px] uppercase tracking-[0.15em] transition-all shadow-lg active:scale-95">
                          <Plus className="w-4 h-4 mr-2" />
                          Novo Agendamento
                        </Button>
                      </NewAppointmentModal>
                    </motion.div>
                  ) : (
                    <motion.div key="appointments" className="space-y-3">
                      {filteredAppointments.map((apt, i) => renderAppointmentCard(apt, i))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </motion.div>
          )}

          {/* ── MONTH VIEW ── */}
          {viewMode === "month" && (
            <motion.div
              key="month-view"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ duration: 0.25 }}
              className="flex-1 flex flex-col"
            >
              {/* Month Navigation */}
              <div className="px-5 mb-4">
                <div className="flex items-center justify-between bg-card p-1 rounded-2xl border border-border/50 shadow-sm">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={handlePrevMonth}
                    className="h-9 w-9 rounded-xl text-muted-foreground hover:text-foreground hover:bg-secondary/50 active:scale-95 transition-all"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </Button>
                  <button
                    onClick={handleToday}
                    className="h-7 px-5 rounded-lg text-xs font-bold text-foreground tracking-tight capitalize hover:bg-secondary/50 active:scale-95 transition-all"
                  >
                    {format(calendarMonth, "MMMM yyyy", { locale: ptBR })}
                  </button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={handleNextMonth}
                    className="h-9 w-9 rounded-xl text-muted-foreground hover:text-foreground hover:bg-secondary/50 active:scale-95 transition-all"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
              </div>

              {/* Calendar Grid */}
              <div className="px-5">
                <div className="bg-card rounded-[28px] border border-border/50 shadow-sm p-4 overflow-hidden">
                  {/* Day of week headers */}
                  <div className="grid grid-cols-7 gap-1 mb-2">
                    {["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"].map((d) => (
                      <div key={d} className="text-center text-[9px] font-black uppercase tracking-wider text-muted-foreground/50 py-1.5">
                        {d}
                      </div>
                    ))}
                  </div>

                  {/* Calendar cells */}
                  <div className="grid grid-cols-7 gap-1">
                    {calendarDays.map((day, idx) => {
                      if (!day) {
                        return <div key={`empty-${idx}`} className="aspect-square" />;
                      }

                      const dateKey = format(day, "yyyy-MM-dd");
                      const count = appointmentsByDay[dateKey] || 0;
                      const isSelected = isSameDay(day, selectedDate) && sheetOpen;
                      const isToday = isDateToday(day);
                      const isCurrentMonth = isSameMonth(day, calendarMonth);

                      return (
                        <button
                          key={dateKey}
                          onClick={() => handleCalendarDayTap(day)}
                          className={cn(
                            "aspect-square rounded-2xl flex flex-col items-center justify-center gap-0.5 transition-all duration-200 active:scale-90 relative",
                            isSelected
                              ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20"
                              : isToday
                                ? "bg-secondary text-foreground ring-1 ring-primary/30"
                                : isCurrentMonth
                                  ? "text-foreground hover:bg-secondary/40"
                                  : "text-muted-foreground/30"
                          )}
                        >
                          <span
                            className={cn(
                              "text-sm font-bold tracking-tight leading-none",
                              isSelected && "text-primary-foreground"
                            )}
                          >
                            {format(day, "d")}
                          </span>

                          {/* Appointment indicators */}
                          {count > 0 && (
                            <div className="flex items-center gap-[3px]">
                              {Array.from({ length: Math.min(count, 3) }).map((_, i) => (
                                <div
                                  key={i}
                                  className={cn(
                                    "w-[4px] h-[4px] rounded-full",
                                    isSelected ? "bg-primary-foreground/60" : "bg-primary/60"
                                  )}
                                />
                              ))}
                            </div>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── BOTTOM SHEET (for month view day details) ── */}
        <AnimatePresence>
          {sheetOpen && viewMode === "month" && (
            <>
              {/* Backdrop */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 0.5 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.25 }}
                style={{ opacity: backdropOpacity }}
                onClick={dismissSheet}
                className="fixed inset-0 bg-black/60 backdrop-blur-[2px] z-[70]"
              />

              {/* Sheet Container €” uses height-based snap instead of transform for reliability */}
              <motion.div
                ref={sheetRef}
                initial={{ y: "100%" }}
                animate={{ y: "0%" }}
                exit={{ y: "100%" }}
                transition={{
                  type: "spring",
                  stiffness: 280,
                  damping: 30,
                  mass: 0.8,
                }}
                drag="y"
                dragConstraints={{ top: 0, bottom: 0 }}
                dragElastic={{ top: 0.04, bottom: 0.25 }}
                dragMomentum={true}
                dragTransition={{ bounceStiffness: 300, bounceDamping: 30 }}
                onDragEnd={handleSheetDragEnd}
                style={{
                  y: sheetY,
                  height: sheetHeightVh,
                }}
                className="fixed bottom-0 left-0 right-0 z-[80] bg-background rounded-t-[28px] shadow-[0_-8px_40px_rgba(0,0,0,0.25)] flex flex-col will-change-transform overflow-hidden transition-[height] duration-300 [transition-timing-function:cubic-bezier(0.32,0.72,0,1)]"
              >
                {/* Drag Handle Area €” generous touch target */}
                <div
                  className="flex justify-center pt-3 pb-1 cursor-grab active:cursor-grabbing touch-none select-none"
                >
                  <div className="w-9 h-[5px] rounded-full bg-muted-foreground/20" />
                </div>

                {/* Sheet Header */}
                <div className="px-5 pt-1 pb-3.5 flex items-center justify-between border-b border-border/10 shrink-0">
                  <div>
                    <h3 className="text-lg font-bold text-foreground tracking-tight capitalize leading-tight">
                      {format(selectedDate, "EEEE", { locale: ptBR })}
                    </h3>
                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.12em] mt-0.5">
                      {format(selectedDate, "d 'de' MMMM, yyyy", { locale: ptBR })}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="h-7 px-2.5 rounded-lg bg-secondary/50 border border-border/10 flex items-center gap-1.5">
                      <CalendarIcon className="w-3 h-3 text-muted-foreground" />
                      <span className="text-[10px] font-bold text-foreground">
                        {sheetAppointments.length} {sheetAppointments.length === 1 ? "consulta" : "consultas"}
                      </span>
                    </div>
                    <button
                      onClick={dismissSheet}
                      className="w-7 h-7 rounded-lg bg-secondary/50 border border-border/10 flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-secondary transition-all active:scale-90"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Sheet Scrollable Content */}
                <div className="flex-1 overflow-y-auto overscroll-contain px-5 pt-4 pb-10">
                  {isLoadingMonth ? (
                    <div className="space-y-3">
                      {[...Array(2)].map((_, i) => (
                        <div key={i} className="h-24 rounded-2xl bg-secondary/30 border border-border/10 animate-pulse" />
                      ))}
                    </div>
                  ) : sheetAppointments.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-8 text-center">
                      <div className="w-16 h-16 rounded-[24px] bg-secondary/20 border border-border/10 flex items-center justify-center mb-4">
                        <CalendarIcon className="w-7 h-7 text-muted-foreground/40" />
                      </div>
                      <h4 className="text-sm font-bold text-foreground mb-1">Nenhuma consulta</h4>
                      <p className="text-[11px] text-muted-foreground mb-5">
                        Sem agendamentos para este dia.
                      </p>
                      <NewAppointmentModal>
                        <Button className="h-10 px-6 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 font-bold text-[10px] uppercase tracking-[0.12em] transition-all shadow-md active:scale-95">
                          <Plus className="w-3.5 h-3.5 mr-1.5" />
                          Agendar
                        </Button>
                      </NewAppointmentModal>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {sheetAppointments.map((apt, i) => renderAppointmentCard(apt, i, true))}
                    </div>
                  )}
                </div>

                {/* Expand hint at bottom */}
                {sheetSnapFraction < SHEET_FULL && sheetAppointments.length > 2 && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="absolute bottom-0 left-0 right-0 h-14 bg-gradient-to-t from-background via-background/80 to-transparent pointer-events-none flex items-end justify-center pb-3"
                  >
                    <span className="text-[9px] font-bold text-muted-foreground/40 uppercase tracking-widest">
                      ↑ Arraste para expandir
                    </span>
                  </motion.div>
                )}
              </motion.div>
            </>
          )}
        </AnimatePresence>
      </div>
      {openedAppointment && (
        <AppointmentDetailModal
          appointment={openedAppointment}
          open={!!openedAppointment}
          onOpenChange={(open) => {
            if (!open) closeOpenedAppointment();
          }}
        />
      )}
    </MobileLayout>
  );
};

export default MobileAgenda;
