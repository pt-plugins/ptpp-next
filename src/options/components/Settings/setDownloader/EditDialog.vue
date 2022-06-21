<script lang="ts" setup>
import {inject, type Ref} from "vue";
import {useDownloaderStore} from "@/shared/store/downloader";
import type {BittorrentClientBaseConfig} from "@ptpp/downloader";
import Editor from "./Editor.vue";

const showDialog = inject<Ref<boolean>>("showEditDialog")!;
const clientConfig = inject("clientConfig") as Ref<BittorrentClientBaseConfig>;

function patchClient() {
  const store = useDownloaderStore();
  store.patchDownloaderConfig(clientConfig.value);
  showDialog.value = false;
}
</script>

<template>
  <v-dialog v-model="showDialog">
    <v-card width="800">
      <v-toolbar color="blue-grey darken-2">
        <v-toolbar-title>{{ $t("setDownloader.edit.title") }}</v-toolbar-title>
      </v-toolbar>
      <v-card-content>
        <Editor />
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
          variant="text"
          color="success"
          @click="patchClient"
        >
          <v-icon icon="mdi-check-circle-outline" />
          {{ $t("common.dialog.ok") }}
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<style scoped>

</style>
