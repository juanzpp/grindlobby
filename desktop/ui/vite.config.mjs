import {cpSync,existsSync,mkdirSync} from "node:fs";
import {resolve} from "node:path";
import {socialTabsTransformPlugin} from "./social-tabs-transform.mjs";
import {musicTabTransformPlugin} from "./music-tab-transform.mjs";
import {lobbyMusicAudioTransformPlugin} from "./lobby-music-audio-transform.mjs";
import {voiceReliabilityTransformPlugin} from "./voice-reliability-transform.mjs";
import {nativeBridgeTransformPlugin} from "./native-bridge-transform.mjs";
import {referenceUiTransformPlugin} from "./reference-ui-transform.mjs";
import {finalApprovedV2TransformPlugin} from "./final-approved-v2-transform.mjs";
import {finalProfileStoreTransformPlugin} from "./final-profile-store-transform.mjs";
import {finalFunctionalWiringPlugin} from "./final-functional-wiring.mjs";
import {finalSettingsTransformPlugin} from "./final-settings-transform.mjs";
import {finalCssWiringPlugin} from "./final-css-wiring.mjs";
import {finalApprovedSymbolsPlugin} from "./final-approved-symbols.mjs";
import {mockupExactCoreTransformPlugin} from "./mockup-exact-core-transform.mjs";
import {mockupExactSocialTransformPlugin} from "./mockup-exact-social-transform.mjs";
import {mockupExactSafetyTransformPlugin} from "./mockup-exact-safety-transform.mjs";
import {referenceLockTransformPlugin} from "./reference-lock-transform.mjs";

const approvedReferenceUiPlugin={...referenceUiTransformPlugin(),enforce:"pre"};
const dedicatedMusicSurfacePlugin={
  name:"grindlobby-dedicated-music-surface",
  enforce:"pre",
  transform(code,id){
    if(!id.endsWith("main.jsx"))return null;
    const fixed=code.replace('<MusicBar notify={notify}/>','{view==="music"&&<MusicBar notify={notify}/>}');
    return fixed===code?null:{code:fixed,map:null};
  }
};
const loginWindowSurfacePlugin={
  name:"grindlobby-login-window-surface",
  enforce:"pre",
  transform(code,id){
    if(!id.endsWith("main.jsx")||code.includes('import"./login-shell-fix.css";'))return null;
    let fixed=code.replace('import"./pixel-match.css";','import"./pixel-match.css";\nimport"./login-shell-fix.css";');
    if(fixed===code)fixed=code.replace('import"./styles.css";','import"./styles.css";\nimport"./login-shell-fix.css";');
    return fixed===code?null:{code:fixed,map:null};
  }
};
const desktopBrandAssetsPlugin={
  name:"grindlobby-desktop-brand-assets",
  closeBundle(){
    const source=resolve(process.cwd(),"../../public/brand");
    const target=resolve(process.cwd(),"dist/brand");
    if(!existsSync(source))return;
    mkdirSync(target,{recursive:true});
    cpSync(source,target,{recursive:true,force:true});
  }
};

export default {
  plugins: [
    approvedReferenceUiPlugin,
    dedicatedMusicSurfacePlugin,
    loginWindowSurfacePlugin,
    nativeBridgeTransformPlugin(),
    socialTabsTransformPlugin(),
    musicTabTransformPlugin(),
    lobbyMusicAudioTransformPlugin(),
    voiceReliabilityTransformPlugin(),
    {
      name:"grindlobby-desktop-css-contract",
      enforce:"pre",
      transform(code,id){
        if(!id.endsWith("styles.css"))return null;
        const fixed=code
          .replaceAll(".musicbar>div:nth-child(2)b{",".musicbar>div:nth-child(2)>b{")
          .replaceAll(".musicbar>div:nth-child(2)small{",".musicbar>div:nth-child(2)>small{");
        return {code:fixed,map:null};
      }
    },

    // Legacy/mockup transforms run first. They can provide functionality and
    // secondary surfaces, but they are not allowed to overwrite the final
    // visual contract selected from the approved references.
    mockupExactCoreTransformPlugin(),
    mockupExactSocialTransformPlugin(),
    mockupExactSafetyTransformPlugin(),

    // The approved visual/functionality passes intentionally run last.
    finalApprovedV2TransformPlugin(),
    finalProfileStoreTransformPlugin(),
    finalSettingsTransformPlugin(),
    finalFunctionalWiringPlugin(),
    finalCssWiringPlugin(),
    finalApprovedSymbolsPlugin(),
    referenceLockTransformPlugin(),
    desktopBrandAssetsPlugin
  ],
  build:{
    chunkSizeWarningLimit:1000
  }
};
