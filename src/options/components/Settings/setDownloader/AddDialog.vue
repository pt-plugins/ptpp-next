<script lang="ts" setup>
import { reactive, ref, inject, watch, type Ref, unref, onMounted } from "vue";
import { REPO_URL } from "@/shared/constants";
import {
  entityList,
  getDownloaderMetaData,
  getDownloaderIcon,
  getDownloaderDefaultConfig,
  BittorrentClientBaseConfig, TorrentClientMetaData,
} from "@ptpp/downloader";
import { useDownloaderStore } from "@/shared/store/downloader";
import Editor from "./Editor.vue";

const showDialog = inject<Ref<boolean>>("showAddDialog")!;
const currentStep = ref<0 | 1>(0);
const selectedClientType = ref<string | null>(null);

// 当model的可见性发生变化时，清空 step 以及 selectedClientType
watch(showDialog, () => {
  currentStep.value = 0;
  selectedClientType.value = null;
});

const clientMetaData = reactive<Record<string, {
  icon: string,
  metadata: TorrentClientMetaData
}>>({});

onMounted(async () => {
  for (const entityListElement of entityList) {
    clientMetaData[entityListElement] = {
      icon: getDownloaderIcon(entityListElement),
      metadata: await getDownloaderMetaData(entityListElement)
    };
  }
});

const clientConfig = inject<Ref<BittorrentClientBaseConfig>>("clientConfig")!;

async function updateSelectedClientType(selectClientType: string) {
  clientConfig.value = await getDownloaderDefaultConfig(selectClientType);
}

function saveClient() {
  const downloaderStore = useDownloaderStore();
  downloaderStore.addDownloaderConfig(unref(clientConfig));
  showDialog.value = false;
}
</script>

<template>
  <v-dialog v-model="showDialog">
    <v-card width="800">
      <v-toolbar color="blue-grey darken-2">
        <v-toolbar-title>{{ $t("setDownloader.add.title") }}</v-toolbar-title>
        <v-spacer />
        <v-btn
          icon="mdi-help-circle"
          color="success"
          :href="`${REPO_URL}/wiki/config-download-client`"
          target="_blank"
          rel="noopener noreferrer nofollow"
        />
      </v-toolbar>
      <v-card-content>
        <!-- TODO want: v-stepper -->
        <v-window v-model="currentStep">
          <v-window-item :key="0">
            <v-autocomplete
              v-model="selectedClientType"
              :items="entityList"
              :hint="clientMetaData[selectedClientType]?.metadata.description ?? ''"
              persistent-hint
              @update:modelValue="updateSelectedClientType"
            >
              <template #item="{ props, item }">
                <v-list-item
                  :prepend-avatar="clientMetaData[item.raw]?.icon ?? ''"
                  v-bind="props"
                  :title="item.raw"
                >
                  <v-list-item-action end>
                    {{ clientMetaData[item.raw]?.metadata.version ?? '' }}
                  </v-list-item-action>
                </v-list-item>
              </template>
            </v-autocomplete>
          </v-window-item>
          <v-window-item :key="1">
            <Editor />
          </v-window-item>
        </v-window>
      </v-card-content>
      <v-card-actions>
        <v-spacer />
        <v-btn
          color="error"
          variant="text"
          @click="showDialog = false"
        >
          <v-icon icon="mdi-close-circle" />
          {{ $t("common.dialog.cancel") }}
        </v-btn>
        <v-btn
          v-if="currentStep === 1"
          color="blue-darken-1"
          variant="text"
          @click="currentStep--"
        >
          <v-icon icon="mdi-chevron-left" />
          {{ $t("common.dialog.prev") }}
        </v-btn>
        <v-btn
          v-if="currentStep === 0"
          :disabled="selectedClientType == null"
          color="blue-darken-1"
          variant="text"
          @click="currentStep++"
        >
          {{ $t("common.dialog.next") }}
          <v-icon icon="mdi-chevron-right" />
        </v-btn>
        <v-btn
          v-if="currentStep === 1"
          variant="text"
          color="success"
          @click="saveClient"
        >
          <v-icon icon="mdi-check-circle-outline" />
          {{ $t("common.dialog.ok") }}
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<style scoped></style>
