import { movePlayer, raycast } from "./physicsEngine";

export class ECS {
    constructor() {
        this.entities = [];
        this.components = {};
    }


    // GETTERS and SETTERS
    createEntity() {
        const id = this.entities.length;  // TODO better UUID function
        this.entities.push(id);
        return id;
    }

    addComponent(entity, component) {
        // TODO allow multiple of the same component?
        const name = component.constructor.name;
        let parentClass = Object.getPrototypeOf(component);
        let parentName = null;

        // get name of root class
        while (parentClass && parentClass !== Object.prototype) {
            parentName = parentClass.constructor.name;
            parentClass = Object.getPrototypeOf(parentClass);
        }
        parentName = parentName || name;

        if (!this.components[entity]) {
            this.components[entity] = {};
        }
        this.components[entity][parentName] = component;
    }

    hasComponent(entity, name) {
        return this.components[entity] && this.components[entity][name];
    }

    getComponent(entity, name) {
        if (!this.hasComponent(entity, name)) {
            throw new Error("Component " + name + " not found for entity " + entity + ".");
        }
        return this.components[entity][name];
    }

    entitiesWith(...names) {
        let entities = [...this.entities];
        names.forEach((name) => entities = entities.filter((e) => this.hasComponent(e, name)));
        return entities;
    }


    // START
    enableControls() {
        const controllable = this.entitiesWith("InputComponent");
        controllable.forEach((c) => this.getComponent(c, "InputComponent").enableControls());
    }

    disableControls() {
        const controllable = this.entitiesWith("InputComponent");
        controllable.forEach((c) => this.getComponent(c, "InputComponent").disableControls());
    }

    startSubEngines() {
        const subengines = this.entitiesWith("Engine");
        subengines.forEach((s) => this.getComponent(s, "Engine").start());
    }


    // UPDATE
    updateAnimations(frame) {
        const animated = this.entitiesWith("AnimationComponent");
        for (const e of animated) {
            this.getComponent(e, "AnimationComponent").animate(e, this, frame);
        }
    }

    // TODO script on player
    movePlayer(player, device) {
        // TODO this type of thing as instance variable
        const colliders = this.entitiesWith("ColliderComponent");

        const camera = this.getComponent(player, "CameraComponent");
        const input = this.getComponent(player, "InputComponent");
        const transform = this.getComponent(player, "TransformComponent");
        const physics = this.getComponent(player, "PhysicsComponent");

        const scroll = input.readScroll();
        const [mouseX, mouseY] = input.readMouseDelta();
        transform.rotate([mouseX, mouseY, 0]);

        // movement
        movePlayer(colliders.map(e => this.getComponent(e, "ColliderComponent")), input, transform, physics);
        camera.updateViewMatrix(transform);  // update camera view matrix

        // raycasting
        const hit = raycast(this, colliders, camera.getEye(transform.position), transform.rotation);
        if (hit) {
            if (input.mouse[0]) {
                // if link
                if (this.getComponent(hit, "ColliderComponent").href) {
                    console.log("bang");
                    input.clearAll();
                    window.open(this.getComponent(hit, "ColliderComponent").href, "__blank");  // open link
                }
            }
            if (this.hasComponent(hit, "TextComponent")) {
                this.getComponent(hit, "TextComponent").scroll(scroll, device);
            }
        }
    }
}