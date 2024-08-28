import { fpv } from "./fpvRenderer";

fpv().catch((error) => {
    if (error.name === "Error") {
        // unsupported WebGPU
        console.log(error.message);
    }
    else {
        // TODO error notification
        throw error;
    }
});