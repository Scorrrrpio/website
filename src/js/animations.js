import { createModelMatrix } from "./loadAssets";
import { transformCollisionMesh } from "./collision";
import { mat4 } from "gl-matrix";

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

export function move(renderable) {
    const translationMatrix = mat4.create();
    mat4.translate(translationMatrix, translationMatrix, [-0.01, 0, 0]);
    mat4.multiply(renderable.model, renderable.model, translationMatrix);
    renderable.collisionMesh = transformCollisionMesh(renderable.baseMesh, renderable.model, renderable.collisionMesh.href, renderable.collisionMesh.ghost);
}