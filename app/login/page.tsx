'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight, Eye, EyeOff, LockKeyhole, ShieldCheck } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const [logoAvailable, setLogoAvailable] = useState(true);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [stage, setStage] = useState<'login' | 'change'>('login');
  const [pendingUser, setPendingUser] = useState<any>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(''); setBusy(true);
    try {
      if (stage === 'login') {
        const response = await fetch('/api/erp', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'login', username: username.trim(), password }) });
        const result = await response.json();
        if (!response.ok || !result.ok) throw new Error(result.error || 'Login failed.');
        if (result.user?.mustChangePassword) { setPendingUser(result.user); setStage('change'); return; }
        const sessionCheck = await fetch('/api/erp?action=session', { cache:'no-store', credentials:'same-origin' });
        if (!sessionCheck.ok) { const detail = await sessionCheck.json().catch(()=>({})); throw new Error(detail.error || 'Login succeeded but the session cookie was not accepted. Check ERP_SESSION_SECRET.'); }
        localStorage.setItem('erp_user', JSON.stringify(result.user));
        router.replace('/'); router.refresh();
      } else {
        if (newPassword.length < 10) throw new Error('Use at least 10 characters for the new password.');
        if (newPassword !== confirmPassword) throw new Error('The new passwords do not match.');
        const response = await fetch('/api/erp', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'changePassword', username: pendingUser.username, oldPassword: password, newPassword }) });
        const result = await response.json();
        if (!response.ok || !result.ok) throw new Error(result.error || 'Could not update password.');
        const sessionCheck = await fetch('/api/erp?action=session', { cache:'no-store', credentials:'same-origin' });
        if (!sessionCheck.ok) { const detail = await sessionCheck.json().catch(()=>({})); throw new Error(detail.error || 'Password updated but session verification failed.'); }
        localStorage.setItem('erp_user', JSON.stringify(result.user));
        router.replace('/'); router.refresh();
      }
    } catch (e: unknown) { setError(e instanceof Error ? e.message : 'Something went wrong.'); }
    finally { setBusy(false); }
  }

  return <main className="login-screen">
    <div className="login-decoration login-decoration-one"/><div className="login-decoration login-decoration-two"/>
    <section className="login-card">
      <div className="login-brand">
        <div className="login-logo">{logoAvailable ? <img src="/logo.png" alt="Benchmark Group" onError={()=>setLogoAvailable(false)}/> : <b>B</b>}</div>
        <div><strong>BENCHMARK GROUP</strong><span>QUALITY IS WHAT WE DO</span></div>
      </div>
      <div className="login-eyebrow"><ShieldCheck size={15}/> SECURE ERP WORKSPACE</div>
      <h1>{stage === 'login' ? 'Welcome back' : 'Update your password'}</h1>
      <p className="login-subtitle">{stage === 'login' ? 'Sign in to access your operations control tower.' : 'For account security, set a new password before continuing.'}</p>
      <form onSubmit={submit} className="login-form">
        {stage === 'login' && <label>Username<input autoComplete="username" value={username} onChange={e=>setUsername(e.target.value)} placeholder="Enter your username" required/></label>}
        <label>{stage === 'login' ? 'Password' : 'Temporary password'}<div className="password-field"><LockKeyhole size={17}/><input type={showPassword?'text':'password'} autoComplete={stage === 'login'?'current-password':'current-password'} value={password} onChange={e=>setPassword(e.target.value)} placeholder="Enter password" required/><button type="button" aria-label="Toggle password visibility" onClick={()=>setShowPassword(v=>!v)}>{showPassword?<EyeOff size={17}/>:<Eye size={17}/>}</button></div></label>
        {stage === 'change' && <><label>New password<input type="password" autoComplete="new-password" value={newPassword} onChange={e=>setNewPassword(e.target.value)} placeholder="At least 10 characters" required minLength={10}/></label><label>Confirm new password<input type="password" autoComplete="new-password" value={confirmPassword} onChange={e=>setConfirmPassword(e.target.value)} placeholder="Enter new password again" required minLength={10}/></label></>}
        {error && <div className="login-error" role="alert">{error}</div>}
        <button className="login-submit" type="submit" disabled={busy}>{busy?'Please wait…':stage==='login'?'Sign in':'Save password'} <ArrowRight size={17}/></button>
      </form>
      <div className="login-foot"><LockKeyhole size={14}/> Access is verified against your ERP Google Sheet.</div>
    </section>
    <p className="login-copyright">© {new Date().getFullYear()} Benchmark Group · ERP Control Tower</p>
    <style jsx>{`
      .login-screen{min-height:100vh;display:grid;place-items:center;padding:32px 18px;background:linear-gradient(135deg,#f4f7fc 0%,#edf3ff 50%,#f7f9fd 100%);position:relative;overflow:hidden;color:#10254d;font-family:Arial,Helvetica,sans-serif}
      .login-decoration{position:absolute;border-radius:50%;filter:blur(1px);pointer-events:none}.login-decoration-one{width:480px;height:480px;top:-230px;right:-90px;background:radial-gradient(circle,#c9dcff 0%,#dce8ff55 65%,transparent 70%)}.login-decoration-two{width:420px;height:420px;bottom:-230px;left:-100px;background:radial-gradient(circle,#c7f3e4 0%,#d9f4eb66 62%,transparent 70%)}
      .login-card{position:relative;width:min(100%,460px);padding:38px;background:#fff;border:1px solid #e3eaf5;border-radius:26px;box-shadow:0 24px 70px #1a376516}
      .login-brand{display:flex;align-items:center;gap:13px;padding-bottom:27px;border-bottom:1px solid #edf1f7}.login-logo{width:92px;height:78px;display:grid;place-items:center;overflow:hidden;border-radius:12px;background:#fff;border:1px solid #e9eef6;color:#2864f0;font-size:30px;font-weight:900}.login-logo img{width:100%;height:100%;object-fit:contain}.login-logo b{display:grid;place-items:center;width:42px;height:42px;border-radius:12px;background:#e9f1ff}.login-brand strong{display:block;font-size:15px;letter-spacing:.3px}.login-brand span{display:block;margin-top:5px;color:#69a342;font-size:10px;font-weight:900;letter-spacing:.5px}
      .login-eyebrow{display:flex;align-items:center;gap:7px;margin-top:29px;color:#2864f0;font-size:11px;font-weight:800;letter-spacing:1.6px}.login-card h1{font-size:32px;letter-spacing:-1px;margin:13px 0 8px;color:#10254d}.login-subtitle{margin:0;color:#74839d;font-size:14px;line-height:1.6}.login-form{display:grid;gap:17px;margin-top:27px}.login-form label{display:grid;gap:8px;font-size:13px;font-weight:700;color:#344563}.login-form input{width:100%;min-width:0;border:1px solid #dbe4f1;border-radius:11px;padding:13px 14px;outline:none;font-size:14px;color:#10254d;background:#fff}.login-form input:focus{border-color:#3472f5;box-shadow:0 0 0 3px #3472f51a}.password-field{display:flex;align-items:center;gap:10px;padding-left:13px;border:1px solid #dbe4f1;border-radius:11px;color:#7b8ca8}.password-field:focus-within{border-color:#3472f5;box-shadow:0 0 0 3px #3472f51a}.password-field input{border:0;box-shadow:none!important;padding-left:0}.password-field button{border:0;background:transparent;color:#7b8ca8;padding:8px 12px;cursor:pointer}.login-submit{display:flex;justify-content:center;align-items:center;gap:10px;border:0;border-radius:12px;padding:14px;background:linear-gradient(100deg,#2864f0,#397cf7);color:#fff;font-size:14px;font-weight:800;cursor:pointer;box-shadow:0 9px 18px #2864f02a}.login-submit:disabled{opacity:.65;cursor:wait}.login-error{padding:11px 12px;border-radius:10px;background:#fff0f0;color:#b42318;font-size:13px;line-height:1.45}.login-foot{display:flex;align-items:center;justify-content:center;gap:7px;margin-top:24px;color:#8a97ab;font-size:11px}.login-copyright{position:absolute;bottom:12px;text-align:center;color:#8a97ab;font-size:11px}
      @media(max-width:520px){.login-card{padding:26px 22px;border-radius:20px}.login-card h1{font-size:28px}}
    `}</style>
  </main>;
}
