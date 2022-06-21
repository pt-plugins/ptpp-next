<script setup lang="ts">
import {lang, definedLangMetaData, supportTheme, useUIStore} from "@/shared/store/ui";

const uiStore = useUIStore();
</script>

<template>
  <v-select
    v-model="lang" :label="$t('setBase.ui.changeLanguage')"
    :items="definedLangMetaData"
  /> <!-- 插件语言设置 -->

  <v-select
    v-model="uiStore.theme" :label="$t('setBase.ui.displayMode.index')"
    :items="supportTheme"
  >
    <template #selection="{item}">
      {{ $t("setBase.ui.displayMode." + item.raw) }}
    </template>

    <template #item="{ item, props }">
      <v-list-item
        v-bind="props"
        :title="$t('setBase.ui.displayMode.' + item.raw)"
      />
    </template>
  </v-select> <!-- 明亮模式设置 -->
</template>


<style scoped>

</style>
