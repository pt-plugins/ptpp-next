<script lang="ts" setup>
import {useRouter} from "vue-router";

const router = useRouter();
const setBaseChildren = router.getRoutes().find(x => x.name == "setBase")!.children;
</script>

<template>
  <v-card>
    <v-tabs color="primary" centered>
      <v-tab
        v-for="tab in setBaseChildren" :key="tab.name"
        :to="{name: tab.name}"
      >
        <v-icon :icon="tab.meta.icon" />
        {{ $t("setBase.tab." + tab.meta.tabKey) }}
      </v-tab>
    </v-tabs>

    <v-container>
      <router-view />
    </v-container>
  </v-card>
</template>

<style scoped></style>
