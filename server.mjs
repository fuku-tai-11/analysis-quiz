// 開発用の静的ファイルサーバー。外部AIサービスへの接続は行わない。
import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';

const publicFiles=new Map([['/','index.html'],['/index.html','index.html'],['/app.js','app.js'],['/math.js','math.js'],['/style.css','style.css']]);
const libraries=new Set(['bank.mjs','extra-bank.mjs','quiz.mjs']);
const mime={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.woff2':'font/woff2','.woff':'font/woff','.ttf':'font/ttf'};
export function createApp(){
  return http.createServer(async(req,res)=>{
    try{
      const path=new URL(req.url,'http://localhost').pathname;
      let file;
      if(req.method==='GET'&&publicFiles.has(path))file=`./public/${publicFiles.get(path)}`;
      else if(req.method==='GET'&&path.startsWith('/lib/')&&libraries.has(path.slice(5)))file=`.${path}`;
      else if(req.method==='GET'&&/^\/vendor\/katex\/(?:katex\.mjs|katex\.min\.css|fonts\/[A-Za-z0-9_-]+\.(?:woff2?|ttf))$/.test(path))file=`./node_modules/katex/dist/${path.slice('/vendor/katex/'.length)}`;
      if(!file){res.writeHead(404,{'Content-Type':'text/plain; charset=utf-8'});return res.end('ページが見つかりません。');}
      const body=await readFile(new URL(file,import.meta.url));
      const ext=file.slice(file.lastIndexOf('.'));
      res.writeHead(200,{'Content-Type':mime[ext]||'application/octet-stream','X-Content-Type-Options':'nosniff','Cache-Control':'no-cache','Referrer-Policy':'no-referrer'});res.end(body);
    }catch{res.writeHead(500,{'Content-Type':'text/plain; charset=utf-8'});res.end('ファイルを読み込めませんでした。npm install を実行したか確認してください。');}
  });
}
if(process.argv[1]===fileURLToPath(import.meta.url))createApp().listen(Number(process.env.PORT)||3000,'127.0.0.1',()=>console.log(`Local: http://127.0.0.1:${Number(process.env.PORT)||3000}`));
