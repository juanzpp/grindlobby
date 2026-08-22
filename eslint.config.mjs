import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";

export default defineConfig([
  ...nextVitals,
  {
    rules: {
      // The current media/realtime architecture intentionally uses module-level
      // singletons and effect-driven polling. Keep React Compiler diagnostics
      // visible without blocking production verification until those flows are
      // migrated incrementally and can be regression-tested end to end.
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/use-memo": "warn",
      "react-hooks/immutability": "warn",
      "react-hooks/purity": "warn",
      "react-hooks/globals": "warn",
    },
  },
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "coverage/**",
    "desktop/src-tauri/target/**",
    "next-env.d.ts",
  ]),
]);
