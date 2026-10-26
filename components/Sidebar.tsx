'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { LayoutDashboard, ClipboardList, Factory, LineChart, Truck, ShieldCheck, Users, Package2, Sparkles, Settings, Scale, Boxes, Warehouse, BriefcaseBusiness, CalendarDays, LogOut } from 'lucide-react';

const items = [
  ['Dashboard','/',LayoutDashboard], ['Orders','/orders',ClipboardList], ['Merchandising','/merchandising',BriefcaseBusiness], ['Planning','/planning',CalendarDays], ['Material Control','/material-control',Boxes], ['Store','/store',Warehouse], ['Production','/production',Factory], ['Shipment','/shipment',Truck], ['Quality','/quality',ShieldCheck], ['Reconciliation','/reconciliation',Scale], ['Reports & Analytics','/reports',LineChart], ['Users & Permissions','/users',Users], ['AI Insights','/insights',Sparkles], ['Settings','/settings',Settings],
] as const;
export default function Sidebar({connected}:{connected:boolean}){
  const pathname=usePathname(); const router=useRouter(); const [logoAvailable,setLogoAvailable]=useState(true);
  const [user,setUser]=useState<any>(null);
  useEffect(()=>{try{setUser(JSON.parse(localStorage.getItem('erp_user')||'null'));}catch{setUser(null);}},[]);
  async function logout(){try{await fetch('/api/erp',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'logout'})});}finally{localStorage.removeItem('erp_user');router.replace('/login');}}
  return <aside className="tower-sidebar">
    <div className="brand-wrap"><div className="sidebar-logo-panel">{logoAvailable?<img src="/logo.png" alt="Benchmark Group" onError={()=>setLogoAvailable(false)}/>:<div className="brand-badge">B</div>}</div><div className="brand-title"><h2>Benchmark</h2><p>Group ERP Control Tower</p><small>QUALITY IS WHAT WE DO</small></div></div>
    <nav className="side-nav">{items.map(([label,href,Icon])=>{const active=href==='/'?pathname==='/':pathname===href||pathname.startsWith(href+'/');return <Link key={label} href={href} className={`side-link ${active?'active':''}`}><Icon size={18}/><span>{label}</span></Link>;})}</nav>
    <div className="sync-box"><div className="sync-heading"><div className="sync-database">▤</div><div><strong>Google Sheets</strong><small>Live Data Sync</small></div></div><div className={`sync-status ${connected?'':'offline'}`}><i/> {connected?'Connected':'Not Connected'}</div><p>{connected?'ERP data is synchronized with your Google Sheet.':'Configure the Apps Script URL and API token to enable live sync.'}</p><Link href="/settings" className="sync-manage">Manage Sync →</Link></div>
    <div className="sidebar-user"><div className="sidebar-avatar">{String(user?.name||user?.username||'B').slice(0,1).toUpperCase()}</div><div className="sidebar-user-copy"><strong>{user?.name||'ERP User'}</strong><span>{user?.role||'User'}</span></div><button type="button" title="Sign out" onClick={logout}><LogOut size={16}/></button></div>
    <div className="version-note">Benchmark Group ERP<br/><span>v9.2.0 · Google Sheets</span></div>
  </aside>;
}
