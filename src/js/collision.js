import { vec3 } from "gl-matrix";
import { createBindGroup, createBindGroupLayout, createPipeline, createShaderModule, createVBAttributes } from "./wgpuHelpers";

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

function aabbToVertices(aabb) {
    const vertices = new Float32Array(72);
    let vIndex = 0;
    // face 1
    vertices[vIndex++] = aabb.min[0]; vertices[vIndex++] = aabb.min[1]; vertices[vIndex++] = aabb.min[2];
    vertices[vIndex++] = aabb.min[0]; vertices[vIndex++] = aabb.min[1]; vertices[vIndex++] = aabb.max[2];
    vertices[vIndex++] = aabb.min[0]; vertices[vIndex++] = aabb.min[1]; vertices[vIndex++] = aabb.max[2];
    vertices[vIndex++] = aabb.min[0]; vertices[vIndex++] = aabb.max[1]; vertices[vIndex++] = aabb.max[2];
    vertices[vIndex++] = aabb.min[0]; vertices[vIndex++] = aabb.max[1]; vertices[vIndex++] = aabb.max[2];
    vertices[vIndex++] = aabb.min[0]; vertices[vIndex++] = aabb.max[1]; vertices[vIndex++] = aabb.min[2];
    vertices[vIndex++] = aabb.min[0]; vertices[vIndex++] = aabb.max[1]; vertices[vIndex++] = aabb.min[2];
    vertices[vIndex++] = aabb.min[0]; vertices[vIndex++] = aabb.min[1]; vertices[vIndex++] = aabb.min[2];
    // face 2
    vertices[vIndex++] = aabb.max[0]; vertices[vIndex++] = aabb.min[1]; vertices[vIndex++] = aabb.min[2];
    vertices[vIndex++] = aabb.max[0]; vertices[vIndex++] = aabb.min[1]; vertices[vIndex++] = aabb.max[2];
    vertices[vIndex++] = aabb.max[0]; vertices[vIndex++] = aabb.min[1]; vertices[vIndex++] = aabb.max[2];
    vertices[vIndex++] = aabb.max[0]; vertices[vIndex++] = aabb.max[1]; vertices[vIndex++] = aabb.max[2];
    vertices[vIndex++] = aabb.max[0]; vertices[vIndex++] = aabb.max[1]; vertices[vIndex++] = aabb.max[2];
    vertices[vIndex++] = aabb.max[0]; vertices[vIndex++] = aabb.max[1]; vertices[vIndex++] = aabb.min[2];
    vertices[vIndex++] = aabb.max[0]; vertices[vIndex++] = aabb.max[1]; vertices[vIndex++] = aabb.min[2];
    vertices[vIndex++] = aabb.max[0]; vertices[vIndex++] = aabb.min[1]; vertices[vIndex++] = aabb.min[2];
    // connectors
    vertices[vIndex++] = aabb.min[0]; vertices[vIndex++] = aabb.min[1]; vertices[vIndex++] = aabb.min[2];
    vertices[vIndex++] = aabb.max[0]; vertices[vIndex++] = aabb.min[1]; vertices[vIndex++] = aabb.min[2];
    vertices[vIndex++] = aabb.min[0]; vertices[vIndex++] = aabb.min[1]; vertices[vIndex++] = aabb.max[2];
    vertices[vIndex++] = aabb.max[0]; vertices[vIndex++] = aabb.min[1]; vertices[vIndex++] = aabb.max[2];
    vertices[vIndex++] = aabb.min[0]; vertices[vIndex++] = aabb.max[1]; vertices[vIndex++] = aabb.min[2];
    vertices[vIndex++] = aabb.max[0]; vertices[vIndex++] = aabb.max[1]; vertices[vIndex++] = aabb.min[2];
    vertices[vIndex++] = aabb.min[0]; vertices[vIndex++] = aabb.max[1]; vertices[vIndex++] = aabb.max[2];
    vertices[vIndex++] = aabb.max[0]; vertices[vIndex++] = aabb.max[1]; vertices[vIndex++] = aabb.max[2];
    return vertices;
}

export async function createDebugGeometry(renderables, device, format, viewBuffer, projectionBuffer, multisamples) {
    // debugBG
    // debugPipeline
    // debugVB
    // debugVertexCount

    // SHADERS
    const debugVShader = await createShaderModule(device, "shaders/basicVertex.wgsl", "DEBUG Vertex Module");
    const debugFShader = await createShaderModule(device, "shaders/debugF.wgsl", "DEBUG Fragment Module");

    // BGL
    const debugBGL = createBindGroupLayout(device, "DEBUG BGL", "MVP");

    for (const renderable of renderables) {
        if (renderable.collisionMesh) {
            // generate geometry (line-list)
            const vertexCount = 24;  // 12 edges, 2 vertices each
            const vertices = aabbToVertices(renderable.baseMesh);
            
            // VERTEX BUFFER
            const vb = device.createBuffer({
                label: "DEBUG VB",
                size: vertices.byteLength,
                usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
            });
            device.queue.writeBuffer(vb, 0, vertices);
            // create vertex buffer atrributes array
            const vbAttributes = createVBAttributes(["x", "y", "z"]);

            // BIND GROUP
            const bg = createBindGroup(device, "DEBUG Bind Group", debugBGL, {buffer: renderable.modelBuffer}, {buffer: viewBuffer}, {buffer: projectionBuffer});

            console
            // PIPELINE
            const pipeline = createPipeline(
                "DEBUG Pipeline",
                device,
                debugBGL,
                debugVShader,
                3,
                vbAttributes,
                debugFShader,
                format,
                "line-list",
                "none",
                true,
                multisamples
            );

            // add debug utilities to renderable object
            renderable.debugVertexCount = vertexCount;
            renderable.debugVB = vb;
            renderable.debugBG = bg;
            renderable.debugPipeline = pipeline;
        }
    }
}