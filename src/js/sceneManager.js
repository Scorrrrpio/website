import { ECS } from "./ecs";
import { MeshComponent, TransformComponent, AABBComponent, CameraComponent, InputComponent, PhysicsComponent } from "./components";
import { HUD } from "./hud";

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
        // TODO HUD needs MSAA for some reason?
        this.hud = this.ecs.createEntity();
        const hud = HUD.generate(this.assetManager, device, format, projectionBuffer, multisamples);
        const hudCam = new CameraComponent(canvas.width / canvas.height, [0, 0, 0], true);
        this.ecs.addComponent(this.hud, await hud)
        this.ecs.addComponent(this.hud, hudCam);

        const assets = await assetPromise;

        for (const instance of assets.entities) {
            // fetch mesh components
            const [meshPromise, vertPromise, fragPromise] = this.assetManager.get(
                assets.geometry[instance.mesh], assets.shaders[instance.shader].vert, assets.shaders[instance.shader].frag
            );

            const entity = this.ecs.createEntity();

            // TRANSFORM
            const transform = new TransformComponent(instance.p, instance.r, instance.s, instance.animation);
            this.ecs.addComponent(entity, transform);

            // MESH
            const mesh = await MeshComponent.assetToMesh(
                instance, await meshPromise, await vertPromise, await fragPromise, this.assetManager, device, format, viewBuffer, projectionBuffer, topology, multisamples, debug
            );
            this.ecs.addComponent(entity, mesh);

            // COLLIDER
            const floats = (await meshPromise).vertex.values.float32;
            const colliderGenerators = {
                aabb: AABBComponent.createMesh,  // TODO other types (sphere, mesh)
            }
            const collider = colliderGenerators[instance.collider]?.(floats.data, floats.properties);
            if (collider) {
                collider.setProperties(instance.href, instance.ghost, instance.v);
                collider.modelTransform(transform.model);
                this.ecs.addComponent(entity, collider);
            }

            // TEXT
            if (mesh.textTexture) {  // TODO awful
                this.ecs.addComponent(entity, mesh.textTexture);
            }
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
        // TODO multiple HUDs
        return this.ecs.entitiesWith("HUD");
    }
}