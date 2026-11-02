import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {bank} from './lib/bank.mjs';
import {kinds,levels,topics,validateQuestions,selectQuestions} from './lib/quiz.mjs';

const fields = ['kind','level','topic','title','question','hint','answer','example','pitfall'];
const properties = Object.fromEntries(fields.map(k=>[k,{type:'string'}]));
for(const k of ['steps','checklist']) properties[k]={type:'array',items:{type:'string'}};
const schema={type:'object',properties:{questions:{type:'array',items:{type:'object',properties,required:Object.keys(properties),additionalProperties:false}}},required:['questions'],additionalProperties:false};
const publicFiles = new Map([['/',['index.html','text/html']],['/app.js',['app.js','text/javascript']],['/math.js',['math.js','text/javascript']],['/style.css',['style.css','text/css']]]);
export function createApp({apiKey=process.env.OPENAI_API_KEY,model=process.env.OPENAI_MODEL || 'gpt-4.1-mini',fetchImpl=fetch}={}) {
  let busy=false, lastCall=0;
  return http.createServer(async(req,res)=>{
    const send=(code,data)=>{res.writeHead(code,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(JSON.stringify(data));};
    try {
      const path=new URL(req.url,'http://localhost').pathname;
      if(req.method==='GET' && path==='/api/status') return send(200,{aiEnabled:!!apiKey});
      if(req.method==='POST' && path==='/api/questions') {
        // Browsers on other origins must not be able to spend this local server's API budget.
        if(req.headers.origin && req.headers.origin!==`http://${req.headers.host}`) return send(403,{error:'別のサイトからの出題依頼は受け付けません。'});
        if(!req.headers['content-type']?.startsWith('application/json')) return send(415,{error:'JSON形式で送信してください。'});
        let raw='';for await(const chunk of req){raw+=chunk;if(raw.length>4096)return send(413,{error:'入力が長すぎます。'});}
        let o;try{o=JSON.parse(raw);}catch{return send(400,{error:'入力を読み取れません。'});}
        if(![...kinds,'総合'].includes(o.kind)||!levels.includes(o.level)||![...topics,'すべて'].includes(o.topic)||![3,6,9].includes(o.count)||!['bank','ai'].includes(o.source))return send(400,{error:'出題設定が不正です。'});
        if(o.source==='bank'){
          const questions=selectQuestions(bank,o);
          return send(200,{questions,source:'bank',notice:questions.length<o.count?`この条件の収録問題は${questions.length}問です。全問を出題します。`:''});
        }
        if(!apiKey)return send(503,{error:'AI出題は未設定です。.env に APIキーを設定するか、収録問題を選んでください。'});
        if(busy || Date.now()-lastCall<15000)return send(429,{error:'生成中、または直前の生成から15秒以内です。少し待ってからお試しください。'});
        busy=true;lastCall=Date.now();
        try{
          const response=await fetchImpl('https://api.openai.com/v1/responses',{method:'POST',headers:{Authorization:`Bearer ${apiKey}`,'Content-Type':'application/json'},signal:AbortSignal.timeout(90000),body:JSON.stringify({model,store:false,max_output_tokens:14000,instructions:'あなたは大学数学の微分積分の教材著者です。日本語で厳密で分かりやすい問題を作ってください。高校範囲の公式適用だけの問題は禁止。大学基礎は大学の定義・定理の基本、標準は証明や定理の仮定を使った評価、応用は複数概念を組み合わせた考察とする。各問題に段階的ヒント、完全な解答、仮定を省略しない詳しい解説手順（2段落以上）、数値や関数による具体例、間違えやすい点、問題固有の自己確認項目（2つ以上）を含める。数式は必ずLaTeXで書き、インラインは \\( ... \\)、独立した数式は \\[ ... \\] で囲む。積分は上下限付き、指数は波括弧、分数はfracを使い、数学の意味を厳密に保つ。数式の外の日本語はプレーンテキストとしMarkdownは使わない。極限・連続、微分・テイラー、積分以外は扱わない。解答を内部で検算し、反例や端点を確認する。未証明の高度な定理が必要なら使用を明記する。総合指定は計算・証明・概念を必ず含め、それらの問題数を均等にする。すべて指定は3テーマをできるだけ均等にする。kind,level,topicは指定の文字列を正確に使う。',input:JSON.stringify({...o,variation:crypto.randomUUID()}),text:{format:{type:'json_schema',name:'analysis_quiz',strict:true,schema}}})});
          if(!response.ok)return send(502,{error:'AIサービスに接続できませんでした。APIキー・利用枠・モデル名を確認してください。'});
          const data=await response.json();
          if(data.status!=='completed')return send(502,{error:'問題の生成が完了しませんでした。問題数を減らして再試行してください。'});
          const output=data.output?.flatMap(v=>v.content||[]).filter(v=>v.type==='output_text').map(v=>v.text).join('');
          const questions=validateQuestions(JSON.parse(output).questions,o);
          return send(200,{questions,source:'ai',notice:'AI生成問題です。数学的な正確性は保証されないため、教科書と照合してください。'});
        }finally{busy=false;}
      }
      if(req.method==='GET' && /^\/vendor\/katex\/(?:katex\.mjs|katex\.min\.css|fonts\/[A-Za-z0-9_-]+\.(?:woff2?|ttf))$/.test(path)){
        const relative=path.slice('/vendor/katex/'.length);
        const body=await readFile(new URL(`./node_modules/katex/dist/${relative}`,import.meta.url));
        const type=relative.endsWith('.mjs')?'text/javascript':relative.endsWith('.css')?'text/css':relative.endsWith('.woff2')?'font/woff2':relative.endsWith('.woff')?'font/woff':'font/ttf';
        res.writeHead(200,{'Content-Type':type,'X-Content-Type-Options':'nosniff'});return res.end(body);
      }
      if(req.method==='GET'&&publicFiles.has(path)){
        const [file,type]=publicFiles.get(path);const body=await readFile(new URL(`./public/${file}`,import.meta.url));
        res.writeHead(200,{'Content-Type':`${type}; charset=utf-8`,'X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer'});return res.end(body);
      }
      send(404,{error:'ページが見つかりません。'});
    }catch(err){send(500,{error:err.name==='TimeoutError'?'生成に時間がかかっています。問題数を減らして再試行してください。':'処理に失敗しました。設定を確認して再試行してください。'});}
  });
}
if(process.argv[1]===fileURLToPath(import.meta.url))createApp().listen(Number(process.env.PORT)||3000,'127.0.0.1',()=>console.log(`Local: http://127.0.0.1:${Number(process.env.PORT)||3000}`));
