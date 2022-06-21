/**
 * this plugin is edit from ohmree/pinia-plugin-webext-storage
 */
import { ref, type Ref } from "vue";
import browser from "webextension-polyfill";
import { PiniaPluginContext, MutationType } from "pinia";
import {
  persistent, restore,
  type persistentOptions, type restoreOptions
} from "@/shared/browser/storage";

export interface PersistedStateOptions extends Omit<persistentOptions & restoreOptions, "initialValue"> {
  /**
   * Storage key to use.
   * @default $store.id
   */
  key?: string;

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
}

declare module "pinia" {
  export interface DefineStoreOptionsBase<S, Store> {
    /**
     * Persist store in storage.
     */
    persistWebExt?: boolean | PersistedStateOptions;
  }

  export interface PiniaCustomProperties {
    $save(): Promise<void>;

    readonly $ready: Ref<boolean>;
  }
}

export default function webExtStorage(context: PiniaPluginContext) {
  const { options: { persistWebExt }, store } = context;

  if (!persistWebExt) {
    return {};
  }

  const {
    key = store.$id,
    storageArea = "local",
    writeDefaults = true,
    autoSaveType = [MutationType.direct],
    pickPath = undefined,
    omitPath = ["cache"],
    beforeRestore = null,
    afterRestore = null,
    onError = null
  } = typeof persistWebExt !== "boolean" ? persistWebExt : {};

  const $ready = ref(false);

  beforeRestore?.(context);
  restore(key, {
    initialValue: store.$state,
    storageArea, writeDefaults, onError
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
      await persistent(key, newState, { storageArea, pickPath, omitPath });
      browser.storage.onChanged.addListener(onChanged);
    } catch (_error) {
      onError?.(_error, "piniaSave");
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

  return { $dispose, $save, $ready };
}
