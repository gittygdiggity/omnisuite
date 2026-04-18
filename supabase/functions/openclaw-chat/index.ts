import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { messages, model, openai_api_key, anthropic_api_key } = await req.json();

    if (!messages || !Array.isArray(messages)) {
      throw new Error("messages array is required");
    }

    let content: string;

    if (model === "gpt") {
      if (!openai_api_key) throw new Error("OpenAI API key not configured — add it in Settings");

      const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${openai_api_key}`,
        },
        body: JSON.stringify({
          model: "gpt-4o",
          messages,
          temperature: 0.7,
          max_tokens: 2000,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || "OpenAI request failed");
      content = data.choices[0].message.content;

    } else {
      if (!anthropic_api_key) throw new Error("Anthropic API key not configured — add it in Settings");

      const systemMsg = messages.find((m: { role: string }) => m.role === "system");
      const chatMessages = messages.filter((m: { role: string }) => m.role !== "system");

      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": anthropic_api_key,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: "claude-sonnet-4-6",
          max_tokens: 2000,
          system: systemMsg?.content ?? "",
          messages: chatMessages,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || "Anthropic request failed");
      content = data.content[0].text;
    }

    return new Response(JSON.stringify({ content }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
