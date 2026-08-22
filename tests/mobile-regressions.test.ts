import {describe,expect,it} from "vitest";
import {readFileSync} from "node:fs";
import {resolve} from "node:path";

const root=resolve(process.cwd());

function source(path:string){return readFileSync(resolve(root,path),"utf8")}

describe("mobile regressions",()=>{
  it("validates screen-share entitlement before starting browser capture",()=>{
    const code=source("components/stream/ScreenShare.tsx");
    const startIndex=code.indexOf("async function start()");
    const entitlementIndex=code.indexOf("await getServerEntitlement()",startIndex);
    const captureIndex=code.indexOf("createScreenTracks",startIndex);
    expect(startIndex).toBeGreaterThanOrEqual(0);
    expect(entitlementIndex).toBeGreaterThan(startIndex);
    expect(captureIndex).toBeGreaterThan(entitlementIndex);
  });

  it("targets the current stream player classes in mobile CSS",()=>{
    const css=source("app/mobile-audit-overrides.css");
    expect(css).toContain(".stream-player-shell");
    expect(css).toContain(".stream-stage");
    expect(css).toContain(".stream-modal");
    expect(css).toContain("transform: none !important");
  });
});
