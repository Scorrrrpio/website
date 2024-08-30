import { createModelMatrix } from "./loadAssets";

export function spinY(renderable) {
    renderable.transforms.rotation[1] += 0.02;
    renderable.model = createModelMatrix(
        renderable.transforms.position,
        renderable.transforms.rotation,
        renderable.transforms.scale,
    )
}

export function lokiSpin(renderable) {
    renderable.transforms.rotation[0] -= 0.001;
    renderable.transforms.rotation[1] += 0.005;
    renderable.transforms.rotation[2] -= 0.0005;
    renderable.model = createModelMatrix(
        renderable.transforms.position,
        renderable.transforms.rotation,
        renderable.transforms.scale,
    )
}