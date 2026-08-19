import {z} from "zod";
import {AGE_BANDS} from "@/lib/age-band";

export const ageBandSchema=z.enum(AGE_BANDS);
export const ageBandPostSchema=z.object({ageBand:ageBandSchema}).strict();
