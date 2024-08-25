import { helloTriangle } from "./helloTriangle";
import { cube } from "./cube";
import { lokiSphere } from "./lokiSphere";
import { cameraPlayground } from "./cameraPlayground";

const params = new URLSearchParams(window.location.search);
const project = params.get("project");

if (project === "helloTriangle") {
    helloTriangle("playground", true).catch((error) => {
        if (error.name === "Error") { console.log(error.message); }
        else { throw Error };
    });
}
else if (project === "cube") {
    cube("playground", true).catch((error) => {
        if (error.name === "Error") { console.log(error.message); }
        else { throw Error };
    });
}
else if (project === "lokiSphere") {
    lokiSphere("playground", true).catch((error) => {
        if (error.name === "Error") { console.log(error.message); }
        else { throw Error };
    });
}
else if (project === "cameraPlayground") {
    cameraPlayground("playground", true, true).catch((error) => {
        if (error.name === "Error") { console.log(error.message); }
        else { throw Error };
    });
}