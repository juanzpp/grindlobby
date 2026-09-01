'use client';

import {catalogMatch,productCutoutFor} from '@/lib/beverageCatalog';

type Props={name:string; category?:string; className?:string; image?:string};
export default function ProductArt({name,category='',className='',image}:Props){
  const catalogPhoto=catalogMatch(name)?.image;
  const suppliedPhoto=image&&(/^(?:https?:|data:image\/|\/)/i.test(image))?image:'';
  const suppliedIsGeneric=suppliedPhoto.startsWith('/assets/products/cutouts/');
  const photo=(suppliedIsGeneric?catalogPhoto:suppliedPhoto)||catalogPhoto||productCutoutFor(name,category);
  return <div className={`real-product ${className}`}><img src={photo} alt={`Embalagem de ${name}`} loading="lazy"/></div>;
}
