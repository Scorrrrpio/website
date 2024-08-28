// NO GPU SUPPORT
export function noWGPU(hide) {
    hide.remove();
    const dialogues = document.getElementsByClassName("no-webgpu");
    for (const dialogue of dialogues) { dialogue.style.display = "block"; }

    const playButton = document.getElementById("play-svg");
    if (playButton) { playButton.remove(); }
    const loading = document.getElementById("loading");
    if (loading) { loading.remove(); }
}