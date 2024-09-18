import { lokiSpin, move, spinY } from "./animations";
import { RenderEngine } from "./renderEngine";  // TODO move to Engine
import { generateHUD } from "./hud";
import { MeshComponent, TransformComponent, AABBComponent, CameraComponent, InputComponent, PhysicsComponent } from "./components";
import { movePlayer } from "./physicsEngine";

export class SceneManager {
    static async fromURL(url, assetManager, device, context, canvas, format, topology, multisamples, debug=false) {
        const scene = new SceneManager(url, assetManager);
        await scene.initialize(device, context, canvas, format, topology, multisamples, debug);
        return scene;
    }

    constructor(url, assetManager) {
        this.url = url;
        this.assetManager = assetManager;
    }

    async initialize(device, context, canvas, format, topology, multisamples, debug=false) {
        // TODO in RenderEngine (move with renderer)
        // UNIFORM BUFFERS
        // create uniform buffers for MVP matrices
        const viewBuffer = device.createBuffer({
            label: "View Uniform",
            size: 64,
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
        });
        const projectionBuffer = device.createBuffer({
            label: "Projection Uniform",
            size: 64,
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
        });


        // ENTITIES
        this.entities = [];
        this.components = {};
        await this.#loadScene(canvas, device, viewBuffer, projectionBuffer, format, topology, multisamples, debug);


        // HUD
        // TODO HUD needs depth testing and MSAA for some reason?
        this.hud = await generateHUD(device, format, projectionBuffer, multisamples);


        // RENDERER
        this.renderer = new RenderEngine(device, context, canvas, viewBuffer, projectionBuffer, multisamples);
        // TODO in InputHandler or EventSystem
        window.addEventListener("resize", () => {
            this.renderer.handleResize(this.playerOld.pov, canvas);
            for (const e in this.entitiesWith("CameraComponent")) {
                this.renderer.handleResize(this.components[e]["CameraComponent"], canvas);
            }
        });
    }

    async #loadScene(canvas, device, viewBuffer, projectionBuffer, format, topology, multisamples, debug) {
        const assets = await this.assetManager.get(this.url, debug);

        // PLAYER
        const spawn = {
            p: [0, 2.001, 0],
            r: [0, 0, 0],
        };
        const player = this.createEntity();
        const playerTransform = new TransformComponent(spawn.p, spawn.r);
        const camera = new CameraComponent(canvas.width / canvas.height, [0, 2, 0]);
        camera.updateViewMatrix(playerTransform.position, playerTransform.rotation);
        //const collider = AABBComponent.createPlayerAABB(playerTransform.position);
        const inputs = new InputComponent();
        const physics = new PhysicsComponent();
        this.addComponent(player, camera);
        this.addComponent(player, playerTransform);
        this.addComponent(player, inputs);
        this.addComponent(player, physics);
        this.player = player;


        // TODO optimize (object pooling, instanced rendering)
        for (const asset of assets.objects) {  // each object in scene
            // ASSET FAMILY DEFAULT VALUES
            const baseMesh = await this.assetManager.get(asset.file);
            const baseVert = await this.assetManager.get(asset.vertexShader);
            const baseFrag = await this.assetManager.get(asset.fragmentShader);
            // collision mesh based on geometry
            const floats = baseMesh.vertex.values.float32;
            const meshGenerators = {
                aabb: AABBComponent.createMesh,  // TODO other types (sphere, mesh)
            }
            const baseCollider = meshGenerators[asset.collision]?.(floats.data, floats.properties);

            // INSTANCE-SPECIFIC VALUES
            for (const instance of asset.instances) {
                const entity = this.createEntity();
                const transform = new TransformComponent(instance.p, instance.r, instance.s, instance.animation);
                const mesh = await MeshComponent.assetToMesh(
                    instance, baseMesh, baseVert, baseFrag, this.assetManager, device, format, viewBuffer, projectionBuffer, topology, multisamples, debug
                );
                this.addComponent(entity, transform);
                this.addComponent(entity, mesh);
                if (baseCollider) {
                    const collider = baseCollider.copy();
                    collider.setProperties(instance.href, instance.ghost, instance.v);
                    collider.modelTransform(transform.model);
                    this.addComponent(entity, collider);
                }
            }
        }
    }

    createEntity() {
        const id = this.entities.length;  // TODO better UUID function
        this.entities.push(id);
        return id;
    }

    addComponent(entity, component) {
        const name = component.constructor.name;
        if (!this.components[entity]) {
            this.components[entity] = {};
        }
        this.components[entity][name] = component;
    }

    getComponent(entity, name) {
        if (!this.components[entity] || !this.components[entity][name]) {
            throw new Error("Component ${name} not found for entity ${entity}.")
        }
        return this.components[entity][name];
    }

    hasComponent(entity, name) {
        if (!this.components[entity] || !this.components[entity][name]) return false;
        return true;
    }

    entitiesWithComponents(components) {
        const entities = [];
        for (const entity of this.entities) {
            let hasAll = true;
            for (const component of components) {
                if (!this.hasComponent(entity, component)) {
                    hasAll = false;
                    break;
                }
            }
            if (hasAll) { entities.push(entity); }
        }
        return entities;
    }

    entitiesWith(name) {
        return this.entities.filter((e) => this.hasComponent(e, name));
    }

    async update(frame, device) {
        // TODO reimplement adding entities at runtime

        // update animations
        const animations = {
            spinY: spinY,
            lokiSpin: lokiSpin,
            move: move
        }
        // TODO not ideal
        const animated = this.entitiesWithComponents(["TransformComponent"]).filter(e => this.components[e]["TransformComponent"].animation);
        for (const e of animated) {
            animations[this.components[e]["TransformComponent"].animation]?.(
                this.components[e]["TransformComponent"],
                this.components[e]["AABBComponent"]
            );
        }

        // update camera
        const colliders = this.entitiesWithComponents(["AABBComponent"]).map(e => this.components[e]["AABBComponent"]);
        this.#movePlayer(colliders);


        this.#writeTransforms(device);
    }

    #movePlayer(colliders) {
        const camera = this.components[this.player].CameraComponent;
        const inputs = this.components[this.player].InputComponent.inputs;
        const rotation = this.components[this.player].InputComponent.look;
        const position = this.components[this.player].TransformComponent.position;
        const physics = this.components[this.player].PhysicsComponent;
        movePlayer(colliders, inputs, position, rotation, camera, physics);
    }

    // TODO move logic elsewhere?
    #writeTransforms(device) {
        for (const entity of this.entitiesWithComponents(["MeshComponent", "TransformComponent"])) {
            device.queue.writeBuffer(
                this.components[entity]["MeshComponent"].modelBuffer, 0,
                this.components[entity]["TransformComponent"].model
            );
        }
    }

    // TODO move up to Engine
    render(canvas, debug) {
        // TODO could be instance variable and update when objects are added/removed/modified
        const renderables = this.entitiesWithComponents(["MeshComponent", "TransformComponent"]).map(e => this.components[e]["MeshComponent"]);
        // TODO select active camera
        const camera = this.entitiesWith("CameraComponent").map(e => this.components[e]["CameraComponent"])[0];
        this.renderer.render(camera, renderables, this.hud, canvas, debug);
    }
}