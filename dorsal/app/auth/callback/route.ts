import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * Magic-link landing. Exchanges the code for a session, then sends the user to
 * onboarding or to wherever they were headed. An expired or reused link comes
 * back to the sign-in screen with a message rather than a stack trace.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get('code');
  const next = searchParams.get('volver');

  if (!code) return NextResponse.redirect(`${origin}/entrar?error=expired`);

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) return NextResponse.redirect(`${origin}/entrar?error=expired`);

  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return NextResponse.redirect(`${origin}/entrar?error=expired`);

  const { data: profile } = await supabase
    .from('profiles')
    .select('id')
    .eq('id', auth.user.id)
    .maybeSingle();

  if (!profile) return NextResponse.redirect(`${origin}/alta`);
  return NextResponse.redirect(`${origin}${next && next.startsWith('/') ? next : '/planes'}`);
}
