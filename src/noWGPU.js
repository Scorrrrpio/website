// NO GPU SUPPORT
export function noWGPU(hide) {
    const dialogue = document.querySelector(".no-webgpu");
    hide.style.display = "none";
    dialogue.style.display = "block";
}