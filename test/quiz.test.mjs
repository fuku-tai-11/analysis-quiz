import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {bank} from '../lib/bank.mjs';
import {kinds,levels,topics,selectQuestions,validateQuestions} from '../lib/quiz.mjs';
import {createApp} from '../server.mjs';

test('54問のIDが一意で、全分類・難易度・テーマに2問ずつある',()=>{
  assert.equal(bank.length,54);assert.equal(new Set(bank.map(q=>q.id)).size,54);
  for(const level of levels)for(const kind of kinds)for(const topic of topics){
    const list=bank.filter(q=>q.kind===kind&&q.level===level&&q.topic===topic);
    validateQuestions(list,{level,kind,topic,count:2});
  }
});
test('全出題条件で分類・難易度・テーマ・問題数が正しく、同じテスト内に重複がない',()=>{
  for(const level of levels)for(const kind of [...kinds,'総合'])for(const topic of [...topics,'すべて'])for(const count of [3,6,9]){
    const opts={level,kind,topic,count};const selected=selectQuestions(bank,opts);
    const available=bank.filter(q=>q.level===level&&(kind==='総合'||q.kind===kind)&&(topic==='すべて'||q.topic===topic));
    validateQuestions(selected,{...opts,count:Math.min(count,available.length)});
    assert.equal(new Set(selected.map(q=>q.id)).size,selected.length);
    if(kind==='総合'){
      const counts=kinds.map(k=>selected.filter(q=>q.kind===k).length);
      assert.equal(new Set(counts).size,1,'まとめテストは3分野を同数にする');
    }
    if(topic==='すべて'){
      const counts=topics.map(t=>selected.filter(q=>q.topic===t).length);
      assert.equal(new Set(counts).size,1,'3テーマを同数にする');
    }
  }
});
test('保存済み問題だけで出題し、APIや秘密設定を要求しない',async()=>{
  for(const file of ['../public/app.js','../server.mjs']){
    const source=await readFile(new URL(file,import.meta.url),'utf8');
    assert.doesNotMatch(source,/fetch\s*\(|OPENAI_API_KEY|api\.openai\.com|\/api\/questions/);
  }
  const html=await readFile(new URL('../public/index.html',import.meta.url),'utf8');
  assert.doesNotMatch(html,/AIがその場で作成|name="source"/);
  assert.match(html,/APIキー不要/);
  assert.doesNotMatch(await readFile(new URL('../public/style.css',import.meta.url),'utf8'),/https?:\/\//);
});
test('HTTP:静的アプリと数式フォントを配信し、APIや秘密ファイルは配信しない',async()=>{
  const server=createApp();await new Promise(r=>server.listen(0,'127.0.0.1',r));
  const base=`http://127.0.0.1:${server.address().port}`;
  try{
    for(const path of ['/','/app.js','/math.js','/lib/bank.mjs','/lib/extra-bank.mjs','/lib/quiz.mjs','/vendor/katex/katex.mjs','/vendor/katex/katex.min.css','/vendor/katex/fonts/KaTeX_Main-Regular.woff2'])assert.equal((await fetch(base+path)).status,200,path);
    for(const path of ['/.env','/server.mjs','/package.json','/lib/unknown.mjs','/api/status','/api/questions'])assert.equal((await fetch(base+path)).status,404,path);
    assert.equal((await fetch(base+'/api/questions',{method:'POST',body:'{}'})).status,404);
  }finally{await new Promise(r=>server.close(r));}
});
