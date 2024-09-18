import { AssetLoadError } from "./errors";
import { textureTriangle } from "./textureTriangle";
import { plyToTriangleList } from "./plyReader";
import { textToTexture } from "./renderText";
import { createBindGroup, createBindGroupLayout, createPipeline, createShaderModule, createVBAttributes } from "./wgpuHelpers";
import { AABB, SphereMesh } from "./collision";
import { Entity, Mesh, MeshInstance } from "./entity";
import { mat4 } from "gl-matrix";

// TODO AssetManager class

async function loadImageToBMP(url) {
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

async function fetchSceneFile(url) {
    // Scene assets as JSON
    const assetsResponse = await fetch(url);
    if (!assetsResponse.ok) { throw new AssetLoadError("Failed to fetch scene from " + url); }
    return assetsResponse.json();
}

// TODO proof of concept implementation
async function fetchOnce(cache, url, fetcher, debug=false) {
    if (cache.has(url)) {
        return cache.get(url);
    }
    if (debug) console.log("FETCH: " + url);
    const data = await fetcher;
    cache.set(url, data);
    return data;
}

async function assetToMesh(asset, cache, device, debug=false) {
    // ASSET FAMILY DEFAULT VALUES
    const [data, vert, frag] = await Promise.all([
        fetchOnce(cache, asset.file, plyToTriangleList(asset.file), debug),
        fetchOnce(cache, asset.vertexShader, createShaderModule(device, asset.vertexShader, "Base Vertex Shader"), debug),  // shaders from wgsl files
        fetchOnce(cache, asset.fragmentShader, createShaderModule(device, asset.fragmentShader, "Base Fragment Shader"), debug)
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

export async function createInstance(data, base, cache, device, format, viewBuffer, projectionBuffer, topology, multisamples, debug=false) {
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
            fetchOnce(cache, data.vertexShader, createShaderModule(device, data.vertexShader, "Vertex Shader Override"), debug),
            fetchOnce(cache, data.fragmentShader, createShaderModule(device, data.fragmentShader, "Fragment Shader Override"), debug)
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
            const imgBmp = await fetchOnce(cache, data.texture.url, loadImageToBMP(data.texture.url), debug);
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
            fetchOnce(cache, "shaders/basic.vert.wgsl", createShaderModule(device, "shaders/basic.vert.wgsl", "DEBUG vertex module"), true),
            fetchOnce(cache, "shaders/debug.frag.wgsl", createShaderModule(device, "shaders/debug.frag.wgsl", "DEBUG fragment module"), true),
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
export async function loadScene(sceneURL, cache, device, viewBuffer, projectionBuffer, format, topology, multisamples, debug=false) {
    const assets = await fetchSceneFile(sceneURL);  // TODO too much in one function

    // RENDERABLES
    const renderables = [];
    for (const asset of assets.objects) {  // each object in scene
        // ASSET FAMILY DEFAULT VALUES
        const mesh = await assetToMesh(asset, cache, device, debug);

        const renderable = { asset: mesh, instances: [] };
        // INSTANCE-SPECIFIC VALUES
        for (const instance of asset.instances) {
            const meshInstance = await createInstance(instance, mesh, cache, device, format, viewBuffer, projectionBuffer, topology, multisamples, debug);
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