import { fpv } from "./fpvRenderer";

console.log("WIP workspace");
fpv("wip-workspace", true).catch((error) => {
    if (error.name === "Error") {
        // unsupported WebGPU
        console.log(error.message);
    }
    else { throw error; }
});