// Edge Function: reset-password
// supabase functions deploy reset-password --project-ref xtgbbhkfwxvcuvvyybut

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL         = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const RESEND_API_KEY       = Deno.env.get('RESEND_API_KEY')!;
const FROM_EMAIL           = 'onboarding@resend.dev'; // cambiar por tu dominio cuando lo tengas

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });

  try {
    const { correo } = await req.json();
    if (!correo) return new Response(JSON.stringify({ error: 'Correo requerido' }), { status: 400, headers: cors });

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    // 1. Verificar que el correo existe
    const { data: usuario, error: errUser } = await supabase
      .from('usuarios')
      .select('id_usuario')
      .eq('correo', correo.trim().toLowerCase())
      .eq('activo', 1)
      .maybeSingle();

    // Por seguridad siempre responder OK aunque no exista
    if (errUser || !usuario) {
      return new Response(JSON.stringify({ ok: true }), { headers: cors });
    }

    // 2. Generar token y guardarlo en la BD (expira en 1 hora)
    const token  = crypto.randomUUID();
    const expiry = new Date(Date.now() + 60 * 60 * 1000).toISOString();

    await supabase
      .from('usuarios')
      .update({ reset_token: token, reset_token_expiry: expiry })
      .eq('id_usuario', usuario.id_usuario);

    // 3. Deep link que abre la app directamente
    const resetUrl = `mechgirls://reset-password?token=${token}&correo=${encodeURIComponent(correo.trim().toLowerCase())}`;

    // 4. Enviar email con Resend
    const html = `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px;">
        <h2 style="color:#E83E8C;">Recuperar contraseña — Mech Girls</h2>
        <p>Hola,</p>
        <p>Recibimos una solicitud para restablecer la contraseña de tu cuenta.</p>
        <p>Haz click en el botón para crear una nueva contraseña. El enlace expira en <strong>1 hora</strong>.</p>
        <a href="${resetUrl}"
           style="display:inline-block;background:#E83E8C;color:#fff;padding:12px 28px;
                  border-radius:8px;text-decoration:none;font-weight:bold;margin:16px 0;">
          Restablecer contraseña
        </a>
        <p style="color:#666;font-size:13px;margin-top:24px;">
          Si no solicitaste esto, ignora este correo.
        </p>
      </div>
    `;

    const resendRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: FROM_EMAIL,
        to:   correo.trim().toLowerCase(),
        subject: '🔐 Recupera tu contraseña — Mech Girls',
        html,
      }),
    });

    if (!resendRes.ok) {
      const err = await resendRes.text();
      console.error('Resend error:', err);
      return new Response(JSON.stringify({ error: 'No se pudo enviar el correo' }), { status: 500, headers: cors });
    }

    return new Response(JSON.stringify({ ok: true }), { headers: cors });

  } catch (err) {
    console.error(err);
    return new Response(JSON.stringify({ error: 'Error interno' }), { status: 500, headers: cors });
  }
});