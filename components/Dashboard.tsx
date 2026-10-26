'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { AlertTriangle, ArrowDown, ArrowUp, Bell, Boxes, CalendarDays, ChevronDown, ChevronLeft, ChevronRight, Factory, Gauge, Lightbulb, LineChart, Search, ShieldCheck, Sparkles, Target, Truck, UserCog, Users, Wrench } from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, CartesianGrid, Tooltip, XAxis, YAxis } from 'recharts';
import Sidebar from './Sidebar';

type DashboardData = any;

const fallback = {
  lastUpdated: new Date().toISOString(),
  kpis:{runningOrders:0, monthlyShipment:0, productionEfficiency:0, criticalAlerts:0},
  months:['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'].map(month=>({month,orders:0,shipments:0})),
  factories:[
    {name:'Benchmark Apparels',lines:0,operatorsPerLine:0,workingMinutesPerDay:480,workingDays:26,capacityMinutes:0,orders:0,orderMinutes:0,production:0,shipment:0,orderPercent:0,productionPercent:0,shipmentPercent:0},
    {name:'Benchmark Exports',lines:0,operatorsPerLine:0,workingMinutesPerDay:480,workingDays:26,capacityMinutes:0,orders:0,orderMinutes:0,production:0,shipment:0,orderPercent:0,productionPercent:0,shipmentPercent:0},
    {name:'Fabtex',lines:0,operatorsPerLine:0,workingMinutesPerDay:480,workingDays:26,capacityMinutes:0,orders:0,orderMinutes:0,production:0,shipment:0,orderPercent:0,productionPercent:0,shipmentPercent:0}],
  lines:[],
  poStyleProgress:[],
};

const fmt=(n:number)=>Number(n||0).toLocaleString();
const yfmt=(n:number)=>n>=1000000?`${n/1000000}M`:`${Math.round(n/1000)}K`;

export default function Dashboard(){
  const router = useRouter();
  const [data,setData]=useState<DashboardData>(fallback);
  const [connected,setConnected]=useState(false);
  const [query,setQuery]=useState('');
  const [page,setPage]=useState(1);
  const [lastUpdated,setLastUpdated]=useState('');
  const [qualityRows,setQualityRows]=useState<any[]>([]);
  const [progressSearch,setProgressSearch]=useState('');
  const [selectedFactory,setSelectedFactory]=useState('All Factories');
  const [lineFactoryFilter,setLineFactoryFilter]=useState('All Factories');
  const [lineStatusFilter,setLineStatusFilter]=useState('All Status');
  const [pageSize,setPageSize]=useState(10);
  const [fromDate,setFromDate]=useState('');
  const [toDate,setToDate]=useState('');
  const rangeRef=useRef({from:'',to:''});
  rangeRef.current={from:fromDate,to:toDate};
  const [draftFrom,setDraftFrom]=useState('');
  const [draftTo,setDraftTo]=useState('');
  const [datePickerOpen,setDatePickerOpen]=useState(false);
  const [notificationsOpen,setNotificationsOpen]=useState(false);
  const [chartYear,setChartYear]=useState('All years');
  const [refreshing,setRefreshing]=useState(false);

  async function refresh(from?:string,to?:string){
    const activeFrom=from===undefined?rangeRef.current.from:from;
    const activeTo=to===undefined?rangeRef.current.to:to;
    setRefreshing(true);
    try{
      const params=new URLSearchParams({action:'dashboard'});
      if(activeFrom && activeTo){params.set('from',activeFrom);params.set('to',activeTo);}
      const [dashboardResponse,qualityResponse]=await Promise.all([
        fetch(`/api/erp?${params.toString()}`,{cache:'no-store'}),
        fetch(`/api/erp?action=list&module=quality${activeFrom&&activeTo?`&from=${encodeURIComponent(activeFrom)}&to=${encodeURIComponent(activeTo)}`:''}`,{cache:'no-store'})
      ]);
      if(dashboardResponse.status===401 || qualityResponse.status===401){
        try{localStorage.removeItem('erp_user');}catch{}
        router.replace('/login');
        return;
      }
      if(!dashboardResponse.ok) throw new Error('offline');
      const j=await dashboardResponse.json();
      if(j.connected){
        setConnected(true);
        setData({...fallback,...j,kpis:{...fallback.kpis,...j.kpis}});
        setLastUpdated(j.lastUpdated ? new Date(j.lastUpdated).toLocaleTimeString() : '');
      }else setConnected(false);
      if(qualityResponse.ok){
        const q=await qualityResponse.json();
        if(q.connected && Array.isArray(q.records)) setQualityRows(q.records);
      }
    }catch{ setConnected(false); }
    finally{setRefreshing(false);}
  }

  useEffect(()=>{
    try { if (!localStorage.getItem('erp_user')) { router.replace('/login'); return; } } catch { router.replace('/login'); return; }
    refresh(); const id=setInterval(refresh,30000); return ()=>clearInterval(id);
  },[router]);
  const filteredLines=useMemo(()=>data.lines.filter((r:any)=>
    (lineFactoryFilter==='All Factories'||r.factory===lineFactoryFilter) &&
    (lineStatusFilter==='All Status'||String(r.status||'').toLowerCase()===lineStatusFilter.toLowerCase()) &&
    Object.values(r).join(' ').toLowerCase().includes(query.toLowerCase())
  ),[data.lines,query,lineFactoryFilter,lineStatusFilter]);
  const totalPages=Math.max(1,Math.ceil(filteredLines.length/pageSize));
  const safePage=Math.min(page,totalPages);
  const rows=filteredLines.slice((safePage-1)*pageSize,safePage*pageSize);
  const globalKpis=data.kpis;
  const selectedFactoryRecord=data.factories.find((f:any)=>f.name===selectedFactory);
  const k=selectedFactory==='All Factories'?globalKpis:{runningOrders:Number(selectedFactoryRecord?.orders||0),monthlyShipment:Number(selectedFactoryRecord?.shipment||0),productionEfficiency:Number(selectedFactoryRecord?.productionPercent||0),criticalAlerts:data.lines.filter((r:any)=>r.factory===selectedFactory&&/delayed|critical|risk/i.test(String(r.status||''))).length};
  const totalProduction=useMemo(()=>data.lines.reduce((sum:number,r:any)=>sum+Number(r.output||0),0),[data.lines]);
  const periodLabel=fromDate&&toDate?`${fromDate} – ${toDate}`:'All dates';
  const criticalLines=data.lines.filter((r:any)=>/delayed|critical|risk|attention/i.test(String(r.status||'')));
  const factoryAnalytics=useMemo(()=>data.factories.map((f:any)=>{
    const lineRows=data.lines.filter((r:any)=>r.factory===f.name);
    const efficiencyRows=lineRows.map((r:any)=>Number(r.efficiency||0)).filter((n:number)=>n>0);
    const efficiency=efficiencyRows.length?Math.round(efficiencyRows.reduce((a:number,b:number)=>a+b,0)/efficiencyRows.length):Number(f.productionPercent||0);
    const capacityMinutes=Number(f.capacityMinutes||0);
    const orderMinutes=Number(f.orderMinutes||0);
    return {...f,capacityMinutes,orderMinutes,efficiency};
  }),[data.factories,data.lines]);
  const bestFactory=[...factoryAnalytics].sort((a:any,b:any)=>Number(b.efficiency||0)-Number(a.efficiency||0))[0];
  const qualityByFactory=useMemo(()=>{
    const names=Array.from(new Set([...data.factories.map((f:any)=>f.name),...qualityRows.map((r:any)=>String(r.Factory||'').trim()).filter(Boolean)]));
    return names.map((name:string)=>{
      const records=qualityRows.filter((r:any)=>String(r.Factory||'').trim()===name);
      const checked=records.reduce((s:number,r:any)=>s+Number(r['Checked Qty']||0),0);
      const defects=records.reduce((s:number,r:any)=>s+Number(r['Defect Qty']||0),0);
      const dhu=checked>0?Number((defects/checked*100).toFixed(2)):records.length?Number((records.reduce((s:number,r:any)=>s+Number(r['DHU %']||0),0)/records.length).toFixed(2)):0;
      return {name,dhu,checked,defects,inspections:records.length};
    });
  },[data.factories,qualityRows]);
  const defectTypes=useMemo(()=>{
    const counts:Record<string,{factory:string;type:string;count:number;defects:number}>={};
    qualityRows.forEach((r:any)=>{
      const type=String(r['Defect Type']||'').trim();
      const factory=String(r.Factory||'Unknown').trim()||'Unknown';
      if(!type) return;
      const key=`${factory}__${type}`;
      if(!counts[key]) counts[key]={factory,type,count:0,defects:0};
      counts[key].count+=1;
      counts[key].defects+=Number(r['Defect Qty']||0);
    });
    return Object.values(counts).sort((a,b)=>b.defects-a.defects);
  },[qualityRows]);
  const visibleFactoryAnalytics=selectedFactory==='All Factories'?factoryAnalytics:factoryAnalytics.filter((f:any)=>f.name===selectedFactory);
  const visibleQuality=selectedFactory==='All Factories'?qualityByFactory:qualityByFactory.filter((f:any)=>f.name===selectedFactory);
  const visibleProgress=useMemo(()=>{
    const term=(progressSearch||query).trim().toLowerCase();
    return (Array.isArray(data.poStyleProgress)?data.poStyleProgress:[]).filter((r:any)=>
      (selectedFactory==='All Factories'||r.factory===selectedFactory) &&
      (!term || [r.po,r.style,r.buyer,r.factory].some(v=>String(v||'').toLowerCase().includes(term)))
    );
  },[data.poStyleProgress,selectedFactory,progressSearch,query]);

  return <div className="tower-shell"><Sidebar connected={connected}/><main className="tower-content">
    <header className="page-header"><div><h1>Management Control Tower</h1><p>Real-time production, shipment, and operational visibility across Benchmark Group</p><small className="live-note">{connected?'LIVE • Google Sheets':'NOT CONNECTED • Configure Google Sheets'} · Updated {lastUpdated ? lastUpdated : '—'}</small></div><div className="header-actions"><div className="date-filter-wrap"><button type="button" className="field-btn" onClick={()=>{setDraftFrom(fromDate);setDraftTo(toDate);setDatePickerOpen(v=>!v);}}><CalendarDays size={16}/>{fromDate&&toDate?`${fromDate} - ${toDate}`:'All dates'}<ChevronDown size={14}/></button>{datePickerOpen&&<div className="date-range-popover"><strong>Dashboard date range</strong><label>From<input type="date" value={draftFrom} max={draftTo||undefined} onChange={e=>setDraftFrom(e.target.value)}/></label><label>To<input type="date" value={draftTo} min={draftFrom||undefined} onChange={e=>setDraftTo(e.target.value)}/></label><div className="date-range-actions"><button type="button" onClick={()=>{setFromDate('');setToDate('');setChartYear('All years');setDatePickerOpen(false);setPage(1);void refresh('','');}}>Clear</button><button type="button" className="primary-btn" disabled={!draftFrom||!draftTo||draftFrom>draftTo} onClick={()=>{setFromDate(draftFrom);setToDate(draftTo);setChartYear('Custom');setDatePickerOpen(false);setPage(1);void refresh(draftFrom,draftTo);}}>Apply range</button></div></div>}</div><label className="field-btn factory-select"><Factory size={16}/><select value={selectedFactory} onChange={e=>setSelectedFactory(e.target.value)}><option>All Factories</option>{data.factories.map((f:any)=><option key={f.name}>{f.name}</option>)}</select><ChevronDown size={14}/></label><label className="search-box"><Search size={16}/><input value={query} onChange={e=>{setQuery(e.target.value);setPage(1);}} placeholder="Search orders, lines, PO's..."/></label><div className="notification-wrap"><button type="button" className="bell-btn" aria-label="Notifications" onClick={()=>setNotificationsOpen(v=>!v)}><Bell size={19}/><em>{data.lines.filter((r:any)=>/delayed|critical|risk/i.test(String(r.status||''))).length}</em></button>{notificationsOpen&&<div className="notification-popover"><strong>Production alerts</strong>{data.lines.filter((r:any)=>/delayed|critical|risk|attention/i.test(String(r.status||''))).slice(0,6).map((r:any,i:number)=><div key={`${r.factory}-${r.line}-${i}`}><b>{r.factory} · Line {r.line}</b><span>{r.po||'No PO'} — {r.status}</span></div>)}{!data.lines.some((r:any)=>/delayed|critical|risk|attention/i.test(String(r.status||'')))&&<p>No production alerts in the loaded data.</p>}<Link href="/production" onClick={()=>setNotificationsOpen(false)}>Open Production</Link></div>}</div><div className="user-chip"><div className="user-photo">A</div><div><strong>Abtahi</strong><small>Group Admin</small></div><button type="button" aria-label="Sign out" title="Sign out" onClick={async()=>{await fetch('/api/erp',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'logout'})});try{localStorage.removeItem('erp_user');}catch{}router.replace('/login');}}><ChevronDown size={14}/></button></div></div></header>

    <section className="stats-grid">
      <Stat title="Total Running Orders" value={`${fmt(k.runningOrders)} pcs`} tone="blue" icon={<Boxes/>} change="12%"/>
      <Stat title="Shipment Quantity" value={`${fmt(k.monthlyShipment)} pcs`} tone="blue" icon={<Truck/>} change="8%"/>
      <Stat title="Production Efficiency" value={`${k.productionEfficiency}%`} tone="green" icon={<Target/>} change="3%"/>
      <Stat title="Critical Alerts" value={`${k.criticalAlerts}`} tone="red" icon={<AlertTriangle/>} change="2" down/>
    </section>

    <section className="hero-grid">
      <section className="panel compare-panel"><div className="panel-top"><div><h3>Factory Comparison</h3><p>Key metrics across all factories</p></div><button type="button" className="text-link-button" onClick={()=>setSelectedFactory('All Factories')}>View All Factories <ChevronRight size={14}/></button></div><div className="factory-grid">{data.factories.map((f:any)=><article className={`factory-card ${selectedFactory===f.name?'factory-card-selected':''}`} key={f.name} role="button" tabIndex={0} onClick={()=>setSelectedFactory(f.name)} onKeyDown={e=>{if(e.key==='Enter'||e.key===' ')setSelectedFactory(f.name);}}><div className="factory-thumb"><div className="building-scene"><div className="building-front"/><div className="building-side"/><div className="ground-line"/></div></div><div className="factory-title-row"><div><b>{f.name}</b><span>{f.lines} Sewing Lines</span></div><ChevronRight size={15}/></div><Metric label="Orders" value={fmt(f.orders)} percent={f.orderPercent??0}/><Metric label="Production" value={fmt(f.production)} percent={f.productionPercent??0}/><Metric label="Shipment" value={fmt(f.shipment)} percent={f.shipmentPercent??0} orange/></article>)}</div></section>
      <section className="panel chart-card"><div className="panel-top"><h3>Month-wise Orders & Shipments</h3><label className="small-filter"><select aria-label="Chart year" value={chartYear} onChange={e=>{const y=e.target.value;setChartYear(y);setPage(1);if(y==='All years'){setFromDate('');setToDate('');void refresh('','');}else if(y!=='Custom'){const start=`${y}-01-01`;const end=`${y}-12-31`;setFromDate(start);setToDate(end);void refresh(start,end);}}}><option>All years</option>{[2024,2025,2026,2027].map(y=><option key={y} value={String(y)}>{y}</option>)}{chartYear==='Custom'&&<option>Custom</option>}</select><ChevronDown size={13}/></label></div><div className="chart-legend"><span><i className="legend-dot blue"/>Orders (pcs)</span><span><i className="legend-dot green"/>Shipments (pcs)</span></div><div className="chart-wrap"><ResponsiveContainer width="100%" height={250}><BarChart data={data.months} barGap={5}><CartesianGrid stroke="#e9eef6" vertical={false}/><XAxis dataKey="month" axisLine={false} tickLine={false}/><YAxis tickFormatter={yfmt} axisLine={false} tickLine={false}/><Tooltip formatter={(v:any)=>fmt(Number(v))}/><Bar dataKey="orders" fill="#3b82f6" radius={[3,3,0,0]} barSize={12}/><Bar dataKey="shipments" fill="#22c55e" radius={[3,3,0,0]} barSize={12}/></BarChart></ResponsiveContainer></div></section>
    </section>

    <section className="analytics-grid">
      <section className="panel analytics-panel">
        <div className="panel-top"><div><h3>Order Workload vs Capacity — Factory-wise</h3><p>Order workload = Order Qty × SMV. Capacity = 480 × lines × operators per line × working days.</p></div><span className="analytics-unit">Working minutes</span></div>
        <div className="chart-legend"><span><i className="legend-dot blue"/>Order Workload (min)</span><span><i className="legend-dot green"/>Available Capacity (min)</span></div>
        <div className="chart-wrap"><ResponsiveContainer width="100%" height={260}><BarChart data={visibleFactoryAnalytics} barGap={7} margin={{top:8,right:12,left:4,bottom:8}}><CartesianGrid stroke="#e9eef6" vertical={false}/><XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize:10}}/><YAxis tickFormatter={yfmt} axisLine={false} tickLine={false}/><Tooltip formatter={(v:any,name:any)=>[`${fmt(Number(v))} min`,name]} labelFormatter={(label:any)=>`Factory: ${label}`}/><Bar dataKey="orderMinutes" name="Order Workload" fill="#3b82f6" radius={[4,4,0,0]} barSize={24}/><Bar dataKey="capacityMinutes" name="Available Capacity" fill="#22c55e" radius={[4,4,0,0]} barSize={24}/></BarChart></ResponsiveContainer></div>
      </section>
      <section className="panel analytics-panel">
        <div className="panel-top"><div><h3>Factory Performance — Production Efficiency</h3><p>Performance is measured by average recorded line efficiency.</p></div></div>
        <div className="chart-wrap"><ResponsiveContainer width="100%" height={286}><BarChart data={visibleFactoryAnalytics} layout="vertical" margin={{top:8,right:24,left:22,bottom:8}}><CartesianGrid stroke="#e9eef6" horizontal={false}/><XAxis type="number" domain={[0,100]} unit="%" axisLine={false} tickLine={false}/><YAxis type="category" dataKey="name" width={145} axisLine={false} tickLine={false} tick={{fontSize:10}}/><Tooltip formatter={(v:any)=>[`${Number(v).toFixed(1)}%`,'Average Efficiency']}/><Bar dataKey="efficiency" name="Production Efficiency" fill="#6366f1" radius={[0,5,5,0]} barSize={25}/></BarChart></ResponsiveContainer></div>
      </section>
      <section className="panel analytics-panel">
        <div className="panel-top"><div><h3>Quality Performance — Factory-wise DHU</h3><p>Lower DHU is better. DHU = defect quantity ÷ checked quantity × 100.</p></div></div>
        <div className="chart-wrap"><ResponsiveContainer width="100%" height={250}><BarChart data={visibleQuality} margin={{top:8,right:12,left:4,bottom:8}}><CartesianGrid stroke="#e9eef6" vertical={false}/><XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize:10}}/><YAxis unit="%" axisLine={false} tickLine={false}/><Tooltip formatter={(v:any,name:any,row:any)=>[`${Number(v).toFixed(2)}%`, 'DHU']} labelFormatter={(label:any)=>`Factory: ${label}`}/><Bar dataKey="dhu" name="DHU" fill="#f59e0b" radius={[4,4,0,0]} barSize={32}/></BarChart></ResponsiveContainer></div>
        <div className="quality-factory-list">{visibleQuality.map((q:any)=><div key={q.name} className="quality-factory-row"><b>{q.name}</b><span>{fmt(q.checked)} checked</span><strong className={q.dhu>5?'bad':q.dhu>2?'warn':'good'}>{q.dhu.toFixed(2)}% DHU</strong><small>{fmt(q.defects)} defects · {q.inspections} inspection(s)</small></div>)}</div>
      </section>
      <section className="panel analytics-panel">
        <div className="panel-top"><div><h3>Defect Types by Factory</h3><p>Recorded defect categories and defect quantities by factory.</p></div></div>
        {defectTypes.length ? <div className="defect-list">{defectTypes.filter((d:any)=>selectedFactory==='All Factories'||d.factory===selectedFactory).map((d:any)=><div className="defect-row" key={`${d.factory}-${d.type}`}><div><b>{d.type}</b><small>{d.factory}</small></div><span>{d.count} record(s)</span><strong>{fmt(d.defects)} defects</strong></div>)}</div> : <div className="analytics-empty">No defect types recorded yet. Add a Defect Type to each Quality entry to see factory-wise defect analysis.</div>}
      </section>
    </section>

    <section className="panel po-progress-panel">
      <div className="panel-top"><div><h3>PO &amp; Style-wise Production Progress</h3><p>Cumulative cutting, sewing and finishing as a percentage of ordered pieces, updated from Google Sheets.</p></div>
        <label className="mini-search"><Search size={15}/><input value={progressSearch} onChange={e=>setProgressSearch(e.target.value)} placeholder="Search PO, style, buyer..."/></label></div>
      <div className="table-scroll"><table className="po-progress-table"><thead><tr><th>Factory</th><th>Buyer</th><th>PO</th><th>Style</th><th>Order Qty</th><th>Cutting</th><th>Sewing</th><th>Finishing</th><th>Balance to Finish</th><th>Validation</th></tr></thead>
        <tbody>{visibleProgress.map((r:any,i:number)=><tr key={`${r.factory}-${r.po}-${r.style}-${i}`}><td>{r.factory}</td><td>{r.buyer||'—'}</td><td><b>{r.po}</b></td><td>{r.style||'—'}</td><td><b>{fmt(r.orderQty)}</b></td>
          <td><ProgressCell qty={r.cutting} percent={r.cuttingPct} tone="cut"/></td><td><ProgressCell qty={r.sewing} percent={r.sewingPct} tone="sew"/></td><td><ProgressCell qty={r.finishing} percent={r.finishingPct} tone="finish"/></td>
          <td>{r.orderQty>0?fmt(r.finishingBalance):'—'}</td><td>{r.warning?<span className="bad">{r.warning}</span>:<span className="good">OK</span>}</td></tr>)}
          {!visibleProgress.length&&<tr><td colSpan={10} className="po-progress-empty">{connected?'No matching PO/style records. Ensure Orders and Production have matching Factory, PO and Style.':'Connect Google Sheets to load PO/style progress. No demo progress is displayed.'}</td></tr>}
        </tbody></table></div>
      <p className="progress-footnote">Progress = cumulative stage quantity ÷ Order Qty × 100. More than 100% is shown and flagged; missing order quantity is displayed as —. Check matching PO, factory and style codes before relying on totals.</p>
    </section>

    <section className="bottom-grid"><section className="panel table-card"><div className="panel-top"><div><h3>Line-wise Production Status</h3><p>Real-time line level production, target vs output and status</p></div><div className="table-toolbar"><label className="table-btn"><select aria-label="Filter line table by factory" value={lineFactoryFilter} onChange={e=>{setLineFactoryFilter(e.target.value);setPage(1);}}><option>All Factories</option>{data.factories.map((f:any)=><option key={f.name}>{f.name}</option>)}</select><ChevronDown size={13}/></label><label className="table-btn"><select aria-label="Filter line table by status" value={lineStatusFilter} onChange={e=>{setLineStatusFilter(e.target.value);setPage(1);}}><option>All Status</option>{Array.from(new Set(data.lines.map((r:any)=>String(r.status||'Pending')))).map((v:string)=><option key={v} value={v}>{v}</option>)}</select><ChevronDown size={13}/></label><label className="mini-search"><Search size={14}/><input value={query} onChange={e=>{setQuery(e.target.value);setPage(1);}} placeholder="Search line, order or PO..."/></label><button type="button" className="icon-square" title="Refresh dashboard data" onClick={()=>void refresh()} disabled={refreshing}><Wrench size={14}/></button></div></div><div className="table-scroll"><table><thead><tr><th>#</th><th>Line</th><th>Factory</th><th>Current Order / PO</th><th>Target (pcs)</th><th>Output (pcs)</th><th>Efficiency</th><th>Reject (pcs)</th><th>Status</th><th>•••</th></tr></thead><tbody>{rows.map((r:any,i:number)=><tr key={`${r.line}-${r.po}`}><td>{(safePage-1)*pageSize+i+1}</td><td><b>Line {r.line}</b></td><td>{r.factory}</td><td>{r.po}</td><td>{fmt(r.target)}</td><td>{fmt(r.output)}</td><td><b className={r.efficiency>=90?'good':r.efficiency>=80?'warn':'bad'}>{r.efficiency}%</b></td><td>{fmt(r.reject)}</td><td><span className={`status-pill ${String(r.status).toLowerCase().replace(' ','-')}`}><i/>{r.status}</span></td><td><button type="button" className="row-open-button" title={`Open production records for ${r.po||'this line'}`} onClick={()=>router.push('/production')}>⋮</button></td></tr>)}{rows.length===0&&<tr><td colSpan={10} className="module-empty">No production lines match these filters.</td></tr>}</tbody></table></div><div className="table-footer"><span>Showing {filteredLines.length?((safePage-1)*pageSize+1):0} - {Math.min(safePage*pageSize,filteredLines.length)} of {filteredLines.length} lines</span><div className="pager"><button type="button" aria-label="Previous page" disabled={safePage<=1} onClick={()=>setPage(p=>Math.max(1,p-1))}><ChevronLeft size={14}/></button>{Array.from({length:Math.min(5,totalPages)},(_,i)=>Math.max(1,Math.min(totalPages-4,safePage-2))+i).filter(n=>n<=totalPages).map(n=><button type="button" key={n} className={safePage===n?'current':''} onClick={()=>setPage(n)}>{n}</button>)}<button type="button" aria-label="Next page" disabled={safePage>=totalPages} onClick={()=>setPage(p=>Math.min(totalPages,p+1))}><ChevronRight size={14}/></button><label className="per-page"><select aria-label="Rows per page" value={pageSize} onChange={e=>{setPageSize(Number(e.target.value));setPage(1);}}>{[10,25,50,100].map(n=><option key={n} value={n}>{n} / page</option>)}</select></label></div></div></section>
      <section className="right-stack"><div className="two-mini-grid"><Summary icon={<Truck/>} title={`Shipment Summary (${periodLabel})`} value={`${fmt(k.monthlyShipment)} pcs`} sub="Actual shipment quantity in the selected period" tone="blue"/><Summary icon={<Gauge/>} title={`Production Report (${periodLabel})`} value={`${fmt(totalProduction)} pcs`} sub={`${k.productionEfficiency}% efficiency across loaded production lines`} tone="green"/></div><section className="panel ai-panel"><div className="panel-top"><h3><Sparkles size={16}/> AI Insights <span className="beta-badge">Live signals</span></h3><Link href="/insights" className="text-link-button">View More <ChevronRight size={14}/></Link></div>{criticalLines.slice(0,3).map((r:any,i:number)=><Insight key={`${r.factory}-${r.line}-${i}`} tone="orange" icon={<AlertTriangle size={14}/>} title={`${r.factory}: ${r.status} production line`} text={`Line ${r.line} · ${r.po||'No PO'} · output ${fmt(r.output)} / target ${fmt(r.target)} pcs.`} time="Current data"/>)}{bestFactory&&Number(bestFactory.efficiency||0)>0&&<Insight key="best-factory" tone="green" icon={<LineChart size={14}/>} title={`${bestFactory.name}: highest recorded efficiency`} text={`Average line efficiency ${Number(bestFactory.efficiency).toFixed(1)}% from available production records.`} time="Current data"/>}{criticalLines.length===0&&(!bestFactory||Number(bestFactory.efficiency||0)===0)&&<div className="analytics-empty">No production alerts or efficiency signals can be calculated from the current records. Add production entries to generate live insights.</div>}</section><section className="panel roles-panel"><div className="panel-top"><h3>User Roles & Permissions</h3><Link href="/users" className="text-link-button">Manage Users <ChevronRight size={14}/></Link></div><div className="roles-grid"><Role icon={<UserCog size={13}/>} title="Admin" sub="Full access"/><Role icon={<Factory size={13}/>} title="Factory Manager" sub="Factory-wise access"/><Role icon={<Users size={13}/>} title="Sewing Supervisor" sub="Line-level access"/><Role icon={<ShieldCheck size={13}/>} title="QA" sub="Quality data entry"/></div></section></section>
    </section>
  </main></div>;
}

function Stat({title,value,tone,icon,change,down=false}:{title:string,value:string,tone:string,icon:any,change:string,down?:boolean}){return <section className={`stat-card stat-${tone}`}><div className="stat-icon">{icon}</div><div className="stat-copy"><span>{title}</span><strong>{value}</strong><p className={down?'negative':'positive'}>{down?<ArrowDown size={12}/>:<ArrowUp size={12}/>} {change} <em>{down?'vs last week':'vs last month'}</em></p></div><div className={`spark spark-${tone}`}>{[3,4,5,6,7,8,10].map((v,i)=><i key={i} style={{height:v*7}}/>)}</div></section>}
function Metric({label,value,percent,orange=false}:{label:string,value:string,percent:number,orange?:boolean}){return <div className="progress-metric"><div className="progress-head"><span>{label}</span><b>{value}</b></div><div className={`progress-track ${orange?'track-orange':''}`}><i style={{width:`${Math.min(100,Math.max(0,Number(percent)||0))}%`}}/></div><small>{percent}%</small></div>}
function Summary({icon,title,value,sub,tone}:{icon:any,title:string,value:string,sub:string,tone:string}){return <div className="panel summary-mini"><div className={`summary-mini-icon ${tone}`}>{icon}</div><div className="summary-mini-copy"><span>{title}</span><Link href={title.startsWith('Shipment')?'/shipment':'/production'}>View Details →</Link><strong>{value}</strong><p>{sub}</p><div className={`summary-meter ${tone}`}/></div></div>}
function Insight({icon,title,text,time,tone='purple'}:{icon:any,title:string,text:string,time:string,tone?:string}){return <div className="insight-row"><div className={`insight-badge ${tone}`}>{icon}</div><div className="insight-text"><b>{title}</b><p>{text}</p></div><time>{time}</time></div>}
function Role({icon,title,sub}:{icon:any,title:string,sub:string}){return <Link href="/users" className="role-card"><div className="role-icon">{icon}</div><div><b>{title}</b><small>{sub}</small></div></Link>}

function ProgressCell({qty,percent,tone}:{qty:number;percent:number|null;tone:'cut'|'sew'|'finish'}){
  return <div className="stage-progress"><div className="stage-progress-caption"><b>{fmt(qty)}</b><strong className={percent!==null&&percent>100?'bad':''}>{percent===null?'—':`${percent.toFixed(1)}%`}</strong></div><div className="stage-progress-track"><i className={`stage-progress-${tone}`} style={{width:`${Math.min(100,Math.max(0,percent??0))}%`}}/></div></div>;
}
