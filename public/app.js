import katex from './vendor/katex/katex.mjs';
import {bank} from './lib/bank.mjs';
import {selectQuestions} from './lib/quiz.mjs';
import {renderMathText} from './math.js';
globalThis.katex=katex;
const $=s=>document.querySelector(s);
let session=null;
const el=(tag,text,cls)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n;};
const mathEl=(tag,text,cls)=>{const n=el(tag,undefined,cls);renderMathText(n,text);return n;};
const btn=(text,fn,cls)=>{const b=el('button',text,cls);b.type='button';b.onclick=fn;return b;};
$('#bank-status').textContent=`収録${bank.length}問 / APIキー不要・API利用料なし`;
$('#settings').onsubmit=e=>{
  e.preventDefault();
  if(session&&!session.finished&&!confirm('現在の学習を終了して、新しく始めますか？'))return;
  const options=Object.fromEntries(new FormData(e.target));options.count=Number(options.count);
  const questions=selectQuestions(bank,options);
  if(!questions.length){$('#status').textContent='条件に合う問題がありません。';return;}
  const notice=questions.length<options.count?`この条件の収録問題は${questions.length}問です。全問を出題します。`:'';
  session={options,questions,notice,index:0,answers:questions.map(()=>''),ratings:{},memoOpen:{},revealed:{},hints:{},finished:false};
  $('#status').textContent=notice;render();
};
function render(){
  const s=session,root=$('#study');root.replaceChildren();if(s.finished)return results(root);
  const q=s.questions[s.index],test=s.options.kind==='総合',card=el('div',undefined,'card');
  const top=el('div',undefined,'topline');top.append(el('span',`${q.kind} / ${q.level} / ${q.topic}`,'badge'),el('span',`${s.index+1} / ${s.questions.length}`,'muted'));card.append(top);
  const progress=el('progress');progress.max=s.questions.length;progress.value=s.index;card.append(progress,el('p','収録問題から自動作成','eyebrow'),el('h2',q.title),mathEl('p',q.question,'question'));
  card.append(rating(s.index,true),el('p','○か×を押すと次の問題へ進みます。紙や頭の中で解いてから選んでください。','muted'));
  const memo=el('details',undefined,'answer-memo');memo.open=!!s.memoOpen[s.index];
  const index=s.index;memo.ontoggle=()=>{s.memoOpen[index]=memo.open;};
  memo.append(el('summary','答案・考え方をメモする（任意）'));
  const label=el('label','自分用のメモ');const input=el('textarea');input.value=s.answers[index];input.placeholder='必要なときだけ、考え方を書き残せます。';input.oninput=()=>{s.answers[index]=input.value;};label.append(input);memo.append(label);card.append(memo);
  const actions=el('div',undefined,'actions');
  if(!test){actions.append(btn(s.hints[s.index]?'ヒントを閉じる':'ヒントを見る',()=>{s.hints[s.index]=!s.hints[s.index];render();}),btn('解答・解説を見る',()=>{s.revealed[s.index]=true;render();}));}
  card.append(actions);if(s.hints[s.index])card.append(mathEl('p',q.hint,'example'));
  if(!test&&s.revealed[s.index]){card.append(explain(q));}
  const nav=el('div',undefined,'actions');if(s.index>0)nav.append(btn('← 前の問題',()=>{s.index--;render();}));
  nav.append(btn(s.index===s.questions.length-1?(test?'テストを提出して解説を見る':'学習を終えて振り返る'):'次の問題 →',()=>{
    advance();
  },'primary'));card.append(nav,el('p','○×の記録とメモはこの画面を開いている間だけ保持されます。再読み込みで消去されます。','muted'));root.append(card);

}
function explain(q){const box=el('div',undefined,'explanation');box.append(el('h3','解答'),mathEl('p',q.answer),el('h3','一歩ずつ考える'));const list=el('ol');q.steps.forEach(t=>list.append(mathEl('li',t)));box.append(list,el('h3','具体例でつかむ'),mathEl('p',q.example,'example'),el('h3','間違えやすい点'),mathEl('p',q.pitfall,'warning'),el('h3','理解の確認'));q.checklist.forEach(t=>{const l=el('label',undefined,'check');const c=el('input');c.type='checkbox';l.append(c);renderMathText(l,t);box.append(l);});return box;}
function advance(){
  if(session.index===session.questions.length-1)session.finished=true;else session.index++;
  render();
  const heading=$('#study h2');if(heading){heading.tabIndex=-1;heading.focus({preventScroll:true});heading.scrollIntoView({block:'nearest'});}
}
function rating(index,advanceAfter=false){
  const wrap=el('div',undefined,'self-rating');wrap.append(el('p','自分で○×をつける（自己評価）','muted'));
  const row=el('div',undefined,'rating-buttons');row.setAttribute('role','group');row.setAttribute('aria-label','問題の自己評価');
  for(const [value,label,cls] of [['できた','○ できた','rating-yes'],['できなかった','× できなかった','rating-no']]){
    const b=btn(label,()=>{
      session.ratings[index]=value;
      if(advanceAfter){advance();return;}
      row.querySelectorAll('button').forEach(x=>{const selected=x===b;x.classList.toggle('selected',selected);x.setAttribute('aria-pressed',String(selected));});
      updateSummary();
    },`rating-button ${cls}`);
    const selected=session.ratings[index]===value;b.classList.toggle('selected',selected);b.setAttribute('aria-pressed',String(selected));row.append(b);
  }
  wrap.append(row);return wrap;
}
function mark(index){return session.ratings[index]==='できた'?'○':session.ratings[index]==='できなかった'?'×':'未評価';}
function updateSummary(){
  const values=Object.values(session.ratings);const yes=values.filter(v=>v==='できた').length,no=values.filter(v=>v==='できなかった').length;
  $('#summary').textContent=`○ できた ${yes}問 / × できなかった ${no}問 / 未評価 ${session.questions.length-yes-no}問`;
  session.questions.forEach((q,i)=>{const label=$(`#review-label-${i}`);if(label)label.textContent=`${mark(i)}　${i+1}. ${q.title} · ${q.kind}`;});
  const review=$('#review-list');review.replaceChildren();const items=session.questions.filter((q,i)=>session.ratings[i]==='できなかった');
  if(!items.length)review.append(el('li','×をつけた問題はありません。'));else items.forEach(q=>review.append(el('li',`${q.title}（${q.kind} / ${q.topic}）`)));
}
function results(root){const card=el('div',undefined,'card');card.append(el('p','SESSION COMPLETE','eyebrow'),el('h2','今日の学びを振り返る'));const summary=el('p');summary.id='summary';card.append(summary,el('p','○×はあなた自身の評価です。解説を確認してから変更することもできます。','muted'));
const reviewList=el('ul');reviewList.id='review-list';card.append(el('h3','×をつけた問題を復習'),reviewList);
session.questions.forEach((q,i)=>{const detail=el('details',undefined,'review');const title=el('summary');title.id=`review-label-${i}`;detail.append(title);if(session.answers[i].trim())detail.append(el('h3','あなたのメモ'),el('p',session.answers[i]));detail.append(mathEl('p',`ヒント：${q.hint}`,'muted'),explain(q),rating(i));card.append(detail);});card.append(btn('復習メモを保存',download));root.append(card);updateSummary();}
function download(){const s=session;const text=['解析のアトリエ / 学習の記録',`出題：収録問題 / ${s.options.level}`,...s.questions.flatMap((q,i)=>[`\n${i+1}. ${q.title}`,q.question,`\n自分のメモ：${s.answers[i]||'なし'}`,`自己評価：${mark(i)} ${s.ratings[i]||''}`,`\n解答：${q.answer}`,...q.steps,`具体例：${q.example}`,`注意点：${q.pitfall}`])].join('\n');const url=URL.createObjectURL(new Blob([text],{type:'text/plain;charset=utf-8'}));const a=el('a');a.href=url;a.download='解析学-復習メモ.txt';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
