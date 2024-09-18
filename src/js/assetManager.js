import { AssetLoadError } from "./errors";
import { plyToTriangleList } from "./plyReader";

import { textureTriangle } from "./textureTriangle";
import { textToTexture } from "./renderText";
import { createBindGroup, createBindGroupLayout, createPipeline, createVBAttributes } from "./wgpuHelpers";
import { AABB, SphereMesh } from "./collision";
import { MeshOld } from "./mesh";
import { mat4 } from "gl-matrix";

export class AssetManager {
    constructor(device) {
        this.device = device;  // TODO why
        this.cache = new Map();
    }

    async get(url, debug=false) {
        if (this.cache.has(url)) { return this.cache.get(url); }
        if (debug) console.log("FETCH: " + url);
        let data;
        const fileType = url.slice(url.lastIndexOf("."));
        switch (fileType) {
            case ".json":
                data = this.#loadJson(url);
                break;
            case ".wgsl":
                data = this.#loadShaderModule(url);
                break;
            case ".ply":
                data = plyToTriangleList(url);
                break;
            case ".png": case ".jpg":
                data = this.#loadImageToBmp(url);
                break;
            default:
                throw new AssetLoadError("Failed to load from ${url}. No loader method for file extension ${fileType}.");
        }
        this.cache.set(url, data);
        return await data;
    }

    async #loadJson(url) {
        const response = await fetch(url);
        if (!response.ok) { throw new AssetLoadError("Failed to load from ${url}."); }
        return response.json();
    }

    async #loadImageToBmp(url) {
        // read image from texture url
        const img = new Image();
        img.src = url;
        try {
            await img.decode();
        }
        catch (error) {
            if (error.name === "EncodingError") {
                throw new AssetLoadError("Failed to load image: " + url);
            }
            else { throw error; }
        };
        // convert to bmp
        return await createImageBitmap(img);
    }
    
    async #loadShaderModule(url) {
        const response = await fetch(url);
        if (!response.ok) { throw new AssetLoadError("Failed to load shader: " + url); }
        const shaderCode = await response.text();
        const shaderModule = this.device.createShaderModule({
            label: url.slice(url.lastIndexOf("/") + 1),
            code: shaderCode,
        });
        return shaderModule;
    }
}


// TODO move everything to SceneManager
export async function assetToMesh(asset, assetManager, device, debug=false) {
    // ASSET FAMILY DEFAULT VALUES
    const [data, vert, frag] = await Promise.all([
        assetManager.get(asset.file, debug),
        assetManager.get(asset.vertexShader, debug),
        assetManager.get(asset.fragmentShader, debug),
    ]);

    // TODO change ply reader AGAIN
    const floats = data.vertex.values.float32;
    const vCount = floats.data.length / floats.properties.length;
    const vProps = floats.properties.length;
    
    // collision mesh based on geometry
    const meshGenerators = {
        aabb: AABB.createMesh,
        sphere: SphereMesh.createMesh,  // TODO other types (sphere, mesh)
    }
    const baseMesh = meshGenerators[asset.collision]?.(floats.data, floats.properties);
    let collider;
    if (asset.collision === "aabb") {
        collider = new AABB(baseMesh.min, baseMesh.max);
    }

    return new MeshOld(null, null, null, null, collider, null, null);
}

export async function createInstance(data, base, assetManager, device, format, viewBuffer, projectionBuffer, topology, multisamples, debug=false) {
    // ID
    const id = "Mesh";  // TODO

    // OVERRIDE COLLIDER
    let collider = base.collider ? base.collider.copy() : null;
    if (collider) {
        collider.setProperties(data.href, data.ghost, data.v);
    }

    const animation = data.animation;

    const instance = base.createInstance(id, null, null, null,
        collider,
        animation,
        {  // transforms
            position: data.p || [0, 0, 0],
            rotation: data.r || [0, 0, 0],
            scale: data.s || [1, 1, 1],
        }
    );

    return instance;
}


/*
// DEBUG
// create debug geometry
if (debug && instance.collider && !instance.collider.ghost) {
    // SHADERS
    const [debugVShader, debugFShader] = await Promise.all([
        assetManager.get("shaders/basic.vert.wgsl", debug),
        assetManager.get("shaders/debug.frag.wgsl", debug),
    ]);

    // BGL
    const debugBGL = createBindGroupLayout(device, "DEBUG BGL", "MVP");

    // MODEL BUFFER (identity)
    const modelBuffer = device.createBuffer({
        label: "DEBUG Model Uniform",
        size: 64,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
    });
    const model = mat4.create();
    device.queue.writeBuffer(modelBuffer, 0, model);

    // BIND GROUP
    const bg = createBindGroup(device, "DEBUG Bind Group", debugBGL, {buffer: modelBuffer}, {buffer: viewBuffer}, {buffer: projectionBuffer});

    // VERTEX BUFFER ATTRIBUTES
    const vbAttributes = createVBAttributes(["x", "y", "z"]);

    // PIPELINE
    const pipeline = createPipeline(
        "DEBUG Pipeline",
        device,
        debugBGL,
        debugVShader,
        3,  // vertex properties
        vbAttributes,
        debugFShader,
        format,
        "line-list",
        "none",
        true,
        multisamples
    );

    // TODO everything before this is constant across all debug geometry
    const [debugVB, debugVCount] = createDebugGeometry(instance, device);

    instance.debug(debugVB, debugVCount, bg, pipeline);
}
*/

// TODO move into Mesh/Collider? class
// TODO hardcoded for AABB
export function createDebugGeometry(instance, device) {
    // generate geometry (line-list)
    const vertices = instance.collider.toVertices();
    const vCount = 24;  // for cube
    
    let vb;
    if (instance.debugVertexBuffer) { vb = instance.debugVertexBuffer; }
    else {
        vb = device.createBuffer({
            label: "DEBUG VB",
            size: vertices.byteLength,
            usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
        });
    }
    
    device.queue.writeBuffer(vb, 0, vertices);

    return [vb, vCount];
}