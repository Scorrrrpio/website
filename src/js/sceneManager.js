import { HUD } from "./hud";
import { MeshComponent, TransformComponent, AABBComponent, CameraComponent, InputComponent, PhysicsComponent } from "./components";
import { ECS } from "./ecs";

export class SceneManager {
    // SETUP
    static async fromURL(url, assetManager, device, format, canvas, viewBuffer, projectionBuffer, topology, multisamples, debug=false) {
        const scene = new SceneManager(url, assetManager);
        await scene.initialize(device, format, canvas, viewBuffer, projectionBuffer, topology, multisamples, debug);
        return scene;
    }

    constructor(url, assetManager) {
        this.url = url;
        this.assetManager = assetManager;
        this.ecs = new ECS();
    }

    async initialize(device, format, canvas, viewBuffer, projectionBuffer, topology, multisamples, debug=false) {
        // PLAYER
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
        // TODO HUD needs depth testing and MSAA for some reason?
        this.hud = this.ecs.createEntity();
        const hud = HUD.generate(this.assetManager, device, format, projectionBuffer, multisamples);
        const hudCam = new CameraComponent(canvas.width / canvas.height, [0, 0, 0], true);
        this.ecs.addComponent(this.hud, await hud)
        this.ecs.addComponent(this.hud, hudCam);

        await this.#loadScene(device, viewBuffer, projectionBuffer, format, topology, multisamples, debug);
    }

    async #loadScene(device, viewBuffer, projectionBuffer, format, topology, multisamples, debug) {
        const [assetPromise] = this.assetManager.get(this.url);

        const assets = await assetPromise;
        // TODO optimize (object pooling, instanced rendering)
        for (const asset of assets.objects) {  // each object in scene
            // ASSET FAMILY DEFAULT VALUES
            const [baseMeshPromise, baseVertPromise, baseFragPromise] = this.assetManager.get(asset.file, asset.vertexShader, asset.fragmentShader);

            // collision mesh based on geometry
            const baseMesh = await baseMeshPromise;
            const floats = baseMesh.vertex.values.float32;
            const colliderGenerators = {
                aabb: AABBComponent.createMesh,  // TODO other types (sphere, mesh)
            }
            const baseCollider = colliderGenerators[asset.collision]?.(floats.data, floats.properties);

            const baseVert = await baseVertPromise;
            const baseFrag = await baseFragPromise;
            // INSTANCE-SPECIFIC VALUES
            for (const instance of asset.instances) {
                const entity = this.ecs.createEntity();
                const transform = new TransformComponent(instance.p, instance.r, instance.s, instance.animation);
                const mesh = await MeshComponent.assetToMesh(
                    instance, baseMesh, baseVert, baseFrag, this.assetManager, device, format, viewBuffer, projectionBuffer, topology, multisamples, debug
                );
                this.ecs.addComponent(entity, transform);
                this.ecs.addComponent(entity, mesh);
                if (baseCollider) {
                    const collider = baseCollider.copy();
                    collider.setProperties(instance.href, instance.ghost, instance.v);
                    collider.modelTransform(transform.model);
                    this.ecs.addComponent(entity, collider);
                }
                if (mesh.textTexture) {  // TODO awful
                    this.ecs.addComponent(entity, mesh.textTexture);
                }
            }
        }
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
        // TODO multiple HUDs
        return this.ecs.entitiesWith("HUD");
    }
}