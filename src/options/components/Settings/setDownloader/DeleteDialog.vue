<script setup lang="ts">
import {inject, Ref} from "vue";
import {useDownloaderStore} from "@/shared/store/downloader";

const showDialog = inject<Ref<boolean>>("showDeleteDialog")!;
const toDeleteDownloaderIds = inject<Ref<string[]>>("toDeleteDownloaderIds")!;

function removeClients() {
  const downloaderStore = useDownloaderStore();

  for (const toDeleteDownloaderId of toDeleteDownloaderIds.value) {
    downloaderStore.removeDownloaderConfig(toDeleteDownloaderId);
  }
  toDeleteDownloaderIds.value = [];
  showDialog.value = false;
}
</script>

<template>
  <v-dialog v-model="showDialog" width="300">
    <v-card>
      <v-card-title class="bg-red-lighten-2">
        {{ $t('common.dialog.title.confirmAction') }}
      </v-card-title>

      <v-card-text>
        {{ $t('setDownloader.delete.text', [toDeleteDownloaderIds.length]) }}
      </v-card-text>

      <v-card-actions>
        <v-spacer />
        <v-btn variant="text" color="info" @click="showDialog=false">
          <v-icon icon="mdi-close-circle" />
          <span class="ml-1">{{ $t('common.dialog.cancel') }}</span>
        </v-btn>
        <v-btn variant="text" color="error" @click="removeClients">
          <v-icon icon="mdi-check-circle-outline" />
          <span class="ml-1">{{ $t('common.dialog.ok') }}</span>
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>


<style scoped>

</style>
