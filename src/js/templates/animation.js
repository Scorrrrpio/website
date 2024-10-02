let AnimationInstance = null;

class Animation {
    static animate(entity, ecs) {
        throw new Error("The 'animate' method must be implemented in subclasses of Animation");
    }
}

// Singleton
// TODO I really hate this
export function getAnimationClass() {
    if (!AnimationInstance) {
        AnimationInstance = Animation;
    }
    return AnimationInstance;
}