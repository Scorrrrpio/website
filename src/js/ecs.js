import { lokiSpin, move, spinY } from "./animations";
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

    entitiesWith(...names) {
        let entities = [...this.entities];
        names.forEach((name) => entities = entities.filter((e) => this.hasComponent(e, name)));
        return entities;
    }


    // UPDATE LOOP
    updateAnimations() {
        // update animations
        const animations = {
            spinY: spinY,
            lokiSpin: lokiSpin,
            move: move
        }
        // TODO not ideal
        const animated = this.entitiesWith("TransformComponent").filter(e => this.components[e].TransformComponent.animation);
        for (const e of animated) {
            animations[this.components[e]["TransformComponent"].animation]?.(
                this.components[e].TransformComponent,
                this.components[e].AABBComponent
            );
        }
    }

    movePlayer(player, device) {
        // TODO this type of thing as instance variable
        const colliders = this.entitiesWith("AABBComponent");

        // movement
        const camera = this.components[player].CameraComponent;
        const inputs = this.components[player].InputComponent.inputs;
        const rotation = this.components[player].InputComponent.look;
        const position = this.components[player].TransformComponent.position;
        const physics = this.components[player].PhysicsComponent;
        movePlayer(colliders.map(e => this.components[e].AABBComponent), inputs, position, rotation, physics);
        camera.updateViewMatrix(position, rotation);  // update camera view matrix

        // raycasting
        const hit = raycast(
            this, colliders,
            [position[0] + camera.offset[0], position[1] + camera.offset[1], position[2] + camera.offset[2]],
            rotation
        );
        if (hit) {
            if (inputs.leftMouse) {
                // if link
                if (this.components[hit].AABBComponent.href) {
                    console.log("bang");
                    // stop movement
                    inputs.w = false;
                    inputs.a = false;
                    inputs.s = false;
                    inputs.d = false;
                    inputs.space = false;
                    inputs.leftMouse = false;
                    inputs.rightMouse = false;
                    // open link
                    window.open(this.components[hit].AABBComponent.href, "__blank");
                }
            }
            if (this.hasComponent(hit, "TextTexture")) {
                const scroll = this.components[player].InputComponent.scroll;
                this.components[hit].TextTexture.scroll(scroll, device);
            }
        }

        // reset scroll deltaY between frames
        this.components[player].InputComponent.scroll = 0;
    }
}