import {deadTabsTransformPlugin} from "./dead-tabs-transform.mjs";

export default {
  plugins: [
    deadTabsTransformPlugin(),
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
