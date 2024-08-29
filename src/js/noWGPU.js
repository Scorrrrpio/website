// NO GPU SUPPORT
// TODO DELETE
export function noWGPU(hide) {
    hide.remove();
    const dialogues = document.getElementsByClassName("no-webgpu");
    for (const dialogue of dialogues) { dialogue.style.display = "block"; }
}