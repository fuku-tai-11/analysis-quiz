// Older questions use Unicode/plain-text formulas; new AI questions use explicit TeX delimiters.
const symbols={'−':'-','×':'\\times ','·':'\\cdot ','≤':'\\le ','≥':'\\ge ','≠':'\\ne ','→':'\\to ','⇒':'\\Rightarrow ','∈':'\\in ','⊂':'\\subset ','∞':'\\infty ','ε':'\\varepsilon ','δ':'\\delta ','ξ':'\\xi ','π':'\\pi ','Σ':'\\sum ','ℝ':'\\mathbb{R}','∀':'\\forall ','∃':'\\exists ','∪':'\\cup ','≡':'\\equiv ','↓':'\\downarrow ','⌈':'\\lceil ','⌉':'\\rceil ','′':"'",'″':"''"};
const subs={'₀':'0','₁':'1','₂':'2','₃':'3','₄':'4','₅':'5','₆':'6','₇':'7','₈':'8','₉':'9','ₙ':'n','ₖ':'k','ᵢ':'i'};
const supers={'⁰':'0','¹':'1','²':'2','³':'3','⁴':'4','⁵':'5','⁶':'6','⁷':'7','⁸':'8','⁹':'9','ⁿ':'n','ᴿ':'R','⁽':'(','⁾':')','⁻':'-','ˣ':'x'};
export function legacyToTex(source){
  let s=source.replace(/∫\[([^,\]]+),([^\])]+)[\])]/g,(_,a,b)=>`\\int_{${a}}^{${b}}`).replace(/∫\[([^\]]+)\]/g,'\\int_{$1}').replace(/∫/g,'\\int ').replace(/lim\[([^\]]+)\]/g,'\\lim_{$1}');
  s=s.replace(/\^\(/g,'^{');
  // Pair exponent parentheses, including nested function arguments.
  for(let start=s.indexOf('^{');start!==-1;start=s.indexOf('^{',start+2)){
    // Only legacy ^(...) requires conversion. Integral upper bounds are already braced.
    if(source.includes('^(')){
      let depth=0;
      for(let j=start+2;j<s.length;j++){if(s[j]==='}')break;if(s[j]==='(')depth++;if(s[j]===')'){if(depth===0){s=s.slice(0,j)+'}'+s.slice(j+1);break;}depth--;}}
    }
  }
  s=s.replace(/\^([A-Za-z0-9]+(?:\.[0-9]+)?)/g,'^{$1}');
  s=s.replace(/[₀₁₂₃₄₅₆₇₈₉ₙₖᵢ]+/g,v=>'_{'+[...v].map(c=>subs[c]).join('')+'}').replace(/[⁰¹²³⁴⁵⁶⁷⁸⁹ⁿᴿ⁽⁾⁻ˣ]+/g,v=>'^{'+[...v].map(c=>supers[c]).join('')+'}');
  s=[...s].map(c=>symbols[c]??c).join('');
  s=s.replace(/\b(log|sin|cos|exp|min|max|sup)\b/g,'\\$1 ');
  // Simple fractions are unambiguous in the stored notation; preserve more complex slashes.
  const atom=String.raw`(?:\([^()]*\)|(?:\\[a-zA-Z]+\s*|[a-zA-Z0-9.]+)(?:[_^]\{[^{}]*\})*)`;
  s=s.replace(new RegExp(`(${atom})/(${atom})`,'g'),(_,a,b)=>`\\frac{${a.startsWith('(')?a.slice(1,-1):a}}{${b.startsWith('(')?b.slice(1,-1):b}}`);
  return s;
}
export function mathSegments(text){
  // Explicit TeX is never passed through the legacy converter.
  const parts=[];const explicit=/\\\[([\s\S]*?)\\\]|\\\(([\s\S]*?)\\\)|\$\$([\s\S]*?)\$\$|\$([^$\n]+)\$/g;let last=0;
  function legacy(t){const re=/[A-Za-z0-9ε δξπΣℝ∀∃∫][A-Za-z0-9\sε δξπΣℝ∀∃∫−×·≤≥≠→⇒∈⊂∞∪≡↓⌈⌉′″₀₁₂₃₄₅₆₇₈₉ₙₖᵢ⁰¹²³⁴⁵⁶⁷⁸⁹ⁿᴿ⁽⁾⁻ˣ_+\-*/=<>^()[\]{},|!:.]*/g;let pos=0;for(const m of t.matchAll(re)){const raw=m[0].trimEnd();const leading=raw.trimStart();const begin=m.index+(raw.length-leading.length);if(!leading)continue;parts.push({text:t.slice(pos,begin)});parts.push({text:leading,tex:legacyToTex(leading),display:false});pos=begin+leading.length;}parts.push({text:t.slice(pos)});}
  for(const m of text.matchAll(explicit)){legacy(text.slice(last,m.index));parts.push({text:m[0],tex:m[1]??m[2]??m[3]??m[4],display:m[1]!==undefined||m[3]!==undefined});last=m.index+m[0].length;}legacy(text.slice(last));return parts.filter(p=>p.text);
}
export function renderMathText(element,text){
  for(const p of mathSegments(text)){
    if(!p.tex){element.append(document.createTextNode(p.text));continue;}
    const span=document.createElement('span');span.className=p.display?'math-block':'math-inline';
    try{globalThis.katex.render('\\displaystyle '+p.tex,span,{throwOnError:true,trust:false,strict:'ignore',displayMode:p.display,maxExpand:200,maxSize:20});}
    catch{span.textContent=p.text;}
    element.append(span);
  }
}
