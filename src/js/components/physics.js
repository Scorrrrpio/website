export class PhysicsComponent {
    constructor() {
        this.maxSpeed = 0.2;
        this.jumpImpulse = 0.25;
        this.gravity = 0.01;
        // variable
        this.jumpSpeed = 0;
        this.grounded = false;
    }
}