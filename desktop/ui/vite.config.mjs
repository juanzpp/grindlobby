import {deadTabsTransformPlugin} from "./dead-tabs-transform.mjs";
import {socialTabsTransformPlugin} from "./social-tabs-transform.mjs";
import {musicTabTransformPlugin} from "./music-tab-transform.mjs";
import {lobbyMusicAudioTransformPlugin} from "./lobby-music-audio-transform.mjs";
import {voiceReliabilityTransformPlugin} from "./voice-reliability-transform.mjs";

export default {
  plugins: [
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
