import { helloTriangle } from "./helloTriangle";
import { cube } from "./cube";
import { lokiSphere } from "./lokiSphere";
import { cameraPlayground } from "./cameraPlayground";

helloTriangle("hello-triangle", false).catch((error) => {
    if (error.name === "Error") { console.log(error.message); }
    else { throw Error };
});
cube("spinning-cube", false).catch((error) => {
    if (error.name === "Error") { console.log(error.message); }
    else { throw Error };
});
lokiSphere("loki-sphere", false).catch((error) => {
    if (error.name === "Error") { console.log(error.message); }
    else { throw Error };
});
cameraPlayground("camera-playground", false, false).catch((error) => {
    if (error.name === "Error") { console.log(error.message); }
    else { throw Error };
});