import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const GOOGLE_CALENDAR_API_KEY = Deno.env.get("GOOGLE_CALENDAR_API_KEY") ?? "";
const CALENDAR_BASE = "https://www.googleapis.com/calendar/v3";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { action, calendarId, timeMin, timeMax } = await req.json();

    if (!GOOGLE_CALENDAR_API_KEY) {
      throw new Error("GOOGLE_CALENDAR_API_KEY is not configured");
    }

    if (action === "list_events") {
      const id = calendarId;
      
      if (!id || id === "primary") {
        // API keys cannot access "primary" — need an actual public calendar ID
        return new Response(JSON.stringify({
          events: [],
          warning: "API keys can only access public calendars. Please provide a public calendar ID (email address) or set up OAuth for private calendar access.",
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const min = timeMin || new Date().toISOString();
      const max = timeMax || new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString();

      const url = new URL(`${CALENDAR_BASE}/calendars/${encodeURIComponent(id)}/events`);
      url.searchParams.set("key", GOOGLE_CALENDAR_API_KEY);
      url.searchParams.set("timeMin", min);
      url.searchParams.set("timeMax", max);
      url.searchParams.set("singleEvents", "true");
      url.searchParams.set("orderBy", "startTime");
      url.searchParams.set("maxResults", "250");

      const res = await fetch(url.toString());
      if (!res.ok) {
        const err = await res.text();
        throw new Error(`Google Calendar API error [${res.status}]: ${err}`);
      }
      const data = await res.json();

      const events = (data.items ?? []).map((e: Record<string, unknown>) => {
        const start = (e.start as Record<string, string> | undefined) ?? {};
        const end = (e.end as Record<string, string> | undefined) ?? {};
        const startDt = start.dateTime || start.date || "";
        const endDt = end.dateTime || end.date || "";

        const startDate = startDt ? new Date(startDt) : null;
        const endDate = endDt ? new Date(endDt) : null;

        let duration = "";
        if (startDate && endDate) {
          const mins = Math.round((endDate.getTime() - startDate.getTime()) / 60000);
          duration = mins < 60 ? `${mins} min` : `${Math.round(mins / 60)}h`;
        }

        let meetLink: string | undefined;
        const confData = e.conferenceData as Record<string, unknown> | undefined;
        if (confData?.entryPoints) {
          const videoEntry = (confData.entryPoints as Array<Record<string, unknown>>).find(
            (ep) => ep.entryPointType === "video"
          );
          if (videoEntry) meetLink = videoEntry.uri as string;
        }
        if (!meetLink && e.location && typeof e.location === "string" && e.location.startsWith("http")) {
          meetLink = e.location as string;
        }

        const summary = ((e.summary as string) || "").toLowerCase();
        let type: "call" | "demo" | "meeting" | "follow_up" = "meeting";
        if (summary.includes("call") || summary.includes("phone")) type = "call";
        else if (summary.includes("demo")) type = "demo";
        else if (summary.includes("follow")) type = "follow_up";

        const attendees = (e.attendees as Array<Record<string, string>> | undefined) ?? [];
        const contact = attendees.find((a) => !a.self)?.displayName || attendees.find((a) => !a.self)?.email || "";
        const organizer = (e.organizer as Record<string, string> | undefined)?.displayName || "";

        return {
          id: e.id as string,
          title: (e.summary as string) || "Untitled",
          date: startDate ? startDate.toISOString().split("T")[0] : "",
          time: startDate && start.dateTime
            ? startDate.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true })
            : "All day",
          duration,
          type,
          contact: contact || organizer || "—",
          company: "",
          link: meetLink,
          htmlLink: e.htmlLink as string | undefined,
        };
      });

      return new Response(JSON.stringify({ events }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Unknown action" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
