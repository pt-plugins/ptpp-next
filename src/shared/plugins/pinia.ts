import { createPinia } from "pinia";
import piniaBridgePlugin from "@/shared/store/plugin/WebExtStorage";

export const piniaInstance = createPinia();

piniaInstance.use(piniaBridgePlugin);
