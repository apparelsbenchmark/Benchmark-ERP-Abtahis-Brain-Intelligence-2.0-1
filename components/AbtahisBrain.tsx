'use client';
import { usePathname } from 'next/navigation';
import { FormEvent, useEffect, useMemo, useState } from 'react';

type BrainAnswer = {
  ok: boolean; title: string; lines: string[]; asOf: string; source: string; incomplete: boolean;
  aiMode?: 'generative' | 'grounded-rules'; model?: string; notice?: string;
  recordCounts?: Record<string, number>;
  stats?: { activeOrders:number; orderPieces:number; allocatedPieces:number; sewingPieces:number; shippedPieces:number; unallocatedOrderRecords:number; materialShortageRecords:number; overdueOrders:number; dueWithinSevenDays:number; pendingApprovals:number; checkedUnits:number; defects:number; dhuPercent:number|null; factoryCount:number; scope:string };
};
type ChatTurn = { question: string; answer: BrainAnswer };
const promptGroups = [
  { label: 'Executive', items: ['Give me an executive summary', 'What needs my attention today?', 'Compare factory performance'] },
  { label: 'Planning', items: ['Compare order workload vs capacity', 'Which orders are not fully allocated?', 'Show pending planning approvals'] },
  { label: 'Operations', items: ['Which POs have material shortages?', 'Show shipment readiness', 'Review production output and efficiency', 'What is our quality DHU?'] }
];
const fmt = (v: number) => Number(v || 0).toLocaleString('en-US');
const cardStyle: React.CSSProperties = { border:'1px solid #e0eaf5', borderRadius:12, padding:'10px 11px', background:'#fff', minWidth:0 };

export default function AbtahisBrain() {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const [question, setQuestion] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [turns, setTurns] = useState<ChatTurn[]>([]);
  const [activeGroup, setActiveGroup] = useState('Executive');
  const [lastSync, setLastSync] = useState<string | null>(null);
  const latest = turns[turns.length - 1]?.answer;
  const suggestions = useMemo(() => promptGroups.find(g => g.label === activeGroup)?.items || [], [activeGroup]);

  useEffect(() => {
    const handle = () => setOpen(true);
    window.addEventListener('open-abtahis-brain', handle);
    return () => window.removeEventListener('open-abtahis-brain', handle);
  }, []);
  if (path === '/login') return null;

  async function ask(q: string) {
    const clean = q.trim();
    if (!clean || busy) return;
    setQuestion(clean); setBusy(true); setError('');
    try {
      const response = await fetch('/api/brain', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({question:clean}), cache:'no-store' });
      const payload = await response.json();
      if (!response.ok || !payload.ok) throw new Error(payload.error || 'Unable to analyze ERP records.');
      setTurns(prev => [...prev, { question:clean, answer:payload as BrainAnswer }].slice(-12));
      setLastSync(payload.asOf || new Date().toISOString());
      setQuestion('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to connect to the ERP intelligence service.');
    } finally { setBusy(false); }
  }
  function submit(e: FormEvent) { e.preventDefault(); void ask(question); }
  async function copyAnswer() {
    if (!latest) return;
    const text = `${latest.title}\n${latest.lines.map(line => `• ${line}`).join('\n')}\nSource: ${latest.source}\nAs of: ${latest.asOf}`;
    try { await navigator.clipboard.writeText(text); } catch { setError('Clipboard access is unavailable in this browser.'); }
  }

  return <div style={{position:'fixed',right:22,bottom:22,zIndex:1100,fontFamily:'inherit'}}>
    {open && <section aria-label="Abtahi’s Brain" style={{width:'min(490px,calc(100vw - 24px))',height:'min(760px,calc(100vh - 94px))',display:'flex',flexDirection:'column',overflow:'hidden',background:'#f7faff',color:'#122b4c',boxShadow:'0 22px 70px #071d3b55',borderRadius:20,border:'1px solid #d6e4f3',marginBottom:12}}>
      <header style={{padding:'17px 18px 14px',background:'linear-gradient(120deg,#092348,#124f91 70%,#1675bb)',color:'#fff'}}>
        <div style={{display:'flex',justifyContent:'space-between',gap:12,alignItems:'flex-start'}}>
          <div style={{display:'flex',gap:11,alignItems:'center'}}>
            <div style={{width:43,height:43,borderRadius:13,background:'#ffffff20',display:'grid',placeItems:'center',fontSize:25}}>✦</div>
            <div><div style={{fontSize:20,fontWeight:850,letterSpacing:'-.4px'}}>Abtahi’s Brain</div><div style={{fontSize:11,opacity:.85,marginTop:4}}>Benchmark Group · ERP Intelligence</div></div>
          </div>
          <button onClick={()=>setOpen(false)} aria-label="Close Abtahi’s Brain" style={{fontSize:25,lineHeight:1,background:'transparent',border:0,color:'#fff',cursor:'pointer'}}>×</button>
        </div>
        <div style={{display:'flex',gap:7,flexWrap:'wrap',marginTop:13}}>
          <span style={{fontSize:10,fontWeight:750,padding:'5px 8px',borderRadius:99,background:'#ffffff20'}}>READ-ONLY BY DEFAULT</span>
          <span style={{fontSize:10,fontWeight:750,padding:'5px 8px',borderRadius:99,background:'#ffffff20'}}>{latest?.aiMode === 'generative' ? `AI ENABLED${latest.model ? ` · ${latest.model}` : ''}` : 'ERP-GROUNDED MODE'}</span>
        </div>
      </header>
      <div style={{padding:'12px 15px',borderBottom:'1px solid #e2ebf5',background:'#fff'}}>
        <div style={{display:'grid',gridTemplateColumns:'repeat(3,minmax(0,1fr))',gap:7}}>
          <div style={cardStyle}><small style={{color:'#6c7f98',fontSize:10}}>Active orders</small><div style={{fontWeight:850,fontSize:19,marginTop:4}}>{latest?.stats ? fmt(latest.stats.activeOrders) : '—'}</div></div>
          <div style={cardStyle}><small style={{color:'#6c7f98',fontSize:10}}>Order pieces</small><div style={{fontWeight:850,fontSize:19,marginTop:4}}>{latest?.stats ? fmt(latest.stats.orderPieces) : '—'}</div></div>
          <div style={cardStyle}><small style={{color:'#6c7f98',fontSize:10}}>Risk signals</small><div style={{fontWeight:850,fontSize:19,marginTop:4,color:latest?.stats && (latest.stats.overdueOrders+latest.stats.materialShortageRecords+latest.stats.unallocatedOrderRecords)>0?'#c24135':'#16845b'}}>{latest?.stats ? fmt(latest.stats.overdueOrders+latest.stats.materialShortageRecords+latest.stats.unallocatedOrderRecords) : '—'}</div></div>
        </div>
        <div style={{fontSize:10,color:'#8190a5',marginTop:8}}>{lastSync ? `Last response: ${new Date(lastSync).toLocaleString()}` : 'Ask a question to load your authorized ERP snapshot.'}</div>
      </div>
      <div style={{padding:'12px 15px 0',background:'#f7faff'}}>
        <div style={{fontSize:12,fontWeight:800,marginBottom:8}}>Ask your operations intelligence assistant</div>
        <div style={{display:'flex',gap:5,marginBottom:8}}>{promptGroups.map(group=><button key={group.label} onClick={()=>setActiveGroup(group.label)} style={{border:'1px solid '+(activeGroup===group.label?'#8bb8f4':'#dce7f4'),borderRadius:9,padding:'7px 9px',background:activeGroup===group.label?'#e7f1ff':'#fff',color:activeGroup===group.label?'#174f96':'#536984',fontSize:11,fontWeight:750}}>{group.label}</button>)}</div>
        <div style={{display:'flex',gap:6,flexWrap:'wrap',paddingBottom:12}}>{suggestions.map(s=><button key={s} disabled={busy} onClick={()=>void ask(s)} style={{border:'1px solid #d7e6f5',borderRadius:99,padding:'7px 10px',background:'#fff',fontSize:11,color:'#245487',cursor:busy?'wait':'pointer',textAlign:'left'}}>{s}</button>)}</div>
      </div>
      <div aria-live="polite" style={{flex:1,minHeight:0,overflowY:'auto',padding:'0 15px 14px'}}>
        {turns.length===0 && <div style={{background:'#fff',border:'1px solid #e0eaf5',borderRadius:14,padding:16,marginTop:3}}><strong style={{fontSize:14}}>What should we investigate?</strong><p style={{fontSize:12,lineHeight:1.6,color:'#637791',margin:'8px 0 0'}}>Ask about factory capacity, order allocation, production performance, material readiness, quality, shipment risks, or approvals. Answers use records your ERP account is authorized to access.</p><div style={{fontSize:11,color:'#6e819a',marginTop:12}}>No data is shown until a question loads the current ERP records.</div></div>}
        {turns.map((turn,index)=><div key={`${turn.answer.asOf}-${index}`} style={{marginTop:12}}>
          <div style={{marginLeft:28,background:'#e7f1ff',border:'1px solid #d5e6fb',borderRadius:'13px 13px 4px 13px',padding:'10px 12px',fontSize:12,color:'#173f70'}}><small style={{display:'block',fontWeight:800,marginBottom:4}}>YOU</small>{turn.question}</div>
          <article style={{marginTop:7,background:'#fff',border:'1px solid #dfe9f4',borderRadius:'13px 13px 13px 4px',padding:13}}>
            <div style={{display:'flex',justifyContent:'space-between',gap:8,alignItems:'center'}}><strong style={{fontSize:13}}>{turn.answer.title}</strong><span style={{fontSize:9,fontWeight:800,color:turn.answer.incomplete?'#b45309':'#16845b',background:turn.answer.incomplete?'#fff2d8':'#eafaf1',borderRadius:99,padding:'4px 6px'}}>{turn.answer.incomplete?'PARTIAL DATA':turn.answer.aiMode==='generative'?'AI ANALYSIS':'GROUNDED'}</span></div>
            <ul style={{paddingLeft:17,margin:'10px 0',fontSize:12,lineHeight:1.65,color:'#354b66'}}>{turn.answer.lines.map((line,i)=><li key={i} style={{marginBottom:5}}>{line}</li>)}</ul>
            {turn.answer.notice&&<div style={{padding:9,background:'#fff7e6',borderRadius:8,color:'#92400e',fontSize:11,marginTop:8}}>{turn.answer.notice}</div>}
            <div style={{borderTop:'1px solid #edf2f8',paddingTop:8,marginTop:8,display:'flex',justifyContent:'space-between',gap:8,alignItems:'center'}}><small style={{fontSize:9,color:'#8190a5'}}>{turn.answer.source} · {new Date(turn.answer.asOf).toLocaleString()}</small><button onClick={()=>{const text=`${turn.answer.title}\n${turn.answer.lines.join('\n')}\nSource: ${turn.answer.source}\nAs of: ${turn.answer.asOf}`;void navigator.clipboard?.writeText(text)}} style={{border:'1px solid #dce7f4',borderRadius:7,padding:'5px 7px',background:'#fff',fontSize:10,color:'#365779'}}>Copy</button></div>
          </article>
        </div>)}
        {busy&&<div style={{marginTop:12,padding:13,borderRadius:12,background:'#fff',border:'1px solid #dfe9f4',fontSize:12,color:'#58708d'}}>Analyzing authorized ERP records…<div style={{height:4,borderRadius:9,background:'#e5eef8',marginTop:9,overflow:'hidden'}}><div style={{height:'100%',width:'65%',background:'#3478e5',borderRadius:9}}/></div></div>}
        {error&&<div role="alert" style={{marginTop:10,padding:10,borderRadius:10,background:'#fff0ef',border:'1px solid #ffd4d0',color:'#b42318',fontSize:12}}>{error}</div>}
      </div>
      <form onSubmit={submit} style={{display:'flex',gap:7,padding:12,borderTop:'1px solid #e0eaf5',background:'#fff'}}>
        <input aria-label="Question for Abtahi’s Brain" placeholder="Ask about orders, capacity, risks…" value={question} onChange={e=>setQuestion(e.target.value)} maxLength={1000} style={{flex:1,minWidth:0,border:'1px solid #d6e3f2',borderRadius:11,padding:'12px 11px',outline:'none',fontSize:12,color:'#16345b'}}/>
        <button type="submit" disabled={busy||!question.trim()} style={{background:busy||!question.trim()?'#9db8dd':'#1459a3',color:'#fff',border:0,borderRadius:11,padding:'0 16px',fontWeight:800,fontSize:12,cursor:busy?'wait':'pointer'}}>{busy?'…':'Ask'}</button>
      </form>
      <div style={{padding:'0 14px 10px',background:'#fff',fontSize:9,lineHeight:1.5,color:'#8190a5'}}>Read-only assistant. Verify critical decisions against source records. Generative AI is optional; without provider credentials, answers use ERP-grounded rules.</div>
    </section>}
    <button onClick={()=>setOpen(v=>!v)} aria-expanded={open} style={{display:'flex',alignItems:'center',gap:9,padding:'13px 18px',border:'1px solid #2b65a4',borderRadius:50,background:'linear-gradient(135deg,#092348,#1459a3)',color:'#fff',fontWeight:800,boxShadow:'0 8px 28px #08224c55',cursor:'pointer'}}><span style={{fontSize:19}}>✦</span>{open?'Close Brain':'Abtahi’s Brain'}<span style={{fontSize:10,opacity:.85}}>AI</span></button>
  </div>;
}
