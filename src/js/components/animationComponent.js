import { AssetLoadError } from "../errors";
import { Animation } from "../templates/animation";

export class AnimationComponent {
    static lookup = {};

    constructor(name) {
        this.name = name;
    }

    animate(ecs, entity, frame) {
        const parameters = AnimationComponent.lookup[this.name].requiredComponents.map((comp) => ecs.getComponent(entity, comp));
        AnimationComponent.lookup[this.name].animate(...parameters, frame);  // TODO frame solution
    }

    // import custom animations
    static async loadCustom(...paths) {
        for (const path of paths) {
            const module = await import(/* webpackIgnore: true */ path).catch(() => {
                throw new AssetLoadError("Failed to load custom animation script from " + path);
            });
            for (const [name, fn] of Object.entries(module)) {
                if (fn.prototype.constructor.animate) {  // TODO fn.prototype instanceof Animation
                    AnimationComponent.lookup[name] = fn;
                }
                else {
                    throw new Error("'" + name + "' in file " + path + " does not inherit from Animation class");
                }
            }
        }
    }
}