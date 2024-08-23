import { fpv } from "./fpvRenderer";

console.log("WIP workspace");
fpv("wip-workspace", true, true).catch((error) => { console.log(error.message); });