export function referenceExactCssWiringPlugin(){
  return {
    name:"grindlobby-reference-exact-css-wiring",
    enforce:"post",
    transform(code,id){
      if(!id.endsWith("main.jsx"))return null;
      let fixed=code;
      const imports=[];
      if(!fixed.includes('import"./reference-exact.css";'))imports.push('import"./reference-exact.css";');
      if(!fixed.includes('import"./reference-exact-social.css";'))imports.push('import"./reference-exact-social.css";');
      if(!imports.length)return null;
      if(fixed.includes('import"./reference-lock.css";'))fixed=fixed.replace('import"./reference-lock.css";','import"./reference-lock.css";\n'+imports.join('\n'));
      else fixed=fixed.replace('import"./styles.css";','import"./styles.css";\n'+imports.join('\n'));
      return fixed===code?null:{code:fixed,map:null};
    }
  };
}
