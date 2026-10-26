'use client';
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { RefreshCw, Search, Scale, TriangleAlert, CheckCircle2 } from 'lucide-react';
import Sidebar from './Sidebar';

const fallback:any[]=[];
const fmt=(n:number)=>Number(n||0).toLocaleString();

export default function ReconciliationPage(){
  const router = useRouter();
  const [rows,setRows]=useState(fallback); const [connected,setConnected]=useState(false); const [q,setQ]=useState(''); const [last,setLast]=useState(new Date().toISOString());
  async function refresh(){try{const r=await fetch('/api/erp?action=reconciliation',{cache:'no-store'}); if(!r.ok) throw 0; const j=await r.json(); if(j.connected&&Array.isArray(j.reconciliation)){setRows(j.reconciliation);setConnected(true);setLast(j.lastUpdated||new Date().toISOString());} else setConnected(false);}catch{setConnected(false)}}
  useEffect(()=>{try{if(!localStorage.getItem('erp_user')){router.replace('/login');return;}}catch{router.replace('/login');return;}refresh();const id=setInterval(refresh,30000);return()=>clearInterval(id)},[router]);
  const filtered=useMemo(()=>rows.filter((r:any)=>Object.values(r).join(' ').toLowerCase().includes(q.toLowerCase())),[rows,q]);
  const totals=useMemo(()=>filtered.reduce((a:any,r:any)=>{a.order+=Number(r.orderQty||0);a.ship+=Number(r.shipmentQty||0);a.balance+=Number(r.balance||0);a.variance+=Number(r.variance||0);return a},{order:0,ship:0,balance:0,variance:0}),[filtered]);
  return <div className="tower-shell"><Sidebar connected={connected}/><main className="tower-content"><header className="page-header"><div><h1>Reconciliation Control</h1><p>Order → Material → Cutting → Sewing → Finishing → FG → Shipment</p><small className="live-note">{connected?'LIVE • Google Sheets':'DEMO DATA • Connect Google Sheets'} · Updated {new Date(last).toLocaleTimeString()}</small></div><div className="header-actions"><label className="search-box"><Search size={16}/><input value={q} onChange={e=>setQ(e.target.value)} placeholder="Search PO, style, factory..."/></label><button className="field-btn" onClick={refresh}><RefreshCw size={16}/>Refresh</button></div></header>
  <section className="recon-kpis"><ReconKpi title="Total Order Qty" value={fmt(totals.order)} tone="blue"/><ReconKpi title="Shipment Qty" value={fmt(totals.ship)} tone="green"/><ReconKpi title="Open Balance" value={fmt(totals.balance)} tone="orange"/><ReconKpi title="Process Variance" value={fmt(totals.variance)} tone="red"/></section>
  <section className="panel recon-flow"><div className="panel-top"><div><h3><Scale size={16}/> Production Reconciliation Flow</h3><p>Live quantity movement and variance control by PO</p></div></div><div className="flow-strip">{['Order','Material Issued','Cutting','Sewing','Finishing','FG/Packing','Shipment','Balance'].map((x,i)=><div className="flow-node" key={x}><b>{x}</b>{i<7&&<span>→</span>}</div>)}</div></section>
  <section className="panel table-card"><div className="panel-top"><div><h3>PO-wise Reconciliation</h3><p>Compare ordered, issued, produced, packed and shipped quantities</p></div></div><div className="table-scroll recon-table"><table><thead><tr><th>Buyer</th><th>Style</th><th>PO</th><th>Factory</th><th>Order</th><th>Material Issued</th><th>Cut</th><th>Sew</th><th>Finish</th><th>FG</th><th>Shipment</th><th>Balance</th><th>Variance</th><th>Status</th></tr></thead><tbody>{filtered.map((r:any)=><tr key={r.po}><td>{r.buyer}</td><td>{r.style}</td><td><b>{r.po}</b></td><td>{r.factory}</td><td>{fmt(r.orderQty)}</td><td>{fmt(r.materialIssued)}</td><td>{fmt(r.cutQty)}</td><td>{fmt(r.sewQty)}</td><td>{fmt(r.finishQty)}</td><td>{fmt(r.fgQty)}</td><td>{fmt(r.shipmentQty)}</td><td><b>{fmt(r.balance)}</b></td><td className={Number(r.variance)>1000?'bad':'good'}>{fmt(r.variance)}</td><td><span className={`status-pill ${String(r.status).toLowerCase().replace(' ','-')}`}>{r.status==='On Track'?<CheckCircle2 size={12}/>:<TriangleAlert size={12}/>} {r.status}</span></td></tr>)}</tbody></table></div></section>
  </main></div>;
}
function ReconKpi({title,value,tone}:{title:string,value:string,tone:string}){return <div className={`panel recon-kpi ${tone}`}><span>{title}</span><strong>{value}</strong><small>pcs</small></div>}
