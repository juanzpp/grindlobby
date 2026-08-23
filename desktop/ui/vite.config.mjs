import {deadTabsTransformPlugin} from "./dead-tabs-transform.mjs";
import {socialTabsTransformPlugin} from "./social-tabs-transform.mjs";
import {musicTabTransformPlugin} from "./music-tab-transform.mjs";
import {lobbyMusicAudioTransformPlugin} from "./lobby-music-audio-transform.mjs";
import {voiceReliabilityTransformPlugin} from "./voice-reliability-transform.mjs";
import {nativeBridgeTransformPlugin} from "./native-bridge-transform.mjs";
import {referenceUiTransformPlugin} from "./reference-ui-transform.mjs";

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

export default {
  plugins: [
    approvedReferenceUiPlugin,
    dedicatedMusicSurfacePlugin,
    nativeBridgeTransformPlugin(),
    deadTabsTransformPlugin(),
    socialTabsTransformPlugin(),
    musicTabTransformPlugin(),
    lobbyMusicAudioTransformPlugin(),
    voiceReliabilityTransformPlugin(),
    {
      name: "grindlobby-desktop-css-contract",
      enforce: "pre",
      transform(code, id) {
        if (!id.endsWith("styles.css")) return null;
        const fixed = code
          .replaceAll(".musicbar>div:nth-child(2)b{", ".musicbar>div:nth-child(2)>b{")
          .replaceAll(".musicbar>div:nth-child(2)small{", ".musicbar>div:nth-child(2)>small{");
        return { code: fixed, map: null };
      }
    }
  ],
  build: {
    chunkSizeWarningLimit: 1000
  }
};
