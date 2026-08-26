export function debugFinalSourcePlugin(){
  return {
    name:"grindlobby-debug-final-source",
    enforce:"post",
    transform(code,id){
      if(!id.endsWith("main.jsx"))return null;
      const lines=code.split(/\r?\n/);
      console.log("=== GRIND FINAL MAIN 45-65 ===");
      lines.slice(44,65).forEach((line,index)=>console.log(String(index+45).padStart(3,"0")+": "+line));
      console.log("=== END GRIND FINAL MAIN ===");
      return null;
    }
  };
}
