import { AssetLoadError } from "./errors";
import { textureTriangle } from "./textureTriangle";
import { plyToTriangleList } from "./plyReader";
import { textToTexture } from "./renderText";
import { createBindGroup, createBindGroupLayout, createPipeline, createVBAttributes } from "./wgpuHelpers";
import { AABB, SphereMesh } from "./collision";
import { Entity, Mesh } from "./entity";
import { mat4 } from "gl-matrix";

// TODO AssetManager class
export class AssetManager {
    constructor(device) {
        this.device = device;  // TODO why
        this.cache = new Map();
    }

    async get(url, debug=false) {
        if (this.cache.has(url)) { return this.cache.get(url); }
        if (debug) console.log("FETCH: ${url}");
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

// TODO way too much going on in here

async function assetToMesh(asset, assetManager, device, debug=false) {
    // ASSET FAMILY DEFAULT VALUES
    const [data, vert, frag] = await Promise.all([
        assetManager.get(asset.file, debug),
        assetManager.get(asset.vertexShader),
        assetManager.get(asset.fragmentShader),
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

    // vertex buffer atrributes array
    const vbAttributes = createVBAttributes(floats.properties);
    //console.log("VB ATTRIBUTES\n", vbAttributes);  // TODO grouping

    // VERTEX BUFFER
    const vb = device.createBuffer({
        label: asset.file,
        size: floats.data.byteLength,
        usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
    });
    device.queue.writeBuffer(vb, 0, floats.data);

    return new Mesh(vb, vbAttributes, vProps, vCount, collider, vert, frag);
}

export async function createInstance(data, base, assetManager, device, format, viewBuffer, projectionBuffer, topology, multisamples, debug=false) {
    if (!(base instanceof Entity)) {
        throw new Error("Cannot create Instance of non-Entity");
    }

    // ID
    const id = "Mesh";  // TODO

    // MODEL BUFFER
    const modelBuffer = device.createBuffer({
        label: id + "Model Uniform",
        size: 64,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
    });

    // BIND GROUP and LAYOUT
    let bindGroupLayout = createBindGroupLayout(device, "Default Bind Group Layout", "MVP");
    let bindGroup = createBindGroup(
        device, id + " Base Bind Group", bindGroupLayout,
        {buffer: modelBuffer}, {buffer: viewBuffer}, {buffer: projectionBuffer}  // MVP
    );

    // using data
    // OVERRIDE SHADERS
    let vertexShaderModule = base.vertexShader;
    let fragmentShaderModule = base.fragmentShader;
    if (data.vertexShader && data.fragmentShader) {
        [vertexShaderModule, fragmentShaderModule] = await Promise.all([
            assetManager.get(data.vertexShader, debug),
            assetManager.get(data.fragmentShader, debug),
        ]);
    }

    // OVERRIDE COLLIDER
    let collider = base.collider ? base.collider.copy() : null;
    if (collider) {
        collider.setProperties(data.href, data.ghost, data.v);
    }

    // OVERRIDE CULL MODE
    const cullMode = data.cullMode ? data.cullMode : "back";

    // TEXTURE
    if (data.texture) {
        let texture;
        if (data.texture.url) {
            // image texture
            const imgBmp = await assetManager.get(data.texture.url, debug);
            // create texture on device
            texture = device.createTexture({
                label: "Image Texture",
                size: [imgBmp.width, imgBmp.height, 1],
                format: format,
                usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST | GPUTextureUsage.RENDER_ATTACHMENT,
            });
            device.queue.copyExternalImageToTexture(
                { source: imgBmp },
                { texture: texture },
                [imgBmp.width, imgBmp.height, 1],
            );
        }
        else if (data.texture.program) {
            // program texture
            const textureSize = [512, 512];
            texture = device.createTexture({
                label: "Program Texture",
                size: textureSize,
                format: format,
                usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING,
            });
            if (data.texture.program === "helloTriangle") {
                textureTriangle(texture, device, format);
            }
            else if (data.texture.program === "text") {
                textToTexture(texture, device, format, data.texture.content);
            }
        }

        // create texture sampler
        const sampler = device.createSampler({
            magFilter: "linear",
            minFilter: "linear",
        });

        // create list of faces to texture
        const faceIDs = new Uint32Array([
            data.texture.faces.includes("front") ? 1 : 0, 0, 0, 0,
            data.texture.faces.includes("back") ? 1 : 0, 0, 0, 0,
            data.texture.faces.includes("left") ? 1 : 0, 0, 0, 0,
            data.texture.faces.includes("right") ? 1 : 0, 0, 0, 0,
            data.texture.faces.includes("top") ? 1 : 0, 0, 0, 0,
            data.texture.faces.includes("bottom") ? 1 : 0, 0, 0, 0,
        ]);
        // store in uniform buffer
        const faceIDsBuffer = device.createBuffer({
            label: "Texture Faces Buffer",
            size: faceIDs.byteLength,
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
        });
        device.queue.writeBuffer(faceIDsBuffer, 0, faceIDs);

        // OVERRIDE BIND GROUP
        bindGroupLayout = createBindGroupLayout(
            device, "Texture Bind Group Layout",
            "MVP", "texture", "sampler", {visibility: GPUShaderStage.FRAGMENT, buffer: { type: "uniform"}}
        );
        bindGroup = createBindGroup(
            device, "OVERRIDE Bind Group", bindGroupLayout,
            {buffer: modelBuffer}, {buffer: viewBuffer}, {buffer: projectionBuffer},  // MVP
            texture.createView(), sampler, {buffer: faceIDsBuffer}  // texture
        );
    }

    // ANIMATION
    const animation = data.animation;

    // Pipeline
    const pipeline = createPipeline(
        "FPV Render Pipeline",
        device,
        bindGroupLayout,
        vertexShaderModule,
        base.propertyCount,
        base.vbAttributes,
        fragmentShaderModule,
        format,
        topology,
        cullMode,
        true,
        multisamples
    );

    const instance = base.createInstance(
        id,
        modelBuffer,
        bindGroup,
        pipeline,
        collider,
        animation,
        {  // transforms
            position: data.p || [0, 0, 0],
            rotation: data.r || [0, 0, 0],
            scale: data.s || [1, 1, 1],
        }
    );

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

    return instance;
}

// TODO logic belongs in Scene class
export async function loadScene(sceneURL, assetManager, device, viewBuffer, projectionBuffer, format, topology, multisamples, debug=false) {
    const assets = await assetManager.get(sceneURL, debug);  // TODO too much in one function

    // RENDERABLES
    const renderables = [];
    for (const asset of assets.objects) {  // each object in scene
        // ASSET FAMILY DEFAULT VALUES
        const mesh = await assetToMesh(asset, assetManager, device, debug);

        const renderable = { asset: mesh, instances: [] };
        // INSTANCE-SPECIFIC VALUES
        for (const instance of asset.instances) {
            const meshInstance = await createInstance(instance, mesh, assetManager, device, format, viewBuffer, projectionBuffer, topology, multisamples, debug);
            // add to renderables list
            renderable.instances.push(meshInstance);
        }
        renderables.push(renderable);
    }

    return renderables;
}


// TODO move into Mesh class
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