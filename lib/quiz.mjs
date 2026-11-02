export const kinds = ['計算','証明','概念'];
export const levels = ['大学基礎','標準','応用'];
export const topics = ['極限・連続','微分・テイラー','積分'];
export function validateQuestions(list, {kind,level,topic,count}) {
  if (!Array.isArray(list) || list.length !== count) throw new Error('問題数が一致しません');
  for (const q of list) {
    if (!kinds.includes(q.kind) || (kind !== '総合' && q.kind !== kind) || q.level !== level || !topics.includes(q.topic) || (topic !== 'すべて' && q.topic !== topic)) throw new Error('出題条件が一致しません');
    for (const key of ['title','question','hint','answer','example','pitfall']) if (typeof q[key] !== 'string' || !q[key].trim() || q[key].length > 6000) throw new Error('問題データが不正です');
    for (const key of ['steps','checklist']) if (!Array.isArray(q[key]) || q[key].length < 2 || !q[key].every(v => typeof v === 'string' && v.trim())) throw new Error('解説が不足しています');
  }
  if (kind === '総合' && count >= 3 && !kinds.every(k => list.some(q => q.kind === k))) throw new Error('まとめテストの分野が不足しています');
  return list;
}
export function selectQuestions(bank, options) {
  const {kind,level,topic,count}=options;
  const pool=bank.filter(q=>(kind==='総合'||q.kind===kind)&&q.level===level&&(topic==='すべて'||q.topic===topic));
  const shuffle=a=>{const out=[...a];for(let i=out.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[out[i],out[j]]=[out[j],out[i]];}return out;};
  const order=kind==='総合'?shuffle(kinds):[kind];
  const selected=[],used=new Set(),topicCounts=Object.fromEntries(topics.map(t=>[t,0]));
  while(selected.length<Math.min(count,pool.length)){
    let added=false;
    for(const k of order){
      if(selected.length>=count)break;
      const available=pool.filter(q=>q.kind===k&&!used.has(q.id));
      if(!available.length)continue;
      const least=Math.min(...available.map(q=>topicCounts[q.topic]));
      const q=shuffle(available.filter(q=>topicCounts[q.topic]===least))[0];
      selected.push(q);used.add(q.id);topicCounts[q.topic]++;added=true;
    }
    if(!added)break;
  }
  return shuffle(selected);
}
