import { helloTriangle } from "./helloTriangle";
import { cube } from "./cube";
import { lokiSphere } from "./lokiSphere";

helloTriangle("hello-triangle").catch((error) => { console.log(error.message); });
cube("spinning-cube").catch((error) => { console.log(error.message); });
lokiSphere("loki-sphere").catch((error) => { console.log(error.message); })