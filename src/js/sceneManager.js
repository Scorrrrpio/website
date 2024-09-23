import { ECS } from "./ecs";
import { createBindGroupLayout } from "./wgpuHelpers";

import { AABBComponent } from "./components/collider";
import { AnimationComponent } from "./components/animations";
import { CameraComponent } from "./components/camera";
import { HUDComponent } from "./components/hud";
import { InputComponent } from "./components/input";
import { MeshComponent } from "./components/mesh";
import { PhysicsComponent } from "./components/physics";
import { TransformComponent } from "./components/transform";

// TODO eliminate?
import { TextTexture } from "./components/textTexture";
import { textureTriangle } from "./textureTriangle";

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

        // PLAYER
        // TODO from scene json
        const player = this.ecs.createEntity();
        const spawn = {
            p: [0, 2.001, 0],
            r: [0, 0, 0],
        };
        const inputs = new InputComponent();
        const physics = new PhysicsComponent();
        const playerTransform = new TransformComponent(spawn.p, spawn.r);
        const camera = new CameraComponent(canvas.width / canvas.height, [0, 2, 0]);
        camera.updateViewMatrix(playerTransform.position, playerTransform.rotation);
        this.ecs.addComponent(player, camera);
        this.ecs.addComponent(player, playerTransform);
        this.ecs.addComponent(player, inputs);
        this.ecs.addComponent(player, physics);
        this.player = player;


        // HUD
        // TODO from scene json
        // TODO HUDComponent needs MSAA for some reason?
        this.hud = this.ecs.createEntity();
        const hud = HUDComponent.generate(this.assetManager, device, format, projectionBuffer, multisamples);
        const hudCam = new CameraComponent(canvas.width / canvas.height, [0, 0, 0], true);
        this.ecs.addComponent(this.hud, await hud)
        this.ecs.addComponent(this.hud, hudCam);

        const assets = await assetPromise;

        // TODO in separate manifest file instead of scene?
        const animationPromise = AnimationComponent.loadCustom(...assets.animations);  // load custom animations
        //const textureProgramPromise = 

        for (const instance of assets.entities) {
            // fetch mesh components
            const [meshPromise, vertPromise, fragPromise] = this.assetManager.get(
                assets.geometry[instance.mesh], assets.shaders[instance.shader].vert, assets.shaders[instance.shader].frag
            );

            const entity = this.ecs.createEntity();

            // TRANSFORM
            const transform = new TransformComponent(instance.p, instance.r, instance.s);
            this.ecs.addComponent(entity, transform);

            // MESH
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

            // COLLIDER
            const floats = (await meshPromise).vertex.values.float32;
            const colliderGenerators = {
                aabb: AABBComponent.createMesh,  // TODO other types (sphere, mesh)
            }
            const collider = colliderGenerators[instance.collider]?.(floats.data, floats.properties, instance.href, instance.ghost, instance.v);
            if (collider) {
                collider.modelTransform(transform.model);
                this.ecs.addComponent(entity, collider);
            }

            // ANIMATION
            if (instance.animation) {
                const animationParams = instance.animation === "move" ? [transform, collider] : [transform];
                const animation = new AnimationComponent(instance.animation, ...animationParams);
                this.ecs.addComponent(entity, animation);
            }
        }

        await animationPromise;
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

        if (instanceTexture.program === "helloTriangle") {
            const [vertPromise, fragPromise] = this.assetManager.get("shaders/helloTriangle.vert.wgsl", "shaders/helloTriangle.frag.wgsl");
            textureTriangle(vertPromise, fragPromise, texture, device, format);
        }
        else if (instanceTexture.program === "text") {
            if (instanceTexture.faces?.length != 1) throw new Error("Cannot render text on more than one face");

            const aspect = this.#getFaceAspect(scale, instanceTexture.faces[0]);
            const fontUrl = instanceTexture.atlas;
            const fontMetadataUrl = instanceTexture.atlasMetadata;

            // TEXT
            // TODO uv target range (allows multiple faces)
            const textTexture = await TextTexture.fromUrls(
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


    // UPDATE
    update(frame, device) {
        // TODO reimplement adding entities at runtime
        this.ecs.updateAnimations();
        this.ecs.movePlayer(this.player, device);
    }


    // RENDERING
    getActiveCamera() {
        // TODO select active camera
        return this.ecs.entitiesWith("CameraComponent")[0];
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