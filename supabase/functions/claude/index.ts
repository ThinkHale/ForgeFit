import { serve } from 'https://deno.land/std@0.208.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.47.0';

const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY') ?? '';
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
const MODEL = 'claude-sonnet-4-20250514';
const MAX_TOKENS_CAP = 2000;
const MAX_MESSAGES = 50;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

async function requireUser(req: Request): Promise<boolean> {
  const authorization = req.headers.get('Authorization') ?? '';
  if (!authorization || !SUPABASE_URL || !SUPABASE_ANON_KEY) return false;

  const client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false },
  });
  const { data, error } = await client.auth.getUser();
  return !error && !!data.user;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    if (!(await requireUser(req))) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { messages, system, maxTokens = 1500, tools } = await req.json();
    if (!Array.isArray(messages) || typeof system !== 'string') {
      return new Response(JSON.stringify({ error: 'messages and system are required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body: Record<string, unknown> = {
      model: MODEL,
      max_tokens: Math.min(Math.max(Number(maxTokens) || 1500, 1), MAX_TOKENS_CAP),
      system: system.slice(0, 12000),
      messages: messages.slice(-MAX_MESSAGES),
    };
    if (Array.isArray(tools) && tools.length) body.tools = tools.slice(0, 12);

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const errBody = await res.text();
      return new Response(JSON.stringify({ error: errBody }), {
        status: res.status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const data = await res.json();

    // Return the full content array so the client can handle tool_use blocks
    return new Response(
      JSON.stringify({ content: data.content ?? [], stop_reason: data.stop_reason }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
