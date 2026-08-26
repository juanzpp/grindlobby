export function finalCssWiringPlugin(){
  return {
    name:"grindlobby-final-functional-css",
    enforce:"post",
    transform(code,id){
      if(!id.endsWith("main.jsx"))return null;
      let fixed=code;
      if(!fixed.includes('import"./final-functional-surfaces.css";')){
        fixed=fixed.replace('import"./final-approved-v2.css";','import"./final-approved-v2.css";\nimport"./final-functional-surfaces.css";');
        if(fixed===code)fixed=code.replace('import"./pixel-match.css";','import"./pixel-match.css";\nimport"./final-functional-surfaces.css";');
      }
      if(!fixed.includes('import"./final-settings.css";'))fixed=fixed.replace('import"./final-functional-surfaces.css";','import"./final-functional-surfaces.css";\nimport"./final-settings.css";');
      return fixed===code?null:{code:fixed,map:null};
    }
  };
}
