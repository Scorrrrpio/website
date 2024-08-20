// NO GPU SUPPORT
export function noWGPU(hide) {
    hide.style.display = "none";
    const dialogues = document.getElementsByClassName("no-webgpu");
    for (const dialogue of dialogues) { dialogue.style.display = "block"; }
}