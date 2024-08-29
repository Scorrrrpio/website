import { fpv } from "./fpvRenderer";

const canvas = document.querySelector("canvas");
const controls = document.getElementById("controls");
const noWebGPUDialogue = document.querySelector(".no-webgpu");
const loadFailedDialogue = document.querySelector(".loading-failed");
const errorDialogue = document.querySelector(".error-message");
const playButton = document.getElementById("play-svg");
const loading = document.getElementById("loading");

function removeElements(...elements) {
    for (const element of elements) {
        element.remove();
    }
}

fpv().catch((error) => {
    removeElements(playButton, loading, canvas, controls);
    if (error.name === "UnsupportedWebGPUError") {
        removeElements(loadFailedDialogue, errorDialogue);
        noWebGPUDialogue.style.display = "block";
        console.log(error.message);
    }
    else if (error.name === "AssetLoadError") {
        removeElements(noWebGPUDialogue, errorDialogue);
        loadFailedDialogue.style.display = "block";
        console.log(error.message);
    }
    else {
        removeElements(noWebGPUDialogue, loadFailedDialogue);
        errorDialogue.style.display = "block";
        throw error;
    }
});