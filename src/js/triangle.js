import { helloTriangle } from "./helloTriangle";

helloTriangle("hello-triangle", true).catch((error) => {
    if (error.name === "Error") { console.log(error.message); }
    else { throw error; }
});