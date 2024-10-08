import { ECS } from "./ecs";
import { createBindGroupLayout } from "./wgpuHelpers";

import { AABBComponent } from "./components/collider";
import { AnimationComponent } from "./components/animation";
import { CameraComponent } from "./components/camera";
import { HUDComponent } from "./components/hud";
import { InputComponent } from "./components/input";
import { MeshComponent } from "./components/mesh";
import { PhysicsComponent } from "./components/physics";
import { TextComponent } from "./components/text";
import { TextureProgramComponent } from "./engine";
import { TransformComponent } from "./components/transform";

// TODO dynamic component imports?
// like in animationComponent
/*async function loadComponent {}
 *const {ComponentName} = await import("./path/to/componentFile");
 *return ComponentName;
*/

export class SceneManager {
    // SETUP
    static async fromURL(url, assetManager, device, format, canvas, viewBuffer, projectionBuffer, topology, multisamples, debug=false) {
        const scene = new SceneManager(url, assetManager);
        await scene.loadScene(device, format, canvas, viewBuffer, projectionBuffer, topology, multisamples, debug);
        return scene;
    }

    constructor(url, assetManager) {
        this.url = url;
        this.assetManager = assetManager;
        this.ecs = new ECS();
    }

    async loadScene(device, format, canvas, viewBuffer, projectionBuffer, topology, multisamples, debug=false) {
        const [assetPromise] = this.assetManager.get(this.url);
        const assets = await assetPromise;
        for (const instance of assets.entities) {
            const entity = this.ecs.createEntity();

            // TRANSFORM
            const transform = new TransformComponent(instance.p, instance.r, instance.s);
            this.ecs.addComponent(entity, transform);

            // CAMERA
            if (instance.camera) {
                const camera = new CameraComponent(canvas.width / canvas.height, instance.camera.offset, instance.camera.ortho, Math.PI / 2);
                camera.updateViewMatrix(transform);
                this.ecs.addComponent(entity, camera);
                if (!this.activeCamera) this.activeCamera = entity;
            }

            // HUD
            if (instance.hud) {
                // TODO from scene json
                const hud = await HUDComponent.generate(this.assetManager, device, format, projectionBuffer, 1);
                const hudCam = new CameraComponent(canvas.width / canvas.height, [0, 0, 0], true);
                this.ecs.addComponent(entity, hudCam);
                this.ecs.addComponent(entity, hud);
            }

            // INPUT
            if (instance.input) {
                const inputs = new InputComponent();
                this.ecs.addComponent(entity, inputs);
                this.player = entity;
            }

            // PHYSICS
            if (instance.physics) {
                const physics = new PhysicsComponent();
                this.ecs.addComponent(entity, physics);
            }

            // PHYSICS
            if (instance.v) {
                const physics = new PhysicsComponent(instance.v);
                this.ecs.addComponent(entity, physics);
            }

            // MESH
            if (instance.mesh) {
                // fetch mesh components
                const [meshPromise, vertPromise, fragPromise] = this.assetManager.get(
                    assets.geometry[instance.mesh], assets.shaders[instance.shader].vert, assets.shaders[instance.shader].frag
                );

                // BIND GROUP LAYOUT
                let bindGroupLayout = createBindGroupLayout(device, "Default Bind Group Layout", "MVP");
                // TEXTURE
                let texturePromise;
                if (instance.texture) {
                    // Override bind group layout
                    bindGroupLayout = createBindGroupLayout(
                        device, "Texture Bind Group Layout",
                        "MVP", "texture", "sampler", {visibility: GPUShaderStage.FRAGMENT, buffer: { type: "uniform"}}
                    );

                    if (instance.texture.type === "image") {
                        const [imgPromise] = await this.assetManager.get(instance.texture.url);
                        const imgBmp = await imgPromise;
                        texturePromise = this.#createImageTexture(imgBmp, device, format);
                    }
                    else if (instance.texture.type === "program") {
                        texturePromise = this.#createProgramTexture(instance.texture, instance.s, entity, device, format);
                    }
                }

                // MESH COMPONENT
                const cullMode = instance.cullMode ? instance.cullMode : "back";  // cull mode override
                const mesh = await MeshComponent.assetToMesh(
                    instance, await meshPromise, vertPromise, fragPromise, texturePromise, device, format, bindGroupLayout, viewBuffer, projectionBuffer, cullMode, topology, multisamples, debug
                );
                this.ecs.addComponent(entity, mesh);

                await meshPromise;
            }

            // ANIMATION
            if (instance.animation) {
                const animation = new AnimationComponent(instance.animation);
                this.ecs.addComponent(entity, animation);
            }

            // COLLIDER
            if (instance.collider) {
                // TODO manually set collider vertices
                if (this.ecs.hasComponent(entity, "MeshComponent")) {
                    const floats = this.ecs.getComponent(entity, "MeshComponent").vertices;
                    const colliderGenerators = {
                        aabb: AABBComponent,  // TODO other types (sphere, mesh)
                    }
                    const collider = colliderGenerators[instance.collider]?.createFromMesh(floats.data, floats.properties, instance.href, instance.ghost, instance.v);
                    if (collider) {
                        collider.modelTransform(transform.model);
                        this.ecs.addComponent(entity, collider);
                    }
                }
                else {
                    console.warn("No collider vertices specified and no MeshComponent present on entity " + entity);
                }
            }
        }
    }


    // TEXTURE CREATION
    #createImageTexture(imgBmp, device, format) {
        // create texture on device
        const texture = device.createTexture({
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
        return texture;
    }

    async #createProgramTexture(instanceTexture, scale, entity, device, format) {
        const textureSize = [512, 512];

        const texture = device.createTexture({
            label: "Program Texture",
            size: textureSize,
            format: format,
            usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING,
        });

        // TODO hardcoding
        if (instanceTexture.program === "helloTriangle") {
            const textureProgram = new TextureProgramComponent(texture, "geometry/helloTriangleScene.json", this.assetManager, device, format);
            await textureProgram.init();
            this.ecs.addComponent(entity, textureProgram);
        }
        else if (instanceTexture.program === "text") {
            if (instanceTexture.faces?.length != 1) throw new Error("Cannot render text on more than one face");

            const aspect = this.#getFaceAspect(scale, instanceTexture.faces[0]);
            const fontUrl = instanceTexture.atlas;
            const fontMetadataUrl = instanceTexture.atlasMetadata;

            // TEXT
            // TODO uv target range (allows multiple faces, requires multiple of same component)
            const textTexture = await TextComponent.fromUrls(
                texture,                   // output texture
                instanceTexture.content,  // text content
                fontUrl, fontMetadataUrl,  // glyph atlas and metadata urls
                instanceTexture.fontSize, instanceTexture.margin,
                aspect,                    // aspect ratio
                this.assetManager,
                device, format
            );
            this.ecs.addComponent(entity, textTexture);
        }

        return texture;
    }

    #getFaceAspect(scale=[1, 1, 1], face) {
        switch (face) {
            case "front": case "back": return [scale[0], scale[1]];  // x / y
            case "left": case "right": return [scale[2], scale[1]];  // z / y
            case "top": case "bottom": return [scale[0], scale[2]];  // x / z
        }
    }


    // ECS INTERFACE
    entitiesWith(...names) {
        return this.ecs.entitiesWith(...names);
    }

    getComponent(entity, name) {
        return this.ecs.getComponent(entity, name);
    }


    // START
    enableControls() { this.ecs.enableControls(); }
    disableControls() { this.ecs.disableControls(); }

    startSubEngines() {
        this.ecs.startSubEngines();
    }


    // UPDATE
    update(frame, device) {
        this.ecs.updateAnimations(frame);
        if (this.player) this.ecs.movePlayer(this.player, device);
    }


    // RENDERING
    getActiveCamera() {
        // TODO select active camera
        return this.activeCamera;
    }

    getRenderables() {
        // TODO could be instance variable and update when objects are added/removed/modified
        return this.ecs.entitiesWith("MeshComponent", "TransformComponent");
    }

    getHUD() {
        // TODO multiple HUDComponents
        return this.ecs.entitiesWith("HUDComponent");
    }
}