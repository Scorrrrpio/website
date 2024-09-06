import { createModelMatrix } from "./loadAssets";
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
    //console.log(renderable.collisionMesh);
    renderable.transforms.position[0] += renderable.collisionMesh.velocity[0];
    renderable.transforms.position[1] += renderable.collisionMesh.velocity[1];
    renderable.transforms.position[2] += renderable.collisionMesh.velocity[2];
    renderable.model = createModelMatrix(renderable.transforms.position, renderable.transforms.rotation, renderable.transforms.scale);
    //renderable.collisionMesh = transformCollisionMesh(renderable.baseMesh, renderable.model, renderable.collisionMesh.velocity, renderable.collisionMesh.href, renderable.collisionMesh.ghost);
    renderable.collisionMesh.modelTransform(renderable.model)
}