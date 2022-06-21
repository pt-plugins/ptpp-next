<script lang="ts" setup>
import { useDisplay } from "vuetify";
import { useUIStore } from "@/shared/store/ui";
import { GROUP_QQ, GROUP_TELEGRAM, REPO_URL } from "@/shared/constants/repo";

const uiStore = useUIStore();
const display = useDisplay();

const helpMenu = [
  { type: "wiki", icon: "mdi-wikipedia", href: `${REPO_URL}/wiki` },
  { type: "forum", icon: "mdi-forum", href: `${REPO_URL}/discussions` },
  { type: "telegram", icon: "mdi-send-circle", href: GROUP_TELEGRAM },
  { type: "qq", icon:"mdi-qqchat", href: GROUP_QQ }
];
</script>

<template>
  <v-app-bar id="ptpp-topbar" app color="amber">
    <template #prepend>
      <v-app-bar-nav-icon
        :title="$t('topbar.navBarTip')"
        :style="{
          'margin-inline-start': !display.mdAndDown.value ? '0px' : null
        }"
        @click="uiStore.isNavBarOpen = !uiStore.isNavBarOpen"
      />
    </template>

    <v-app-bar-title style="max-width: 220px">
      {{ $t("common.name") }}
    </v-app-bar-title>

    <!-- TODO Full searchbox -->
    <v-spacer />

    <template #append>
      <!-- 处于大屏幕，完整显示所有btn -->
      <template v-if="!display.mdAndDown.value">
        <v-btn
          :href="REPO_URL" target="_blank"
          rel="noopener noreferrer nofollow"
          size="large"
        >
          <v-icon icon="mdi-home" />
          <span class="ml-1">{{ $t("layout.header.home") }}</span>
        </v-btn>
        <v-menu location="bottom end">
          <template #activator="{ props }">
            <v-btn size="large" v-bind="props">
              <v-icon icon="mdi-help-circle" />
              {{ $t('layout.header.help') }}
            </v-btn>
          </template>

          <v-list density="compact">
            <v-list-item v-for="(item, index) in helpMenu" :key="index" :value="index">
              <v-btn
                :class="[`help-type-${item.type}`]"
                :prepend-icon="item.icon"
                :href="item.href" rel="noopener noreferrer nofollow"
                target="_blank" block
                variant="plain"
                style="justify-content: start"
              >
                {{ item.type }}
              </v-btn>
            </v-list-item>
          </v-list>
        </v-menu>
      </template>

      <!-- 处于小屏幕，只显示搜索 -->
      <template v-else>
        <!-- TODO small searchbox -->
        <v-btn icon="mdi-magnify" />
      </template>
    </template>
  </v-app-bar>
</template>

<style lang="scss" scoped>
.help-type-telegram :deep(i.v-icon) {
  transform: rotate(-45deg);
}
</style>
