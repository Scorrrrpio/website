import { mat4, vec3 } from "gl-matrix";
import { createBindGroup, createBindGroupLayout, createPipeline, createVBAttributes } from "./wgpuHelpers";
import { TextTexture } from "./renderText";

// TODO ideally eliminate these imports
import { textureTriangle } from "./textureTriangle";

export class TransformComponent {
    constructor(position=[0, 0, 0], rotation=[0, 0, 0], scale=[1, 1, 1], animation) {
        this.position = position;
        this.rotation = rotation;
        this.scale = scale;
        this.createModelMatrix();
        this.animation = animation;  // TODO bad solution
    }

    createModelMatrix() {
        const model = mat4.create();
        mat4.translate(model, model, this.position);
        mat4.rotateX(model, model, this.rotation[0]);
        mat4.rotateY(model, model, this.rotation[1]);
        mat4.rotateZ(model, model, this.rotation[2]);
        mat4.scale(model, model, this.scale);
        this.model = model;
    }
}

export class MeshComponent {
    constructor(vb, vertexCount, modelBuffer, bindGroup, pipeline, textTexture) {
        this.vertexBuffer = vb;
        this.vertexCount = vertexCount;
        this.modelBuffer = modelBuffer;
        this.bindGroup = bindGroup;
        this.pipeline = pipeline;
        this.textTexture = textTexture;
    }

    // TODO don't require assetManager
    static async assetToMesh(data, mesh, baseVert, baseFrag, assetManager, device, format, viewBuffer, projectionBuffer, topology, multisamples, debug=false) {
        // OVERRIDE SHADERS
        const [vertOverride, fragOverride] = await assetManager.get(data.vertexShader, data.fragmentShader);

        // VERTEX BUFFER
        // TODO change ply reader AGAIN
        const floats = mesh.vertex.values.float32;
        const vCount = floats.data.length / floats.properties.length;
        const vProps = floats.properties.length;

        // vertex buffer atrributes array
        const vbAttributes = createVBAttributes(floats.properties);
        //console.log("VB ATTRIBUTES\n", vbAttributes);  // TODO grouping

        const vb = device.createBuffer({
            label: data.file,
            size: floats.data.byteLength,
            usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
        });
        device.queue.writeBuffer(vb, 0, floats.data);


        // MODEL BUFFER
        const modelBuffer = device.createBuffer({
            label: "Model Uniform Buffer",
            size: 64,
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
        });

        // BIND GROUP and LAYOUT
        let bindGroupLayout = createBindGroupLayout(device, "Default Bind Group Layout", "MVP");
        let bindGroup = createBindGroup(
            device, "Base Bind Group", bindGroupLayout,
            {buffer: modelBuffer}, {buffer: viewBuffer}, {buffer: projectionBuffer}  // MVP
        );


        // using data
        // OVERRIDE CULL MODE
        const cullMode = data.cullMode ? data.cullMode : "back";

        // TEXTURE
        let textTexture;  // TODO awful
        if (data.texture) {
            let texture;
            if (data.texture.url) {
                // image texture
                const [imgPromise] = await assetManager.get(data.texture.url);
                const imgBmp = await imgPromise;
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
                    textureTriangle(assetManager, texture, device, format);
                }
                else if (data.texture.program === "text") {
                    if (data.texture.faces?.length > 1) throw new Error("Cannot render text on more than one face");

                    let aspect = [1, 1];
                    if (data.s) {
                        switch (data.texture.faces[0]) {
                            case "front": case "back": aspect = [data.s[0], data.s[1]]; break;  // x / y
                            case "left": case "right": aspect = [data.s[2], data.s[1]]; break;  // z / y
                            case "top": case "bottom": aspect = [data.s[0], data.s[2]]; break;  // x / z
                        }
                    }

                    textTexture = await TextTexture.fromUrls(texture, data.texture.content, null, null, data.texture.fontSize, data.texture.margin, aspect, assetManager, device, format);
                }
            }

            // create texture sampler
            const sampler = device.createSampler({
                magFilter: "linear",
                minFilter: "linear",
            });

            // create list of faces to texture
            const faceIDs = new Uint32Array([
                data.texture.faces?.includes("front") ? 1 : 0, 0, 0, 0,
                data.texture.faces?.includes("back") ? 1 : 0, 0, 0, 0,
                data.texture.faces?.includes("left") ? 1 : 0, 0, 0, 0,
                data.texture.faces?.includes("right") ? 1 : 0, 0, 0, 0,
                data.texture.faces?.includes("top") ? 1 : 0, 0, 0, 0,
                data.texture.faces?.includes("bottom") ? 1 : 0, 0, 0, 0,
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

        // await promises
        const vertexShaderModule = await vertOverride ? await vertOverride : baseVert;
        const fragmentShaderModule = await fragOverride ? await fragOverride : baseFrag;

        // Pipeline
        const pipeline = createPipeline(
            "FPV Render Pipeline",
            device,
            bindGroupLayout,
            vertexShaderModule,
            vProps,
            vbAttributes,
            fragmentShaderModule,
            format,
            topology,
            cullMode,
            true,
            multisamples
        );


        // TODO debug geometry
        return new MeshComponent(vb, vCount, modelBuffer, bindGroup, pipeline, textTexture);
    }
}


// COLLIDERS
// TODO why does this exist
class ColliderComponent {
    constructor(verts, href=null, ghost=false, velocity=[0, 0, 0]) {
        this.verts = verts;
        this.href = href;
        this.ghost = ghost;
        this.velocity = velocity;  // TODO why?
    }

    translate(vector) {
        for (const i in verts) {
            verts[i][0] += vector[0];
            verts[i][1] += vector[1];
            verts[i][2] += vector[2];
        }
    }

    copy() {
        throw new Error("Copy behaviour must be implemented by subclasses of ColliderComponent");
    }

    setProperties(href=null, ghost=false, velocity=[0, 0, 0]) {
        this.href = href;
        this.ghost = ghost;
        this.velocity = velocity;
    }

    static checkCollision(other) {
        throw new Error("checkCollision must be implemented by subclasses of ColliderComponent");
    }
}

export class AABBComponent extends ColliderComponent {
    constructor(min, max, href, ghost, velocity, debug=false) {
        super([min, max], href, ghost, velocity);
        this.min = min;
        this.max = max;
    }

    copy() {
        return new AABBComponent(this.min, this.max, this.hred, this.ghost, this.velocity, this.debug);
    }

    // TODO no rotation (use Transform but need collider debugging)
    modelTransform(model) {
        this.min = [0, 0, 0];
        this.max = [0, 0, 0];
        vec3.transformMat4(this.min, this.verts[0], model);
        vec3.transformMat4(this.max, this.verts[1], model);
    }

    translate(vector) {
        this.min[0] += vector[0];
        this.min[1] += vector[1];
        this.min[2] += vector[2];
        this.max[0] += vector[0];
        this.max[1] += vector[1];
        this.max[2] += vector[2];
    }
    
    toVertices() {
        const vertices = new Float32Array(72);
        let vIndex = 0;
        // face 1
        vertices[vIndex++] = this.min[0]; vertices[vIndex++] = this.min[1]; vertices[vIndex++] = this.min[2];
        vertices[vIndex++] = this.min[0]; vertices[vIndex++] = this.min[1]; vertices[vIndex++] = this.max[2];
        vertices[vIndex++] = this.min[0]; vertices[vIndex++] = this.min[1]; vertices[vIndex++] = this.max[2];
        vertices[vIndex++] = this.min[0]; vertices[vIndex++] = this.max[1]; vertices[vIndex++] = this.max[2];
        vertices[vIndex++] = this.min[0]; vertices[vIndex++] = this.max[1]; vertices[vIndex++] = this.max[2];
        vertices[vIndex++] = this.min[0]; vertices[vIndex++] = this.max[1]; vertices[vIndex++] = this.min[2];
        vertices[vIndex++] = this.min[0]; vertices[vIndex++] = this.max[1]; vertices[vIndex++] = this.min[2];
        vertices[vIndex++] = this.min[0]; vertices[vIndex++] = this.min[1]; vertices[vIndex++] = this.min[2];
        // face 2
        vertices[vIndex++] = this.max[0]; vertices[vIndex++] = this.min[1]; vertices[vIndex++] = this.min[2];
        vertices[vIndex++] = this.max[0]; vertices[vIndex++] = this.min[1]; vertices[vIndex++] = this.max[2];
        vertices[vIndex++] = this.max[0]; vertices[vIndex++] = this.min[1]; vertices[vIndex++] = this.max[2];
        vertices[vIndex++] = this.max[0]; vertices[vIndex++] = this.max[1]; vertices[vIndex++] = this.max[2];
        vertices[vIndex++] = this.max[0]; vertices[vIndex++] = this.max[1]; vertices[vIndex++] = this.max[2];
        vertices[vIndex++] = this.max[0]; vertices[vIndex++] = this.max[1]; vertices[vIndex++] = this.min[2];
        vertices[vIndex++] = this.max[0]; vertices[vIndex++] = this.max[1]; vertices[vIndex++] = this.min[2];
        vertices[vIndex++] = this.max[0]; vertices[vIndex++] = this.min[1]; vertices[vIndex++] = this.min[2];
        // connectors
        vertices[vIndex++] = this.min[0]; vertices[vIndex++] = this.min[1]; vertices[vIndex++] = this.min[2];
        vertices[vIndex++] = this.max[0]; vertices[vIndex++] = this.min[1]; vertices[vIndex++] = this.min[2];
        vertices[vIndex++] = this.min[0]; vertices[vIndex++] = this.min[1]; vertices[vIndex++] = this.max[2];
        vertices[vIndex++] = this.max[0]; vertices[vIndex++] = this.min[1]; vertices[vIndex++] = this.max[2];
        vertices[vIndex++] = this.min[0]; vertices[vIndex++] = this.max[1]; vertices[vIndex++] = this.min[2];
        vertices[vIndex++] = this.max[0]; vertices[vIndex++] = this.max[1]; vertices[vIndex++] = this.min[2];
        vertices[vIndex++] = this.min[0]; vertices[vIndex++] = this.max[1]; vertices[vIndex++] = this.max[2];
        vertices[vIndex++] = this.max[0]; vertices[vIndex++] = this.max[1]; vertices[vIndex++] = this.max[2];
        return vertices;
    }

    static createMesh(data, properties) {
        const xIndex = properties.indexOf("x");
        const yIndex = properties.indexOf("y");
        const zIndex = properties.indexOf("z");
    
        const aabb = {
            min: [Infinity, Infinity, Infinity],
            max: [-Infinity, -Infinity, -Infinity],
        };
        for (const i in data) {
            if (i % properties.length === xIndex) {
                if (data[i] < aabb.min[0]) { aabb.min[0] = data[i]; }
                if (data[i] > aabb.max[0]) { aabb.max[0] = data[i]; }
            }
            if (i % properties.length === yIndex) {
                if (data[i] < aabb.min[1]) { aabb.min[1] = data[i]; }
                if (data[i] > aabb.max[1]) { aabb.max[1] = data[i]; }
            }
            if (i % properties.length === zIndex) {
                if (data[i] < aabb.min[2]) { aabb.min[2] = data[i]; }
                if (data[i] > aabb.max[2]) { aabb.max[2] = data[i]; }
            }
        }
        return new AABBComponent(aabb.min, aabb.max);
    }

    static createPlayerAABB(position) {
        return new AABBComponent([
            position[0]-0.4,
            position[1],
            position[2]-0.4,
        ], [
            position[0]+0.4,
            position[1]+2,
            position[2]+0.4,
        ]);
    }

    checkCollision(other) {
        if (this.ghost || other.ghost) { return false; }
        if (other instanceof AABBComponent) {
            return (
                this.min[0] <= other.max[0] && this.max[0] >= other.min[0] &&
                this.min[1] <= other.max[1] && this.max[1] >= other.min[1] &&
                this.min[2] <= other.max[2] && this.max[2] >= other.min[2]
            );
        }
    }
}


export class CameraComponent {
    // view matrix
    view = mat4.create();

    // projection matrix
    fov = Math.PI / 6;
    aspect = 1;
    near = 0.01;
    far = 1000.0;
    projection = mat4.create();

    constructor(aspect, offset=[0, 0, 0], ortho=false) {
        this.offset = offset;
        // projection matrix setup
        this.aspect = aspect;
        this.orthographic = ortho;
        this.updateProjectionMatrix();
    }

    updateProjectionMatrix(aspect = this.aspect, fov = this.fov, near = this.near, far = this.far) {
        this.aspect = aspect;
        this.fov = fov;
        this.near = near;
        this.far = far;
        if (this.orthographic) {
            mat4.ortho(this.projection, -aspect, aspect, -1, 1, -1, 1);
        }
        else {
            mat4.perspective(this.projection, fov, aspect, near, far);
        }
    }

    updateViewMatrix(position, rotation) {
        mat4.rotateX(this.view, mat4.create(), rotation[0]);
        mat4.rotateY(this.view, this.view, rotation[1]);
        mat4.rotateZ(this.view, this.view, rotation[2]);
        mat4.translate(this.view, this.view, [-position[0]-this.offset[0], -position[1]-this.offset[1], -position[2]-this.offset[2]]);
    }
}


// TODO more versatile (bonus feature)
export class InputComponent {
    constructor() {
        this.inputs = {
            w: false,
            a: false,
            s: false,
            d: false,
            space: false,
            leftMouse: false,
            rightMouse: false,
        }

        // TODO allow changing
        this.xSense = 0.002;
        this.ySense = 0.002;
        this.maxLook = Math.PI / 2;
        this.minLook = -this.maxLook;
        this.scrollSense = 1;

        this.look = [0, 0, 0];
        this.scroll = 0;
    }

    enableControls(canvas) {
        const controlsText = document.getElementById("controls");
        // keyboard input
        document.addEventListener("keydown", (event) => {
            if (document.pointerLockElement === canvas) {
                switch(event.code) {
                    case "KeyW":
                        this.inputs.w = true;
                        break;
                    case "KeyA":
                        this.inputs.a = true;
                        break;
                    case "KeyS":
                        this.inputs.s = true;
                        break;
                    case "KeyD":
                        this.inputs.d = true;
                        break;
                    case "Space":
                        this.inputs.space = true;
                        break;
                }
            }
        });

        document.addEventListener("keyup", (event) => {
            if (document.pointerLockElement === canvas) {
                switch(event.code) {
                    case "KeyW":
                        this.inputs.w = false;
                        break;
                    case "KeyA":
                        this.inputs.a = false;
                        break;
                    case "KeyS":
                        this.inputs.s = false;
                        break;
                    case "KeyD":
                        this.inputs.d = false;
                        break;
                    case "Space":
                        this.inputs.space = false;
                        break;
                }
            }
        });

        // show controls
        document.addEventListener("pointerlockchange", () => {
            if (document.pointerLockElement === canvas) {
                // show controls text
                controlsText.style.display = "none";
            }
            else {
                // stop movement
                this.inputs.w = false;
                this.inputs.a = false;
                this.inputs.s = false;
                this.inputs.d = false;
                this.inputs.space = false;
                // show controls text
                controlsText.style.display = "block";
            }
        })

        // mouse movement
        document.addEventListener("mousemove", (event) => {
            if (document.pointerLockElement === canvas) {
                this.look[1] += event.movementX * this.xSense;
                this.look[0] += event.movementY * this.ySense;
                this.look[0] = Math.max(this.minLook, Math.min(this.maxLook, this.look[0]));

                // TODO browser issue
                // random spikes for movementX/movementY when usng mouse
                // see https://unadjusted-movement.glitch.me/ for visualization
                /*
                if (deltaX > 100 || deltaX < -100) {
                    console.log("DELTA X:", deltaX);
                    console.log("DELTA Y:", deltaY);
                    console.log("ROTATION:", this.rotation);
                    this.rotation[1] += this.xSense * deltaX;  // yaw
                    this.rotation[0] += this.ySense * deltaY;  // pitch
                    console.log("ROTATION AFTER:", this.rotation);
                    debugger;
                }
                */
            }
        });

        document.addEventListener("wheel", (event) => {
            if (document.pointerLockElement === canvas) {
                this.scroll += event.deltaY * this.scrollSense;
            }
        });

        // request pointer lock within canvas
        canvas.addEventListener("click", () => {
            if (document.pointerLockElement !== canvas) {
                // stop movement
                this.inputs.w = false;
                this.inputs.a = false;
                this.inputs.s = false;
                this.inputs.d = false;
                this.inputs.space = false;

                // request pointer lock (and handle browser differences)
                // chromium returns Promise, firefox returns undefined
                const lockPromise = canvas.requestPointerLock({ unadjustedMovement: true });
                if (lockPromise) {
                    lockPromise.catch((error) => {
                        if (error.name === "NotSupportedError") {
                            canvas.requestPointerLock();
                        }
                        else throw error;
                    })
                }

                if (document.pointerLockElement === canvas) {
                    controlsText.style.display = "none";
                }
            }
        });

        canvas.addEventListener("mousedown", (event) => {
            if (document.pointerLockElement === canvas) {
                // in game
                switch (event.button) {
                    case 0:
                        // left
                        this.inputs.leftMouse = true;
                        break;
                    case 2:
                        this.inputs.rightMouse = true;
                        // right
                        break;
                }
            }
        });

        canvas.addEventListener("mouseup", (event) => {
            if (document.pointerLockElement === canvas) {
                // in game
                switch (event.button) {
                    case 0:
                        // left
                        this.inputs.leftMouse = false;
                        break;
                    case 2:
                        this.inputs.rightMouse = false;
                        // right
                        break;
                }
            }
        });
    }
}


export class PhysicsComponent {
    constructor() {
        this.maxSpeed = 0.2;
        this.jumpImpulse = 0.25;
        this.gravity = 0.01;
        // variable
        this.jumpSpeed = 0;
        this.grounded = false;
    }
}