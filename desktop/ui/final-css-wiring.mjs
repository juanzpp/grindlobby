export function finalCssWiringPlugin(){
  return {
    name:"grindlobby-final-functional-css",
    enforce:"post",
    transform(code,id){
      if(!id.endsWith("main.jsx")||code.includes('import"./final-functional-surfaces.css";'))return null;
      let fixed=code.replace('import"./final-approved-v2.css";','import"./final-approved-v2.css";\nimport"./final-functional-surfaces.css";');
      if(fixed===code)fixed=code.replace('import"./pixel-match.css";','import"./pixel-match.css";\nimport"./final-functional-surfaces.css";');
      return fixed===code?null:{code:fixed,map:null};
    }
  };
}
