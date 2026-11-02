import katex from '/vendor/katex/katex.mjs';
import {renderMathText} from './math.js';
globalThis.katex=katex;
const $=s=>document.querySelector(s);
let session=null;
const el=(tag,text,cls)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n;};
const mathEl=(tag,text,cls)=>{const n=el(tag,undefined,cls);renderMathText(n,text);return n;};
const btn=(text,fn,cls)=>{const b=el('button',text,cls);b.type='button';b.onclick=fn;return b;};
async function init(){try{const r=await fetch('/api/status');const s=await r.json();$('#ai-status').textContent=s.aiEnabled?'AI出題：設定済み（API利用料が発生します）':'AI出題：未設定 / 収録問題はそのまま使えます';}catch{$('#ai-status').textContent='サーバーに接続できません。npm start で起動してください。';}}
$('#settings').onsubmit=async e=>{
  e.preventDefault();
  if(session&&!session.finished&&!confirm('現在の学習を終了して、新しく始めますか？'))return;
  const options=Object.fromEntries(new FormData(e.target));options.count=Number(options.count);
  $('#start').disabled=true;$('#status').textContent=options.source==='ai'?'AIが問題と解説を作成しています（最大90秒程度）…':'問題を準備中…';
  try{const r=await fetch('/api/questions',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(options)});const d=await r.json();if(!r.ok)throw new Error(d.error);if(!d.questions?.length)throw new Error('条件に合う問題がありません。');session={options,questions:d.questions,notice:d.notice,source:d.source,index:0,answers:d.questions.map(()=>''),ratings:{},revealed:{},hints:{},finished:false};$('#status').textContent=d.notice;render();}catch(err){$('#status').textContent=err.message;}finally{$('#start').disabled=false;}
};
function render(){
  const s=session,root=$('#study');root.replaceChildren();if(s.finished)return results(root);
  const q=s.questions[s.index],test=s.options.kind==='総合',card=el('div',undefined,'card');
  const top=el('div',undefined,'topline');top.append(el('span',`${q.kind} / ${q.level} / ${q.topic}`,'badge'),el('span',`${s.index+1} / ${s.questions.length}`,'muted'));card.append(top);
  const progress=el('progress');progress.max=s.questions.length;progress.value=s.index;card.append(progress,el('p',s.source==='ai'?'AI生成問題':'収録問題','eyebrow'),el('h2',q.title),mathEl('p',q.question,'question'));
  const label=el('label',test?'あなたの答案（解説はテスト終了後に表示）':'あなたの答案・考え方');const input=el('textarea');input.value=s.answers[s.index];input.placeholder='使う定義や定理、考えた手順を書いてみましょう。';input.oninput=()=>{s.answers[s.index]=input.value;};label.append(input);card.append(label);
  const actions=el('div',undefined,'actions');
  if(!test){actions.append(btn(s.hints[s.index]?'ヒントを閉じる':'ヒントを見る',()=>{s.hints[s.index]=!s.hints[s.index];render();}),btn('解答・解説を見る',()=>{s.revealed[s.index]=true;render();}));}
  card.append(actions);if(s.hints[s.index])card.append(mathEl('p',q.hint,'example'));
  if(!test&&s.revealed[s.index]){card.append(explain(q));card.append(rating(s.index));}
  const nav=el('div',undefined,'actions');if(s.index>0)nav.append(btn('← 前の問題',()=>{s.index--;render();}));
  nav.append(btn(s.index===s.questions.length-1?(test?'テストを提出して解説を見る':'学習を終えて振り返る'):'次の問題 →',()=>{
    if(s.index===s.questions.length-1){if(test&&s.answers.some(a=>!a.trim())&&!confirm('未記入の答案があります。このまま提出しますか？'))return;s.finished=true;}else s.index++;render();
  },'primary'));card.append(nav,el('p','答案はこの画面を開いている間だけ保持されます。再読み込みで消去されます。','muted'));root.append(card);
}
function explain(q){const box=el('div',undefined,'explanation');box.append(el('h3','解答'),mathEl('p',q.answer),el('h3','一歩ずつ考える'));const list=el('ol');q.steps.forEach(t=>list.append(mathEl('li',t)));box.append(list,el('h3','具体例でつかむ'),mathEl('p',q.example,'example'),el('h3','間違えやすい点'),mathEl('p',q.pitfall,'warning'),el('h3','理解の確認'));q.checklist.forEach(t=>{const l=el('label',undefined,'check');const c=el('input');c.type='checkbox';l.append(c);renderMathText(l,t);box.append(l);});return box;}
function rating(index){const wrap=el('div');wrap.append(el('p','模範解答と比べた自己評価（自動採点ではありません）','muted'));const row=el('div',undefined,'actions');['理解できた','もう少し','復習したい'].forEach(v=>{const b=btn(v,()=>{session.ratings[index]=v;row.querySelectorAll('button').forEach(x=>x.classList.remove('primary'));b.classList.add('primary');if(session.finished)updateSummary();},session.ratings[index]===v?'primary':'');row.append(b);});wrap.append(row);return wrap;}
function updateSummary(){const ratings=Object.values(session.ratings);$('#summary').textContent=`理解できた ${ratings.filter(v=>v==='理解できた').length}問 / ${session.questions.length}問（自己評価済み ${ratings.length}問）`;}
function results(root){const card=el('div',undefined,'card');card.append(el('p','SESSION COMPLETE','eyebrow'),el('h2','今日の学びを振り返る'));const summary=el('p');summary.id='summary';card.append(summary,el('p','証明・記述の正誤は自動判定しません。自分の答案と模範解答を比較し、理解度を記録しましょう。','muted'));
session.questions.forEach((q,i)=>{const detail=el('details',undefined,'review');detail.append(el('summary',`${i+1}. ${q.title} · ${q.kind}`),el('h3','あなたの答案'),el('p',session.answers[i]||'未記入'),mathEl('p',`ヒント：${q.hint}`,'muted'),explain(q),rating(i));card.append(detail);});card.append(btn('復習メモを保存',download));root.append(card);updateSummary();}
function download(){const s=session;const text=['解析のアトリエ / 学習の記録',`出題：${s.source==='ai'?'AI生成':'収録問題'} / ${s.options.level}`,...s.questions.flatMap((q,i)=>[`\n${i+1}. ${q.title}`,q.question,`\n自分の答案：${s.answers[i]||'未記入'}`,`自己評価：${s.ratings[i]||'未評価'}`,`\n解答：${q.answer}`,...q.steps,`具体例：${q.example}`,`注意点：${q.pitfall}`])].join('\n');const url=URL.createObjectURL(new Blob([text],{type:'text/plain;charset=utf-8'}));const a=el('a');a.href=url;a.download='解析学-復習メモ.txt';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
init();
