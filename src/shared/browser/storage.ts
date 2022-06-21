import { omit, pick } from "lodash-es";
import { Ref, shallowRef, ref, unref } from "vue";
import browser, { Storage } from "webextension-polyfill";
import { StorageOptions, watchWithFilter } from "@vueuse/core";

export type storageArea = Exclude<keyof Storage.Static, "onChanged">

interface storageBaseOptions {
  /**
   * Where to store persisted state.
   * @default 'local'
   */
  storageArea?: storageArea,
}

export interface persistentOptions extends storageBaseOptions {
  /**
   * Only store need path in state
   *  - pickPath has high priority than omitPath
   *  -
   */
  pickPath?: string[];
  omitPath?: string[];
}

export function persistent<T>(key: string, newValue: T, options: persistentOptions) {
  const {
    storageArea = "local",
    pickPath, omitPath
  } = options;

  let toStoreData = JSON.parse(JSON.stringify(newValue));
  if (pickPath) {
    toStoreData = pick(toStoreData, pickPath);
  } else if (omitPath) {
    toStoreData = omit(toStoreData, omitPath);
  }

  browser.storage[storageArea].set({ [key]: toStoreData });
}

export interface restoreOptions<T = any> extends storageBaseOptions {
  initialValue?: T | Ref<T>,
  writeDefaults?: boolean
  onError?: null | ((e: unknown, path?: string) => void),
}

export async function restore<T>(key: string, options: restoreOptions<T> = {}): Promise<T> {
  const {
    initialValue,
    storageArea = "local",
    writeDefaults = true,
    onError = null
  } = options;

  const rawInit: T = unref(initialValue)!;

  try {
    const { [key]: fromStorage } = await browser.storage[storageArea].get(key);
    if (fromStorage === null) {
      if (writeDefaults && rawInit !== null) {
        await persistent(key, rawInit, { storageArea });
      }
      return rawInit;
    } else {
      return fromStorage as T;
    }
  } catch (e) {
    onError?.(e, "restoreFromStorage");
    return rawInit;
  }
}

export function useBrowserStore<T>(
  key: string,
  initialValue?: T | Ref<T>,
  storageArea: storageArea = "local",
  options:
    persistentOptions
    & Omit<restoreOptions, "initialValue">
    & Pick<StorageOptions<T>, "flush" | "deep" | "eventFilter" | "listenToStorageChanges" | "shallow" > = {}
): Ref<T> {
  const {
    flush = "pre",
    deep = true,
    listenToStorageChanges = true,
    writeDefaults = true,
    shallow,
    eventFilter,
    pickPath, omitPath,
    onError = null,
  } = options;

  const data = (shallow ? shallowRef : ref)(initialValue) as Ref<T>;

  restore(key, { initialValue, storageArea, onError, writeDefaults })
    .then((v) => data.value = v);

  if (listenToStorageChanges) {
    browser.storage.onChanged.addListener((item, changeStorage) => {
      if (changeStorage === storageArea && item?.[key]?.newValue) {
        data.value = item[key].newValue;
      }
    });
  }

  watchWithFilter(
    data,
    async () => {
      try {
        if (data.value === null) {
          await browser.storage[storageArea].remove(key);
        } else {
          await persistent(key, data.value, { storageArea, pickPath, omitPath });
        }
      } catch (e: unknown) {
        onError?.(e,"watchCallback");
      }
    },
    {
      flush,
      deep,
      eventFilter,
    }
  );

  return data;
}
