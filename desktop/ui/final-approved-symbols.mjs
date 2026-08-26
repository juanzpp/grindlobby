export function finalApprovedSymbolsPlugin(){
  return {
    name:"grindlobby-final-approved-symbols",
    enforce:"post",
    transform(code,id){
      if(!id.endsWith("main.jsx")||!code.includes("Swords"))return null;
      const fixed=code.replace("ShoppingBag,Sparkles,Store","ShoppingBag,Sparkles,Swords,Store");
      return fixed===code?null:{code:fixed,map:null};
    }
  };
}
