'use client';

import {catalogMatch} from '@/lib/beverageCatalog';

type Props={name:string; category?:string; className?:string; image?:string};
export default function ProductArt({name,category='',className='',image}:Props){
  const s=`${name} ${category}`.toLowerCase();
  const catalogPhoto=catalogMatch(name)?.image;
  const suppliedPng=image&&/\.png(?:\?|$)/i.test(image)?image:'';
  const photo=catalogPhoto?.startsWith('/')?catalogPhoto:suppliedPng;
  if(photo){
    return <div className={`real-product ${className}`}><img src={photo} alt={name} loading="lazy"/></div>;
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
