'use client';
import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Search, RefreshCw, Download, X, Save, Database, Pencil, Trash2 } from 'lucide-react';
import Sidebar from './Sidebar';

type Field = { key: string; label: string; type?: 'text'|'number'|'date'|'select'; options?: string[]; required?: boolean };
type ModuleConfig = { title: string; subtitle: string; module: string; fields: Field[]; columns: string[] };
const configs: Record<string,ModuleConfig> = {
  orders:{title:'Orders Management',subtitle:'Order master, SMV workload and shipment planning',module:'orders',fields:[{key:'Date',label:'Order date',type:'date'},{key:'Buyer',label:'Buyer',required:true},{key:'PO Number',label:'PO number',required:true},{key:'Style',label:'Style',required:true},{key:'Factory',label:'Factory',type:'select',options:['Benchmark Apparels','Benchmark Exports','Fabtex'],required:true},{key:'Order Qty',label:'Order quantity (pcs)',type:'number',required:true},{key:'SMV',label:'SMV (minutes per piece)',type:'number',required:true},{key:'Shipment Date',label:'Shipment date',type:'date'},{key:'Status',label:'Status',type:'select',options:['Running','On Track','Attention','Delayed','Completed','Shipped']}],columns:['PO Number','Buyer','Style','Factory','Order Qty','SMV','Order Minutes','Shipment Date','Status']},
  merchandising:{title:'Merchandising',subtitle:'Buyer, style, season and order handover management',module:'merchandising',fields:[{key:'Date',label:'Date',type:'date'},{key:'Buyer',label:'Buyer',required:true},{key:'PO Number',label:'PO number',required:true},{key:'Style',label:'Style',required:true},{key:'Factory',label:'Factory',type:'select',options:['Benchmark Apparels','Benchmark Exports','Fabtex'],required:true},{key:'Season',label:'Season',type:'select',options:['Spring/Summer','Fall/Winter','Core','Other']},{key:'Product',label:'Product'},{key:'Quantity',label:'Quantity',type:'number'},{key:'Target Date',label:'Target date',type:'date'},{key:'Status',label:'Status',type:'select',options:['Pending','Running','Approved','Attention','Completed']}],columns:['PO Number','Buyer','Style','Factory','Season','Quantity','Target Date','Status']},
  planning:{title:'Production Planning',subtitle:'Factory, buyer, PO, style and line-wise planning',module:'planning',fields:[{key:'Date',label:'Plan date',type:'date'},{key:'Factory',label:'Factory',type:'select',options:['Benchmark Apparels','Benchmark Exports','Fabtex'],required:true},{key:'Buyer',label:'Buyer',required:true},{key:'PO',label:'PO number',required:true},{key:'Style',label:'Style',required:true},{key:'Line',label:'Line',required:true},{key:'Plan Qty',label:'Planned quantity',type:'number',required:true},{key:'Start Date',label:'Start date',type:'date'},{key:'End Date',label:'End date',type:'date'},{key:'Status',label:'Status',type:'select',options:['Planned','Running','At Risk','Delayed','Completed']}],columns:['Factory','Buyer','PO','Style','Line','Plan Qty','Start Date','End Date','Status']},
  'material-control':{title:'Material Control',subtitle:'Material purchase orders, requirements, receipts and shortages',module:'material',fields:[{key:'Date',label:'Date',type:'date'},{key:'PO',label:'PO number',required:true},{key:'Factory',label:'Factory',type:'select',options:['Benchmark Apparels','Benchmark Exports','Fabtex'],required:true},{key:'Material Type',label:'Material type',type:'select',options:['Fabric','Trims','Accessories','Packaging','Other'],required:true},{key:'Material',label:'Material name',required:true},{key:'Unit',label:'Unit',type:'select',options:['pcs','kg','meter','yard','cone','roll','set']},{key:'Required Qty',label:'Required quantity',type:'number'},{key:'Ordered Qty',label:'Ordered quantity',type:'number'},{key:'Received Qty',label:'Received quantity',type:'number'},{key:'Issued Qty',label:'Issued quantity',type:'number'},{key:'Balance Qty',label:'Balance quantity',type:'number'},{key:'Supplier',label:'Supplier'},{key:'Expected Date',label:'Expected date',type:'date'},{key:'Status',label:'Status',type:'select',options:['Pending','Ordered','Partial','Received','Shortage','Complete']}],columns:['PO','Factory','Material Type','Material','Required Qty','Ordered Qty','Received Qty','Balance Qty','Expected Date','Status']},
  store:{title:'Store & Receiving',subtitle:'Goods received notes, material issues and stock balance',module:'store',fields:[{key:'Date',label:'Date',type:'date'},{key:'PO',label:'PO number',required:true},{key:'Factory',label:'Factory',type:'select',options:['Benchmark Apparels','Benchmark Exports','Fabtex'],required:true},{key:'GRN Number',label:'GRN number',required:true},{key:'Item Type',label:'Item type',type:'select',options:['Fabric','Trims','Accessories','Packaging','Finished Goods','Other']},{key:'Item',label:'Item description',required:true},{key:'Unit',label:'Unit',type:'select',options:['pcs','kg','meter','yard','cone','roll','set']},{key:'GRN Qty',label:'Received quantity',type:'number',required:true},{key:'Issue Qty',label:'Issued quantity',type:'number'},{key:'Balance Qty',label:'Balance quantity',type:'number'},{key:'Supplier',label:'Supplier'},{key:'Received By',label:'Received by'},{key:'Status',label:'Status',type:'select',options:['Received','Partial','Issued','Closed']}],columns:['GRN Number','PO','Factory','Item Type','Item','GRN Qty','Issue Qty','Balance Qty','Status']},
  production:{title:'Production Control',subtitle:'Daily line output, targets, efficiency and rejects',module:'production',fields:[{key:'Date',label:'Date',type:'date',required:true},{key:'Factory',label:'Factory',type:'select',options:['Benchmark Apparels','Benchmark Exports','Fabtex'],required:true},{key:'Line',label:'Line',required:true},{key:'Style',label:'Style',required:true},{key:'PO',label:'PO number',required:true},{key:'Target',label:'Target quantity',type:'number',required:true},{key:'Cutting',label:'Cutting quantity',type:'number'},{key:'Sewing Output',label:'Sewing output',type:'number'},{key:'Finishing',label:'Finishing quantity',type:'number'},{key:'FG Qty',label:'Finished goods quantity',type:'number'},{key:'Efficiency',label:'Efficiency (%)',type:'number'},{key:'Reject',label:'Reject quantity',type:'number'},{key:'Status',label:'Status',type:'select',options:['On Track','Attention','Delayed','Completed']}],columns:['Date','Factory','Line','Style','PO','Target','Sewing Output','FG Qty','Efficiency','Reject','Status']},
  shipment:{title:'Shipment Control Tower',subtitle:'Shipment planning, actual dispatch and delivery tracking',module:'shipment',fields:[{key:'Date',label:'Shipment date',type:'date'},{key:'PO',label:'PO number',required:true},{key:'Factory',label:'Factory',type:'select',options:['Benchmark Apparels','Benchmark Exports','Fabtex'],required:true},{key:'Shipment Plan',label:'Planned quantity',type:'number'},{key:'Actual Shipment',label:'Actual shipment quantity',type:'number',required:true},{key:'Carton Qty',label:'Carton quantity',type:'number'},{key:'ETD',label:'ETD',type:'date'},{key:'Status',label:'Status',type:'select',options:['Planned','Ready','Shipped','Delayed','Delivered']}],columns:['Date','PO','Factory','Shipment Plan','Actual Shipment','Carton Qty','ETD','Status']},
  reports:{title:'Reports & Analytics',subtitle:'Explore reconciled order-to-shipment quantities from Google Sheets',module:'reconciliation',fields:[],columns:['buyer','style','po','factory','orderQty','materialIssued','cutQty','sewQty','finishQty','fgQty','shipmentQty','balance','variance','status']},
  insights:{title:'AI Insights',subtitle:'Operational signals based on loaded production and quality records',module:'production',fields:[],columns:['Date','Factory','Line','PO','Style','Target','Cutting','Sewing Output','Finishing','Efficiency','Reject','Status']},
  settings:{title:'System Settings',subtitle:'Google Sheets connection health and synchronization status',module:'health',fields:[],columns:['message','time']},
  users:{title:'Users & Permissions',subtitle:'Read-only view of ERP user roles and factory assignments',module:'users',fields:[],columns:['username','name','role','factoryAccess','mustChangePassword']},
  quality:{title:'Quality Control',subtitle:'Inspection results, defects, rejects and automatic DHU',module:'quality',fields:[{key:'Date',label:'Inspection date',type:'date',required:true},{key:'PO',label:'PO number',required:true},{key:'Factory',label:'Factory',type:'select',options:['Benchmark Apparels','Benchmark Exports','Fabtex'],required:true},{key:'Line',label:'Line'},{key:'Inspection Type',label:'Inspection type',type:'select',options:['Inline','End Line','Final','AQL']},{key:'Checked Qty',label:'Checked quantity',type:'number',required:true},{key:'Defect Qty',label:'Defect quantity',type:'number',required:true},{key:'Defect Type',label:'Defect type',type:'select',options:['B01 - Waistband Irregular/Waistband Hi-Low','B02 - Up-Down','B03 - Puckering or Twisted Hem','B04 - Needle Mark','B05 - Scissor Cut','B06 - Measurement Out of Toll. (+/-)','B07 - Needle Cut','B08 - Sewing Thread Mistake','B09 - Label Mistake','B10 - Label Bias','B11 - Color Shading','B12 - Missing Bartack','B13 - Button Placement Wrong','B14 - Shining Mark','B15 - Point Up-Down','B16 - Irregular bottom or Side Seam Shape','B17 - Uneven Leg or Uneven Sleeve (Over 3/)','B18 - Uneven Leg or Uneven Sleeve (Below 3/)','B19 - Under Fetching Show on Top','B20 - Front/Back Part Show','B21 - Broken Stitch','B22 - Uneven Stitch','B23 - Irregular Stitch','B24 - Cracked Stitch','B25 - Ugly Joint Stitch','B26 - Stain/Marks/spot','B27 - Skipped Stitch','B28 - Dropped stitch/ Down Stitch','B29 - Ugly Joint Stitch','B30 - Blind Stitch Mark','B31 - Missing Zigzag','B32 - Fair Uneven (Over 3/8")','B33 - Fair Uneven (Below 3/8")','B34 - Loose Threads (Over 1/2")','B35 - Loose Threads (Below 1/2")','B36 - Uncut Threads (Over 1/2")','B37 - Uncut Threads (Over 1/2")','B38 - Open Seam','B39 - Thread Color Mistake','B40 - Thread Tension Which Cause imp','B41 - Sewing pleat Up to 1/4" Pleat Outside','B42 - Sewing pleat Up to 1/4" Pleat Inside','B43 - Rawedge on Outside seam side','B44 - Rawedge on Inside seam side','B45 - False Sewing','B46 - Inseam Point Uneven','B47 - In Layout','B48 - Miss Placed Printing','B49 - Printing Faults(Printing Stain)','B50 - Printing Faults(Off Printing)','B51 - Glitter/Diamantes Rubbing Off print','B52 - Color off shade or Not As Specified','B53 - Wrong Printing','B54 - Chalk/Pencil Mark Looking Sight','B55 - Chalk/Pencil Mark Looking Very Poor','B56 - Powder Mark','B57 - Dirty','B58 - Elastic Face Back','B59 - Incorrect Crotch Shape pr Crotch sainted','B60 - Fabric Fault','S61 - Uneven Plucket Width','S62 - Incorrect Plucket Width','S63 - Uneven Plucket Length','S64 - Visible Under Plucket','B65 - Wrong Folding Size']},{key:'Reject Qty',label:'Reject quantity',type:'number'},{key:'DHU %',label:'DHU (%)',type:'number'},{key:'Status',label:'Status',type:'select',options:['Pass','Attention','Fail','Re-inspection']}],columns:['Date','PO','Factory','Line','Inspection Type','Checked Qty','Defect Qty','Defect Type','Reject Qty','DHU %','Status']},
};
const fmt=(v:any)=>v===null||v===undefined||v===''?'—':typeof v==='number'?v.toLocaleString():String(v);
function downloadCsv(filename:string, rows:any[]){if(!rows.length){alert('No records to export.');return;}const keys=Object.keys(rows[0]).filter(k=>!k.startsWith('_'));const cell=(v:any)=>`"${String(v??'').replace(/"/g,'""')}"`;const csv=[keys.map(cell).join(','),...rows.map(r=>keys.map(k=>cell(r[k])).join(','))].join('\r\n');const url=URL.createObjectURL(new Blob(['\ufeff',csv],{type:'text/csv;charset=utf-8;'}));const a=document.createElement('a');a.href=url;a.download=filename;a.click();URL.revokeObjectURL(url);}
export default function ModulePage({moduleKey}:{moduleKey:string}){
 const cfg=configs[moduleKey]||configs.orders;
 const router=useRouter();
 const isFactoryProtected=moduleKey==='production'||moduleKey==='quality';
 const [user,setUser]=useState<any>(null);
 const [rows,setRows]=useState<any[]>([]);
 const [connected,setConnected]=useState(false);
 const [loading,setLoading]=useState(true);
 const [query,setQuery]=useState('');
 const [modal,setModal]=useState(false);
 const [editing,setEditing]=useState<any>(null);
 const [form,setForm]=useState<Record<string,any>>({});
 const [error,setError]=useState('');
 const [busy,setBusy]=useState(false);
 const [pinModal,setPinModal]=useState(false);
 const [pinFactory,setPinFactory]=useState('');
 const [factoryPin,setFactoryPin]=useState('');
 const [pinError,setPinError]=useState('');
 const [pinBusy,setPinBusy]=useState(false);
 const [pinPurpose,setPinPurpose]=useState<'new'|'edit'|'delete'|null>(null);
 const [pendingRow,setPendingRow]=useState<any>(null);
 const [activeFactoryPin,setActiveFactoryPin]=useState('');
 const [activeFactory,setActiveFactory]=useState('');
 const isAdmin=String(user?.role||'').trim().toLowerCase()==='admin';
 const assignedFactory=String(user?.factoryAccess||user?.factory||'').trim();
 const factoryOptions=['Benchmark Apparels','Benchmark Exports','Fabtex'];

 const load=useCallback(async()=>{
  setLoading(true);
  try{
   let url=`/api/erp?action=list&module=${encodeURIComponent(cfg.module)}`;
   if(moduleKey==='reports')url='/api/erp?action=reconciliation';
   if(moduleKey==='settings')url='/api/erp?action=health';
   const r=await fetch(url,{cache:'no-store'});
   if(r.status===401){try{localStorage.removeItem('erp_user');}catch{}router.replace('/login');throw new Error('Your ERP session expired. Please sign in again.');}
   const j=await r.json();
   if(!r.ok||!j.connected)throw new Error(j.error||'Could not load records from Google Sheets.');
   const records=moduleKey==='reports'?(Array.isArray(j.reconciliation)?j.reconciliation:[]):moduleKey==='settings'?[{message:j.message||'API responding',time:j.time||''}]:Array.isArray(j.records)?j.records:[];
   if(moduleKey!=='settings'&&!Array.isArray(records))throw new Error(j.error||'Google Sheets returned an invalid record list.');
   setRows(records);setConnected(true);setError('');
  }catch(e:any){setConnected(false);setError(e.message||'Google Sheets is not connected.');setRows([]);}
  finally{setLoading(false);}
 },[cfg.module]);

 useEffect(()=>{
  try{
   const raw=localStorage.getItem('erp_user');
   if(!raw){router.replace('/login');return;}
   setUser(JSON.parse(raw));
  }catch{router.replace('/login');return;}
  load();
  const id=setInterval(load,30000);
  return()=>clearInterval(id);
 },[load,router]);

 const filtered=useMemo(()=>rows.filter(r=>Object.entries(r).filter(([k])=>!k.startsWith('_')).some(([,v])=>String(v??'').toLowerCase().includes(query.toLowerCase()))),[rows,query]);
 const columns=cfg.columns.length?cfg.columns:(rows[0]?Object.keys(rows[0]).filter(k=>!k.startsWith('_')&&k!=='Record ID'&&k!=='Created At'&&k!=='Updated At'):[]);

 function openNewAuthorized(factory:string,pin=''){
  setEditing(null);setActiveFactory(factory);setActiveFactoryPin(pin);
  const initial:any={};
  cfg.fields.forEach(f=>initial[f.key]=f.key==='Factory'&&isFactoryProtected?factory:f.type==='date'?new Date().toISOString().slice(0,10):'');
  setForm(initial);setError('');setModal(true);
 }
 function openEditAuthorized(row:any,factory:string,pin=''){
  setEditing(row);setActiveFactory(factory);setActiveFactoryPin(pin);
  const initial:any={};
  cfg.fields.forEach(f=>{let v=row[f.key]??'';if(f.type==='date'&&v){const d=new Date(v);v=isNaN(d.getTime())?String(v).slice(0,10):d.toISOString().slice(0,10);}if(f.key==='Factory'&&isFactoryProtected)v=factory;initial[f.key]=v;});
  setForm(initial);setError('');setModal(true);
 }
 function requestFactoryAccess(purpose:'new'|'edit'|'delete',row:any=null){
  setPinPurpose(purpose);setPendingRow(row);setPinFactory(String(row?.Factory||assignedFactory||''));setFactoryPin('');setPinError('');setPinModal(true);
 }
 function handleNew(){if(isFactoryProtected)requestFactoryAccess('new');else openNewAuthorized('');}
 function handleEdit(row:any){if(isFactoryProtected)requestFactoryAccess('edit',row);else openEditAuthorized(row,'');}
 function closeEntryModal(){setModal(false);setActiveFactoryPin('');setActiveFactory('');setEditing(null);}

 async function performDelete(row:any,pin=''){
  if(!row?.['Record ID']){alert('This existing row has no Record ID. Run setupBenchmarkERP() again to assign IDs, then retry.');return;}
  if(!confirm('Delete this record from Google Sheets? This cannot be undone.'))return;
  try{
   const r=await fetch('/api/erp',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'delete',module:cfg.module,recordId:row['Record ID'],factoryPin:pin})});
   const j=await r.json();if(!r.ok||!j.ok)throw new Error(j.error||'Delete failed.');
   await load();
  }catch(e:any){alert(e.message||'Delete failed.');}
 }
 async function submitFactoryPin(e:FormEvent){
  e.preventDefault();setPinBusy(true);setPinError('');
  try{
   if(!pinPurpose)throw new Error('Choose an action to continue.');
   if(!isAdmin&&!assignedFactory)throw new Error('Your account has no factory assigned. Ask the ERP administrator to set Factory Access in ERP_Users.');
   if(!isAdmin&&pinFactory!==assignedFactory)throw new Error('Your account is not authorized for the selected factory.');
   const r=await fetch('/api/erp',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'verifyfactorypin',module:cfg.module,factory:pinFactory,pin:factoryPin})});
   const j=await r.json();if(!r.ok||!j.ok||!j.verified)throw new Error(j.error||'Factory PIN verification failed.');
   const pin=factoryPin;const factory=pinFactory;const purpose=pinPurpose;const row=pendingRow;
   setPinModal(false);setFactoryPin('');setPinPurpose(null);setPendingRow(null);
   if(purpose==='new')openNewAuthorized(factory,pin);
   else if(purpose==='edit'&&row)openEditAuthorized(row,factory,pin);
   else if(purpose==='delete'&&row)await performDelete(row,pin);
  }catch(e:any){setPinError(e.message||'Could not verify factory PIN.');}
  finally{setPinBusy(false);}
 }

 async function save(e:FormEvent){
  e.preventDefault();setBusy(true);setError('');
  try{
   if(isFactoryProtected&&(!activeFactoryPin||!activeFactory||String(form.Factory||'')!==activeFactory))throw new Error('Factory authorization is missing. Close this form and verify the factory PIN again.');
   const record={...form};
   if(cfg.module==='orders'){record.SMV=Number(record.SMV||0);record['Order Minutes']=Number((Number(record['Order Qty']||0)*record.SMV).toFixed(2));}
   if(cfg.module==='quality'){const checked=Number(record['Checked Qty']||0);record['DHU %']=checked>0?Number((Number(record['Defect Qty']||0)/checked*100).toFixed(2)):0;}
   const r=await fetch('/api/erp',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'save',module:cfg.module,record,recordId:editing?.['Record ID']||'',factoryPin:isFactoryProtected?activeFactoryPin:undefined})});
   const j=await r.json();if(!r.ok||!j.ok)throw new Error(j.error||'Save failed.');
   closeEntryModal();await load();
  }catch(e:any){setError(e.message||'Unable to save record.');}
  finally{setBusy(false);}
 }
 function requestDelete(row:any){
  if(isFactoryProtected){requestFactoryAccess('delete',row);return;}
  void performDelete(row);
 }
 const reportsOnly=['reports','insights','settings','users'].includes(moduleKey);
 return <div className="tower-shell"><Sidebar connected={connected}/><main className="tower-content module-content">
  <header className="page-header module-header"><div><div className="module-eyebrow">BENCHMARK GROUP · ERP MODULE</div><h1>{cfg.title}</h1><p>{cfg.subtitle}</p><small className={`module-live ${connected?'':'offline'}`}><i/> {connected?'Connected to Google Sheets · auto-refresh every 30 seconds':'Google Sheets disconnected'}</small>{isFactoryProtected&&<small className="module-live"><i/> Factory PIN protection enabled · {isAdmin?'Admin access':assignedFactory||'Factory not assigned'}</small>}</div><div className="module-actions"><button className="field-btn" onClick={load}><RefreshCw size={16}/>Refresh</button><button className="field-btn" onClick={()=>downloadCsv(`${cfg.module}-records.csv`,filtered)}><Download size={16}/>Export CSV</button>{!reportsOnly&&<button className="primary-btn" onClick={handleNew}><Plus size={17}/> {moduleKey==='store'?'New Receive Entry':moduleKey==='material-control'?'New Material PO':'New Entry'}</button>}</div></header>
  {error&&<div className="module-error">{error}</div>}
  {moduleKey==='settings'&&<section className="module-stats"><article><Database/><strong>Google Sheets API</strong><span>{connected?'Connected':'Not connected'}</span><p>Data is requested through the server API. Keep the API token in .env.local only.</p><button className="primary-btn" onClick={load}>Test connection</button></article><article><RefreshCw/><strong>Automatic refresh</strong><span>Every 30 seconds</span><p>Dashboard, reconciliation and module lists refresh from the sheet on a timer.</p></article></section>}
  {moduleKey==='users'&&<div className="module-notice">This is a read-only user directory. Manage user accounts in the <b>ERP_Users</b> sheet; assign factory access explicitly and configure Production/Quality PINs through the authorized Apps Script setup functions. Non-admin users may be denied access to this directory by design.</div>}
  {moduleKey==='insights'&&<section className="module-stats"><article><strong>Production records</strong><span>{rows.length.toLocaleString()}</span><p>Production entries currently available to your account.</p></article><article><strong>Delayed / risk records</strong><span>{rows.filter((r:any)=>/delayed|critical|risk|attention/i.test(String(r.Status||''))).length.toLocaleString()}</span><p>Entries requiring review based on recorded status.</p></article><article><strong>Average efficiency</strong><span>{rows.length?`${(rows.reduce((n:number,r:any)=>n+Number(r.Efficiency||0),0)/Math.max(1,rows.filter((r:any)=>Number(r.Efficiency||0)>0).length)).toFixed(1)}%`:'0%'}</span><p>Calculated from records with an efficiency value.</p></article></section>}
  <section className="module-panel"><div className="module-toolbar"><div><h2>{reportsOnly?'Data Explorer':'Records'}</h2><p>{loading?'Loading data…':`${filtered.length.toLocaleString()} record(s) · source of truth: Google Sheets`}</p></div><label className="module-search"><Search size={17}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search PO, buyer, style, factory…"/></label></div>
   <div className="module-table-wrap"><table className="module-table"><thead><tr>{columns.map(c=><th key={c}>{c}</th>)}{!reportsOnly&&<th>Actions</th>}</tr></thead><tbody>{loading?<tr><td colSpan={Math.max(columns.length+1,1)} className="module-empty">Loading Google Sheets data…</td></tr>:filtered.length===0?<tr><td colSpan={Math.max(columns.length+1,1)} className="module-empty">{connected?'No records found. Use New Entry to add one.':'Connect Google Sheets to load records.'}</td></tr>:filtered.map((row,i)=><tr key={String(row['Record ID']||row._rowNumber||i)}>{columns.map(c=><td key={c}>{fmt(row[c])}</td>)}{!reportsOnly&&<td><div className="row-actions"><button title="Edit" onClick={()=>handleEdit(row)}><Pencil size={15}/></button><button title="Delete" onClick={()=>requestDelete(row)}><Trash2 size={15}/></button></div></td>}</tr>)}</tbody></table></div>
  </section>
  {pinModal&&<div className="module-modal-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget){setPinModal(false);setFactoryPin('');setPinError('');setPinPurpose(null);setPendingRow(null);}}}><section className="module-modal factory-pin-modal"><header><div><h2>Factory authorization required</h2><p>Verify your factory PIN before accessing {moduleKey==='production'?'Production':'Quality'} data.</p></div><button type="button" className="modal-close" onClick={()=>{setPinModal(false);setFactoryPin('');setPinError('');setPinPurpose(null);setPendingRow(null);}}><X size={18}/></button></header><form onSubmit={submitFactoryPin}><div className="module-form-grid"><label>Factory<select required value={pinFactory} disabled={!isAdmin} onChange={e=>setPinFactory(e.target.value)}><option value="">Select factory…</option>{(isAdmin?factoryOptions:(assignedFactory?[assignedFactory]:[])).map(f=><option key={f} value={f}>{f}</option>)}</select></label><label>Factory PIN<input required type="password" inputMode="numeric" pattern="[0-9]{6,12}" minLength={6} maxLength={12} autoComplete="current-password" placeholder="Enter 6–12 digit PIN" value={factoryPin} onChange={e=>setFactoryPin(e.target.value.replace(/\D/g,'').slice(0,12))}/></label></div>{!isAdmin&&!assignedFactory&&<div className="module-error">Your account has no factory assigned. Ask the administrator to set Factory Access in ERP_Users.</div>}{pinError&&<div className="module-error">{pinError}</div>}<footer><button type="button" className="field-btn" onClick={()=>{setPinModal(false);setFactoryPin('');setPinError('');setPinPurpose(null);setPendingRow(null);}}>Cancel</button><button type="submit" className="primary-btn" disabled={pinBusy||!pinFactory||!/^[0-9]{6,12}$/.test(factoryPin)||(!isAdmin&&!assignedFactory)}><Save size={16}/>{pinBusy?'Verifying…':'Verify PIN & Continue'}</button></footer></form></section></div>}
  {modal&&<div className="module-modal-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)closeEntryModal();}}><section className="module-modal"><header><div><h2>{editing?'Edit record':moduleKey==='store'?'New Receive Entry':moduleKey==='material-control'?'New Material PO':'New entry'}</h2><p>{isFactoryProtected?`Authorized factory: ${activeFactory}. Changes are saved to the connected Google Sheet.`:'Changes are saved to the connected Google Sheet.'}</p></div><button type="button" className="modal-close" onClick={closeEntryModal}><X size={18}/></button></header><form onSubmit={save}><div className="module-form-grid">{cfg.fields.map(f=><label key={f.key}>{f.label}{f.type==='select'?<select required={f.required} disabled={isFactoryProtected&&f.key==='Factory'} value={form[f.key]??''} onChange={e=>setForm(p=>({...p,[f.key]:e.target.value}))}><option value="">Select…</option>{(f.options||[]).map(o=><option key={o} value={o}>{o}</option>)}</select>:<input required={f.required} type={f.type||'text'} min={f.type==='number'?0:undefined} step={f.type==='number'?'any':undefined} value={form[f.key]??''} onChange={e=>setForm(p=>({...p,[f.key]:e.target.value}))}/>}</label>)}</div>{moduleKey==='orders'&&<div className="dhu-preview">Order workload is calculated automatically: Order Qty × SMV = <b>{(Number(form['Order Qty']||0)*Number(form.SMV||0)).toLocaleString(undefined,{maximumFractionDigits:2})} minutes</b>. This workload is compared with the selected factory’s available monthly capacity on the Dashboard.</div>}{moduleKey==='quality'&&<div className="dhu-preview">DHU will be calculated automatically: Defect Qty ÷ Checked Qty × 100.</div>}{error&&<div className="module-error">{error}</div>}<footer><button type="button" className="field-btn" onClick={closeEntryModal}>Cancel</button><button type="submit" className="primary-btn" disabled={busy|| (isFactoryProtected&&(!activeFactoryPin||!activeFactory))}><Save size={16}/>{busy?'Saving…':'Save to Google Sheets'}</button></footer></form></section></div>}
 </main></div>;
}
