import { textToTexture } from "./renderText";

console.log("WIP workspace");
textToTexture().catch((error) => {
    if (error.name === "Error") {
        // unsupported WebGPU
        console.log(error.message);
    }
    else { throw error; }
});