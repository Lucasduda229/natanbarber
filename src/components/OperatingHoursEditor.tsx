import { useState, useEffect } from "react";
import { Clock, Save, X, Pencil, DollarSign } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { ExtraFeeEditor } from "./ExtraFeeEditor";

interface DaySchedule {
  dayOfWeek: number;
  dayName: string;
  isOpen: boolean;
  startTime: string;
  endTime: string;
}

const dayNames = [
  "Domingo",
  "Segunda-feira",
  "Terça-feira",
  "Quarta-feira",
  "Quinta-feira",
  "Sexta-feira",
  "Sábado"
];

const OperatingHoursEditor = () => {
  const [schedule, setSchedule] = useState<DaySchedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [originalSchedule, setOriginalSchedule] = useState<DaySchedule[]>([]);

  useEffect(() => {
    fetchSchedule();
  }, []);

  const fetchSchedule = async () => {
    try {
      const { data: timeSlots, error } = await supabase
        .from("time_slots")
        .select("day_of_week, slot_time, is_blocked")
        .order("day_of_week")
        .order("slot_time");

      if (error) throw error;

      // Group slots by day and find first/last active time for each day
      const daySchedules: DaySchedule[] = dayNames.map((name, index) => {
        const daySlots = timeSlots?.filter(s => s.day_of_week === index && !s.is_blocked) || [];
        
        if (daySlots.length === 0) {
          return {
            dayOfWeek: index,
            dayName: name,
            isOpen: false,
            startTime: "08:00",
            endTime: "18:00"
          };
        }

        const times = daySlots.map(s => s.slot_time).sort();
        return {
          dayOfWeek: index,
          dayName: name,
          isOpen: true,
          startTime: times[0].slice(0, 5),
          endTime: times[times.length - 1].slice(0, 5)
        };
      });

      setSchedule(daySchedules);
      setOriginalSchedule(JSON.parse(JSON.stringify(daySchedules)));
    } catch (error) {
      console.error("Error fetching schedule:", error);
      toast.error("Erro ao carregar horários");
    } finally {
      setLoading(false);
    }
  };

  const generateTimeSlots = (startTime: string, endTime: string): string[] => {
    const slots: string[] = [];
    const [startHour, startMin] = startTime.split(":").map(Number);
    const [endHour, endMin] = endTime.split(":").map(Number);
    
    let currentHour = startHour;
    let currentMin = startMin;
    
    while (
      currentHour < endHour || 
      (currentHour === endHour && currentMin <= endMin)
    ) {
      slots.push(
        `${currentHour.toString().padStart(2, "0")}:${currentMin.toString().padStart(2, "0")}`
      );
      
      currentMin += 30;
      if (currentMin >= 60) {
        currentMin = 0;
        currentHour += 1;
      }
    }
    
    return slots;
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      // Delete all existing time slots
      const { error: deleteError } = await supabase
        .from("time_slots")
        .delete()
        .gte("day_of_week", 0);

      if (deleteError) throw deleteError;

      // Insert new time slots for each open day
      const newSlots: { day_of_week: number; slot_time: string; is_blocked: boolean }[] = [];

      for (const day of schedule) {
        if (day.isOpen) {
          const times = generateTimeSlots(day.startTime, day.endTime);
          for (const time of times) {
            newSlots.push({
              day_of_week: day.dayOfWeek,
              slot_time: time,
              is_blocked: false
            });
          }
        }
      }

      if (newSlots.length > 0) {
        const { error: insertError } = await supabase
          .from("time_slots")
          .insert(newSlots);

        if (insertError) throw insertError;
      }

      toast.success("Horários de funcionamento atualizados!");
      setOriginalSchedule(JSON.parse(JSON.stringify(schedule)));
      setIsEditing(false);
    } catch (error) {
      console.error("Error saving schedule:", error);
      toast.error("Erro ao salvar horários");
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setSchedule(JSON.parse(JSON.stringify(originalSchedule)));
    setIsEditing(false);
  };

  const updateDay = (dayOfWeek: number, updates: Partial<DaySchedule>) => {
    setSchedule(prev => 
      prev.map(day => 
        day.dayOfWeek === dayOfWeek ? { ...day, ...updates } : day
      )
    );
  };

  if (loading) {
    return (
      <Card className="bg-card/40 backdrop-blur-xl border-primary/20">
        <CardContent className="p-6 flex items-center justify-center">
          <span className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-card/40 backdrop-blur-xl border-primary/20">
      <CardHeader className="flex flex-row items-center justify-between pb-3 sm:pb-4">
        <CardTitle className="flex items-center gap-2 text-foreground text-base sm:text-lg">
          <Clock className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
          Horários de Funcionamento
        </CardTitle>
        {!isEditing ? (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsEditing(true)}
            className="border-primary/30 text-primary hover:bg-primary/10"
          >
            <Pencil className="w-4 h-4 mr-2" />
            Editar
          </Button>
        ) : (
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleCancel}
              disabled={saving}
              className="border-muted-foreground/30"
            >
              <X className="w-4 h-4 mr-1" />
              Cancelar
            </Button>
            <Button
              size="sm"
              onClick={handleSave}
              disabled={saving}
              className="bg-primary text-primary-foreground"
            >
              {saving ? (
                <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin mr-2" />
              ) : (
                <Save className="w-4 h-4 mr-2" />
              )}
              Salvar
            </Button>
          </div>
        )}
      </CardHeader>
      <CardContent className="space-y-3">
        {schedule.map((day) => (
          <div
            key={day.dayOfWeek}
            className={`flex items-center gap-3 p-3 rounded-lg border transition-colors ${
              day.isOpen 
                ? "bg-green-500/5 border-green-500/20" 
                : "bg-muted/20 border-muted/30"
            }`}
          >
            <div className="flex items-center gap-3 min-w-[140px]">
              <Switch
                checked={day.isOpen}
                onCheckedChange={(checked) => updateDay(day.dayOfWeek, { isOpen: checked })}
                disabled={!isEditing}
              />
              <span className={`text-sm font-medium ${day.isOpen ? "text-foreground" : "text-muted-foreground"}`}>
                {day.dayName}
              </span>
            </div>

            {day.isOpen && (
              <div className="flex items-center gap-2 flex-1">
                <Input
                  type="time"
                  value={day.startTime}
                  onChange={(e) => updateDay(day.dayOfWeek, { startTime: e.target.value })}
                  disabled={!isEditing}
                  className="w-28 bg-card/60 text-sm h-9"
                />
                <span className="text-muted-foreground text-sm">até</span>
                <Input
                  type="time"
                  value={day.endTime}
                  onChange={(e) => updateDay(day.dayOfWeek, { endTime: e.target.value })}
                  disabled={!isEditing}
                  className="w-28 bg-card/60 text-sm h-9"
                />
              </div>
            )}

            {!day.isOpen && (
              <span className="text-sm text-muted-foreground italic">Fechado</span>
            )}
          </div>
        ))}
        
        <p className="text-xs text-muted-foreground mt-4">
          Os horários são divididos em slots de 30 minutos. Ex: 08:00 até 18:00 cria slots das 08:00, 08:30, 09:00, etc.
        </p>

      </CardContent>

      <ExtraFeeEditor />
    </Card>
  );
};

export default OperatingHoursEditor;
