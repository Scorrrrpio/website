import { helloTriangle } from "./helloTriangle";
import { cube } from "./cube";

helloTriangle("hello-triangle").catch((error) => { console.log(error.message); });
cube("spinning-cube").catch((error) => { console.log(error.message); });