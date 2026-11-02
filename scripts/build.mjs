// 公開できるファイルだけをコピーする。.envやサーバーのソースは含めない。
import {mkdir,copyFile,cp} from 'node:fs/promises';
const root=new URL('../',import.meta.url);
const out=new URL('dist/',root);
await mkdir(out,{recursive:true});
for(const name of ['index.html','app.js','math.js','style.css'])await copyFile(new URL(`public/${name}`,root),new URL(name,out));
await mkdir(new URL('lib/',out),{recursive:true});
for(const name of ['bank.mjs','extra-bank.mjs','quiz.mjs'])await copyFile(new URL(`lib/${name}`,root),new URL(`lib/${name}`,out));
await mkdir(new URL('vendor/katex/',out),{recursive:true});
for(const name of ['katex.mjs','katex.min.css'])await copyFile(new URL(`node_modules/katex/dist/${name}`,root),new URL(`vendor/katex/${name}`,out));
await cp(new URL('node_modules/katex/dist/fonts/',root),new URL('vendor/katex/fonts/',out),{recursive:true});
await copyFile(new URL('node_modules/katex/LICENSE',root),new URL('vendor/katex/LICENSE',out));
console.log('dist/ に静的アプリを作成しました。APIキー・外部AI接続は不要です。');
