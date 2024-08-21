import { helloTriangle } from "./helloTriangle";

helloTriangle("hello-triangle", true).catch((error) => { console.log(error.message); });