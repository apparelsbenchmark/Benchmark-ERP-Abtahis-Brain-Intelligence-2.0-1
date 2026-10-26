import { NextRequest, NextResponse } from 'next/server';
import { createHmac, timingSafeEqual } from 'node:crypto';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
const COOKIE = 'benchmark_erp_session';
const SESSION_SECONDS = 60 * 60 * 12;
type Session = { username: string; name: string; role: string; exp: number };
function sessionSecret() { return (process.env.ERP_SESSION_SECRET || '').trim(); }
function sessionConfigured() { return sessionSecret().length >= 32; }
function signature(payload: string) { return createHmac('sha256', sessionSecret()).update(payload).digest('base64url'); }
function createSession(user: any) {
  const payload = Buffer.from(JSON.stringify({ username: String(user.username), name: String(user.name || user.username), role: String(user.role || 'User'), exp: Math.floor(Date.now()/1000)+SESSION_SECONDS })).toString('base64url');
  return `${payload}.${signature(payload)}`;
}
function readSession(request: NextRequest): Session | null {
  try {
    const raw = request.cookies.get(COOKIE)?.value || ''; const parts = raw.split('.'); if (parts.length !== 2 || !sessionConfigured()) return null;
    const expected = Buffer.from(signature(parts[0])); const actual = Buffer.from(parts[1]); if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return null;
    const data = JSON.parse(Buffer.from(parts[0], 'base64url').toString('utf8')) as Session;
    if (!data.username || !data.exp || data.exp < Math.floor(Date.now()/1000)) return null; return data;
  } catch { return null; }
}
function setSessionCookie(response: NextResponse, user: any) {
  response.cookies.set(COOKIE, createSession(user), { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/', maxAge: SESSION_SECONDS });
}
function clearSessionCookie(response: NextResponse) { response.cookies.set(COOKIE, '', { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/', maxAge: 0 }); }
function connectionConfig() {
  const base = process.env.GOOGLE_SCRIPT_URL; const token = process.env.ERP_API_TOKEN;
  if (!base || !token) throw new Error('Google Sheets connection is not configured. Set GOOGLE_SCRIPT_URL and ERP_API_TOKEN in .env.local, then restart Next.js.');
  return { base, token };
}
function authError() { return NextResponse.json({ ok:false, connected:false, error:'Your session has expired. Please sign in again.' }, { status:401, headers:{'Cache-Control':'no-store'} }); }

export async function GET(request: NextRequest) {
  const action = String(request.nextUrl.searchParams.get('action') || '').toLowerCase();
  const session = readSession(request);
  // Check the cryptographically signed session without contacting Google Sheets.
  if (action === 'session') return NextResponse.json({ ok: !!session, authenticated: !!session, user: session ? { username: session.username, name: session.name, role: session.role } : null, error: session ? undefined : 'Session cookie missing or invalid. Check ERP_SESSION_SECRET and use the same localhost hostname for login and dashboard.' }, { status: session ? 200 : 401, headers: {'Cache-Control':'no-store'} });
  // A minimal health check may run before login; it exposes connection status only, never sheet records.
  if (!session && action !== 'health') return authError();
  try {
    const { base, token } = connectionConfig(); const url = new URL(base);
    for (const [key,value] of request.nextUrl.searchParams.entries()) if (key !== 'token' && key !== 'username') url.searchParams.set(key,value);
    // Never trust a client-supplied username for factory-scoped records.
    if (session) url.searchParams.set('username', session.username);
    else url.searchParams.delete('username');
    url.searchParams.set('token',token);
    const upstream = await fetch(url.toString(), { cache:'no-store', redirect:'follow' });
    const data = await upstream.json().catch(()=>({ok:false,error:'Apps Script returned invalid JSON.'}));
    if (!upstream.ok || data?.ok === false) return NextResponse.json({connected:false,...data},{status:upstream.status>=400?upstream.status:400,headers:{'Cache-Control':'no-store'}});
    return NextResponse.json({connected:true,...data},{headers:{'Cache-Control':'no-store'}});
  } catch (error: unknown) { return NextResponse.json({connected:false,error:error instanceof Error?error.message:'Unable to reach Google Sheets.'},{status:503,headers:{'Cache-Control':'no-store'}}); }
}

export async function POST(request: NextRequest) {
  let body: any;
  try { body = await request.json(); } catch { return NextResponse.json({ok:false,error:'Invalid JSON request.'},{status:400}); }
  const action = String(body.action || '').toLowerCase();
  // Browsers must originate state-changing requests from this application itself.
  const origin = request.headers.get('origin');
  const expectedOrigin = request.nextUrl.origin;
  if (origin && origin !== expectedOrigin) return NextResponse.json({ok:false,error:'Cross-origin ERP mutation rejected.'},{status:403});
  const fetchSite = request.headers.get('sec-fetch-site');
  if (fetchSite === 'cross-site') return NextResponse.json({ok:false,error:'Cross-site ERP mutation rejected.'},{status:403});
  if (action === 'logout') { const response=NextResponse.json({ok:true}); clearSessionCookie(response); return response; }
  if (action === 'login' && !sessionConfigured()) return NextResponse.json({ ok:false, error:'ERP_SESSION_SECRET is missing or too short. Set a stable secret of at least 32 characters in .env.local and restart npm run dev.' }, {status:503, headers:{'Cache-Control':'no-store'}});
  if (action !== 'login' && !readSession(request)) return authError();
  const session = readSession(request);
  if (session && body.username && String(body.username).toLowerCase() !== session.username.toLowerCase() && action !== 'login') return NextResponse.json({ok:false,error:'The session user does not match this request.'},{status:403});
  try {
    const { base, token } = connectionConfig();
    const upstream = await fetch(base, { method:'POST', cache:'no-store', redirect:'follow', headers:{'Content-Type':'text/plain;charset=utf-8',Accept:'application/json'}, body:JSON.stringify({...body,token,username:session?.username || body.username}) });
    const data = await upstream.json().catch(()=>({ok:false,error:'Apps Script returned invalid JSON.'}));
    if (!upstream.ok || data?.ok === false) return NextResponse.json(data,{status:upstream.status>=400?upstream.status:400,headers:{'Cache-Control':'no-store'}});
    const response = NextResponse.json(data,{headers:{'Cache-Control':'no-store'}});
    if (action === 'login' || action === 'changepassword') { if (data.user) setSessionCookie(response,data.user); }
    return response;
  } catch (error: unknown) { return NextResponse.json({ok:false,connected:false,error:error instanceof Error?error.message:'Unable to reach Google Sheets.'},{status:503,headers:{'Cache-Control':'no-store'}}); }
}
