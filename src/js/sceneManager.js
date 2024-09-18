import { lokiSpin, move, spinY } from "./animations";
import { RenderEngine } from "./renderEngine";  // TODO move to Engine
import { generateHUD } from "./hud";
import { Player } from "./player";
import { MeshComponent, TransformComponent, AABBComponent } from "./components";

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


        // RENDERER
        this.renderer = new RenderEngine(device, context, canvas, viewBuffer, projectionBuffer, multisamples);
        // TODO in InputHandler or EventSystem
        window.addEventListener("resize", () => {
            this.renderer.handleResize(this.player, canvas);
        });


        // ENTITIES
        this.entities = new Set();
        this.components = {};
        await this.#loadScene(device, viewBuffer, projectionBuffer, format, topology, multisamples, debug);


        // HUD
        // TODO HUD needs depth testing and MSAA for some reason?
        this.hud = await generateHUD(device, format, projectionBuffer, multisamples);


        // PLAYER
        const spawn = {
            p: [0, 2.001, 0],
            r: [0, 0, 0],
        };
        this.player = new Player(canvas, spawn.p, spawn.r);
    }

    async #loadScene(device, viewBuffer, projectionBuffer, format, topology, multisamples, debug) {
        const assets = await this.assetManager.get(this.url, debug);  // TODO too much in one function

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
            const basePoints = meshGenerators[asset.collision]?.(floats.data, floats.properties);
            let baseCollider = null;
            if (asset.collision === "aabb") {
                baseCollider = new AABBComponent(basePoints.min, basePoints.max);
            }

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
        const id = this.entities.size;  // TODO better UUID function
        this.entities.add(id);
        return id;
    }

    addComponent(entity, component) {
        if (!this.entities.has(entity)) { throw new Error("Cannot add component to non-existant Entity"); }
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
        //const colliders = this.renderables.flatMap(asset => asset.instances.map(instance => instance.collider));
        const colliders = this.entitiesWithComponents(["AABBComponent"]).map(e => this.components[e]["AABBComponent"]);
        this.player.move(colliders);

        this.#writeTransforms(device);
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

    render(canvas, debug) {
        // TODO could be instance variable and update when objects are added/removed/modified
        const renderables = this.entitiesWithComponents(["MeshComponent", "TransformComponent"]).map(e => this.components[e]["MeshComponent"]);
        this.renderer.render(this.player, renderables, this.hud, canvas, debug)
    }
}