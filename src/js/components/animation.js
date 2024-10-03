import { BundleError } from "../errors";
import { getAnimationClass } from "../templates/animation";

const Animation = getAnimationClass();

export class AnimationComponent {
    static lookup = {};

    constructor(name) {
        this.name = name;
    }

    animate(entity, ecs, frame) {
        AnimationComponent.lookup[this.name].animate(entity, ecs, frame);
    }

    // import custom animations
    static async loadCustomAnimations() {
        const context = require.context("../../plugins/animations", false, /\.js$/);
        context.keys().forEach((key) => {
            const module = context(key);
            const className = key.replace("./", "").replace(".js", "");
            const AnimationClass = module[className];

            if (AnimationClass?.prototype instanceof Animation) {
                AnimationComponent.lookup[className] = module[className];
            }
            else {
                throw new BundleError("Skipped bundling custom Animation in " + key + ". Custom animations must inherit from the Animation class and subclass name must match file name.");
            }
        });
    }
}