import GrindPortalLoading, {type GrindPortalLoadingProps} from "@/components/feedback/GrindPortalLoading";

/** @deprecated Prefer GrindPortalLoading. Kept to preserve existing call sites. */
export default function GrindLoading(props: GrindPortalLoadingProps) {
  return <GrindPortalLoading {...props} />;
}
