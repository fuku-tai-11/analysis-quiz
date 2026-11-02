import test from 'node:test';
import assert from 'node:assert/strict';
import katex from 'katex';
import {bank} from '../lib/bank.mjs';
import {legacyToTex,mathSegments} from '../public/math.js';

test('広義積分の開いた上端も上下限として表示する',()=>{
  assert.equal(legacyToTex('∫[1,∞) x^(−p) dx'),'\\int_{1}^{\\infty } x^{-p} dx');
  const html=katex.renderToString(legacyToTex('∫[0,1] log x dx'));
  assert.ok(html.includes('<msubsup>'));
});
test('指数内の分数と数列の添字を維持する',()=>{
  assert.equal(legacyToTex('e^(−1/x²)'),'e^{-\\frac{1}{x^{2}}}');
  assert.equal(legacyToTex('e^0.1'),'e^{0.1}');
  assert.equal(legacyToTex('aₙ'),'a_{n}');
  assert.equal(legacyToTex('eˣ'),'e^{x}');
});
test('明示したLaTeXと日本語を分離し、LaTeXは再変換しない',()=>{
  const list=mathSegments('次を計算：\\(\\int_1^\\infty \\frac{1}{x^2}\\,dx\\) です。');
  assert.equal(list.filter(p=>p.tex).length,1);
  assert.equal(list.find(p=>p.tex).tex,'\\int_1^\\infty \\frac{1}{x^2}\\,dx');
  assert.equal(list.map(p=>p.text).join(''),'次を計算：\\(\\int_1^\\infty \\frac{1}{x^2}\\,dx\\) です。');
});
test('全27問の問題・解説・ヒント・具体例を数式エラーなく組版できる',()=>{
  for(const q of bank)for(const key of ['question','hint','answer','example','pitfall','steps','checklist'])for(const text of [q[key]].flat()){
    const segments=mathSegments(text);assert.equal(segments.map(p=>p.text).join(''),text);
    for(const p of segments)if(p.tex)assert.doesNotThrow(()=>katex.renderToString('\\displaystyle '+p.tex,{throwOnError:true,strict:'error',trust:false}),`${q.id}: ${p.text}`);
  }
});
