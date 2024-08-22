import { helloTriangle } from "./helloTriangle";
import { cube } from "./cube";
import { lokiSphere } from "./lokiSphere";
import { cameraPlayground } from "./cameraPlayground";

helloTriangle("hello-triangle", false).catch((error) => { console.log(error.message); });
cube("spinning-cube", false).catch((error) => { console.log(error.message); });
lokiSphere("loki-sphere", false).catch((error) => { console.log(error.message); });
cameraPlayground("camera-playground", false, false).catch((error) => { console.log(error.message); });