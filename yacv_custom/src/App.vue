<!--suppress SillyAssignmentJS -->
<script lang="ts" setup>
import {defineAsyncComponent, provide, type Ref, ref, shallowRef, triggerRef, watch} from "vue";
import Sidebar from "./misc/Sidebar.vue";
import Loading from "./misc/Loading.vue";
import OrientationGizmo from "./tools/OrientationGizmo.vue";
import Models from "./models/Models.vue";

// Hidden selection component to maintain functionality
const SelectionComponent = defineAsyncComponent({
  loader: () => import("./tools/Selection.vue"),
  loadingComponent: () => "Loading...",
  delay: 0,
});
import {VBtn, VLayout, VMain, VToolbarTitle, VTooltip} from "vuetify/lib/components/index.mjs";
import {settings} from "./misc/settings";
import {NetworkManager, NetworkUpdateEvent, NetworkUpdateEventModel} from "./misc/network";
import {SceneMgr} from "./misc/scene";
import {Document} from "@gltf-transform/core";
import type ModelViewerWrapperT from "./viewer/ModelViewerWrapper.vue";
import {mdiCube, mdiPlus, mdiScriptTextPlay, mdiCursorDefaultClick} from '@mdi/js'
// @ts-expect-error
import SvgIcon from '@jamescoyle/vue-icon';

// NOTE: The ModelViewer library is big (THREE.js), so we split it and import it asynchronously
const ModelViewerWrapper = defineAsyncComponent({
  loader: () => import('./viewer/ModelViewerWrapper.vue'),
  loadingComponent: Loading,
  delay: 0,
});

let openSidebarsByDefault: Ref<boolean> = ref(window.innerWidth > window.innerHeight);

const sceneUrl = ref("")
const viewer: Ref<InstanceType<typeof ModelViewerWrapperT> | null> = ref(null);
const sceneDocument = shallowRef(new Document());
provide('sceneDocument', {sceneDocument});

// Selection state and functionality
const selectionEnabled = ref(false);
const selectionComp = ref<InstanceType<typeof SelectionComponent> | null>(null);
const selection = ref<Array<any>>([]);

function toggleSelection() {
  // Delegate to the hidden selection component
  if (selectionComp.value) {
    selectionComp.value.toggleSelection();
    // Update our local state to match the component's state
    selectionEnabled.value = selectionComp.value.selectionEnabled;
  }
}

// Watch for changes in the hidden selection component to keep UI in sync
watch(selectionComp, (newComp) => {
  if (newComp) {
    // Sync the initial state
    selectionEnabled.value = newComp.selectionEnabled || false;
  }
}, { immediate: true });
const models: Ref<InstanceType<typeof Models> | null> = ref(null)
const disableTap = ref(false);
const setDisableTap = (val: boolean) => disableTap.value = val;
provide('disableTap', {disableTap, setDisableTap});

async function onModelUpdateRequest(event: NetworkUpdateEvent) {
  // Trigger progress bar as soon as possible (also triggered earlier for each raw notification)
  if (viewer.value && event.models.length > 0) {
    viewer.value.onProgress(0.10);
  }
  // Load/unload a new batch of models to optimize rendering time
  console.log("Received model update request", event.models);
  let shutdownRequestIndex = event.models.findIndex((model) => model.isRemove == null);
  let shutdownRequest = null;
  if (shutdownRequestIndex !== -1) {
    console.log("Will shut down the connection after this load, as requested by the server");
    shutdownRequest = event.models.splice(shutdownRequestIndex, 1)[0];
  }
  let doc = sceneDocument.value;
  for (let modelIndex in event.models) {
    let isLast = parseInt(modelIndex) === event.models.length - 1;
    let model = event.models[modelIndex];
    if (!model) continue;
    // Remove selections for this model through the hidden selection component
    // Note: removeObjectSelections is handled by the Tools component in the original design
    // For now, we'll let the selection component handle it internally
    try {
      let loadHelpers = (await settings).loadHelpers;
      if (!model.isRemove) {
        doc = await SceneMgr.loadModel(sceneUrl, doc, model.name, model.url, isLast && loadHelpers, isLast);
      } else {
        doc = await SceneMgr.removeModel(sceneUrl, doc, model.name, isLast && loadHelpers, isLast);
      }
    } catch (e) {
      console.error("Error loading model", model, e);
    }
  }
  if (shutdownRequest !== null) {
    console.log("Shutting down the connection as requested by the server");
    event.disconnect();
  }
  sceneDocument.value = doc
  triggerRef(sceneDocument); // Why not triggered automatically?
}

async function onModelRemoveRequest(name: string) {
  await onModelUpdateRequest(new NetworkUpdateEvent([new NetworkUpdateEventModel(name, "", null, true)], () => {
  }));
}

// Set up the load model event listener
let networkMgr = new NetworkManager();
networkMgr.addEventListener('update-early',
    (e) => viewer.value?.onProgress((e as CustomEvent<Array<any>>).detail.length * 0.01));
networkMgr.addEventListener('update', (e) => onModelUpdateRequest(e as NetworkUpdateEvent));

// Test object is now loaded via preload settings - no custom loading needed
let preloadingModels = ref<Array<string>>([]);
(async () => { // Start loading all configured models ASAP
  let sett = await settings;
  if (sett.preload.length > 0) {
    watch(viewer, (newViewer) => {
      if (newViewer) {
        // Don't show any "Trying to load" messages - keep it clean
        // newViewer.setPosterText('<tspan x="50%" dy="1.2em">Trying to load' +
        //     ' models from:</tspan>' + sett.preload.map((url: string) => '<tspan x="50%" dy="1.2em">- ' + url + '</tspan>').join(""));
      }
    });
    for (let model of sett.preload) {
      preloadingModels.value.push(model);
      let removeFromPreloadingModels = () => {
        preloadingModels.value = preloadingModels.value.filter((m) => m !== model);
      };
      networkMgr.load(model).then(removeFromPreloadingModels).catch((e) => {
        removeFromPreloadingModels()
        console.error("Error preloading model", model, e);
      });
    }
  } // else No preloaded models (useful for playground mode)
})();

async function loadModelManual() {
  const modelUrl = prompt("For an improved experience in viewing CAD/GLTF models with automatic updates, it's recommended to use the official yacv_server Python package. This ensures seamless serving of models and automatic updates.\n\nOtherwise, enter the URL of the model to load:");
  if (modelUrl) await networkMgr.load(modelUrl);
}

function loadDemoModels() {
  for (let name of ['fox.glb', 'img.glb', 'location.glb', 'logo.glb', 'logo_hl.glb', 'logo_hl_tex.glb']) {
    networkMgr.load(`https://yeicor-3d.github.io/yet-another-cad-viewer/${name}`)
  }
}

// Detect dropped .glb files and load them manually
document.body.addEventListener("dragover", e => {
  e.preventDefault(); // Allow drop
});

document.body.addEventListener("drop", async e => {
  e.preventDefault();
  const file = e.dataTransfer?.files?.[0];
  if (!file) return;

  const ext = file.name.split('.').pop()?.toLowerCase();
  if (ext === 'glb' || ext === 'gltf') {
    await networkMgr.load(file);
  }
});
</script>

<template>
  <v-layout full-height>

    <!-- The main content of the app is the model-viewer with the SVG "2D" overlay -->
    <v-main id="main" style="position: relative;">
      <model-viewer-wrapper v-if="sceneDocument.getRoot().listMeshes().length > 0" ref="viewer" :src="sceneUrl"/>
      <!-- Empty screen - when no model loaded -->
      <div v-else style="height: 100%; background: #f8f9fa; display: flex; flex-direction: column; align-items: center; justify-content: center;">
        <div style="color: #666; font-size: 16px; margin-bottom: 8px;">Ready - Load Build123d code to view CAD models</div>
      </div>
      
      <!-- Version indicator - always visible in bottom right corner -->
      <div style="position: fixed; bottom: 20px; right: 20px; background: rgba(0,0,0,0.7); color: white; padding: 6px 10px; border-radius: 6px; font-size: 12px; font-weight: bold; pointer-events: none; z-index: 9999; box-shadow: 0 2px 8px rgba(0,0,0,0.3);">
        YACV v6
      </div>
    </v-main>

    <!-- The left collapsible sidebar has the list of models -->
    <!-- Hidden for now as requested by user
    <sidebar :opened-init="openSidebarsByDefault" :width="300" side="left">
      <template #toolbar>
        <v-toolbar-title>Models</v-toolbar-title>
      </template>
      <template #toolbar-items>
        <v-btn icon="" @click="loadModelManual">
          <svg-icon :path="mdiPlus" type="mdi"/>
        </v-btn>
      </template>
      <models ref="models" :viewer="viewer" @remove-model="onModelRemoveRequest"/>
    </sidebar>
    -->

    <!-- Minimalist overlay controls - bottom left -->
    <div style="position: fixed; bottom: 20px; left: 20px; z-index: 1000; display: flex; flex-direction: column; gap: 12px;">
      <!-- Selection toggle button - elegant circular button -->
      <div style="display: flex; justify-content: center;">
        <v-btn 
          :color="selectionEnabled ? 'primary' : 'surface'" 
          fab 
          size="small"
          elevation="4"
          @click="toggleSelection"
          style="width: 56px; height: 56px; border-radius: 50%; box-shadow: 0 4px 12px rgba(0,0,0,0.15);">
          <v-tooltip activator="parent">{{ selectionEnabled ? 'Disable selection mode (S)' : 'Enable selection mode (S)' }}</v-tooltip>
          <svg-icon :path="mdiCursorDefaultClick" type="mdi" style="width: 24px; height: 24px;"/>
        </v-btn>
      </div>
      
      <!-- Orientation gizmo -->
      <div style="background: rgba(255,255,255,0.9); border-radius: 12px; padding: 16px; backdrop-filter: blur(10px); box-shadow: 0 2px 8px rgba(0,0,0,0.1); width: 120px; height: 120px;">
        <orientation-gizmo v-if="viewer?.scene" :viewer="viewer"/>
      </div>
    </div>

    <!-- Hidden selection component to maintain all functionality and defaults -->
    <div style="display: none;">
      <selection-component ref="selectionComp" v-model="selection" :viewer="viewer as any"/>
    </div>

  </v-layout>
</template>

<!--suppress CssUnusedSymbol -->
<style>
html, body {
  height: 100%;
  overflow: hidden !important;
}
</style>
