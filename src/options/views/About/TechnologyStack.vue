<script lang="ts" setup>
import axios from "axios";
import { reactive, computed } from "vue";
import { REPO_URL } from "@/shared/constants/repo";
import { useStorage } from "@vueuse/core";

const ptppHistory = [
  {
    name: "PTPP Next",
    time: "2020-10-25",
    link: "https://github.com/pt-plugins/ptpp-next"
  },
  {
    name: "PT Plugin Plus",
    time: "2018-12-16",
    link: "https://github.com/ronggang/PT-Plugin-Plus"
  },
  {
    name: "PT Plugin （Rhilip修改版）",
    time: "2018-04-18",
    link: "https://github.com/Rhilip/PT-Plugin"
  },
  {
    name: "PT Plugin",
    time: "before 2014-10-10",
    link: "https://github.com/ronggang/PT-Plugin"
  }
];

interface ITData {
  name: string,
  version: string,
  url: string
}

const rawDependencies = reactive<Record<string, ITData>>({});

const tableDependencies = computed(() => Object.values(rawDependencies).sort((a,b) => a.name.localeCompare(b.name)));

// Load deps from package.json
const rawDependencyContext = import.meta.webpackContext!("@/..", {
  regExp: /package\.json$/,
  exclude: /node_module/,
  mode: "sync"
});

const npmjsPrefix = "https://www.npmjs.com/package/";
for (const dependencyKey of rawDependencyContext.keys()) {
  const { dependencies } = rawDependencyContext(dependencyKey);
  Object.entries(dependencies).forEach(value => {
    const [name,version] = value;
    if (!name.startsWith("@ptpp")) {
      rawDependencies[name] = {
        name,
        version: (version as string),
        url: `${npmjsPrefix}${name}`
      };
    }
  });
}

// Other Deps
[
  {
    name: "Jackett",
    version: "latest",
    url: "https://github.com/Jackett/Jackett"
  }
].forEach(value => {
  rawDependencies[value.name] = value;
});

// Update deps homepage link
const technologyData = useStorage<Record<string, string>>("technology-data", {});
Object.values(rawDependencies).forEach(value => {
  if (value.url.startsWith(npmjsPrefix)) {
    if (typeof technologyData.value[value.name] === "undefined") {
      axios.get(`https://registry.npmjs.org/${value.name}`)
        .then(({ data }) => {
          technologyData.value[value.name] = rawDependencies[value.name].url = data?.homepage;
        });
    } else {
      rawDependencies[value.name].url = technologyData.value[value.name];
    }
  }
});
</script>

<template>
  <v-alert class="mb-2" type="info">
    {{ $t('TechnologyStack.thankNote') }}
  </v-alert>
  <v-card class="mb-2">
    <v-card-title>{{ $t('TechnologyStack.ptppHistory') }}</v-card-title>
    <v-card-text>
      <v-timeline :side="$vuetify.display.mdAndUp ? undefined : 'end'">
        <v-timeline-item v-for="history in ptppHistory" :key="history.name" rounded>
          <v-row class="pt-1">
            <v-col cols="4">
              {{ history.time }}
            </v-col>
            <v-col>
              <strong>{{ history.name }}</strong><br>
              <a :href="history.link" target="_blank">{{ history.link }}</a>
            </v-col>
          </v-row>
        </v-timeline-item>
      </v-timeline>
    </v-card-text>
  </v-card>
  <v-card>
    <v-card-title>
      {{ $t('TechnologyStack.dependency') }}
      <v-spacer />
      <v-btn
        :href="`${REPO_URL}/network/dependencies`" target="_blank"
        variant="text" color="primary"
        append-icon="mdi-open-in-new"
      >
        {{ $t('TechnologyStack.seeAllDependency') }}
      </v-btn>
    </v-card-title>
    <v-card-text>
      <v-table>
        <thead>
          <tr>
            <th class="text-center">
              {{ $t("TechnologyStack.stackTableColumn.name") }}
            </th>
            <th class="text-center">
              {{ $t("TechnologyStack.stackTableColumn.version") }}
            </th>
            <th class="text-left">
              {{ $t("TechnologyStack.stackTableColumn.homepage") }}
            </th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="deps in tableDependencies" :key="deps.name">
            <td class="text-center">
              {{ deps.name }}
            </td>
            <td class="text-center">
              {{ deps.version }}
            </td>
            <td class="text-left">
              <a :href="deps.url" target="_blank" rel="noopener noreferrer nofollow">{{ deps.url }}</a>
            </td>
          </tr>
        </tbody>
      </v-table>
    </v-card-text>
  </v-card>
</template>

<style scoped>

</style>
