import test from 'node:test';
import assert from 'node:assert/strict';
import {bank} from '../lib/bank.mjs';
import {kinds,levels,topics,selectQuestions,validateQuestions} from '../lib/quiz.mjs';
import {createApp} from '../server.mjs';
test('収録問題がすべての分類・難易度・テーマをカバーする',()=>{
  assert.equal(bank.length,27);
  for(const level of levels)for(const kind of kinds)for(const topic of topics){const list=bank.filter(q=>q.kind===kind&&q.level===level&&q.topic===topic);validateQuestions(list,{level,kind,topic,count:1});}
});
test('まとめテストは重複なく3分野を含む',()=>{
  for(const level of levels)for(const count of [3,6,9]){
    const options={kind:'総合',level,topic:'すべて',count};const selected=selectQuestions(bank,options);
    validateQuestions(selected,options);assert.equal(new Set(selected.map(q=>q.id)).size,count);
  }
});
test('条件に合う問題が少ない場合は重複して水増ししない',()=>{
  const selected=selectQuestions(bank,{kind:'計算',level:'標準',topic:'積分',count:9});assert.equal(selected.length,1);
});
test('AIの出題条件違反を拒否する',()=>{
  const opts={kind:'計算',level:'標準',topic:'積分',count:1};assert.throws(()=>validateQuestions([bank[0]],opts));assert.throws(()=>validateQuestions([{...bank[15],steps:[]}],opts));
});
async function withApp(config,fn){const server=createApp(config);await new Promise(r=>server.listen(0,'127.0.0.1',r));try{await fn(`http://127.0.0.1:${server.address().port}`);}finally{await new Promise(r=>server.close(r));}}
const post=(base,data,extra={})=>fetch(`${base}/api/questions`,{method:'POST',headers:{'Content-Type':'application/json',...extra},body:JSON.stringify(data)});
const options={kind:'総合',level:'標準',topic:'すべて',count:3,source:'bank'};
test('HTTP: ホーム、収録問題、未設定AI、不正入力、秘密ファイルを検証',async()=>{
  await withApp({apiKey:''},async base=>{
    assert.equal((await fetch(base)).status,200);
    for(const asset of ['/math.js','/vendor/katex/katex.mjs','/vendor/katex/katex.min.css','/vendor/katex/fonts/KaTeX_Main-Regular.woff2'])assert.equal((await fetch(base+asset)).status,200,asset);
    assert.equal((await fetch(`${base}/.env`)).status,404);
    const r=await post(base,options);assert.equal(r.status,200);validateQuestions((await r.json()).questions,options);
    assert.equal((await post(base,{...options,source:'ai'})).status,503);
    assert.equal((await post(base,{...options,count:1000})).status,400);
    assert.equal((await post(base,options,{Origin:'https://untrusted.example'})).status,403);
  });
});
test('HTTP: AI応答を検証しキーをブラウザーに返さない（モック）',async()=>{
  const questions=selectQuestions(bank,options);let called=false;
  await withApp({apiKey:'test-secret',fetchImpl:async(url,request)=>{
    called=true;assert.equal(url,'https://api.openai.com/v1/responses');assert.equal(request.headers.Authorization,'Bearer test-secret');
    const body=JSON.parse(request.body);assert.equal(body.text.format.strict,true);assert.equal(body.store,false);
    return {ok:true,json:async()=>({status:'completed',output:[{content:[{type:'output_text',text:JSON.stringify({questions})}]}]})};
  }},async base=>{const response=await post(base,{...options,source:'ai'});assert.equal(response.status,200);const text=await response.text();assert.ok(!text.includes('test-secret'));assert.equal(JSON.parse(text).source,'ai');assert.ok(called);assert.equal((await post(base,{...options,source:'ai'})).status,429);});
});
