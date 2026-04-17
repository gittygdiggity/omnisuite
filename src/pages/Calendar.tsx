import { useState, useEffect } from "react";
import {
  Calendar as CalendarIcon, ChevronLeft, ChevronRight,
  Plus, Clock, Copy, CheckCheck, Video, Phone, User, Loader2, RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December",
];

interface CalEvent {
  id: string;
  title: string;
  date: string;
  time: string;
  duration: string;
  type: "call" | "demo" | "meeting" | "follow_up";
  contact: string;
  company: string;
  link?: string;
  htmlLink?: string;
}

const TYPE_CONFIG = {
  call: { icon: Phone, color: "text-blue-400 bg-blue-500/10 border-blue-500/25" },
  demo: { icon: Video, color: "text-primary bg-primary/10 border-primary/25" },
  meeting: { icon: User, color: "text-purple-400 bg-purple-500/10 border-purple-500/25" },
  follow_up: { icon: CalendarIcon, color: "text-amber-400 bg-amber-500/10 border-amber-500/25" },
};

const BOOKING_LINK = "https://cal.link/yourname/30min";

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}
function getFirstDayOfMonth(year: number, month: number) {
  return new Date(year, month, 1).getDay();
}

export default function Calendar() {
  const today = new Date();
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const [selectedDate, setSelectedDate] = useState<string | null>(today.toISOString().split("T")[0]);
  const [copied, setCopied] = useState(false);
  const [events, setEvents] = useState<CalEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadEvents = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: fnError } = await supabase.functions.invoke("google-calendar", {
        body: {
          action: "list_events",
          timeMin: new Date(today.getFullYear(), today.getMonth() - 1, 1).toISOString(),
          timeMax: new Date(today.getFullYear(), today.getMonth() + 3, 0).toISOString(),
        },
      });
      if (fnError) throw fnError;
      if (data?.error) throw new Error(data.error);
      setEvents(data?.events ?? []);
    } catch (e: unknown) {
      console.error("Calendar load error:", e);
      setError(e instanceof Error ? e.message : "Failed to load calendar");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadEvents(); }, []);

  const daysInMonth = getDaysInMonth(viewYear, viewMonth);
  const firstDay = getFirstDayOfMonth(viewYear, viewMonth);

  const prevMonth = () => {
    if (viewMonth === 0) { setViewYear(y => y - 1); setViewMonth(11); }
    else setViewMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (viewMonth === 11) { setViewYear(y => y + 1); setViewMonth(0); }
    else setViewMonth(m => m + 1);
  };

  const dateStr = (day: number) =>
    `${viewYear}-${String(viewMonth + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

  const eventsOnDate = (ds: string) => events.filter(e => e.date === ds);
  const selectedEvents = selectedDate ? eventsOnDate(selectedDate) : [];

  const handleCopy = () => {
    navigator.clipboard.writeText(BOOKING_LINK);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const upcomingCount = events.filter(e => e.date >= today.toISOString().split("T")[0]).length;

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="px-6 py-4 border-b border-white/8 flex items-center justify-between flex-shrink-0 animate-fade-up">
        <div>
          <h1 className="text-xl font-bold text-foreground tracking-tight">Calendar</h1>
          <p className="text-xs text-muted-foreground">
            {loading ? "Loading…" : error ? "Calendar unavailable" : `${upcomingCount} upcoming meetings`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            onClick={loadEvents}
            variant="ghost"
            size="sm"
            disabled={loading}
            className="border border-white/15 text-muted-foreground hover:text-foreground h-8 gap-1.5 text-xs"
          >
            {loading ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
            Refresh
          </Button>
          <Button className="bg-primary text-primary-foreground hover:bg-primary/90 h-8 text-sm font-semibold gap-1.5">
            <Plus size={14} />
            New Event
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-hidden flex">
        {/* Left: calendar + booking link */}
        <div className="flex-1 overflow-y-auto scrollable p-5 space-y-4">

          {/* Booking link card */}
          <div className="glass-card p-4 border-primary/20 animate-fade-up">
            <div className="flex items-center justify-between gap-4">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-foreground mb-0.5">Your Booking Link</p>
                <p className="text-xs text-muted-foreground truncate">{BOOKING_LINK}</p>
              </div>
              <Button
                onClick={handleCopy}
                size="sm"
                variant="outline"
                className={cn(
                  "h-8 text-xs gap-1.5 border transition-all duration-200 flex-shrink-0",
                  copied
                    ? "border-primary/50 text-primary bg-primary/10"
                    : "border-white/15 text-muted-foreground hover:text-foreground hover:border-white/30"
                )}
              >
                {copied ? <><CheckCheck size={13} />Copied!</> : <><Copy size={13} />Copy link</>}
              </Button>
            </div>
          </div>

          {/* Error state */}
          {error && (
            <div className="glass-card p-4 border-red-500/20 animate-fade-up">
              <p className="text-sm text-red-400">⚠️ {error}</p>
              <p className="text-xs text-muted-foreground mt-1">
                Google Calendar API key may need calendar read permissions (not just API key access — make sure the calendar is public or use OAuth).
              </p>
            </div>
          )}

          {/* Month nav */}
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-foreground">
              {MONTHS[viewMonth]} {viewYear}
            </h2>
            <div className="flex items-center gap-1">
              <Button onClick={prevMonth} variant="ghost" size="sm" className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground">
                <ChevronLeft size={14} />
              </Button>
              <Button
                onClick={() => { setViewYear(today.getFullYear()); setViewMonth(today.getMonth()); }}
                variant="ghost" size="sm"
                className="h-7 text-xs text-muted-foreground hover:text-foreground px-2"
              >
                Today
              </Button>
              <Button onClick={nextMonth} variant="ghost" size="sm" className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground">
                <ChevronRight size={14} />
              </Button>
            </div>
          </div>

          {/* Day headers */}
          <div className="grid grid-cols-7">
            {DAYS.map(d => (
              <div key={d} className="text-center text-[11px] font-semibold text-muted-foreground py-1">{d}</div>
            ))}
          </div>

          {/* Day cells */}
          <div className="grid grid-cols-7 gap-1">
            {Array.from({ length: firstDay }).map((_, i) => <div key={`e-${i}`} />)}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const day = i + 1;
              const ds = dateStr(day);
              const dayEvents = eventsOnDate(ds);
              const isToday = ds === today.toISOString().split("T")[0];
              const isSelected = ds === selectedDate;
              return (
                <button
                  key={day}
                  onClick={() => setSelectedDate(ds)}
                  className={cn(
                    "aspect-square rounded-lg p-1 text-xs transition-all duration-150 flex flex-col items-center",
                    isSelected
                      ? "bg-primary/20 border border-primary/40 text-primary"
                      : isToday
                        ? "bg-white/8 border border-white/20 text-foreground"
                        : "text-muted-foreground hover:bg-white/5 border border-transparent"
                  )}
                >
                  <span className={cn("font-semibold", isToday && !isSelected && "text-primary")}>{day}</span>
                  {dayEvents.length > 0 && (
                    <div className="flex gap-0.5 mt-0.5 flex-wrap justify-center">
                      {dayEvents.slice(0, 3).map((e) => (
                        <div key={e.id} className={cn("w-1.5 h-1.5 rounded-full", TYPE_CONFIG[e.type].color.split(" ")[1])} />
                      ))}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Right: selected day events */}
        <div className="w-72 border-l border-white/8 p-4 overflow-y-auto scrollable flex-shrink-0">
          <div className="mb-4">
            <h3 className="text-sm font-semibold text-foreground">
              {selectedDate
                ? new Date(selectedDate + "T00:00:00").toLocaleDateString("en-US", { month: "long", day: "numeric" })
                : "Select a date"}
            </h3>
            <p className="text-[11px] text-muted-foreground">{selectedEvents.length} events</p>
          </div>

          {loading ? (
            <div className="flex flex-col items-center justify-center py-12">
              <Loader2 size={20} className="animate-spin text-primary mb-2" />
              <p className="text-xs text-muted-foreground">Loading events…</p>
            </div>
          ) : selectedEvents.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center mb-2.5">
                <CalendarIcon size={16} className="text-muted-foreground" />
              </div>
              <p className="text-sm text-muted-foreground">No events</p>
              <p className="text-[11px] text-muted-foreground/60 mt-1">Click + to schedule a meeting</p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {selectedEvents.map((event) => {
                const t = TYPE_CONFIG[event.type];
                return (
                  <div key={event.id} className="glass-card p-3.5">
                    <div className="flex items-start gap-2.5">
                      <div className={cn("w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 border", t.color)}>
                        <t.icon size={12} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-foreground truncate">{event.title}</p>
                        {event.contact && event.contact !== "—" && (
                          <p className="text-[11px] text-muted-foreground">{event.contact}</p>
                        )}
                      </div>
                    </div>
                    <div className="mt-2.5 flex items-center gap-3 text-[11px] text-muted-foreground">
                      <div className="flex items-center gap-1"><Clock size={10} />{event.time}</div>
                      {event.duration && <><span>·</span><span>{event.duration}</span></>}
                    </div>
                    <div className="mt-2 flex items-center gap-2">
                      {event.link && (
                        <a href={event.link} target="_blank" rel="noreferrer"
                          className="inline-flex items-center gap-1 text-[11px] text-primary hover:underline">
                          <Video size={10} />Join meeting
                        </a>
                      )}
                      {event.htmlLink && (
                        <a href={event.htmlLink} target="_blank" rel="noreferrer"
                          className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground hover:underline">
                          Open in Google
                        </a>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
