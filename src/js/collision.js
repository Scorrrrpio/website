import { vec3 } from "gl-matrix";

export function createAABBMesh(data) {
    const xIndex = data.properties.indexOf("x");
    const yIndex = data.properties.indexOf("y");
    const zIndex = data.properties.indexOf("z");

    const aabb = {
        min: [Infinity, Infinity, Infinity],
        max: [-Infinity, -Infinity, -Infinity],
    };
    for (const i in data.floats) {
        if (i % data.properties.length === xIndex) {
            if (data.floats[i] < aabb.min[0]) { aabb.min[0] = data.floats[i]; }
            if (data.floats[i] > aabb.max[0]) { aabb.max[0] = data.floats[i]; }
        }
        if (i % data.properties.length === yIndex) {
            if (data.floats[i] < aabb.min[1]) { aabb.min[1] = data.floats[i]; }
            if (data.floats[i] > aabb.max[1]) { aabb.max[1] = data.floats[i]; }
        }
        if (i % data.properties.length === zIndex) {
            if (data.floats[i] < aabb.min[2]) { aabb.min[2] = data.floats[i]; }
            if (data.floats[i] > aabb.max[2]) { aabb.max[2] = data.floats[i]; }
        }
    }
    return aabb;
}

export function transformCollisionMesh(mesh, model, href, ghost) {
    if (!mesh) return null;
    const newMesh = {
        min: [0, 0, 0],
        max: [0, 0, 0],
    };
    vec3.transformMat4(newMesh.min, mesh.min, model);
    vec3.transformMat4(newMesh.max, mesh.max, model);
    newMesh.href = href;
    newMesh.ghost = ghost;
    return newMesh;
}