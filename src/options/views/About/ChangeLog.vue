<script lang="ts" setup>
import { ref } from "vue";
import axios from "axios";
import { marked } from "marked";
import { useStorage } from "@vueuse/core";
import { REPO_URL, REPO_API } from "@/shared/constants/repo";
import { getFullVersion } from "@/shared/constants/extension";

const version = getFullVersion();
const releasePage = `${REPO_URL}/releases/tag/${version.main}`;

enum VersionLoadStatus { loading, fail }
const loadStatus = ref<VersionLoadStatus>(VersionLoadStatus.loading);

// 更新主版本情况
interface IReleaseData {
  tag_name: string;
  body: string;
}

const releaseData = useStorage<Partial<IReleaseData>>("version-release-data", {});
if (typeof releaseData.value.tag_name === "undefined" || releaseData.value.tag_name !== version.main) {
  axios.get<IReleaseData>(`${REPO_API}/releases/tags/${version.main}`).then(({ data }) => {
    data.body = data.body
      .replace(/(#)(\d+)/g, `[#$2](${REPO_URL}/issues/$2)`) // 生成 issue 的链接
      .replace(/(@)([\S]+)/g, "[@$2](https://github.com/$2)"); // 生成 committer 的主页链接

    releaseData.value = data;
  }).catch(() => {
    loadStatus.value = VersionLoadStatus.fail;
  });
}

// 加载当前commit说明
interface ICommitData {
  sha: string;
  commit: { message: string };
  author: { login: string; html_url: string };
  html_url: string;
  stats: { total: number; additions: number; deletions: number };
}

const commitData = useStorage<Partial<ICommitData>>("version-commit-data", {});
if (typeof commitData.value.sha === "undefined" || !commitData.value.sha.startsWith(version.hash)) {
  axios.get<ICommitData>(`${REPO_API}/commits/${version.hash}`).then(({ data }) => {
    commitData.value = data;
  });
}
</script>

<template>
  <v-row>
    <v-col>
      <v-card>
        <v-card-header>
          <v-card-header-text>{{ $t("ChangeLog.noteVersion") }}</v-card-header-text>
        </v-card-header>

        <v-card-text>
          <div v-if="releaseData.body" v-html="marked.parse(releaseData.body)" />
          <div
            v-else-if="loadStatus === VersionLoadStatus.loading"
          >
            {{ $t("ChangeLog.loading", { releasePage }) }}
          </div>
          <div
            v-else-if="loadStatus === VersionLoadStatus.fail"
          >
            {{ $t("ChangeLog.loadFail", { releasePage }) }}
          </div>
        </v-card-text>
      </v-card>
    </v-col>
  </v-row>
  <v-row v-if="commitData.sha">
    <v-col>
      <v-card>
        <v-card-header>
          <v-card-header-text>{{ $t("ChangeLog.noteCommit") }}</v-card-header-text>
        </v-card-header>
        <v-card-subtitle>
          <a :href="commitData.html_url" target="_blank">{{ version.hash }}</a>&nbsp;
          (
          <v-icon icon="mdi-plus" color="green" />
          {{ commitData.stats.additions }}&nbsp;
          <v-icon icon="mdi-minus" color="red" />
          {{ commitData.stats.deletions }}) &nbsp;
          by&nbsp;
          <a
            :href="commitData.author.html_url"
            target="_blank"
          >@{{ commitData.author.login }}</a>
          )
        </v-card-subtitle>

        <v-card-text>
          <div class="markdown-body commit-detail">
            <pre>{{ commitData.commit.message }}</pre>
          </div>
        </v-card-text>
      </v-card>
    </v-col>
  </v-row>
</template>
