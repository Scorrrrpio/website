import { vec3 } from "gl-matrix";
import { createBindGroup, createBindGroupLayout, createPipeline, createShaderModule, createVBAttributes } from "./wgpuHelpers";

class Collider {
    constructor(type, verts, href = null, ghost = false, velocity = [0, 0, 0]) {
        this.type = type;  // AABB, OBB, Sphere
        this.verts = verts;
        this.href = href;
        this.ghost = ghost;
        this.velocity = velocity;
    }

    translate(pos) {
        for (const i in verts) {
            verts[i][0] += pos[0];
            verts[i][1] += pos[1];
            verts[i][2] += pos[2];
        }
    }

    static checkCollision(mesh1, mesh2) {
        if (!mesh1 || !mesh2) { return false; }
        if (mesh1.ghost || mesh2.ghost) { return false; }
        if (mesh1.type === "AABB" && mesh2.type === "AABB") {
            // AABB and AABB
            return (
                mesh1.min[0] <= mesh2.max[0] && mesh1.max[0] >= mesh2.min[0] &&
                mesh1.min[1] <= mesh2.max[1] && mesh1.max[1] >= mesh2.min[1] &&
                mesh1.min[2] <= mesh2.max[2] && mesh1.max[2] >= mesh2.min[2]
            );
        }
    }
}

export class AABB extends Collider {
    constructor(min, max, href, ghost, velocity) {
        super("AABB", [min, max], href, ghost, velocity);
        this.min = min;
        this.max = max;
    }

    modelTransform(model) {
        this.min = [0, 0, 0];
        this.max = [0, 0, 0];
        vec3.transformMat4(this.min, this.verts[0], model);
        vec3.transformMat4(this.max, this.verts[1], model);
    }

    translate(pos) {
        this.min[0] += pos[0];
        this.min[1] += pos[1];
        this.min[2] += pos[2];
        this.max[0] += pos[0];
        this.max[1] += pos[1];
        this.max[2] += pos[2];
    }
    
}

export class SphereMesh extends Collider {
    constructor(origin, radius, href, ghost, velocity) {
        super("SphereMesh", [origin], href, ghost, velocity);
        this.origin = origin;
        this.radius = radius;
    }

    modelTransform(model) {
        this.origin = [0, 0, 0];
        vec3.transformMat4(this.origin, this.verts[0], model);
    }
}

export function vertsToAABB(data) {
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
    // SHADERS
    const debugVShader = await createShaderModule(device, "shaders/basicVertex.wgsl", "DEBUG Vertex Module");
    const debugFShader = await createShaderModule(device, "shaders/debugF.wgsl", "DEBUG Fragment Module");

    // BGL
    const debugBGL = createBindGroupLayout(device, "DEBUG BGL", "MVP");

    for (const renderable of renderables) {
        if (renderable.collisionMesh && !renderable.collisionMesh.ghost) {
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
            const vbAttributes = createVBAttributes(["x", "y", "z"]);

            // BIND GROUP
            const bg = createBindGroup(device, "DEBUG Bind Group", debugBGL, {buffer: renderable.modelBuffer}, {buffer: viewBuffer}, {buffer: projectionBuffer});

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