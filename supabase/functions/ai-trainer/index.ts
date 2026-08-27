const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (request.method !== "POST") {
    return jsonResponse({ error: "Method not allowed." }, 405);
  }

  const authorization = request.headers.get("Authorization");
  if (!authorization?.startsWith("Bearer ")) {
    return jsonResponse({ error: "You must be signed in to use the AI Trainer." }, 401);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const geminiApiKey = Deno.env.get("GEMINI_API_KEY");

  if (!supabaseUrl || !supabaseAnonKey || !geminiApiKey) {
    return jsonResponse({ error: "The AI Trainer is not configured yet." }, 500);
  }

  const userResponse = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: {
      apikey: supabaseAnonKey,
      Authorization: authorization,
    },
  });

  if (!userResponse.ok) {
    return jsonResponse({ error: "Your session is no longer valid. Please sign in again." }, 401);
  }

  let requestBody: { systemInstruction?: unknown; contents?: unknown };
  try {
    requestBody = await request.json();
  } catch {
    return jsonResponse({ error: "The AI Trainer request was invalid." }, 400);
  }

  if (!requestBody.systemInstruction || !Array.isArray(requestBody.contents)) {
    return jsonResponse({ error: "The AI Trainer request was incomplete." }, 400);
  }

  const geminiResponse = await fetch(
    "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key=" +
      encodeURIComponent(geminiApiKey),
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: requestBody.systemInstruction,
        contents: requestBody.contents,
      }),
    },
  );

  const responseBody = await geminiResponse.json();
  return jsonResponse(responseBody, geminiResponse.status);
});
