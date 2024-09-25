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
        if (!this.components[entity]) {
            this.components[entity] = {};
        }
        this.components[entity][name] = component;
    }

    hasComponent(entity, name) {
        return this.components[entity] && this.components[entity][name];
    }

    getComponent(entity, name) {
        if (!this.hasComponent(entity, name)) {
            throw new Error("Component " + name + " not found for entity" + entity + ".")
        }
        return this.components[entity][name];
    }

    entitiesWith(...names) {
        let entities = [...this.entities];
        names.forEach((name) => entities = entities.filter((e) => this.hasComponent(e, name)));
        return entities;
    }


    // START
    enableControls(canvas) {
        const controllable = this.entitiesWith("InputComponent");
        controllable.forEach((c) => this.getComponent(c, "InputComponent").enableControls(canvas));
    }

    startSubEngines() {
        const subengines = this.entitiesWith("TextureProgramComponent");
        subengines.forEach((s) => this.getComponent(s, "TextureProgramComponent").start());
    }


    // UPDATE
    updateAnimations(frame) {
        const animated = this.entitiesWith("AnimationComponent");
        for (const e of animated) {
            const animationParams = this.#getAnimationParameters(e, frame);
            this.getComponent(e, "AnimationComponent").animate(...animationParams);
        }
    }

    #getAnimationParameters(entity, frame) {
        // TODO better solution (custom animations extend animation class, define parameters)
        const paramMap = {
            // Cannot use this.getComponent()
            "default": [this.components[entity].TransformComponent],
            "move": [this.components[entity].TransformComponent, this.components[entity].AABBComponent],
            "helloTriangle": [this.components[entity].MeshComponent, frame]
        }
        return paramMap[this.getComponent(entity, "AnimationComponent").name] || paramMap.default;
    }

    movePlayer(player, device) {
        // TODO this type of thing as instance variable
        const colliders = this.entitiesWith("AABBComponent");

        const camera = this.getComponent(player, "CameraComponent");
        const input = this.getComponent(player, "InputComponent");
        const rotation = input.look;
        const position = this.getComponent(player, "TransformComponent").position;
        const physics = this.getComponent(player, "PhysicsComponent");

        // movement
        movePlayer(colliders.map(e => this.getComponent(e, "AABBComponent")), input.inputs, position, rotation, physics);
        camera.updateViewMatrix(position, rotation);  // update camera view matrix

        // raycasting
        const hit = raycast(
            this, colliders,
            [position[0] + camera.offset[0], position[1] + camera.offset[1], position[2] + camera.offset[2]],
            rotation
        );
        if (hit) {
            if (input.inputs.leftMouse) {
                // if link
                if (this.getComponent(hit, "AABBComponent").href) {
                    console.log("bang");
                    input.stopAll();  // stop movement
                    window.open(this.getComponent(hit, "AABBComponent").href, "__blank");  // open link
                }
            }
            if (this.hasComponent(hit, "TextComponent")) {
                const scroll = input.scroll;
                this.getComponent(hit, "TextComponent").scroll(scroll, device);
            }
        }

        // reset scroll deltaY between frames
        input.scroll = 0;
    }
}