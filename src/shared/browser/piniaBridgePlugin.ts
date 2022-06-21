/**
 * this plugin is edit from ohmree/pinia-plugin-webext-storage
 */
import {ref, type Ref} from "vue";
import browser from "webextension-polyfill";
import {PiniaPluginContext, MutationType} from "pinia";
import {persistent, restore, storageArea} from "./storage";

export interface PersistedStateOptions {
  /**
   * Storage key to use.
   * @default $store.id
   */
  key?: string;

  /**
   * Where to store persisted state.
   * @default 'local'
   */
  storageArea?: storageArea;

  writeDefaultState?: boolean;
  autoSaveType?: boolean | MutationType[];

  /**
   * Hook called before state is hydrated from storage.
   * @default undefined
   */
  beforeRestore?: (context: PiniaPluginContext) => void;

  /**
   * Hook called after state is hydrated from storage.
   * @default undefined
   */
  afterRestore?: (context: PiniaPluginContext) => void;

  onRestoreError?: (e: any) => void;
}

declare module "pinia" {
  export interface DefineStoreOptionsBase<S, Store> {
    /**
     * Persist store in storage.
     */
    persist?: boolean | PersistedStateOptions;
  }

  export interface PiniaCustomProperties {
    $save(): Promise<void>;

    readonly $ready: Ref<boolean>;
  }
}


export default function piniaBridgePlugin(context: PiniaPluginContext) {
  const {options: {persist}, store} = context;

  if (!persist) {
    return {};
  }

  const {
    key = store.$id,
    storageArea = "local",
    writeDefaultState = true,
    autoSaveType = [MutationType.direct],
    beforeRestore = null,
    afterRestore = null,
    onRestoreError = null
  } = typeof persist !== "boolean" ? persist : {};

  const $ready = ref(false);

  beforeRestore?.(context);
  restore(key, {
    initialValue: store.$state,
    storage: storageArea,
    writeDefaults: writeDefaultState,
    onError: onRestoreError
  })
    .then(value => {
      store.$patch(value as unknown as typeof store.$state);
      $ready.value = true;
      afterRestore?.(context);
    });

  function onChanged(changes: Record<string, browser.Storage.StorageChange>, areaName: string) {
    if (areaName === storageArea && Object.hasOwn(changes, key)) {
      store.$patch(changes[key].newValue);
    }
  }

  browser.storage.onChanged.addListener(onChanged);

  const $save = async (newState = store.$state) => {
    try {
      browser.storage.onChanged.removeListener(onChanged);
      // HACK: we might want to find a better way of deeply unwrapping a reactive object.
      await persistent(key, newState, storageArea);
      browser.storage.onChanged.addListener(onChanged);
    } catch (_error) {
    }
  };

  if (autoSaveType && Array.isArray(autoSaveType)) {
    store.$subscribe((mutation, state: any) => {
      console.log("Store `" + store.$id + "` change subscribed: ", mutation);
      if (autoSaveType.includes(mutation.type)) {
        $save(state);
      }
    });
  }

  const $dispose = () => {
    browser.storage.onChanged.removeListener(onChanged);
    store.$dispose();
  };

  return {$dispose, $save, $ready};
}
