// Edge Function: send-push
// Envía notificación push via Expo Push API
// supabase functions deploy send-push --project-ref xtgbbhkfwxvcuvvyybut

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });

  try {
    const { token, titulo, cuerpo, data } = await req.json();

    if (!token || !token.startsWith('ExponentPushToken[')) {
      return new Response(JSON.stringify({ ok: false, error: 'Token inválido' }), { headers: cors });
    }

    const mensaje = {
      to:    token,
      sound: 'default',
      title: titulo,
      body:  cuerpo,
      data:  data ?? {},
      badge: 1,
      // Prioridad alta para Android
      priority: 'high',
      channelId: 'default',
    };

    const res = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        'Accept':         'application/json',
        'Content-Type':   'application/json',
        'Accept-Encoding': 'gzip, deflate',
      },
      body: JSON.stringify(mensaje),
    });

    const result = await res.json();
    console.log('Expo push result:', JSON.stringify(result));

    return new Response(JSON.stringify({ ok: true, result }), { headers: cors });

  } catch (err) {
    console.error('send-push error:', err);
    return new Response(JSON.stringify({ error: String(err) }), { status: 500, headers: cors });
  }
});