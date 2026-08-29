'use client';

type Props={name:string; category?:string; className?:string};
export default function ProductArt({name,category='',className=''}:Props){
  const s=`${name} ${category}`.toLowerCase();
  if(/johnnie\s+walker.*red\s+label|red\s+label/.test(s)){
    return <div className={`real-product ${className}`}><img src="https://toppng.com/public/uploads/preview/johnnie-walker-red-label-johnnie-walker-red-label-1-l-bottle-1156317189086tlxxleuj.png" alt={name}/></div>;
  }
  let kind='beer';
  if(/whisky|jack|chivas/.test(s)) kind='whisky';
  else if(/vodka|absolut/.test(s)) kind='vodka';
  else if(/energ|red bull|monster/.test(s)) kind='energy';
  else if(/refriger|coca/.test(s)) kind='soda';
  else if(/gin|tanqueray/.test(s)) kind='gin';
  else if(/vinho/.test(s)) kind='wine';
  return <div className={`bottle-art ${kind} ${className}`} aria-label={name}><span className="bottle-cap"/><span className="bottle-neck"/><span className="bottle-body"><i>{kind==='energy'?'ENERGY':kind==='vodka'?'VODKA':kind==='whisky'?'PREMIUM':kind==='gin'?'GIN':'ADEGA'}</i></span></div>;
}
